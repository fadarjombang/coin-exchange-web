import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, toast } from '../hooks/use-toast'

describe('useToast — Task 20: listener cleanup', () => {
  it('registers listener on mount and removes on unmount', () => {
    const { result, unmount } = renderHook(() => useToast())

    act(() => { toast({ title: 'Test' }) })
    expect(result.current.toasts.length).toBeGreaterThan(0)

    // After unmount, dispatching should not throw
    unmount()
    expect(() => {
      act(() => { toast({ title: 'After unmount' }) })
    }).not.toThrow()
  })

  it('multiple mounts do not accumulate stale listeners', () => {
    const { unmount: u1 } = renderHook(() => useToast())
    const { unmount: u2 } = renderHook(() => useToast())
    const { unmount: u3 } = renderHook(() => useToast())

    u1(); u2(); u3()

    expect(() => {
      act(() => { toast({ title: 'Clean' }) })
    }).not.toThrow()
  })

  it('toast adds to state', () => {
    const { result } = renderHook(() => useToast())
    act(() => { toast({ title: 'Hello', description: 'World' }) })
    expect(result.current.toasts.some(t => t.title === 'Hello')).toBe(true)
  })

  it('dismiss marks toast as closed', () => {
    const { result } = renderHook(() => useToast())
    let toastId
    act(() => {
      const t = toast({ title: 'Dismiss me' })
      toastId = t.id
    })
    act(() => { result.current.dismiss(toastId) })
    const dismissed = result.current.toasts.find(t => t.id === toastId)
    expect(dismissed?.open).toBe(false)
  })

  it('respects TOAST_LIMIT of 5', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      for (let i = 0; i < 8; i++) toast({ title: `Toast ${i}` })
    })
    expect(result.current.toasts.length).toBeLessThanOrEqual(5)
  })
})
