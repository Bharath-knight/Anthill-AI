import { describe, it, expect } from 'vitest'
import { normalizeEmail, normalizePhone, normalizeContactInput } from './contacts'

describe('normalizeEmail', () => {
  it('lowercases and accepts a valid address', () => {
    expect(normalizeEmail('Jane.Doe+hi@Example.COM')).toBe('jane.doe+hi@example.com')
  })
  it('rejects non-addresses', () => {
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('strips human formatting', () => {
    expect(normalizePhone('(617) 555-0142')).toBe('6175550142')
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhone('617.555.0142')).toBe('6175550142')
  })
  it('rejects things that are not phone numbers', () => {
    expect(normalizePhone('123')).toBeNull() // too short
    expect(normalizePhone('12345678901234567890')).toBeNull() // too long
    expect(normalizePhone('call me')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('normalizeContactInput', () => {
  it('requires an email or phone', () => {
    expect(normalizeContactInput({ name: 'Jane' })).toEqual({ error: 'email or phone is required' })
  })
  it('rejects an invalid email rather than silently dropping it', () => {
    expect(normalizeContactInput({ email: 'nope' })).toEqual({ error: 'email is not valid' })
  })
  it('rejects an invalid phone rather than silently dropping it', () => {
    expect(normalizeContactInput({ phone: 'abc' })).toEqual({ error: 'phone is not valid' })
  })
  it('normalizes a full payload', () => {
    expect(normalizeContactInput({
      name: '  Jane Doe ', email: 'Jane@Example.com', phone: '(617) 555-0142',
      company: 'Acme', notes: 'Recruiter',
    })).toEqual({
      name: 'Jane Doe', email: 'jane@example.com', phone: '6175550142',
      company: 'Acme', notes: 'Recruiter',
    })
  })
  it('treats blank strings as absent', () => {
    expect(normalizeContactInput({ email: 'a@b.co', name: '  ', company: '', notes: undefined })).toEqual({
      name: null, email: 'a@b.co', phone: null, company: null, notes: null,
    })
  })
})
