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
  // Hybrid: auto-fill dari sistem, koreksi manual hanya jika ada perbedaan
  const [showKoreksi, setShowKoreksi] = useState(false)
  const [sisaKoreksi, setSisaKoreksi] = useState({})
  const [sigUpdate, setSigUpdate] = useState(0)

  const triggerSigUpdate = useCallback(() => setSigUpdate(v => v + 1), [])

  const ttdRef    = useRef(null)
  const ttdCanvas = useRef(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: rows } = await supabase
      .from('sesi_tugas')
      .select('*, modal_koin(*)')
      .eq('kasir_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1)
    const s = rows?.[0] ?? null
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
    pad.addEventListener('endStroke', triggerSigUpdate)
    
    const resize = () => {
      const c = ttdCanvas.current; if (!c) return
      const r = Math.max(window.devicePixelRatio || 1, 1)
      c.width = c.offsetWidth * r; c.height = c.offsetHeight * r
      c.getContext('2d').scale(r, r); pad.clear()
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      pad.removeEventListener('endStroke', triggerSigUpdate)
      pad.off()
    }
  }, [loading, triggerSigUpdate])

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
  const selisihUang     = totalUangMasuk - uangSetoranNum

  // Nilai aktual: pakai koreksi manual jika showKoreksi, else pakai auto-fill sistem
  const sisaAktual = showKoreksi ? sisaKoreksi : sisaDenom
  const sisaAktualNilai = DENOM_LIST.reduce((s, d) => s + (parseInt(sisaAktual[d.key] || 0)), 0)
  const selisihKoin = sisaAktualNilai - sisaKoinTotal

  const denomAktifSisa = DENOM_LIST.filter(d => sisaDenom[d.key] > 0)

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

      // sisaAktual & sisaAktualNilai sudah dihitung di atas (auto atau koreksi)
      const isBalanced = selisihKoin === 0 && selisihUang === 0

      // Task 19: atomic RPC — INSERT rekonsiliasi + UPDATE sesi dalam satu transaksi
      const { error } = await supabase.rpc('submit_rekonsiliasi', {
        p_sesi_id:           sesi.id,
        p_sisa_koin_100:     parseInt(sisaAktual.koin_100   || 0),
        p_sisa_koin_200:     parseInt(sisaAktual.koin_200   || 0),
        p_sisa_koin_500:     parseInt(sisaAktual.koin_500   || 0),
        p_sisa_koin_1000:    parseInt(sisaAktual.koin_1000  || 0),
        p_sisa_koin_2000:    parseInt(sisaAktual.koin_2000  || 0),
        p_sisa_koin_5000:    parseInt(sisaAktual.koin_5000  || 0),
        p_sisa_koin_10000:   parseInt(sisaAktual.koin_10000 || 0),
        p_sisa_koin_20000:   parseInt(sisaAktual.koin_20000 || 0),
        p_sisa_koin_nilai:   sisaAktualNilai,
        p_expected_sisa:     sisaKoinTotal,
        p_total_koin_keluar: totalKoinKeluar,
        p_total_uang_masuk:  totalUangMasuk,
        p_uang_setoran:      uangSetoranNum,
        p_selisih_koin:      selisihKoin,
        p_selisih_uang:      selisihUang,
        p_is_balanced:       isBalanced,
        p_foto_sisa:         photo,
        p_ttd_kasir:         ttd,
        p_catatan:           catatan,
      })
      if (error) throw error
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

        {/* Sisa Koin — Auto-fill dari sistem, koreksi manual jika ada perbedaan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex justify-between items-center">
              <span>Sisa Koin Dibawa Pulang</span>
              <Badge variant="info">{formatRupiah(sisaKoinTotal)}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Dihitung otomatis dari modal dikurangi koin yang diserahkan ke toko</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tampilan auto-fill */}
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

            {/* Tombol laporkan perbedaan */}
            {!showKoreksi ? (
              <button
                type="button"
                onClick={() => {
                  setSisaKoreksi({ ...sisaDenom })
                  setShowKoreksi(true)
                }}
                className="w-full text-xs text-amber-600 border border-amber-200 bg-amber-50 rounded-lg py-2 hover:bg-amber-100 transition-colors"
              >
                ⚠️ Ada perbedaan dengan hitungan fisik? Laporkan di sini
              </button>
            ) : (
              <div className="space-y-3 border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-800">Koreksi Hitungan Fisik</p>
                  <button
                    type="button"
                    onClick={() => { setShowKoreksi(false); setSisaKoreksi({}) }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Batalkan
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DENOM_LIST.map((d) => {
                    const expected = sisaDenom[d.key]
                    const aktual = parseInt(sisaKoreksi[d.key] ?? expected)
                    const selisih = aktual - expected
                    return (
                      <div key={d.key} className="space-y-1">
                        <Label className="text-xs">{d.label}</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="text" inputMode="numeric"
                            className={`h-9 pl-7 bg-white ${selisih !== 0 ? 'border-amber-400' : ''}`}
                            value={aktual.toLocaleString('id-ID')}
                            onChange={(e) => {
                              const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                              setSisaKoreksi(prev => ({ ...prev, [d.key]: val }))
                            }}
                          />
                        </div>
                        {selisih !== 0 && (
                          <p className="text-xs text-amber-700">
                            {selisih > 0 ? '+' : ''}{formatRupiah(selisih)} vs sistem
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Status selisih koreksi */}
                {selisihKoin !== 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-100 rounded text-xs text-amber-800">
                    <AlertCircle size={14} />
                    <span>Selisih koin: <strong>{selisihKoin > 0 ? '+' : ''}{formatRupiah(selisihKoin)}</strong> — akan dilaporkan ke Manager</span>
                  </div>
                )}
                {selisihKoin === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                    <CheckCircle2 size={14} />
                    <span>Koreksi sesuai dengan hitungan sistem</span>
                  </div>
                )}
              </div>
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
            <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => { ttdRef.current?.clear(); triggerSigUpdate(); }}>
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
