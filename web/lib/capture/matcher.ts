const STOP_WORDS = new Set([
  'the','a','an','is','it','in','on','at','to','for','of','and','or','but',
  'with','this','that','i','we','you','he','she','they','be','been','has',
  'have','had','do','did','will','would','could','should','from','by','as',
  'are','was','were','not','no','can','may','might','its','my','your','our',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
  for (const [w, c] of tf) tf.set(w, c / tokens.length)
  return tf
}

function cosine(
  v1: Map<string, number>,
  v2: Map<string, number>
): { score: number; keywords: string[] } {
  let dot = 0, mag1 = 0, mag2 = 0
  const shared: string[] = []
  for (const [w, wt] of v1) {
    mag1 += wt * wt
    if (v2.has(w)) { dot += wt * v2.get(w)!; shared.push(w) }
  }
  for (const wt of v2.values()) mag2 += wt * wt
  if (!mag1 || !mag2) return { score: 0, keywords: [] }
  return { score: dot / (Math.sqrt(mag1) * Math.sqrt(mag2)), keywords: shared }
}

export function computeMatch(
  researchContent: string,
  taskTitle: string,
  taskDescription?: string | null
) {
  return cosine(
    termFrequency(tokenize(researchContent)),
    termFrequency(tokenize(`${taskTitle} ${taskDescription || ''}`))
  )
}
