export interface Env {
  DB: D1Database
  REGISTRATION_CODE: string
}

export interface AuthUser {
  id: string
  username: string
}

interface UserRow extends AuthUser {
  password_hash: string
  password_salt: string
}

const COOKIE_NAME = 'daystate_session'
const SESSION_DAYS = 30
const PASSWORD_ITERATIONS = 100_000
const encoder = new TextEncoder()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length))
}

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: PASSWORD_ITERATIONS,
  }, key, 256)
  return bytesToBase64(new Uint8Array(bits))
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let mismatch = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  return mismatch === 0
}

export async function createPassword(password: string) {
  const salt = randomBytes(16)
  return { salt: bytesToBase64(salt), hash: await derivePassword(password, salt) }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  return constantTimeEqual(await derivePassword(password, base64ToBytes(salt)), expectedHash)
}

export function verifyRegistrationCode(actual: string, expected: string | undefined) {
  return Boolean(expected) && constantTimeEqual(actual, expected ?? '')
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return bytesToHex(new Uint8Array(digest))
}

function newToken() {
  return bytesToBase64(randomBytes(32)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function cookieValue(request: Request) {
  const cookies = request.headers.get('Cookie') ?? ''
  for (const part of cookies.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === COOKIE_NAME) return value.join('=')
  }
  return null
}

export async function createSession(env: Env, userId: string) {
  const token = newToken()
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000)
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).bind(await hashToken(token), userId, expires.toISOString(), now.toISOString()).run()
  return { token, maxAge: SESSION_DAYS * 86_400 }
}

export async function deleteSession(request: Request, env: Env) {
  const token = cookieValue(request)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run()
}

export async function currentUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = cookieValue(request)
  if (!token) return null
  return await env.DB.prepare(`
    SELECT users.id, users.username
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).bind(await hashToken(token), new Date().toISOString()).first<AuthUser>() ?? null
}

export function findUser(env: Env, username: string) {
  return env.DB.prepare(
    'SELECT id, username, password_hash, password_salt FROM users WHERE username = ? COLLATE NOCASE',
  ).bind(username).first<UserRow>()
}

export function sessionCookie(token: string, maxAge: number) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
}
