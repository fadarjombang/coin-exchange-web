import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/utils'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, UserPlus, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function UserForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)
  const [form, setForm] = useState({
    nik: '', name: '', role: [], is_active: true, password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    const fetch = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', id).single()
      if (data) setForm((f) => ({ ...f, nik: data.nik, name: data.name, role: data.role, is_active: data.is_active }))
      setFetching(false)
    }
    fetch()
  }, [id, isEdit])

  const validate = () => {
    const e = {}
    if (!form.nik.trim()) e.nik = 'NIK harus diisi'
    if (form.nik.length < 8) e.nik = 'NIK minimal 8 digit'
    if (!form.name.trim()) e.name = 'Nama harus diisi'
    if (!form.role || form.role.length === 0) e.role = 'Role harus dipilih (minimal 1)'
    if (!isEdit && !form.password) e.password = 'Password harus diisi'
    if (!isEdit && form.password.length < 6) e.password = 'Password minimal 6 karakter'
    if (!isEdit && form.password !== form.confirmPassword) e.confirmPassword = 'Password tidak cocok'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      if (isEdit) {
        // Update users table
        const { error } = await supabase.from('users')
          .update({ name: form.name, role: form.role, is_active: form.is_active })
          .eq('id', id)
        if (error) throw error
        // Optionally reset password
        if (form.password) {
          await supabaseAdmin.auth.admin.updateUserById(id, { password: form.password })
        }
        toast({ title: 'Berhasil', description: 'Akun berhasil diperbarui', variant: 'success' })
      } else {
        // Create via Supabase Auth admin API
        const email = `${form.nik}@coin.internal`
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email, password: form.password, email_confirm: true,
        })
        if (authErr) throw authErr
        const { error: dbErr } = await supabase.from('users')
          .insert({ id: authData.user.id, nik: form.nik, name: form.name, role: form.role })
        if (dbErr) throw dbErr
        toast({ title: 'Berhasil', description: 'Akun berhasil dibuat', variant: 'success' })
      }
      navigate('/superadmin')
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

  if (fetching) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin')}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              {isEdit ? <Pencil size={20} /> : <UserPlus size={20} />}
              {isEdit ? 'Edit Akun' : 'Tambah Akun'}
            </h1>
            <p className="page-subtitle">{isEdit ? `Edit data user: ${form.name}` : 'Buat akun user baru'}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Akun</CardTitle>
            <CardDescription>Semua field bertanda * wajib diisi</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" id="user-form">
              <div className="space-y-1.5">
                <Label htmlFor="nik">NIK Karyawan *</Label>
                <Input
                  id="nik"
                  value={form.nik}
                  onChange={set('nik')}
                  placeholder="Contoh: 1234567890123456"
                  maxLength={16}
                  inputMode="numeric"
                  disabled={isEdit}
                  className={errors.nik ? 'border-destructive' : ''}
                />
                {errors.nik && <p className="text-xs text-destructive">{errors.nik}</p>}
                {isEdit && <p className="text-xs text-muted-foreground">NIK tidak dapat diubah</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Lengkap *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Masukkan nama lengkap"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label>Role (Bisa pilih lebih dari satu) *</Label>
                <div className={`grid grid-cols-2 gap-3 p-3 border rounded-lg ${errors.role ? 'border-destructive' : 'border-border'}`}>
                  {['admin', 'manager', 'kasir', 'driver'].map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={form.role.includes(r)}
                        onCheckedChange={(checked) => {
                          setForm(f => ({
                            ...f, 
                            role: checked 
                              ? [...f.role, r] 
                              : f.role.filter(x => x !== r)
                          }))
                          setErrors(er => ({...er, role: ''}))
                        }}
                      />
                      <span className="text-sm">{ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>

              {isEdit && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-sm font-medium">Status Akun</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {form.is_active ? 'Akun aktif dan dapat login' : 'Akun nonaktif, tidak dapat login'}
                    </p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                    id="is-active-switch"
                  />
                </div>
              )}

              <Separator />

              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  {isEdit ? 'Reset Password (opsional)' : 'Password *'}
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {isEdit ? 'Kosongkan jika tidak ingin mengubah password' : 'Minimal 6 karakter'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder={isEdit ? 'Password baru (opsional)' : 'Minimal 6 karakter'}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    placeholder="Ulangi password"
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/superadmin')}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="flex-1" id="save-user-btn">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  {isEdit ? 'Simpan Perubahan' : 'Buat Akun'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
