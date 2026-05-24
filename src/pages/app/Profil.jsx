import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import MobileLayout from '@/components/layout/MobileLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Phone, BadgeIcon } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'

export default function AppProfil() {
  const { profile, role, signOut } = useAuth(); const navigate = useNavigate()
  const roles = Array.isArray(role) ? role : [role]
  const handleLogout = async () => { await signOut(); navigate('/login') }
  return (
    <MobileLayout title="Profil Saya">
      <div className="p-4 space-y-4">
        <div className="flex flex-col items-center pt-4 pb-2">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3 shadow-lg">
            <span className="text-white text-3xl font-bold">{profile?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <h2 className="text-lg font-bold">{profile?.name}</h2>
          <Badge variant="info" className="mt-1">{roles.map(r => ROLE_LABELS[r] || r).join(' & ')}</Badge>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {[{icon:BadgeIcon,label:'NIK',value:profile?.nik},{icon:User,label:'Nama',value:profile?.name}].map(({icon:Icon,label,value})=>(
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Icon size={16} className="text-primary"/></div>
                <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value||'-'}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Button variant="destructive" className="w-full h-12" onClick={handleLogout}>
          <LogOut size={16}/> Keluar
        </Button>
      </div>
    </MobileLayout>
  )
}
