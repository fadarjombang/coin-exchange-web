import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Receipt, Search, Download, Filter } from 'lucide-react'
import { formatRupiah, formatNumber, formatDateTime, formatDate, todayISO, DENOM_LIST, UANG_LIST, csvCell } from '@/lib/utils'

export default function TransaksiPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter inputs (belum di-apply)
  const [search, setSearch]           = useState('')
  const [selectedArea, setSelectedArea] = useState('all')
  const [dateFrom, setDateFrom]         = useState(todayISO)
  const [dateTo, setDateTo]             = useState(todayISO)

  // Filter aktif — berubah hanya saat tombol Terapkan diklik
  const [activeFrom, setActiveFrom]     = useState(todayISO)
  const [activeTo, setActiveTo]         = useState(todayISO)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch hanya menggunakan activeFrom/activeTo (bukan dateFrom/dateTo)
  const fetch = useCallback(async (from, to) => {
    setLoading(true)
    const { data } = await supabase.from('transaksi')
      .select('*, toko:toko_id(kode_toko, nama_toko, area), kasir:kasir_id(name), sesi:sesi_tugas_id(tanggal)')
      .eq('jenis', 'field')
      .gte('created_at', new Date(`${from}T00:00:00+07:00`).toISOString())
      .lte('created_at', new Date(`${to}T23:59:59+07:00`).toISOString())
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [])

  // Fetch data hari ini saat pertama kali mount
  useEffect(() => {
    fetch(todayISO(), todayISO())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase.from('toko').select('area')
      .then(({ data }) => {
        const unique = Array.from(new Set((data || []).map(t => t.area).filter(Boolean))).sort()
        setAreas(unique)
      })
  }, [])

  useEffect(() => { setCurrentPage(1) }, [search, selectedArea, activeFrom, activeTo])

  // Handler tombol Terapkan — apply filter + fetch
  const handleApply = () => {
    setActiveFrom(dateFrom)
    setActiveTo(dateTo)
    setCurrentPage(1)
    fetch(dateFrom, dateTo)
  }

  const filtered = rows.filter((r) => {
    const matchesSearch = !search || r.toko?.nama_toko?.toLowerCase().includes(search.toLowerCase())
      || r.toko?.kode_toko?.toLowerCase().includes(search.toLowerCase())
      || r.kasir?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesArea = selectedArea === 'all' || r.toko?.area === selectedArea
    return matchesSearch && matchesArea
  })

  const totalNilai    = filtered.reduce((s, r) => s + (r.total_koin_nilai || 0), 0)
  const totalUang     = filtered.reduce((s, r) => s + (r.total_uang_diterima || 0), 0)
  const adaSelisih    = filtered.filter((r) => r.selisih !== 0).length

  const totalPages    = Math.ceil(filtered.length / itemsPerPage)
  const startIndex    = (currentPage - 1) * itemsPerPage
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleExport = () => {

    const header = [
      'Tanggal & Waktu',
      'Kode Toko',
      'Nama Toko',
      'Area',
      'Kasir',
      ...DENOM_LIST.map(d => d.value),
      'Total Koin Keluar',
      ...UANG_LIST.map(u => u.value),
      'Total Uang Masuk',
      'Selisih',
      'PIC Toko'
    ]
    const csvRows = filtered.map((r) => [
      formatDateTime(r.created_at),
      r.toko?.kode_toko || '-',
      r.toko?.nama_toko || '-',
      r.toko?.area || '-',
      r.kasir?.name || '-',
      ...DENOM_LIST.map(d => r[d.key] || 0),
      r.total_koin_nilai || 0,
      ...UANG_LIST.map(u => r[u.key] || 0),
      r.total_uang_diterima || 0,
      r.selisih || 0,
      r.pic_nama || '-'
    ])
    const csv = '\uFEFF' + [header, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `transaksi_lapangan_${activeFrom}_${activeTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Receipt size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Transaksi Lapangan</h1><p className="page-subtitle">Rekap penukaran koin oleh kasir ke setiap toko di lapangan</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0} id="btn-export-csv" className="w-full sm:w-auto">
            <Download size={14} /> Export CSV
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="tour-trx-summary">
          {[
            { label: 'Total Transaksi', value: filtered.length, isMoney: false },
            { label: 'Koin Diserahkan', value: formatRupiah(totalNilai) },
            { label: 'Uang Diterima', value: formatRupiah(totalUang) },
            { label: 'Transaksi Selisih', value: adaSelisih, badge: adaSelisih > 0 ? 'destructive' : 'success', isMoney: false },
          ].map(({ label, value, badge, isMoney = true }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="stat-label">{label}</p>
                {badge
                  ? <Badge variant={badge} className="mt-2 text-base px-2">{value}</Badge>
                  : <p className="stat-value">{isMoney ? value : value}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card id="tour-trx-filters">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label className="text-xs">Dari Tanggal</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label className="text-xs">Sampai Tanggal</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1 w-52" id="tour-trx-area-select">
                <Label className="text-xs">Filter Area</Label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Semua Area" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Area</SelectItem>
                    {areas.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 min-w-[160px]" id="tour-trx-search">
                <Label className="text-xs">Cari</Label>
                <div className="relative mt-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / kode toko / kasir..." className="h-9 pl-8" />
                </div>
              </div>
              <Button size="sm" onClick={handleApply} id="btn-terapkan-filter"><Filter size={14} /> Terapkan</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card id="tour-trx-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Waktu</TableHead>
                    <TableHead className="whitespace-nowrap">Kode Toko</TableHead>
                    <TableHead className="whitespace-nowrap">Nama Toko</TableHead>
                    <TableHead className="whitespace-nowrap">Area</TableHead>
                    <TableHead className="whitespace-nowrap">Kasir</TableHead>
                    {DENOM_LIST.map(d => (
                      <TableHead key={d.key} className="text-right text-xs bg-amber-50/20 whitespace-nowrap">
                        {d.label.replace('Rp ', '')}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold text-amber-600 bg-amber-50/50 whitespace-nowrap">Total Koin</TableHead>
                    {UANG_LIST.map(u => (
                      <TableHead key={u.key} className="text-right text-xs bg-green-50/20 whitespace-nowrap">
                        {u.label.replace('Rp ', '')}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold text-green-600 bg-green-50/50 whitespace-nowrap">Total Uang</TableHead>
                    <TableHead className="whitespace-nowrap">Selisih</TableHead>
                    <TableHead className="whitespace-nowrap">PIC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 19 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  )) : paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={19} className="text-center py-12 text-muted-foreground">
                        Tidak ada data transaksi pada periode ini
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.toko?.kode_toko}</TableCell>
                      <TableCell className="font-medium text-sm whitespace-nowrap">{r.toko?.nama_toko}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.toko?.area || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.kasir?.name || '-'}</TableCell>
                      {DENOM_LIST.map(d => (
                        <TableCell key={d.key} className="text-right text-xs text-muted-foreground">
                          {r[d.key] ? formatNumber(r[d.key]) : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-amber-600 bg-amber-50/10">{formatRupiah(r.total_koin_nilai)}</TableCell>
                      {UANG_LIST.map(u => (
                        <TableCell key={u.key} className="text-right text-xs text-muted-foreground">
                          {r[u.key] ? formatNumber(r[u.key]) : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-green-600 bg-green-50/10">{formatRupiah(r.total_uang_diterima)}</TableCell>
                      <TableCell>
                        <Badge variant={r.selisih === 0 ? 'success' : 'destructive'}>
                          {r.selisih === 0 ? '✓ 0' : formatRupiah(r.selisih)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{r.pic_nama || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filtered.length)} dari {filtered.length} transaksi
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <div className="text-xs font-medium px-2">
                    {currentPage} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
