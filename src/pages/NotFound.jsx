import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <p className="text-6xl font-bold text-muted-foreground/30 mb-2">404</p>
      <h1 className="text-xl font-bold text-foreground mb-2">Halaman Tidak Ditemukan</h1>
      <p className="text-sm text-muted-foreground mb-6">
        URL yang Anda akses tidak tersedia.
      </p>
      <Button onClick={() => navigate('/')}>Kembali ke Beranda</Button>
    </div>
  )
}
