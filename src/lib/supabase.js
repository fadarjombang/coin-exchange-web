import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey  = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Regular client — used for all normal authenticated operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Admin client — service role key, bypasses RLS.
// ONLY used in super admin context (create/delete auth users).
// Never expose this in frontend logic accessible by normal users.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
