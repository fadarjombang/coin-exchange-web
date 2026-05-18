import { useState, useEffect } from 'react'
import { Joyride, STATUS } from 'react-joyride'
import { useAuth } from '@/hooks/useAuth'

export default function TourGuide() {
  const { role, isAuthenticated, loading } = useAuth()
  const [run, setRun] = useState(false)
  const [steps, setSteps] = useState([])

  useEffect(() => {
    if (loading || !isAuthenticated) return
    
    // We determine the primary role
    const roles = Array.isArray(role) ? role : [role]
    let currentRole = 'kasir' // default
    if (roles.includes('superadmin')) currentRole = 'superadmin'
    else if (roles.includes('admin') || roles.includes('manager')) currentRole = 'dashboard'

    // Check if tour for this role is already completed
    const tourKey = `tour_completed_${currentRole}`
    if (localStorage.getItem(tourKey)) {
      return
    }

    // Set steps based on role
    if (currentRole === 'dashboard') {
      setSteps([
        {
          target: 'body',
          content: 'Selamat datang di Sistem Manajemen Tukar Koin! Mari ikuti tur singkat ini untuk mengenal fitur-fitur yang ada.',
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '.tour-sidebar-nav',
          content: 'Ini adalah menu navigasi utama Anda untuk berpindah halaman.',
          placement: 'right',
        },
        {
          target: '.tour-menu-sesi',
          content: 'Di menu ini, Anda bisa mengelola sesi tugas kasir, mulai dari membuat sesi (Admin) hingga melakukan approval (Manager).',
          placement: 'right',
        },
        {
          target: '.tour-menu-stok',
          content: 'Pantau ketersediaan stok koin dan uang besar di gudang secara real-time melalui halaman ini.',
          placement: 'right',
        },
        {
          target: '.tour-header-profile',
          content: 'Di sini Anda dapat melihat notifikasi pending dan informasi akun Anda.',
          placement: 'bottom',
        }
      ])
    } else if (currentRole === 'kasir') {
      setSteps([
        {
          target: 'body',
          content: 'Halo Kasir! Selamat datang di Aplikasi Mobile Tukar Koin. Mari lihat cara menggunakannya.',
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '.tour-bottom-nav',
          content: 'Gunakan navigasi bawah ini untuk mengakses berbagai menu utama.',
          placement: 'top',
        },
        {
          target: '.tour-nav-Home',
          content: 'Halaman Home menampilkan ringkasan sesi Anda yang sedang aktif dan progress kunjungan toko.',
          placement: 'top',
        },
        {
          target: '.tour-nav-Toko',
          content: 'Klik menu Toko untuk melihat daftar tugas kunjungan, mulai transaksi, atau skip toko.',
          placement: 'top',
        },
        {
          target: '.tour-nav-Riwayat',
          content: 'Di Riwayat, Anda bisa melihat transaksi yang telah selesai serta mencetak ulang berita acara.',
          placement: 'top',
        }
      ])
    }

    // Delay start slightly to allow components to mount
    const timer = setTimeout(() => setRun(true), 1000)
    return () => clearTimeout(timer)
  }, [role, isAuthenticated, loading])

  const handleJoyrideCallback = (data) => {
    const { status } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false)
      const roles = Array.isArray(role) ? role : [role]
      let currentRole = 'kasir'
      if (roles.includes('superadmin')) currentRole = 'superadmin'
      else if (roles.includes('admin') || roles.includes('manager')) currentRole = 'dashboard'
      
      localStorage.setItem(`tour_completed_${currentRole}`, 'true')
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
