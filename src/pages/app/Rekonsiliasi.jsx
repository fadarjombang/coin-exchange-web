import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SignaturePad from 'signature_pad'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useImageCompress } from '@/hooks/useImageCompress'
import MobileLayout from '@/components/layout/MobileLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Camera, RotateCcw, X, Loader2, CheckCircle2, AlertCircle, ImagePlus } from 'lucide-react'
import { formatRupiah, DENOM_LIST } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export default function Rekonsiliasi() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const { toast }   = useToast()
  const { compress } = useImageCompress()

  const [sesi, setSesi]         = useState(null)
  const [trxList, setTrxList]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [uangSetoran, setUangSetoran] = useState('')
  const [catatan, setCatatan]   = useState('')
  const [photo, setPhoto]       = useState(null)

  const ttdRef    = useRef(null)
  const ttdCanvas = useRef(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: s } = await supabase
      .from('sesi_tugas')
      .select('*, modal_koin(*)')
      .eq('kasir_id', profile.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!s) { setLoading(false); return }
    setSesi(s)
    const { data: tx } = await supabase.from('transaksi').select('*').eq('sesi_tugas_id', s.id)
    setTrxList(tx || [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!ttdCanvas.current) return
    const pad = new SignaturePad(ttdCanvas.current, { backgroundColor: 'rgb(248,250,252)', penColor: '#1e3a5f' })
    ttdRef.current = pad
    const resize = () => {
      const c = ttdCanvas.current; if (!c) return
      const r = Math.max(window.devicePixelRatio || 1, 1)
      c.width = c.offsetWidth * r; c.height = c.offsetHeight * r
      c.getContext('2d').scale(r, r); pad.clear()
    }
    resize()
    return () => pad.off()
  }, [loading])

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhoto(await compress(file))
    e.target.value = ''
  }

  // ======================== AUTO-HITUNG DARI SISTEM ========================
  const modalKoin   = sesi?.modal_koin || {}
  const modalTotal  = modalKoin.total_nilai || 0

  // Sisa koin per denom = modal - yang sudah keluar di semua transaksi
  const sisaDenom = DENOM_LIST.reduce((acc, d) => {
    const modalVal  = modalKoin[d.key] || 0
    const keluarVal = trxList.reduce((s, t) => s + (t[d.key] || 0), 0)
    acc[d.key] = Math.max(0, modalVal - keluarVal)
    return acc
  }, {})

  const totalKoinKeluar = trxList.reduce((s, t) => s + (t.total_koin_nilai || 0), 0)
  const totalUangMasuk  = trxList.reduce((s, t) => s + (t.total_uang_diterima || 0), 0)
  const sisaKoinTotal   = Object.values(sisaDenom).reduce((s, v) => s + v, 0)
  const uangSetoranNum  = parseInt(String(uangSetoran).replace(/\D/g, '')) || 0
  const selisihUang     = totalUangMasuk - uangSetoranNum  // uang masuk - setoran ke gudang

  const denomAktifSisa  = DENOM_LIST.filter(d => sisaDenom[d.key] > 0)
  // ========================================================================

  const canSubmit = photo && !ttdRef.current?.isEmpty()

  const handleUangChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setUangSetoran(raw ? parseInt(raw).toLocaleString('id-ID') : '')
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const ttd = ttdRef.current?.toDataURL('image/png')
      await supabase.from('rekonsiliasi').insert({
        sesi_tugas_id: sesi.id,
        kasir_id: profile.id,
        // Simpan sisa koin per denom (dari kalkulasi sistem)
        ...Object.fromEntries(DENOM_LIST.map(d => [`sisa_koin_${d.key.replace('koin_', '')}`, sisaDenom[d.key] || 0])),
        sisa_koin_nilai: sisaKoinTotal,
        expected_sisa_koin: sisaKoinTotal, // sama karena auto-hitung
        total_uang_masuk: totalUangMasuk,
        uang_setoran: uangSetoranNum,
        selisih_koin: 0,
        selisih_uang: selisihUang,
        foto_sisa: photo,
        ttd_kasir: ttd,
        catatan,
      })
      await supabase.from('sesi_tugas').update({ status: 'pending_close' }).eq('id', sesi.id)
      toast({ title: 'Rekonsiliasi terkirim', description: 'Menunggu persetujuan Manager', variant: 'success' })
      navigate('/app')
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <MobileLayout title="Rekonsiliasi">
      <div className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    </MobileLayout>
  )

  if (!sesi) return (
    <MobileLayout title="Rekonsiliasi">
      <div className="p-8 text-center text-muted-foreground">Tidak ada sesi aktif</div>
    </MobileLayout>
  )

  return (
    <MobileLayout title="Rekonsiliasi Akhir" showBack>
      <div className="p-4 space-y-4">

        {/* Ringkasan Sesi */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-3">Ringkasan Sesi</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal Awal</span>
                <span className="font-semibold">{formatRupiah(modalTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Koin Keluar</span>
                <span className="font-semibold text-rose-600">{formatRupiah(totalKoinKeluar)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah Toko</span>
                <span className="font-semibold">{trxList.length} toko</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uang Diterima dari Toko</span>
                <span className="font-semibold text-emerald-600">{formatRupiah(totalUangMasuk)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sisa Koin (Auto-hitung) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex justify-between items-center">
              <span>Sisa Koin Dibawa Pulang</span>
              <Badge variant="info">{formatRupiah(sisaKoinTotal)}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Dihitung otomatis oleh sistem</p>
          </CardHeader>
          <CardContent>
            {denomAktifSisa.length > 0 ? (
              <div className="space-y-1.5">
                {denomAktifSisa.map(d => (
                  <div key={d.key} className="flex justify-between text-sm py-1 border-b border-dashed border-border/50 last:border-0">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-semibold">{formatRupiah(sisaDenom[d.key])}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Total Sisa</span>
                  <span className="text-primary">{formatRupiah(sisaKoinTotal)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                ✅ Semua koin telah diserahkan ke toko
              </p>
            )}
          </CardContent>
        </Card>

        {/* Uang Setoran ke Gudang */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Uang Setoran ke Gudang</CardTitle>
            <p className="text-xs text-muted-foreground">Total uang yang kamu setor kembali ke gudang</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Jumlah Setoran (Rp)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="pl-9 h-11 text-base"
                  value={uangSetoran}
                  onChange={handleUangChange}
                  placeholder="0"
                />
              </div>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              selisihUang === 0
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <div>
                <p className="text-xs text-muted-foreground">Selisih Uang</p>
                <p className="text-xs">(Uang Masuk − Setoran)</p>
              </div>
              <div className="flex items-center gap-2">
                {selisihUang === 0
                  ? <><CheckCircle2 size={16} className="text-emerald-600" /><Badge variant="success">✓ LUNAS</Badge></>
                  : <><AlertCircle size={16} className="text-amber-600" /><Badge variant="warning">{formatRupiah(Math.abs(selisihUang))}</Badge></>
                }
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Foto Sisa Koin */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Foto Sisa Koin *</CardTitle>
          </CardHeader>
          <CardContent>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Foto sisa koin" className="w-full rounded-lg max-h-48 object-cover" />
                <button
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="h-24 border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center justify-center gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <Camera size={22} />
                  <span className="text-xs font-medium">Ambil Foto</span>
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ImagePlus size={22} />
                  <span className="text-xs font-medium">Dari Galeri</span>
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </CardContent>
        </Card>

        {/* Catatan */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan rekonsiliasi, kendala, atau keterangan lain..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Tanda Tangan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tanda Tangan Kasir *</CardTitle>
          </CardHeader>
          <CardContent>
            <canvas ref={ttdCanvas} className="signature-canvas w-full h-28 block rounded-lg" />
            <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => ttdRef.current?.clear()}>
              <RotateCcw size={14} /> Hapus
            </Button>
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          id="submit-rekonsiliasi"
        >
          {saving && <Loader2 size={16} className="animate-spin mr-2" />}
          {saving ? 'Mengirim...' : 'Kirim Rekonsiliasi'}
        </Button>
        {!canSubmit && (
          <p className="text-xs text-muted-foreground text-center pb-4">
            Lengkapi foto dan tanda tangan
          </p>
        )}
      </div>
    </MobileLayout>
  )
}
