import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, signIn as authSignIn, signOut as authSignOut } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  // Fetch profile after auth user is known — generation counter prevents stale updates
  const loadProfile = useCallback(async (authUser) => {
    const myId = ++reqId.current
    if (!authUser) {
      if (myId === reqId.current) setProfile(null)
      return
    }
    try {
      const p = await getProfile(authUser.id)
      if (myId !== reqId.current) return  // stale, discard
      if (!p) {
        // Account deactivated — force sign out
        await authSignOut()
        setProfile(null)
        return
      }
      setProfile(p)
    } catch (err) {
      console.error('Failed to load profile:', err)
      if (myId === reqId.current) setProfile(null)
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
