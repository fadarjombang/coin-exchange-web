import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing auth
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}))

import { getProfile, signIn, signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'

beforeEach(() => vi.clearAllMocks())

describe('getProfile — Task 13: is_active enforcement', () => {
  it('returns profile when is_active=true', async () => {
    const mockProfile = { id: 'uuid-1', name: 'Test', role: ['kasir'], is_active: true }
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    const result = await getProfile('uuid-1')
    expect(result).toEqual(mockProfile)
  })

  it('returns null when is_active=false', async () => {
    const mockProfile = { id: 'uuid-2', name: 'Inactive', role: ['kasir'], is_active: false }
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    const result = await getProfile('uuid-2')
    expect(result).toBeNull()
  })

  it('throws when supabase returns error', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    })

    await expect(getProfile('uuid-3')).rejects.toThrow('DB error')
  })
})

describe('signIn', () => {
  it('maps NIK to email format', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })
    await signIn('12345678', 'password')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: '12345678@coin.internal',
      password: 'password',
    })
  })

  it('throws on auth error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: new Error('Invalid credentials') })
    await expect(signIn('12345678', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(supabase.auth.signOut).toHaveBeenCalledOnce()
  })

  it('throws on error', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: new Error('Sign out failed') })
    await expect(signOut()).rejects.toThrow('Sign out failed')
  })
})
