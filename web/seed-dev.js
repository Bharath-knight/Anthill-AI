const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'dev@local.com' },
    update: {},
    create: { id: 'dev-user-1', email: 'dev@local.com', password: 'unused' },
  })
  console.log('Dev user ready:', user.id)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
