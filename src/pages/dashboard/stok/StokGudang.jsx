import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Save, RefreshCw, Loader2, Coins, Banknote, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { formatRupiah, formatDateTime, DENOM_LIST, UANG_LIST, calculateStokTotal, todayISO } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const LOG_PAGE_SIZE = 10

const TYPE_BADGE = {
  keluar_modal:     'destructive',
  masuk_sisa:       'success',
  penyesuaian:      'info',
  penukaran_kantor: 'warning',
}
const TYPE_LABEL = {
  keluar_modal:     'Keluar Modal',
  masuk_sisa:       'Masuk Sisa',
  penyesuaian:      'Penyesuaian',
  penukaran_kantor: 'Kantor',
}

/**
 * Input stok menggunakan NILAI (Rp), bukan qty keping/lembar.
 * Field di DB: koin_100, koin_200, ..., uang_50000, uang_100000
 * Semua field menyimpan nilai rupiah langsung.
 */
export default function StokGudang() {
  const { profile, role } = useAuth()
  const roles = Array.isArray(role) ? role : [role]
  const { toast }   = useToast()

  // ── Stok state ───────────────────────────────────────────────
  const [stok, setStok]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm]         = useState({})
  const [keterangan, setKeterangan] = useState('')

  // ── Log state ────────────────────────────────────────────────
  const [log, setLog]           = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage]   = useState(1)
  // Filter inputs (belum di-apply)
  const [logFrom, setLogFrom]   = useState(todayISO)
  const [logTo, setLogTo]       = useState(todayISO)
  const [logTipe, setLogTipe]   = useState('all')
  // Filter aktif (dipakai saat query — berubah hanya saat Tampilkan diklik)
  const [activeFrom, setActiveFrom] = useState(todayISO)
  const [activeTo, setActiveTo]     = useState(todayISO)
  const [activeTipe, setActiveTipe] = useState('all')

  // ── Fetch stok ───────────────────────────────────────────────
  const fetchStok = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('stok_gudang').select('*').maybeSingle()
    if (data) { setStok(data); setForm(data) }
    setLoading(false)
  }, [])

  // ── Fetch log (server-side pagination + filter) ──────────────
  const fetchLog = useCallback(async (page, from, to, tipe) => {
    setLogLoading(true)
    const start = (page - 1) * LOG_PAGE_SIZE
    const end   = start + LOG_PAGE_SIZE - 1

    let q = supabase
      .from('stok_gudang_log')
      .select('*', { count: 'exact' })
      .gte('created_at', new Date(`${from}T00:00:00+07:00`).toISOString())
      .lte('created_at', new Date(`${to}T23:59:59+07:00`).toISOString())
      .order('created_at', { ascending: false })
      .range(start, end)

    if (tipe !== 'all') q = q.eq('tipe', tipe)

    const { data, count } = await q
    setLog(data || [])
    setLogTotal(count || 0)
    setLogLoading(false)
  }, [])

  useEffect(() => { fetchStok() }, [fetchStok])
  useEffect(() => { fetchLog(1, activeFrom, activeTo, activeTipe) }, [fetchLog, activeFrom, activeTo, activeTipe])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stok_edit_mode_change', { detail: editMode }))
  }, [editMode])

  // ── Handlers ─────────────────────────────────────────────────
  const handleSearch = () => {
    setActiveFrom(logFrom)
    setActiveTo(logTo)
    setActiveTipe(logTipe)
    setLogPage(1)
    fetchLog(1, logFrom, logTo, logTipe)
  }

  const handlePageChange = (newPage) => {
    setLogPage(newPage)
    fetchLog(newPage, activeFrom, activeTo, activeTipe)
  }

  const handleInputChange = (key, rawValue) => {
    const num = parseInt(rawValue.replace(/\D/g, ''), 10) || 0
    setForm((f) => ({ ...f, [key]: num }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error: updateErr } = await supabase.rpc('update_stok_gudang', {
        p_stok_id:     stok.id,
        p_koin_100:    parseInt(form.koin_100   || 0),
        p_koin_200:    parseInt(form.koin_200   || 0),
        p_koin_500:    parseInt(form.koin_500   || 0),
        p_koin_1000:   parseInt(form.koin_1000  || 0),
        p_koin_2000:   parseInt(form.koin_2000  || 0),
        p_koin_5000:   parseInt(form.koin_5000  || 0),
        p_koin_10000:  parseInt(form.koin_10000 || 0),
        p_koin_20000:  parseInt(form.koin_20000 || 0),
        p_uang_50000:  parseInt(form.uang_50000  || 0),
        p_uang_100000: parseInt(form.uang_100000 || 0),
        p_keterangan:  keterangan || 'Penyesuaian manual',
        p_updated_by:  profile?.id,
      })
      if (updateErr) throw updateErr
      toast({ title: 'Berhasil', description: 'Stok gudang berhasil diperbarui', variant: 'success' })
      setEditMode(false); setKeterangan('')
      fetchStok()
      fetchLog(1, activeFrom, activeTo, activeTipe)
      setLogPage(1)
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const isAdmin    = roles.includes('admin') || roles.includes('superadmin')
  const totalNilai = stok ? calculateStokTotal(stok) : 0
  const totalPages = Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE))

  // Pagination page numbers with ellipsis
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - logPage) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
      acc.push(p)
      return acc
    }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="page-title">Stok Gudang</h1>
              <p className="page-subtitle">Saldo persediaan koin dan uang kertas di gudang</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={fetchStok} className="flex-1 sm:flex-none"><RefreshCw size={14} /></Button>
            {!editMode && isAdmin && (
              <Button size="sm" onClick={() => setEditMode(true)} id="btn-penyesuaian" className="flex-[4] sm:flex-none">
                Penyesuaian Manual
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="stok-total-cards">
          <Card className="sm:col-span-1 bg-primary text-primary-foreground">
            <CardContent className="p-5">
              <p className="text-primary-foreground/70 text-xs uppercase tracking-wide">Total Nilai Gudang</p>
              {loading ? <Skeleton className="h-8 w-32 mt-2 bg-white/20" /> : (
                <p className="text-2xl font-bold mt-1">{formatRupiah(totalNilai)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="sm:col-span-1">
            <CardContent className="p-5">
              <p className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                <Coins size={12} />Total Nilai Koin
              </p>
              {loading ? <Skeleton className="h-6 w-24 mt-2" /> : (
                <p className="text-xl font-bold mt-1">
                  {formatRupiah(DENOM_LIST.reduce((s, d) => s + (stok?.[d.key] || 0), 0))}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="sm:col-span-1">
            <CardContent className="p-5">
              <p className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                <Banknote size={12} />Total Uang Besar
              </p>
              {loading ? <Skeleton className="h-6 w-24 mt-2" /> : (
                <p className="text-xl font-bold mt-1">
                  {formatRupiah(UANG_LIST.reduce((s, d) => s + (stok?.[d.key] || 0), 0))}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Koin breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Coins size={16} />Stok Koin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DENOM_LIST.map((d) => (
                <div key={d.key} className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  {loading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                    <p className="text-lg font-bold text-primary">{formatRupiah(stok?.[d.key] || 0)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uang besar breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Uang Besar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {UANG_LIST.map((d) => (
                <div key={d.key} className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  {loading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                    <p className="text-lg font-bold text-emerald-700">{formatRupiah(stok?.[d.key] || 0)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        {editMode && (
          <Card className="border-primary/30 bg-primary/5" id="tour-stok-edit-form">
            <CardHeader>
              <CardTitle className="text-base">Penyesuaian Manual</CardTitle>
              <CardDescription>
                Masukkan <strong>nilai Rupiah</strong> per denominasi (bukan jumlah keping/lembar)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-1"><Coins size={14} />Koin</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DENOM_LIST.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label className="text-xs">{d.label}</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <Input
                          type="text" inputMode="numeric" className="h-9 pl-7"
                          value={(form[d.key] || 0).toLocaleString('id-ID')}
                          onChange={(e) => handleInputChange(d.key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-1"><Banknote size={14} />Uang Besar</p>
                <div className="grid grid-cols-2 gap-3">
                  {UANG_LIST.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label className="text-xs">{d.label}</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <Input
                          type="text" inputMode="numeric" className="h-9 pl-7"
                          value={(form[d.key] || 0).toLocaleString('id-ID')}
                          onChange={(e) => handleInputChange(d.key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5" id="tour-stok-keterangan">
                <Label>Keterangan</Label>
                <Textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Alasan penyesuaian..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEditMode(false); setForm(stok) }}>Batal</Button>
                <Button onClick={handleSave} disabled={saving} id="btn-simpan-stok">
                  {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                  <Save size={14} />Simpan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History Log */}
        <Card id="tour-stok-log">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <CardTitle className="text-base">History Log Perubahan</CardTitle>

              {/* Filter controls */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dari</Label>
                  <Input
                    type="date" value={logFrom}
                    onChange={e => setLogFrom(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sampai</Label>
                  <Input
                    type="date" value={logTo}
                    onChange={e => setLogTo(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipe</Label>
                  <select
                    value={logTipe}
                    onChange={e => setLogTipe(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">Semua</option>
                    <option value="keluar_modal">Keluar Modal</option>
                    <option value="masuk_sisa">Masuk Sisa</option>
                    <option value="penyesuaian">Penyesuaian</option>
                    <option value="penukaran_kantor">Kantor</option>
                  </select>
                </div>
                <Button size="sm" className="h-8 px-3 gap-1" onClick={handleSearch} disabled={logLoading}>
                  {logLoading
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Search size={13} />
                  }
                  Tampilkan
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Delta Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logLoading
                  ? Array.from({ length: LOG_PAGE_SIZE }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell>
                      </TableRow>
                    ))
                  : log.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                          Tidak ada log pada rentang tanggal ini
                        </TableCell>
                      </TableRow>
                    )
                    : log.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={TYPE_BADGE[item.tipe] || 'secondary'}>
                              {TYPE_LABEL[item.tipe] || item.tipe}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.keterangan || '-'}</TableCell>
                          <TableCell className={`text-right font-mono font-medium ${
                            item.delta_total >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {item.delta_total >= 0 ? '+' : ''}{formatRupiah(item.delta_total)}
                          </TableCell>
                        </TableRow>
                      ))
                }
              </TableBody>
            </Table>

            {/* Pagination bar */}
            {!logLoading && logTotal > LOG_PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>
                  {logTotal} log &middot; Halaman {logPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={logPage <= 1}
                    onClick={() => handlePageChange(logPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  {pageNumbers.map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === logPage ? 'default' : 'outline'}
                        size="icon" className="h-7 w-7 text-xs"
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={logPage >= totalPages}
                    onClick={() => handlePageChange(logPage + 1)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
