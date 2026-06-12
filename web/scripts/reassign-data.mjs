#!/usr/bin/env node
/**
 * Reassigns Jobs, ResearchItems, and Tasks from a source user (by id) to a target
 * user (by email). Idempotent: safe to re-run. Will only run when the target user
 * exists — does NOT create the user or set any password.
 *
 * Usage:
 *   node scripts/reassign-data.mjs --from <fromUserId> --to-email <targetEmail> [--delete-source]
 *
 * Example:
 *   node scripts/reassign-data.mjs --from dev-user-1 --to-email sk5470@columbia.edu
 *
 * Flags:
 *   --from <id>          Source user id (the one currently owning the orphan data)
 *   --to-email <email>   Target user email (the user must have signed up already)
 *   --delete-source      After moving data, delete the source User row. Off by default.
 *   --dry-run            Show what would change, do nothing.
 */
import { readFileSync, existsSync } from 'node:fs'

// Load env BEFORE importing Prisma so Prisma's auto-loader of .env does not win.
// .env.production.local from `vercel env pull` overrides whatever is in .env.
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

const envFileIdx = process.argv.indexOf('--env-file')
const envFile = envFileIdx !== -1 ? process.argv[envFileIdx + 1] : '.env.production.local'
const loaded = loadEnvFile(envFile)

if (!process.env.DATABASE_URL) {
  console.error(`DATABASE_URL not set. ${loaded ? `Loaded "${envFile}" but it had no DATABASE_URL.` : `Could not find "${envFile}".`} Run \`vercel env pull .env.production.local --environment=production --yes\` first.`)
  process.exit(2)
}

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return true
  return next
}

async function main() {
  const fromUserId = arg('from')
  const toEmail = arg('to-email')
  const deleteSource = !!arg('delete-source')
  const dryRun = !!arg('dry-run')

  if (!fromUserId || !toEmail || fromUserId === true || toEmail === true) {
    console.error('Usage: node scripts/reassign-data.mjs --from <fromUserId> --to-email <targetEmail> [--delete-source] [--dry-run]')
    process.exit(2)
  }

  const target = await prisma.user.findUnique({ where: { email: toEmail } })
  if (!target) {
    console.error(`Target user with email "${toEmail}" not found.`)
    console.error('They must sign up at /signup first. This script is safe to re-run after they sign up.')
    process.exit(1)
  }
  console.log(`Target user: ${target.email} (id=${target.id})`)

  const source = await prisma.user.findUnique({ where: { id: fromUserId } }).catch(() => null)
  if (!source) {
    console.log(`Source user id "${fromUserId}" does not exist in users table.`)
    console.log('Looking for orphan records assigned to that id anyway...')
  } else {
    console.log(`Source user: ${source.email ?? '(no email)'} (id=${source.id})`)
  }

  if (source && source.id === target.id) {
    console.error('Source and target are the same user. Nothing to do.')
    process.exit(0)
  }

  const [jobCount, researchCount, taskCount] = await Promise.all([
    prisma.job.count({ where: { userId: fromUserId } }),
    prisma.researchItem.count({ where: { userId: fromUserId } }),
    prisma.task.count({ where: { userId: fromUserId } }),
  ])
  console.log(`Records under source userId="${fromUserId}":`)
  console.log(`  Jobs:     ${jobCount}`)
  console.log(`  Research: ${researchCount}`)
  console.log(`  Tasks:    ${taskCount}`)

  if (jobCount + researchCount + taskCount === 0) {
    console.log('Nothing to migrate.')
    if (deleteSource && source) {
      if (dryRun) {
        console.log(`[dry-run] would delete source user row ${source.id}`)
      } else {
        await prisma.user.delete({ where: { id: source.id } })
        console.log(`Deleted source user row ${source.id}.`)
      }
    }
    return
  }

  // Check for Job link conflicts on the target user.
  const sourceJobLinks = await prisma.job.findMany({
    where: { userId: fromUserId },
    select: { id: true, link: true },
  })
  const conflictLinks = sourceJobLinks.length
    ? await prisma.job.findMany({
        where: {
          userId: target.id,
          link: { in: sourceJobLinks.map((j) => j.link) },
        },
        select: { id: true, link: true },
      })
    : []
  if (conflictLinks.length > 0) {
    console.error(`Target user already owns ${conflictLinks.length} job(s) with the same link as the source. Refusing to overwrite. Sample:`)
    for (const c of conflictLinks.slice(0, 5)) console.error(`  ${c.link}`)
    process.exit(1)
  }

  if (dryRun) {
    console.log('[dry-run] would reassign all source records to target user. No changes made.')
    return
  }

  const result = await prisma.$transaction([
    prisma.job.updateMany({ where: { userId: fromUserId }, data: { userId: target.id } }),
    prisma.researchItem.updateMany({ where: { userId: fromUserId }, data: { userId: target.id } }),
    prisma.task.updateMany({ where: { userId: fromUserId }, data: { userId: target.id } }),
  ])
  const [jobsMoved, researchMoved, tasksMoved] = result.map((r) => r.count)
  console.log(`Moved: ${jobsMoved} jobs, ${researchMoved} research items, ${tasksMoved} tasks → ${target.email}`)

  if (deleteSource && source) {
    const remaining = await Promise.all([
      prisma.job.count({ where: { userId: source.id } }),
      prisma.researchItem.count({ where: { userId: source.id } }),
      prisma.task.count({ where: { userId: source.id } }),
    ])
    if (remaining.some((n) => n > 0)) {
      console.warn('Source user still has records after move; refusing to delete.')
    } else {
      await prisma.user.delete({ where: { id: source.id } })
      console.log(`Deleted source user row ${source.id}.`)
    }
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
