import { describe, expect, it } from 'vitest'
import { parseJob } from './job-parser'

describe('parseJob', () => {
  it('extracts fields and uses the link found in the text', () => {
    const text = [
      'Company: Anthropic',
      'Job Title: Software Engineer',
      'Location: Remote',
      'Apply by: March 1',
      'Apply here: https://boards.greenhouse.io/anthropic/jobs/42',
    ].join('\n')

    const result = parseJob(text)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.link).toBe('https://boards.greenhouse.io/anthropic/jobs/42')
      expect(result.data.company).toBe('Anthropic')
      expect(result.data.role).toBe('Software Engineer')
      expect(result.data.location).toBe('Remote')
    }
  })

  it('falls back to the active tab URL when the text has no link', () => {
    const result = parseJob('Company: Acme\nPosition: Data Analyst', 'https://acme.com/careers/1')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.link).toBe('https://acme.com/careers/1')
  })

  it('fails with no_link but still returns partial fields when no link exists', () => {
    const result = parseJob('Company: Acme\nPosition: Data Analyst')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('no_link')
      expect(result.partial.company).toBe('Acme')
      expect(result.partial).not.toHaveProperty('link')
    }
  })
})
