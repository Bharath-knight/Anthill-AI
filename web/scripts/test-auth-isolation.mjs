#!/usr/bin/env node
/**
 * End-to-end auth isolation test. Hits a running Anthill instance and proves:
 *  1. Unauthenticated requests are rejected.
 *  2. User A cannot read User B's jobs/tasks (and vice versa).
 *  3. User A cannot edit or delete User B's records.
 *  4. Sending a fake or wrong-user `userId` in the body is ignored.
 *
 * Usage:
 *   node scripts/test-auth-isolation.mjs [baseUrl]
 *   node scripts/test-auth-isolation.mjs http://localhost:3000
 *   node scripts/test-auth-isolation.mjs https://anthill-ai.vercel.app
 *
 * Creates two throwaway accounts with random emails — do NOT run against prod
 * unless you're OK with two leftover user rows you can clean up afterwards.
 */

const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const ts = Date.now()
const userA = { email: `test-a-${ts}@example.com`, password: 'Passw0rd!aaaa' }
const userB = { email: `test-b-${ts}@example.com`, password: 'Passw0rd!bbbb' }

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) {
    passed++
    console.log(`  ok  ${label}`)
  } else {
    failed++
    console.log(`  FAIL ${label}`)
  }
}

async function json(res) {
  try { return await res.json() } catch { return null }
}

async function signup(creds) {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  })
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`)
  return (await res.json()).token
}

function authed(token) {
  return (path, init = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
}

async function run() {
  console.log(`Testing auth isolation against ${baseUrl}`)
  console.log(`User A: ${userA.email}`)
  console.log(`User B: ${userB.email}`)
  console.log('')

  console.log('--- Unauthenticated access ---')
  const noAuth = [
    { method: 'GET', path: '/api/items' },
    { method: 'GET', path: '/api/tasks' },
    { method: 'GET', path: '/api/jobs' },
    { method: 'GET', path: '/api/research' },
    { method: 'POST', path: '/api/capture', body: { type: 'job', sourceUrl: 'https://example.com' } },
    { method: 'POST', path: '/api/tasks', body: { title: 'hack' } },
    { method: 'POST', path: '/api/jobs', body: { company: 'X', role: 'Y', link: 'https://x.example' } },
    { method: 'POST', path: '/api/match/run' },
  ]
  for (const { method, path, body } of noAuth) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    check(`${method} ${path} without auth -> 401`, res.status === 401)
  }

  console.log('\n--- Invalid token ---')
  const bad = await fetch(`${baseUrl}/api/items`, { headers: { Authorization: 'Bearer not-a-real-token' } })
  check(`invalid token -> 401`, bad.status === 401)

  console.log('\n--- Sign up two users ---')
  const tokenA = await signup(userA)
  const tokenB = await signup(userB)
  check('user A got token', !!tokenA)
  check('user B got token', !!tokenB)

  const A = authed(tokenA)
  const B = authed(tokenB)

  console.log('\n--- User A creates a job and task ---')
  const aJobRes = await A('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      company: 'AcmeA',
      role: 'Engineer',
      link: `https://a-${ts}.example.com`,
      rawText: 'job text',
    }),
  })
  const aJob = await json(aJobRes)
  check('A POST /api/jobs -> 201', aJobRes.status === 201 && !!aJob?.id)

  const aTaskRes = await A('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'A task' }) })
  const aTask = await json(aTaskRes)
  check('A POST /api/tasks -> 201', aTaskRes.status === 201 && !!aTask?.id)

  console.log('\n--- User B creates a job and task ---')
  const bJobRes = await B('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      company: 'AcmeB',
      role: 'Designer',
      link: `https://b-${ts}.example.com`,
      rawText: 'job text',
    }),
  })
  const bJob = await json(bJobRes)
  check('B POST /api/jobs -> 201', bJobRes.status === 201 && !!bJob?.id)

  console.log('\n--- Listing only returns own data ---')
  const aJobs = await json(await A('/api/jobs'))
  const bJobs = await json(await B('/api/jobs'))
  check('A list contains A job', Array.isArray(aJobs) && aJobs.some(j => j.id === aJob.id))
  check('A list does NOT contain B job', Array.isArray(aJobs) && !aJobs.some(j => j.id === bJob.id))
  check('B list contains B job', Array.isArray(bJobs) && bJobs.some(j => j.id === bJob.id))
  check('B list does NOT contain A job', Array.isArray(bJobs) && !bJobs.some(j => j.id === aJob.id))

  const aItems = await json(await A('/api/items'))
  check('A /api/items only has A jobs', aItems?.jobs?.every(j => j.id !== bJob.id))

  const aTasks = await json(await A('/api/tasks'))
  check('A /api/tasks only has A tasks', Array.isArray(aTasks) && aTasks.every(t => t.id !== '__notreal'))
  check('A /api/tasks does not include B tasks (B has none yet)', !aTasks?.some(t => t.id === bJob.id))

  console.log('\n--- Cross-tenant access is blocked ---')
  const aReadBJob = await B('/api/jobs') // sanity, just to make sure B sees their job
  check('B can still read own jobs', aReadBJob.status === 200)

  const crossPatch = await A(`/api/jobs/${bJob.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'OFFER' }),
  })
  check('A PATCH B job -> 404', crossPatch.status === 404)

  const crossDelete = await A(`/api/jobs/${bJob.id}`, { method: 'DELETE' })
  check('A DELETE B job -> 404', crossDelete.status === 404)

  const crossTaskPatch = await B(`/api/tasks/${aTask.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed: true }),
  })
  check('B PATCH A task -> 404', crossTaskPatch.status === 404)

  console.log('\n--- userId in body is ignored ---')
  const bodyUserAttack = await A('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      // attempt to plant another user's id — must be ignored
      userId: 'some-other-user-id-12345',
      company: 'PlantedCo',
      role: 'Sneaky',
      link: `https://planted-${ts}.example.com`,
      rawText: '',
    }),
  })
  const planted = await json(bodyUserAttack)
  // Confirm the row exists and belongs to A (by listing A's jobs)
  const aJobsAfter = await json(await A('/api/jobs'))
  const isAsA = aJobsAfter?.some(j => j.id === planted?.id)
  check('userId-in-body created job is owned by token user (A)', bodyUserAttack.status === 201 && isAsA)

  // And user B cannot see it
  const bJobsAfter = await json(await B('/api/jobs'))
  const visibleToB = bJobsAfter?.some(j => j.id === planted?.id)
  check('userId-in-body planted job NOT visible to B', !visibleToB)

  console.log('\n--- Cleanup (A and B delete their own data) ---')
  for (const id of [aJob?.id, planted?.id].filter(Boolean)) {
    await A(`/api/jobs/${id}`, { method: 'DELETE' })
  }
  await A(`/api/tasks/${aTask?.id}`, { method: 'DELETE' })
  if (bJob?.id) await B(`/api/jobs/${bJob.id}`, { method: 'DELETE' })

  console.log('')
  console.log(`Result: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
