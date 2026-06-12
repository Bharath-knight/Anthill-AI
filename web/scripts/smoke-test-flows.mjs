#!/usr/bin/env node
/**
 * Smoke test: exercises the API paths every UI button hits.
 * Creates a throwaway test user, runs the scenarios, then cleans up.
 *
 * Usage: node scripts/smoke-test-flows.mjs [baseUrl]
 */

const baseUrl = (process.argv[2] || 'https://anthill-ai.vercel.app').replace(/\/$/, '')
const ts = Date.now()
const user = { email: `smoke-${ts}@example.com`, password: 'Smoketest!1234' }

let passed = 0
let failed = 0
const fails = []
function check(label, cond, extra) {
  if (cond) { passed++; console.log(`  ok  ${label}`) }
  else { failed++; fails.push(label + (extra ? `\n      ${extra}` : '')); console.log(`  FAIL ${label}${extra ? ` (${extra})` : ''}`) }
}
async function json(res) { try { return await res.json() } catch { return null } }

async function run() {
  console.log(`Smoke testing UI flows against ${baseUrl}`)
  console.log(`User: ${user.email}`)
  console.log('')

  // Signup
  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
  if (!signup.ok) { console.error('signup failed:', signup.status, await signup.text()); process.exit(1) }
  const { token } = await signup.json()
  const H = (init = {}) => ({
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })

  console.log('--- Create a job ---')
  const jobRes = await fetch(`${baseUrl}/api/jobs`, H({
    method: 'POST',
    body: JSON.stringify({
      company: 'SmokeCo',
      role: 'Junior Engineer',
      link: `https://smoke-${ts}.example.com`,
      rawText: 'job text',
      location: 'Remote',
    }),
  }))
  const job = await json(jobRes)
  check('POST /api/jobs -> 201', jobRes.status === 201 && !!job?.id)

  console.log('\n--- Edit job (change role via PATCH) ---')
  const editRes = await fetch(`${baseUrl}/api/jobs/${job.id}`, H({
    method: 'PATCH',
    body: JSON.stringify({ role: 'Senior Engineer' }),
  }))
  const edited = await json(editRes)
  check('PATCH /api/jobs/[id] role -> 200 with new role', editRes.status === 200 && edited?.role === 'Senior Engineer')

  console.log('\n--- Save notes (autosave-on-blur path) ---')
  await fetch(`${baseUrl}/api/jobs/${job.id}`, H({
    method: 'PATCH',
    body: JSON.stringify({ notes: 'These are smoke-test notes.' }),
  }))
  // re-fetch via /api/items, since that's what the page reads
  const items = await json(await fetch(`${baseUrl}/api/items`, H()))
  const reloaded = items?.jobs?.find(j => j.id === job.id)
  check('Notes persist on /api/items re-fetch', reloaded?.notes === 'These are smoke-test notes.')

  console.log('\n--- Change status (creates JobEvent for history) ---')
  await fetch(`${baseUrl}/api/jobs/${job.id}`, H({
    method: 'PATCH',
    body: JSON.stringify({ status: 'APPLIED' }),
  }))
  const itemsAfter = await json(await fetch(`${baseUrl}/api/items`, H()))
  const withStatus = itemsAfter?.jobs?.find(j => j.id === job.id)
  check('Status persists -> APPLIED', withStatus?.status === 'APPLIED')
  check('JobEvent recorded for status change', Array.isArray(withStatus?.events) && withStatus.events.length >= 1)
  check('Event has correct from/to', withStatus?.events?.[0]?.fromStatus === 'SAVED' && withStatus?.events?.[0]?.toStatus === 'APPLIED')

  console.log('\n--- Create a task (manual + linked to job) ---')
  const taskRes = await fetch(`${baseUrl}/api/tasks`, H({
    method: 'POST',
    body: JSON.stringify({ title: 'Follow up with SmokeCo', linkedJobId: job.id }),
  }))
  const task = await json(taskRes)
  check('POST /api/tasks -> 201', taskRes.status === 201 && !!task?.id)
  check('Task has linkedJob populated', !!task?.linkedJob && task.linkedJob.id === job.id)

  console.log('\n--- Toggle task complete ---')
  const toggleRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, H({
    method: 'PATCH',
    body: JSON.stringify({ completed: true }),
  }))
  const toggled = await json(toggleRes)
  check('PATCH task completed=true -> 200', toggleRes.status === 200 && toggled?.completed === true)

  console.log('\n--- Run /api/match/run (the "Run matching" button) ---')
  // first capture some research so there is something to match
  const researchRes = await fetch(`${baseUrl}/api/research`, H({
    method: 'POST',
    body: JSON.stringify({ content: 'Article about engineering at SmokeCo and software engineer roles.', sourceUrl: `https://research-${ts}.example.com` }),
  }))
  check('POST /api/research -> 201', researchRes.status === 201)

  const matchRes = await fetch(`${baseUrl}/api/match/run`, H({ method: 'POST' }))
  const matchData = await json(matchRes)
  check('POST /api/match/run -> 200', matchRes.status === 200 && typeof matchData?.matched === 'number')

  console.log('\n--- Delete task ---')
  const delTaskRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, H({ method: 'DELETE' }))
  check('DELETE /api/tasks/[id] -> 200', delTaskRes.status === 200)
  const taskGone = await json(await fetch(`${baseUrl}/api/tasks`, H()))
  check('Task no longer in list', Array.isArray(taskGone) && !taskGone.some(t => t.id === task.id))

  console.log('\n--- Delete job ---')
  const delJobRes = await fetch(`${baseUrl}/api/jobs/${job.id}`, H({ method: 'DELETE' }))
  check('DELETE /api/jobs/[id] -> 200', delJobRes.status === 200)
  const itemsFinal = await json(await fetch(`${baseUrl}/api/items`, H()))
  check('Job no longer in /api/items', !itemsFinal?.jobs?.some(j => j.id === job.id))

  // Cleanup leftover research
  const research = await json(await fetch(`${baseUrl}/api/research`, H()))
  if (Array.isArray(research)) {
    // there's no DELETE /api/research/[id]; we just leave it under the about-to-be-deleted test user
    // Tasks/Research will cascade-delete when we remove the User row via SQL cleanup later.
  }

  console.log('')
  console.log(`Result: ${passed} passed, ${failed} failed`)
  if (failed > 0) { fails.forEach(f => console.log('  •', f)); process.exit(1) }
  console.log(`\nNote: test user "${user.email}" is left in the DB. Run:`)
  console.log(`  DELETE FROM "User" WHERE email LIKE 'smoke-%@example.com';`)
}

run().catch((err) => { console.error('Crashed:', err); process.exit(1) })
