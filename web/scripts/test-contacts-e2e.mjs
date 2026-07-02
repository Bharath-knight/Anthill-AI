// End-to-end test for the Contacts feature + job favicon/cover-letter/experience
// extraction, plus the home→tasks redirect. Run against a server whose database
// has the Contact table and new Job columns (prisma db push first).
//
//   node scripts/test-contacts-e2e.mjs http://localhost:3000
//
// Like test-auth-isolation.mjs, this leaves test-*@example.com user rows behind
// when run against prod — clean up via Supabase Studio.

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let data = null
  try { data = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, headers: res.headers, data }
}

async function signup(tag) {
  const email = `test-${tag}-${Date.now()}@example.com`
  const { status, data } = await api('/api/auth/signup', {
    method: 'POST',
    body: { email, password: 'e2e-Password-1234', name: `E2E ${tag}` },
  })
  if (status !== 201 && status !== 200) throw new Error(`signup failed: ${status} ${JSON.stringify(data)}`)
  return { email, token: data.token }
}

// --- 1. Home redirects to /tasks --------------------------------------------
console.log('\n[1] Homepage')
{
  const res = await fetch(`${BASE}/`, { redirect: 'manual' })
  const loc = res.headers.get('location') || ''
  check('GET / redirects to /tasks', res.status >= 300 && res.status < 400 && loc.includes('/tasks'),
    `status ${res.status}, location ${loc}`)
}

// --- 2. Contacts API ----------------------------------------------------------
console.log('\n[2] Contacts API')
const userA = await signup('contacts-a')
{
  const noAuth = await api('/api/contacts')
  check('GET /api/contacts without token → 401', noAuth.status === 401, `got ${noAuth.status}`)

  const created = await api('/api/contacts', {
    method: 'POST', token: userA.token,
    body: { email: 'Jane.Doe@Example.com', name: '  Jane Doe ', notes: 'Recruiter at Acme' },
  })
  check('POST email contact → 201', created.status === 201, `got ${created.status} ${JSON.stringify(created.data)}`)
  check('email is normalized to lowercase', created.data?.email === 'jane.doe@example.com', `got ${created.data?.email}`)
  check('name is trimmed', created.data?.name === 'Jane Doe', `got ${JSON.stringify(created.data?.name)}`)

  const dup = await api('/api/contacts', {
    method: 'POST', token: userA.token, body: { email: 'JANE.DOE@example.com' },
  })
  check('duplicate email → 409 with existing contact', dup.status === 409 && dup.data?.contact?.id === created.data?.id,
    `got ${dup.status}`)

  const phone = await api('/api/contacts', {
    method: 'POST', token: userA.token, body: { phone: '(617) 555-0142', name: 'Phone Person' },
  })
  check('POST phone contact → 201, normalized', phone.status === 201 && phone.data?.phone === '6175550142',
    `got ${phone.status} phone=${phone.data?.phone}`)

  const dupPhone = await api('/api/contacts', {
    method: 'POST', token: userA.token, body: { phone: '617-555-0142' },
  })
  check('same phone, different formatting → 409', dupPhone.status === 409, `got ${dupPhone.status}`)

  const invalid = await api('/api/contacts', { method: 'POST', token: userA.token, body: { name: 'No Reach' } })
  check('contact without email/phone → 400', invalid.status === 400, `got ${invalid.status}`)

  const badEmail = await api('/api/contacts', { method: 'POST', token: userA.token, body: { email: 'nope' } })
  check('invalid email → 400', badEmail.status === 400, `got ${badEmail.status}`)

  const list = await api('/api/contacts', { token: userA.token })
  check('GET lists both contacts', Array.isArray(list.data) && list.data.length === 2, `got ${list.data?.length}`)

  if (!created.data?.id || !phone.data?.id) {
    check('contact rows exist to run PATCH/DELETE/isolation checks against', false,
      'creation failed above (is the Contact table pushed? run: npx prisma db push)')
  } else {
  const patched = await api(`/api/contacts/${created.data.id}`, {
    method: 'PATCH', token: userA.token, body: { name: 'Jane D.', company: 'Acme' },
  })
  check('PATCH updates name/company', patched.status === 200 && patched.data?.name === 'Jane D.' && patched.data?.company === 'Acme',
    `got ${patched.status}`)

  const stripBoth = await api(`/api/contacts/${created.data.id}`, {
    method: 'PATCH', token: userA.token, body: { email: '', phone: '' },
  })
  check('PATCH removing both email+phone → 400', stripBoth.status === 400, `got ${stripBoth.status}`)

  // Cross-tenant isolation
  const userB = await signup('contacts-b')
  const bList = await api('/api/contacts', { token: userB.token })
  check('user B sees no contacts', Array.isArray(bList.data) && bList.data.length === 0, `got ${bList.data?.length}`)
  const bPatch = await api(`/api/contacts/${created.data.id}`, {
    method: 'PATCH', token: userB.token, body: { name: 'hacked' },
  })
  check("user B can't PATCH user A's contact (404)", bPatch.status === 404, `got ${bPatch.status}`)
  const bDelete = await api(`/api/contacts/${created.data.id}`, { method: 'DELETE', token: userB.token })
  check("user B can't DELETE user A's contact (404)", bDelete.status === 404, `got ${bDelete.status}`)

  const del = await api(`/api/contacts/${phone.data.id}`, { method: 'DELETE', token: userA.token })
  check('user A can DELETE own contact', del.status === 200, `got ${del.status}`)
  }
}

// --- 3. Job capture: favicon + details ----------------------------------------
console.log('\n[3] Job capture (favicon, cover letter, experience)')
{
  // Grab a live single-job URL from a public Greenhouse board so the test does
  // not depend on a hardcoded posting that will eventually 404.
  let jobUrl = null
  try {
    const board = await fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs')
    const jobs = (await board.json())?.jobs
    jobUrl = jobs?.[0]?.absolute_url ?? null
  } catch { /* board unreachable */ }

  if (!jobUrl) {
    check('found a live job posting to capture', false, 'greenhouse board API unreachable')
  } else {
    const t0 = performance.now()
    const cap = await api('/api/capture', { method: 'POST', token: userA.token, body: { sourceUrl: jobUrl } })
    const ms = Math.round(performance.now() - t0)
    check(`capture classified as job (${ms}ms)`, cap.data?.type === 'job', `got type=${cap.data?.type} status=${cap.status}`)
    check('job has a favicon', typeof cap.data?.favicon === 'string' && cap.data.favicon.startsWith('http'),
      `got ${cap.data?.favicon}`)
    check('company extracted', !!cap.data?.company && cap.data.company !== 'Unknown Company', `got ${cap.data?.company}`)
    console.log(`        company=${cap.data?.company} role=${cap.data?.role}`)
    console.log(`        coverLetter=${cap.data?.coverLetter} experience=${cap.data?.experience} (null is OK when the posting doesn't say)`)
  }
}

// --- 4. Research capture (speed + enrichment sanity) ---------------------------
console.log('\n[4] Research capture')
{
  const t0 = performance.now()
  const cap = await api('/api/capture', {
    method: 'POST', token: userA.token,
    body: { sourceUrl: 'https://en.wikipedia.org/wiki/Cosine_similarity' },
  })
  const ms = Math.round(performance.now() - t0)
  check(`capture classified as research (${ms}ms)`, cap.data?.type === 'research', `got type=${cap.data?.type}`)
  check('research favicon present', typeof cap.data?.favicon === 'string' && cap.data.favicon.length > 0, 'missing')
  check('Groq enrichment produced a summary (key valid)', typeof cap.data?.summary === 'string' && cap.data.summary.length > 0,
    'summary null — GROQ_API_KEY missing/invalid?')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
