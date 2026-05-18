import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Receipt, Search, Download, Filter } from 'lucide-react'
import { formatRupiah, formatDateTime, formatDate, todayISO } from '@/lib/utils'

export default function TransaksiPage() {
  const navigate = useNavigate()
  const [rows, setRows]       = useState([])
  const [areas, setAreas]     = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch]     = useState('')
  const [selectedArea, setSelectedArea] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(todayISO())

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('transaksi')
      .select('*, toko:toko_id(kode_toko, nama_toko, area), kasir:kasir_id(name), sesi:sesi_tugas_id(tanggal)')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false })

    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => {
    supabase.from('toko').select('area')
      .then(({ data }) => {
        const unique = Array.from(new Set((data || []).map(t => t.area).filter(Boolean))).sort()
        setAreas(unique)
      })
  }, [])

  const filtered = rows.filter((r) => {
    const matchesSearch = !search || r.toko?.nama_toko?.toLowerCase().includes(search.toLowerCase())
      || r.toko?.kode_toko?.toLowerCase().includes(search.toLowerCase())
      || r.kasir?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesArea = selectedArea === 'all' || r.toko?.area === selectedArea
    return matchesSearch && matchesArea
  })

  // Summary stats
  const totalNilai = filtered.reduce((s, r) => s + (r.total_koin_nilai || 0), 0)
  const totalUang  = filtered.reduce((s, r) => s + (r.total_uang_diterima || 0), 0)
  const adaSelisih = filtered.filter((r) => r.selisih !== 0).length

  const handleExport = () => {
    const header = ['Tanggal','Toko','Kasir','Koin','Uang','Selisih']
    const csvRows = filtered.map((r) => [
      formatDateTime(r.created_at),
      `${r.toko?.kode_toko} - ${r.toko?.nama_toko}`,
      r.kasir?.name || '-',
      r.total_koin_nilai,
      r.total_uang_diterima,
      r.selisih,
    ])
    const csv = [header, ...csvRows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `transaksi_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Receipt size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Transaksi</h1><p className="page-subtitle">Detail transaksi per toko untuk analisis kebutuhan koin</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0} id="btn-export-csv">
            <Download size={14} /> Export CSV
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="tour-trx-summary">
          {[
            { label: 'Total Transaksi', value: filtered.length, isMoney: false },
            { label: 'Total Koin Keluar', value: formatRupiah(totalNilai) },
            { label: 'Total Uang Masuk', value: formatRupiah(totalUang) },
            { label: 'Ada Selisih', value: adaSelisih, badge: adaSelisih > 0 ? 'destructive' : 'success', isMoney: false },
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
              <Button size="sm" onClick={fetch} id="btn-terapkan-filter"><Filter size={14} /> Terapkan</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card id="tour-trx-table">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Toko</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Koin Diserahkan</TableHead>
                  <TableHead>Uang Diterima</TableHead>
                  <TableHead>Selisih</TableHead>
                  <TableHead>PIC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({length:8}).map((_,i) => (
                  <TableRow key={i}>{Array.from({length:7}).map((_,j) => <TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>
                )) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Tidak ada transaksi ditemukan</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{r.toko?.kode_toko}</p>
                      <p className="font-medium text-sm">{r.toko?.nama_toko}</p>
                    </TableCell>
                    <TableCell className="text-sm">{r.kasir?.name || '-'}</TableCell>
                    <TableCell className="font-medium">{formatRupiah(r.total_koin_nilai)}</TableCell>
                    <TableCell>{formatRupiah(r.total_uang_diterima)}</TableCell>
                    <TableCell>
                      <Badge variant={r.selisih === 0 ? 'success' : 'destructive'}>
                        {r.selisih === 0 ? '✓ 0' : formatRupiah(r.selisih)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.pic_nama || '-'}</TableCell>
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
