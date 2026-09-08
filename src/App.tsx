import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Cloud,
  Download, LoaderCircle, LogOut, NotebookPen, Pencil, Plus, RefreshCw, Settings,
  Sparkles, Tags, Trash2, X,
} from 'lucide-react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from './api'
import type { EntryInput, MoodEntry, Page, Score, Tag, TagInput, User } from './types'

const moodOptions: Array<{ value: Score; emoji: string; label: string }> = [
  { value: 1, emoji: '😞', label: '低落' },
  { value: 2, emoji: '😕', label: '有点糟' },
  { value: 3, emoji: '😐', label: '平静' },
  { value: 4, emoji: '🙂', label: '不错' },
  { value: 5, emoji: '😄', label: '很好' },
]

const batteryOptions: Array<{ value: Score; percent: number; label: string }> = [
  { value: 5, percent: 20, label: '所剩无几' },
  { value: 4, percent: 40, label: '电量不足' },
  { value: 3, percent: 60, label: '还能撑住' },
  { value: 2, percent: 80, label: '电量充足' },
  { value: 1, percent: 100, label: '满电状态' },
]

// 设置页新建标签时可选的颜色，与后端种子标签同源
const tagPalette = [
  '#4a7fb5', '#3f9e79', '#c9784f', '#b5698f', '#7a6bb5', '#5b8fa8',
  '#b55a4a', '#c2a03f', '#5f8f5a', '#a86ba8', '#4f8f8f', '#7a7a72',
]

// 历史记录里出现、但标签库中已无定义的标签的兜底样式
function fallbackTag(name: string): Tag {
  return { name, color: '#a8a59d', initial: [...name][0] ?? '·', sortOrder: 9_999 }
}

function tagLookup(tags: Tag[]) {
  const map = new Map(tags.map((tag) => [tag.name, tag]))
  return (name: string) => map.get(name) ?? fallbackTag(name)
}

function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFrom(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(value: string, days: number) {
  const date = dateFrom(value)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function prettyDate(value: string) {
  const today = localDate()
  if (value === today) return '今天'
  if (value === addDays(today, -1)) return '昨天'
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(dateFrom(value))
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(dateFrom(value))
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date)
}

function average(values: number[]) {
  if (!values.length) return '—'
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
}

function batteryPercent(fatigue: number) {
  return (6 - fatigue) * 20
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="brand-mark">日</div>
      <LoaderCircle className="spin" size={22} />
      <span>正在连接日况…</span>
    </div>
  )
}

function LoginView({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password, registrationCode)
      onAuthenticated(result.user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand-lockup">
          <div className="brand-mark large">日</div>
          <div><strong>日况</strong><span>Daystate</span></div>
        </div>
        <div className="auth-copy">
          <p className="eyebrow"><Sparkles size={16} /> 每天 30 秒</p>
          <h1>记下今天，<br />读懂自己。</h1>
          <p>心情、电量与生活片段，安全保存在云端，在每一台设备上陪着你。</p>
        </div>
        <div className="privacy-note"><Cloud size={18} /><span>数据按账号隔离，并通过加密会话访问</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>创建账号</button>
          </div>
          <form onSubmit={submit}>
            <div className="form-heading">
              <h2>{mode === 'login' ? '欢迎回来' : '开始记录'}</h2>
              <p>{mode === 'login' ? '登录后继续查看你的日况' : '创建一个仅属于你的私人空间'}</p>
            </div>
            <label className="field-label">用户名
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="3 至 32 个字符" required />
            </label>
            <label className="field-label">密码
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 个字符" minLength={8} required />
            </label>
            {mode === 'register' && (
              <label className="field-label">注册码
                <input type="password" value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value)} autoComplete="off" placeholder="输入项目注册码" required />
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button full" type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="spin" size={18} />}
              {mode === 'login' ? '登录日况' : '创建并进入'}
            </button>
          </form>
        </div>
        <p className="auth-footnote">日况不会公开你的记录，也不会将日记用于广告。</p>
      </section>
    </main>
  )
}

function DateStepper({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const today = localDate()
  const atToday = date >= today
  return (
    <div className="date-stepper">
      <button type="button" className="step-arrow" onClick={() => onDateChange(addDays(date, -1))} aria-label="前一天">
        <ChevronLeft size={18} />
      </button>
      <label className="step-face">
        <CalendarDays size={16} aria-hidden="true" />
        <span>{date === today ? '今天' : formatDayLabel(date)}</span>
        <input type="date" max={today} value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value) }} aria-label="选择记录日期" />
      </label>
      <button type="button" className="step-arrow" onClick={() => onDateChange(addDays(date, 1))} disabled={atToday} aria-label="后一天">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function ScorePicker({ kind, value, onChange }: { kind: 'mood' | 'battery'; value: Score; onChange: (value: Score) => void }) {
  if (kind === 'battery') {
    return (
      <div className="score-picker battery" role="radiogroup" aria-label="剩余电量">
        {batteryOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${value === option.value ? 'selected ' : ''}battery-${option.percent}`}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={value === option.value}
            aria-label={`${option.percent}% ${option.label}`}
          >
            <span className="battery-gauge"><i style={{ width: `${option.percent}%` }} /></span>
            <strong>{option.percent}%</strong>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="score-picker mood" role="radiogroup" aria-label="今天的心情">
      {moodOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'selected' : ''}
          onClick={() => onChange(option.value)}
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
        >
          <span className="score-emoji">{option.emoji}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function RecordView({
  date, entry, tagLibrary, onDateChange, onSave, onDelete, onManageTags,
}: {
  date: string
  entry?: MoodEntry
  tagLibrary: Tag[]
  onDateChange: (date: string) => void
  onSave: (input: EntryInput) => Promise<void>
  onDelete: () => Promise<void>
  onManageTags: () => void
}) {
  const [mood, setMood] = useState<Score>(3)
  const [fatigue, setFatigue] = useState<Score>(3)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setMood(entry?.mood ?? 3)
    setFatigue(entry?.fatigue ?? 3)
    setNote(entry?.note ?? '')
    setTags(entry?.tags ?? [])
    setMessage('')
  }, [date])

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 8 ? [...current, tag] : current)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await onSave({ mood, fatigue, note, tags })
      setMessage('已保存到云端')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!entry || !window.confirm(`确定删除 ${prettyDate(date)} 的记录吗？`)) return
    setDeleting(true)
    setMessage('')
    try {
      await onDelete()
      setMessage('记录已删除')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page record-page">
      <header className="page-header record-header">
        <div>
          <p className="eyebrow"><NotebookPen size={16} /> 每日记录</p>
          <h1>{prettyDate(date)}，感觉怎么样？</h1>
          <p>不用写得完整，真实就很好。</p>
        </div>
        <DateStepper date={date} onDateChange={onDateChange} />
      </header>

      <form className="record-form" onSubmit={submit}>
        <section className="form-section">
          <div className="section-heading"><span className="section-number">01</span><div><h2>今天的心情</h2><p>选择最接近此刻的感受</p></div></div>
          <ScorePicker kind="mood" value={mood} onChange={setMood} />
        </section>

        <section className="form-section">
          <div className="section-heading"><span className="section-number">02</span><div><h2>今天还剩多少电</h2><p>凭感觉估个大概就好，不用太精确</p></div></div>
          <ScorePicker kind="battery" value={fatigue} onChange={setFatigue} />
        </section>

        <section className="form-section">
          <div className="section-heading"><span className="section-number">03</span><div><h2>今天发生了什么</h2><p>可选，写下一句话也很好</p></div></div>
          <textarea className="note-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="今天见了谁、做了什么、心里在想什么……" />
          <div className="character-count">{note.length} / 2000</div>
        </section>

        <section className="form-section compact">
          <div className="section-heading"><span className="section-number">04</span><div><h2>加几个标签</h2><p>以后更容易发现状态变化的原因</p></div></div>
          <div className="tag-list">
            {tagLibrary.map((tag) => {
              const picked = tags.includes(tag.name)
              return (
                <button
                  type="button"
                  key={tag.name}
                  className={picked ? 'tag selected' : 'tag'}
                  onClick={() => toggleTag(tag.name)}
                  style={picked ? { borderColor: tag.color, background: `${tag.color}1f`, color: tag.color } : undefined}
                >
                  {picked ? <Check size={14} /> : <i className="tag-dot" style={{ background: tag.color }} />}
                  {tag.name}
                </button>
              )
            })}
            {/* 标签库里已删除、但这条记录仍在使用的标签 */}
            {tags.filter((name) => !tagLibrary.some((tag) => tag.name === name)).map((name) => (
              <button type="button" key={name} className="tag selected orphan" onClick={() => toggleTag(name)}><X size={14} />{name}</button>
            ))}
          </div>
          <span className="tag-feedback">
            最多选 8 个，已选 {tags.length} 个。要新增或修改标签，去
            <button type="button" className="link-button" onClick={onManageTags}>设置 · 标签管理</button>
          </span>
        </section>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <Cloud size={18} />}
            {entry ? '更新这一天' : '保存这一天'}
          </button>
          {entry && <button className="danger-button" type="button" onClick={remove} disabled={deleting}><Trash2 size={17} />删除记录</button>}
          {message && <span className={message.includes('失败') || message.includes('错误') ? 'action-message error' : 'action-message'}>{message}</span>}
        </div>
      </form>
    </div>
  )
}

function CalendarView({ entries, tagLibrary, onSelect }: { entries: MoodEntry[]; tagLibrary: Tag[]; onSelect: (date: string) => void }) {
  const lookupTag = useMemo(() => tagLookup(tagLibrary), [tagLibrary])
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries])
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [month])
  const monthEntries = entries.filter((entry) => {
    const date = dateFrom(entry.date)
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
  })

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow"><CalendarDays size={16} /> 状态日历</p><h1>时间留下的颜色</h1><p>回头看，每一种状态都有它的位置。</p></div>
      </header>
      <section className="calendar-card">
        <div className="calendar-toolbar">
          <button className="icon-button" onClick={() => moveMonth(-1)} aria-label="上个月"><ChevronLeft /></button>
          <div><h2>{formatMonth(month)}</h2><p>本月记录 {monthEntries.length} 天</p></div>
          <button className="icon-button" onClick={() => moveMonth(1)} aria-label="下个月"><ChevronRight /></button>
        </div>
        <div className="calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((cell) => {
            const date = localDate(cell)
            const entry = entryMap.get(date)
            const currentMonth = cell.getMonth() === month.getMonth()
            const future = date > localDate()
            return (
              <button key={date} disabled={future} className={`calendar-day ${currentMonth ? '' : 'outside'} ${date === localDate() ? 'today' : ''} ${entry ? `has-entry mood-${entry.mood}` : ''}`} onClick={() => onSelect(date)}>
                <span className="day-number">{cell.getDate()}</span>
                {entry && (
                  <>
                    <span className="day-emoji">{moodOptions[entry.mood - 1].emoji}</span>
                    {entry.tags.length > 0 && (
                      <span className="day-tags">
                        {entry.tags.slice(0, 3).map((name) => {
                          const tag = lookupTag(name)
                          return (
                            <i key={name} className="day-tag" style={{ background: tag.color }} title={tag.name}>
                              {/* 桌面显示全名，窄屏由 CSS 切换成首字 */}
                              <b className="tag-full">{tag.name}</b>
                              <b className="tag-initial">{tag.initial}</b>
                            </i>
                          )
                        })}
                        {entry.tags.length > 3 && <i className="day-tag more">+{entry.tags.length - 3}</i>}
                      </span>
                    )}
                    <span className={`day-battery battery-${batteryPercent(entry.fatigue)}`} aria-label={`剩余电量 ${batteryPercent(entry.fatigue)}%`}>
                      <i style={{ width: `${batteryPercent(entry.fatigue)}%` }} />
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span>心情</span>{moodOptions.map((option) => <span key={option.value}><i className={`legend-dot mood-${option.value}`} />{option.label}</span>)}
        </div>
        <div className="calendar-legend">
          <span>电量</span>{batteryOptions.map((option) => <span key={option.value}><i className={`legend-bar battery-${option.percent}`} />{option.percent}%</span>)}
        </div>
      </section>
    </div>
  )
}

function TrendsView({ entries }: { entries: MoodEntry[] }) {
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const visible = useMemo(() => {
    const start = addDays(localDate(), -(range - 1))
    return entries.filter((entry) => entry.date >= start && entry.date <= localDate()).sort((a, b) => a.date.localeCompare(b.date))
  }, [entries, range])
  const chartData = visible.map((entry) => ({ ...entry, battery: batteryPercent(entry.fatigue), label: entry.date.slice(5).replace('-', '/') }))
  const averageBattery = average(visible.map((entry) => batteryPercent(entry.fatigue)))
  const entrySet = new Set(entries.map((entry) => entry.date))
  const today = localDate()
  const loggedToday = entrySet.has(today)
  // 今天还没记录时从昨天起算，连续记录只在整天空过后才归零
  let streak = 0
  let cursor = loggedToday ? today : addDays(today, -1)
  while (entrySet.has(cursor)) { streak += 1; cursor = addDays(cursor, -1) }

  return (
    <div className="page">
      <header className="page-header trends-header">
        <div><p className="eyebrow"><ChartNoAxesCombined size={16} /> 状态趋势</p><h1>看见自己的节奏</h1><p>数据只是线索，不是对你的评价。</p></div>
        <div className="range-tabs">{([7, 30, 90] as const).map((value) => <button key={value} className={range === value ? 'active' : ''} onClick={() => setRange(value)}>{value} 天</button>)}</div>
      </header>
      <div className="stat-grid">
        <article className="stat-card"><span>平均心情</span><strong>{average(visible.map((entry) => entry.mood))}</strong><small>满分 5 分</small></article>
        <article className="stat-card"><span>平均电量</span><strong>{averageBattery === '—' ? '—' : `${averageBattery}%`}</strong><small>满电为 100%</small></article>
        <article className="stat-card"><span>记录天数</span><strong>{visible.length}</strong><small>最近 {range} 天</small></article>
        <article className="stat-card"><span>连续记录</span><strong>{streak}</strong><small>{streak > 0 && !loggedToday ? '天 · 今天还没记' : '天'}</small></article>
      </div>
      <section className="chart-card">
        <div className="card-heading"><div><h2>心情与电量变化</h2><p>将两条曲线放在一起，更容易发现关联。</p></div></div>
        {chartData.length ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="#dfddd5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#75736d', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis yAxisId="mood" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#75736d', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="battery" orientation="right" domain={[0, 100]} ticks={[20, 40, 60, 80, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#75736d', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e3e0d8', boxShadow: '0 12px 30px rgba(45,55,50,.1)' }} labelFormatter={(label) => `日期 ${label}`} />
                <Legend iconType="circle" />
                <Line yAxisId="mood" type="monotone" dataKey="mood" name="心情" stroke="#268f79" strokeWidth={3} dot={{ r: 3, fill: '#268f79' }} activeDot={{ r: 5 }} connectNulls />
                <Line yAxisId="battery" type="monotone" dataKey="battery" name="电量" unit="%" stroke="#e28c58" strokeWidth={3} dot={{ r: 3, fill: '#e28c58' }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="empty-state"><ChartNoAxesCombined size={36} /><h3>还没有趋势数据</h3><p>完成一次记录后，这里就会出现你的状态曲线。</p></div>}
      </section>
      <section className="insight-card">
        <Sparkles size={22} />
        <div><h3>一个温和的提醒</h3><p>{visible.length >= 3 ? `最近 ${range} 天记录了 ${visible.length} 次。规律记录比追求“好心情”更重要。` : '不需要每天都状态很好。先忠实记录，变化会慢慢显现。'}</p></div>
      </section>
    </div>
  )
}

function TagManager({ tagLibrary, entries, onCreate, onUpdate, onDelete }: {
  tagLibrary: Tag[]
  entries: MoodEntry[]
  onCreate: (tag: TagInput) => Promise<void>
  onUpdate: (name: string, tag: TagInput) => Promise<number>
  onDelete: (name: string) => Promise<number>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<TagInput>({ name: '', color: tagPalette[0], initial: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  // 每个标签被多少条记录用过，改名和删除前需要让用户知道影响面
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) for (const name of entry.tags) counts.set(name, (counts.get(name) ?? 0) + 1)
    return counts
  }, [entries])

  function report(text: string, isError = false) {
    setMessage(text)
    setFailed(isError)
  }

  function startCreate() {
    setEditing('')
    setDraft({ name: '', color: tagPalette[tagLibrary.length % tagPalette.length], initial: '' })
    report('')
  }

  function startEdit(tag: Tag) {
    setEditing(tag.name)
    setDraft({ name: tag.name, color: tag.color, initial: tag.initial })
    report('')
  }

  function cancel() {
    setEditing(null)
    report('')
  }

  async function submit() {
    const name = draft.name.trim()
    if (!name) return report('请填写标签名', true)
    // 首字留空时默认取标签名第一个字
    const initial = draft.initial.trim() || [...name][0] || ''
    setBusy(true)
    try {
      if (editing) {
        const affected = await onUpdate(editing, { ...draft, name, initial })
        report(affected ? `已保存，同步更新了 ${affected} 条记录` : '已保存')
      } else {
        await onCreate({ ...draft, name, initial })
        report('标签已创建')
      }
      setEditing(null)
    } catch (cause) {
      report(cause instanceof Error ? cause.message : '保存失败', true)
    } finally {
      setBusy(false)
    }
  }

  async function remove(tag: Tag) {
    const used = usage.get(tag.name) ?? 0
    const warning = used
      ? `确定删除标签「${tag.name}」吗？它会同时从 ${used} 条记录中移除，此操作无法撤销。`
      : `确定删除标签「${tag.name}」吗？`
    if (!window.confirm(warning)) return
    setBusy(true)
    try {
      const affected = await onDelete(tag.name)
      report(affected ? `已删除，并从 ${affected} 条记录中移除` : '标签已删除')
      if (editing === tag.name) setEditing(null)
    } catch (cause) {
      report(cause instanceof Error ? cause.message : '删除失败', true)
    } finally {
      setBusy(false)
    }
  }

  const previewName = draft.name.trim() || '标签'
  const previewInitial = draft.initial.trim() || [...previewName][0] || '·'

  return (
    <section className="settings-card">
      <div className="settings-heading">
        <div><h2>标签管理</h2><p>标签的名称、颜色和首字都可以改。桌面日历显示完整名称，手机上显示首字。</p></div>
        <button className="secondary-button" onClick={startCreate} disabled={busy}><Plus size={17} />新建标签</button>
      </div>

      {editing !== null && (
        <div className="tag-editor">
          <div className="tag-editor-row">
            <label className="field-label">标签名
              <input value={draft.name} maxLength={20} onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))} placeholder="例如：工作" />
            </label>
            <label className="field-label">首字
              <input value={draft.initial} maxLength={2} onChange={(event) => setDraft((d) => ({ ...d, initial: event.target.value }))} placeholder={[...previewName][0] ?? ''} />
            </label>
            <div className="tag-preview">
              <span>预览</span>
              <i className="day-tag" style={{ background: draft.color }}><b>{previewName}</b></i>
              <i className="day-tag" style={{ background: draft.color }}><b>{previewInitial}</b></i>
            </div>
          </div>
          <div className="color-row" role="radiogroup" aria-label="标签颜色">
            {tagPalette.map((color) => (
              <button
                key={color}
                type="button"
                className={draft.color === color ? 'color-swatch selected' : 'color-swatch'}
                style={{ background: color }}
                onClick={() => setDraft((d) => ({ ...d, color }))}
                role="radio"
                aria-checked={draft.color === color}
                aria-label={`颜色 ${color}`}
              />
            ))}
          </div>
          <div className="tag-editor-actions">
            <button className="primary-button" onClick={submit} disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}{editing ? '保存修改' : '创建标签'}
            </button>
            <button className="secondary-button" onClick={cancel} disabled={busy}>取消</button>
          </div>
        </div>
      )}

      {message && <p className={failed ? 'action-message error' : 'action-message'}>{message}</p>}

      <div className="tag-manage-list">
        {tagLibrary.map((tag) => (
          <div className="tag-row" key={tag.name}>
            <i className="day-tag" style={{ background: tag.color }}><b>{tag.initial}</b></i>
            <div className="tag-row-main">
              <strong>{tag.name}</strong>
              <span>{usage.get(tag.name) ?? 0} 条记录用过</span>
            </div>
            <button className="icon-button small" onClick={() => startEdit(tag)} disabled={busy} aria-label={`编辑 ${tag.name}`}><Pencil size={15} /></button>
            <button className="icon-button small danger" onClick={() => void remove(tag)} disabled={busy} aria-label={`删除 ${tag.name}`}><Trash2 size={15} /></button>
          </div>
        ))}
        {!tagLibrary.length && <p className="tag-empty"><Tags size={20} />还没有标签，点右上角新建一个。</p>}
      </div>
    </section>
  )
}

function SettingsView({ user, entries, tagLibrary, onLogout, onRefresh, refreshing, onCreateTag, onUpdateTag, onDeleteTag }: {
  user: User
  entries: MoodEntry[]
  tagLibrary: Tag[]
  onLogout: () => Promise<void>
  onRefresh: () => Promise<void>
  refreshing: boolean
  onCreateTag: (tag: TagInput) => Promise<void>
  onUpdateTag: (name: string, tag: TagInput) => Promise<number>
  onDeleteTag: (name: string) => Promise<number>
}) {
  function download(content: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportJson() {
    download(JSON.stringify({ product: 'Daystate', exportedAt: new Date().toISOString(), entries }, null, 2), 'application/json;charset=utf-8', `daystate-${localDate()}.json`)
  }

  function exportCsv() {
    const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`
    const rows = [['日期', '心情', '剩余电量(%)', '标签', '记录'], ...entries.map((entry) => [entry.date, entry.mood, batteryPercent(entry.fatigue), entry.tags.join('、'), entry.note])]
    download(`\uFEFF${rows.map((row) => row.map(quote).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8', `daystate-${localDate()}.csv`)
  }

  return (
    <div className="page settings-page">
      <header className="page-header"><div><p className="eyebrow"><Settings size={16} /> 设置</p><h1>你的日况空间</h1><p>管理账号、云端数据和备份。</p></div></header>
      <section className="settings-card profile-card">
        <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
        <div><h2>{user.username}</h2><p>已记录 {entries.length} 天</p></div>
        <span className="cloud-status"><Cloud size={15} />云端账号</span>
      </section>
      <section className="settings-card">
        <div className="settings-heading"><div><h2>云端数据</h2><p>日况以 Cloudflare D1 为唯一数据源，多台设备登录同一账号即可看到相同记录。</p></div><button className="secondary-button" onClick={onRefresh} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={17} />立即刷新</button></div>
      </section>
      <TagManager tagLibrary={tagLibrary} entries={entries} onCreate={onCreateTag} onUpdate={onUpdateTag} onDelete={onDeleteTag} />
      <section className="settings-card">
        <div className="settings-heading"><div><h2>导出备份</h2><p>随时下载完整记录。JSON 适合备份，CSV 适合使用 Excel 查看。</p></div></div>
        <div className="button-row"><button className="secondary-button" onClick={exportJson}><Download size={17} />导出 JSON</button><button className="secondary-button" onClick={exportCsv}><Download size={17} />导出 CSV</button></div>
      </section>
      <section className="settings-card danger-zone">
        <div><h2>退出账号</h2><p>当前设备的登录会话将被清除，云端记录不会删除。</p></div>
        <button className="danger-button" onClick={onLogout}><LogOut size={17} />退出登录</button>
      </section>
      <footer className="product-footer"><img src="/daystate.svg" alt="" /><span>日况 Daystate · 记下今天，读懂自己。</span></footer>
    </div>
  )
}

const navItems: Array<{ page: Page; label: string; icon: typeof NotebookPen }> = [
  { page: 'record', label: '记录', icon: NotebookPen },
  { page: 'calendar', label: '日历', icon: CalendarDays },
  { page: 'trends', label: '趋势', icon: ChartNoAxesCombined },
  { page: 'settings', label: '设置', icon: Settings },
]

function JournalApp({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [page, setPage] = useState<Page>('record')
  const [selectedDate, setSelectedDate] = useState(localDate())
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [tagLibrary, setTagLibrary] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadEntries = useCallback(async () => {
    setLoadError('')
    setLoading(true)
    try {
      const [entryResult, tagResult] = await Promise.all([api.entries(), api.tags()])
      setEntries(entryResult.entries)
      setTagLibrary(tagResult.tags)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  async function createTag(tag: TagInput) {
    setTagLibrary((await api.createTag(tag)).tags)
  }

  // 改名和删除都会改写历史记录，成功后重新拉取记录以保持一致
  async function updateTag(name: string, tag: TagInput) {
    const result = await api.updateTag(name, tag)
    setTagLibrary(result.tags)
    if (result.affected) setEntries((await api.entries()).entries)
    return result.affected
  }

  async function deleteTag(name: string) {
    const result = await api.deleteTag(name)
    setTagLibrary(result.tags)
    if (result.affected) setEntries((await api.entries()).entries)
    return result.affected
  }

  useEffect(() => { void loadEntries() }, [loadEntries])
  const selectedEntry = entries.find((entry) => entry.date === selectedDate)

  async function saveEntry(input: EntryInput) {
    const result = await api.saveEntry(selectedDate, input)
    setEntries((current) => [result.entry, ...current.filter((entry) => entry.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date)))
  }

  async function deleteEntry() {
    await api.deleteEntry(selectedDate)
    setEntries((current) => current.filter((entry) => entry.date !== selectedDate))
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date)
    setPage('record')
  }

  async function logout() {
    await api.logout()
    onLoggedOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup compact"><div className="brand-mark">日</div><div><strong>日况</strong><span>Daystate</span></div></div>
        <nav>{navItems.map((item) => { const Icon = item.icon; return <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => setPage(item.page)}><Icon size={20} /><span>{item.label}</span></button> })}</nav>
        <div className="sidebar-user"><div className="mini-avatar">{user.username.slice(0, 1).toUpperCase()}</div><div><strong>{user.username}</strong><span><i />云端已连接</span></div></div>
      </aside>
      <main className="main-content">
        {loadError && <div className="load-error"><span>{loadError}</span><button onClick={() => void loadEntries()}><RefreshCw size={15} />重试</button></div>}
        {loading && !entries.length ? <div className="content-loading"><LoaderCircle className="spin" /><span>正在读取云端记录…</span></div> : (
          <>
            {page === 'record' && <RecordView key={selectedDate} date={selectedDate} entry={selectedEntry} tagLibrary={tagLibrary} onDateChange={setSelectedDate} onSave={saveEntry} onDelete={deleteEntry} onManageTags={() => setPage('settings')} />}
            {page === 'calendar' && <CalendarView entries={entries} tagLibrary={tagLibrary} onSelect={selectCalendarDate} />}
            {page === 'trends' && <TrendsView entries={entries} />}
            {page === 'settings' && <SettingsView user={user} entries={entries} tagLibrary={tagLibrary} onLogout={logout} onRefresh={loadEntries} refreshing={loading} onCreateTag={createTag} onUpdateTag={updateTag} onDeleteTag={deleteTag} />}
          </>
        )}
      </main>
      <nav className="mobile-nav">{navItems.map((item) => { const Icon = item.icon; return <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => setPage(item.page)}><Icon size={21} /><span>{item.label}</span></button> })}</nav>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api.me().then((result) => setUser(result.user)).catch(() => setUser(null))
  }, [])

  if (user === undefined) return <LoadingScreen />
  if (!user) return <LoginView onAuthenticated={setUser} />
  return <JournalApp user={user} onLoggedOut={() => setUser(null)} />
}
