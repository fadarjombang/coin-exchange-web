import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Store, Plus, Search, History, Upload, Loader2, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function TokoList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [toko, setToko] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const fileRef = useRef(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('toko').select('*').order('kode_toko')
    setToko(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    try {
      // Lazy-load SheetJS
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const rows = json.map((r) => ({
        kode_toko: String(r['kode_toko'] || r['Kode Toko'] || r['KODE_TOKO'] || '').trim(),
        nama_toko: String(r['nama_toko'] || r['Nama Toko'] || r['NAMA_TOKO'] || '').trim(),
        area: String(r['area'] || r['Area'] || '').trim() || null,
        alamat: String(r['alamat'] || r['Alamat'] || '').trim() || null,
        as: String(r['as'] || r['AS'] || r['Area Supervisor'] || '').trim() || null,
        am: String(r['am'] || r['AM'] || r['Area Manager'] || '').trim() || null,
        is_active: true,
      })).filter((r) => r.kode_toko && r.nama_toko)

      if (rows.length === 0) {
        toast({ title: 'File kosong', description: 'Tidak ada baris valid. Pastikan kolom: kode_toko, nama_toko, area, alamat, AS, AM', variant: 'destructive' })
        return
      }

      const { error } = await supabase.from('toko').upsert(rows, { onConflict: 'kode_toko' })
      if (error) throw error

      toast({ title: `${rows.length} toko berhasil diimpor`, variant: 'success' })
      fetch()
    } catch (err) {
      toast({ title: 'Import gagal', description: err.message, variant: 'destructive' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const data = [
      { 'Kode Toko': 'IDFM-991', 'Nama Toko': 'Indomaret Contoh 1', 'Area': 'Jakarta', 'Alamat': 'Jl. Contoh No. 123', 'AS': 'Supervisor A', 'AM': 'Manager A' },
      { 'Kode Toko': 'IDFM-992', 'Nama Toko': 'Indomaret Contoh 2', 'Area': 'Surabaya', 'Alamat': 'Jl. Sample No. 45', 'AS': 'Supervisor B', 'AM': 'Manager B' }
    ]
    const ws = XLSX.utils.json_to_sheet(data)

    // Auto-size columns slightly
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Toko')
    XLSX.writeFile(wb, 'Template_Master_Toko.xlsx')
  }

  const filtered = toko.filter((t) =>
    !search || t.nama_toko.toLowerCase().includes(search.toLowerCase()) || t.kode_toko.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedToko = filtered.slice(startIndex, startIndex + itemsPerPage)

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Store size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="page-title">Master Toko</h1>
              <p className="page-subtitle">{toko.length} toko terdaftar</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex-1 sm:flex-none">
              <Download size={14} /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing} className="flex-1 sm:flex-none">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Mengimpor...' : 'Import Excel'}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
            <Button onClick={() => navigate('/dashboard/toko/tambah')} id="add-toko-btn" className="w-full sm:w-auto">
              <Plus size={16} /> Tambah Toko
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-0">
            <div className="flex gap-3 items-center py-4 px-0">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari toko..." className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Toko</TableHead>
                  <TableHead>Nama Toko</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : paginatedToko.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Tidak ada toko ditemukan</TableCell></TableRow>
                ) : paginatedToko.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/toko/edit/${t.id}`)}>
                    <TableCell className="font-mono font-medium">{t.kode_toko}</TableCell>
                    <TableCell>{t.nama_toko}</TableCell>
                    <TableCell>{t.area || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{t.alamat || '-'}</TableCell>
                    <TableCell><Badge variant={t.is_active ? 'success' : 'destructive'}>{t.is_active ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/toko/${t.id}/riwayat`) }}>
                        <History size={14} /> Riwayat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filtered.length)} dari {filtered.length} toko
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <div className="text-xs font-medium px-2">
                    {currentPage} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
