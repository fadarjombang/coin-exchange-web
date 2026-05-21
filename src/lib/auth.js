import { supabase } from './supabase'
import { adminApi } from './adminApi'

export async function signIn(nik, password) {
  const email = `${nik}@coin.internal`
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function createUser(payload) {
  return adminApi.createUser(payload)
}

export async function resetPassword(userId, newPassword) {
  return adminApi.resetPassword(userId, newPassword)
}

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
