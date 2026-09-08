import type { EntryInput, MoodEntry, Tag, TagInput, User } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || '网络请求失败')
  return payload as T
}

export const api = {
  me: () => request<{ user: User | null }>('/api/me'),
  login: (username: string, password: string) => request<{ user: User }>('/api/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  register: (username: string, password: string, registrationCode: string) => request<{ user: User }>('/api/register', {
    method: 'POST', body: JSON.stringify({ username, password, registrationCode }),
  }),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  entries: () => request<{ entries: MoodEntry[] }>('/api/entries'),
  saveEntry: (date: string, entry: EntryInput) => request<{ entry: MoodEntry }>(`/api/entries/${date}`, {
    method: 'PUT', body: JSON.stringify(entry),
  }),
  deleteEntry: (date: string) => request<{ ok: true }>(`/api/entries/${date}`, { method: 'DELETE' }),
  tags: () => request<{ tags: Tag[] }>('/api/tags'),
  createTag: (tag: TagInput) => request<{ tags: Tag[] }>('/api/tags', {
    method: 'POST', body: JSON.stringify(tag),
  }),
  updateTag: (name: string, tag: TagInput) => request<{ tags: Tag[]; affected: number }>(`/api/tags/${encodeURIComponent(name)}`, {
    method: 'PUT', body: JSON.stringify(tag),
  }),
  deleteTag: (name: string) => request<{ tags: Tag[]; affected: number }>(`/api/tags/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }),
}
