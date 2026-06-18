import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth, AuthUser, getRegisteredUsers } from '../contexts/AuthContext'

interface Props {
  onGoToRegister: () => void
}

// Built-in demo credentials — work even when backend is offline
const LOCAL_USERS: Record<string, AuthUser> = {
  admin:  { username: 'admin',  name: 'Admin User',      role: 'admin',  token: 'local-admin'  },
  hamza:  { username: 'hamza',  name: 'Hamza',           role: 'admin',  token: 'local-hamza'  },
  ahmed:  { username: 'ahmed',  name: 'Ahmed Khan',      role: 'worker', token: 'local-ahmed'  },
  sara:   { username: 'sara',   name: 'Sara Malik',      role: 'worker', token: 'local-sara'   },
  usman:  { username: 'usman',  name: 'Usman Ali',       role: 'worker', token: 'local-usman'  },
  fatima: { username: 'fatima', name: 'Fatima Raza',     role: 'worker', token: 'local-fatima' },
  bilal:  { username: 'bilal',  name: 'Bilal Chaudhry',  role: 'worker', token: 'local-bilal'  },
}
const LOCAL_PASSWORDS: Record<string, string> = {
  admin: 'admin123', hamza: 'hamza123', ahmed: 'ahmed123',
  sara: 'sara123', usman: 'usman123', fatima: 'fatima123', bilal: 'bilal123',
}

export default function LoginPage({ onGoToRegister }: Props) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password')
      return
    }
    setError(null)
    setLoading(true)

    const key = username.trim().toLowerCase()

    // 1. Try backend first
    try {
      const { data } = await api.post('/api/auth/login', { username: key, password })
      login(data as AuthUser)
      return
    } catch {
      // backend unavailable or returned 401 — fall through to local check
    }

    // 2. Check localStorage-registered users
    await new Promise(r => setTimeout(r, 300))
    const registered = getRegisteredUsers()
    if (registered[key] && registered[key].password === password) {
      login(registered[key].user)
      return
    }

    // 3. Built-in credential fallback
    const builtIn = LOCAL_USERS[key]
    if (builtIn && LOCAL_PASSWORDS[key] === password) {
      login(builtIn)
    } else {
      setError('Invalid username or password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] px-14 py-12"
        style={{
          background: 'linear-gradient(160deg, rgba(56,189,248,0.08) 0%, rgba(129,140,248,0.06) 100%)',
          borderRight: '1px solid rgba(56,189,248,0.1)',
        }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-sky/20 animate-ping" />
            <span className="relative h-5 w-5 rounded-full bg-sky" style={{ boxShadow: '0 0 16px #38bdf8' }} />
          </span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">
            Smart<span className="text-gradient">City</span>
          </span>
        </div>

        {/* Central illustration area */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-24 h-24 rounded-3xl bg-sky/10 border border-sky/20 flex items-center justify-center mb-8"
            style={{ boxShadow: '0 0 40px rgba(56,189,248,0.15)' }}>
            <svg className="w-12 h-12 text-sky" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="font-display text-3xl font-bold text-white mb-4 leading-tight">
            Intelligent City<br />Management Platform
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            AI-powered issue detection, real-time monitoring, and smart dispatch — keeping the city running at its best.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { icon: '🤖', label: 'YOLOv8 AI' },
              { icon: '📍', label: 'Live Map'  },
              { icon: '⚡', label: 'Real-time' },
              { icon: '📊', label: 'Analytics' },
            ].map(f => (
              <span key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 text-center">
          React · Express · FastAPI · YOLOv8 · PostgreSQL
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-sky/20 animate-ping" />
              <span className="relative h-4 w-4 rounded-full bg-sky" style={{ boxShadow: '0 0 14px #38bdf8' }} />
            </span>
            <span className="font-display text-xl font-bold text-white">
              Smart<span className="text-gradient">City</span>
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-8">
            Don't have an account?{' '}
            <button onClick={onGoToRegister}
              className="text-sky hover:text-sky/80 font-medium transition hover:underline">
              Create one
            </button>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username" autoComplete="username"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-sky/50 focus:outline-none focus:ring-1 focus:ring-sky/25 transition text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-sky/50 focus:outline-none focus:ring-1 focus:ring-sky/25 transition text-sm"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose/10 border border-rose/25 text-rose text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm font-bold tracking-wide mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Create account CTA */}
          <div className="mt-5 rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
            <div className="w-10 h-10 rounded-xl bg-mint/10 border border-mint/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-mint">New to SmartCity?</p>
              <p className="text-xs text-slate-500 mt-0.5">Register to report issues and track your submissions.</p>
            </div>
            <button onClick={onGoToRegister}
              className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border transition"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
              Register →
            </button>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 rounded-2xl p-4"
            style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)' }}>
            <p className="text-xs font-semibold text-sky mb-3 uppercase tracking-widest">Demo Credentials</p>
            <div className="space-y-2">
              {[
                { user: 'admin',  pass: 'admin123',  role: 'Admin',       color: '#818cf8' },
                { user: 'hamza',  pass: 'hamza123',  role: 'Admin',       color: '#818cf8' },
                { user: 'ahmed',  pass: 'ahmed123',  role: 'Field Worker', color: '#34d399' },
              ].map(c => (
                <button key={c.user} type="button"
                  onClick={() => { setUsername(c.user); setPassword(c.pass) }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 transition group">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: c.color + '20', color: c.color }}>
                      {c.user[0].toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">{c.user}</span>
                    <span className="text-xs text-slate-600 font-mono">/ {c.pass}</span>
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: c.color + '15', color: c.color }}>
                    {c.role}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center">Click any row to auto-fill</p>
          </div>
        </div>
      </div>
    </div>
  )
}
