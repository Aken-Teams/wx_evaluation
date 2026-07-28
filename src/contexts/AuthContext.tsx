import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'

export type UserRole = 'viewer' | 'quality_yearly_editor' | 'purchase_editor' | 'admin'

interface AuthContextType {
  role: UserRole
  username: string | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  canEditQuality: boolean
  canEditYearly: boolean
  canEditPurchase: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 同步從 localStorage 初始化，避免首次渲染因為 token 為空而被導回登入頁
  const [role, setRole] = useState<UserRole>(() => {
    try {
      return (localStorage.getItem('auth.role') as UserRole) || 'viewer'
    } catch {
      return 'viewer'
    }
  })
  const [username, setUsername] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth.username')
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth.token')
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('auth.role')
      const savedUser = localStorage.getItem('auth.username')
      const savedToken = localStorage.getItem('auth.token')
      if (savedRole) setRole(savedRole as UserRole)
      if (savedUser) setUsername(savedUser)
      if (savedToken) setToken(savedToken)
    } catch {}
  }, [])

  // 監聽 API 層回報的 401，同步清除 React state，讓 RequireAuth 導回登入頁
  useEffect(() => {
    const handler = () => {
      setToken(null)
      setUsername(null)
      setRole('viewer')
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('auth.role', role) } catch {}
  }, [role])

  useEffect(() => {
    try {
      if (username) localStorage.setItem('auth.username', username); else localStorage.removeItem('auth.username')
      if (token) localStorage.setItem('auth.token', token); else localStorage.removeItem('auth.token')
    } catch {}
  }, [username, token])

  const canEditQuality = useMemo(() => role === 'quality_yearly_editor' || role === 'admin', [role])
  const canEditYearly = useMemo(() => role === 'quality_yearly_editor' || role === 'admin', [role])
  const canEditPurchase = useMemo(() => role === 'purchase_editor' || role === 'admin', [role])

  async function login(usernameInput: string, password: string) {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: usernameInput, password }) })
    if (!res.ok) throw new Error('登入失敗')
    const data = await res.json()
    setToken(data.token)
    setUsername(data.username)
    setRole(data.role as UserRole)
  }

  function logout() {
    setToken(null)
    setUsername(null)
    setRole('viewer')
  }

  const value: AuthContextType = {
    role,
    username,
    token,
    login,
    logout,
    canEditQuality,
    canEditYearly,
    canEditPurchase,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


