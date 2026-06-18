import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { api, Report, categoryColor, statusColor, priorityColor } from '../lib/api'
import SmartCityHero from '../components/SmartCityHero'

const WORKERS     = ['Ahmed Khan', 'Sara Malik', 'Usman Ali', 'Fatima Raza', 'Bilal Chaudhry']
const DEPARTMENTS = ['Roads Dept', 'Sanitation', 'Electrical', 'Parks & Rec', 'Water & Sewage']
const STATUSES    = ['pending', 'reviewed', 'assigned', 'in_progress', 'resolved']

export default function DashboardPage() {
  const [reports,        setReports]       = useState<Report[]>([])
  const [filter,         setFilter]        = useState('all')
  const [statusFilter,   setStatusFilter]  = useState('all')
  const [selected,       setSelected]      = useState<Report | null>(null)
  const [saving,         setSaving]        = useState(false)
  const [saveMsg,        setSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [assignWorker,   setAssignWorker]  = useState('')
  const [assignDept,     setAssignDept]    = useState('')
  const [assignStatus,   setAssignStatus]  = useState('')
  const [assignPriority, setAssignPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const load = () =>
    api.get('/api/reports').then(({ data }: { data: Report[] }) => setReports(data))

  useEffect(() => {
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(() =>
    reports.filter(r => {
      if (filter !== 'all' && r.category !== filter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      return true
    }), [reports, filter, statusFilter])

  const stats = useMemo(() => ({
    total:    reports.length,
    pending:  reports.filter(r => r.status === 'pending').length,
    reviewed: reports.filter(r => r.status === 'reviewed').length,
    assigned: reports.filter(r => r.status === 'assigned').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }), [reports])

  const center: [number, number] = reports.length
    ? [reports.reduce((s, r) => s + r.latitude,  0) / reports.length,
       reports.reduce((s, r) => s + r.longitude, 0) / reports.length]
    : [31.45, 73.13]

  const openReport = (r: Report) => {
    setSelected(r)
    setAssignWorker(r.assignedWorker || '')
    setAssignDept(r.assignedDepartment || '')
    setAssignStatus(r.status)
    setAssignPriority(r.priority || 'medium')
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.patch(`/api/reports/${selected.id}`, {
        assignedWorker:     assignWorker  || null,
        assignedDepartment: assignDept    || null,
        status:             assignStatus  || selected.status,
        priority:           assignPriority,
      })
      await load()
      setSaveMsg({ ok: true, text: `Report #${selected.id} updated` })
      setTimeout(() => { setSaveMsg(null); setSelected(null) }, 1500)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Save failed'
      setSaveMsg({ ok: false, text: msg })
    } finally {
      setSaving(false)
    }
  }

  const exportCSV = () => {
    const headers = ['ID', 'Category', 'Status', 'Priority', 'Worker', 'Dept', 'AI%', 'Lat', 'Lng', 'Created']
    const rows = filtered.map(r => [
      r.id, r.category || '', r.status, r.priority,
      r.assignedWorker || '', r.assignedDepartment || '',
      r.confidence ? `${(r.confidence * 100).toFixed(1)}%` : '',
      r.latitude, r.longitude, new Date(r.createdAt).toLocaleString(),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `reports-${new Date().toISOString().split('T')[0]}.csv`,
    })
    a.click()
  }

  const cc = (cat?: Report['category'] | null) =>
    cat ? categoryColor[cat] ?? '#94a3b8' : '#94a3b8'

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <SmartCityHero />

        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-0.5 h-5 rounded-full bg-sky" style={{ boxShadow: '0 0 8px #38bdf8' }} />
              <span className="text-sky text-xs font-bold tracking-[0.18em] uppercase">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage and assign city reports in real-time</p>
          </div>
          <button onClick={exportCSV}
            className="px-4 py-2 rounded-xl border border-sky/25 text-sky bg-sky/10 hover:bg-sky/20 text-sm font-medium transition flex items-center gap-2">
            ↓ Export CSV
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total',    value: stats.total,    color: '#818cf8' },
            { label: 'Pending',  value: stats.pending,  color: statusColor.pending  },
            { label: 'Reviewed', value: stats.reviewed, color: statusColor.reviewed },
            { label: 'Assigned', value: stats.assigned, color: statusColor.assigned },
            { label: 'Resolved', value: stats.resolved, color: statusColor.resolved },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{s.label}</div>
              <div className="font-display text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-mid bg-deep/70 text-slate-300 text-sm outline-none focus:border-sky/40 transition">
            <option value="all">All categories</option>
            <option value="Pothole">Pothole</option>
            <option value="Garbage">Garbage</option>
            <option value="Broken Streetlight">Broken Streetlight</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-mid bg-deep/70 text-slate-300 text-sm outline-none focus:border-sky/40 transition">
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <span className="text-sm text-slate-500 ml-1">{filtered.length} reports</span>
        </div>

        {/* Map + assignment panel */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          <div className="col-span-2 rounded-2xl overflow-hidden border border-mid/60 h-[400px]">
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
              {filtered.map(r => (
                <CircleMarker key={r.id} center={[r.latitude, r.longitude]}
                  radius={8} pathOptions={{ color: cc(r.category), fillOpacity: 0.75 }}
                  eventHandlers={{ click: () => openReport(r) }}>
                  <Popup>
                    <div className="text-xs">
                      <div className="font-bold">{r.category || 'Pending'} #{r.id}</div>
                      <div className="text-slate-600 mt-0.5">{r.description}</div>
                      <div className="mt-1 capitalize">{r.status}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="glass rounded-2xl p-5">
            {selected ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Report #{selected.id}</div>
                    <div className="font-display text-lg font-bold text-white mt-0.5">
                      {selected.category || 'Unclassified'}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="text-slate-500 hover:text-white text-xl leading-none transition">×</button>
                </div>
                <p className="text-xs text-slate-500 mb-4 line-clamp-3">{selected.description}</p>
                <div className="space-y-3">
                  {[
                    { label: 'Assign Worker', val: assignWorker, set: setAssignWorker, opts: WORKERS },
                    { label: 'Department',    val: assignDept,   set: setAssignDept,   opts: DEPARTMENTS },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                      <select value={f.val} onChange={e => f.set(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-void border border-mid text-slate-200 text-sm outline-none focus:border-sky/40">
                        <option value="">— unassigned —</option>
                        {f.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Priority</label>
                    <select value={assignPriority} onChange={e => setAssignPriority(e.target.value as 'low' | 'medium' | 'high')}
                      className="w-full px-3 py-2 rounded-xl bg-void border border-mid text-slate-200 text-sm outline-none focus:border-sky/40">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Status</label>
                    <select value={assignStatus} onChange={e => setAssignStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-void border border-mid text-slate-200 text-sm outline-none focus:border-sky/40">
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  {saveMsg && (
                    <div className={`px-3 py-2 rounded-xl text-xs font-medium ${
                      saveMsg.ok
                        ? 'bg-mint/10 border border-mint/25 text-mint'
                        : 'bg-rose/10 border border-rose/25 text-rose'
                    }`}>
                      {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
                    </div>
                  )}
                  <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 rounded-xl text-sm">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center py-16">
                Click a map marker or table row to assign a worker
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-mid"
              style={{ background: 'rgba(3,7,18,0.6)' }}>
              <tr>
                {['ID', 'Category', 'Priority', 'Status', 'Worker', 'AI %', 'Submitted', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(r => (
                <tr key={r.id} onClick={() => openReport(r)}
                  className="border-t border-mid hover:bg-sky/5 cursor-pointer text-slate-300 transition">
                  <td className="px-4 py-2.5 font-mono text-slate-500">#{r.id}</td>
                  <td className="px-4 py-2.5">
                    {r.category
                      ? <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: cc(r.category) }} />
                          {r.category}
                        </span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: (priorityColor[r.priority] ?? '#94a3b8') + '22',
                        color:       priorityColor[r.priority] ?? '#94a3b8',
                      }}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: (statusColor[r.status] ?? '#94a3b8') + '22',
                        color:       statusColor[r.status] ?? '#94a3b8',
                      }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.assignedWorker || '—'}</td>
                  <td className="px-4 py-2.5 font-mono">{r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-sky hover:underline">Assign →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-slate-600 text-sm">
              No reports match the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
