import { describe, expect, it } from 'vitest'
import { computeMatch } from './matcher'

describe('computeMatch', () => {
  it('scores identical content as a near-perfect match', () => {
    const text = 'distributed systems kubernetes golang infrastructure'
    const { score, keywords } = computeMatch(text, text)
    expect(score).toBeCloseTo(1, 5)
    expect(keywords).toEqual(expect.arrayContaining(['distributed', 'systems', 'kubernetes']))
  })

  it('scores disjoint content as zero with no shared keywords', () => {
    const { score, keywords } = computeMatch(
      'gardening tomatoes soil compost',
      'quantum entanglement photons',
    )
    expect(score).toBe(0)
    expect(keywords).toEqual([])
  })

  it('gives a partial score when some terms overlap', () => {
    const { score, keywords } = computeMatch(
      'react frontend typescript testing',
      'react backend python testing',
    )
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
    expect(keywords).toEqual(expect.arrayContaining(['react', 'testing']))
  })

  it('ignores stop words and words of two characters or fewer', () => {
    // Only stop words + short tokens in common → no meaningful overlap.
    const { score } = computeMatch('the a it is on', 'we be by my our')
    expect(score).toBe(0)
  })

  it('folds the task description into the task vector', () => {
    const withDesc = computeMatch('kubernetes operator controller', 'Ticket', 'kubernetes operator work')
    const withoutDesc = computeMatch('kubernetes operator controller', 'Ticket')
    expect(withDesc.score).toBeGreaterThan(withoutDesc.score)
  })
})
