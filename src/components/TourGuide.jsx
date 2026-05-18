import { useState, useEffect } from 'react'
import { Joyride, STATUS } from 'react-joyride'
import { useAuth } from '@/hooks/useAuth'
import { useLocation } from 'react-router-dom'

export default function TourGuide() {
  const { role, isAuthenticated, loading } = useAuth()
  const location = useLocation()
  const [run, setRun] = useState(false)
  const [steps, setSteps] = useState([])

  useEffect(() => {
    if (loading || !isAuthenticated) return
    
    const roles = Array.isArray(role) ? role : [role]
    let currentRole = 'kasir'
    if (roles.includes('superadmin')) currentRole = 'superadmin'
    else if (roles.includes('admin')) currentRole = 'admin'
    else if (roles.includes('manager')) currentRole = 'manager'

    // Normalize path to handle dynamic IDs
    let normalizedPath = location.pathname
    if (normalizedPath.match(/\/dashboard\/sesi\/[0-9a-fA-F-]+$/)) {
      normalizedPath = '/dashboard/sesi/detail'
    } else if (normalizedPath.match(/\/app\/toko\/[0-9a-fA-F-]+\/transaksi$/)) {
      normalizedPath = '/app/toko/transaksi'
    }

    const tourKey = `tour_completed_${currentRole}_${normalizedPath}`
    if (localStorage.getItem(tourKey)) {
      setRun(false)
      setSteps([])
      return
    }

    let newSteps = []

    if (currentRole === 'admin') {
      if (normalizedPath === '/dashboard') {
        newSteps = [
          { target: 'body', content: 'Selamat datang Admin! Ikuti tur singkat untuk pengenalan menu.', placement: 'center', disableBeacon: true },
          { target: '.tour-sidebar-nav', content: 'Navigasi utama Anda.', placement: 'right' },
          { target: '.tour-menu-stok', content: 'Pantau saldo dan koreksi manual stok di sini.', placement: 'right' },
          { target: '.tour-menu-sesi', content: 'Buat dan pantau sesi tugas kasir di sini.', placement: 'right' },
        ]
      } else if (normalizedPath === '/dashboard/stok') {
        newSteps = [
          { target: 'body', content: 'Halaman Stok Gudang', placement: 'center', disableBeacon: true },
          { target: 'table', content: 'Tabel ini menampilkan jumlah riil (kuantitas dan nilai) uang yang tersedia di brankas gudang.', placement: 'top' }
        ]
      } else if (normalizedPath === '/dashboard/sesi/buat') {
        newSteps = [
          { target: 'body', content: 'Panduan Pembuatan Sesi Tugas', placement: 'center', disableBeacon: true },
          { target: '.animate-slide-up > div:nth-child(2)', content: 'Pembuatan sesi terdiri dari beberapa langkah berurutan: Memilih Tim, Toko, lalu menentukan jumlah modal koin yang dibawa.', placement: 'bottom' }
        ]
      }
    } else if (currentRole === 'manager') {
      if (normalizedPath === '/dashboard') {
        newSteps = [
          { target: 'body', content: 'Selamat datang Manager!', placement: 'center', disableBeacon: true },
          { target: '.tour-notif-bell', content: 'Lonceng ini untuk pemberitahuan sesi yang butuh approval Anda.', placement: 'bottom' },
          { target: '.tour-menu-sesi', content: 'Cek detail dan berikan approval di menu Sesi Tugas.', placement: 'right' },
        ]
      } else if (normalizedPath === '/dashboard/sesi/detail') {
        newSteps = [
          { target: 'body', content: 'Halaman Detail Sesi', placement: 'center', disableBeacon: true },
          { target: 'button, .bg-amber-50', content: 'Di sini Anda dapat mereview data. Jika statusnya pending, Anda akan menemukan tombol Approve/Reject untuk menyetujui sesi.', placement: 'top' }
        ]
      }
    } else if (currentRole === 'kasir') {
      if (normalizedPath === '/app') {
        newSteps = [
          { target: 'body', content: 'Halo Kasir! Mari lihat cara kerja aplikasi ini.', placement: 'center', disableBeacon: true },
          { target: '.tour-bottom-nav', content: 'Gunakan navigasi bawah untuk berpindah antar menu utama.', placement: 'top' },
          { target: '.tour-nav-Toko', content: 'Klik menu Toko untuk melihat daftar tugas dan memulai transaksi di lapangan.', placement: 'top' }
        ]
      } else if (normalizedPath === '/app/toko') {
        newSteps = [
          { target: 'body', content: 'Daftar Tugas Toko', placement: 'center', disableBeacon: true },
          { target: '.p-4 > div', content: 'Ini adalah daftar toko yang harus Anda kunjungi sesuai urutan. Klik Mulai Kunjungan atau Skip jika terkendala.', placement: 'top' }
        ]
      } else if (normalizedPath === '/app/toko/transaksi') {
        newSteps = [
          { target: 'body', content: 'Form Transaksi Serah Terima', placement: 'center', disableBeacon: true },
          { target: '.p-4 > div:nth-child(3)', content: 'Masukkan TOTAL NILAI Rupiah untuk setiap koin yang Anda serahkan ke toko.', placement: 'top' },
          { target: '.p-4 > div:nth-child(4)', content: 'Masukkan jumlah nilai uang besar yang Anda terima. Pastikan selisihnya menjadi SEIMBANG (0) sebelum menyimpan.', placement: 'top' }
        ]
      }
    }

    if (newSteps.length > 0) {
      setSteps(newSteps)
      const timer = setTimeout(() => setRun(true), 800)
      return () => clearTimeout(timer)
    } else {
      setRun(false)
      setSteps([])
    }
  }, [role, isAuthenticated, loading, location.pathname])

  const handleJoyrideCallback = (data) => {
    const { status } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false)
      
      const roles = Array.isArray(role) ? role : [role]
      let currentRole = 'kasir'
      if (roles.includes('superadmin')) currentRole = 'superadmin'
      else if (roles.includes('admin')) currentRole = 'admin'
      else if (roles.includes('manager')) currentRole = 'manager'

      let normalizedPath = location.pathname
      if (normalizedPath.match(/\/dashboard\/sesi\/[0-9a-fA-F-]+$/)) normalizedPath = '/dashboard/sesi/detail'
      else if (normalizedPath.match(/\/app\/toko\/[0-9a-fA-F-]+\/transaksi$/)) normalizedPath = '/app/toko/transaksi'

      localStorage.setItem(`tour_completed_${currentRole}_${normalizedPath}`, 'true')
    }
  }

  if (steps.length === 0) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#0d9488', // teal-600
          zIndex: 10000,
        },
      }}
      locale={{
        back: 'Kembali',
        close: 'Tutup',
        last: 'Selesai',
        next: 'Lanjut',
        skip: 'Lewati',
      }}
    />
  )
}
