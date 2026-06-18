import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth, getRegisteredUsers, AuthUser } from '../contexts/AuthContext'

interface Props {
  onGoToLogin: () => void
}

export default function RegisterPage({ onGoToLogin }: Props) {
  const { register } = useAuth()
  const [name,     setName]     = useState('')
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [role,     setRole]     = useState<'admin' | 'worker'>('worker')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  const validate = (): string | null => {
    if (!name.trim())     return 'Full name is required'
    if (!username.trim()) return 'Username is required'
    if (username.trim().length < 3) return 'Username must be at least 3 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return 'Username may only contain letters, numbers, and underscores'
    if (password.length < 6)  return 'Password must be at least 6 characters'
    if (password !== confirm)  return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    const key = username.trim().toLowerCase()

    // Check for username collision in built-in + registered users
    const builtIn = ['admin', 'hamza', 'ahmed', 'sara', 'usman', 'fatima', 'bilal']
    if (builtIn.includes(key)) {
      setError('That username is already taken')
      return
    }
    const registered = getRegisteredUsers()
    if (registered[key]) {
      setError('That username is already taken')
      return
    }

    setError(null)
    setLoading(true)

    const newUser: AuthUser = {
      username: key,
      name: name.trim(),
      role,
      token: `local-${key}-${Date.now()}`,
    }

    // Try backend registration first
    try {
      const { data } = await api.post('/api/auth/register', {
        username: key,
        name: name.trim(),
        email: email.trim() || undefined,
        password,
        role,
      })
      register(data as AuthUser, password)
      return
    } catch {
      // backend unavailable — fall back to localStorage
    }

    // Local registration fallback
    await new Promise(r => setTimeout(r, 400))
    register(newUser, password)
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-10 text-center max-w-md w-full"
          style={{ border: '1px solid rgba(52,211,153,0.25)' }}>
          <div className="w-20 h-20 rounded-full bg-mint/10 border border-mint/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">Account Created!</h2>
          <p className="text-slate-400 text-sm">Signing you in automatically…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] px-14 py-12"
        style={{
          background: 'linear-gradient(160deg, rgba(52,211,153,0.07) 0%, rgba(56,189,248,0.05) 100%)',
          borderRight: '1px solid rgba(52,211,153,0.1)',
        }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-mint/20 animate-ping" />
            <span className="relative h-5 w-5 rounded-full bg-mint" style={{ boxShadow: '0 0 16px #34d399' }} />
          </span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">
            Smart<span style={{ background: 'linear-gradient(90deg, #34d399, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>City</span>
          </span>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-24 h-24 rounded-3xl bg-mint/10 border border-mint/20 flex items-center justify-center mb-8"
            style={{ boxShadow: '0 0 40px rgba(52,211,153,0.12)' }}>
            <svg className="w-12 h-12 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="font-display text-3xl font-bold text-white mb-4 leading-tight">
            Join the Smart<br />City Platform
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Create your account to report city issues, track progress, and help keep the city running smoothly.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { icon: '🏙️', label: 'City-wide View' },
              { icon: '📲', label: 'Mobile Ready'   },
              { icon: '🤖', label: 'AI Dispatch'    },
              { icon: '🔔', label: 'Live Updates'   },
            ].map(f => (
              <span key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300"
                style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)' }}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 text-center">
          Already have an account?{' '}
          <button onClick={onGoToLogin} className="text-sky hover:text-sky/80 transition font-medium">
            Sign in
          </button>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-mint/20 animate-ping" />
              <span className="relative h-4 w-4 rounded-full bg-mint" style={{ boxShadow: '0 0 14px #34d399' }} />
            </span>
            <span className="font-display text-xl font-bold text-white">
              Smart<span className="text-gradient">City</span>
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-1">Create account</h1>
          <p className="text-slate-400 text-sm mb-8">
            Already have an account?{' '}
            <button onClick={onGoToLogin} className="text-sky hover:underline font-medium transition">
              Sign in
            </button>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <Field label="Full Name" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/20 transition text-sm"
              />
            </Field>

            {/* Username */}
            <Field label="Username" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/20 transition text-sm"
              />
            </Field>

            {/* Email (optional) */}
            <Field label="Email" optional icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Optional"
                autoComplete="email"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/20 transition text-sm"
              />
            </Field>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['admin', 'worker'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition"
                    style={role === r
                      ? { background: r === 'admin' ? 'rgba(129,140,248,0.15)' : 'rgba(52,211,153,0.12)',
                          border: `1px solid ${r === 'admin' ? 'rgba(129,140,248,0.35)' : 'rgba(52,211,153,0.3)'}`,
                          color: r === 'admin' ? '#818cf8' : '#34d399' }
                      : { background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }
                    }>
                    <span className="text-lg">{r === 'admin' ? '⚙' : '👷'}</span>
                    <div>
                      <div className="text-xs font-semibold capitalize">{r === 'admin' ? 'Admin' : 'Field Worker'}</div>
                      <div className="text-xs opacity-60 mt-0.5">{r === 'admin' ? 'Full access' : 'Task access'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <Field label="Password" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            } extra={
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                {showPw
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>}
              </button>
            }>
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/20 transition text-sm"
              />
            </Field>

            {/* Confirm password */}
            <Field label="Confirm Password" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }>
              <input
                type={showPw ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-void border border-mid text-white placeholder-slate-600 focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/20 transition text-sm"
              />
            </Field>

            {/* Password strength bar */}
            {password.length > 0 && (
              <PasswordStrength password={password} />
            )}

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

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide mt-2 transition"
              style={{
                background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #38bdf8)',
                color: loading ? '#34d399' : '#030712',
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </span>
              ) : 'Create Account →'}
            </button>
          </form>

          <p className="text-xs text-slate-600 text-center mt-6">
            By creating an account you agree to SmartCity's terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function Field({ label, optional, icon, extra, children }: {
  label: string; optional?: boolean; icon: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
        {label}
        {optional && <span className="text-slate-600 normal-case tracking-normal ml-1">(optional)</span>}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        {children}
        {extra}
      </div>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length

  const levels = [
    { label: 'Weak',   color: '#f87171' },
    { label: 'Fair',   color: '#fbbf24' },
    { label: 'Good',   color: '#38bdf8' },
    { label: 'Strong', color: '#34d399' },
  ]
  const { label, color } = levels[Math.max(0, score - 1)]

  return (
    <div>
      <div className="flex gap-1.5 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? color : 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
      <div className="text-xs font-medium" style={{ color }}>{label}</div>
    </div>
  )
}
