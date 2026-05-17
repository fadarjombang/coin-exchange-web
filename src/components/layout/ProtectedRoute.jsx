import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Loader2 } from 'lucide-react'

function PageLoader({ message = 'Memeriksa sesi...' }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
      <Loader2 className="animate-spin w-8 h-8 text-primary mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/**
 * Route guard that enforces authentication and role restrictions.
 * @param {string[]} allowedRoles - Roles allowed to access this route
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader message="Memeriksa sesi..." />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const roles = Array.isArray(role) ? role : [role]
  
  if (allowedRoles.length > 0 && !allowedRoles.some(r => roles.includes(r))) {
    // Redirect to the correct area for the user's highest priority role
    if (roles.includes('superadmin')) return <Navigate to="/superadmin" replace />
    if (roles.includes('admin') || roles.includes('manager')) return <Navigate to="/dashboard" replace />
    if (roles.includes('kasir')) return <Navigate to="/app" replace />
    if (roles.includes('driver')) return <Navigate to="/login" replace />
    
    return <Navigate to="/login" replace />
  }

  return children
}
