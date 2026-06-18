import { createContext, useContext, useState, ReactNode } from 'react'

export type AuthUser = {
  username: string
  name: string
  role: 'admin' | 'worker'
  token: string
}

export type RegisteredEntry = { user: AuthUser; password: string }

export function getRegisteredUsers(): Record<string, RegisteredEntry> {
  try { return JSON.parse(localStorage.getItem('sc_registered') || '{}') }
  catch { return {} }
}

type AuthCtx = {
  user: AuthUser | null
  login:    (u: AuthUser) => void
  logout:   () => void
  register: (u: AuthUser, password: string) => void
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('sc_user')
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  const login = (u: AuthUser) => {
    localStorage.setItem('sc_user', JSON.stringify(u))
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('sc_user')
    setUser(null)
  }

  const register = (u: AuthUser, password: string) => {
    const stored = getRegisteredUsers()
    stored[u.username] = { user: u, password }
    localStorage.setItem('sc_registered', JSON.stringify(stored))
    login(u)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
