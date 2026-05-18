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
import { Package, Save, RefreshCw, Loader2, Coins, Banknote } from 'lucide-react'
import { formatRupiah, formatDateTime, ALL_DENOM_LIST, DENOM_LIST, UANG_LIST, calculateStokTotal } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

/**
 * Input stok menggunakan NILAI (Rp), bukan qty keping/lembar.
 * Field di DB: koin_100, koin_200, ..., uang_50000, uang_100000
 * Semua field menyimpan nilai rupiah langsung.
 */
export default function StokGudang() {
  const { profile, role } = useAuth()
  const roles = Array.isArray(role) ? role : [role]
  const { toast }   = useToast()
  const [stok, setStok]       = useState(null)
  const [log, setLog]         = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm]       = useState({})
  const [keterangan, setKeterangan] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [s, l] = await Promise.all([
      supabase.from('stok_gudang').select('*').single(),
      supabase.from('stok_gudang_log').select('*').order('created_at', { ascending: false }).limit(30),
    ])
    if (s.data) { setStok(s.data); setForm(s.data) }
    setLog(l.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stok_edit_mode_change', { detail: editMode }))
  }, [editMode])

  const handleInputChange = (key, rawValue) => {
    // Hapus non-digit, parse ke angka
    const num = parseInt(rawValue.replace(/\D/g, ''), 10) || 0
    setForm((f) => ({ ...f, [key]: num }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build update: semua field adalah nilai Rp langsung
      const update = ALL_DENOM_LIST.reduce((acc, d) => {
        acc[d.key] = parseInt(form[d.key] || 0)
        return acc
      }, {})

      // Delta total = selisih nilai baru vs lama
      const newTotal = calculateStokTotal(form)
      const oldTotal = calculateStokTotal(stok)
      const deltaTotal = newTotal - oldTotal

      const { error: updateErr } = await supabase.from('stok_gudang')
        .update({ ...update, last_updated: new Date().toISOString(), updated_by: profile?.id })
        .eq('id', stok.id)
      if (updateErr) throw updateErr

      await supabase.from('stok_gudang_log').insert({
        tipe: 'penyesuaian',
        keterangan: keterangan || 'Penyesuaian manual',
        delta_total: deltaTotal,
        created_by: profile?.id,
      })

      toast({ title: 'Berhasil', description: 'Stok gudang berhasil diperbarui', variant: 'success' })
      setEditMode(false); setKeterangan(''); fetchData()
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const isAdmin = roles.includes('admin') || roles.includes('superadmin')
  const TYPE_BADGE = { keluar_modal: 'destructive', masuk_sisa: 'success', penyesuaian: 'info' }
  const TYPE_LABEL = { keluar_modal: 'Keluar Modal', masuk_sisa: 'Masuk Sisa', penyesuaian: 'Penyesuaian' }

  const totalNilai = stok ? calculateStokTotal(stok) : 0

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Package size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Stok Gudang</h1><p className="page-subtitle">Nilai uang & koin yang tersedia di gudang</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={14} /></Button>
            {!editMode && isAdmin && <Button size="sm" onClick={() => setEditMode(true)} id="btn-penyesuaian">Penyesuaian Manual</Button>}
          </div>
        </div>

        {/* Total Card */}
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
              <p className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1"><Coins size={12}/>Total Nilai Koin</p>
              {loading ? <Skeleton className="h-6 w-24 mt-2" /> : (
                <p className="text-xl font-bold mt-1">{formatRupiah(DENOM_LIST.reduce((s,d) => s + (stok?.[d.key]||0), 0))}</p>
              )}
            </CardContent>
          </Card>
          <Card className="sm:col-span-1">
            <CardContent className="p-5">
              <p className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1"><Banknote size={12}/>Total Uang Besar</p>
              {loading ? <Skeleton className="h-6 w-24 mt-2" /> : (
                <p className="text-xl font-bold mt-1">{formatRupiah(UANG_LIST.reduce((s,d) => s + (stok?.[d.key]||0), 0))}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Koin Section */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins size={16}/>Stok Koin</CardTitle></CardHeader>
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

        {/* Uang Besar Section */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/>Uang Besar</CardTitle></CardHeader>
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

        {/* Edit Form */}
        {editMode && (
          <Card className="border-primary/30 bg-primary/5" id="tour-stok-edit-form">
            <CardHeader>
              <CardTitle className="text-base">Penyesuaian Manual</CardTitle>
              <CardDescription>Masukkan <strong>nilai Rupiah</strong> per denominasi (bukan jumlah keping/lembar)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Koin inputs */}
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-1"><Coins size={14}/>Koin</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DENOM_LIST.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label className="text-xs">{d.label}</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <Input
                          type="text" inputMode="numeric"
                          className="h-9 pl-7"
                          value={(form[d.key] || 0).toLocaleString('id-ID')}
                          onChange={(e) => handleInputChange(d.key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              {/* Uang besar inputs */}
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-1"><Banknote size={14}/>Uang Besar</p>
                <div className="grid grid-cols-2 gap-3">
                  {UANG_LIST.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label className="text-xs">{d.label}</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <Input
                          type="text" inputMode="numeric"
                          className="h-9 pl-7"
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
                <Textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Alasan penyesuaian..." rows={2} />
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

        {/* Log */}
        <Card id="tour-stok-log">
          <CardHeader><CardTitle className="text-base">History Log Perubahan</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Tipe</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Delta Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                : log.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(l.created_at)}</TableCell>
                    <TableCell><Badge variant={TYPE_BADGE[l.tipe] || 'secondary'}>{TYPE_LABEL[l.tipe] || l.tipe}</Badge></TableCell>
                    <TableCell className="text-sm">{l.keterangan || '-'}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${l.delta_total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {l.delta_total >= 0 ? '+' : ''}{formatRupiah(l.delta_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
