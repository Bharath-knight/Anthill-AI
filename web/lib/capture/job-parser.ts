export interface ParsedJob {
  company: string
  role: string
  location: string
  deadline: string
  link: string
  rawText: string
}

export type ParseResult =
  | { success: true; data: ParsedJob }
  | { success: false; error: 'no_link'; partial: Omit<ParsedJob, 'link'> }

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s\)\"\'<>]+/)
  return match ? match[0].replace(/[,;.\)]+$/, '') : null
}

function extractCompany(text: string): string {
  const patterns = [
    /^Company[:\s]+(.+)$/im,
    /^([^\n]+?)\s+is hiring/im,
    /^About\s+([A-Z][A-Za-z0-9\s&,\.]+?)(?:\s*[\.\n]|$)/im,
    /\bat\s+([A-Z][A-Za-z0-9\s&,\.]+?)(?:\s*[-–|,\.\n]|$)/m,
    /([A-Z][A-Za-z0-9\s&\.]+?)\s*[-–|]\s*(?:Job|Career|Position|Role|Hiring)/i,
    // "Anthropic — Software Engineer" or "Google | Senior Engineer"
    /^([A-Z][A-Za-z0-9\s&,\.]{1,40})\s*[–—|]\s*(?=.*(?:Engineer|Developer|Manager|Analyst|Designer|Intern|Scientist|Director))/im,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ')
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 4)) {
    if (line.length < 60 && /^[A-Z]/.test(line) && !line.includes(':') && !line.startsWith('http')) {
      return line
    }
  }
  return 'Unknown Company'
}

function extractRole(text: string): string {
  const patterns = [
    /^(?:Job Title|Position|Role|Title)[:\s]+(.+)$/im,
    // Whole-line role title (existing)
    /^((?:Senior|Junior|Lead|Staff|Principal|Head of|Associate)?\s*(?:Software|Frontend|Backend|Full.?Stack|Product|Data|ML|AI|DevOps|Cloud|QA|Security|UX|UI|Design|Marketing|Sales|Engineering|Research|Operations)\s*\w*(?:\s+\w+){0,3})$/im,
    // Role embedded in a sentence: "Software Engineer at ...", "Hiring a Senior Manager ..."
    /\b((?:(?:Senior|Junior|Lead|Staff|Principal|Associate)\s+)?(?:Software|Frontend|Backend|Full.?Stack|Product|Data|ML|AI|DevOps|Cloud|QA|Security|UX|UI|Design|Marketing|Sales|Research|Operations)\s*(?:Engineer|Developer|Manager|Analyst|Designer|Scientist|Intern|Director|Architect|Specialist))\b/i,
    // Any line that is itself a recognizable job title
    /^(.{5,60}(?:Engineer|Developer|Intern|Manager|Analyst|Designer|Scientist|Director|Architect|Specialist))$/im,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return 'Unknown Role'
}

function extractLocation(text: string): string {
  const patterns = [
    /^Location[:\s]+(.+)$/im,
    /\b(Remote|Hybrid|On-?site)\b/i,
    /([A-Z][a-z]+(?:,\s*[A-Z]{2}))/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return 'Not specified'
}

function extractDeadline(text: string): string {
  const patterns = [
    /(?:Apply by|Application deadline|Applications close|Deadline|Due)[:\s]+([^\n]+)/i,
    /(?:closes?|due)[:\s]+([^\n]+)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return 'Deadline not given'
}

export function parseJob(rawText: string, activeTabUrl?: string): ParseResult {
  const link = extractUrl(rawText) || activeTabUrl || null

  const partial = {
    company: extractCompany(rawText),
    role: extractRole(rawText),
    location: extractLocation(rawText),
    deadline: extractDeadline(rawText),
    rawText,
  }

  if (!link) return { success: false, error: 'no_link', partial }
  return { success: true, data: { ...partial, link } }
}
