import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtime } from '@/hooks/useRealtime'
import { formatRupiah, formatDateTime, SESSION_STATUS, ASSIGNMENT_STATUS } from '@/lib/utils'
import { Package, ClipboardList, ArrowUpRight, LayoutDashboard, Bell, TrendingUp, AlertTriangle, BarChart3, Info } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState({ stokTotal: 0, sesiAktif: 0, trxHariIni: 0, trxTotal: 0, pending: 0 })
  const [sesiAktif, setSesiAktif] = useState([])
  const [pending, setPending]     = useState([])
  const [stokKritis, setStokKritis] = useState([])
  const [distribusiArea, setDistribusiArea] = useState([])
  const [selisihTrxCount, setSelisihTrxCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const [stokRes, sesiRes, trxRes] = await Promise.all([
        supabase.from('stok_gudang').select('*').single(),
        supabase.from('sesi_tugas').select(`*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol), toko_assignment(*)`).in('status', ['active','pending_approval','pending_close']),
        supabase.from('transaksi').select('total_koin_nilai, selisih, created_at, toko:toko_id(area)').gte('created_at', today + 'T00:00:00'),
      ])

      if (stokRes.error) throw stokRes.error
      if (sesiRes.error) throw sesiRes.error
      if (trxRes.error) throw trxRes.error

      const rawStok = stokRes.data || {}
      const allSesi   = sesiRes.data || []
      const trxToday  = trxRes.data  || []

    // 1. Hitung Stok Koin Kritis
    const LIMITS = {
      koin_100: 200000,
      koin_200: 300000,
      koin_500: 500000,
      koin_1000: 1000000,
      koin_2000: 1000000,
      koin_5000: 1500000,
      koin_10000: 2000000,
      koin_20000: 2000000,
    }
    const COIN_LABELS = {
      koin_100: 'Rp 100',
      koin_200: 'Rp 200',
      koin_500: 'Rp 500',
      koin_1000: 'Rp 1.000',
      koin_2000: 'Rp 2.000',
      koin_5000: 'Rp 5.000',
      koin_10000: 'Rp 10.000',
      koin_20000: 'Rp 20.000',
    }
    const kritis = []
    Object.entries(LIMITS).forEach(([key, limit]) => {
      const currentVal = rawStok[key] || 0
      if (currentVal < limit) {
        kritis.push({ key, label: COIN_LABELS[key], current: currentVal, limit })
      }
    })
    setStokKritis(kritis)

    // 2. Hitung Distribusi Koin per Area Hari Ini
    const areaMap = {}
    trxToday.forEach((t) => {
      const area = t.toko?.area || 'Tanpa Area'
      areaMap[area] = (areaMap[area] || 0) + (t.total_koin_nilai || 0)
    })
    const dist = Object.entries(areaMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
    setDistribusiArea(dist)

    // 3. Hitung Jumlah Transaksi Selisih Hari Ini
    const selisihCount = trxToday.filter((t) => (t.selisih || 0) !== 0).length
    setSelisihTrxCount(selisihCount)

    // 4. Update Sesi & Statistik Utama
    const aktif     = allSesi.filter((s) => s.status === 'active')
    const pend      = allSesi.filter((s) => s.status === 'pending_approval' || s.status === 'pending_close')
    setSesiAktif(aktif)
    setPending(pend)
    setStats({
      stokTotal:  rawStok.total_nilai || 0,
      sesiAktif:  aktif.length,
      trxHariIni: trxToday.length,
      trxTotal:   trxToday.reduce((s, t) => s + (t.total_koin_nilai || 0), 0),
      pending:    pend.length,
    })
    } catch (err) {
      console.error('Dashboard loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRealtime('toko_assignment', null, loadData)
  useRealtime('sesi_tugas', null, loadData)

  const statCards = [
    { label: 'Saldo Gudang',       value: formatRupiah(stats.stokTotal), icon: Package,       color: 'bg-blue-50 text-blue-600', sub: 'Total nilai aset koin' },
    { label: 'Sesi Aktif',         value: stats.sesiAktif,              icon: ClipboardList,  color: 'bg-teal-50 text-teal-600', sub: 'Sedang beroperasi di lapangan' },
    { label: 'Transaksi Hari Ini', value: stats.trxHariIni,             icon: TrendingUp,     color: 'bg-emerald-50 text-emerald-600', sub: formatRupiah(stats.trxTotal) },
    { label: 'Menunggu Persetujuan', value: stats.pending,              icon: Bell,           color: 'bg-amber-50 text-amber-600', sub: 'Perlu ditinjau segera', alert: stats.pending > 0 },
  ]

  return (
    <DashboardLayout pendingCount={stats.pending}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Pantau seluruh aktivitas operasional penukaran koin secara real-time</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, sub, alert }) => (
            <Card key={label} className={alert ? 'ring-2 ring-amber-400' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon size={20} />
                  </div>
                  {alert && <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />}
                </div>
                <div className="mt-3">
                  {loading ? <Skeleton className="h-7 w-24 mb-1" /> : <p className="text-2xl font-bold text-foreground">{value}</p>}
                  <p className="text-xs font-medium text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
                  {loading ? <Skeleton className="h-3 w-20 mt-1" /> : <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dynamic Warning Alert for discrepancies */}
        {!loading && selisihTrxCount > 0 && (
          <Card className="border-red-200 bg-red-50/50" id="tour-dash-selisih-alert">
            <CardContent className="p-4 flex items-center gap-3 text-red-800">
              <AlertTriangle className="text-red-500 flex-shrink-0 animate-bounce" size={20} />
              <div className="flex-1 text-sm">
                <strong>Perhatian:</strong> Terdapat <strong>{selisihTrxCount} transaksi dengan selisih</strong> pada hari ini. Segera tinjau melalui menu Transaksi Lapangan.
              </div>
              <Button size="sm" variant="destructive" onClick={() => navigate('/dashboard/transaksi')}>
                Periksa Transaksi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Workspace grid (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="tour-dash-operations">
          {/* Column Left (Active operations) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending approvals */}
            {pending.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                    <Bell size={16} /> {pending.length} Sesi Menunggu Persetujuan Anda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pending.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                      <div>
                        <p className="text-sm font-medium">{s.kasir?.name} — {s.mobil?.nopol}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="warning" className="text-xs">{SESSION_STATUS[s.status]?.label}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/dashboard/sesi/${s.id}`)}>
                        Review <ArrowUpRight size={14} />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Active sessions realtime */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sesi Aktif di Lapangan</h2>
              {loading ? (
                <div className="grid gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
              ) : sesiAktif.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Belum ada kasir yang beroperasi saat ini</CardContent></Card>
              ) : (
                <div className="grid gap-4">
                  {sesiAktif.map((s) => {
                    const assigns  = s.toko_assignment || []
                    const selesai  = assigns.filter((a) => a.status === 'selesai' || a.status === 'skip').length
                    const total    = assigns.length
                    const pct      = total > 0 ? Math.round((selesai / total) * 100) : 0
                    return (
                      <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/dashboard/sesi/${s.id}`)}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold">{s.kasir?.name}</p>
                              <p className="text-sm text-muted-foreground">{s.mobil?.nopol} · Driver: {s.driver?.name} · Polisi: {s.nama_polisi || '-'}</p>
                            </div>
                            <Badge variant="success">Aktif</Badge>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{selesai} dari {total} toko selesai</span>
                              <span>{pct}%</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {assigns.map((a) => {
                              const colors = { pending: 'bg-gray-300', on_progress: 'bg-blue-400', selesai: 'bg-emerald-500', skip: 'bg-red-400' }
                              return (
                                <span
                                  key={a.id}
                                  className={`w-2.5 h-2.5 rounded-full ${colors[a.status] || 'bg-gray-200'}`}
                                  title={ASSIGNMENT_STATUS[a.status]?.label}
                                />
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column Right (Analysis and Warnings) */}
          <div className="space-y-6">
            {/* Critical Stock Warning Card */}
            <Card className="border-red-200" id="tour-dash-stok-kritis">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-800">
                  <AlertTriangle className="text-rose-500" size={16} /> Peringatan Stok Kritis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : stokKritis.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 p-3 rounded-lg">
                    <Info size={14} /> Seluruh denominasi koin berada dalam ambang batas aman.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stokKritis.map((item) => (
                      <div key={item.key} className="flex justify-between items-center bg-red-50 p-2.5 rounded-lg border border-red-100 text-xs animate-pulse">
                        <div>
                          <p className="font-semibold text-rose-900">{item.label}</p>
                          <p className="text-muted-foreground mt-0.5">Sisa: <span className="font-mono text-rose-600 font-bold">{formatRupiah(item.current)}</span></p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Batas: {formatRupiah(item.limit)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate('/dashboard/stok')}>
                  Lihat Stok Gudang
                </Button>
              </CardContent>
            </Card>

            {/* Area Distribution Today */}
            <Card id="tour-dash-distribusi-area">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" /> Distribusi Koin per Area Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : distribusiArea.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada data distribusi koin hari ini</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1.5">
                    {distribusiArea.map((item) => {
                      const maxTotal = Math.max(...distribusiArea.map(d => d.total))
                      const percent = maxTotal > 0 ? Math.round((item.total / maxTotal) * 100) : 0
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-foreground">{item.name}</span>
                            <span className="text-muted-foreground">{formatRupiah(item.total)}</span>
                          </div>
                          <Progress value={percent} className="h-1.5 bg-muted" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
