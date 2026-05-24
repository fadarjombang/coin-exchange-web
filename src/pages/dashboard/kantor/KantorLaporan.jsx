import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Download, Search, Building, Coins, Banknote } from 'lucide-react'
import { formatRupiah, todayISO } from '@/lib/utils'

function DateRangeFilter({ from, to, onFrom, onTo, onSearch, loading }) {
  return (
    <div className="flex flex-wrap gap-3 items-end pb-4">
      <div className="space-y-1"><Label className="text-xs">Dari</Label><Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9 w-40" /></div>
      <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9 w-40" /></div>
      <Button size="sm" onClick={onSearch} disabled={loading}>{loading && <Loader2 size={14} className="animate-spin mr-1" />}<Search size={14} /> Tampilkan</Button>
    </div>
  )
}

export default function KantorLaporan() {
  const [from, setFrom] = useState(todayISO)
  const [to, setTo]     = useState(todayISO)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])

  const search = async () => {
    setLoading(true)
    const { data: trx } = await supabase
      .from('transaksi')
      .select('*, toko:toko_id(kode_toko,nama_toko,area), kasir:kasir_id(name)')
      .eq('jenis', 'kantor')
      .gte('tanggal_waktu', new Date(`${from}T00:00:00+07:00`).toISOString())
      .lte('tanggal_waktu', new Date(`${to}T23:59:59+07:00`).toISOString())
      .order('tanggal_waktu', { ascending: false })
    setData(trx || [])
    setLoading(false)
  }

  useEffect(() => { search() }, [])

  const totalKoin = data.reduce((sum, t) => sum + (t.total_koin_nilai || 0), 0)
  const totalUang = data.reduce((sum, t) => sum + (t.total_uang_diterima || 0), 0)

  const handleExport = () => {
    const header = ['Tanggal', 'Kode Toko', 'Nama Toko', 'Area', 'Total Koin Keluar', 'Total Uang Masuk', 'Admin']
    const rows = data.map(t => [
      new Date(t.tanggal_waktu).toLocaleString('id-ID'),
      t.toko?.kode_toko,
      t.toko?.nama_toko,
      t.toko?.area || '-',
      t.total_koin_nilai,
      t.total_uang_diterima,
      t.kasir?.name
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
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
              <h1 className="page-title">Laporan Transaksi Kantor</h1>
              <p className="page-subtitle">Riwayat penukaran koin di kantor</p>
            </div>
          </div>
          <Button size="sm" onClick={handleExport} disabled={data.length === 0}>
            <Download size={14} className="mr-1" /> Export CSV
          </Button>
        </div>

        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onSearch={search} loading={loading} />

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Transaksi</p>
                <p className="text-2xl font-bold text-primary">{data.length}</p>
                <p className="text-[10px] text-muted-foreground">Transaksi catatan</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Building size={24} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Koin Keluar</p>
                <p className="text-xl font-bold text-amber-600">{loading ? '...' : formatRupiah(totalKoin)}</p>
                <p className="text-[10px] text-muted-foreground">Dikasih ke toko</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                <Coins size={24} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Uang Masuk</p>
                <p className="text-xl font-bold text-green-600">{loading ? '...' : formatRupiah(totalUang)}</p>
                <p className="text-[10px] text-muted-foreground">Diterima dari toko</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                <Banknote size={24} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Toko</TableHead>
                  <TableHead className="text-right">Koin Keluar</TableHead>
                  <TableHead className="text-right">Uang Masuk</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Tidak ada transaksi</TableCell></TableRow>
                ) : (
                  data.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.tanggal_waktu).toLocaleString('id-ID')}</TableCell>
                      <TableCell>
                        <p className="font-medium">{t.toko?.nama_toko}</p>
                        <p className="text-xs text-muted-foreground">{t.toko?.kode_toko} · {t.toko?.area}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-600">{formatRupiah(t.total_koin_nilai)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatRupiah(t.total_uang_diterima)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.kasir?.name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}