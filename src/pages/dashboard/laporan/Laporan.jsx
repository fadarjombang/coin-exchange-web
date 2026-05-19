import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BarChart3, Search, Loader2, AlertTriangle, RefreshCw, Download, ArrowDownRight, Info, CheckCircle2 } from 'lucide-react'
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
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('optimasi') // default ke tab optimasi untuk menunjukkan fitur baru!

  // Skip Analysis States
  const [skipData, setSkipData] = useState([])
  const [reasonStats, setReasonStats] = useState([])
  const [loadingSkip, setLoadingSkip] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchToko, setSearchToko] = useState('')
  const ITEMS_PER_PAGE = 10

  const search = async () => {
    setLoading(true)
    const { data: sesi } = await supabase.from('sesi_tugas')
      .select('*, kasir:kasir_id(name), transaksi(total_koin_nilai, total_uang_diterima)')
      .gte('tanggal', from).lte('tanggal', to).eq('status', 'closed').order('tanggal', { ascending: false })
    setData(sesi || [])
    setLoading(false)
  }

  const loadSkipAnalysis = useCallback(async () => {
    setLoadingSkip(true)
    try {
      const { data: assignments, error } = await supabase.from('toko_assignment')
        .select('*, toko:toko_id(*), sesi:sesi_tugas_id(tanggal,status)')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const storeMap = {};
      const reasonCount = {};

      (assignments || []).forEach((a) => {
        if (!a.toko) return
        if (a.sesi?.status !== 'closed') return
        const storeId = a.toko_id
        if (!storeMap[storeId]) {
          storeMap[storeId] = {
            id: a.toko.id,
            kode_toko: a.toko.kode_toko,
            nama_toko: a.toko.nama_toko,
            area: a.toko.area,
            total_visits: 0,
            total_skipped: 0,
            reasons: {},
            last_skip_date: null,
            last_skip_reason: null,
          }
        }

        storeMap[storeId].total_visits += 1

        if (a.status === 'skip') {
          storeMap[storeId].total_skipped += 1
          const reason = a.alasan_skip || 'Stok koin masih cukup'
          storeMap[storeId].reasons[reason] = (storeMap[storeId].reasons[reason] || 0) + 1
          
          // Global reasons counter
          reasonCount[reason] = (reasonCount[reason] || 0) + 1

          if (!storeMap[storeId].last_skip_date) {
            storeMap[storeId].last_skip_date = a.sesi?.tanggal || a.created_at
            storeMap[storeId].last_skip_reason = reason
          }
        }
      })

      const analysisList = Object.values(storeMap)
        .map((s) => {
          const ratio = s.total_visits > 0 ? Math.round((s.total_skipped / s.total_visits) * 100) : 0
          
          // Cari alasan skip teratas
          let topReason = '-'
          let maxCount = 0
          Object.entries(s.reasons).forEach(([reason, count]) => {
            if (count > maxCount) {
              maxCount = count
              topReason = reason
            }
          })

          return {
            ...s,
            skip_ratio: ratio,
            top_reason: topReason,
          }
        })
        .sort((a, b) => b.skip_ratio - a.skip_ratio || b.total_skipped - a.total_skipped)

      setSkipData(analysisList)

      // Format global reasons stats
      const formattedReasons = Object.entries(reasonCount)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
      setReasonStats(formattedReasons)
    } catch (err) {
      console.error('Gagal memuat analisis skip:', err)
    } finally {
      setLoadingSkip(false)
    }
  }, [])

  useEffect(() => {
    loadSkipAnalysis()
  }, [loadSkipAnalysis])

  // Export CSV Recommendation
  const handleExportSkipCSV = () => {
    const lowPriorityStores = skipData.filter(s => s.skip_ratio >= 50 && s.total_visits >= 2)
    const header = ['Kode Toko', 'Nama Toko', 'Area', 'Total Penugasan', 'Total Dilewati', 'Rasio Skip (%)', 'Alasan Terbanyak', 'Rekomendasi Tindakan']
    const csvRows = lowPriorityStores.map((s) => [
      s.kode_toko,
      s.nama_toko,
      s.area || '-',
      s.total_visits,
      s.total_skipped,
      `${s.skip_ratio}%`,
      s.top_reason,
      'TURUNKAN PRIORITAS / SKIP KUNJUNGAN HINGGA KOIN TIPIS'
    ])
    
    const csv = [header, ...csvRows].map((r) => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rekomendasi_skip_toko_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Count metrics for skip
  const criticalSkipCount = skipData.filter(s => s.skip_ratio >= 50 && s.total_visits >= 2).length
  const topReasonGlobal = reasonStats[0]?.reason || 'Koin masih banyak'

  // Filter store list by search
  const filteredSkipData = skipData.filter(s => {
    if (!searchToko) return true
    const q = searchToko.toLowerCase()
    return s.nama_toko?.toLowerCase().includes(q) || s.kode_toko?.toLowerCase().includes(q) || s.area?.toLowerCase().includes(q)
  })

  // Reset page when search changes
  const handleSearchChange = (value) => {
    setSearchToko(value)
    setCurrentPage(1)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="page-title">Analisis Laporan</h1>
              <p className="page-subtitle">Optimasi penugasan dan intelijen operasi koin</p>
            </div>
          </div>
          {activeTab === 'optimasi' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadSkipAnalysis} disabled={loadingSkip}>
                <RefreshCw size={14} className={loadingSkip ? 'animate-spin' : ''} /> Segarkan
              </Button>
              <Button size="sm" onClick={handleExportSkipCSV} disabled={skipData.length === 0} id="btn-export-rekomendasi">
                <Download size={14} /> Ekspor Rekomendasi CSV
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="optimasi">Optimasi Prioritas Kunjungan</TabsTrigger>
            <TabsTrigger value="harian">Rekap Harian</TabsTrigger>
          </TabsList>

          {/* TAB 1: OPTIMASI PRIORITAS KUNJUNGAN (SKIP ANALYSIS) */}
          <TabsContent value="optimasi" className="space-y-6">
            
            {/* Highlight Alert Box */}
            <Card className="border-amber-200 bg-amber-50/50" id="tour-report-intro">
              <CardContent className="p-4 flex items-start gap-3">
                <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="space-y-1 text-sm text-amber-900">
                  <h4 className="font-semibold">Cara Kerja Optimasi Kunjungan</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Sistem ini melacak riwayat penugasan kasir yang <strong>dilewati (dilewati/skip)</strong> di setiap toko.
                    Toko dengan rasio skip tinggi (&gt;= 50%) menunjukkan bahwa toko tersebut <strong>memiliki persediaan koin mandiri yang melimpah</strong> (stok koin selalu cukup),
                    sehingga <strong>tidak mendesak</strong> untuk dikunjungi. Kami menyarankan untuk <strong>menurunkan prioritas kunjungan</strong> toko-toko ini untuk efisiensi BBM dan waktu tim operasional.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="tour-report-metrics">
              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Toko Disarankan Turun Prioritas</p>
                    <p className="text-2xl font-bold text-rose-600">{loadingSkip ? '...' : criticalSkipCount}</p>
                    <p className="text-[10px] text-muted-foreground">Toko dengan rasio skip &gt;= 50%</p>
                  </div>
                  <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                    <ArrowDownRight size={24} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Penyebab Skip Utama</p>
                    <p className="text-lg font-bold text-foreground break-words" title={topReasonGlobal}>
                      {loadingSkip ? '...' : topReasonGlobal}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Alasan paling sering diinput kasir</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                    <AlertTriangle size={24} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Riwayat Skip Toko</p>
                    <p className="text-2xl font-bold text-primary">
                      {loadingSkip ? '...' : reasonStats.reduce((acc, r) => acc + r.count, 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total kejadian skip tercatat di sistem</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <BarChart3 size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Layout Grid (Table + Side Reasons stats) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Stores skipped list table */}
              <div className="lg:col-span-2 space-y-4">
                <Card id="tour-report-skipped-list">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Daftar Analisis Skip Toko</CardTitle>
                        <CardDescription>Rasio skip dihitung dari perbandingan jumlah kunjungan dilewati vs total penugasan sesi</CardDescription>
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Cari toko..."
                          value={searchToko}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="h-8 w-48 pl-8 text-sm"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Toko</TableHead>
                          <TableHead className="text-center">Total Ditugaskan</TableHead>
                          <TableHead className="text-center">Total Dilewati</TableHead>
                          <TableHead>Rasio Skip</TableHead>
                          <TableHead>Rekomendasi Tindakan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingSkip ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell colSpan={5} className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell>
                            </TableRow>
                          ))
                        ) : filteredSkipData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                              {searchToko ? `Tidak ada toko yang matches "${searchToko}"` : 'Tidak ada riwayat skip toko tercatat.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          (() => {
                            const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
                            const paginatedData = filteredSkipData.slice(startIdx, startIdx + ITEMS_PER_PAGE)
                            return paginatedData.map((item) => {
                            const isCritical = item.skip_ratio >= 50 && item.total_visits >= 2
                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <p className="font-mono text-xs text-muted-foreground">{item.kode_toko}</p>
                                  <p className="font-semibold text-sm">{item.nama_toko}</p>
                                  <p className="text-[10px] text-muted-foreground">Area: {item.area || 'Tanpa Area'}</p>
                                </TableCell>
                                <TableCell className="text-center text-sm font-medium">{item.total_visits} kali</TableCell>
                                <TableCell className="text-center text-sm font-semibold text-amber-700">{item.total_skipped} kali</TableCell>
                                <TableCell>
                                  <div className="space-y-1.5 w-24">
                                    <div className="flex justify-between text-xs font-semibold">
                                      <span className={item.skip_ratio >= 50 ? 'text-rose-600' : 'text-slate-600'}>{item.skip_ratio}%</span>
                                    </div>
                                    <Progress value={item.skip_ratio} className={`h-1.5 ${item.skip_ratio >= 50 ? 'bg-rose-100 [&>div]:bg-rose-600' : ''}`} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isCritical ? (
                                    <Badge variant="destructive" className="animate-pulse flex items-center gap-1 w-fit">
                                      <ArrowDownRight size={10} /> Turunkan Prioritas
                                    </Badge>
                                  ) : (
                                    <Badge variant="success" className="flex items-center gap-1 w-fit">
                                      <CheckCircle2 size={10} /> Tetap Prioritas
                                    </Badge>
                                  )}
                                  {item.top_reason && item.top_reason !== '-' && (
                                    <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]" title={item.top_reason}>
                                      Alasan: {item.top_reason}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })
                        })()
                        )}
                      </TableBody>
                    </Table>
                    {filteredSkipData.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Halaman {currentPage} dari {Math.ceil(filteredSkipData.length / ITEMS_PER_PAGE)}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= Math.ceil(filteredSkipData.length / ITEMS_PER_PAGE)}
                            onClick={() => setCurrentPage(p => p + 1)}
                          >
                            Berikutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Skips reasons analysis */}
              <div className="space-y-6">
                <Card id="tour-report-reasons">
                  <CardHeader>
                    <CardTitle className="text-base">Penyebab Kunjungan Dilewati</CardTitle>
                    <CardDescription>Pola alasan teratas yang diinput oleh kasir saat melepaskan rute toko</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingSkip ? (
                      Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 w-full bg-slate-100 rounded-lg animate-pulse" />)
                    ) : reasonStats.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Belum ada rincian alasan skip.</p>
                    ) : (
                      <div className="space-y-3">
                        {reasonStats.map((item) => {
                          const totalSkips = reasonStats.reduce((sum, r) => sum + r.count, 0)
                          const percent = Math.round((item.count / totalSkips) * 100)
                          return (
                            <div key={item.reason} className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1.5">
                              <div className="flex justify-between font-semibold">
                                <span className="text-foreground max-w-[150px] truncate" title={item.reason}>{item.reason}</span>
                                <span className="text-slate-600 font-mono">{item.count} kali ({percent}%)</span>
                              </div>
                              <Progress value={percent} className="h-1 bg-primary/40" />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>

          </TabsContent>

          {/* TAB 2: REKAP HARIAN */}
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
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
