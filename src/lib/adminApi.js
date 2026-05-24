import { supabase } from './supabase'

/**
 * Call the admin-user Edge Function.
 * Replaces direct supabaseAdmin usage in frontend.
 * Service role key stays server-side only.
 */
async function callAdminFunction(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Tidak terautentikasi')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    }
  )

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Gagal memanggil admin function')
  return json
}

export const adminApi = {
  createUser: (payload) => callAdminFunction('create-user', payload),
  resetPassword: (userId, newPassword) => callAdminFunction('reset-password', { userId, newPassword }),
  updateUser: (userId, payload) => callAdminFunction('update-user', { userId, ...payload }),
  deleteUser: (userId) => callAdminFunction('delete-user', { userId }),
  approveSession: (sesiId, approvedBy, catatan) => callAdminFunction('approve-session', { sesiId, approvedBy, catatan }),
  closeSession: (sesiId, closedBy, catatan) => callAdminFunction('close-session', { sesiId, closedBy, catatan }),
}
