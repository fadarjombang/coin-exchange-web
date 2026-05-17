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
import { Camera, RotateCcw, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatRupiah, DENOM_LIST, calculateDenomTotal, emptyDenoms } from '@/lib/utils'
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
  const [sisaKoin, setSisaKoin] = useState(emptyDenoms())
  const [uangSetoran, setUangSetoran] = useState(0)
  const [catatan, setCatatan]   = useState('')
  const [photo, setPhoto]       = useState(null)

  const ttdRef    = useRef(null); const ttdCanvas = useRef(null)
  const fileRef   = useRef(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: s } = await supabase.from('sesi_tugas').select('*, modal_koin(*)')
      .eq('kasir_id', profile.id).eq('status','active').maybeSingle()
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
      const r = Math.max(window.devicePixelRatio||1,1); c.width=c.offsetWidth*r; c.height=c.offsetHeight*r; c.getContext('2d').scale(r,r); pad.clear()
    }; resize()
    return () => pad.off()
  }, [loading])

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhoto(await compress(file))
  }

  // sisaKoin disimpan sebagai nilai rupiah per denom, total = sum langsung
  const sisaTotal      = Object.values(sisaKoin).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const totalKoinKeluar = trxList.reduce((s,t)=>s+(t.total_koin_nilai||0),0)
  const totalUangMasuk  = trxList.reduce((s,t)=>s+(t.total_uang_diterima||0),0)
  const expectedSisa    = (sesi?.modal_koin?.total_nilai||0) - totalKoinKeluar
  const selisihKoin     = expectedSisa - sisaTotal
  const selisihUang     = totalKoinKeluar - totalUangMasuk

  const canSubmit = sisaTotal >= 0 && photo && !ttdRef.current?.isEmpty()

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const ttd = ttdRef.current?.toDataURL('image/png')
      await supabase.from('rekonsiliasi').insert({
        sesi_tugas_id: sesi.id, kasir_id: profile.id,
        ...Object.fromEntries(DENOM_LIST.map(d=>[`sisa_koin_${d.key.replace('koin_','')}`,sisaKoin[d.key]||0])),
        sisa_koin_nilai: sisaTotal, expected_sisa_koin: expectedSisa,
        total_uang_masuk: totalUangMasuk, uang_setoran: uangSetoran,
        selisih_koin: selisihKoin, selisih_uang: selisihUang,
        foto_sisa: photo, ttd_kasir: ttd, catatan,
      })
      await supabase.from('sesi_tugas').update({ status: 'pending_close' }).eq('id', sesi.id)
      toast({ title: 'Rekonsiliasi terkirim', description: 'Menunggu persetujuan Manager', variant: 'success' })
      navigate('/app')
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  if (loading) return <MobileLayout title="Rekonsiliasi"><div className="p-4 space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-16 bg-muted rounded-xl animate-pulse"/>)}</div></MobileLayout>

  if (!sesi) return <MobileLayout title="Rekonsiliasi"><div className="p-8 text-center text-muted-foreground">Tidak ada sesi aktif</div></MobileLayout>

  return (
    <MobileLayout title="Rekonsiliasi Akhir" showBack>
      <div className="p-4 space-y-4">
        {/* Summary */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Modal Awal</p><p className="font-bold">{formatRupiah(sesi.modal_koin?.total_nilai)}</p></div>
              <div><p className="text-xs text-muted-foreground">Koin Keluar</p><p className="font-bold">{formatRupiah(totalKoinKeluar)}</p></div>
              <div><p className="text-xs text-muted-foreground">Uang Masuk</p><p className="font-bold">{formatRupiah(totalUangMasuk)}</p></div>
              <div><p className="text-xs text-muted-foreground">Expected Sisa</p><p className="font-bold">{formatRupiah(expectedSisa)}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Sisa Koin Input */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between"><span>Sisa Koin Aktual</span><span className="text-primary">{formatRupiah(sisaTotal)}</span></CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {DENOM_LIST.map((d) => (
                <div key={d.key} className="space-y-1">
                  <Label className="text-xs font-medium">{d.label}</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      type="number" min="0"
                      value={sisaKoin[d.key] || ''}
                      placeholder="0"
                      onChange={(e) => setSisaKoin((k) => ({ ...k, [d.key]: parseInt(e.target.value) || 0 }))}
                      className="h-9 pl-7"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={`mt-3 flex items-center justify-between p-3 rounded-lg ${selisihKoin===0?'bg-emerald-50 border border-emerald-200':'bg-rose-50 border border-rose-200'}`}>
              <span className="text-sm font-medium">Selisih Koin</span>
              <Badge variant={selisihKoin===0?'success':'destructive'}>{selisihKoin===0?'✓ 0':formatRupiah(selisihKoin)}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Uang setoran */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Uang Setoran ke Gudang (Rp)</CardTitle></CardHeader>
          <CardContent>
            <Input type="number" min="0" value={uangSetoran} onChange={(e)=>setUangSetoran(parseInt(e.target.value)||0)} placeholder="Jumlah uang setoran" />
            <div className={`mt-2 flex items-center justify-between p-3 rounded-lg ${selisihUang===0?'bg-emerald-50 border border-emerald-200':'bg-amber-50 border border-amber-200'}`}>
              <span className="text-sm font-medium">Selisih Uang</span>
              <Badge variant={selisihUang===0?'success':'warning'}>{selisihUang===0?'✓ 0':formatRupiah(selisihUang)}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Foto */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Foto Sisa Koin *</CardTitle></CardHeader>
          <CardContent>
            {photo ? (
              <div className="relative"><img src={photo} alt="Foto" className="w-full rounded-lg max-h-48 object-cover"/>
                <button onClick={()=>setPhoto(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"><X size={14}/></button>
              </div>
            ) : (
              <button onClick={()=>fileRef.current?.click()} className="w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera size={24}/><span className="text-sm">Foto Sisa Koin</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/>
          </CardContent>
        </Card>

        {/* Catatan */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea value={catatan} onChange={(e)=>setCatatan(e.target.value)} placeholder="Catatan rekonsiliasi..." rows={3}/>
          </CardContent>
        </Card>

        {/* TTD */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tanda Tangan Kasir *</CardTitle></CardHeader>
          <CardContent>
            <canvas ref={ttdCanvas} className="signature-canvas w-full h-28 block"/>
            <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={()=>ttdRef.current?.clear()}><RotateCcw size={14}/> Hapus</Button>
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={!canSubmit||saving} id="submit-rekonsiliasi">
          {saving&&<Loader2 size={16} className="animate-spin mr-2"/>}{saving?'Mengirim...':'Kirim Rekonsiliasi'}
        </Button>
        {!canSubmit && <p className="text-xs text-muted-foreground text-center pb-4">Lengkapi foto dan tanda tangan</p>}
      </div>
    </MobileLayout>
  )
}
