# Anthill — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free): https://supabase.com
- A Vercel account (free): https://vercel.com

---

## 1. Database (Supabase)

1. Create a new Supabase project
2. Go to **Settings → Database → Connection string**
3. Copy both URLs:
   - **Transaction mode** (port 6543) → `DATABASE_URL`
   - **Session mode** (port 5432) → `DIRECT_URL`

---

## 2. Web App Setup

```bash
cd anthill/web

# Install dependencies
npm install

# Create your env file
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL, DIRECT_URL, and JWT_SECRET
# Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Push database schema
npm run db:push

# Start dev server
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/jobs`. Sign up first.

---

## 3. Deploy to Vercel

```bash
# From anthill/web
npx vercel

# Set environment variables in Vercel dashboard:
# DATABASE_URL, DIRECT_URL, JWT_SECRET, NEXT_PUBLIC_APP_URL
```

Or connect your GitHub repo to Vercel for automatic deploys.

---

## 4. Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `anthill/extension/` folder
5. The Anthill icon appears in your toolbar

**First-time setup in extension:**
- Enter your API URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`)
- Click **Save URL**
- Sign in with your account

---

## 5. How to Use

### Capture a job posting
1. Go to any job posting (LinkedIn, Greenhouse, company site)
2. Select and copy the job description text
3. Click the Anthill extension icon
4. Click **Capture Clipboard**
5. Review the parsed fields — edit anything the parser got wrong
6. Click **Save**

### Capture research
1. Copy any text you want to save (company info, notes, etc.)
2. Click Anthill → Capture Clipboard
3. Switch to **Research** tab
4. Source URL auto-fills from your active tab
5. Click **Save**

### Create tasks
- Go to the web app → Tasks tab
- Click **+ New Task**
- Optionally link it to a saved job

### Run matching
- Go to web app → Research tab
- Click **Run Matching**
- Research items get matched to tasks by keyword overlap
- Accept or reject each suggested match

---

## API Quick Reference

```bash
# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpass123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpass123"}'

# Get jobs (replace TOKEN)
curl http://localhost:3000/api/jobs \
  -H "Authorization: Bearer TOKEN"

# Run matching
curl -X POST http://localhost:3000/api/match/run \
  -H "Authorization: Bearer TOKEN"
```
