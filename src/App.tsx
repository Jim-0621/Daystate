import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Cloud,
  Download, LoaderCircle, LogOut, NotebookPen, Plus, RefreshCw, Settings,
  Sparkles, Trash2, X,
} from 'lucide-react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from './api'
import type { EntryInput, MoodEntry, Page, Score, User } from './types'

const moodOptions: Array<{ value: Score; emoji: string; label: string }> = [
  { value: 1, emoji: '😞', label: '低落' },
  { value: 2, emoji: '😕', label: '有点糟' },
  { value: 3, emoji: '😐', label: '平静' },
  { value: 4, emoji: '🙂', label: '不错' },
  { value: 5, emoji: '😄', label: '很好' },
]

const batteryOptions: Array<{ value: Score; percent: number; label: string }> = [
  { value: 5, percent: 20, label: '快关机' },
  { value: 4, percent: 40, label: '电量不足' },
  { value: 3, percent: 60, label: '还能撑住' },
  { value: 2, percent: 80, label: '电量充足' },
  { value: 1, percent: 100, label: '满电状态' },
]

const suggestedTags = ['工作', '运动', '家庭', '朋友', '学习', '睡眠', '生病', '旅行']

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
  date, entry, onDateChange, onSave, onDelete,
}: {
  date: string
  entry?: MoodEntry
  onDateChange: (date: string) => void
  onSave: (input: EntryInput) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [mood, setMood] = useState<Score>(3)
  const [fatigue, setFatigue] = useState<Score>(3)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [tagMessage, setTagMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMood(entry?.mood ?? 3)
    setFatigue(entry?.fatigue ?? 3)
    setNote(entry?.note ?? '')
    setTags(entry?.tags ?? [])
    setCustomTag('')
    setTagMessage('')
    setMessage('')
  }, [date])

  function toggleTag(tag: string) {
    setTagMessage('')
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 8 ? [...current, tag] : current)
  }

  function addCustomTag() {
    const value = customTag.trim()
    if (!value) {
      setTagMessage('请先输入标签名称')
      tagInputRef.current?.focus()
      return
    }
    if (tags.includes(value)) {
      setTagMessage('这个标签已经添加过了')
      tagInputRef.current?.focus()
      return
    }
    if (tags.length >= 8) {
      setTagMessage('最多添加 8 个标签')
      return
    }
    setTags((current) => [...current, value.slice(0, 20)])
    setCustomTag('')
    setTagMessage('标签已添加')
    tagInputRef.current?.focus()
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
        <label className="date-control" aria-label="选择记录日期">
          <input className="date-input" type="date" max={localDate()} value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value) }} required />
          <CalendarDays size={17} aria-hidden="true" />
        </label>
      </header>

      <form className="record-form" onSubmit={submit}>
        <section className="form-section">
          <div className="section-heading"><span className="section-number">01</span><div><h2>今天的心情</h2><p>选择最接近此刻的感受</p></div></div>
          <ScorePicker kind="mood" value={mood} onChange={setMood} />
        </section>

        <section className="form-section">
          <div className="section-heading"><span className="section-number">02</span><div><h2>今天还剩多少电</h2><p>把自己当作一台设备，看看当前电量</p></div></div>
          <ScorePicker kind="battery" value={fatigue} onChange={setFatigue} />
        </section>

        <section className="form-section">
          <div className="section-heading"><span className="section-number">03</span><div><h2>今天发生了什么</h2><p>可选，写下一句话也很好</p></div></div>
          <textarea className="note-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="比如：完成了一件拖了很久的事，虽然电量不多，但心里轻松了……" />
          <div className="character-count">{note.length} / 2000</div>
        </section>

        <section className="form-section compact">
          <div className="section-heading"><span className="section-number">04</span><div><h2>加几个标签</h2><p>以后更容易发现状态变化的原因</p></div></div>
          <div className="tag-list">
            {suggestedTags.map((tag) => <button type="button" key={tag} className={tags.includes(tag) ? 'tag selected' : 'tag'} onClick={() => toggleTag(tag)}>{tags.includes(tag) && <Check size={14} />}{tag}</button>)}
            {tags.filter((tag) => !suggestedTags.includes(tag)).map((tag) => <button type="button" key={tag} className="tag selected" onClick={() => toggleTag(tag)}><X size={14} />{tag}</button>)}
          </div>
          <div className="custom-tag-row">
            <input ref={tagInputRef} value={customTag} onChange={(event) => { setCustomTag(event.target.value); setTagMessage('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag() } }} maxLength={20} placeholder="输入自定义标签" aria-describedby="tag-feedback" />
            <button type="button" className="icon-text-button" onClick={addCustomTag}><Plus size={16} />添加</button>
          </div>
          <span id="tag-feedback" className={`tag-feedback ${tagMessage === '标签已添加' ? 'success' : ''}`} aria-live="polite">{tagMessage || '输入后点击添加，也可以按回车'}</span>
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

function CalendarView({ entries, onSelect }: { entries: MoodEntry[]; onSelect: (date: string) => void }) {
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
                {entry && <><span className="day-emoji">{moodOptions[entry.mood - 1].emoji}</span><span className="battery-dot" title={`剩余电量 ${batteryPercent(entry.fatigue)}%`} style={{ opacity: 0.25 + batteryPercent(entry.fatigue) * 0.007 }} /></>}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span>心情</span>{moodOptions.map((option) => <span key={option.value}><i className={`legend-dot mood-${option.value}`} />{option.label}</span>)}
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
  let streak = 0
  let cursor = localDate()
  while (entrySet.has(cursor)) { streak += 1; cursor = addDays(cursor, -1) }

  return (
    <div className="page">
      <header className="page-header trends-header">
        <div><p className="eyebrow"><ChartNoAxesCombined size={16} /> 状态趋势</p><h1>看见自己的节奏</h1><p>数据只是线索，不是对你的评价。</p></div>
        <div className="range-tabs">{([7, 30, 90] as const).map((value) => <button key={value} className={range === value ? 'active' : ''} onClick={() => setRange(value)}>{value} 天</button>)}</div>
      </header>
      <div className="stat-grid">
        <article className="stat-card"><span>平均心情</span><strong>{average(visible.map((entry) => entry.mood))}</strong><small>满分 5 分</small></article>
        <article className="stat-card"><span>平均电量</span><strong>{averageBattery === '—' ? '—' : `${averageBattery}%`}</strong><small>剩余电量越高越充足</small></article>
        <article className="stat-card"><span>记录天数</span><strong>{visible.length}</strong><small>最近 {range} 天</small></article>
        <article className="stat-card"><span>连续记录</span><strong>{streak}</strong><small>天</small></article>
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

function SettingsView({ user, entries, onLogout, onRefresh, refreshing }: { user: User; entries: MoodEntry[]; onLogout: () => Promise<void>; onRefresh: () => Promise<void>; refreshing: boolean }) {
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadEntries = useCallback(async () => {
    setLoadError('')
    setLoading(true)
    try {
      const result = await api.entries()
      setEntries(result.entries)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

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
            {page === 'record' && <RecordView key={selectedDate} date={selectedDate} entry={selectedEntry} onDateChange={setSelectedDate} onSave={saveEntry} onDelete={deleteEntry} />}
            {page === 'calendar' && <CalendarView entries={entries} onSelect={selectCalendarDate} />}
            {page === 'trends' && <TrendsView entries={entries} />}
            {page === 'settings' && <SettingsView user={user} entries={entries} onLogout={logout} onRefresh={loadEntries} refreshing={loading} />}
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
