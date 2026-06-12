#!/usr/bin/env node
/**
 * One-off: delete a user row by email. Cascades to all their owned Jobs/Research/Tasks.
 * Use only when you're certain — there is no confirmation prompt.
 *
 * Usage:
 *   node scripts/delete-user-by-email.mjs <email> [--dry-run]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const email = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!email || email.startsWith('--')) {
  console.error('Usage: node scripts/delete-user-by-email.mjs <email> [--dry-run]')
  process.exit(2)
}

const user = await prisma.user.findUnique({ where: { email } })
if (!user) {
  console.log(`No user with email "${email}". Nothing to do.`)
  await prisma.$disconnect()
  process.exit(0)
}

const [jobs, research, tasks] = await Promise.all([
  prisma.job.count({ where: { userId: user.id } }),
  prisma.researchItem.count({ where: { userId: user.id } }),
  prisma.task.count({ where: { userId: user.id } }),
])
console.log(`User: ${user.email} (id=${user.id})`)
console.log(`Owned: ${jobs} jobs, ${research} research, ${tasks} tasks (all will be deleted by cascade)`)

if (dryRun) {
  console.log('[dry-run] no changes made.')
} else {
  await prisma.user.delete({ where: { id: user.id } })
  console.log('Deleted.')
}
await prisma.$disconnect()
