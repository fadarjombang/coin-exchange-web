import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Camera, ImagePlus, X, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { formatRupiah, DENOM_LIST, calculateDenomTotal, emptyDenoms } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const JABATAN_OPTIONS = [
  'Chief of Store',
  'Store Senior Leader',
  'Store Junior Leader',
]

function SignatureCanvas({ label, padRef, canvasRef, onClear }) {
  useEffect(() => {
    if (!canvasRef.current) return
    const pad = new SignaturePad(canvasRef.current, { backgroundColor: 'rgb(248,250,252)', penColor: '#1e3a5f' })
    padRef.current = pad
    const resize = () => {
      const canvas = canvasRef.current; if (!canvas) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio; canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d').scale(ratio, ratio); pad.clear()
    }
    resize()
    return () => pad.off()
  }, [])

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <canvas ref={canvasRef} className="signature-canvas w-full h-32 block" />
      <Button type="button" variant="ghost" size="sm" onClick={() => { padRef.current?.clear(); onClear?.() }}>
        <RotateCcw size={14} /> Hapus
      </Button>
    </div>
  )
}

export default function TransaksiForm() {
  const { assignmentId } = useParams()
  const { profile }      = useAuth()
  const navigate         = useNavigate()
  const { toast }        = useToast()
  const { compress }     = useImageCompress()

  const [assignment, setAssignment] = useState(null)
  const [sesi, setSesi]             = useState(null)
  const [trxSummary, setTrxSummary] = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  const [picNama, setPicNama]       = useState('')
  const [picJabatan, setPicJabatan] = useState('')
  // koin stores NILAI (Rp), not qty — user types total amount per denom
  const [koin, setKoin]             = useState(emptyDenoms())
  // Uang juga NILAI Rp langsung
  const [uang50, setUang50]         = useState(0)
  const [uang100, setUang100]       = useState(0)
  const [photo, setPhoto]           = useState(null)

  const ttdPicRef       = useRef(null); const ttdPicCanvas    = useRef(null)
  const ttdKasirRef     = useRef(null); const ttdKasirCanvas  = useRef(null)
  const cameraInputRef  = useRef(null)  // capture=environment (kamera langsung)
  const galleryInputRef = useRef(null)  // pilih dari galeri

  // totalKoin = sum nilai rupiah per denom (mode nilai)
  const totalKoin = Object.values(koin).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const totalUang = uang50 + uang100
  const selisih   = totalKoin - totalUang

  const loadData = useCallback(async () => {
    const { data: a } = await supabase.from('toko_assignment')
      .select('*, toko:toko_id(*), sesi_tugas:sesi_tugas_id(*, modal_koin(*))')
      .eq('id', assignmentId).single()
    setAssignment(a)
    setSesi(a?.sesi_tugas)

    const { data: txList } = await supabase.from('transaksi').select('*').eq('sesi_tugas_id', a?.sesi_tugas_id)
    setTrxSummary(txList || [])
    setLoading(false)
  }, [assignmentId])

  useEffect(() => { loadData() }, [loadData])

  // Sisa nilai per denom (nilai modal - nilai yang sudah keluar di transaksi sebelumnya)
  const modalKoin = sesi?.modal_koin || {}
  const sisaDenom = DENOM_LIST.reduce((acc, d) => {
    const modalVal  = (modalKoin[d.key] || 0)  // sudah dalam nilai rupiah (bukan qty)
    const keluarVal = trxSummary.reduce((s, t) => s + (t[d.key] || 0), 0)
    acc[d.key] = Math.max(0, modalVal - keluarVal)
    return acc
  }, {})
  const sisaTotal = Object.values(sisaDenom).reduce((s, v) => s + v, 0)

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const b64 = await compress(file)
      setPhoto(b64)
    } catch { toast({ title: 'Gagal mengompresi foto', variant: 'destructive' }) }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleNilaiChange = (key, rawValue) => {
    const num = parseInt(rawValue.replace(/\D/g, ''), 10) || 0
    const maxVal = sisaDenom[key]
    setKoin((k) => ({ ...k, [key]: Math.min(num, maxVal) }))
  }

  const handleUangChange = (setter, rawValue) => {
    const num = parseInt(rawValue.replace(/\D/g, ''), 10) || 0
    setter(num)
  }

  const canSubmit = picNama.trim() && totalKoin > 0 && selisih === 0 && photo &&
    !ttdPicRef.current?.isEmpty() && !ttdKasirRef.current?.isEmpty()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const ttdPic   = ttdPicRef.current?.toDataURL('image/png')
      const ttdKasir = ttdKasirRef.current?.toDataURL('image/png')

      // Simpan koin sebagai nilai Rp per denom (bukan qty)
      const { error } = await supabase.from('transaksi').insert({
        sesi_tugas_id: assignment.sesi_tugas_id,
        toko_id: assignment.toko_id,
        kasir_id: profile.id,
        ...koin,
        total_koin_nilai: totalKoin,
        uang_50000: uang50,
        uang_100000: uang100,
        total_uang_diterima: totalUang,
        selisih: 0,
        pic_nama: picNama,
        pic_jabatan: picJabatan,
        foto_serah_terima: photo,
        ttd_pic_toko: ttdPic,
        ttd_kasir: ttdKasir,
      })
      if (error) throw error

      await supabase.from('toko_assignment').update({
        status: 'selesai', updated_at: new Date().toISOString()
      }).eq('id', assignmentId)

      navigate(`/app/toko/${assignmentId}/preview`)
    } catch (err) {
      toast({ title: 'Gagal simpan transaksi', description: err.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  if (loading) return <MobileLayout title="Transaksi"><div className="p-4 space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse"/>)}</div></MobileLayout>

  return (
    <MobileLayout title={`Transaksi: ${assignment?.toko?.kode_toko}`} showBack>
      <div className="p-4 space-y-4">

        {/* Toko info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="font-bold">{assignment?.toko?.nama_toko}</p>
            <p className="text-xs text-muted-foreground">{assignment?.toko?.kode_toko} · {assignment?.toko?.alamat}</p>
          </CardContent>
        </Card>

        {/* PIC */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">PIC Toko</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Nama PIC *</Label><Input value={picNama} onChange={(e) => setPicNama(e.target.value)} placeholder="Nama penanggung jawab" /></div>
            <div className="space-y-1.5">
                <Label>Jabatan</Label>
                <Select value={picJabatan} onValueChange={setPicJabatan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jabatan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JABATAN_OPTIONS.map(j => (
                      <SelectItem key={j} value={j}>{j}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </CardContent>
        </Card>

        {/* Koin — input NILAI Rp */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex justify-between">
              <span>Koin Diserahkan</span>
              <span className="text-primary font-bold">{formatRupiah(totalKoin)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Masukkan <strong>total nilai Rp</strong> per denominasi (sisa tersedia dalam kurung)</p>
            <div className="grid grid-cols-2 gap-2">
              {DENOM_LIST.map((d) => (
                <div key={d.key} className="space-y-1">
                  <Label className="text-xs">
                    {d.label} <span className="text-muted-foreground">(maks {formatRupiah(sisaDenom[d.key])})</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      type="text" inputMode="numeric"
                      className="h-9 pl-7"
                      value={(koin[d.key] || 0).toLocaleString('id-ID')}
                      onChange={(e) => handleNilaiChange(d.key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">Sisa modal tersedia: <strong>{formatRupiah(sisaTotal)}</strong></p>
          </CardContent>
        </Card>

        {/* Uang — input NILAI Rp */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Uang Besar Diterima</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Total Rp 50.000</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <Input type="text" inputMode="numeric" className="h-9 pl-7"
                    value={uang50.toLocaleString('id-ID')}
                    onChange={(e) => handleUangChange(setUang50, e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Rp 100.000</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <Input type="text" inputMode="numeric" className="h-9 pl-7"
                    value={uang100.toLocaleString('id-ID')}
                    onChange={(e) => handleUangChange(setUang100, e.target.value)} />
                </div>
              </div>
            </div>
            <Separator />
            <div className={`flex items-center justify-between p-3 rounded-lg ${selisih === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
              <span className="text-sm font-medium">SELISIH</span>
              <div className="flex items-center gap-2">
                {selisih === 0
                  ? <><CheckCircle2 size={16} className="text-emerald-600"/><Badge variant="success">✓ SEIMBANG</Badge></>
                  : <><AlertCircle size={16} className="text-rose-600"/><Badge variant="destructive">{formatRupiah(selisih)}</Badge></>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo — dual button: kamera langsung & galeri */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Foto Serah Terima *</CardTitle></CardHeader>
          <CardContent>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Foto" className="w-full rounded-lg max-h-48 object-cover" />
                <button onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white">
                  <X size={14}/>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {/* Buka kamera langsung */}
                <button onClick={() => cameraInputRef.current?.click()}
                  className="h-24 border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center justify-center gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                  <Camera size={22}/>
                  <span className="text-xs font-medium">Ambil Foto</span>
                </button>
                {/* Pilih dari galeri */}
                <button onClick={() => galleryInputRef.current?.click()}
                  className="h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted transition-colors">
                  <ImagePlus size={22}/>
                  <span className="text-xs font-medium">Dari Galeri</span>
                </button>
              </div>
            )}
            {/* Camera — capture langsung */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            {/* Gallery — tanpa capture, buka file picker */}
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </CardContent>
        </Card>

        {/* Signatures */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tanda Tangan *</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SignatureCanvas label="Tanda Tangan PIC Toko" padRef={ttdPicRef} canvasRef={ttdPicCanvas} />
            <Separator/>
            <SignatureCanvas label="Tanda Tangan Kasir" padRef={ttdKasirRef} canvasRef={ttdKasirCanvas} />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={!canSubmit || saving} id="submit-transaksi">
          {saving && <Loader2 size={16} className="animate-spin mr-2"/>}
          {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
        </Button>
        {!canSubmit && <p className="text-xs text-muted-foreground text-center pb-4">Lengkapi semua field dan pastikan selisih = 0</p>}
      </div>
    </MobileLayout>
  )
}
