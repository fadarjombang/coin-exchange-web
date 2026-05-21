import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, History, Download } from 'lucide-react'
import { formatRupiah, formatDateTime, formatNumber, DENOM_LIST, UANG_LIST } from '@/lib/utils'

export default function TokoRiwayat() {
  const { id } = useParams(); const navigate = useNavigate()
  const [toko, setToko]   = useState(null)
  const [trx, setTrx]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [t, tx] = await Promise.all([
        supabase.from('toko').select('*').eq('id', id).single(),
        supabase.from('transaksi').select('*, kasir:kasir_id(name), sesi_tugas(tanggal)').eq('toko_id', id).order('created_at', { ascending: false })
      ])
      setToko(t.data); setTrx(tx.data || []); setLoading(false)
    }; load()
  }, [id])

  const totalKoin = trx.reduce((s,t) => s + (t.total_koin_nilai||0), 0)
  const totalUang = trx.reduce((s,t) => s + (t.total_uang_diterima||0), 0)

  const handleExport = () => {
    const header = [
      'Tanggal', 'Kasir', 'Jenis',
      'Total Koin', ...DENOM_LIST.map(d => d.value),
      'Total Uang', ...UANG_LIST.map(u => u.value),
      'Selisih'
    ]
    const rows = trx.map(t => [
      formatDateTime(t.created_at),
      t.kasir?.name || '-',
      t.jenis === 'kantor' ? 'Kantor' : 'Lapangan',
      t.total_koin_nilai,
      ...DENOM_LIST.map(d => t[d.key] || 0),
      t.total_uang_diterima,
      ...UANG_LIST.map(u => t[u.key] || 0),
      t.selisih
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `riwayat_toko_${toko?.kode_toko}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/toko')}><ArrowLeft size={18} /></Button>
            <div className="flex items-center gap-2"><History size={20} className="text-primary" /><div><h1 className="page-title">Riwayat Transaksi Toko</h1>{toko && <p className="page-subtitle">{toko.kode_toko} — {toko.nama_toko}</p>}</div></div>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={trx.length === 0}>
            <Download size={16} className="mr-1.5" /> Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{label:'Total Transaksi',value:trx.length,format:false},{label:'Total Koin Keluar',value:totalKoin,format:true},{label:'Total Uang Masuk',value:totalUang,format:true}].map(({label,value,format})=>(
            <Card key={label}><CardContent className="p-4"><p className="stat-label">{label}</p><p className="stat-value text-lg">{format?formatRupiah(value):value}</p></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                <TableHead className="whitespace-nowrap">Kasir</TableHead>
                <TableHead className="text-right font-bold text-amber-600 bg-amber-50/50 whitespace-nowrap">Total Koin</TableHead>
                {DENOM_LIST.map(d => (
                  <TableHead key={d.key} className="text-right text-xs bg-amber-50/20 whitespace-nowrap">{d.label.replace('Rp ', '')}</TableHead>
                ))}
                <TableHead className="text-right font-bold text-green-600 bg-green-50/50 whitespace-nowrap">Total Uang</TableHead>
                {UANG_LIST.map(u => (
                  <TableHead key={u.key} className="text-right text-xs bg-green-50/20 whitespace-nowrap">{u.label.replace('Rp ', '')}</TableHead>
                ))}
                <TableHead className="whitespace-nowrap">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={15}><Skeleton className="h-4 w-full"/></TableCell></TableRow>)
              : trx.length === 0 ? <TableRow><TableCell colSpan={15} className="text-center py-12 text-muted-foreground">Belum ada transaksi</TableCell></TableRow>
              : trx.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(t.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{t.kasir?.name}</TableCell>
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
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={t.selisih===0?'success':'destructive'}>
                      {t.selisih===0?'✓ 0':formatRupiah(t.selisih)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  )
}
