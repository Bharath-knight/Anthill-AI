import { describe, expect, it } from 'vitest'
import {
  htmlToText,
  isBlockedHost,
  urlLooksLikeJob,
  hasJobPostingSchema,
  decodeEntities,
} from './capture-utils'

describe('htmlToText', () => {
  it('drops script/style bodies, strips tags, and collapses whitespace', () => {
    const html = `
      <html><head><style>.a{color:red}</style></head>
      <body><script>var x = 1</script>
      <h1>Hello&nbsp;&amp;</h1>   <p>World</p></body></html>`
    expect(htmlToText(html)).toBe('Hello & World')
  })
})

describe('isBlockedHost (SSRF guard)', () => {
  it('blocks loopback, link-local, and private ranges', () => {
    for (const h of [
      'localhost', 'app.localhost', 'printer.local',
      '127.0.0.1', '0.0.0.0', '10.1.2.3', '192.168.0.1',
      '169.254.1.1', '172.16.0.1', '172.31.255.255', '::1', '[::1]',
    ]) {
      expect(isBlockedHost(h), h).toBe(true)
    }
  })

  it('allows public hosts and public IPs', () => {
    for (const h of ['example.com', 'anthill-ai.vercel.app', '8.8.8.8', '172.15.0.1', '172.32.0.1']) {
      expect(isBlockedHost(h), h).toBe(false)
    }
  })
})

describe('urlLooksLikeJob', () => {
  it('recognizes known ATS hosts and job-like paths', () => {
    expect(urlLooksLikeJob(new URL('https://boards.greenhouse.io/acme/jobs/123'))).toBe(true)
    expect(urlLooksLikeJob(new URL('https://acme.lever.co/opening'))).toBe(true)
    expect(urlLooksLikeJob(new URL('https://careers.acme.com/positions/eng'))).toBe(true)
    expect(urlLooksLikeJob(new URL('https://acme.com/careers'))).toBe(true)
  })

  it('does not flag ordinary pages', () => {
    expect(urlLooksLikeJob(new URL('https://example.com/blog/hello'))).toBe(false)
    expect(urlLooksLikeJob(new URL('https://news.ycombinator.com/item?id=1'))).toBe(false)
  })
})

describe('hasJobPostingSchema', () => {
  it('detects schema.org JobPosting JSON-LD', () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Engineer"}</script>`
    expect(hasJobPostingSchema(html)).toBe(true)
  })

  it('ignores unrelated structured data', () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Article","headline":"Hi"}</script>`
    expect(hasJobPostingSchema(html)).toBe(false)
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(decodeEntities('&#72;&#105;')).toBe('Hi')
    expect(decodeEntities('caf&#xe9;')).toBe('café')
  })
})
