import { supabase } from './supabase'
import { adminApi } from './adminApi'

/**
 * Sign in a user with NIK + password.
 * Internally maps NIK → {NIK}@coin.internal for Supabase Auth.
 */
export async function signIn(nik, password) {
  const email = `${nik}@coin.internal`
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Sign out current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Fetch user profile from public.users by auth UUID.
 * Returns null (and triggers sign-out) if account is inactive.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  if (!data?.is_active) return null
  return data
}

/**
 * Get current Supabase auth session.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Create a new user account via Edge Function (server-side only).
 * Only callable by superadmin.
 */
export async function createUser({ nik, name, role, password }) {
  return adminApi.createUser({ nik, name, role, password })
}

/**
 * Reset a user's password via Edge Function (superadmin only).
 */
export async function resetPassword(userId, newPassword) {
  return adminApi.resetPassword(userId, newPassword)
}

/**
 * Map role to default redirect path.
 */
export function getRoleRedirect(role) {
  switch (role) {
    case 'superadmin': return '/superadmin'
    case 'admin':      return '/dashboard'
    case 'manager':    return '/dashboard'
    case 'kasir':      return '/app'
    case 'driver':     return '/login'
    default:           return '/login'
  }
}
