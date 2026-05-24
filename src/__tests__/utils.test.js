import { describe, it, expect } from 'vitest'
import {
  formatRupiah,
  formatNumber,
  formatDate,
  calculateDenomTotal,
  calculateStokTotal,
  emptyDenoms,
  emptyAllDenoms,
  allTokoVisited,
  csvCell,
  parseRp,
  DENOM_LIST,
  ALL_DENOM_LIST,
  truncate,
} from '../lib/utils'

// ── formatRupiah ─────────────────────────────────────────────
describe('formatRupiah', () => {
  it('formats zero', () => expect(formatRupiah(0)).toContain('0'))
  it('returns Rp 0 for null', () => expect(formatRupiah(null)).toBe('Rp 0'))
  it('returns Rp 0 for undefined', () => expect(formatRupiah(undefined)).toBe('Rp 0'))
  it('formats positive integer', () => {
    const result = formatRupiah(50000)
    expect(result).toContain('50')
    expect(result).toContain('000')
  })
  it('formats large value without floating point error', () => {
    // 1 triliun — should not produce NaN or Infinity
    const result = formatRupiah(1_000_000_000_000)
    expect(result).not.toContain('NaN')
    expect(result).not.toContain('Infinity')
  })
})

// ── formatNumber ─────────────────────────────────────────────
describe('formatNumber', () => {
  it('returns 0 for null', () => expect(formatNumber(null)).toBe('0'))
  it('returns 0 for undefined', () => expect(formatNumber(undefined)).toBe('0'))
  it('formats number', () => expect(formatNumber(1000)).toContain('1'))
})

// ── formatDate ───────────────────────────────────────────────
describe('formatDate', () => {
  it('returns - for null', () => expect(formatDate(null)).toBe('-'))
  it('returns - for empty string', () => expect(formatDate('')).toBe('-'))
  it('formats a valid date string', () => {
    const result = formatDate('2026-05-23')
    expect(result).toContain('2026')
    expect(result).toContain('23')
  })
})

// ── calculateDenomTotal ──────────────────────────────────────
describe('calculateDenomTotal', () => {
  it('returns 0 for empty object', () => {
    expect(calculateDenomTotal({})).toBe(0)
  })

  it('mode=qty: multiplies qty by denomination value', () => {
    // 2 keping koin_1000 = 2000
    expect(calculateDenomTotal({ koin_1000: 2 }, 'koin', 'qty')).toBe(2000)
  })

  it('mode=nilai: sums values directly', () => {
    // nilai sudah dalam rupiah
    expect(calculateDenomTotal({ koin_1000: 5000 }, 'koin', 'nilai')).toBe(5000)
  })

  it('handles null/undefined gracefully', () => {
    expect(calculateDenomTotal(null)).toBe(0)
    expect(calculateDenomTotal(undefined)).toBe(0)
  })

  it('sums all denominations', () => {
    const obj = { koin_100: 1, koin_200: 1, koin_500: 1, koin_1000: 1, koin_2000: 1, koin_5000: 1, koin_10000: 1, koin_20000: 1 }
    // qty mode: 100+200+500+1000+2000+5000+10000+20000 = 38800
    expect(calculateDenomTotal(obj, 'koin', 'qty')).toBe(38800)
  })
})

// ── calculateStokTotal ───────────────────────────────────────
describe('calculateStokTotal', () => {
  it('returns 0 for empty object', () => expect(calculateStokTotal({})).toBe(0))
  it('returns 0 for null', () => expect(calculateStokTotal(null)).toBe(0))

  it('sums koin + uang besar', () => {
    const stok = {
      koin_100: 100, koin_200: 0, koin_500: 0, koin_1000: 0,
      koin_2000: 0, koin_5000: 0, koin_10000: 0, koin_20000: 0,
      uang_50000: 50000, uang_100000: 0,
    }
    expect(calculateStokTotal(stok)).toBe(50100)
  })

  it('covers all 10 denom keys', () => {
    expect(ALL_DENOM_LIST).toHaveLength(10)
  })
})

// ── emptyDenoms ──────────────────────────────────────────────
describe('emptyDenoms', () => {
  it('returns object with all 8 koin keys set to 0', () => {
    const result = emptyDenoms()
    expect(Object.keys(result)).toHaveLength(8)
    Object.values(result).forEach(v => expect(v).toBe(0))
  })

  it('uses custom prefix', () => {
    const result = emptyDenoms('sisa')
    expect(result).toHaveProperty('sisa_100')
    expect(result).not.toHaveProperty('koin_100')
  })
})

// ── emptyAllDenoms ───────────────────────────────────────────
describe('emptyAllDenoms', () => {
  it('returns 10 keys all zero', () => {
    const result = emptyAllDenoms()
    expect(Object.keys(result)).toHaveLength(10)
    Object.values(result).forEach(v => expect(v).toBe(0))
  })
})

// ── allTokoVisited ───────────────────────────────────────────
describe('allTokoVisited', () => {
  it('returns true when all selesai', () => {
    expect(allTokoVisited([{ status: 'selesai' }, { status: 'selesai' }])).toBe(true)
  })

  it('returns true when mix of selesai and skip', () => {
    expect(allTokoVisited([{ status: 'selesai' }, { status: 'skip' }])).toBe(true)
  })

  it('returns false when any pending', () => {
    expect(allTokoVisited([{ status: 'selesai' }, { status: 'pending' }])).toBe(false)
  })

  it('returns false when any on_progress', () => {
    expect(allTokoVisited([{ status: 'on_progress' }])).toBe(false)
  })

  it('returns true for empty array', () => {
    expect(allTokoVisited([])).toBe(true)
  })
})

// ── csvCell (Task 38) ────────────────────────────────────────
describe('csvCell', () => {
  it('returns empty string for null', () => expect(csvCell(null)).toBe(''))
  it('returns empty string for undefined', () => expect(csvCell(undefined)).toBe(''))
  it('returns plain value without quotes when safe', () => expect(csvCell('hello')).toBe('hello'))
  it('wraps in quotes when value contains comma', () => expect(csvCell('a,b')).toBe('"a,b"'))
  it('escapes internal double quotes', () => expect(csvCell('say "hi"')).toBe('"say ""hi"""'))
  it('wraps in quotes when value contains newline', () => expect(csvCell('line1\nline2')).toBe('"line1\nline2"'))
  it('converts numbers to string', () => expect(csvCell(42)).toBe('42'))
  it('converts zero correctly', () => expect(csvCell(0)).toBe('0'))
})

// ── parseRp (Task 45) ────────────────────────────────────────
describe('parseRp', () => {
  it('parses plain number string', () => expect(parseRp('50000')).toBe(50000))
  it('strips non-digit characters', () => expect(parseRp('Rp 50.000')).toBe(50000))
  it('returns 0 for empty string', () => expect(parseRp('')).toBe(0))
  it('returns 0 for null', () => expect(parseRp(null)).toBe(0))
  it('clamps to MAX_RP (1 triliun)', () => {
    expect(parseRp('9999999999999999')).toBe(1_000_000_000_000)
  })
  it('strips minus sign (non-digit), so -100 becomes 100', () => {
    // parseRp strips ALL non-digits including '-', so '-100' → '100' → 100
    expect(parseRp('-100')).toBe(100)
  })
  it('handles formatted Indonesian number', () => expect(parseRp('1.000.000')).toBe(1000000))
})

// ── truncate ─────────────────────────────────────────────────
describe('truncate', () => {
  it('returns empty string for null', () => expect(truncate(null)).toBe(''))
  it('does not truncate short text', () => expect(truncate('hello', 10)).toBe('hello'))
  it('truncates long text with ellipsis', () => {
    const result = truncate('abcdefghijk', 5)
    expect(result).toBe('abcde…')
    expect(result).toHaveLength(6)
  })
})

// ── DENOM_LIST integrity ─────────────────────────────────────
describe('DENOM_LIST', () => {
  it('has 8 denominations', () => expect(DENOM_LIST).toHaveLength(8))
  it('all have key, label, value', () => {
    DENOM_LIST.forEach(d => {
      expect(d).toHaveProperty('key')
      expect(d).toHaveProperty('label')
      expect(d).toHaveProperty('value')
      expect(d.value).toBeGreaterThan(0)
    })
  })
  it('values are in ascending order', () => {
    for (let i = 1; i < DENOM_LIST.length; i++) {
      expect(DENOM_LIST[i].value).toBeGreaterThan(DENOM_LIST[i - 1].value)
    }
  })
})
