import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Car, Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/utils'

export default function MobilList() {
  const { toast } = useToast()
  const [mobil, setMobil]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [dialog, setDialog]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ nopol: '', is_active: true })

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('mobil').select('*').order('created_at', { ascending: false })
    setMobil(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch() }, [fetch])

  const openAdd  = () => { setEditing(null); setForm({ nopol: '', is_active: true }); setDialog(true) }
  const openEdit = (m) => { setEditing(m); setForm({ nopol: m.nopol, is_active: m.is_active }); setDialog(true) }

  const handleSave = async () => {
    if (!form.nopol.trim()) return toast({ title: 'Nopol harus diisi', variant: 'destructive' })
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('mobil').update({ nopol: form.nopol, is_active: form.is_active }).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('mobil').insert({ nopol: form.nopol })
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: `Mobil berhasil ${editing ? 'diperbarui' : 'ditambahkan'}`, variant: 'success' })
      setDialog(false); fetch()
    } catch (err) { toast({ title: 'Gagal', description: err.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Car size={20} className="text-primary" /></div>
            <div><h1 className="page-title">Master Mobil</h1><p className="page-subtitle">{mobil.length} kendaraan terdaftar</p></div>
          </div>
          <Button onClick={openAdd} id="add-mobil-btn"><Plus size={16} /> Tambah Mobil</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nopol</TableHead><TableHead>Status</TableHead><TableHead>Ditambahkan</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({length:3}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell></TableRow>)
                : mobil.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">{m.nopol}</TableCell>
                    <TableCell><Badge variant={m.is_active ? 'success' : 'destructive'}>{m.is_active ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDateTime(m.created_at)}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Edit</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Mobil' : 'Tambah Mobil'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="nopol">Nomor Polisi *</Label><Input id="nopol" value={form.nopol} onChange={(e) => setForm((f) => ({ ...f, nopol: e.target.value }))} placeholder="Contoh: B 1234 XYZ" /></div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Status Aktif</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}{editing ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
