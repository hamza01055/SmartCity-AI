import { useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import ReportPage     from './pages/ReportPage'
import StatusPage     from './pages/StatusPage'
import DashboardPage  from './pages/DashboardPage'
import FieldWorkerPage from './pages/FieldWorkerPage'
import AnalyticsPage  from './pages/AnalyticsPage'

const NAV = [
  { to: '/',          label: 'Report'       },
  { to: '/status',    label: 'Track'        },
  { to: '/worker',    label: 'Field Worker' },
  { to: '/admin',     label: 'Admin'        },
  { to: '/analytics', label: 'Analytics'    },
]

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

function AppShell() {
  const { user, logout } = useAuth()
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')

  // Show auth pages if not logged in
  if (!user) {
    if (authPage === 'register') {
      return <RegisterPage onGoToLogin={() => setAuthPage('login')} />
    }
    return <LoginPage onGoToRegister={() => setAuthPage('register')} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-dark border-b border-sky/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-sky/20 animate-ping" />
              <span className="relative h-4 w-4 rounded-full bg-sky"
                style={{ boxShadow: '0 0 14px #38bdf8' }} />
            </span>
            <span className="font-display text-lg font-bold text-white tracking-tight">
              Smart<span className="text-gradient">City</span>
            </span>
          </Link>

          {/* Nav tabs */}
          <nav className="flex gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky/15 text-sky border border-sky/25 glow-sky'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >{label}</NavLink>
            ))}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            {/* Live dot */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse"
                style={{ boxShadow: '0 0 6px #34d399' }} />
              Live
            </div>

            {/* Role badge */}
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={user.role === 'admin'
                ? { background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }
                : { background: 'rgba(52,211,153,0.12)',  color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
              }>
              {user.role === 'admin' ? '⚙ Admin' : '👷 Worker'}
            </span>

            {/* Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-mid">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: user.role === 'admin' ? 'rgba(129,140,248,0.2)' : 'rgba(52,211,153,0.15)',
                  color:      user.role === 'admin' ? '#818cf8' : '#34d399',
                  border:     user.role === 'admin' ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(52,211,153,0.3)',
                }}>
                {user.name[0].toUpperCase()}
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-300 max-w-[100px] truncate">
                {user.name}
              </span>
            </div>

            {/* Logout */}
            <button onClick={logout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-rose hover:bg-rose/10 border border-transparent hover:border-rose/20 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Pages */}
      <main className="flex-1">
        <Routes>
          <Route path="/"          element={<ReportPage />}      />
          <Route path="/status"    element={<StatusPage />}      />
          <Route path="/admin"     element={<DashboardPage />}   />
          <Route path="/worker"    element={<FieldWorkerPage />} />
          <Route path="/analytics" element={<AnalyticsPage />}  />
        </Routes>
      </main>

      <footer className="border-t border-sky/10 py-3 text-center text-xs text-slate-600">
        SmartCity &nbsp;·&nbsp; React · Express · FastAPI · YOLOv8
      </footer>
    </div>
  )
}
