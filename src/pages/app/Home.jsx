import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import MobileLayout from '@/components/layout/MobileLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah, formatNumber, DENOM_LIST, SESSION_STATUS, ASSIGNMENT_STATUS } from '@/lib/utils'
import { ClipboardList, Store, TrendingUp, Coins } from 'lucide-react'

export default function AppHome() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [sesi, setSesi]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [trxSum, setTrxSum]   = useState({ count: 0, total: 0 })

  const loadSesi = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data: rows } = await supabase.from('sesi_tugas')
      .select('*, mobil:mobil_id(nopol), driver:driver_id(name), modal_koin(*), toko_assignment(*, toko:toko_id(nama_toko,kode_toko))')
      .eq('kasir_id', profile.id).in('status', ['pending_approval','active'])
      .order('created_at', { ascending: false }).limit(1)
    const data = rows?.[0] ?? null
    setSesi(data)
    if (data?.id) {
      const { data: trx } = await supabase.from('transaksi').select('total_koin_nilai').eq('sesi_tugas_id', data.id)
      setTrxSum({ count: trx?.length || 0, total: trx?.reduce((s,t)=>s+(t.total_koin_nilai||0),0) || 0 })
    }
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { loadSesi() }, [loadSesi])

  const assigns  = sesi?.toko_assignment || []
  const selesai  = assigns.filter((a) => a.status === 'selesai' || a.status === 'skip').length
  const total    = assigns.length
  const pct      = total > 0 ? Math.round((selesai/total)*100) : 0
  const modalTotal = sesi?.modal_koin?.total_nilai || 0
  const sisaKoin   = modalTotal - trxSum.total

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        {/* Greeting */}
        <div className="pt-2">
          <p className="text-muted-foreground text-sm">Selamat datang,</p>
          <h2 className="text-xl font-bold">{profile?.name}</h2>
        </div>

        {loading ? (
          <div className="space-y-3"><Skeleton className="h-36 w-full rounded-xl"/><Skeleton className="h-24 w-full rounded-xl"/></div>
        ) : !sesi ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ClipboardList size={40} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">Belum ada sesi tugas aktif</p>
              <p className="text-sm text-muted-foreground mt-1">Menunggu assignment dari admin</p>
            </CardContent>
          </Card>
        ) : sesi.status === 'pending_approval' ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-5 text-center">
              <Badge variant="warning" className="mb-3">Menunggu Persetujuan</Badge>
              <p className="text-sm text-amber-800">Sesi tugas Anda sedang menunggu persetujuan Manager sebelum dapat dimulai.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Session card */}
            <Card className="bg-[#1e3a5f] text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-white/20 text-white border-white/30">Sesi Aktif</Badge>
                  <p className="text-blue-200 text-xs">{sesi.mobil?.nopol}</p>
                </div>
                <div className="space-y-1 mb-4">
                  <p className="text-xs text-blue-200">MODAL KOIN</p>
                  <p className="text-2xl font-bold">{formatRupiah(modalTotal)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-blue-200 text-xs">Sisa Koin</p>
                    <p className="font-bold">{formatRupiah(sisaKoin)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-blue-200 text-xs">Koin Keluar</p>
                    <p className="font-bold">{formatRupiah(trxSum.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Progress Kunjungan</span>
                  <span className="text-muted-foreground">{selesai}/{total} toko</span>
                </div>
                <Progress value={pct} className="h-3" />
                <div className="flex gap-2 flex-wrap mt-1">
                  {assigns.sort((a,b)=>a.urutan-b.urutan).map((a) => (
                    <span key={a.id} className="text-base" title={`${a.toko?.nama_toko}: ${ASSIGNMENT_STATUS[a.status]?.label}`}>
                      {ASSIGNMENT_STATUS[a.status]?.icon}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-14 flex-col gap-1" onClick={() => navigate('/app/toko')}>
                <Store size={20} />
                <span className="text-xs">Daftar Toko</span>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => navigate('/app/rekonsiliasi')} disabled={selesai < total}>
                <TrendingUp size={20} />
                <span className="text-xs">Rekonsiliasi</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  )
}
