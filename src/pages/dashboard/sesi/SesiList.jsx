import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList, Plus, Search, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatRupiah, formatDate, SESSION_STATUS, todayISO, getPastDateISO } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { generateSuratTugasPDF } from '@/lib/pdfHelper'

const STATUS_LIST = ['all', 'draft', 'pending_approval', 'active', 'pending_close', 'closed']

export default function SesiList() {
  const { role } = useAuth()
  const { toast } = useToast()
  const roles = Array.isArray(role) ? role : [role]
  const navigate = useNavigate()
  const [sesi, setSesi] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedSesi, setSelectedSesi] = useState([])
  const [pdfLoading, setPdfLoading] = useState(false)

  // Date filter states
  const [dateFrom, setDateFrom] = useState(() => getPastDateISO(7))
  const [dateTo, setDateTo] = useState(todayISO)
  const [activeFrom, setActiveFrom] = useState(() => getPastDateISO(7))
  const [activeTo, setActiveTo] = useState(todayISO)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  const fetchSesi = useCallback(async (from, to) => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi_tugas')
      .select('*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol), modal_koin(total_nilai), toko_assignment(id), rekonsiliasi(id)')
      .gte('tanggal', from)
      .lte('tanggal', to)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    // Map status: Jika aktif tapi sudah ada rekonsiliasi, treat sebagai pending_close
    const mapped = (data || []).map(s => ({
      ...s,
      status: (s.status === 'active' && s.rekonsiliasi?.length > 0) ? 'pending_close' : s.status
    }))
    setSesi(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSesi(activeFrom, activeTo)
  }, [fetchSesi, activeFrom, activeTo])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search, activeFrom, activeTo])

  const filtered = sesi.filter((s) => {
    const matchStatus = filter === 'all' || s.status === filter
    const matchSearch = !search || s.kasir?.name.toLowerCase().includes(search.toLowerCase()) || s.mobil?.nopol.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedSesi = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const getPageNumbers = () => {
    const pages = []
    const range = 2
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…')
      }
    }
    return pages
  }
  const pageNumbers = getPageNumbers()

  const counts = STATUS_LIST.reduce((acc, s) => {
    acc[s] = s === 'all' ? sesi.length : sesi.filter((x) => x.status === s).length
    return acc
  }, {})

  const STATUS_LABEL = { all: 'Semua', ...Object.fromEntries(STATUS_LIST.slice(1).map((s) => [s, SESSION_STATUS[s]?.label])) }

  const handlePrintBulk = async () => {
    setPdfLoading(true)
    try {
      const { data, error } = await supabase.from('sesi_tugas')
        .select(`*, kasir:kasir_id(name,nik,foto_profil), driver:driver_id(name,nik,foto_profil), mobil:mobil_id(nopol,jenis_kendaraan,warna_mobil),
          modal_koin(*), toko_assignment(*, toko:toko_id(kode_toko,nama_toko,as,am)),
          transaksi(*, toko:toko_id(kode_toko,nama_toko)),
          rekonsiliasi(*)`)
        .in('id', selectedSesi)
      if (error) throw error

      const sortedData = data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      await generateSuratTugasPDF(sortedData, setPdfLoading, toast)
      setSelectedSesi([])
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
      setPdfLoading(false)
    }
  }

  return (
    <DashboardLayout pendingCount={counts.pending_approval + counts.pending_close}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Sesi Tugas</h1><p className="page-subtitle">Kelola penugasan dan pantau aktivitas kasir di lapangan</p></div>
          </div>
          {roles.includes('admin') && (
            <Button onClick={() => navigate('/dashboard/sesi/buat')} id="buat-sesi-btn" className="w-full sm:w-auto">
              <Plus size={16} /> Buat Sesi
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap" id="tour-sesi-filters">
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 px-0">
              <div className="relative flex-1 max-w-sm w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="tour-sesi-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kasir atau nopol..." className="pl-9" />
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-end gap-2 w-full md:w-auto">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs text-muted-foreground">Dari</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 w-full sm:w-36 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs text-muted-foreground">Sampai</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-full sm:w-36 text-xs bg-background"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 px-3 gap-1 col-span-2 sm:col-auto animate-fade-in"
                  onClick={() => {
                    setActiveFrom(dateFrom)
                    setActiveTo(dateTo)
                  }}
                >
                  <Search size={13} /> Tampilkan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedSesi.length > 0 && paginatedSesi.every(s => selectedSesi.includes(s.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const currentIds = paginatedSesi.map(s => s.id)
                            setSelectedSesi(prev => [...new Set([...prev, ...currentIds])])
                          } else {
                            const currentIds = paginatedSesi.map(s => s.id)
                            setSelectedSesi(prev => prev.filter(id => !currentIds.includes(id)))
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Mobil</TableHead>
                    <TableHead>Pengawal</TableHead>
                    <TableHead>Toko</TableHead>
                    <TableHead>Modal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  )) : paginatedSesi.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Tidak ada sesi ditemukan</TableCell></TableRow>
                  ) : paginatedSesi.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/sesi/${s.id}`)} id={`sesi-row-${s.id}`}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSesi.includes(s.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedSesi(prev => [...prev, s.id])
                            } else {
                              setSelectedSesi(prev => prev.filter(id => id !== s.id))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(s.tanggal)}</TableCell>
                      <TableCell className="font-medium">{s.kasir?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{s.driver?.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{s.mobil?.nopol || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.nama_polisi || '-'}</TableCell>
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
            </div>

            {/* Pagination Controls */}
            {!loading && filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>
                  Total {filtered.length} sesi &middot; Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  {pageNumbers.map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === currentPage ? 'default' : 'outline'}
                        size="icon" className="h-7 w-7 text-xs"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {selectedSesi.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border border-border px-6 py-4 rounded-xl shadow-lg flex items-center gap-4 z-50 animate-slide-up">
            <span className="text-sm font-semibold">{selectedSesi.length} sesi terpilih</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSesi([])}>Batal</Button>
              <Button size="sm" disabled={pdfLoading} onClick={handlePrintBulk}>
                {pdfLoading ? <Loader2 className="animate-spin mr-1.5 w-4 h-4" /> : <Download className="mr-1.5 w-4 h-4" />}
                Cetak Surat Tugas
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
