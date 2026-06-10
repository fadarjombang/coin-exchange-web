import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn utility: merge Tailwind classes without conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ── Currency & Number Formatting ─────────────────────────────
const RUPIAH_FMT = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
})
const NUMBER_FMT = new Intl.NumberFormat('id-ID')
const DATE_FMT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
const DATETIME_FMT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})
const TIME_FMT = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

export function formatRupiah(value) {
  if (value === null || value === undefined) return 'Rp 0'
  return RUPIAH_FMT.format(value)
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return NUMBER_FMT.format(value)
}

// ── Coin Denominations ───────────────────────────────────────
export const DENOM_LIST = [
  { key: 'koin_100', label: 'Rp 100', value: 100 },
  { key: 'koin_200', label: 'Rp 200', value: 200 },
  { key: 'koin_500', label: 'Rp 500', value: 500 },
  { key: 'koin_1000', label: 'Rp 1.000', value: 1000 },
  { key: 'koin_2000', label: 'Rp 2.000', value: 2000 },
  { key: 'koin_5000', label: 'Rp 5.000', value: 5000 },
  { key: 'koin_10000', label: 'Rp 10.000', value: 10000 },
  { key: 'koin_20000', label: 'Rp 20.000', value: 20000 },
]

// Uang besar (untuk stok gudang & rekonsiliasi)
export const UANG_LIST = [
  { key: 'uang_50000', label: 'Rp 50.000', value: 50000 },
  { key: 'uang_100000', label: 'Rp 100.000', value: 100000 },
]

// Semua denom (koin + uang) — dipakai di stok gudang
export const ALL_DENOM_LIST = [...DENOM_LIST, ...UANG_LIST]

export const DENOM_KEYS = DENOM_LIST.map((d) => d.key)

/**
 * Hitung total nilai dari objek denom.
 * mode='qty'  → nilai * qty  (lama, untuk koin kasir)
 * mode='nilai' → sum langsung nilai per field (baru, untuk stok gudang)
 */
export function calculateDenomTotal(denomObj, prefix = 'koin', mode = 'qty') {
  return DENOM_LIST.reduce((total, denom) => {
    const key = prefix === 'koin'
      ? denom.key
      : `${prefix}_${denom.key.replace('koin_', '')}`
    const v = parseInt(denomObj?.[key] || 0, 10)
    return total + (mode === 'qty' ? v * denom.value : v)
  }, 0)
}

/**
 * Hitung total nilai dari ALL_DENOM_LIST (koin + uang besar).
 * Input sudah berupa nilai rupiah per denom.
 */
export function calculateStokTotal(stokObj) {
  return ALL_DENOM_LIST.reduce((total, denom) => {
    return total + (parseInt(stokObj?.[denom.key] || 0, 10))
  }, 0)
}

export function emptyDenoms(prefix = 'koin') {
  return DENOM_LIST.reduce((acc, d) => {
    const key = prefix === 'koin' ? d.key : `${prefix}_${d.key.replace('koin_', '')}`
    acc[key] = 0
    return acc
  }, {})
}

export function emptyAllDenoms() {
  return ALL_DENOM_LIST.reduce((acc, d) => { acc[d.key] = 0; return acc }, {})
}

// ── Date & Time Formatting ───────────────────────────────────
export function formatDate(value, options = {}) {
  if (!value) return '-'
  if (Object.keys(options).length > 0) {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', ...options }).format(new Date(value))
  }
  return DATE_FMT.format(new Date(value))
}

export function formatDateTime(value) {
  if (!value) return '-'
  return DATETIME_FMT.format(new Date(value))
}

export function formatTime(value) {
  if (!value) return '-'
  return TIME_FMT.format(new Date(value))
}

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function getPastDateISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Status Maps ──────────────────────────────────────────────
export const SESSION_STATUS = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_approval: { label: 'Menunggu Approval', variant: 'warning' },
  active: { label: 'Aktif', variant: 'success' },
  pending_close: { label: 'Menunggu Penutupan', variant: 'info' },
  closed: { label: 'Selesai', variant: 'outline' },
}

export const ASSIGNMENT_STATUS = {
  pending:     { label: 'Menunggu',           variant: 'secondary' },
  on_progress: { label: 'Sedang Dikunjungi',  variant: 'info' },
  selesai:     { label: 'Selesai',            variant: 'success' },
  skip:        { label: 'Dilewati',           variant: 'destructive' },
}

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  kasir: 'Kasir',
  driver: 'Driver',
}

// ── Misc Helpers ─────────────────────────────────────────────
/**
 * Escape a value for CSV output (RFC 4180).
 * Wraps in quotes if value contains comma, quote, or newline.
 */
export function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Parse a Rupiah input string to a safe integer.
 * Strips non-digits, clamps to MAX_RP to prevent JS precision loss.
 */
const MAX_RP = 1_000_000_000_000  // 1 triliun
export function parseRp(raw) {
  const n = parseInt(String(raw).replace(/\D/g, ''), 10) || 0
  return Math.min(Math.max(n, 0), MAX_RP)
}
export function allTokoVisited(assignments) {
  return assignments.every((a) => a.status === 'selesai' || a.status === 'skip')
}

export function truncate(text, maxLength = 40) {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}
