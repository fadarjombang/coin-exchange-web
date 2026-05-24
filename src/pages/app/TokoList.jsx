import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import MobileLayout from '@/components/layout/MobileLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah, formatTime, ASSIGNMENT_STATUS } from '@/lib/utils'
import { Store, ChevronRight, SkipForward, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

const BADGE_VARIANT = { pending: 'pending', on_progress: 'info', selesai: 'success', skip: 'destructive' }

const SKIP_REASONS = [
  'Stok koin toko masih mencukupi',
  'Toko sedang tutup atau libur',
  'Toko menolak penukaran koin',
  'Kendala akses jalan atau kemacetan',
  'Kendala kendaraan operasional',
  'Alasan operasional lainnya'
]

export default function AppTokoList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [assigns, setAssigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [sesiId, setSesiId] = useState(null)
  const [skipDialog, setSkipDialog] = useState(null)
  const [alasan, setAlasan] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    if (!profile?.id) return
    const { data: rows } = await supabase.from('sesi_tugas').select('id').eq('kasir_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1)
    const sesi = rows?.[0] ?? null
    if (!sesi) { setLoading(false); return }
    setSesiId(sesi.id)
    const { data: assignData } = await supabase.from('toko_assignment')
      .select('*, toko:toko_id(kode_toko,nama_toko,alamat)')
      .eq('sesi_tugas_id', sesi.id).order('urutan')

    // Fetch transaksi separately to avoid join syntax issues
    const { data: trxData } = await supabase.from('transaksi')
      .select('toko_id, total_koin_nilai, created_at')
      .eq('sesi_tugas_id', sesi.id)

    // Merge transaksi into assignments
    const trxMap = (trxData || []).reduce((acc, t) => { acc[t.toko_id] = t; return acc }, {})
    const merged = (assignData || []).map((a) => ({ ...a, transaksi: trxMap[a.toko_id] || null }))
    setAssigns(merged)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { loadData() }, [loadData])

  const handleMulai = async (a) => {
    await supabase.from('toko_assignment').update({ status: 'on_progress', updated_at: new Date().toISOString() }).eq('id', a.id)
    navigate(`/app/toko/${a.id}/transaksi`)
  }

  const handleSkip = async () => {
    if (!alasan) { toast({ title: 'Alasan wajib dipilih', variant: 'destructive' }); return }
    setSaving(true)
    await supabase.from('toko_assignment').update({ status: 'skip', alasan_skip: alasan, updated_at: new Date().toISOString() }).eq('id', skipDialog.id)
    setSaving(false); setSkipDialog(null); setAlasan(''); loadData()
  }

  const filtered = assigns.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.toko?.nama_toko?.toLowerCase().includes(q) || a.toko?.kode_toko?.toLowerCase().includes(q)
  })

  return (
    <MobileLayout title="Daftar Toko">
      <div className="p-4 space-y-3">
        {/* Search bar */}
        {assigns.length > 0 && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau kode toko..."
              className="pl-9 h-10"
            />
          </div>
        )}
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Store size={40} className="mx-auto mb-3 opacity-30" />
              <p>{assigns.length === 0 ? 'Belum ada sesi aktif saat ini' : 'Toko tidak ditemukan'}</p>
            </div>
          ) : filtered.map((a) => {
            const trx = a.transaksi
            return (
              <Card key={a.id} className={a.status === 'on_progress' ? 'border-blue-400 ring-1 ring-blue-400' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{a.urutan}</span>
                      <div>
                        <p className="font-semibold text-sm">{a.toko?.nama_toko}</p>
                        <p className="text-xs text-muted-foreground">{a.toko?.kode_toko}</p>
                      </div>
                    </div>
                    <Badge variant={BADGE_VARIANT[a.status] || 'secondary'}>
                      {ASSIGNMENT_STATUS[a.status]?.label}
                    </Badge>
                  </div>
                  {a.status === 'selesai' && trx && (
                    <p className="text-xs text-muted-foreground mb-2">Selesai {formatTime(trx.created_at)} · {formatRupiah(trx.total_koin_nilai)}</p>
                  )}
                  {a.status === 'skip' && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-2">Alasan: {a.alasan_skip}</p>
                  )}
                  {(a.status === 'pending' || a.status === 'on_progress') && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1" onClick={() => handleMulai(a)}>
                        {a.status === 'on_progress' ? 'Lanjutkan' : 'Mulai Kunjungan'} <ChevronRight size={14} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSkipDialog(a); setAlasan('') }}>
                        <SkipForward size={14} />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
      </div>
      <Dialog open={!!skipDialog} onOpenChange={(o) => !o && setSkipDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lewati Kunjungan Toko</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm font-medium">{skipDialog?.toko?.nama_toko}</p>
            <div className="space-y-1.5">
              <Label htmlFor="alasan-select">Alasan Melewati Toko *</Label>
              <Select value={alasan} onValueChange={setAlasan}>
                <SelectTrigger id="alasan-select">
                  <SelectValue placeholder="Pilih alasan melewati toko..." />
                </SelectTrigger>
                <SelectContent>
                  {SKIP_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialog(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleSkip} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Lewati Toko</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  )
}
