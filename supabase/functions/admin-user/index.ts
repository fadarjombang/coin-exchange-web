// Supabase Edge Function: admin-user
// Handles create-user and reset-password operations that require service role key.
// Deploy: supabase functions deploy admin-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated and is superadmin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    )

    // Verify caller's JWT and role
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
    const callerRoles = Array.isArray(callerProfile?.role) ? callerProfile.role : [callerProfile?.role]
    if (!callerRoles.includes('superadmin')) {
      return new Response(JSON.stringify({ error: 'Forbidden: superadmin only' }), { status: 403, headers: corsHeaders })
    }

    const { action, ...payload } = await req.json()

    if (action === 'create-user') {
      const { nik, name, role, password, foto_profil } = payload
      const email = `${nik}@coin.internal`

      const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (createErr) throw createErr

      const { data, error: dbErr } = await supabaseAdmin.from('users')
        .insert({ id: authData.user.id, nik, name, role, foto_profil: foto_profil || null })
        .select().single()
      if (dbErr) throw dbErr

      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset-password') {
      const { userId, newPassword } = payload
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update-user') {
      const { userId, name, role, is_active, foto_profil, newPassword } = payload
      const { error: dbErr } = await supabaseAdmin.from('users')
        .update({ name, role, is_active, foto_profil })
        .eq('id', userId)
      if (dbErr) throw dbErr

      if (newPassword) {
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
        if (pwErr) throw pwErr
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'approve-session') {
      // Atomic: validate stock, deduct, update session status
      const { sesiId, modalKoin, currentStokId, updates, logData, approvedBy, catatan } = payload

      const { error: stokErr } = await supabaseAdmin.from('stok_gudang')
        .update({ ...updates, updated_by: approvedBy, last_updated: new Date().toISOString() })
        .eq('id', currentStokId)
      if (stokErr) throw stokErr

      await supabaseAdmin.from('stok_gudang_log').insert(logData)

      const { error: sesiErr } = await supabaseAdmin.from('sesi_tugas').update({
        status: 'active', approved_by: approvedBy,
        approved_at: new Date().toISOString(), catatan_approval: catatan
      }).eq('id', sesiId)
      if (sesiErr) throw sesiErr

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete-user') {
      const { userId } = payload
      // Deactivate in public.users first (preserve FK references)
      await supabaseAdmin.from('users').update({ is_active: false }).eq('id', userId)
      // Delete from auth
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'close-session') {
      const { sesiId, currentStokId, updates, logData, closedBy, catatan } = payload

      const { error: stokErr } = await supabaseAdmin.from('stok_gudang')
        .update({ ...updates, updated_by: closedBy, last_updated: new Date().toISOString() })
        .eq('id', currentStokId)
      if (stokErr) throw stokErr

      await supabaseAdmin.from('stok_gudang_log').insert(logData)

      const { error: sesiErr } = await supabaseAdmin.from('sesi_tugas').update({
        status: 'closed', closed_by: closedBy,
        closed_at: new Date().toISOString(), catatan_close: catatan
      }).eq('id', sesiId)
      if (sesiErr) throw sesiErr

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
