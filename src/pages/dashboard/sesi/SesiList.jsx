import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { formatRupiah, formatDate, SESSION_STATUS } from '@/lib/utils'

const STATUS_LIST = ['all','draft','pending_approval','active','pending_close','closed']

export default function SesiList() {
  const { role } = useAuth()
  const navigate  = useNavigate()
  const [sesi, setSesi]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')

  const fetchSesi = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi_tugas')
      .select('*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol), modal_koin(total_nilai), toko_assignment(id), rekonsiliasi(id)')
      .order('created_at', { ascending: false })
      
    // Map status: Jika aktif tapi sudah ada rekonsiliasi, treat sebagai pending_close
    const mapped = (data || []).map(s => ({
      ...s,
      status: (s.status === 'active' && s.rekonsiliasi) ? 'pending_close' : s.status
    }))
    setSesi(mapped)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSesi() }, [fetchSesi])

  const filtered = sesi.filter((s) => {
    const matchStatus = filter === 'all' || s.status === filter
    const matchSearch = !search || s.kasir?.name.toLowerCase().includes(search.toLowerCase()) || s.mobil?.nopol.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = STATUS_LIST.reduce((acc, s) => {
    acc[s] = s === 'all' ? sesi.length : sesi.filter((x) => x.status === s).length
    return acc
  }, {})

  const STATUS_LABEL = { all: 'Semua', ...Object.fromEntries(STATUS_LIST.slice(1).map((s) => [s, SESSION_STATUS[s]?.label])) }

  return (
    <DashboardLayout pendingCount={counts.pending_approval + counts.pending_close}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Sesi Tugas</h1><p className="page-subtitle">Manajemen sesi operasi lapangan</p></div>
          </div>
          {role === 'admin' && (
            <Button onClick={() => navigate('/dashboard/sesi/buat')} id="buat-sesi-btn">
              <Plus size={16} /> Buat Sesi
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_LIST.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
              id={`filter-${s}`}>
              {STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-0">
            <div className="relative max-w-sm py-4 px-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kasir atau nopol..." className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Mobil</TableHead>
                  <TableHead>Toko</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({length:5}).map((_,i)=>(
                  <TableRow key={i}>{Array.from({length:7}).map((_,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>
                )) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Tidak ada sesi ditemukan</TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/sesi/${s.id}`)} id={`sesi-row-${s.id}`}>
                    <TableCell className="text-sm">{formatDate(s.tanggal)}</TableCell>
                    <TableCell className="font-medium">{s.kasir?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.driver?.name || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{s.mobil?.nopol || '-'}</TableCell>
                    <TableCell>{s.toko_assignment?.length || 0} toko</TableCell>
                    <TableCell>{formatRupiah(s.modal_koin?.total_nilai || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={SESSION_STATUS[s.status]?.variant || 'secondary'}>
                        {SESSION_STATUS[s.status]?.label || s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
