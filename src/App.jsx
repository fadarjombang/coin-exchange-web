import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/toaster'
import TourGuide from './components/TourGuide'
import { Loader2 } from 'lucide-react'

// Pages
import Login from './pages/Login'

// Superadmin — lazy loaded
const UserList = lazy(() => import('./pages/superadmin/UserList'))
const UserForm = lazy(() => import('./pages/superadmin/UserForm'))

// Dashboard (Admin + Manager) — lazy loaded
const Dashboard          = lazy(() => import('./pages/dashboard/Dashboard'))
const TokoList           = lazy(() => import('./pages/dashboard/toko/TokoList'))
const TokoForm           = lazy(() => import('./pages/dashboard/toko/TokoForm'))
const TokoRiwayat        = lazy(() => import('./pages/dashboard/toko/TokoRiwayat'))
const MobilList          = lazy(() => import('./pages/dashboard/mobil/MobilList'))
const StokGudang         = lazy(() => import('./pages/dashboard/stok/StokGudang'))
const SesiList           = lazy(() => import('./pages/dashboard/sesi/SesiList'))
const SesiDetail         = lazy(() => import('./pages/dashboard/sesi/SesiDetail'))
const BuatSesi           = lazy(() => import('./pages/dashboard/sesi/BuatSesi'))
const Laporan            = lazy(() => import('./pages/dashboard/laporan/Laporan'))
const TransaksiPage      = lazy(() => import('./pages/dashboard/transaksi/TransaksiPage'))
const KantorTransaksi    = lazy(() => import('./pages/dashboard/kantor/KantorTransaksi'))
const KantorTransaksiBaru = lazy(() => import('./pages/dashboard/kantor/KantorTransaksiBaru'))

// Kasir Mobile App — lazy loaded (isolated from admin deps)
const AppHome          = lazy(() => import('./pages/app/Home'))
const AppTokoList      = lazy(() => import('./pages/app/TokoList'))
const TransaksiForm    = lazy(() => import('./pages/app/TransaksiForm'))
const TransaksiPreview = lazy(() => import('./pages/app/TransaksiPreview'))
const Riwayat          = lazy(() => import('./pages/app/Riwayat'))
const TransaksiDetail  = lazy(() => import('./pages/app/TransaksiDetail'))
const Rekonsiliasi     = lazy(() => import('./pages/app/Rekonsiliasi'))
const AppProfil        = lazy(() => import('./pages/app/Profil'))

// Layout guards
import ProtectedRoute from './components/layout/ProtectedRoute'

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="animate-spin text-primary w-8 h-8" />
    </div>
  )
}

function RoleRedirect() {
  const { role, isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  
  const roles = Array.isArray(role) ? role : [role]
  
  if (roles.includes('superadmin')) return <Navigate to="/superadmin" replace />
  if (roles.includes('admin') || roles.includes('manager')) return <Navigate to="/dashboard" replace />
  if (roles.includes('kasir')) return <Navigate to="/app" replace />
  if (roles.includes('driver')) return <Navigate to="/login" replace />
  
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Super Admin */}
          <Route path="/superadmin" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <UserList />
            </ProtectedRoute>
          } />
          <Route path="/superadmin/tambah" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <UserForm />
            </ProtectedRoute>
          } />
          <Route path="/superadmin/edit/:id" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <UserForm />
            </ProtectedRoute>
          } />

          {/* Dashboard — Admin & Manager */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/toko" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <TokoList />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/toko/tambah" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TokoForm />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/toko/edit/:id" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TokoForm />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/toko/:id/riwayat" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <TokoRiwayat />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/mobil" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MobilList />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/stok" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <StokGudang />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/sesi" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <SesiList />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/sesi/buat" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BuatSesi />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/sesi/edit/:editId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BuatSesi />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/sesi/:id" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <SesiDetail />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/laporan" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Laporan />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/kantor" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <KantorTransaksi />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/kantor/baru" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <KantorTransaksiBaru />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/transaksi" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <TransaksiPage />
            </ProtectedRoute>
          } />

          {/* Kasir Mobile App */}
          <Route path="/app" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <AppHome />
            </ProtectedRoute>
          } />
          <Route path="/app/toko" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <AppTokoList />
            </ProtectedRoute>
          } />
          <Route path="/app/toko/:assignmentId/transaksi" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <TransaksiForm />
            </ProtectedRoute>
          } />
          <Route path="/app/toko/:assignmentId/preview" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <TransaksiPreview />
            </ProtectedRoute>
          } />
          <Route path="/app/riwayat" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <Riwayat />
            </ProtectedRoute>
          } />
          <Route path="/app/riwayat/:transaksiId" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <TransaksiDetail />
            </ProtectedRoute>
          } />
          <Route path="/app/rekonsiliasi" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <Rekonsiliasi />
            </ProtectedRoute>
          } />
          <Route path="/app/profil" element={
            <ProtectedRoute allowedRoles={['kasir']}>
              <AppProfil />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <TourGuide />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
