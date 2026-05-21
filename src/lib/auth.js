import { supabase, supabaseAdmin } from './supabase'

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
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
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
 * Create a new user account in Supabase Auth + users table.
 * Only callable by superadmin (uses service role key via supabaseAdmin).
 */
export async function createUser({ nik, name, role, password }) {
  const email = `${nik}@coin.internal`

  // 1. Create auth user via admin client (service role bypasses email confirmation)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) throw authError

  // 2. Insert profile into public.users
  const { data, error } = await supabase
    .from('users')
    .insert({ id: authData.user.id, nik, name, role })
    .select()
    .single()
  if (error) throw error

  return data
}

/**
 * Reset a user's password (superadmin only, uses service role).
 */
export async function resetPassword(userId, newPassword) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (error) throw error
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
