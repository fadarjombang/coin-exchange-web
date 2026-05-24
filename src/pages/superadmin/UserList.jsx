import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { adminApi } from '@/lib/adminApi'
import { ROLE_LABELS, formatDateTime } from '@/lib/utils'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { UserPlus, RefreshCw, Shield, Search, Users, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const ROLE_BADGE = {
  superadmin: 'default',
  admin:      'info',
  manager:    'info',
  kasir:      'success',
  driver:     'warning',
}

export default function UserList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [deleting, setDeleting]         = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Task 25: single flow via Edge Function (no duplicate deactivate here)
      await adminApi.deleteUser(deleteTarget.id)
      toast({ title: 'Berhasil', description: `Akun ${deleteTarget.name} telah dihapus.`, variant: 'success' })
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filtered = users.filter((u) => {
    // Pastikan u.role selalu array
    const roles = Array.isArray(u.role) ? u.role : [u.role]
    const matchRole   = roleFilter === 'all' || roles.includes(roleFilter)
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.nik.includes(search)
    return matchRole && matchSearch
  })

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="page-title">Manajemen Akun</h1>
              <p className="page-subtitle">Kelola semua akun user sistem</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} id="refresh-users-btn">
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/superadmin/tambah')} id="add-user-btn">
              <UserPlus size={14} />
              Tambah Akun
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'all',    label: 'Semua' },
            { key: 'admin',  label: 'Admin' },
            { key: 'manager',label: 'Manager' },
            { key: 'kasir',  label: 'Kasir' },
            { key: 'driver', label: 'Driver' },
          ].map(({ key, label }) => {
            const count = key === 'all' ? users.length : users.filter((u) => {
              const roles = Array.isArray(u.role) ? u.role : [u.role]
              return roles.includes(key)
            }).length
            return (
              <button
                key={key}
                onClick={() => setRoleFilter(key)}
                className={`p-4 rounded-lg border text-left transition-all hover:shadow-md ${
                  roleFilter === key ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card border-border'
                }`}
                id={`filter-${key}`}
              >
                <p className="stat-label">{label}</p>
                <p className="stat-value text-xl">{count}</p>
              </button>
            )
          })}
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between py-4 px-0">
              <div className="relative max-w-sm w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama atau NIK..."
                  className="pl-9"
                  id="search-users"
                />
              </div>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                {filtered.length} dari {users.length} akun
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIK</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <Users size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Tidak ada akun ditemukan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/superadmin/edit/${user.id}`)}
                      id={`user-row-${user.id}`}
                    >
                      <TableCell className="font-mono text-sm">{user.nik}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(user.role) ? user.role : [user.role]).map(r => (
                            <Badge key={r} variant={ROLE_BADGE[r] || 'secondary'}>
                              {ROLE_LABELS[r] || r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'success' : 'destructive'}>
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); navigate(`/superadmin/edit/${user.id}`) }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: user.id, name: user.name }) }}
                            disabled={user.role?.includes?.('superadmin')}
                            title={user.role?.includes?.('superadmin') ? 'Superadmin tidak bisa dihapus' : 'Hapus akun'}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun?</AlertDialogTitle>
            <AlertDialogDescription>
              Kamu yakin ingin menghapus akun <strong>{deleteTarget?.name}</strong>?{' '}
              Tindakan ini <strong>tidak dapat dibatalkan</strong> dan akan menghapus semua data yang terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
