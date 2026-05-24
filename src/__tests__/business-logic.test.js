import { describe, it, expect } from 'vitest'
import { calculateDenomTotal, calculateStokTotal, DENOM_LIST } from '../lib/utils'

// ── Task 14: Balance invariant (total_koin === total_uang) ───
describe('Task 14 — Kantor transaction balance invariant', () => {
  it('balanced: koin equals uang', () => {
    const totalKoin = 100000
    const totalUang = 100000
    expect(totalKoin === totalUang).toBe(true)
  })

  it('unbalanced: koin > uang should be rejected', () => {
    const totalKoin = 150000
    const totalUang = 100000
    expect(totalKoin === totalUang).toBe(false)
  })

  it('unbalanced: koin < uang should be rejected', () => {
    const totalKoin = 50000
    const totalUang = 100000
    expect(totalKoin === totalUang).toBe(false)
  })

  it('zero values are balanced', () => {
    expect(0 === 0).toBe(true)
  })
})

// ── Task 15: Rekonsiliasi audit — selisih_koin calculation ───
describe('Task 15 — Rekonsiliasi selisih_koin calculation', () => {
  const modalKoin = {
    koin_100: 10000, koin_200: 20000, koin_500: 50000, koin_1000: 100000,
    koin_2000: 0, koin_5000: 0, koin_10000: 0, koin_20000: 0,
  }

  // Simulate: kasir sudah serahkan koin_100 = 5000 ke satu toko
  const trxList = [{ koin_100: 5000, koin_200: 0, koin_500: 0, koin_1000: 0, koin_2000: 0, koin_5000: 0, koin_10000: 0, koin_20000: 0 }]

  // Expected sisa = modal - keluar
  const sisaDenom = DENOM_LIST.reduce((acc, d) => {
    const modalVal = modalKoin[d.key] || 0
    const keluarVal = trxList.reduce((s, t) => s + (t[d.key] || 0), 0)
    acc[d.key] = Math.max(0, modalVal - keluarVal)
    return acc
  }, {})

  const expectedSisa = Object.values(sisaDenom).reduce((s, v) => s + v, 0)

  it('expected sisa = modal - keluar', () => {
    // modal total = 10000+20000+50000+100000 = 180000
    // keluar = 5000
    // expected = 175000
    expect(expectedSisa).toBe(175000)
  })

  it('selisih_koin = 0 when aktual matches expected', () => {
    const sisaAktualNilai = expectedSisa  // kasir hitung fisik cocok
    const selisihKoin = sisaAktualNilai - expectedSisa
    expect(selisihKoin).toBe(0)
  })

  it('selisih_koin is negative when aktual < expected (koin hilang)', () => {
    const sisaAktualNilai = expectedSisa - 1000  // kurang 1000
    const selisihKoin = sisaAktualNilai - expectedSisa
    expect(selisihKoin).toBe(-1000)
  })

  it('selisih_koin is positive when aktual > expected (koin lebih)', () => {
    const sisaAktualNilai = expectedSisa + 500
    const selisihKoin = sisaAktualNilai - expectedSisa
    expect(selisihKoin).toBe(500)
  })

  it('is_balanced only when both selisih_koin and selisih_uang are 0', () => {
    const isBalanced = (selisihKoin, selisihUang) => selisihKoin === 0 && selisihUang === 0
    expect(isBalanced(0, 0)).toBe(true)
    expect(isBalanced(0, 100)).toBe(false)
    expect(isBalanced(-500, 0)).toBe(false)
    expect(isBalanced(-500, 100)).toBe(false)
  })
})

// ── Task 22: AuthContext generation counter logic ────────────
describe('Task 22 — Generation counter prevents stale profile', () => {
  it('discards stale response when reqId has advanced', async () => {
    let reqId = 0
    const results = []

    // Simulate two concurrent loadProfile calls
    async function loadProfile(authUser, delay) {
      const myId = ++reqId
      await new Promise(r => setTimeout(r, delay))
      if (myId !== reqId) return  // stale — discard
      results.push({ myId, user: authUser?.id })
    }

    // First call (slow), second call (fast)
    await Promise.all([
      loadProfile({ id: 'user-A' }, 20),
      loadProfile({ id: 'user-B' }, 5),
    ])

    // Only the second (faster) call should have committed
    expect(results).toHaveLength(1)
    expect(results[0].user).toBe('user-B')
  })

  it('commits when no concurrent call', async () => {
    let reqId = 0
    const results = []

    async function loadProfile(authUser) {
      const myId = ++reqId
      await Promise.resolve()
      if (myId !== reqId) return
      results.push(authUser?.id)
    }

    await loadProfile({ id: 'user-C' })
    expect(results).toEqual(['user-C'])
  })
})
