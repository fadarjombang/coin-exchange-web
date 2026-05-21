import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from './components/ui/toaster'
import TourGuide from './components/TourGuide'

// Pages
import Login from './pages/Login'

// Superadmin
import UserList from './pages/superadmin/UserList'
import UserForm from './pages/superadmin/UserForm'

// Dashboard (Admin + Manager)
import Dashboard from './pages/dashboard/Dashboard'
import TokoList from './pages/dashboard/toko/TokoList'
import TokoForm from './pages/dashboard/toko/TokoForm'
import TokoRiwayat from './pages/dashboard/toko/TokoRiwayat'
import MobilList from './pages/dashboard/mobil/MobilList'
import StokGudang from './pages/dashboard/stok/StokGudang'
import SesiList from './pages/dashboard/sesi/SesiList'
import SesiDetail from './pages/dashboard/sesi/SesiDetail'
import BuatSesi from './pages/dashboard/sesi/BuatSesi'
import Laporan from './pages/dashboard/laporan/Laporan'
import TransaksiPage from './pages/dashboard/transaksi/TransaksiPage'

// Kasir Mobile App
import AppHome from './pages/app/Home'
import AppTokoList from './pages/app/TokoList'
import TransaksiForm from './pages/app/TransaksiForm'
import TransaksiPreview from './pages/app/TransaksiPreview'
import Riwayat from './pages/app/Riwayat'
import TransaksiDetail from './pages/app/TransaksiDetail'
import Rekonsiliasi from './pages/app/Rekonsiliasi'
import AppProfil from './pages/app/Profil'

// Dashboard - Kantor
import KantorTransaksi from './pages/dashboard/kantor/KantorTransaksi'
import KantorTransaksiBaru from './pages/dashboard/kantor/KantorTransaksiBaru'

// Layout guards
import ProtectedRoute from './components/layout/ProtectedRoute'

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
        <TourGuide />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
