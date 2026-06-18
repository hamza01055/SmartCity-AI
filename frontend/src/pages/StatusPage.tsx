import { useState } from 'react'
import { api, Report, statusColor } from '../lib/api'
import SmartCityHero from '../components/SmartCityHero'

const statusLabels: Record<string, string> = {
  pending:     'Awaiting AI Review',
  reviewed:    'AI Classified',
  assigned:    'Crew Assigned',
  in_progress: 'Work in Progress',
  resolved:    'Resolved',
}

const STEPS = ['pending', 'reviewed', 'assigned', 'in_progress', 'resolved'] as const

export default function StatusPage() {
  const [id,      setId]      = useState('')
  const [report,  setReport]  = useState<Report | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    if (!id.trim()) return
    setError(null); setReport(null); setLoading(true)
    try {
      const { data } = await api.get(`/api/reports/${id}`)
      setReport(data)
    } catch {
      setError('Report not found — check your tracking ID.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <SmartCityHero />

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-0.5 h-5 rounded-full bg-violet" style={{ boxShadow: '0 0 8px #818cf8' }} />
          <span className="text-violet text-xs font-bold tracking-[0.18em] uppercase glow-violet">Track Report</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-white">Track Your Report</h1>
        <p className="text-slate-400 text-sm mt-1">Enter the tracking ID from your submission.</p>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-5 mb-6">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Tracking ID
        </label>
        <div className="flex gap-3">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder="e.g. 42"
            className="flex-1 px-4 py-3 bg-void border border-mid rounded-xl text-white placeholder-slate-600 focus:border-violet/50 focus:outline-none font-mono text-sm transition"
          />
          <button onClick={lookup} disabled={loading}
            className="px-6 py-3 rounded-xl border border-violet/30 text-violet bg-violet/10 hover:bg-violet/20 font-semibold disabled:opacity-40 transition text-sm">
            {loading ? '…' : 'Look up →'}
          </button>
        </div>
        {error && <p className="text-rose text-xs mt-3">{error}</p>}
      </div>

      {report && (
        <div className="glass rounded-2xl p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Report <span className="font-mono text-sky">#{report.id}</span>
              </div>
              <div className="font-display text-2xl font-bold text-white">
                {report.category || 'Unclassified'}
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold border"
              style={{
                color:       statusColor[report.status] ?? '#94a3b8',
                borderColor: (statusColor[report.status] ?? '#94a3b8') + '44',
                background:  (statusColor[report.status] ?? '#94a3b8') + '18',
              }}>
              {statusLabels[report.status] ?? report.status}
            </span>
          </div>

          {/* Progress stepper */}
          <div className="mb-5">
            <div className="flex items-center">
              {STEPS.map((s, i) => {
                const cur  = STEPS.indexOf(report.status as typeof STEPS[number])
                const done   = i <= cur
                const active = i === cur
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        active ? 'border-sky   bg-sky/20'  :
                        done   ? 'border-mint  bg-mint/20' :
                                 'border-mid   bg-transparent'
                      }`}
                      style={active ? { boxShadow: '0 0 14px rgba(56,189,248,0.55)' } : undefined}
                    >
                      {done && !active && (
                        <svg className="w-3.5 h-3.5 text-mint" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd" />
                        </svg>
                      )}
                      {active && <span className="w-2.5 h-2.5 rounded-full bg-sky animate-pulse" />}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 ${i < cur ? 'bg-mint/40' : 'bg-mid'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              {STEPS.map(s => (
                <span key={s}
                  className={`text-[9px] uppercase tracking-wide ${
                    s === report.status ? 'text-sky glow-sky' : 'text-slate-600'
                  }`}
                  style={{ width: '18%', textAlign: 'center' }}>
                  {s.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* AI confidence */}
          {report.category && report.confidence && (
            <div className="mb-4 p-3 rounded-xl bg-void border border-mid">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">AI Confidence</span>
                <span className="text-xs font-mono font-bold text-sky glow-sky">
                  {(report.confidence * 100).toFixed(1)}%
                  {report.mlMode === 'mock' && (
                    <span className="text-slate-500 ml-1 font-normal">(mock)</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 bg-mid rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${report.confidence * 100}%`,
                    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                    boxShadow: '0 0 10px rgba(56,189,248,0.6)',
                  }} />
              </div>
            </div>
          )}

          <p className="text-sm text-slate-300 mb-3">{report.description}</p>

          <div className="text-xs text-slate-500 font-mono">
            {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)} ·{' '}
            {new Date(report.createdAt).toLocaleString()}
          </div>

          {report.assignedWorker && (
            <div className="mt-3 pt-3 border-t border-mid text-xs text-slate-400">
              Assigned to <span className="text-sky font-semibold">{report.assignedWorker}</span>
              {report.assignedDepartment && <> · {report.assignedDepartment}</>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
