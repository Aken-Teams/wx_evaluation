import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../contexts/AuthContext'

const RequireRole = ({ roles, children }: { roles: UserRole[]; children: ReactNode }) => {
  const { token, role } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default RequireRole


