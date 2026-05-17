import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ArrowRight, Check, Loader2, ClipboardList, ChevronUp, ChevronDown } from 'lucide-react'
import { formatRupiah, formatNumber, DENOM_LIST, calculateDenomTotal, todayISO, emptyDenoms } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const STEPS = ['Tim & Kendaraan', 'Pilih Toko', 'Modal Koin', 'Review & Submit']

export default function BuatSesi() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [kasirList, setKasirList] = useState([])
  const [driverList, setDriverList] = useState([])
  const [mobilList, setMobilList] = useState([])
  const [stok, setStok] = useState(null)
  const [stokEfektif, setStokEfektif] = useState(null)  // stok dikurangi modal pending sesi lain
  const [tim, setTim] = useState({ tanggal: todayISO(), mobil_id: '', kasir_id: '', driver_id: '', nama_polisi: '' })

  // Step 2
  const [tokoAll, setTokoAll] = useState([])
  const [selectedToko, setSelectedToko] = useState([])
  const [tokoSearch, setTokoSearch] = useState('')

  // Step 3
  const [modal, setModal] = useState(emptyDenoms())

  useEffect(() => {
    const loadMasterData = async () => {
      const [kasir, driver, mobil, tokoRes, stokRes] = await Promise.all([
        supabase.from('users').select('id,name').contains('role', ['kasir']).eq('is_active', true),
        supabase.from('users').select('id,name').contains('role', ['driver']).eq('is_active', true),
        supabase.from('mobil').select('id,nopol').eq('is_active', true),
        supabase.from('toko').select('id,kode_toko,nama_toko,area').eq('is_active', true).order('kode_toko'),
        supabase.from('stok_gudang').select('*').single(),
      ])
      setKasirList(kasir.data || [])
      setDriverList(driver.data || [])
      setMobilList(mobil.data || [])
      setTokoAll(tokoRes.data || [])
      setStok(stokRes.data)

      // Hitung stok efektif: stok gudang dikurangi modal yang sudah dipesan oleh sesi pending_approval
      const rawStok = stokRes.data
      if (rawStok) {
        const { data: pendingSesi } = await supabase
          .from('modal_koin')
          .select('*')
          .in('sesi_tugas_id',
            (await supabase.from('sesi_tugas').select('id').eq('status','pending_approval')).data?.map(s=>s.id) || []
          )
        const reserved = (pendingSesi || []).reduce((acc, m) => {
          DENOM_LIST.forEach(d => { acc[d.key] = (acc[d.key] || 0) + (m[d.key] || 0) })
          return acc
        }, {})
        const efektif = { ...rawStok }
        DENOM_LIST.forEach(d => { efektif[d.key] = Math.max(0, (rawStok[d.key] || 0) - (reserved[d.key] || 0)) })
        setStokEfektif(efektif)
      }
    }
    loadMasterData()
  }, [])

  // Modal koin disimpan sebagai nilai rupiah per denom, total = jumlah semua nilai
  const modalTotal = Object.values(modal).reduce((sum, v) => sum + (parseInt(v) || 0), 0)

  const validateStep = async () => {
    if (step === 0) {
      if (!tim.tanggal || !tim.mobil_id || !tim.kasir_id || !tim.driver_id || !tim.nama_polisi) {
        toast({ title: 'Lengkapi semua field', variant: 'destructive' }); return false
      }
      // Cek apakah kasir sudah punya sesi aktif/pending
      const { data: existingSesi } = await supabase.from('sesi_tugas')
        .select('id, status').eq('kasir_id', tim.kasir_id)
        .in('status', ['pending_approval', 'active', 'pending_close'])
        .limit(1)
      if (existingSesi?.length > 0) {
        const status = existingSesi[0].status
        toast({ title: 'Kasir sudah punya sesi aktif', description: `Sesi dengan status "${status}" masih berjalan. Selesaikan dulu sebelum membuat sesi baru.`, variant: 'destructive' })
        return false
      }
    }
    if (step === 1 && selectedToko.length === 0) {
      toast({ title: 'Pilih minimal 1 toko', variant: 'destructive' }); return false
    }
    if (step === 2) {
      if (modalTotal === 0) { toast({ title: 'Modal koin harus diisi', variant: 'destructive' }); return false }
      const efektif = stokEfektif || stok   // fallback ke stok jika stokEfektif belum loaded
      for (const d of DENOM_LIST) {
        if ((modal[d.key] || 0) > (efektif?.[d.key] || 0)) {
          const reserved = (stok?.[d.key] || 0) - (efektif?.[d.key] || 0)
          toast({
            title: `${d.label}: Melebihi stok tersedia!`,
            description: `Stok total: ${formatRupiah(stok?.[d.key]||0)} | Sudah dipesan sesi lain: ${formatRupiah(reserved)} | Tersedia: ${formatRupiah(efektif?.[d.key]||0)}`,
            variant: 'destructive'
          }); return false
        }
      }
    }
    return true
  }

  const next = async () => { if (await validateStep()) setStep((s) => s + 1) }
  const prev = () => setStep((s) => s - 1)

  const toggleToko = (id) => {
    setSelectedToko((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const moveToko = (id, dir) => {
    setSelectedToko((prev) => {
      const idx = prev.indexOf(id); if (idx < 0) return prev
      const arr = [...prev]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
        ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  const handleSubmit = async (isDraft) => {
    setSaving(true)
    try {
      const mobil = mobilList.find((m) => m.id === tim.mobil_id)
      const { data: sesiData, error: sesiErr } = await supabase.from('sesi_tugas').insert({
        tanggal: tim.tanggal, mobil_id: tim.mobil_id, kasir_id: tim.kasir_id,
        driver_id: tim.driver_id, nama_polisi: tim.nama_polisi,
        status: isDraft ? 'draft' : 'pending_approval', created_by: profile.id,
      }).select().single()
      if (sesiErr) throw sesiErr

      await supabase.from('modal_koin').insert({ sesi_tugas_id: sesiData.id, ...modal })

      const assignments = selectedToko.map((tokoId, i) => ({
        sesi_tugas_id: sesiData.id, toko_id: tokoId, urutan: i + 1,
      }))
      await supabase.from('toko_assignment').insert(assignments)

      toast({ title: isDraft ? 'Draft tersimpan' : 'Dikirim ke Manager', description: 'Sesi tugas berhasil dibuat', variant: 'success' })
      navigate('/dashboard/sesi')
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const filteredToko = tokoAll.filter((t) =>
    !tokoSearch || t.nama_toko.toLowerCase().includes(tokoSearch.toLowerCase()) || t.kode_toko.toLowerCase().includes(tokoSearch.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/sesi')}><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="page-title flex items-center gap-2"><ClipboardList size={20} /> Buat Sesi Tugas</h1>
            <p className="page-subtitle">Langkah {step + 1} dari {STEPS.length}: {STEPS[step]}</p>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 transition-all
                ${i < step ? 'bg-primary border-primary text-primary-foreground' : i === step ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0 */}
            {step === 0 && (
              <>
                <div className="space-y-1.5"><Label>Tanggal *</Label><Input type="date" value={tim.tanggal} onChange={(e) => setTim((t) => ({ ...t, tanggal: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Kendaraan *</Label>
                  <Select value={tim.mobil_id} onValueChange={(v) => setTim((t) => ({ ...t, mobil_id: v }))} >
                    <SelectTrigger id="mobil-select"><SelectValue placeholder="Pilih kendaraan..." /></SelectTrigger>
                    <SelectContent>{mobilList.map((m) => <SelectItem key={m.id} value={m.id}>{m.nopol}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Kasir *</Label>
                  <Select value={tim.kasir_id} onValueChange={(v) => setTim((t) => ({ ...t, kasir_id: v }))}>
                    <SelectTrigger id="kasir-select"><SelectValue placeholder="Pilih kasir..." /></SelectTrigger>
                    <SelectContent>{kasirList.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Driver *</Label>
                  <Select value={tim.driver_id} onValueChange={(v) => setTim((t) => ({ ...t, driver_id: v }))}>
                    <SelectTrigger id="driver-select"><SelectValue placeholder="Pilih driver..." /></SelectTrigger>
                    <SelectContent>{driverList.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Nama Polisi (STNK) *</Label><Input value={tim.nama_polisi} onChange={(e) => setTim((t) => ({ ...t, nama_polisi: e.target.value }))} placeholder="Nama di STNK" /></div>
              </>
            )}

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-3">
                <Input placeholder="Cari toko..." value={tokoSearch} onChange={(e) => setTokoSearch(e.target.value)} />
                <p className="text-xs text-muted-foreground">{selectedToko.length} toko dipilih</p>
                <div className="max-h-72 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                  {filteredToko.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted cursor-pointer">
                      <Checkbox checked={selectedToko.includes(t.id)} onCheckedChange={() => toggleToko(t.id)} id={`toko-${t.id}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.nama_toko}</p>
                        <p className="text-xs text-muted-foreground">{t.kode_toko} · {t.area}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedToko.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Urutan Kunjungan:</p>
                    <div className="space-y-1.5">
                      {selectedToko.map((id, i) => {
                        const t = tokoAll.find((x) => x.id === id)
                        return (
                          <div key={id} className="flex items-center gap-2 p-2.5 border rounded-lg bg-muted/30">
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                            <p className="text-sm flex-1">{t?.nama_toko}</p>
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveToko(id, -1)} disabled={i === 0} className="p-0.5 hover:bg-muted rounded disabled:opacity-30"><ChevronUp size={14} /></button>
                              <button onClick={() => moveToko(id, 1)} disabled={i === selectedToko.length - 1} className="p-0.5 hover:bg-muted rounded disabled:opacity-30"><ChevronDown size={14} /></button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Stok Gudang dengan format Rupiah */}
                {stok && stokEfektif && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">STOK TERSEDIA (setelah reservasi pending)</p>
                      <Badge variant="outline" className="text-xs">Real-time</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DENOM_LIST.map((d) => {
                        const reserved = (stok[d.key] || 0) - (stokEfektif[d.key] || 0)
                        return (
                          <div key={d.key} className="text-center">
                            <p className="text-xs text-muted-foreground">{d.label}</p>
                            <p className={`text-sm font-bold ${stokEfektif[d.key] === 0 ? 'text-destructive' : ''}`}>{formatRupiah(stokEfektif[d.key] || 0)}</p>
                            {reserved > 0 && <p className="text-xs text-amber-600">(-{formatRupiah(reserved)} pending)</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Input Nominal (bukan qty) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DENOM_LIST.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <Label className="text-xs font-medium">{d.label}</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <Input
                          type="text" inputMode="numeric"
                          value={modal[d.key] ? modal[d.key].toLocaleString('id-ID') : ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                            setModal((m) => ({ ...m, [d.key]: val }))
                          }}
                          className={`h-9 pl-7 ${(modal[d.key] || 0) > ((stokEfektif || stok)?.[d.key] || 0) ? 'border-destructive' : ''}`}
                        />
                      </div>
                      {(modal[d.key] || 0) > ((stokEfektif || stok)?.[d.key] || 0) && (
                        <p className="text-xs text-destructive">Melebihi stok tersedia</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Modal</p>
                  <p className="text-2xl font-bold text-primary mt-1">{formatRupiah(modalTotal)}</p>
                </div>
              </div>
            )}

            {/* Step 3 - Review */}
            {step === 3 && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tanggal', value: tim.tanggal },
                    { label: 'Kendaraan', value: mobilList.find(m => m.id === tim.mobil_id)?.nopol },
                    { label: 'Kasir', value: kasirList.find(k => k.id === tim.kasir_id)?.name },
                    { label: 'Driver', value: driverList.find(d => d.id === tim.driver_id)?.name },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold mt-0.5">{value || '-'}</p></div>
                  ))}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-2">TOKO ({selectedToko.length})</p>
                  <div className="space-y-1">
                    {selectedToko.map((id, i) => {
                      const t = tokoAll.find((x) => x.id === id)
                      return <p key={id}>{i + 1}. {t?.nama_toko} <span className="text-muted-foreground text-xs">({t?.kode_toko})</span></p>
                    })}
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Modal</p>
                  <p className="text-2xl font-bold text-primary mt-1">{formatRupiah(modalTotal)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={prev} disabled={step === 0}><ArrowLeft size={16} /> Kembali</Button>
          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Simpan Draft</Button>
                <Button onClick={() => handleSubmit(false)} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Kirim ke Manager</Button>
              </>
            ) : (
              <Button onClick={next}>Lanjut <ArrowRight size={16} /></Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
