import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// Symmetric encryption for OAuth tokens at rest. The key is derived from
// JWT_SECRET (already required for auth) so no new env var is needed. Format of
// an encrypted string is `v1:<iv>:<authTag>:<ciphertext>`, all base64.

const KEY = createHash('sha256').update(process.env.JWT_SECRET ?? '').digest() // 32 bytes
const ALGO = 'aes-256-gcm'

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload')
  }
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
