import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Download, Search, Building, Coins, Banknote } from 'lucide-react'
import { formatRupiah, formatNumber, DENOM_LIST, UANG_LIST } from '@/lib/utils'

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
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])

  const search = async () => {
    setLoading(true)
    const { data: trx } = await supabase
      .from('transaksi')
      .select('*, toko:toko_id(kode_toko,nama_toko,area), kasir:kasir_id(name)')
      .eq('jenis', 'kantor')
      .gte('tanggal_waktu', from + 'T00:00:00')
      .lte('tanggal_waktu', to + 'T23:59:59')
      .order('tanggal_waktu', { ascending: false })
    setData(trx || [])
    setLoading(false)
  }

  useEffect(() => { search() }, [])

  const totalKoin = data.reduce((sum, t) => sum + (t.total_koin_nilai || 0), 0)
  const totalUang = data.reduce((sum, t) => sum + (t.total_uang_diterima || 0), 0)

  const handleExport = () => {
    const header = [
      'Tanggal', 'Kode Toko', 'Nama Toko', 'Area', 
      'Total Koin Keluar', ...DENOM_LIST.map(d => d.value),
      'Total Uang Masuk', ...UANG_LIST.map(u => u.value),
      'Admin'
    ]
    const rows = data.map(t => [
      new Date(t.tanggal_waktu).toLocaleString('id-ID'),
      t.toko?.kode_toko,
      t.toko?.nama_toko,
      t.toko?.area || '-',
      t.total_koin_nilai,
      ...DENOM_LIST.map(d => t[d.key] || 0),
      t.total_uang_diterima,
      ...UANG_LIST.map(u => t[u.key] || 0),
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
                  <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="whitespace-nowrap">Toko</TableHead>
                  <TableHead className="text-right font-bold text-amber-600 bg-amber-50/50 whitespace-nowrap">Total Koin</TableHead>
                  {DENOM_LIST.map(d => (
                    <TableHead key={d.key} className="text-right text-xs bg-amber-50/20 whitespace-nowrap">{d.label.replace('Rp ', '')}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold text-green-600 bg-green-50/50 whitespace-nowrap">Total Uang</TableHead>
                  {UANG_LIST.map(u => (
                    <TableHead key={u.key} className="text-right text-xs bg-green-50/20 whitespace-nowrap">{u.label.replace('Rp ', '')}</TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-12 text-muted-foreground">Tidak ada transaksi</TableCell></TableRow>
                ) : (
                  data.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm whitespace-nowrap">{new Date(t.tanggal_waktu).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-sm">{t.toko?.nama_toko}</p>
                        <p className="text-xs text-muted-foreground">{t.toko?.kode_toko} · {t.toko?.area}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-700 bg-amber-50/30 whitespace-nowrap">
                        {formatRupiah(t.total_koin_nilai)}
                      </TableCell>
                      {DENOM_LIST.map(d => (
                        <TableCell key={d.key} className="text-right font-mono text-xs text-muted-foreground bg-amber-50/10 whitespace-nowrap">
                          {t[d.key] > 0 ? formatNumber(t[d.key]).replace(/Rp\s?/, '') : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-green-700 bg-green-50/30 whitespace-nowrap">
                        {formatRupiah(t.total_uang_diterima)}
                      </TableCell>
                      {UANG_LIST.map(u => (
                        <TableCell key={u.key} className="text-right font-mono text-xs text-muted-foreground bg-green-50/10 whitespace-nowrap">
                          {t[u.key] > 0 ? formatNumber(t[u.key]).replace(/Rp\s?/, '') : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{t.kasir?.name}</TableCell>
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