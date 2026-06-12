#!/usr/bin/env node
/**
 * Deletes any user whose email matches the test-isolation pattern:
 *   test-a-<timestamp>@example.com
 *   test-b-<timestamp>@example.com
 *
 * Cascades to all their owned Jobs/ResearchItems/Tasks via the schema FK.
 *
 * Usage:
 *   node scripts/cleanup-test-users.mjs [--dry-run]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'test-' }, AND: { email: { endsWith: '@example.com' } } },
    select: { id: true, email: true },
  })
  if (users.length === 0) {
    console.log('No test users found.')
    return
  }
  console.log(`Found ${users.length} test user(s):`)
  for (const u of users) console.log(`  - ${u.email} (id=${u.id})`)
  if (dryRun) {
    console.log('[dry-run] no changes made.')
    return
  }
  const result = await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  })
  console.log(`Deleted ${result.count} test user(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
