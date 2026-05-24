import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { adminApi } from '@/lib/adminApi'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle, Pencil, Download, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatRupiah, formatDateTime, formatDate, SESSION_STATUS, ASSIGNMENT_STATUS, DENOM_LIST } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { generateSuratTugasPDF } from '@/lib/pdfHelper'

export default function SesiDetail() {
  const { id }       = useParams()
  const { role, profile } = useAuth()
  const roles = Array.isArray(role) ? role : [role]
  const navigate     = useNavigate()
  const { toast }    = useToast()
  const [sesi, setSesi]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog]   = useState(null)
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving]   = useState(false)
  // State untuk koreksi modal koin inline
  const [editModal, setEditModal] = useState(false)
  const [modalForm, setModalForm] = useState({})
  const [savingModal, setSavingModal] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingDraft, setDeletingDraft] = useState(false)

  const fetchSesi = useCallback(async () => {
    const { data } = await supabase.from('sesi_tugas')
      .select(`*, kasir:kasir_id(name,nik,foto_profil), driver:driver_id(name,nik,foto_profil), mobil:mobil_id(nopol,jenis_kendaraan,warna_mobil),
        modal_koin(*), toko_assignment(*, toko:toko_id(kode_toko,nama_toko,as,am)),
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
        await adminApi.approveSession(id, profile.id, catatan)
        toast({ title: 'Disetujui', description: 'Sesi disetujui dan stok gudang telah dikurangi.', variant: 'success' })

      } else if (dialog === 'reject') {
        await supabase.from('sesi_tugas').update({ status: 'draft', catatan_approval: catatan }).eq('id', id)
        toast({ title: 'Ditolak', description: 'Sesi dikembalikan ke draft.' })

      } else if (dialog === 'approve_close') {
        await adminApi.closeSession(id, profile.id, catatan)
        toast({ title: 'Sesi Ditutup', description: 'Sesi berhasil ditutup dan stok gudang diperbarui.', variant: 'success' })

      } else if (dialog === 'reject_close') {
        // Hapus rekonsiliasi lama terlebih dahulu (selalu, bukan hanya jika ada di state)
        await supabase.from('rekonsiliasi').delete().eq('sesi_tugas_id', id)
        // Kembalikan status sesi ke 'active' agar kasir bisa submit ulang
        await supabase.from('sesi_tugas').update({ status: 'active' }).eq('id', id)
        toast({ title: 'Ditolak', description: 'Rekonsiliasi ditolak. Kasir harus input ulang.' })
      }
      setDialog(null); setCatatan(''); fetchSesi()
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleDeleteDraft = async () => {
    setDeletingDraft(true)
    try {
      await supabase.from('toko_assignment').delete().eq('sesi_tugas_id', id)
      await supabase.from('modal_koin').delete().eq('sesi_tugas_id', id)
      await supabase.from('sesi_tugas').delete().eq('id', id)
      navigate('/dashboard/sesi')
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' })
    } finally {
      setDeletingDraft(false)
    }
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
  const rek    = sesi?.rekonsiliasi?.[0] ?? null   // ambil elemen pertama, null jika kosong
  const status = (rawStatus === 'active' && rek) ? 'pending_close' : rawStatus
  
  const isAdmin           = roles.includes('admin') || roles.includes('superadmin')
  const isManager         = roles.includes('manager')
  const isAdminOrManager  = isAdmin || isManager
  const canApprove    = isManager && status === 'pending_approval'   // hanya manager
  const canClose      = isManager && status === 'pending_close'      // hanya manager
  const canEdit       = isAdmin && status === 'draft'                  // hanya admin
  const canEditModal  = isAdmin && status === 'pending_approval'       // hanya admin
  const canDelete     = isAdmin && status === 'draft'                    // hanya admin, hanya draft

  const startEditModal = () => {
    const m = sesi?.modal_koin || {}
    setModalForm(DENOM_LIST.reduce((acc, d) => { acc[d.key] = m[d.key] || 0; return acc }, {}))
    setEditModal(true)
  }

  const saveModal = async () => {
    setSavingModal(true)
    try {
      // Cek stok efektif (stok - modal pending sesi LAIN, bukan sesi ini)
      const { data: rawStok } = await supabase.from('stok_gudang').select('*').maybeSingle()
      const { data: pendingSesiIds } = await supabase.from('sesi_tugas').select('id').eq('status','pending_approval').neq('id', id)
      const sesiIds = (pendingSesiIds || []).map(s => s.id)
      let reserved = {}
      if (sesiIds.length > 0) {
        const { data: pendingModal } = await supabase.from('modal_koin').select('*').in('sesi_tugas_id', sesiIds)
        reserved = (pendingModal || []).reduce((acc, m) => {
          DENOM_LIST.forEach(d => { acc[d.key] = (acc[d.key] || 0) + (m[d.key] || 0) })
          return acc
        }, {})
      }

      // Validasi 1: total modal baru harus sama dengan total alokasi toko
      const totalModalBaru = DENOM_LIST.reduce((s, d) => s + (parseInt(modalForm[d.key] || 0)), 0)
      const totalAlokasi = (sesi?.toko_assignment || []).reduce((s, a) => s + (a.alokasi_koin || 0), 0)
      if (totalModalBaru !== totalAlokasi) {
        toast({
          title: 'Total modal tidak sesuai alokasi',
          description: `Modal baru: ${formatRupiah(totalModalBaru)} | Total alokasi toko: ${formatRupiah(totalAlokasi)}. Keduanya harus sama.`,
          variant: 'destructive'
        })
        return
      }

      // Validasi 2: tiap denom tidak melebihi stok tersedia
      for (const d of DENOM_LIST) {
        const available = Math.max(0, (rawStok[d.key] || 0) - (reserved[d.key] || 0))
        if ((modalForm[d.key] || 0) > available) {
          toast({ title: `${d.label}: melebihi stok tersedia`, description: `Tersedia: ${formatRupiah(available)} (setelah reservasi sesi lain)`, variant: 'destructive' })
          return
        }
      }

      // Update modal_koin
      const { error } = await supabase.from('modal_koin')
        .update({ ...modalForm })
        .eq('sesi_tugas_id', id)
      if (error) throw error

      toast({ title: 'Modal dikoreksi', description: 'Nilai modal koin berhasil diperbarui.' })
      setEditModal(false)
      fetchSesi()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally { setSavingModal(false) }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/sesi')}><ArrowLeft size={18} /></Button>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="page-title">Detail Sesi Tugas</h1>
                <Badge variant={SESSION_STATUS[status]?.variant || 'secondary'}>{SESSION_STATUS[status]?.label}</Badge>
              </div>
              <p className="page-subtitle">{formatDate(sesi?.tanggal)} · {sesi?.kasir?.name}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {sesi && (
              <Button variant="outline" disabled={pdfLoading} onClick={() => generateSuratTugasPDF([sesi], setPdfLoading, toast)}>
                {pdfLoading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Download size={16} className="mr-1.5" />}
                Cetak Surat Tugas
              </Button>
            )}
            {canEdit && <Button variant="outline" onClick={() => navigate(`/dashboard/sesi/edit/${id}`)}>Edit Draft</Button>}
            {canDelete && (
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} /> Hapus Draft
              </Button>
            )}
            {canEditModal && !editModal && (
              <Button variant="outline" onClick={startEditModal}>
                <Pencil size={14} className="mr-1" /> Koreksi Modal
              </Button>
            )}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Kasir', value: sesi?.kasir?.name },
            { label: 'Driver', value: sesi?.driver?.name },
            { label: 'Kendaraan', value: sesi?.mobil?.nopol },
            { label: 'Polisi / Pengawal', value: sesi?.nama_polisi },
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
            <Card><CardContent className="p-5">
              {editModal ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                    Mode Koreksi Modal — ubah nilai yang salah, sistem akan validasi terhadap stok efektif.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {DENOM_LIST.map((d) => (
                      <div key={d.key} className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">{d.label}</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="text" inputMode="numeric"
                            value={modalForm[d.key] ? modalForm[d.key].toLocaleString('id-ID') : ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseInt(e.target.value.replace(/\D/g,''), 10) || 0
                              setModalForm(m => ({ ...m, [d.key]: val }))
                            }}
                            className="h-9 pl-7"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end pt-2 border-t">
                    <Button variant="ghost" onClick={() => setEditModal(false)} disabled={savingModal}>Batal</Button>
                    <Button onClick={saveModal} disabled={savingModal}>
                      {savingModal && <Loader2 size={14} className="animate-spin mr-1" />} Simpan Koreksi
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DENOM_LIST.map((d) => {
                    const nilai = sesi?.modal_koin?.[d.key] || 0
                    return (
                      <div key={d.key} className="rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                        <p className="text-base font-bold text-primary">{formatRupiah(nilai)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="toko">
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>No</TableHead><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Alokasi Koin</TableHead><TableHead>Status</TableHead><TableHead>Alasan Skip</TableHead></TableRow></TableHeader>
              <TableBody>
                {sesi?.toko_assignment?.sort((a,b)=>a.urutan-b.urutan).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.urutan}</TableCell>
                    <TableCell className="font-mono">{a.toko?.kode_toko}</TableCell>
                    <TableCell>{a.toko?.nama_toko}</TableCell>
                    <TableCell className="text-right font-medium">{formatRupiah(a.alokasi_koin || 0)}</TableCell>
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
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Draft Sesi?</AlertDialogTitle>
            <AlertDialogDescription>
              Sesi draft tanggal <strong>{formatDate(sesi?.tanggal)}</strong> untuk kasir <strong>{sesi?.kasir?.name}</strong> akan dihapus permanen beserta semua data toko dan modal koin-nya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDraft}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDraft}
              disabled={deletingDraft}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDraft ? 'Menghapus...' : 'Ya, Hapus Draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
