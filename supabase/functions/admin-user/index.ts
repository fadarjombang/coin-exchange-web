// Supabase Edge Function: admin-user
// Deploy: supabase functions deploy admin-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  // Allow any localhost port, 127.0.0.1, or vercel.app domain
  const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const allowed = (isLocalhost || origin.endsWith('.vercel.app'))
    ? origin
    : 'https://coin-management.vercel.app'

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.is_active) {
      return new Response(JSON.stringify({ error: 'Account deactivated' }), { status: 403, headers: corsHeaders })
    }

    const callerRoles: string[] = Array.isArray(callerProfile?.role)
      ? callerProfile.role
      : [callerProfile?.role]

    const isSuperadmin = callerRoles.includes('superadmin')
    const isManager    = callerRoles.includes('manager')

    const body = await req.json()
    const { action, ...payload } = body

    const superadminOnlyActions = ['create-user', 'reset-password', 'update-user', 'delete-user']
    const managerActions        = ['approve-session', 'close-session']

    if (superadminOnlyActions.includes(action) && !isSuperadmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: superadmin only' }), { status: 403, headers: corsHeaders })
    }
    if (managerActions.includes(action) && !isManager) {
      return new Response(JSON.stringify({ error: 'Forbidden: manager required' }), { status: 403, headers: corsHeaders })
    }

    // ── create-user ──────────────────────────────────────────
    if (action === 'create-user') {
      const { nik, name, role, password, foto_profil } = payload
      const email = `${nik}@coin.internal`

      const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (createErr) throw createErr

      const { data, error: dbErr } = await supabaseAdmin
        .from('users')
        .insert({ id: authData.user.id, nik, name, role, foto_profil: foto_profil || null })
        .select()
        .single()
      if (dbErr) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw dbErr
      }
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── reset-password ───────────────────────────────────────
    if (action === 'reset-password') {
      const { userId, newPassword } = payload
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── update-user ──────────────────────────────────────────
    if (action === 'update-user') {
      const { userId, name, role, is_active, foto_profil, newPassword } = payload
      const { error: dbErr } = await supabaseAdmin
        .from('users')
        .update({ name, role, is_active, foto_profil })
        .eq('id', userId)
      if (dbErr) throw dbErr

      if (newPassword) {
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
        if (pwErr) throw pwErr
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── delete-user ──────────────────────────────────────────
    if (action === 'delete-user') {
      const { userId } = payload
      await supabaseAdmin.from('users').update({ is_active: false }).eq('id', userId)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── approve-session ──────────────────────────────────────
    if (action === 'approve-session') {
      const { sesiId, approvedBy, catatan } = payload
      const { data, error } = await supabaseAdmin.rpc('approve_sesi_transaction', {
        p_sesi_id: sesiId, p_approved_by: approvedBy, p_catatan: catatan || null,
      })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, ...data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── close-session ────────────────────────────────────────
    if (action === 'close-session') {
      const { sesiId, closedBy, catatan } = payload
      const { data, error } = await supabaseAdmin.rpc('close_sesi_transaction', {
        p_sesi_id: sesiId, p_closed_by: closedBy, p_catatan: catatan || null,
      })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, ...data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
