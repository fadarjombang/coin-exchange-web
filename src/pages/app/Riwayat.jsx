import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import MobileLayout from '@/components/layout/MobileLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah, formatTime } from '@/lib/utils'
import { ClipboardList, ChevronRight } from 'lucide-react'

export default function Riwayat() {
  const { profile } = useAuth(); const navigate = useNavigate()
  const [trx, setTrx]     = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal]     = useState(0)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: sesi } = await supabase.from('sesi_tugas').select('id').eq('kasir_id', profile.id).in('status',['active','pending_close','closed']).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if (!sesi) { setLoading(false); return }
    const { data } = await supabase.from('transaksi').select('*, toko:toko_id(kode_toko,nama_toko)').eq('sesi_tugas_id', sesi.id).order('created_at',{ascending:false})
    setTrx(data||[])
    setTotal(data?.reduce((s,t)=>s+(t.total_koin_nilai||0),0)||0)
    setLoading(false)
  }, [profile?.id])
  useEffect(()=>{load()},[load])

  return (
    <MobileLayout title="Riwayat Hari Ini">
      <div className="p-4 space-y-3">
        {!loading && trx.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex justify-between items-center">
              <div><p className="text-xs text-muted-foreground">Total Koin Keluar</p><p className="text-xl font-bold text-primary">{formatRupiah(total)}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Transaksi</p><p className="text-xl font-bold">{trx.length}</p></div>
            </CardContent>
          </Card>
        )}
        {loading ? Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20 w-full rounded-xl"/>)
        : trx.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground"><ClipboardList size={40} className="mx-auto mb-3 opacity-30"/><p>Belum ada transaksi hari ini</p></div>
        ) : trx.map((t) => (
          <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/app/riwayat/${t.id}`)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1"><p className="font-semibold text-sm">{t.toko?.nama_toko}</p><p className="text-xs text-muted-foreground">{t.toko?.kode_toko} · {formatTime(t.created_at)}</p></div>
              <div className="text-right"><p className="font-bold text-sm">{formatRupiah(t.total_koin_nilai)}</p><Badge variant="success" className="text-xs">✓ Seimbang</Badge></div>
              <ChevronRight size={16} className="text-muted-foreground"/>
            </CardContent>
          </Card>
        ))}
      </div>
    </MobileLayout>
  )
}
