import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import MobileLayout from '@/components/layout/MobileLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah, formatDateTime, DENOM_LIST } from '@/lib/utils'

export default function TransaksiDetail() {
  const { transaksiId } = useParams()
  const [t, setT]         = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('transaksi').select('*, toko:toko_id(*), kasir:kasir_id(name)').eq('id', transaksiId).single()
      .then(({data})=>{setT(data);setLoading(false)})
  }, [transaksiId])

  if (loading) return <MobileLayout title="Detail Transaksi" showBack><div className="p-4 space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div></MobileLayout>

  return (
    <MobileLayout title="Detail Transaksi" showBack>
      <div className="p-4 space-y-4">
        <Card><CardContent className="p-4 space-y-2">
          <p className="font-bold">{t?.toko?.nama_toko}</p>
          <p className="text-xs text-muted-foreground">{t?.toko?.kode_toko} · {formatDateTime(t?.created_at)}</p>
          <Badge variant="success">✅ Selisih 0</Badge>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Koin Diserahkan</p>
          {DENOM_LIST.filter((d)=>t?.[d.key]>0).map((d)=>(
            <div key={d.key} className="flex justify-between text-sm"><span>{d.label} × {t[d.key]}</span><span>{formatRupiah(t[d.key]*d.value)}</span></div>
          ))}
          <Separator/>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(t?.total_koin_nilai)}</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uang Diterima</p>
          {t?.uang_50000>0 && <div className="flex justify-between text-sm"><span>Rp 50.000 × {t.uang_50000}</span><span>{formatRupiah(t.uang_50000*50000)}</span></div>}
          {t?.uang_100000>0 && <div className="flex justify-between text-sm"><span>Rp 100.000 × {t.uang_100000}</span><span>{formatRupiah(t.uang_100000*100000)}</span></div>}
          <Separator/>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(t?.total_uang_diterima)}</span></div>
        </CardContent></Card>
        {t?.foto_serah_terima && <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Foto</p><img src={t.foto_serah_terima} className="w-full rounded-lg max-h-48 object-cover" alt="Foto"/></CardContent></Card>}
      </div>
    </MobileLayout>
  )
}
