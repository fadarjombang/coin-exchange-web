import { createContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, signIn as authSignIn, signOut as authSignOut } from '../lib/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  useEffect(() => {
    // Fetch profile di luar onAuthStateChange callback agar tidak deadlock
    // dengan internal auth lock milik Supabase JS client.
    async function handleSession(session) {
      const myId = ++reqId.current

      if (!session?.user) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(session.user)
      try {
        const p = await getProfile(session.user.id)
        if (myId !== reqId.current) return   // stale, discard
        if (!p) {
          await authSignOut()
          setUser(null)
          setProfile(null)
        } else {
          setProfile(p)
        }
      } catch (err) {
        console.error('getProfile error:', err)
        if (myId === reqId.current) setProfile(null)
      } finally {
        if (myId === reqId.current) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // KRUSIAL: defer dengan setTimeout(0) agar auth lock dilepas
        // sebelum kita memanggil supabase.from() di handleSession.
        // Tanpa ini, getProfile() akan deadlock menunggu lock yang sama.
        setTimeout(() => handleSession(session), 0)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn  = useCallback((nik, password) => authSignIn(nik, password), [])
  const signOut = useCallback(async () => {
    await authSignOut()
    setUser(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signIn, signOut,
      role: profile?.role ?? null,
      isAuthenticated: !!user && !!profile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
