import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

/**
 * Hook untuk mengakses auth context.
 * Dipisahkan dari AuthContext.jsx agar Vite Fast Refresh
 * tidak menganggap file komponen (AuthProvider) sebagai "incompatible".
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
