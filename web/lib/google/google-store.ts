import type { CalendarEvent } from '@prisma/client'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/auth/crypto'
import {
  refreshAccessToken,
  fetchGoogleEmail,
  listGoogleEvents,
  insertGoogleEvent,
  patchGoogleEvent,
  deleteGoogleEvent,
  parseGoogleEvent,
  type GoogleTokens,
  type GoogleEventInput,
} from '@/lib/google/google'

// ── Account lifecycle ───────────────────────────────────────────────────────

// Persist tokens after the OAuth callback. Refresh token is only returned on
// first consent (prompt=consent guarantees it); on re-connect we keep the
// existing one if Google omits it.
export async function saveGoogleAccount(userId: string, tokens: GoogleTokens, scope: string): Promise<void> {
  const email = await fetchGoogleEmail(tokens.accessToken)
  const expiry = new Date(Date.now() + tokens.expiresIn * 1000)

  const existing = await prisma.googleAccount.findUnique({ where: { userId } })
  const refreshToken = tokens.refreshToken ?? (existing ? null : undefined)
  if (refreshToken === undefined) {
    throw new Error('Google did not return a refresh token; reconnect with consent.')
  }

  if (existing) {
    await prisma.googleAccount.update({
      where: { userId },
      data: {
        googleEmail: email,
        accessToken: encrypt(tokens.accessToken),
        ...(refreshToken ? { refreshToken: encrypt(refreshToken) } : {}),
        expiry,
        scope,
      },
    })
  } else {
    await prisma.googleAccount.create({
      data: {
        userId,
        googleEmail: email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(refreshToken as string),
        expiry,
        scope,
      },
    })
  }
}

export async function getConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const acc = await prisma.googleAccount.findUnique({ where: { userId }, select: { googleEmail: true } })
  return { connected: !!acc, email: acc?.googleEmail ?? null }
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { userId } })
  // Remove pulled Google-origin events so the calendar doesn't show stale copies.
  await prisma.calendarEvent.deleteMany({ where: { userId, source: 'GOOGLE' } })
}

// A valid access token, refreshing if within 60s of expiry. null = not connected.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const acc = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!acc) return null
  if (acc.expiry.getTime() - 60_000 > Date.now()) return decrypt(acc.accessToken)

  const tokens = await refreshAccessToken(decrypt(acc.refreshToken))
  await prisma.googleAccount.update({
    where: { userId },
    data: { accessToken: encrypt(tokens.accessToken), expiry: new Date(Date.now() + tokens.expiresIn * 1000) },
  })
  return tokens.accessToken
}

// ── Pull (Google → Anthill) ─────────────────────────────────────────────────
// Reconcile the user's Google events for [start, end) into local rows: create
// new Google-origin events, update changed ones (last-write-wins by Google's
// `updated`), and remove ones deleted/cancelled on Google.
export async function pullAndReconcile(userId: string, start: Date, end: Date, accessToken: string): Promise<void> {
  const googleEvents = await listGoogleEvents(accessToken, start, end)
  const seen = new Set<string>()

  for (const g of googleEvents) {
    seen.add(g.id)
    const existing = await prisma.calendarEvent.findFirst({ where: { userId, googleEventId: g.id } })

    if (g.status === 'cancelled') {
      if (existing) await prisma.calendarEvent.delete({ where: { id: existing.id } })
      continue
    }

    const parsed = parseGoogleEvent(g)
    if (!parsed) continue

    if (!existing) {
      await prisma.calendarEvent.create({
        data: {
          userId,
          title: parsed.title,
          start: parsed.start,
          end: parsed.end,
          allDay: parsed.allDay,
          type: 'PERSONAL',
          notes: parsed.notes,
          source: 'GOOGLE',
          googleEventId: g.id,
          googleUpdated: parsed.updated,
        },
      })
    } else if (parsed.updated.getTime() > (existing.googleUpdated?.getTime() ?? 0)) {
      // Google's copy is newer than what we last synced → apply it.
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: parsed.title,
          start: parsed.start,
          end: parsed.end,
          allDay: parsed.allDay,
          notes: parsed.notes,
          googleUpdated: parsed.updated,
        },
      })
    }
  }

  // Safety sweep: Google-origin rows in range that Google no longer returns were
  // hard-deleted there. Restricted to source=GOOGLE so a transient Google miss
  // can never delete a user's own Anthill-origin event.
  const localGoogle = await prisma.calendarEvent.findMany({
    where: { userId, source: 'GOOGLE', start: { lt: end }, end: { gt: start } },
    select: { id: true, googleEventId: true },
  })
  const orphanIds = localGoogle.filter((r) => r.googleEventId && !seen.has(r.googleEventId)).map((r) => r.id)
  if (orphanIds.length) await prisma.calendarEvent.deleteMany({ where: { id: { in: orphanIds } } })
}

// ── Push (Anthill → Google) ─────────────────────────────────────────────────
// Each helper is a no-op when the user isn't connected. Callers should wrap in
// try/catch so a Google failure never breaks the local write.
function eventToInput(e: CalendarEvent): GoogleEventInput {
  return { title: e.title, start: e.start, end: e.end, allDay: e.allDay, notes: e.notes }
}

export async function pushCreate(userId: string, event: CalendarEvent): Promise<void> {
  const token = await getValidAccessToken(userId)
  if (!token) return
  const g = await insertGoogleEvent(token, eventToInput(event))
  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { googleEventId: g.id, googleUpdated: g.updated ? new Date(g.updated) : new Date() },
  })
}

export async function pushUpdate(userId: string, event: CalendarEvent): Promise<void> {
  const token = await getValidAccessToken(userId)
  if (!token) return
  if (!event.googleEventId) return pushCreate(userId, event)
  const g = await patchGoogleEvent(token, event.googleEventId, eventToInput(event))
  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { googleUpdated: g.updated ? new Date(g.updated) : new Date() },
  })
}

export async function pushDelete(userId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return
  const token = await getValidAccessToken(userId)
  if (!token) return
  await deleteGoogleEvent(token, googleEventId)
}
