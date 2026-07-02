import { createHash, randomBytes } from 'crypto'

export const RESET_TTL_MINUTES = 60

export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashResetToken(token) }
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function buildResetUrl(origin: string, token: string): string {
  const url = new URL('/reset-password', origin)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<{ sent: boolean; reason?: string }> {
  const gmailUser = process.env.GMAIL_USER
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailAppPassword) {
    return { sent: false, reason: 'email_not_configured' }
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
  })

  try {
    await transporter.sendMail({
      from: `Anthill <${gmailUser}>`,
      to: email,
      subject: 'Reset your Anthill password',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>Reset your Anthill password</h2>
          <p>Use this link to choose a new password. It expires in ${RESET_TTL_MINUTES} minutes.</p>
          <p><a href="${resetUrl}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
      text: `Reset your Anthill password: ${resetUrl}\n\nThis link expires in ${RESET_TTL_MINUTES} minutes.`,
    })
    return { sent: true }
  } catch {
    return { sent: false, reason: 'email_send_failed' }
  }
}
