import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { formatRupiah, formatDateTime, formatDate, SESSION_STATUS, ASSIGNMENT_STATUS, DENOM_LIST } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export default function SesiDetail() {
  const { id }       = useParams()
  const { role, profile } = useAuth()
  const roles = Array.isArray(role) ? role : [role]
  const navigate     = useNavigate()
  const { toast }    = useToast()
  const [sesi, setSesi]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog]   = useState(null) // 'approve'|'reject'|'approve_close'|'reject_close'
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving]   = useState(false)

  const fetchSesi = useCallback(async () => {
    const { data } = await supabase.from('sesi_tugas')
      .select(`*, kasir:kasir_id(name,nik), driver:driver_id(name), mobil:mobil_id(nopol),
        modal_koin(*), toko_assignment(*, toko:toko_id(kode_toko,nama_toko)),
        transaksi(*, toko:toko_id(kode_toko,nama_toko)),
        rekonsiliasi(*)`)
      .eq('id', id).single()
    setSesi(data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchSesi() }, [fetchSesi])

  const handleAction = async () => {
    setSaving(true)
    try {
      if (dialog === 'approve') {
        // Fetch modal_koin LANGSUNG dari DB — jangan pakai sesi.modal_koin (bisa stale/null dari join)
        const { data: modalKoin, error: modalErr } = await supabaseAdmin
          .from('modal_koin').select('*').eq('sesi_tugas_id', id).single()
        if (modalErr || !modalKoin) throw new Error('Data modal koin tidak ditemukan: ' + (modalErr?.message || 'null'))

        const { data: currentStok, error: stokErr } = await supabaseAdmin
          .from('stok_gudang').select('*').single()
        if (stokErr || !currentStok) throw new Error('Stok gudang tidak ditemukan: ' + stokErr?.message)

        // ⚠️ Safety check — pastikan stok masih cukup saat approve (prevent race condition)
        const insufficientDenoms = DENOM_LIST.filter(d => (modalKoin[d.key] || 0) > (currentStok[d.key] || 0))
        if (insufficientDenoms.length > 0) {
          const detail = insufficientDenoms.map(d =>
            `${d.label}: butuh ${formatRupiah(modalKoin[d.key])} tapi stok hanya ${formatRupiah(currentStok[d.key] || 0)}`
          ).join('\n')
          throw new Error(`Stok tidak mencukupi!\n${detail}\n\nKemungkinan sesi lain sudah diapprove lebih dulu. Kurangi modal sesi ini lalu coba lagi.`)
        }

        // Hitung stok baru setelah dikurangi modal
        const updates = DENOM_LIST.reduce((acc, d) => {
          acc[d.key] = Math.max(0, (currentStok[d.key] || 0) - (modalKoin[d.key] || 0))
          return acc
        }, {})

        const { error: updateErr } = await supabaseAdmin.from('stok_gudang')
          .update({ ...updates, updated_by: profile.id, last_updated: new Date().toISOString() })
          .eq('id', currentStok.id)
        if (updateErr) throw new Error('Gagal update stok: ' + updateErr.message)

        // Catat ke log — keluar modal
        const deltaTotal = DENOM_LIST.reduce((sum, d) => sum - (modalKoin[d.key] || 0), 0)
        const denomDetail = DENOM_LIST.filter(d => modalKoin[d.key] > 0)
          .map(d => `${d.label}: ${formatRupiah(modalKoin[d.key])}`).join(' | ')
        const { error: logErr } = await supabaseAdmin.from('stok_gudang_log').insert({
          tipe: 'keluar_modal',
          keterangan: `Modal diambil oleh kasir — Sesi ${id.slice(0,8)} | ${denomDetail || 'tidak ada modal'}`,
          sesi_tugas_id: id, delta_total: deltaTotal, created_by: profile.id,
          ...DENOM_LIST.reduce((acc, d) => { acc[`delta_${d.key.replace('koin_', '')}`] = -(modalKoin[d.key] || 0); return acc }, {})
        })
        if (logErr) console.error('Log approve error:', logErr.message)

        await supabase.from('sesi_tugas').update({
          status: 'active', approved_by: profile.id,
          approved_at: new Date().toISOString(), catatan_approval: catatan
        }).eq('id', id)
        const deducted = DENOM_LIST.filter(d => modalKoin[d.key] > 0).map(d => `${d.label}: -${formatRupiah(modalKoin[d.key])}`).join(', ')
        toast({ title: '✅ Disetujui', description: `Stok gudang dikurangi: ${deducted || '(tidak ada modal)'}`, variant: 'success' })

      } else if (dialog === 'reject') {
        await supabase.from('sesi_tugas').update({ status: 'draft', catatan_approval: catatan }).eq('id', id)
        toast({ title: 'Ditolak', description: 'Sesi dikembalikan ke draft.' })

      } else if (dialog === 'approve_close') {
        // Fetch rekonsiliasi LANGSUNG dari DB
        const { data: rek, error: rekErr } = await supabaseAdmin
          .from('rekonsiliasi').select('*').eq('sesi_tugas_id', id).single()
        if (rekErr || !rek) throw new Error('Data rekonsiliasi tidak ditemukan: ' + (rekErr?.message || 'null'))

        const { data: currentStok, error: stokErr } = await supabaseAdmin
          .from('stok_gudang').select('*').single()
        if (stokErr || !currentStok) throw new Error('Stok gudang tidak ditemukan: ' + stokErr?.message)

        // Tambah sisa koin ke stok
        const updates = DENOM_LIST.reduce((acc, d) => {
          const sisaKey = `sisa_koin_${d.key.replace('koin_', '')}`
          acc[d.key] = (currentStok[d.key] || 0) + (rek[sisaKey] || 0)
          return acc
        }, {})

        // Tambah uang besar yang diterima kasir selama sesi ke stok gudang
        const { data: trxList } = await supabaseAdmin
          .from('transaksi').select('uang_50000, uang_100000').eq('sesi_tugas_id', id)
        const totalUang50k  = (trxList || []).reduce((s, t) => s + (t.uang_50000  || 0), 0)
        const totalUang100k = (trxList || []).reduce((s, t) => s + (t.uang_100000 || 0), 0)
        updates.uang_50000  = (currentStok.uang_50000  || 0) + totalUang50k
        updates.uang_100000 = (currentStok.uang_100000 || 0) + totalUang100k

        const { error: updateErr } = await supabaseAdmin.from('stok_gudang')
          .update({ ...updates, updated_by: profile.id, last_updated: new Date().toISOString() })
          .eq('id', currentStok.id)
        if (updateErr) throw new Error('Gagal update stok: ' + updateErr.message)

        // Catat ke log — masuk sisa koin + uang besar
        const deltaKoin  = DENOM_LIST.reduce((sum, d) => sum + (rek[`sisa_koin_${d.key.replace('koin_','')}` ] || 0), 0)
        const deltaUang  = totalUang50k + totalUang100k
        const deltaTotal = deltaKoin + deltaUang
        const { error: logErr2 } = await supabaseAdmin.from('stok_gudang_log').insert({
          tipe: 'masuk_sisa',
          keterangan: `Sesi ditutup — Sisa koin: ${formatRupiah(deltaKoin)} | Uang besar: ${formatRupiah(deltaUang)} | Sesi ${id.slice(0,8)}`,
          sesi_tugas_id: id, delta_total: deltaTotal, created_by: profile.id,
        })
        if (logErr2) console.error('Log close error:', logErr2.message)

        await supabase.from('sesi_tugas').update({
          status: 'closed', closed_by: profile.id,
          closed_at: new Date().toISOString(), catatan_close: catatan
        }).eq('id', id)
        toast({ title: '✅ Sesi Ditutup', description: `Koin: +${formatRupiah(deltaKoin)} | Uang besar: +${formatRupiah(deltaUang)}`, variant: 'success' })

      } else if (dialog === 'reject_close') {
        await supabase.from('sesi_tugas').update({ status: 'active' }).eq('id', id)
        if (sesi.rekonsiliasi) await supabase.from('rekonsiliasi').delete().eq('sesi_tugas_id', id)
        toast({ title: 'Ditolak', description: 'Rekonsiliasi ditolak. Kasir harus input ulang.' })
      }
      setDialog(null); setCatatan(''); fetchSesi()
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }



  if (loading) return (
    <DashboardLayout>
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </DashboardLayout>
  )

  const rawStatus = sesi?.status
  const rek    = sesi?.rekonsiliasi
  const status = (rawStatus === 'active' && rek) ? 'pending_close' : rawStatus
  
  const isAdminOrManager = roles.includes('admin') || roles.includes('manager')
  const canApprove = isAdminOrManager && status === 'pending_approval'
  const canClose   = isAdminOrManager && status === 'pending_close'
  const canEdit    = roles.includes('admin') && status === 'draft'

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/sesi')}><ArrowLeft size={18} /></Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="page-title">Detail Sesi Tugas</h1>
                <Badge variant={SESSION_STATUS[status]?.variant || 'secondary'}>{SESSION_STATUS[status]?.label}</Badge>
              </div>
              <p className="page-subtitle">{formatDate(sesi?.tanggal)} · {sesi?.kasir?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && <Button variant="outline" onClick={() => navigate(`/dashboard/sesi/edit/${id}`)}>Edit Draft</Button>}
            {canApprove && (
              <>
                <Button variant="destructive" onClick={() => setDialog('reject')}><XCircle size={16} /> Tolak</Button>
                <Button variant="success" onClick={() => setDialog('approve')}><CheckCircle2 size={16} /> Setujui</Button>
              </>
            )}
            {canClose && (
              <>
                <Button variant="destructive" onClick={() => setDialog('reject_close')}><XCircle size={16} /> Tolak Penutupan</Button>
                <Button variant="success" onClick={() => setDialog('approve_close')}><CheckCircle2 size={16} /> Tutup Sesi</Button>
              </>
            )}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Kasir', value: sesi?.kasir?.name },
            { label: 'Driver', value: sesi?.driver?.name },
            { label: 'Kendaraan', value: sesi?.mobil?.nopol },
            { label: 'Total Modal', value: formatRupiah(sesi?.modal_koin?.total_nilai) },
          ].map(({ label, value }) => (
            <Card key={label}><CardContent className="p-4"><p className="stat-label">{label}</p><p className="font-semibold mt-1">{value || '-'}</p></CardContent></Card>
          ))}
        </div>

        {/* Notes */}
        {sesi?.catatan_approval && (
          <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 flex gap-2"><AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-amber-800">Catatan Approval</p><p className="text-sm text-amber-700">{sesi.catatan_approval}</p></div></CardContent></Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="modal">
          <TabsList><TabsTrigger value="modal">Modal Koin</TabsTrigger><TabsTrigger value="toko">Toko ({sesi?.toko_assignment?.length})</TabsTrigger><TabsTrigger value="transaksi">Transaksi ({sesi?.transaksi?.length})</TabsTrigger>{rek && <TabsTrigger value="rekonsiliasi">Rekonsiliasi</TabsTrigger>}</TabsList>

          <TabsContent value="modal">
            <Card><CardContent className="p-5"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DENOM_LIST.map((d) => {
                const nilai = sesi?.modal_koin?.[d.key] || 0
                return (
                  <div key={d.key} className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                    <p className="text-base font-bold text-primary">{formatRupiah(nilai)}</p>
                  </div>
                )
              })}
            </div></CardContent></Card>
          </TabsContent>

          <TabsContent value="toko">
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>No</TableHead><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Status</TableHead><TableHead>Alasan Skip</TableHead></TableRow></TableHeader>
              <TableBody>
                {sesi?.toko_assignment?.sort((a,b)=>a.urutan-b.urutan).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.urutan}</TableCell>
                    <TableCell className="font-mono">{a.toko?.kode_toko}</TableCell>
                    <TableCell>{a.toko?.nama_toko}</TableCell>
                    <TableCell><Badge variant={ASSIGNMENT_STATUS[a.status]?.variant||'secondary'}>{ASSIGNMENT_STATUS[a.status]?.icon} {ASSIGNMENT_STATUS[a.status]?.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.alasan_skip || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="transaksi">
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Toko</TableHead><TableHead>Waktu</TableHead><TableHead>Total Koin</TableHead><TableHead>Total Uang</TableHead><TableHead>Selisih</TableHead></TableRow></TableHeader>
              <TableBody>
                {sesi?.transaksi?.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada transaksi</TableCell></TableRow>
                : sesi?.transaksi?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell><p className="font-mono text-xs">{t.toko?.kode_toko}</p><p className="text-sm">{t.toko?.nama_toko}</p></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(t.tanggal_waktu)}</TableCell>
                    <TableCell>{formatRupiah(t.total_koin_nilai)}</TableCell>
                    <TableCell>{formatRupiah(t.total_uang_diterima)}</TableCell>
                    <TableCell><Badge variant={t.selisih === 0 ? 'success' : 'destructive'}>{t.selisih === 0 ? '✓ 0' : formatRupiah(t.selisih)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          {rek && (
            <TabsContent value="rekonsiliasi">
              <Card><CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground uppercase tracking-wide">Expected Sisa</p><p className="text-xl font-bold mt-1">{formatRupiah(rek.expected_sisa_koin)}</p></div>
                  <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground uppercase tracking-wide">Aktual Sisa</p><p className="text-xl font-bold mt-1">{formatRupiah(rek.sisa_koin_nilai)}</p></div>
                </div>
                <div className="flex gap-4">
                  <Badge variant={rek.selisih_koin === 0 ? 'success' : 'destructive'} className="text-sm px-3 py-1.5">
                    Selisih Koin: {rek.selisih_koin === 0 ? '✓ Seimbang' : formatRupiah(rek.selisih_koin)}
                  </Badge>
                  <Badge variant={rek.selisih_uang === 0 ? 'success' : 'destructive'} className="text-sm px-3 py-1.5">
                    Selisih Uang: {rek.selisih_uang === 0 ? '✓ Seimbang' : formatRupiah(rek.selisih_uang)}
                  </Badge>
                </div>
                {rek.catatan && <div className="rounded-lg bg-muted p-3 text-sm">{rek.catatan}</div>}
                {rek.foto_sisa && <img src={rek.foto_sisa} alt="Foto sisa" className="rounded-lg max-h-48 object-cover" />}
              </CardContent></Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === 'approve'       && 'Setujui Keberangkatan'}
              {dialog === 'reject'        && 'Tolak Keberangkatan'}
              {dialog === 'approve_close' && 'Setujui Penutupan Sesi'}
              {dialog === 'reject_close'  && 'Tolak Penutupan Sesi'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              {(dialog === 'approve' || dialog === 'approve_close') ? 'Tindakan ini tidak dapat dibatalkan setelah disimpan.' : 'Berikan catatan penolakan untuk kasir / admin.'}
            </p>
            <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button
              variant={dialog?.includes('reject') ? 'destructive' : 'default'}
              onClick={handleAction} disabled={saving}
            >
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              {dialog?.includes('approve') ? 'Ya, Setujui' : 'Ya, Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
