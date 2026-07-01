# Anthill Setup Guide

For full developer handoff, secrets policy, and owner/new-developer checklists,
start with [docs/developer-onboarding.md](docs/developer-onboarding.md).

## Prerequisites

- Node.js 18+
- Git
- A Supabase project for the database
- Optional: Google Cloud OAuth credentials for Google Sign-In and Calendar sync
- Optional: Groq API key for better capture classification and previews
- Optional locally, required in production: Resend API key for password reset emails

## 1. Web App Setup

```bash
cd anthill/web
npm install
cp .env.example .env.local
```

Fill `web/.env.local`.

Required:

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_SIGNIN_REDIRECT_URI=
GROQ_API_KEY=
RESEND_API_KEY=
PASSWORD_RESET_FROM=
```

Generate a local JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you are using the shared development Supabase database, use the shared
development `JWT_SECRET` from the project owner instead of generating your own.

## 2. Database

Anthill uses Prisma with PostgreSQL/Supabase.

For Supabase:

- Use the transaction/pooler URL for `DATABASE_URL`, usually port `6543`.
- Use the session/direct URL for `DIRECT_URL`, usually port `5432`.

Then run:

```bash
npm run db:generate
npm run db:push
```

If you are working against a shared dev database, confirm with the owner before
pushing schema changes.

## 3. Start Local Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Sign up with your own Anthill email/password account.

## 4. Google OAuth Setup

Google is optional unless you need Google Sign-In or Google Calendar sync.

Create or open a Google Cloud OAuth client of type `Web application` and add:

```text
http://localhost:3000/api/google/callback
http://localhost:3000/api/auth/google/callback
https://anthill-ai.vercel.app/api/google/callback
https://anthill-ai.vercel.app/api/auth/google/callback
```

Then set:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

The redirect override variables can usually stay blank.

## 5. Password Reset Email

Anthill uses Resend for classic password reset links.

For production, set:

```env
RESEND_API_KEY=
PASSWORD_RESET_FROM=Anthill <noreply@your-domain.com>
```

`PASSWORD_RESET_FROM` must be a verified sender or domain in Resend. In local
development, if these values are blank, the forgot-password page returns a local
reset link so the flow can still be tested without sending email.

## 6. Chrome Extension

The extension lives in `extension/` and currently talks to production:

```text
https://anthill-ai.vercel.app
```

To load it manually:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the repo's `extension/` folder.
5. Sign in with an Anthill account that exists in production.

For local web app work, use `http://localhost:3000` directly.

## 7. Useful Commands

Run these from `web/`:

```bash
npm run dev          # Start dev server
npm run build        # Production build check
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push Prisma schema to database
npm run db:studio    # Open Prisma Studio
```

## Official References

- Supabase with Prisma: https://supabase.com/docs/guides/database/prisma
- Google OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth consent/testing: https://support.google.com/cloud/answer/10311615
- Groq quickstart/API keys: https://console.groq.com/docs/quickstart
