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

    // Kasir has a simple dedicated mobile tour
    if (currentRole === 'kasir') {
      const tourKey = `tour_completed_kasir_${location.pathname}`
      if (localStorage.getItem(tourKey) === null) {
        localStorage.setItem(tourKey, 'true')
      }
      if (localStorage.getItem(tourKey) === 'true') {
        setRun(false)
        setSteps([])
        return
      }

      let newSteps = []
      if (location.pathname === '/app') {
        newSteps = [
          { target: 'body', content: 'Halo Kasir! Mari lihat cara kerja aplikasi ini.', placement: 'center', disableBeacon: true },
          { target: '.tour-nav-Toko', content: 'Tugas harian Anda ada di menu Toko ini. Klik untuk melihat daftar kunjungan.', placement: 'top' }
        ]
      } else if (location.pathname === '/app/toko') {
        newSteps = [
          { target: 'body', content: 'Daftar Tugas Toko', placement: 'center', disableBeacon: true },
          { target: '.p-4', content: 'Ini adalah daftar toko yang harus dikunjungi. Klik "Mulai Kunjungan" saat Anda tiba di lokasi.', placement: 'top' }
        ]
      } else if (location.pathname.includes('/transaksi')) {
        newSteps = [
          { target: 'body', content: 'Form Transaksi Serah Terima', placement: 'center', disableBeacon: true },
          { target: '.p-4 > div:nth-child(3)', content: 'Masukkan TOTAL NILAI Rupiah untuk setiap koin yang diserahkan ke toko.', placement: 'top' },
          { target: '.p-4 > div:nth-child(4)', content: 'Masukkan jumlah nilai uang besar yang diterima. Pastikan kotak selisih berwarna hijau (SEIMBANG) sebelum bisa Simpan.', placement: 'top' }
        ]
      }

      if (newSteps.length > 0) {
        setSteps(newSteps)
        const timer = setTimeout(() => setRun(true), 800)
        return () => clearTimeout(timer)
      } else {
        setRun(false)
        setSteps([])
      }
      return
    }

    // Superadmin has no onboarding dashboard tour
    if (currentRole === 'superadmin') {
      setRun(false)
      setSteps([])
      return
    }

    // Onboarding Dashboard Flow for Admin & Manager
    const onboardingCompletedKey = `tour_completed_${currentRole}_onboarding`
    
    // Check if onboarding completed permanently. Default to true if not set!
    if (localStorage.getItem(onboardingCompletedKey) === null) {
      localStorage.setItem(onboardingCompletedKey, 'true')
    }
    
    if (localStorage.getItem(onboardingCompletedKey) === 'true') {
      setRun(false)
      setSteps([])
      return
    }

    // Enable active flow if visiting dashboard first time
    let activeFlow = localStorage.getItem('admin_onboarding_active')
    if (!activeFlow && location.pathname === '/dashboard') {
      localStorage.setItem('admin_onboarding_active', 'true')
      activeFlow = 'true'
    }

    // If not in the active onboarding flow, don't run
    if (activeFlow !== 'true') {
      setRun(false)
      setSteps([])
      return
    }

    let newSteps = []
    
    if (location.pathname === '/dashboard') {
      newSteps = [
        { target: 'body', content: 'Selamat datang di Pusat Kendali Tukar Koin Indomaret! Dasbor analisis baru kini siap memantau operasional Anda 100% secara real-time.', placement: 'center', disableBeacon: true },
        { target: '.tour-sidebar-nav', content: 'Navigasi Utama: Menu kontrol lengkap Anda untuk mengelola penugasan kasir, mengaudit stok gudang, dan mengunduh rekonsiliasi.', placement: 'right' },
        { target: '.grid-cols-2', content: 'Rangkuman Metrik Utama: Memantau total kas di gudang, sesi kasir aktif di lapangan, omzet koin keluar hari ini, serta jumlah sesi pending.', placement: 'bottom' },
        { target: '#tour-dash-stok-kritis', content: 'Peringatan Stok Kritis: Sistem otomatis mendeteksi denominasi koin yang menipis di gudang di bawah batas minimum agar Anda tahu kapan harus mengajukan request drop koin tambahan.', placement: 'left' },
        { target: '#tour-dash-distribusi-area', content: 'Analisis Distribusi Area: Melacak serapan nominal koin keluar per area wilayah hari ini untuk pemetaan distribusi koin yang optimal.', placement: 'left' },
        { target: '#tour-dash-operations', content: 'Area Operasional Lapangan: Pantau secara real-time kasir mana saja yang sedang aktif, berapa toko yang sudah mereka selesaikan, serta respon cepat persetujuan sesi.', placement: 'top' },
        {
          target: '.tour-menu-stok',
          content: <div className="tour-transition-step">Luar biasa! Sekarang silakan klik menu navigasi Stok Gudang di sini untuk melanjutkan panduan.</div>,
          placement: 'right',
          styles: {
            buttonNext: { display: 'none' },
            buttonBack: { display: 'none' },
            buttonClose: { display: 'none' }
          },
          spotlightClicks: true,
          showSkipButton: false
        }
      ]
    } else if (location.pathname === '/dashboard/stok') {
      newSteps = [
        { target: 'body', content: 'Halaman Stok Gudang', placement: 'center', disableBeacon: true },
        { target: '#stok-total-cards', content: 'Ini adalah ringkasan total ketersediaan koin and uang besar di brankas secara realtime.', placement: 'bottom' },
        { target: '#tour-stok-log', content: 'Tabel ini merekam semua riwayat perubahan stok koin/uang secara otomatis baik dari transaksi kasir maupun manual untuk transparansi saldo.', placement: 'top' },
        { target: '#btn-penyesuaian', content: 'Klik tombol ini untuk melakukan Penyesuaian Manual stok tanpa melalui form transaksi serah terima.', placement: 'left' },
        {
          target: '.tour-menu-sesi',
          content: <div className="tour-transition-step">Bagus! Sekarang silakan klik menu navigasi Sesi Tugas untuk melanjutkan panduan.</div>,
          placement: 'right',
          styles: {
            buttonNext: { display: 'none' },
            buttonBack: { display: 'none' },
            buttonClose: { display: 'none' }
          },
          spotlightClicks: true,
          showSkipButton: false
        }
      ]
    } else if (location.pathname === '/dashboard/sesi') {
      newSteps = [
        { target: 'body', content: 'Halaman ini adalah pusat kendali Sesi Tugas kasir lapangan Anda.', placement: 'center', disableBeacon: true },
        { target: '#tour-sesi-filters', content: 'Anda dapat menyaring data menggunakan tombol status ini. "Aktif" untuk sesi yang sedang berjalan di lapangan, "Menunggu Approval" untuk yang belum disetujui Manager, dll.', placement: 'bottom' },
        { target: '#tour-sesi-search', content: 'Gunakan kolom pencarian ini untuk mencari sesi berdasarkan nama kasir atau plat nomor mobil dengan cepat.', placement: 'bottom' },
        { target: 'table', content: 'Di tabel ini, setiap sesi akan ditampilkan secara real-time. Klik pada salah satu baris untuk melihat detail lengkap sesi tersebut.', placement: 'top' },
        { target: '#buat-sesi-btn', content: 'Tombol Buat Sesi: Klik di sini jika Anda ingin masuk ke formulir pembuatan sesi penugasan kasir baru (hanya tersedia untuk peran Admin).', placement: 'left' },
        {
          target: '.tour-menu-transaksi',
          content: <div className="tour-transition-step">Hebat! Sekarang silakan klik menu navigasi Transaksi di sini untuk melanjutkan panduan.</div>,
          placement: 'right',
          styles: {
            buttonNext: { display: 'none' },
            buttonBack: { display: 'none' },
            buttonClose: { display: 'none' }
          },
          spotlightClicks: true,
          showSkipButton: false
        }
      ]
    } else if (location.pathname === '/dashboard/transaksi') {
      newSteps = [
        { target: 'body', content: 'Selamat datang di Halaman Transaksi. Di sini Anda dapat melihat semua log transaksi serah terima koin di lapangan.', placement: 'center', disableBeacon: true },
        { target: '#tour-trx-summary', content: 'Rangkuman statistik transaksi, meliputi total nilai koin yang dilepaskan, total uang tunai besar yang masuk, dan jumlah transaksi yang mengalami selisih saldo.', placement: 'bottom' },
        { target: '#tour-trx-filters', content: 'Gunakan panel filter ini untuk membatasi data berdasarkan rentang tanggal dari-sampai.', placement: 'bottom' },
        { target: '#tour-trx-area-select', content: 'Filter Area: Anda dapat mem-filter data secara cepat berdasarkan Area Toko (seperti Ploso, Jombang, Peterongan, dll) untuk mempermudah analisis kebutuhan koin per area.', placement: 'bottom' },
        { target: '#tour-trx-search', content: 'Anda juga bisa langsung mencari data transaksi dengan mengetikkan nama kasir, nama toko, atau kode toko di kolom ini.', placement: 'bottom' },
        { target: '#btn-terapkan-filter', content: 'Setelah mengatur filter, klik tombol Terapkan untuk memperbarui tampilan tabel.', placement: 'top' },
        { target: '#tour-trx-table', content: 'Tabel detail transaksi. Anda dapat memverifikasi nominal koin, nominal uang besar, status selisih, dan nama penanggung jawab (PIC) toko di sini.', placement: 'top' },
        { target: '#btn-export-csv', content: 'Terakhir, Anda dapat mengunduh seluruh data transaksi yang ter-filter ke dalam file CSV (Excel) dengan klik tombol ini.', placement: 'left' },
        {
          target: '.tour-menu-laporan',
          content: <div className="tour-transition-step">Hampir selesai! Sekarang silakan klik menu navigasi Laporan di sini untuk melihat analisis optimasi rute.</div>,
          placement: 'right',
          styles: {
            buttonNext: { display: 'none' },
            buttonBack: { display: 'none' },
            buttonClose: { display: 'none' }
          },
          spotlightClicks: true,
          showSkipButton: false
        }
      ]
    } else if (location.pathname === '/dashboard/laporan') {
      newSteps = [
        { target: 'body', content: 'Selamat datang di Analisis Laporan & Optimasi Kunjungan! Kami menyusun fitur cerdas ini untuk membantu Anda mengefisienkan rute harian.', placement: 'center', disableBeacon: true },
        { target: '#tour-report-intro', content: 'Metodologi Analisis: Sistem melacak toko yang dilewati (skip) oleh kasir dengan alasan koin masih banyak. Ini membantu menyaring toko yang memiliki koin cukup mandiri.', placement: 'bottom' },
        { target: '#tour-report-metrics', content: 'Metrik Analisis: Pantau jumlah toko yang disarankan diturunkan prioritas rutenya, penyebab skip teratas, dan akumulasi riwayat skip.', placement: 'bottom' },
        { target: '#tour-report-skipped-list', content: 'Daftar Analisis Skip Toko: Menampilkan rasio skip toko. Jika >= 50% (berwarna merah), sistem menyarankan "Turunkan Prioritas" rute kunjungan agar bensin dan waktu tim lebih hemat.', placement: 'top' },
        { target: '#tour-report-reasons', content: 'Penyebab Skip Utama: Distribusi alasan skip yang diinput kasir untuk mendeteksi tren operasional.', placement: 'top' },
        { target: '#btn-export-rekomendasi', content: 'Ekspor Rekomendasi CSV: Klik tombol ini untuk mengunduh daftar toko prioritas rendah ke file CSV (Excel) untuk acuan penyusunan rute berikutnya.', placement: 'left' },
        {
          target: 'body',
          content: 'Luar biasa! Anda telah menyelesaikan panduan interaktif seluruh fitur utama Dashboard Tukar Koin Indomaret Jombang. Selamat bekerja!',
          placement: 'center'
        }
      ]
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

      if (currentRole === 'kasir') {
        localStorage.setItem(`tour_completed_kasir_${location.pathname}`, 'true')
        return
      }

      // If user finished the whole dashboard onboarding on the Laporan page, or clicked Skip anywhere:
      if (location.pathname === '/dashboard/laporan' || status === STATUS.SKIPPED) {
        localStorage.setItem(`tour_completed_${currentRole}_onboarding`, 'true')
        localStorage.removeItem('admin_onboarding_active')
      }
    }
  }

  if (steps.length === 0) return null

  return (
    <Joyride
      key={location.pathname}
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#1e3a5f',
          textColor: '#334155',
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          backgroundColor: '#1e3a5f',
          color: '#ffffff',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '500',
        },
        buttonBack: {
          color: '#1e3a5f',
          marginRight: '14px',
          fontSize: '14px',
          fontWeight: '500',
        },
        buttonSkip: {
          color: '#64748b',
          fontSize: '14px',
          fontWeight: '500',
        }
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
