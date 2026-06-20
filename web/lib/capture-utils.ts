// Shared helpers for the capture + preview routes. Both take a user-supplied URL,
// fetch it server-side, and reason about the result, so the SSRF guard, text
// extraction, and deterministic job-signal detection live here to avoid drift.

export function htmlToText(html: string): string {
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

// Basic SSRF guard: block obvious local/private targets before the server fetches a
// user-supplied URL. Checks the literal hostname only (no DNS resolution) — accepted MVP risk.
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true
  if (h === '::1' || h === '::') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  return false
}

// --- Deterministic job detection: structured-data + URL signals, no LLM call -----
// A capture is a job when EITHER the page embeds schema.org JobPosting structured
// data OR the URL matches a known ATS/job-board host or a job-like path.

function jsonLdHasJobPosting(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(jsonLdHasJobPosting)
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const t = obj['@type']
    if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return true
    if (jsonLdHasJobPosting(obj['@graph'])) return true
  }
  return false
}

// Job pages embed <script type="application/ld+json">{"@type":"JobPosting",...}</script>
// for Google Jobs — present in the server-rendered HTML even on JS-heavy sites.
export function hasJobPostingSchema(html: string): boolean {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const block = m[1].trim()
    try {
      if (jsonLdHasJobPosting(JSON.parse(block))) return true
    } catch {
      // Malformed/concatenated JSON-LD: cheap substring check as a fallback.
      if (/"@type"\s*:\s*("JobPosting"|\[[^\]]*"JobPosting")/.test(block)) return true
    }
  }
  return false
}

// Dedicated ATS / job-board hosts — everything served here is a job posting.
const JOB_HOST_SUFFIXES = [
  'greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com',
  'smartrecruiters.com', 'icims.com', 'workable.com', 'jobvite.com',
  'breezy.hr', 'recruitee.com', 'teamtailor.com',
]

// Job-like path segments — catches mixed hosts (LinkedIn, Indeed, Glassdoor) and
// company career pages on custom domains (careers.acme.com/...).
const JOB_PATH_RE = /\/(jobs?|careers?|positions?|vacanc(?:y|ies)|openings?|viewjob|requisition)(?:[/_?#-]|$)/i

export function urlLooksLikeJob(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  if (JOB_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))) return true
  return JOB_PATH_RE.test(url.pathname)
}
