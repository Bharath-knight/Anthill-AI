#!/usr/bin/env node
/**
 * Ensures every Job has at least one linked Task. Idempotent: any job that already
 * has a task is skipped, so this is safe to re-run.
 *
 * Usage (run from web/):
 *   node scripts/backfill-job-tasks.mjs                  # uses .env.local
 *   node scripts/backfill-job-tasks.mjs --dry-run        # show what would change
 *   node scripts/backfill-job-tasks.mjs --env-file .env.production.local
 *
 * NOTE: .env.local points at the shared Supabase database, so this writes to the
 * same data the deployed app reads. It only CREATES tasks (additive); it never
 * deletes or edits existing rows.
 */
import { readFileSync, existsSync } from 'node:fs'

// Load env BEFORE importing Prisma so Prisma's own .env auto-loader doesn't win.
function loadEnvFile(path) {
  if (!existsSync(path)) return false
  const text = readFileSync(path, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
  return true
}

const envIdx = process.argv.indexOf('--env-file')
const envFile = envIdx !== -1 ? process.argv[envIdx + 1] : '.env.local'
const loaded = loadEnvFile(envFile)
if (!process.env.DATABASE_URL) {
  console.error(`DATABASE_URL not set. ${loaded ? `Loaded "${envFile}" but it had no DATABASE_URL.` : `Could not find "${envFile}".`}`)
  process.exit(2)
}

const dryRun = process.argv.includes('--dry-run')
const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({ include: { tasks: { select: { id: true } } } })
  const missing = jobs.filter((j) => j.tasks.length === 0)
  console.log(`${jobs.length} job(s) total; ${missing.length} without a task.`)

  let created = 0
  for (const job of missing) {
    const title = `Review & apply to ${job.role} at ${job.company}`
    if (dryRun) {
      console.log(`[dry-run] would create: "${title}" (job ${job.id})`)
      created++
      continue
    }
    await prisma.task.create({ data: { userId: job.userId, title, linkedJobId: job.id } })
    created++
  }
  console.log(`${dryRun ? '[dry-run] would create' : 'Created'} ${created} task(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
