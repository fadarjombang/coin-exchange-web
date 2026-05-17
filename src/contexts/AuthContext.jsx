import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, signIn as authSignIn, signOut as authSignOut } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users profile (with role)
  const [loading, setLoading] = useState(true)   // initial session check

  // Fetch profile after auth user is known
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null)
      return
    }
    try {
      const p = await getProfile(authUser.id)
      setProfile(p)
    } catch (err) {
      console.error('Failed to load profile:', err)
      setProfile(null)
    }
  }, [])

  // On mount — check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  /**
   * Sign in with NIK + password.
   */
  const signIn = useCallback(async (nik, password) => {
    const data = await authSignIn(nik, password)
    // profile will be set by onAuthStateChange listener
    return data
  }, [])

  /**
   * Sign out.
   */
  const signOut = useCallback(async () => {
    await authSignOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    role: profile?.role ?? null,
    isAuthenticated: !!user && !!profile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context. Must be used inside AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
