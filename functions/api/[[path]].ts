import {
  createPassword, createSession, currentUser, deleteSession, expiredSessionCookie,
  findUser, sessionCookie, verifyPassword, verifyRegistrationCode, type Env,
} from '../../worker/auth'

interface EntryBody {
  mood: number
  fatigue: number
  note: string
  tags: string[]
}

interface TagRow {
  name: string
  color: string
  initial: string
  sort_order: number
}

interface EntryRow {
  entry_date: string
  mood: number
  fatigue: number
  note: string
  tags: string
  created_at: string
  updated_at: string
}

const MAX_REQUEST_CHARS = 20_000
const MAX_TAGS_PER_USER = 60
const colorPattern = /^#[0-9a-f]{6}$/i
// 老账号首次读取标签库时的种子，与记录页原先硬编码的建议标签一致
const defaultTags: Array<[string, string]> = [
  ['工作', '#4a7fb5'], ['运动', '#3f9e79'], ['家庭', '#c9784f'], ['朋友', '#b5698f'],
  ['学习', '#7a6bb5'], ['睡眠', '#5b8fa8'], ['生病', '#b55a4a'], ['旅行', '#c2a03f'],
]
const usernamePattern = /^[\p{L}\p{N}_.-]{3,32}$/u
const datePattern = /^\d{4}-\d{2}-\d{2}$/

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')
  return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

function error(message: string, status: number) {
  return json({ error: message }, status)
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  return !origin || origin === new URL(request.url).origin
}

async function requestBody(request: Request) {
  const text = await request.text()
  if (text.length > MAX_REQUEST_CHARS) throw new Error('请求数据过大')
  return JSON.parse(text) as Record<string, unknown>
}

function validDate(value: string) {
  if (!datePattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function parseEntry(body: Record<string, unknown>): EntryBody | string {
  const mood = Number(body.mood)
  const fatigue = Number(body.fatigue)
  const note = String(body.note ?? '').trim()
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return '请选择 1 至 5 级心情'
  if (!Number.isInteger(fatigue) || fatigue < 1 || fatigue > 5) return '请选择有效的剩余电量'
  if (note.length > 2_000) return '记录不能超过 2000 个字符'
  if (!Array.isArray(body.tags)) return '标签格式不正确'
  const tags = [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))]
  if (tags.length > 8 || tags.some((tag) => tag.length > 20)) return '最多选择 8 个标签，每个标签不能超过 20 个字符'
  return { mood, fatigue, note, tags }
}

function attemptKey(request: Request, action: string) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  return `${action}:${ip}`
}

async function canAttempt(env: Env, key: string, limit: number) {
  const row = await env.DB.prepare(
    'SELECT attempt_count, window_started FROM auth_attempts WHERE attempt_key = ?',
  ).bind(key).first<{ attempt_count: number; window_started: string }>()
  if (!row) return true
  if (Date.now() - new Date(row.window_started).getTime() >= 15 * 60_000) {
    await env.DB.prepare('DELETE FROM auth_attempts WHERE attempt_key = ?').bind(key).run()
    return true
  }
  return row.attempt_count < limit
}

async function recordFailure(env: Env, key: string) {
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO auth_attempts (attempt_key, attempt_count, window_started) VALUES (?, 1, ?)
    ON CONFLICT(attempt_key) DO UPDATE SET attempt_count = auth_attempts.attempt_count + 1
  `).bind(key, now).run()
}

async function clearAttempts(env: Env, key: string) {
  await env.DB.prepare('DELETE FROM auth_attempts WHERE attempt_key = ?').bind(key).run()
}

async function register(request: Request, env: Env) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  if (!env.REGISTRATION_CODE) return error('服务端尚未设置注册码', 503)
  const key = attemptKey(request, 'register')
  if (!(await canAttempt(env, key, 5))) return error('尝试次数过多，请 15 分钟后再试', 429)
  const body = await requestBody(request)
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const registrationCode = String(body.registrationCode ?? '')
  if (!usernamePattern.test(username)) return error('用户名需为 3 至 32 个字符，可使用中文、字母、数字、点、横线或下划线', 400)
  if (password.length < 8 || password.length > 128) return error('密码长度需为 8 至 128 个字符', 400)
  if (!verifyRegistrationCode(registrationCode, env.REGISTRATION_CODE)) {
    await recordFailure(env, key)
    return error('注册码不正确', 403)
  }

  const userId = crypto.randomUUID()
  const passwordValue = await createPassword(password)
  try {
    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(userId, username, passwordValue.hash, passwordValue.salt, new Date().toISOString()).run()
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('UNIQUE')) return error('该用户名已经存在', 409)
    throw cause
  }
  await clearAttempts(env, key)
  const session = await createSession(env, userId)
  return json({ user: { id: userId, username } }, 201, { 'Set-Cookie': sessionCookie(session.token, session.maxAge) })
}

async function login(request: Request, env: Env) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const key = attemptKey(request, 'login')
  if (!(await canAttempt(env, key, 10))) return error('登录尝试过多，请 15 分钟后再试', 429)
  const body = await requestBody(request)
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const user = await findUser(env, username)
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    await recordFailure(env, key)
    return error('用户名或密码错误', 401)
  }
  await clearAttempts(env, key)
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  const session = await createSession(env, user.id)
  return json({ user: { id: user.id, username: user.username } }, 200, { 'Set-Cookie': sessionCookie(session.token, session.maxAge) })
}

async function logout(request: Request, env: Env) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  await deleteSession(request, env)
  return json({ ok: true }, 200, { 'Set-Cookie': expiredSessionCookie() })
}

function entryFromRow(row: EntryRow) {
  let tags: string[] = []
  try {
    const parsed = JSON.parse(row.tags)
    if (Array.isArray(parsed)) tags = parsed.map(String)
  } catch {
    tags = []
  }
  return {
    date: row.entry_date,
    mood: row.mood,
    fatigue: row.fatigue,
    note: row.note,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function tagFromRow(row: TagRow) {
  return { name: row.name, color: row.color, initial: row.initial, sortOrder: row.sort_order }
}

async function readTags(env: Env, userId: string) {
  const result = await env.DB.prepare(
    'SELECT name, color, initial, sort_order FROM user_tags WHERE user_id = ? ORDER BY sort_order, name',
  ).bind(userId).all<TagRow>()
  return result.results
}

function parseTagList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

// 老账号在建表前就已有记录，首次读取时用默认标签加历史记录中出现过的标签种子化，
// 否则历史记录里的标签在标签库中找不到定义，会变成无法维护的孤儿。
async function seedTags(env: Env, userId: string) {
  const rows = await env.DB.prepare('SELECT tags FROM mood_entries WHERE user_id = ?')
    .bind(userId).all<{ tags: string }>()
  const seeded = new Map<string, string>(defaultTags)
  for (const row of rows.results) {
    for (const tag of parseTagList(row.tags)) {
      const name = tag.trim()
      if (name && !seeded.has(name)) seeded.set(name, '#7a7a72')
    }
  }
  const now = new Date().toISOString()
  const statement = env.DB.prepare(
    'INSERT OR IGNORE INTO user_tags (user_id, name, color, initial, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const batch = [...seeded.entries()].slice(0, MAX_TAGS_PER_USER).map(([name, color], index) =>
    statement.bind(userId, name, color, [...name][0] ?? '·', index, now))
  if (batch.length) await env.DB.batch(batch)
}

async function getTags(request: Request, env: Env) {
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  let rows = await readTags(env, user.id)
  if (!rows.length) {
    await seedTags(env, user.id)
    rows = await readTags(env, user.id)
  }
  return json({ tags: rows.map(tagFromRow) })
}

function parseTagInput(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim()
  const color = String(body.color ?? '').trim()
  const initial = [...String(body.initial ?? '').trim()].slice(0, 2).join('')
  if (!name || name.length > 20) return '标签名需为 1 至 20 个字符'
  if (!colorPattern.test(color)) return '颜色格式不正确'
  if (!initial) return '请填写首字'
  return { name, color: color.toLowerCase(), initial }
}

// 改写历史记录中的标签名；rename 为 null 时表示删除该标签。
async function rewriteEntryTags(env: Env, userId: string, from: string, to: string | null) {
  const rows = await env.DB.prepare('SELECT entry_date, tags FROM mood_entries WHERE user_id = ?')
    .bind(userId).all<{ entry_date: string; tags: string }>()
  const statement = env.DB.prepare('UPDATE mood_entries SET tags = ? WHERE user_id = ? AND entry_date = ?')
  const batch = []
  for (const row of rows.results) {
    const tags = parseTagList(row.tags)
    if (!tags.includes(from)) continue
    const next = to === null
      ? tags.filter((tag) => tag !== from)
      : [...new Set(tags.map((tag) => (tag === from ? to : tag)))]
    batch.push(statement.bind(JSON.stringify(next), userId, row.entry_date))
  }
  if (batch.length) await env.DB.batch(batch)
  return batch.length
}

async function createTag(request: Request, env: Env) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  const parsed = parseTagInput(await requestBody(request))
  if (typeof parsed === 'string') return error(parsed, 400)
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM user_tags WHERE user_id = ?')
    .bind(user.id).first<{ total: number }>()
  const total = count?.total ?? 0
  if (total >= MAX_TAGS_PER_USER) return error(`最多只能创建 ${MAX_TAGS_PER_USER} 个标签`, 400)
  const existing = await env.DB.prepare('SELECT name FROM user_tags WHERE user_id = ? AND name = ?')
    .bind(user.id, parsed.name).first()
  if (existing) return error('这个标签已经存在了', 409)
  await env.DB.prepare(
    'INSERT INTO user_tags (user_id, name, color, initial, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(user.id, parsed.name, parsed.color, parsed.initial, total, new Date().toISOString()).run()
  return json({ tags: (await readTags(env, user.id)).map(tagFromRow) }, 201)
}

async function updateTag(request: Request, env: Env, target: string) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  const parsed = parseTagInput(await requestBody(request))
  if (typeof parsed === 'string') return error(parsed, 400)
  const current = await env.DB.prepare('SELECT sort_order FROM user_tags WHERE user_id = ? AND name = ?')
    .bind(user.id, target).first<{ sort_order: number }>()
  if (!current) return error('标签不存在', 404)
  if (parsed.name !== target) {
    const clash = await env.DB.prepare('SELECT name FROM user_tags WHERE user_id = ? AND name = ?')
      .bind(user.id, parsed.name).first()
    if (clash) return error('已经有同名标签了', 409)
  }
  // 主键含 name，改名只能删旧行再插新行
  await env.DB.batch([
    env.DB.prepare('DELETE FROM user_tags WHERE user_id = ? AND name = ?').bind(user.id, target),
    env.DB.prepare(
      'INSERT INTO user_tags (user_id, name, color, initial, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(user.id, parsed.name, parsed.color, parsed.initial, current.sort_order, new Date().toISOString()),
  ])
  const affected = parsed.name === target ? 0 : await rewriteEntryTags(env, user.id, target, parsed.name)
  return json({ tags: (await readTags(env, user.id)).map(tagFromRow), affected })
}

async function deleteTag(request: Request, env: Env, target: string) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  const affected = await rewriteEntryTags(env, user.id, target, null)
  await env.DB.prepare('DELETE FROM user_tags WHERE user_id = ? AND name = ?').bind(user.id, target).run()
  return json({ tags: (await readTags(env, user.id)).map(tagFromRow), affected })
}

async function getEntries(request: Request, env: Env) {
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  const result = await env.DB.prepare(`
    SELECT entry_date, mood, fatigue, note, tags, created_at, updated_at
    FROM mood_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT 3660
  `).bind(user.id).all<EntryRow>()
  return json({ entries: result.results.map(entryFromRow) })
}

async function putEntry(request: Request, env: Env, date: string) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  if (!validDate(date)) return error('日期格式不正确', 400)
  const parsed = parseEntry(await requestBody(request))
  if (typeof parsed === 'string') return error(parsed, 400)
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO mood_entries (user_id, entry_date, mood, fatigue, note, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, entry_date) DO UPDATE SET
      mood = excluded.mood,
      fatigue = excluded.fatigue,
      note = excluded.note,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `).bind(user.id, date, parsed.mood, parsed.fatigue, parsed.note, JSON.stringify(parsed.tags), now, now).run()
  const row = await env.DB.prepare(`
    SELECT entry_date, mood, fatigue, note, tags, created_at, updated_at
    FROM mood_entries WHERE user_id = ? AND entry_date = ?
  `).bind(user.id, date).first<EntryRow>()
  return json({ entry: row ? entryFromRow(row) : null })
}

async function deleteEntry(request: Request, env: Env, date: string) {
  if (!isSameOrigin(request)) return error('请求来源无效', 403)
  const user = await currentUser(request, env)
  if (!user) return error('请先登录', 401)
  if (!validDate(date)) return error('日期格式不正确', 400)
  await env.DB.prepare('DELETE FROM mood_entries WHERE user_id = ? AND entry_date = ?').bind(user.id, date).run()
  return json({ ok: true })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/register' && request.method === 'POST') return await register(request, env)
    if (pathname === '/api/login' && request.method === 'POST') return await login(request, env)
    if (pathname === '/api/logout' && request.method === 'POST') return await logout(request, env)
    if (pathname === '/api/me' && request.method === 'GET') return json({ user: await currentUser(request, env) })
    if (pathname === '/api/entries' && request.method === 'GET') return await getEntries(request, env)
    if (pathname === '/api/tags' && request.method === 'GET') return await getTags(request, env)
    if (pathname === '/api/tags' && request.method === 'POST') return await createTag(request, env)
    const tagMatch = /^\/api\/tags\/(.+)$/.exec(pathname)
    if (tagMatch && request.method === 'PUT') return await updateTag(request, env, decodeURIComponent(tagMatch[1]))
    if (tagMatch && request.method === 'DELETE') return await deleteTag(request, env, decodeURIComponent(tagMatch[1]))
    const entryMatch = /^\/api\/entries\/(\d{4}-\d{2}-\d{2})$/.exec(pathname)
    if (entryMatch && request.method === 'PUT') return await putEntry(request, env, entryMatch[1])
    if (entryMatch && request.method === 'DELETE') return await deleteEntry(request, env, entryMatch[1])
    return error('接口不存在', 404)
  } catch (cause) {
    if (cause instanceof SyntaxError) return error('请求内容不是有效 JSON', 400)
    if (cause instanceof Error && cause.message === '请求数据过大') return error(cause.message, 413)
    console.error(cause)
    return error('服务器处理失败', 500)
  }
}
