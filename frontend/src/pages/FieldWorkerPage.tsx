import { useEffect, useRef, useState } from 'react'
import { api, Report, categoryColor, statusColor } from '../lib/api'
import SmartCityHero from '../components/SmartCityHero'

const WORKERS = ['Ahmed Khan', 'Sara Malik', 'Usman Ali', 'Fatima Raza', 'Bilal Chaudhry']

const STATUS_FLOW: Record<string, string> = {
  assigned:    'in_progress',
  in_progress: 'resolved',
}

export default function FieldWorkerPage() {
  const [worker,       setWorker]       = useState<string | null>(() => sessionStorage.getItem('fw_worker'))
  const [nameInput,    setNameInput]    = useState('')
  const [tasks,        setTasks]        = useState<Report[]>([])
  const [selected,     setSelected]     = useState<Report | null>(null)
  const [notes,        setNotes]        = useState('')
  const [photo,        setPhoto]        = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (w: string) =>
    api.get(`/api/reports?worker=${encodeURIComponent(w)}`)
       .then(({ data }: { data: Report[] }) => setTasks(data))

  useEffect(() => {
    if (!worker) return
    load(worker)
    const t = setInterval(() => load(worker), 8000)
    return () => clearInterval(t)
  }, [worker])

  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const login = () => {
    if (!nameInput.trim()) return
    sessionStorage.setItem('fw_worker', nameInput)
    setWorker(nameInput)
  }

  const logout = () => {
    sessionStorage.removeItem('fw_worker')
    setWorker(null); setTasks([]); setSelected(null)
  }

  const advanceStatus = async (r: Report) => {
    const next = STATUS_FLOW[r.status]
    if (!next) return
    setSaving(true)
    try {
      await api.patch(`/api/reports/${r.id}`, { status: next })
      setMsg(`Report #${r.id} → ${next.replace('_', ' ')}`)
      setTimeout(() => setMsg(null), 3000)
      if (worker) load(worker)
      if (selected?.id === r.id) setSelected({ ...r, status: next as Report['status'] })
    } finally { setSaving(false) }
  }

  const markComplete = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const fd = new FormData()
      if (notes) fd.append('workerNotes', notes)
      if (photo)  fd.append('completionImage', photo)
      await api.post(`/api/reports/${selected.id}/complete`, fd)
      setMsg(`Report #${selected.id} resolved!`)
      setTimeout(() => setMsg(null), 3000)
      setSelected(null); setNotes(''); setPhoto(null)
      if (worker) load(worker)
    } finally { setSaving(false) }
  }

  const summary = {
    total:      tasks.length,
    assigned:   tasks.filter(t => t.status === 'assigned').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    resolved:   tasks.filter(t => t.status === 'resolved').length,
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 w-full max-w-sm"
          style={{ border: '1px solid rgba(56,189,248,0.2)' }}>
          <div className="w-14 h-14 rounded-full bg-sky/10 border border-sky/25 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-sky" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold text-center text-white mb-1">
            Field Worker Portal
          </h1>
          <p className="text-slate-400 text-xs text-center mb-5">
            Select your name to view assigned tasks
          </p>
          <select value={nameInput} onChange={e => setNameInput(e.target.value)}
            className="w-full px-3 py-2.5 border border-mid rounded-xl text-sm mb-3 bg-void text-slate-200 outline-none focus:border-sky/40 transition">
            <option value="">Select your name…</option>
            {WORKERS.map(w => <option key={w}>{w}</option>)}
          </select>
          <input value={nameInput} onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Or type your name…"
            className="w-full px-3 py-2.5 border border-mid rounded-xl text-sm mb-4 bg-void text-slate-200 placeholder-slate-600 outline-none focus:border-sky/40 transition" />
          <button onClick={login} disabled={!nameInput.trim()}
            className="btn-primary w-full py-2.5 rounded-xl text-sm disabled:opacity-40">
            View my tasks →
          </button>
        </div>
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <SmartCityHero />

        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-0.5 h-5 rounded-full bg-mint" style={{ boxShadow: '0 0 8px #34d399' }} />
              <span className="text-mint text-xs font-bold tracking-[0.18em] uppercase glow-mint">Field Portal</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Welcome, {worker}</h1>
          </div>
          <button onClick={logout}
            className="px-4 py-2 border border-mid rounded-xl text-sm text-slate-400 hover:text-white hover:border-sky/30 transition">
            Switch worker
          </button>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 glass text-mint text-sm rounded-xl"
            style={{ borderColor: 'rgba(52,211,153,0.25)' }}>
            ✓ {msg}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total',       value: summary.total,      color: '#818cf8' },
            { label: 'Awaiting',    value: summary.assigned,   color: statusColor.assigned    },
            { label: 'In Progress', value: summary.inProgress, color: statusColor.in_progress },
            { label: 'Done',        value: summary.resolved,   color: statusColor.resolved    },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{s.label}</div>
              <div className="font-display text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-5">
          {/* Task list */}
          <div className="col-span-3 space-y-3">
            <h2 className="font-display font-bold text-lg text-white mb-1">Your Tasks</h2>
            {tasks.length === 0 && (
              <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">
                No tasks assigned yet. Check back later.
              </div>
            )}
            {tasks.map(t => (
              <div key={t.id}
                onClick={() => { setSelected(t); setNotes(t.workerNotes || '') }}
                className="glass rounded-2xl p-4 cursor-pointer transition-all"
                style={{
                  border: selected?.id === t.id
                    ? '1px solid rgba(56,189,248,0.4)'
                    : '1px solid rgba(30,41,59,0.5)',
                  background: selected?.id === t.id ? 'rgba(56,189,248,0.06)' : undefined,
                }}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full"
                      style={{ background: t.category ? categoryColor[t.category] : '#94a3b8' }} />
                    <span className="font-semibold text-sm text-white">
                      {t.category || 'Unclassified'}
                    </span>
                    <span className="text-xs text-slate-500">#{t.id}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: (statusColor[t.status] ?? '#94a3b8') + '22',
                      color:       statusColor[t.status] ?? '#94a3b8',
                    }}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{t.description}</p>
                <div className="text-xs text-slate-600 mt-1 font-mono">
                  {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                </div>
                {STATUS_FLOW[t.status] && (
                  <button
                    onClick={e => { e.stopPropagation(); advanceStatus(t) }}
                    disabled={saving}
                    className="mt-2 w-full py-1.5 border border-mint/30 text-mint rounded-xl text-xs font-semibold hover:bg-mint/10 disabled:opacity-40 transition">
                    Mark as {STATUS_FLOW[t.status]!.replace('_', ' ')} →
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Completion panel */}
          <div className="col-span-2">
            <h2 className="font-display font-bold text-lg text-white mb-1">Mark Complete</h2>
            <div className="glass rounded-2xl p-5 sticky top-6">
              {selected ? (
                <>
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-0.5">Report #{selected.id}</div>
                    <div className="font-bold text-white">{selected.category || 'Issue'}</div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{selected.description}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Completion notes</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                        placeholder="Describe what was done…"
                        className="w-full px-3 py-2 border border-mid rounded-xl text-sm resize-none bg-void text-slate-200 placeholder-slate-600 outline-none focus:border-sky/40 transition" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Photo (optional)</label>
                      {photoPreview ? (
                        <div className="relative">
                          <img src={photoPreview} alt="" className="w-full h-28 object-cover rounded-xl" />
                          <button onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                            className="absolute top-1 right-1 w-5 h-5 bg-void/80 rounded-full text-xs flex items-center justify-center text-white hover:bg-rose/80 transition">
                            ×
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => fileRef.current?.click()}
                          className="w-full h-20 border border-dashed border-mid rounded-xl text-xs text-slate-500 hover:border-sky/30 hover:text-sky transition">
                          Tap to add photo
                        </button>
                      )}
                      <input ref={fileRef} type="file" accept="image/*" capture="environment"
                        className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                    </div>
                    <button onClick={markComplete}
                      disabled={saving || selected.status === 'resolved'}
                      className="btn-primary w-full py-2.5 rounded-xl text-sm disabled:opacity-40">
                      {selected.status === 'resolved' ? 'Already resolved'
                        : saving ? 'Submitting…' : 'Submit completion'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-slate-500 text-sm">
                  Select a task to mark it complete
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
