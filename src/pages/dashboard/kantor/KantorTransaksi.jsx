import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Building, Coins, Banknote, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { formatRupiah, DENOM_LIST, emptyDenoms } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export default function KantorTransaksi() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [tokos, setTokos] = useState([])
  const [stok, setStok] = useState(null)
  
  const [form, setForm] = useState({
    toko_id: '',
    koin: emptyDenoms(),
    uang: { uang_50000: 0, uang_100000: 0 }
  })
  const [tokoSearch, setTokoSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const [tokoRes, stokRes] = await Promise.all([
        supabase.from('toko').select('id,kode_toko,nama_toko,area').eq('is_active', true).order('kode_toko'),
        supabase.from('stok_gudang').select('*').single()
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

    if (totalKoin === 0 && totalUang === 0) {
      toast({ title: 'Masukkan nominal koin atau uang', variant: 'destructive' })
      return
    }

    // Validasi stok
    for (const d of DENOM_LIST) {
      if ((form.koin[d.key] || 0) > (stok[d.key] || 0)) {
        toast({ title: `${d.label}: melebihi stok tersedia`, description: `Stok tersedia: ${formatRupiah(stok[d.key] || 0)}`, variant: 'destructive' })
        return
      }
    }

    setSaving(true)
    try {
      const selectedToko = tokos.find(t => t.id === form.toko_id)

      // Update stok gudang — hanya kirim kolom yang bisa di-update (exclude generated columns)
      const stokUpdate = {
        // Koin berkurang
        ...DENOM_LIST.reduce((acc, d) => {
          acc[d.key] = Math.max(0, (stok[d.key] || 0) - (form.koin[d.key] || 0))
          return acc
        }, {}),
        // Uang bertambah
        uang_50000: (stok.uang_50000 || 0) + form.uang.uang_50000,
        uang_100000: (stok.uang_100000 || 0) + form.uang.uang_100000,
        // Metadata
        updated_by: profile.id,
        last_updated: new Date().toISOString(),
        // NOTE: total_nilai sengaja TIDAK dikirim — itu generated column (GENERATED ALWAYS AS)
      }

      const { error: stokErr } = await supabaseAdmin.from('stok_gudang').update(stokUpdate).eq('id', stok.id)
      if (stokErr) throw new Error('Gagal update stok: ' + stokErr.message)

      // Catat ke log
      const koinDetail = DENOM_LIST.filter(d => form.koin[d.key] > 0).map(d => `${d.label}: -${formatRupiah(form.koin[d.key])}`).join(', ')
      const uangDetail = []
      if (form.uang.uang_50000 > 0) uangDetail.push(`Uang 50k: +${form.uang.uang_50000}`)
      if (form.uang.uang_100000 > 0) uangDetail.push(`Uang 100k: +${form.uang.uang_100000}`)

      const { error: logErr } = await supabaseAdmin.from('stok_gudang_log').insert({
        tipe: 'penukaran_kantor',
        keterangan: `Penukaran koin kantor - Toko: ${selectedToko?.nama_toko} (${selectedToko?.kode_toko}) | Koin keluar: ${koinDetail || 'tidak ada'} | Uang masuk: ${uangDetail.join(', ') || 'tidak ada'}`,
        delta_total: totalUang - totalKoin,
        created_by: profile.id,
        ...DENOM_LIST.reduce((acc, d) => { acc[`delta_${d.key.replace('koin_', '')}`] = -(form.koin[d.key] || 0); return acc }, {}),
        delta_uang_50000: form.uang.uang_50000,
        delta_uang_100000: form.uang.uang_100000
      })
      if (logErr) console.error('Log error:', logErr.message)

      // Insert transaksi kantor (sesi_tugas_id nullable setelah migrasi DB)
      const { error: trxErr } = await supabaseAdmin.from('transaksi').insert({
        toko_id: form.toko_id,
        kasir_id: profile.id,
        tanggal_waktu: new Date().toISOString(),
        ...form.koin,
        total_koin_nilai: totalKoin,
        uang_50000: form.uang.uang_50000,
        uang_100000: form.uang.uang_100000,
        total_uang_diterima: totalUang,
        selisih: 0,
        pic_nama: profile?.name || 'Admin',
        pic_jabatan: 'Admin/Manager',
        status: 'submitted',
        jenis: 'kantor'
      })
      if (trxErr) throw new Error('Gagal simpan transaksi: ' + trxErr.message)

      // Refresh stok
      const { data: newStok } = await supabase.from('stok_gudang').select('*').single()
      setStok(newStok)

      toast({ title: 'Transaksi Tersimpan', description: `Koin keluar: ${formatRupiah(totalKoin)} | Uang masuk: ${formatRupiah(totalUang)}`, variant: 'success' })

      // Reset form
      setForm({ toko_id: '', koin: emptyDenoms(), uang: { uang_50000: 0, uang_100000: 0 } })

    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedToko = tokos.find(t => t.id === form.toko_id)

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">Transaksi Penukaran Koin Kantor</h1>
            <p className="page-subtitle">Catat transaksi penukaran koin dengan toko yang datang ke kantor</p>
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
              {DENOM_LIST.slice(0, 4).map(d => (
                <div key={d.key} className="text-center p-2 bg-background rounded border">
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                  <p className="font-bold text-sm">{formatRupiah(stok?.[d.key] || 0)}</p>
                </div>
              ))}
              <div className="text-center p-2 bg-background rounded border">
                <p className="text-[10px] text-muted-foreground">Uang 50k</p>
                <p className="font-bold text-sm">{stok?.uang_50000 || 0}</p>
              </div>
              <div className="text-center p-2 bg-background rounded border">
                <p className="text-[10px] text-muted-foreground">Uang 100k</p>
                <p className="font-bold text-sm">{stok?.uang_100000 || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Transaksi</CardTitle>
            <CardDescription>Toko menyerahkan uang besar, admin menyerahkan koin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pilih Toko - ComboBox Style */}
            <div className="space-y-2">
              <Label>Pilih Toko *</Label>
              <div className="relative">
                <Select 
                  value={form.toko_id} 
                  onValueChange={(v) => {
                    setForm(f => ({ ...f, toko_id: v }))
                    setTokoSearch('')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={form.toko_id ? tokos.find(t => t.id === form.toko_id)?.nama_toko + ' (' + tokos.find(t => t.id === form.toko_id)?.kode_toko + ')' : "Pilih toko..."} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Cari kode atau nama toko..."
                        value={tokoSearch}
                        onChange={(e) => setTokoSearch(e.target.value)}
                        autoFocus
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {tokos
                        .filter(t => 
                          !tokoSearch || 
                          t.kode_toko.toLowerCase().includes(tokoSearch.toLowerCase()) ||
                          t.nama_toko.toLowerCase().includes(tokoSearch.toLowerCase()) ||
                          t.area?.toLowerCase().includes(tokoSearch.toLowerCase())
                        )
                        .map(t => (
                          <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                            <div className="flex flex-col">
                              <span className="font-medium">{t.nama_toko}</span>
                              <span className="text-xs text-muted-foreground">{t.kode_toko} · {t.area}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Koin yang Diberikan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-amber-600" />
                <Label className="font-semibold">Koin yang Diberikan ke Toko (Stok Akan Berkurang)</Label>
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
                <Label className="font-semibold">Uang yang Diterima dari Toko (Stok Akan Bertambah)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Uang Rp 50.000</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      type="text" inputMode="numeric"
                      value={form.uang.uang_50000 ? parseInt(form.uang.uang_50000 || 0).toLocaleString('id-ID') : ''}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/\D/g, '') || 0)
                        setForm(f => ({ ...f, uang: { ...f.uang, uang_50000: val } }))
                      }}
                      className="pl-7 h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Uang Rp 100.000</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      type="text" inputMode="numeric"
                      value={form.uang.uang_100000 ? parseInt(form.uang.uang_100000 || 0).toLocaleString('id-ID') : ''}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/\D/g, '') || 0)
                        setForm(f => ({ ...f, uang: { ...f.uang, uang_100000: val } }))
                      }}
                      className="pl-7 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Koin Keluar</p>
                <p className="text-xl font-bold text-amber-600">{formatRupiah(totalKoin)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Uang Masuk</p>
                <p className="text-xl font-bold text-green-600">{formatRupiah(totalUang)}</p>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSave}
              disabled={saving || !form.toko_id || (totalKoin === 0 && totalUang === 0)}
              className="w-full"
              size="lg"
            >
              {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
              Simpan Transaksi
            </Button>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Cara Kerja</p>
              <p className="text-xs mt-1">
                Admin menerima uang besar dari toko, lalu menyerahkan koin ke toko. 
                Stok gudang akan otomatis berkurang untuk koin yang diberikan, 
                dan bertambah untuk uang yang diterima.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}