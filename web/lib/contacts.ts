// Shared validation/normalization for contact input (API layer).
//
// A contact needs at least one of email/phone. Both are normalized before
// storage — email lowercased, phone reduced to +digits — so the per-user
// unique constraints in the schema treat "(617) 555-0142" and "6175550142"
// as the same person.

export type ContactInput = {
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  notes: string | null
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t === '' ? null : t
}

export function normalizeEmail(v: unknown): string | null {
  const t = cleanText(v, 320)
  if (!t) return null
  const lower = t.toLowerCase()
  return EMAIL_RE.test(lower) ? lower : null
}

// Accepts common human formatting ((617) 555-0142, +44 20 7946 0958) and
// stores digits with an optional leading +. Rejects anything that isn't
// plausibly a phone number (7–15 digits, per E.164's upper bound).
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const stripped = v.trim().replace(/[\s().\-]/g, '')
  return /^\+?\d{7,15}$/.test(stripped) ? stripped : null
}

export function normalizeContactInput(body: unknown): ContactInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const email = normalizeEmail(b.email)
  const phone = normalizePhone(b.phone)

  if (b.email && !email) return { error: 'email is not valid' }
  if (b.phone && !phone) return { error: 'phone is not valid' }
  if (!email && !phone) return { error: 'email or phone is required' }

  return {
    name: cleanText(b.name, 200),
    email,
    phone,
    company: cleanText(b.company, 200),
    notes: cleanText(b.notes, 2000),
  }
}
