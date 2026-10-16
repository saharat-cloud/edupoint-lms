import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  role: UserRole | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) { console.error('Profile fetch error:', error); return null }
    return data as Profile
  }

  async function refreshProfile() {
    if (!user) return
    const p = await fetchProfile(user.id)
    if (p) setProfile(p)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session: s } }) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          try {
            const p = await fetchProfile(s.user.id)
            setProfile(p)
          } catch (err) {
            console.error('Failed to fetch profile during getSession', err)
          }
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('getSession error:', err)
        setIsLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        try {
          setSession(s)
          setUser(s?.user ?? null)
          if (s?.user) {
            const p = await fetchProfile(s.user.id)
            setProfile(p)
          } else {
            setProfile(null)
          }
        } catch (err) {
          console.error('Auth state change error:', err)
        } finally {
          setIsLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      role: profile?.role ?? null,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
