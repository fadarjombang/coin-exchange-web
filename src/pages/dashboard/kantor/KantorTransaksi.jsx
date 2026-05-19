import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Building, Coins, Banknote, Search } from 'lucide-react'
import { formatRupiah, formatDateTime } from '@/lib/utils'

export default function KantorTransaksi() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: trx } = await supabase
      .from('transaksi')
      .select('id, tanggal_waktu, total_koin_nilai, total_uang_diterima, toko:toko_id(kode_toko, nama_toko, area)')
      .eq('jenis', 'kantor')
      .gte('tanggal_waktu', from + 'T00:00:00')
      .lte('tanggal_waktu', to + 'T23:59:59')
      .order('tanggal_waktu', { ascending: false })
    setData(trx || [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { loadData() }, [loadData])

  const filtered = data.filter(t =>
    !search ||
    t.toko?.kode_toko?.toLowerCase().includes(search.toLowerCase()) ||
    t.toko?.nama_toko?.toLowerCase().includes(search.toLowerCase())
  )

  const totalKoin = filtered.reduce((s, t) => s + (t.total_koin_nilai || 0), 0)
  const totalUang = filtered.reduce((s, t) => s + (t.total_uang_diterima || 0), 0)

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
              <h1 className="page-title">Transaksi Kantor</h1>
              <p className="page-subtitle">Penukaran koin toko yang datang langsung ke kantor</p>
            </div>
          </div>
          <Button onClick={() => navigate('/dashboard/kantor/baru')}>
            <Plus size={16} className="mr-1.5" /> Transaksi Baru
          </Button>
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
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Koin Keluar</p>
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
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Uang Masuk</p>
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
              <Button size="sm" onClick={loadData} disabled={loading}>
                {loading && <Loader2 size={14} className="animate-spin mr-1" />}
                Tampilkan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal & Waktu</TableHead>
                  <TableHead>Kode Toko</TableHead>
                  <TableHead>Nama Toko</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Koin Keluar</TableHead>
                  <TableHead className="text-right">Uang Masuk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-14 text-muted-foreground">
                      Belum ada transaksi kantor pada periode ini
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(t.tanggal_waktu)}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {t.toko?.kode_toko}
                      </TableCell>
                      <TableCell className="font-medium">
                        {t.toko?.nama_toko}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.toko?.area || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {formatRupiah(t.total_koin_nilai)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatRupiah(t.total_uang_diterima)}
                      </TableCell>
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