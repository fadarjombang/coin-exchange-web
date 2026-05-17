import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Coins, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [nik, setNik]           = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const from = location.state?.from?.pathname

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!nik.trim())      return setError('NIK harus diisi.')
    if (!password.trim()) return setError('Password harus diisi.')
    if (nik.length < 8)   return setError('NIK minimal 8 digit.')

    setLoading(true)
    try {
      await signIn(nik.trim(), password)
      await new Promise((r) => setTimeout(r, 600))
      navigate(from || '/', { replace: true })
    } catch (err) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('NIK atau password salah.')
      } else {
        setError('Gagal login. Periksa koneksi internet Anda.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1a2b] via-[#1e3a5f] to-[#0f766e] flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-blue-400/5 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4 shadow-xl">
            <Coins size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sistem Tukar Koin</h1>
          <p className="text-blue-200 text-sm mt-1">Indomaret Cabang Jombang</p>
        </div>

        {/* Card */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-center text-lg">Masuk ke Sistem</CardTitle>
            <CardDescription className="text-blue-200 text-center text-sm">
              Gunakan NIK dan password Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
              {/* NIK */}
              <div className="space-y-1.5">
                <Label htmlFor="nik" className="text-blue-100">NIK Karyawan</Label>
                <Input
                  id="nik"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan NIK (8-16 digit)"
                  className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/50 focus-visible:border-white/40"
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-blue-100">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/50 pr-10"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-200 text-sm animate-fade-in">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold h-11 shadow-lg mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Masuk...
                  </>
                ) : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-blue-300/70 text-xs mt-6">
          Lupa password? Hubungi Admin atau Super Admin sistem.
        </p>
      </div>
    </div>
  )
}
