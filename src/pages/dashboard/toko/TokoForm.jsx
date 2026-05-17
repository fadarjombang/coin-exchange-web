import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Store, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function TokoForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(isEdit)
  const [form, setForm] = useState({ kode_toko: '', nama_toko: '', alamat: '', area: '', is_active: true })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    supabase.from('toko').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm(data)
      setFetching(false)
    })
  }, [id, isEdit])

  const validate = () => {
    const e = {}
    if (!form.kode_toko.trim()) e.kode_toko = 'Kode toko harus diisi'
    if (!form.nama_toko.trim()) e.nama_toko = 'Nama toko harus diisi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = { kode_toko: form.kode_toko, nama_toko: form.nama_toko, alamat: form.alamat, area: form.area, is_active: form.is_active }
      if (isEdit) {
        const { error } = await supabase.from('toko').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('toko').insert(payload)
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: `Toko berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}`, variant: 'success' })
      navigate('/dashboard/toko')
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [field]: val }))
    setErrors((er) => ({ ...er, [field]: '' }))
  }

  if (fetching) return <DashboardLayout><div className="flex justify-center items-center h-64"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/toko')}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="page-title flex items-center gap-2"><Store size={20} />{isEdit ? 'Edit Toko' : 'Tambah Toko'}</h1>
            <p className="page-subtitle">{isEdit ? `Edit: ${form.nama_toko}` : 'Tambah toko baru ke sistem'}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Toko</CardTitle>
            <CardDescription>Field bertanda * wajib diisi</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" id="toko-form">
              <div className="space-y-1.5">
                <Label htmlFor="kode-toko">Kode Toko *</Label>
                <Input id="kode-toko" value={form.kode_toko} onChange={set('kode_toko')} placeholder="Contoh: IDFM-042" className={errors.kode_toko ? 'border-destructive' : ''} />
                {errors.kode_toko && <p className="text-xs text-destructive">{errors.kode_toko}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nama-toko">Nama Toko *</Label>
                <Input id="nama-toko" value={form.nama_toko} onChange={set('nama_toko')} placeholder="Nama toko" className={errors.nama_toko ? 'border-destructive' : ''} />
                {errors.nama_toko && <p className="text-xs text-destructive">{errors.nama_toko}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area">Area</Label>
                <Input id="area" value={form.area} onChange={set('area')} placeholder="Contoh: Jakarta Selatan" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alamat">Alamat</Label>
                <Textarea id="alamat" value={form.alamat} onChange={set('alamat')} placeholder="Alamat lengkap toko" rows={3} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-sm font-medium">Status Toko</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{form.is_active ? 'Toko aktif' : 'Toko nonaktif'}</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} id="is-active-switch" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/dashboard/toko')}>Batal</Button>
                <Button type="submit" disabled={loading} className="flex-1" id="save-toko-btn">
                  {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                  {isEdit ? 'Simpan' : 'Tambah Toko'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
