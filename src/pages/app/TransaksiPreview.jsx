import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import MobileLayout from '@/components/layout/MobileLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Download, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { formatRupiah, formatDateTime, DENOM_LIST } from '@/lib/utils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function TransaksiPreview() {
  const { assignmentId } = useParams(); const navigate = useNavigate()
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase.from('toko_assignment').select('*, toko:toko_id(*), sesi_tugas:sesi_tugas_id(*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol))').eq('id', assignmentId).single()
      const { data: t } = await supabase.from('transaksi').select('*').eq('sesi_tugas_id', a.sesi_tugas_id).eq('toko_id', a.toko_id).single()
      setData({ assignment: a, transaksi: t }); setLoading(false)
    }; load()
  }, [assignmentId])

  const generatePDF = async () => {
    setPdfLoading(true)
    try {
      const el = pdfRef.current; if (!el) return
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false })
      const img = canvas.toDataURL('image/jpeg', 0.85)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const w = pdf.internal.pageSize.getWidth()
      const h = (canvas.height * w) / canvas.width
      pdf.addImage(img, 'JPEG', 0, 0, w, h)
      pdf.save(`BA-${data?.toko?.kode_toko}-${formatDateTime(data?.transaksi?.created_at)}.pdf`)
    } catch { } finally { setPdfLoading(false) }
  }

  const shareWA = () => {
    if (!data) return
    const t = data.transaksi; const toko = data.assignment?.toko
    const text = encodeURIComponent(`*BERITA ACARA SERAH TERIMA KOIN*\nTanggal: ${formatDateTime(t.created_at)}\n\nToko: ${toko.nama_toko} (${toko.kode_toko})\nPIC: ${t.pic_nama}\n\nTotal Koin: ${formatRupiah(t.total_koin_nilai)}\nTotal Uang: ${formatRupiah(t.total_uang_diterima)}\nSelisih: Rp 0 ✅\n\n_PDF berita acara telah didownload_`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (loading) return <MobileLayout title="Berita Acara"><div className="p-4 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-muted rounded animate-pulse"/>)}</div></MobileLayout>

  const { transaksi: t, assignment: a } = data
  const sesi = a?.sesi_tugas

  return (
    <MobileLayout title="Berita Acara" showBack onBack={() => navigate('/app/toko')}>
      <div className="p-4 space-y-4">
        <Badge variant="success" className="w-full justify-center py-2 text-sm">✅ Transaksi Berhasil Disimpan</Badge>

        {/* PDF content */}
        <div ref={pdfRef} className="bg-white p-4 rounded-xl border space-y-4 text-sm">
          <div className="text-center border-b pb-3">
            <p className="font-bold text-base text-primary">BERITA ACARA SERAH TERIMA KOIN</p>
            <p className="text-xs text-muted-foreground">Indomaret Finance</p>
            <p className="text-xs mt-1">{formatDateTime(t.created_at)}</p>
          </div>
          <div><p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Data Toko</p>
            <div className="space-y-0.5 text-xs"><p>Kode : {a?.toko?.kode_toko}</p><p>Nama : {a?.toko?.nama_toko}</p><p>PIC  : {t.pic_nama} {t.pic_jabatan && `(${t.pic_jabatan})`}</p></div>
          </div>
          <Separator/>
          <div><p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Data Petugas</p>
            <div className="space-y-0.5 text-xs"><p>Kasir  : {sesi?.kasir?.name}</p><p>Driver : {sesi?.driver?.name}</p><p>Mobil  : {sesi?.mobil?.nopol}</p></div>
          </div>
          <Separator/>
          <div><p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Koin Diserahkan</p>
            <div className="space-y-1">
              {DENOM_LIST.filter((d)=>t[d.key]>0).map((d)=>(
                <div key={d.key} className="flex justify-between text-xs"><span>{d.label} × {t[d.key]} keping</span><span>{formatRupiah(t[d.key]*d.value)}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1"><span>TOTAL KOIN</span><span>{formatRupiah(t.total_koin_nilai)}</span></div>
            </div>
          </div>
          <Separator/>
          <div><p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Uang Besar Diterima</p>
            <div className="space-y-1 text-xs">
              {t.uang_50000>0 && <div className="flex justify-between"><span>Rp 50.000 × {t.uang_50000}</span><span>{formatRupiah(t.uang_50000*50000)}</span></div>}
              {t.uang_100000>0 && <div className="flex justify-between"><span>Rp 100.000 × {t.uang_100000}</span><span>{formatRupiah(t.uang_100000*100000)}</span></div>}
              <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1"><span>TOTAL UANG</span><span>{formatRupiah(t.total_uang_diterima)}</span></div>
              <div className="flex justify-between text-emerald-700 font-bold"><span>SELISIH</span><span>Rp 0 ✅</span></div>
            </div>
          </div>
          {t.foto_serah_terima && (<><Separator/><div><p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Foto Serah Terima</p><img src={t.foto_serah_terima} className="w-full rounded-lg max-h-40 object-cover" alt="Foto"/></div></>)}
          {(t.ttd_pic_toko || t.ttd_kasir) && (<><Separator/><div className="grid grid-cols-2 gap-4"><div className="text-center"><p className="text-xs text-muted-foreground mb-1">PIC Toko</p>{t.ttd_pic_toko && <img src={t.ttd_pic_toko} className="border rounded h-16 w-full object-contain bg-slate-50" alt="TTD PIC"/>}<p className="text-xs mt-1 font-medium">{t.pic_nama}</p></div><div className="text-center"><p className="text-xs text-muted-foreground mb-1">Kasir</p>{t.ttd_kasir && <img src={t.ttd_kasir} className="border rounded h-16 w-full object-contain bg-slate-50" alt="TTD Kasir"/>}<p className="text-xs mt-1 font-medium">{sesi?.kasir?.name}</p></div></div></>)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={generatePDF} disabled={pdfLoading} variant="outline" className="h-12">
            {pdfLoading ? <Loader2 size={16} className="animate-spin mr-1"/> : <Download size={16}/>} Download PDF
          </Button>
          <Button onClick={shareWA} className="h-12 bg-green-600 hover:bg-green-700">
            <MessageCircle size={16}/> Share WA
          </Button>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate('/app/toko')}>
          ← Kembali ke Daftar Toko
        </Button>
      </div>
    </MobileLayout>
  )
}
