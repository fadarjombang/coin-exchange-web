import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ArrowLeft, Coins, Banknote, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import { formatRupiah, DENOM_LIST, emptyDenoms } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export default function KantorTransaksiBaru() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tokos, setTokos] = useState([])
  const [stok, setStok] = useState(null)
  const [form, setForm] = useState({
    toko_id: '',
    koin: emptyDenoms(),
    uang: { uang_50000: 0, uang_100000: 0 }
  })
  const [tokoSearch, setTokoSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.toko-dropdown-container')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const [tokoRes, stokRes] = await Promise.all([
        supabase.from('toko').select('id,kode_toko,nama_toko,area').eq('is_active', true).order('kode_toko'),
        supabase.from('stok_gudang').select('*').maybeSingle()
      ])
      setTokos(tokoRes.data || [])
      setStok(stokRes.data)
    }
    loadData()
  }, [])

  const totalKoin = Object.values(form.koin).reduce((sum, val) => sum + (val || 0), 0)
  const totalUang = Object.values(form.uang).reduce((sum, val) => sum + (val || 0), 0)

  const handleSave = async () => {
    if (!form.toko_id) {
      toast({ title: 'Pilih toko terlebih dahulu', variant: 'destructive' })
      return
    }

    // Resolve UUID secara sinkron — hindari mengirim nama toko sebagai UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let resolvedTokoId = form.toko_id

    if (!uuidRegex.test(resolvedTokoId)) {
      // form.toko_id berisi nama/kode toko, bukan UUID — cari UUID-nya dari array
      const found = tokos.find(t =>
        t.nama_toko === resolvedTokoId || t.kode_toko === resolvedTokoId
      )
      if (!found || !uuidRegex.test(found.id)) {
        toast({ title: 'Pilih ulang toko', description: 'Toko tidak ditemukan atau data rusak. Pilih kembali dari dropdown.', variant: 'destructive' })
        setForm(f => ({ ...f, toko_id: '' }))
        return
      }
      resolvedTokoId = found.id
      setForm(f => ({ ...f, toko_id: found.id }))
    }

    if (totalKoin === 0 && totalUang === 0) {
      toast({ title: 'Masukkan nominal koin atau uang', variant: 'destructive' })
      return
    }
    if (totalKoin !== totalUang) {
      toast({ title: 'Selisih harus 0', description: `Koin: ${formatRupiah(totalKoin)} | Uang: ${formatRupiah(totalUang)}`, variant: 'destructive' })
      return
    }
    for (const d of DENOM_LIST) {
      if ((form.koin[d.key] || 0) > (stok[d.key] || 0)) {
        toast({ title: `${d.label}: melebihi stok tersedia`, description: `Stok tersedia: ${formatRupiah(stok[d.key] || 0)}`, variant: 'destructive' })
        return
      }
    }

    setSaving(true)
    try {
      const { error: stokErr } = await supabase.rpc('update_stok_gudang_kantor', {
        p_stok_id:    stok.id,
        p_toko_id:    resolvedTokoId,          // ← gunakan UUID yang sudah diverifikasi
        p_kasir_id:   profile.id,
        p_koin_100:   form.koin.koin_100   || 0,
        p_koin_200:   form.koin.koin_200   || 0,
        p_koin_500:   form.koin.koin_500   || 0,
        p_koin_1000:  form.koin.koin_1000  || 0,
        p_koin_2000:  form.koin.koin_2000  || 0,
        p_koin_5000:  form.koin.koin_5000  || 0,
        p_koin_10000: form.koin.koin_10000 || 0,
        p_koin_20000: form.koin.koin_20000 || 0,
        p_uang_50000:   form.uang.uang_50000,
        p_uang_100000:  form.uang.uang_100000,
        p_pic_nama:     profile?.name || 'Admin',
        p_pic_jabatan:  'Admin/Manager',
        p_updated_by:   profile.id,
      })
      if (stokErr) throw new Error('Gagal simpan transaksi: ' + stokErr.message)

      toast({ title: 'Transaksi Tersimpan', description: `Koin keluar: ${formatRupiah(totalKoin)} | Uang masuk: ${formatRupiah(totalUang)}`, variant: 'success' })
      navigate('/dashboard/kantor')

    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/kantor')}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="page-title">Penukaran Koin di Kantor</h1>
            <p className="page-subtitle">Catat penerimaan uang kertas dan penyerahan koin ke toko</p>
          </div>
        </div>

        {/* Stok Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={16} className="text-primary" />
              <span className="text-sm font-semibold">Stok Gudang Saat Ini</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DENOM_LIST.map(d => (
                <div key={d.key} className="text-center p-2 bg-background rounded border">
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                  <p className="font-bold text-xs">{formatRupiah(stok?.[d.key] || 0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Penukaran</CardTitle>
            <CardDescription>Lengkapi rincian nominal penukaran untuk mencatat mutasi stok gudang.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pilih Toko dengan Dropdown Searchable */}
            <div className="space-y-2 relative toko-dropdown-container">
              <Label>Pilih Toko *</Label>
              <div className="relative">
                <Input
                  placeholder={form.toko_id ? "" : "Cari kode, nama toko, atau area..."}
                  value={isOpen ? tokoSearch : (tokos.find(t => t.id === form.toko_id)?.nama_toko || '')}
                  onChange={(e) => {
                    setTokoSearch(e.target.value)
                    setIsOpen(true)
                  }}
                  onFocus={() => {
                    setIsOpen(true)
                    setTokoSearch('')
                  }}
                  className="h-9 pr-8"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground pointer-events-none">
                  {form.toko_id && !isOpen && (
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                      {tokos.find(t => t.id === form.toko_id)?.kode_toko}
                    </span>
                  )}
                  <ChevronDown size={16} />
                </div>
              </div>

              {isOpen && (
                <div className="absolute z-50 w-full bg-popover text-popover-foreground border rounded-lg shadow-md max-h-60 overflow-y-auto mt-1 py-1">
                  {tokos
                    .filter(t => {
                      const searchLower = tokoSearch.toLowerCase()
                      return (
                        t.kode_toko.toLowerCase().includes(searchLower) ||
                        t.nama_toko.toLowerCase().includes(searchLower) ||
                        (t.area || '').toLowerCase().includes(searchLower)
                      )
                    })
                    .slice(0, 50)
                    .map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between border-b border-muted/50 last:border-0"
                        onClick={() => {
                          setForm(f => ({ ...f, toko_id: t.id }))
                          setTokoSearch('')
                          setIsOpen(false)
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs sm:text-sm">{t.nama_toko}</span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">{t.kode_toko} · {t.area || 'No Area'}</span>
                        </div>
                        {form.toko_id === t.id && (
                          <span className="text-primary text-xs font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  {tokos.filter(t => {
                    const searchLower = tokoSearch.toLowerCase()
                    return (
                      t.kode_toko.toLowerCase().includes(searchLower) ||
                      t.nama_toko.toLowerCase().includes(searchLower) ||
                      (t.area || '').toLowerCase().includes(searchLower)
                    )
                  }).length === 0 && (
                    <div className="text-xs text-center py-4 text-muted-foreground">Toko tidak ditemukan</div>
                  )}
                </div>
              )}
            </div>

            {/* Koin yang Diberikan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-amber-600" />
                <Label className="font-semibold">Koin yang Diserahkan ke Toko</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DENOM_LIST.map(d => (
                  <div key={d.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{d.label}</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                      <Input
                        type="text" inputMode="numeric"
                        value={form.koin[d.key] ? parseInt(form.koin[d.key] || 0).toLocaleString('id-ID') : ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, '') || 0)
                          setForm(f => ({ ...f, koin: { ...f.koin, [d.key]: val } }))
                        }}
                        className="pl-7 h-9"
                      />
                    </div>
                    {(form.koin[d.key] || 0) > (stok?.[d.key] || 0) && (
                      <p className="text-[10px] text-destructive">Melebihi stok</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Uang yang Diterima */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-green-600" />
                <Label className="font-semibold">Uang Kertas yang Diterima dari Toko</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'uang_50000', label: 'Uang Rp 50.000' },
                  { key: 'uang_100000', label: 'Uang Rp 100.000' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                      <Input
                        type="text" inputMode="numeric"
                        value={form.uang[key] ? parseInt(form.uang[key] || 0).toLocaleString('id-ID') : ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, '') || 0)
                          setForm(f => ({ ...f, uang: { ...f.uang, [key]: val } }))
                        }}
                        className="pl-7 h-9"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Koin Diserahkan</p>
                <p className="text-xl font-bold text-amber-600">{formatRupiah(totalKoin)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Uang Diterima</p>
                <p className="text-xl font-bold text-green-600">{formatRupiah(totalUang)}</p>
              </div>
            </div>
            {totalKoin > 0 || totalUang > 0 ? (
              <div className={`flex items-center justify-between p-3 rounded-lg ${totalKoin === totalUang ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                <span className="text-sm font-medium">SELISIH</span>
                <span className={`text-sm font-bold ${totalKoin === totalUang ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {totalKoin === totalUang ? '✓ SEIMBANG' : formatRupiah(Math.abs(totalKoin - totalUang))}
                </span>
              </div>
            ) : null}

            <Button
              onClick={handleSave}
              disabled={saving || !form.toko_id || (totalKoin === 0 && totalUang === 0) || totalKoin !== totalUang}
              className="w-full"
              size="lg"
            >
              {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
              Simpan Transaksi
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Panduan Penukaran</p>
              <p className="text-xs mt-1 leading-relaxed">
                Pilih toko yang datang ke kantor. Masukkan nominal uang kertas yang Anda terima dari mereka,
                beserta nominal koin yang Anda serahkan. Sistem akan otomatis memperbarui saldo stok gudang.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}