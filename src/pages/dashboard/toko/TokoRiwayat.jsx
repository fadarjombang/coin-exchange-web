import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, History } from 'lucide-react'
import { formatRupiah, formatDateTime } from '@/lib/utils'

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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/toko')}><ArrowLeft size={18} /></Button>
          <div className="flex items-center gap-2"><History size={20} className="text-primary" /><div><h1 className="page-title">Riwayat Transaksi Toko</h1>{toko && <p className="page-subtitle">{toko.kode_toko} — {toko.nama_toko}</p>}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{label:'Total Transaksi',value:trx.length,format:false},{label:'Total Koin Keluar',value:totalKoin,format:true},{label:'Total Uang Masuk',value:totalUang,format:true}].map(({label,value,format})=>(
            <Card key={label}><CardContent className="p-4"><p className="stat-label">{label}</p><p className="stat-value text-lg">{format?formatRupiah(value):value}</p></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Kasir</TableHead><TableHead>Total Koin</TableHead><TableHead>Total Uang</TableHead><TableHead>Selisih</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full"/></TableCell></TableRow>)
            : trx.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Belum ada transaksi</TableCell></TableRow>
            : trx.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{formatDateTime(t.created_at)}</TableCell>
                <TableCell>{t.kasir?.name}</TableCell>
                <TableCell>{formatRupiah(t.total_koin_nilai)}</TableCell>
                <TableCell>{formatRupiah(t.total_uang_diterima)}</TableCell>
                <TableCell><Badge variant={t.selisih===0?'success':'destructive'}>{t.selisih===0?'✓ 0':formatRupiah(t.selisih)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  )
}
