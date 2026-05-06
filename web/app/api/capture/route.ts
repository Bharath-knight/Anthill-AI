import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractWithGroq(text: string): Promise<{ company: string | null; role: string | null; location: string | null; deadline: string | null }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const prompt = `Extract structured job information from the text.

Return ONLY valid JSON. No explanation.

Format:
{
  "company": "",
  "role": "",
  "location": "",
  "deadline": ""
}

Rules:
- Company = hiring company name (not platform)
- Role = job title
- Location = city/remote if present
- Deadline = application deadline if mentioned, else null
- If unknown, return null

Job text:
"""
${text}
"""`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq error: ${res.status} — ${errText}`)
  }

  const data = await res.json()
  const raw = (data.choices?.[0]?.message?.content as string ?? '').trim()

  const fallback = { company: null, role: null, location: null, deadline: null }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return fallback

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return fallback
  }

  const keys = ['company', 'role', 'location', 'deadline'] as const
  for (const key of keys) {
    const val = parsed[key]
    if (val === null || val === undefined || val === 'null' || val === 'N/A' || (typeof val === 'string' && val.trim() === '')) {
      parsed[key] = null
    } else if (typeof val === 'string') {
      parsed[key] = val.trim()
    }
    if (!(key in parsed)) parsed[key] = null
  }

  return parsed as { company: string; role: string; location: string; deadline: string | null }
}

export async function POST(request: NextRequest) {
  const userId = process.env.DEV_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'DEV_USER_ID not set in .env.local' }, { status: 500, headers: CORS })
  }

  const body = await request.json()
  const { type, sourceUrl, rawText } = body

  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400, headers: CORS })
  }

  if (type === 'job') {
    if (!sourceUrl) {
      return NextResponse.json({ error: 'sourceUrl is required for job capture' }, { status: 400, headers: CORS })
    }

    // Fetch page
    let html: string
    try {
      const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      html = await res.text()
    } catch {
      return NextResponse.json({ error: `Failed to fetch page: ${sourceUrl}` }, { status: 400, headers: CORS })
    }

    // Clean text, limit to 6000 chars
    const pageText = htmlToText(html).slice(0, 6000)

    // Extract fields via Groq
    let fields: { company: string | null; role: string | null; location: string | null; deadline: string | null }
    try {
      fields = await extractWithGroq(pageText)
    } catch (err: any) {
      return NextResponse.json({ error: `LLM extraction failed: ${err.message}` }, { status: 422, headers: CORS })
    }

    const existing = await prisma.job.findUnique({
      where: { userId_link: { userId, link: sourceUrl } },
    })

    if (existing) {
      // Overwrite only fields that were null/unknown before
      const patch: Record<string, string> = {}
      if (fields.company && (existing.company === 'Unknown Company' || existing.company === null)) patch.company = fields.company
      if (fields.role && (existing.role === 'Unknown Role' || existing.role === null)) patch.role = fields.role
      if (fields.location && !existing.location) patch.location = fields.location
      if (fields.deadline && existing.deadline === 'Deadline not given') patch.deadline = fields.deadline

      const job = Object.keys(patch).length > 0
        ? await prisma.job.update({ where: { id: existing.id }, data: patch })
        : existing

      return NextResponse.json({ type: 'job', ...job }, { status: 200, headers: CORS })
    }

    const job = await prisma.job.create({
      data: {
        userId,
        company: fields.company || 'Unknown Company',
        role: fields.role || 'Unknown Role',
        location: fields.location || null,
        deadline: fields.deadline || 'Deadline not given',
        link: sourceUrl,
        rawText: pageText,
        status: 'SAVED',
      },
    })

    await prisma.task.create({
      data: {
        userId,
        title: `Review & apply to ${job.role} at ${job.company}`,
        linkedJobId: job.id,
      },
    })

    return NextResponse.json({ type: 'job', ...job }, { status: 201, headers: CORS })
  }

  if (type === 'research') {
    if (!rawText) {
      return NextResponse.json({ error: 'rawText is required for research capture' }, { status: 400, headers: CORS })
    }
    let domain: string | null = null
    if (sourceUrl) {
      try { domain = new URL(sourceUrl).hostname } catch {}
    }
    const item = await prisma.researchItem.create({
      data: { userId, content: rawText, sourceUrl: sourceUrl || null, domain },
    })
    return NextResponse.json({ type: 'research', ...item }, { status: 201, headers: CORS })
  }

  return NextResponse.json({ error: 'type must be "job" or "research"' }, { status: 400, headers: CORS })
}
