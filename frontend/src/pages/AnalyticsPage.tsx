import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { api, AnalyticsData, categoryColor, statusColor } from '../lib/api'
import SmartCityHero from '../components/SmartCityHero'

export default function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = async () => {
    try {
      const [aRes, rRes] = await Promise.all([
        api.get('/api/analytics'),
        api.get('/api/reports'),
      ])
      setData(aRes.data)
      setReports(rRes.data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <span className="w-3 h-3 rounded-full bg-sky animate-ping" />
          Loading analytics…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 text-center max-w-sm w-full"
          style={{ border: '1px solid rgba(248,113,113,0.25)' }}>
          <div className="w-12 h-12 rounded-full bg-rose/10 border border-rose/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold text-white mb-1">Analytics Unavailable</h2>
          <p className="text-slate-400 text-sm mb-5">{error || 'Could not load analytics data.'}</p>
          <button onClick={load}
            className="px-5 py-2 rounded-xl border border-sky/30 text-sky hover:bg-sky/10 transition text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const totals = data.totals
  const total  = Math.max(Number(totals.total), 1)
  const resolutionRate = Math.round((Number(totals.resolved) / total) * 100)

  const statusBreakdown = [
    { label: 'Pending',     value: Number(totals.pending),     color: statusColor.pending     },
    { label: 'Reviewed',    value: Number(totals.reviewed),    color: statusColor.reviewed    },
    { label: 'Assigned',    value: Number(totals.assigned),    color: statusColor.assigned    },
    { label: 'Resolved',    value: Number(totals.resolved),    color: statusColor.resolved    },
  ]

  const trendMax = Math.max(...data.trend.map(t => Number(t.count)), 1)

  const center: [number, number] = reports.length
    ? [reports.reduce((s: number, r: any) => s + r.latitude,  0) / reports.length,
       reports.reduce((s: number, r: any) => s + r.longitude, 0) / reports.length]
    : [31.45, 73.13]

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <SmartCityHero />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-0.5 h-5 rounded-full bg-violet" style={{ boxShadow: '0 0 8px #818cf8' }} />
            <span className="text-violet text-xs font-bold tracking-[0.18em] uppercase glow-violet">Insights</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">City-wide issue detection metrics · auto-refreshes every 15s</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPI label="Total Reports"   value={totals.total}      color="#818cf8" sub="all time" />
          <KPI label="Resolution Rate" value={`${resolutionRate}%`} color="#34d399" sub="of all reports" />
          <KPI label="Avg Resolution"
            value={data.avgResolutionHours != null ? `${data.avgResolutionHours}h` : '—'}
            color="#fbbf24" sub="hours to close" />
          <KPI label="Active"
            value={String(Number(totals.pending) + Number(totals.reviewed) + Number(totals.assigned))}
            color="#f87171" sub="need attention" />
        </div>

        {/* Row 1: Trend + Status breakdown */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          <div className="col-span-2 glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-white mb-4">Reports — last 7 days</h3>
            {data.trend.length > 0 ? (
              <div className="space-y-2.5">
                {data.trend.map(t => {
                  const count = Number(t.count)
                  const pct   = (count / trendMax) * 100
                  return (
                    <div key={t.day} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono w-20 shrink-0">
                        {new Date(t.day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <div className="flex-1 h-5 bg-mid/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                            boxShadow: '0 0 8px rgba(56,189,248,0.35)',
                          }} />
                      </div>
                      <span className="text-xs font-mono text-sky w-5 shrink-0 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty text="No reports in the last 7 days" />
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-white mb-4">Status Breakdown</h3>
            <div className="space-y-3.5">
              {statusBreakdown.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{s.label}</span>
                    <span className="font-mono font-bold" style={{ color: s.color }}>
                      {s.value}
                      <span className="text-slate-600 font-normal ml-1">
                        ({Math.round((s.value / total) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-mid/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Donut-style totals */}
            <div className="mt-5 pt-4 border-t border-mid/50 grid grid-cols-2 gap-2">
              {statusBreakdown.map(s => (
                <div key={s.label} className="rounded-xl p-2.5 text-center"
                  style={{ background: s.color + '12', border: `1px solid ${s.color}30` }}>
                  <div className="font-mono text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Category + AI confidence */}
        {data.byCategory.length > 0 && (
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-semibold text-white mb-4">By Category</h3>
              <div className="space-y-3">
                {data.byCategory.map(c => {
                  const count = Number(c.count)
                  const pct   = (count / total) * 100
                  const color = categoryColor[c.category] ?? '#94a3b8'
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          {c.category}
                        </span>
                        <span className="font-mono font-bold" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-2.5 bg-mid/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-semibold text-white mb-4">AI Confidence by Category</h3>
              <div className="space-y-3">
                {data.byCategory.map(c => {
                  const conf = c.avg_confidence ? Math.round(Number(c.avg_confidence) * 100) : 0
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{c.category}</span>
                        <span className="font-mono font-bold text-violet">{conf}%</span>
                      </div>
                      <div className="h-2.5 bg-mid/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${conf}%`,
                            background: 'linear-gradient(90deg, #818cf8, #38bdf8)',
                            boxShadow: conf > 0 ? '0 0 8px rgba(129,140,248,0.4)' : 'none',
                          }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Worker performance + Map */}
        <div className="grid grid-cols-5 gap-5 mb-5">
          <div className="col-span-2 glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-white mb-4">Worker Performance</h3>
            {data.workerStats.length > 0 ? (
              <div className="space-y-3">
                {data.workerStats.map(w => {
                  const tot  = Number(w.active) + Number(w.completed)
                  const rate = tot > 0 ? Math.round((Number(w.completed) / tot) * 100) : 0
                  return (
                    <div key={w.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium">{w.name}</span>
                        <span className="font-mono">
                          <span className="text-mint">{w.completed}</span>
                          <span className="text-slate-600"> / {tot}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-mid/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${rate}%`, background: '#34d399' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty text="No workers assigned yet" />
            )}
          </div>

          <div className="col-span-3 rounded-2xl overflow-hidden border border-mid/50" style={{ height: 340 }}>
            <div className="glass-dark px-4 py-3 border-b border-mid/40">
              <h3 className="font-display font-semibold text-white text-sm">Issue Heatmap</h3>
            </div>
            <div style={{ height: 'calc(100% - 44px)' }}>
              <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                {reports.map((r: any) => (
                  <CircleMarker key={r.id} center={[r.latitude, r.longitude]} radius={7}
                    pathOptions={{
                      color: r.category ? (categoryColor[r.category] ?? '#94a3b8') : '#94a3b8',
                      fillOpacity: 0.7,
                      weight: 1,
                    }}>
                    <Popup>
                      <div className="text-xs">
                        <div className="font-bold">{r.category || 'Pending'}</div>
                        <div className="text-slate-500 capitalize">{r.status}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Worker leaderboard */}
        {data.workerStats.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-mid/50">
              <h3 className="font-display font-semibold text-white">Worker Leaderboard</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500"
                style={{ background: 'rgba(3,7,18,0.55)' }}>
                <tr>
                  {['#', 'Worker', 'Active', 'Completed', 'Total', 'Completion Rate'].map(h => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.workerStats.map((w, i) => {
                  const tot  = Number(w.active) + Number(w.completed)
                  const rate = tot > 0 ? Math.round((Number(w.completed) / tot) * 100) : 0
                  return (
                    <tr key={w.name} className="border-t border-mid/50 text-slate-300 hover:bg-sky/5 transition">
                      <td className="px-4 py-3 font-mono text-slate-600">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">{w.name}</td>
                      <td className="px-4 py-3 font-mono text-sun">{w.active}</td>
                      <td className="px-4 py-3 font-mono text-mint">{w.completed}</td>
                      <td className="px-4 py-3 font-mono">{tot}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-mid/70 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${rate}%`, background: 'linear-gradient(90deg,#34d399,#38bdf8)' }} />
                          </div>
                          <span className="text-xs font-mono w-9 text-right text-mint">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub: string
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="font-display text-4xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-600 mt-1.5">{sub}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-slate-500 text-sm">{text}</div>
  )
}
