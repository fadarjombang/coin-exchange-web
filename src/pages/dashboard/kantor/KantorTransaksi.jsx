import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Building, Coins, Banknote, Search, Download } from 'lucide-react'
import { formatRupiah, formatNumber, formatDateTime, DENOM_LIST, UANG_LIST, csvCell, todayISO } from '@/lib/utils'


export default function KantorTransaksi() {
  const { role } = useAuth()
  const roles = Array.isArray(role) ? role : [role]
  const isAdmin = roles.includes('admin') || roles.includes('superadmin')

  const navigate = useNavigate()
  const [from, setFrom]   = useState(todayISO)
  const [to, setTo]       = useState(todayISO)
  const [loading, setLoading] = useState(false)
  const [data, setData]   = useState([])
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch menerima parameter eksplisit — tidak bergantung pada state from/to
  const loadData = useCallback(async (dateFrom, dateTo) => {
    setLoading(true)
    const { data: trx } = await supabase
      .from('transaksi')
      .select('*, toko:toko_id(kode_toko, nama_toko, area)')
      .eq('jenis', 'kantor')
      .gte('tanggal_waktu', new Date(`${dateFrom}T00:00:00+07:00`).toISOString())
      .lte('tanggal_waktu', new Date(`${dateTo}T23:59:59+07:00`).toISOString())
      .order('tanggal_waktu', { ascending: false })
    setData(trx || [])
    setLoading(false)
  }, [])

  // Saat mount — hanya fetch hari ini
  useEffect(() => {
    loadData(todayISO(), todayISO())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setCurrentPage(1) }, [from, to, search])

  // Handler tombol Tampilkan
  const handleSearch = () => {
    setCurrentPage(1)
    loadData(from, to)
  }

  const filtered = data.filter(t =>
    !search ||
    t.toko?.kode_toko?.toLowerCase().includes(search.toLowerCase()) ||
    t.toko?.nama_toko?.toLowerCase().includes(search.toLowerCase())
  )

  const totalKoin = filtered.reduce((s, t) => s + (t.total_koin_nilai || 0), 0)
  const totalUang = filtered.reduce((s, t) => s + (t.total_uang_diterima || 0), 0)

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleExport = () => {
    const header = [
      'Tanggal',
      'Kode Toko',
      'Nama Toko',
      'Area',
      ...DENOM_LIST.map(d => d.value),
      'Total Koin Keluar',
      ...UANG_LIST.map(u => u.value),
      'Total Uang Masuk'
    ]
    const csvRows = filtered.map(t => [
      formatDateTime(t.tanggal_waktu),
      t.toko?.kode_toko || '-',
      t.toko?.nama_toko || '-',
      t.toko?.area || '-',
      ...DENOM_LIST.map(d => t[d.key] || 0),
      t.total_koin_nilai || 0,
      ...UANG_LIST.map(u => t[u.key] || 0),
      t.total_uang_diterima || 0
    ])
    const csv = '\uFEFF' + [header, ...csvRows].map(r => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transaksi_kantor_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="page-title">Penukaran Koin Kantor</h1>
              <p className="page-subtitle">Riwayat penukaran koin oleh tim toko yang datang ke kantor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download size={16} className="mr-1.5" /> Export CSV
            </Button>
            {isAdmin && (
              <Button onClick={() => navigate('/dashboard/kantor/baru')}>
                <Plus size={16} className="mr-1.5" /> Transaksi Baru
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Transaksi</p>
                <p className="text-2xl font-bold text-primary">{loading ? '...' : filtered.length}</p>
                <p className="text-[10px] text-muted-foreground">Dalam rentang tanggal</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Building size={22} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Koin Diserahkan</p>
                <p className="text-xl font-bold text-amber-600">{loading ? '...' : formatRupiah(totalKoin)}</p>
                <p className="text-[10px] text-muted-foreground">Diserahkan ke toko</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                <Coins size={22} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Uang Diterima</p>
                <p className="text-xl font-bold text-green-600">{loading ? '...' : formatRupiah(totalUang)}</p>
                <p className="text-[10px] text-muted-foreground">Diterima dari toko</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                <Banknote size={22} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Dari</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sampai</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <Label className="text-xs">Cari Toko</Label>
                <div className="relative mt-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Kode atau nama toko..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleSearch} disabled={loading}>
                {loading && <Loader2 size={14} className="animate-spin mr-1" />}
                Tampilkan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Tanggal & Waktu</TableHead>
                    <TableHead className="whitespace-nowrap">Kode Toko</TableHead>
                    <TableHead className="whitespace-nowrap">Nama Toko</TableHead>
                    <TableHead className="whitespace-nowrap">Area</TableHead>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-10">
                        <Loader2 className="animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-14 text-muted-foreground">
                        Belum ada transaksi kantor pada periode ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(t.tanggal_waktu)}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {t.toko?.kode_toko}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {t.toko?.nama_toko}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.toko?.area || '-'}
                        </TableCell>
                        {DENOM_LIST.map(d => (
                          <TableCell key={d.key} className="text-right text-xs text-muted-foreground">
                            {t[d.key] ? formatNumber(t[d.key]) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold text-amber-600 bg-amber-50/10">
                          {formatRupiah(t.total_koin_nilai)}
                        </TableCell>
                        {UANG_LIST.map(u => (
                          <TableCell key={u.key} className="text-right text-xs text-muted-foreground">
                            {t[u.key] ? formatNumber(t[u.key]) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold text-green-600 bg-green-50/10">
                          {formatRupiah(t.total_uang_diterima)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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