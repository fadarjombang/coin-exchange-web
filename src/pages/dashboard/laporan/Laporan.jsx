import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Search, Loader2 } from 'lucide-react'
import { formatRupiah, formatDate, formatDateTime } from '@/lib/utils'

function DateRangeFilter({ from, to, onFrom, onTo, onSearch, loading }) {
  return (
    <div className="flex flex-wrap gap-3 items-end pb-4">
      <div className="space-y-1"><Label className="text-xs">Dari</Label><Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9 w-40" /></div>
      <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9 w-40" /></div>
      <Button size="sm" onClick={onSearch} disabled={loading}>{loading && <Loader2 size={14} className="animate-spin mr-1" />}<Search size={14} /> Tampilkan</Button>
    </div>
  )
}

export default function Laporan() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today)
  const [data, setData] = useState([]); const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('harian')

  const search = async () => {
    setLoading(true)
    const { data: sesi } = await supabase.from('sesi_tugas')
      .select('*, kasir:kasir_id(name), transaksi(total_koin_nilai, total_uang_diterima)')
      .gte('tanggal', from).lte('tanggal', to).eq('status', 'closed').order('tanggal', { ascending: false })
    setData(sesi || [])
    setLoading(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><BarChart3 size={20} className="text-primary" /></div>
          <div><h1 className="page-title">Laporan</h1><p className="page-subtitle">Rekap transaksi dan operasi</p></div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList><TabsTrigger value="harian">Rekap Harian</TabsTrigger><TabsTrigger value="periode">Per Periode</TabsTrigger></TabsList>
          <TabsContent value="harian" className="space-y-4">
            <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onSearch={search} loading={loading} />
            {data.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Total Sesi', value: data.length },
                  { label: 'Total Koin Keluar', value: formatRupiah(data.flatMap(s=>s.transaksi||[]).reduce((a,t)=>a+(t.total_koin_nilai||0),0)) },
                  { label: 'Total Uang Masuk', value: formatRupiah(data.flatMap(s=>s.transaksi||[]).reduce((a,t)=>a+(t.total_uang_diterima||0),0)) },
                ].map(({label,value})=><Card key={label}><CardContent className="p-4"><p className="stat-label">{label}</p><p className="stat-value text-lg">{value}</p></CardContent></Card>)}
              </div>
            )}
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Kasir</TableHead><TableHead>Toko Dikunjungi</TableHead><TableHead>Total Koin</TableHead><TableHead>Total Uang</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                : data.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Pilih rentang tanggal dan klik Tampilkan</TableCell></TableRow>
                : data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.tanggal)}</TableCell>
                    <TableCell>{s.kasir?.name}</TableCell>
                    <TableCell>{s.transaksi?.length || 0} toko</TableCell>
                    <TableCell>{formatRupiah(s.transaksi?.reduce((a,t)=>a+(t.total_koin_nilai||0),0))}</TableCell>
                    <TableCell>{formatRupiah(s.transaksi?.reduce((a,t)=>a+(t.total_uang_diterima||0),0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="periode">
            <Card><CardContent className="py-12 text-center text-muted-foreground">Rekap per periode akan tersedia segera.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
