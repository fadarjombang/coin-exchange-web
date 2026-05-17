import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import MobileLayout from '@/components/layout/MobileLayout'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2 } from 'lucide-react'
import { formatRupiah, formatDateTime, DENOM_LIST } from '@/lib/utils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function TransaksiPreview() {
  const { assignmentId } = useParams()
  const navigate         = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase
        .from('toko_assignment')
        .select('*, toko:toko_id(*), sesi_tugas:sesi_tugas_id(*, kasir:kasir_id(name), driver:driver_id(name), mobil:mobil_id(nopol))')
        .eq('id', assignmentId).single()
      const { data: t } = await supabase
        .from('transaksi').select('*')
        .eq('sesi_tugas_id', a.sesi_tugas_id).eq('toko_id', a.toko_id).single()
      setData({ assignment: a, transaksi: t })
      setLoading(false)
    }
    load()
  }, [assignmentId])

  const generatePDF = async () => {
    setPdfLoading(true)
    try {
      const el = pdfRef.current
      if (!el) return
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, logging: false,
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
      })
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      // Buat halaman PDF sesuai ukuran konten (1 halaman panjang)
      const pxToMm = 0.264583
      const pageW  = canvas.width  * pxToMm / 2   // dibagi 2 karena scale: 2
      const pageH  = canvas.height * pxToMm / 2
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] })
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
      const filename = `BA-${data?.assignment?.toko?.kode_toko}-${new Date().toISOString().slice(0,10)}.pdf`
      pdf.save(filename)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(false)
    }
  }


  if (loading) return (
    <MobileLayout title="Berita Acara">
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </MobileLayout>
  )

  const { transaksi: t, assignment: a } = data
  const sesi = a?.sesi_tugas

  // Denom yang memiliki nilai > 0
  const denomAktif = DENOM_LIST.filter(d => (t[d.key] || 0) > 0)

  return (
    <MobileLayout title="Berita Acara" showBack onBack={() => navigate('/app/toko')}>
      <div className="p-4 space-y-4">
        <Badge variant="success" className="w-full justify-center py-2 text-sm">
          Transaksi Berhasil Disimpan
        </Badge>

        {/* =================== PRINT AREA =================== */}
        <div ref={pdfRef} className="bg-white rounded-xl border text-sm" style={{ fontFamily: 'sans-serif' }}>

          {/* Header */}
          <div className="text-center border-b p-4 pb-3">
            <p className="font-bold text-base" style={{ color: '#1e3a5f' }}>BERITA ACARA SERAH TERIMA KOIN</p>
            <p className="text-xs text-gray-500">Indomaret Cabang Jombang</p>
            <p className="text-xs mt-1 text-gray-600">{formatDateTime(t.created_at)}</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Data Toko */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Data Toko</p>
              <table className="w-full text-xs">
                <tbody>
                  <tr><td className="text-gray-500 w-20">Kode</td><td className="font-medium">: {a?.toko?.kode_toko}</td></tr>
                  <tr><td className="text-gray-500">Nama</td><td className="font-medium">: {a?.toko?.nama_toko}</td></tr>
                  <tr><td className="text-gray-500">Alamat</td><td className="font-medium">: {a?.toko?.alamat || '-'}</td></tr>
                  <tr><td className="text-gray-500">PIC</td><td className="font-medium">: {t.pic_nama} {t.pic_jabatan && `(${t.pic_jabatan})`}</td></tr>
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Data Petugas */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Data Petugas</p>
              <table className="w-full text-xs">
                <tbody>
                  <tr><td className="text-gray-500 w-20">Kasir</td><td className="font-medium">: {sesi?.kasir?.name}</td></tr>
                  <tr><td className="text-gray-500">Driver</td><td className="font-medium">: {sesi?.driver?.name}</td></tr>
                  <tr><td className="text-gray-500">Kendaraan</td><td className="font-medium">: {sesi?.mobil?.nopol}</td></tr>
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Koin Diserahkan — tampilkan nilai nominal langsung */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Rincian Koin Diserahkan</p>
              <div className="space-y-1 text-xs">
                {denomAktif.length > 0 ? denomAktif.map(d => (
                  <div key={d.key} className="flex justify-between py-0.5">
                    <span className="text-gray-600">{d.label}</span>
                    <span className="font-semibold">{formatRupiah(t[d.key])}</span>
                  </div>
                )) : (
                  <p className="text-gray-400 italic">Tidak ada rincian</p>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5 mt-1.5">
                  <span>TOTAL KOIN</span>
                  <span style={{ color: '#1e3a5f' }}>{formatRupiah(t.total_koin_nilai)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Uang Besar Diterima — nilai sudah nominal, bukan qty */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Uang Besar Diterima</p>
              <div className="space-y-1 text-xs">
                {(t.uang_50000 || 0) > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">Pecahan Rp 50.000</span>
                    <span className="font-semibold">{formatRupiah(t.uang_50000)}</span>
                  </div>
                )}
                {(t.uang_100000 || 0) > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">Pecahan Rp 100.000</span>
                    <span className="font-semibold">{formatRupiah(t.uang_100000)}</span>
                  </div>
                )}
                {(t.uang_50000 || 0) === 0 && (t.uang_100000 || 0) === 0 && (
                  <p className="text-gray-400 italic">-</p>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5 mt-1.5">
                  <span>TOTAL UANG</span>
                  <span style={{ color: '#1e3a5f' }}>{formatRupiah(t.total_uang_diterima)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-emerald-700">
                  <span>SELISIH</span><span>Rp 0</span>
                </div>
              </div>
            </div>

            {/* Foto Serah Terima */}
            {t.foto_serah_terima && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Foto Serah Terima</p>
                  <img
                    src={t.foto_serah_terima}
                    className="w-full rounded-lg object-cover"
                    style={{ maxHeight: '200px' }}
                    alt="Foto serah terima"
                    crossOrigin="anonymous"
                  />
                </div>
              </>
            )}

            {/* Tanda Tangan */}
            {(t.ttd_pic_toko || t.ttd_kasir) && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Tanda Tangan</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">PIC Toko</p>
                      {t.ttd_pic_toko && (
                        <img src={t.ttd_pic_toko} crossOrigin="anonymous"
                          className="border rounded w-full bg-slate-50 object-contain"
                          style={{ height: '80px' }} alt="TTD PIC" />
                      )}
                      <p className="text-xs mt-1 font-semibold">{t.pic_nama}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Kasir</p>
                      {t.ttd_kasir && (
                        <img src={t.ttd_kasir} crossOrigin="anonymous"
                          className="border rounded w-full bg-slate-50 object-contain"
                          style={{ height: '80px' }} alt="TTD Kasir" />
                      )}
                      <p className="text-xs mt-1 font-semibold">{sesi?.kasir?.name}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Dokumen ini sah tanpa tanda tangan basah</p>
            </div>
          </div>
        </div>
        {/* =================== END PRINT AREA =================== */}

        <div className="space-y-3">
          <Button onClick={generatePDF} disabled={pdfLoading} className="w-full h-12">
            {pdfLoading ? <Loader2 size={16} className="animate-spin mr-1" /> : <Download size={16} />}
            Download Berita Acara PDF
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/app/toko')}>
            ← Kembali ke Daftar Toko
          </Button>
        </div>
      </div>
    </MobileLayout>
  )
}
