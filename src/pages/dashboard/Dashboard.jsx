import { useState, useEffect } from 'react'
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
import { Package, ClipboardList, ArrowUpRight, LayoutDashboard, Bell, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState({ stokTotal: 0, sesiAktif: 0, trxHariIni: 0, trxTotal: 0, pending: 0 })
  const [sesiAktif, setSesiAktif] = useState([])
  const [pending, setPending]     = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const [stokRes, sesiRes, trxRes] = await Promise.all([
      supabase.from('stok_gudang').select('total_nilai').single(),
      supabase.from('sesi_tugas').select(`*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol), toko_assignment(*)`).in('status', ['active','pending_approval','pending_close']),
      supabase.from('transaksi').select('total_koin_nilai, created_at').gte('created_at', today + 'T00:00:00'),
    ])
    const allSesi   = sesiRes.data || []
    const trxToday  = trxRes.data  || []
    const aktif     = allSesi.filter((s) => s.status === 'active')
    const pend      = allSesi.filter((s) => s.status === 'pending_approval' || s.status === 'pending_close')
    setSesiAktif(aktif)
    setPending(pend)
    setStats({
      stokTotal:  stokRes.data?.total_nilai || 0,
      sesiAktif:  aktif.length,
      trxHariIni: trxToday.length,
      trxTotal:   trxToday.reduce((s, t) => s + (t.total_koin_nilai || 0), 0),
      pending:    pend.length,
    })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useRealtime('toko_assignment', null, loadData)
  useRealtime('sesi_tugas', null, loadData)

  const statCards = [
    { label: 'Stok Gudang',       value: formatRupiah(stats.stokTotal), icon: Package,       color: 'bg-blue-50 text-blue-600', sub: 'Total nilai koin' },
    { label: 'Sesi Aktif',        value: stats.sesiAktif,              icon: ClipboardList,  color: 'bg-teal-50 text-teal-600', sub: 'Di lapangan sekarang' },
    { label: 'Transaksi Hari Ini',value: stats.trxHariIni,             icon: TrendingUp,     color: 'bg-emerald-50 text-emerald-600', sub: formatRupiah(stats.trxTotal) },
    { label: 'Menunggu Approval', value: stats.pending,                icon: Bell,           color: 'bg-amber-50 text-amber-600', sub: 'Perlu tindakan', alert: stats.pending > 0 },
  ]

  return (
    <DashboardLayout pendingCount={stats.pending}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Monitoring real-time operasi tukar koin</p>
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

        {/* Pending approvals */}
        {pending.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                <Bell size={16} /> {pending.length} Sesi Menunggu Persetujuan
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sesi Aktif (Realtime)</h2>
          {loading ? (
            <div className="grid gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : sesiAktif.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Tidak ada sesi aktif saat ini</CardContent></Card>
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
                          <p className="text-sm text-muted-foreground">{s.mobil?.nopol} · Driver: {s.driver?.name}</p>
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
    </DashboardLayout>
  )
}
