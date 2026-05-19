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

    // Kasir has no tour guide on the mobile app
    if (currentRole === 'kasir') {
      setRun(false)
      setSteps([])
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
    
    // Check if onboarding completed permanently
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
        { target: 'body', content: 'Selamat datang di Dashboard Pusat Kendali Tukar Koin. Seluruh metrik operasional tersaji secara real-time di halaman ini.', placement: 'center', disableBeacon: true },
        { target: '.tour-sidebar-nav', content: 'Panel Navigasi: Akses seluruh modul pengelolaan — mulai dari penugasan kasir, pemantauan stok, hingga laporan analisis.', placement: 'right' },
        { target: '.grid-cols-2', content: 'Ringkasan Metrik Utama: Menampilkan saldo gudang, jumlah sesi aktif, volume transaksi hari ini, serta sesi yang menunggu persetujuan.', placement: 'bottom' },
        { target: '#tour-dash-stok-kritis', content: 'Peringatan Stok Kritis: Sistem secara otomatis mendeteksi denominasi koin yang berada di bawah ambang batas minimum persediaan.', placement: 'left' },
        { target: '#tour-dash-distribusi-area', content: 'Distribusi Koin per Area: Menampilkan sebaran volume penukaran koin berdasarkan wilayah untuk mendukung perencanaan distribusi yang optimal.', placement: 'left' },
        { target: '#tour-dash-operations', content: 'Panel Operasional: Pantau progres kasir yang sedang bertugas di lapangan secara langsung, termasuk jumlah toko yang telah dikunjungi.', placement: 'top' },
        {
          target: '.tour-menu-stok',
          content: <div className="tour-transition-step">Selanjutnya, klik menu <strong>Stok Gudang</strong> di samping untuk melanjutkan panduan.</div>,
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
        { target: 'body', content: 'Halaman Stok Gudang menampilkan saldo persediaan koin dan uang kertas secara real-time.', placement: 'center', disableBeacon: true },
        { target: '#stok-total-cards', content: 'Ringkasan nilai total aset koin dan uang kertas yang tersedia di gudang saat ini.', placement: 'bottom' },
        { target: '#tour-stok-log', content: 'Riwayat Mutasi: Merekam seluruh perubahan saldo stok — baik dari transaksi lapangan maupun penyesuaian manual — untuk memastikan transparansi.', placement: 'top' },
        { target: '#btn-penyesuaian', content: 'Penyesuaian Manual: Gunakan fitur ini untuk mengoreksi saldo stok di luar alur transaksi standar (hanya tersedia untuk Admin).', placement: 'left' },
        {
          target: '.tour-menu-sesi',
          content: <div className="tour-transition-step">Selanjutnya, klik menu <strong>Sesi Tugas</strong> untuk melanjutkan panduan.</div>,
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
        { target: 'body', content: 'Halaman Sesi Tugas merupakan pusat pengelolaan penugasan kasir ke lapangan.', placement: 'center', disableBeacon: true },
        { target: '#tour-sesi-filters', content: 'Filter Status: Saring data berdasarkan status sesi — "Aktif" untuk sesi yang sedang berjalan, "Menunggu Persetujuan" untuk yang memerlukan konfirmasi Manager.', placement: 'bottom' },
        { target: '#tour-sesi-search', content: 'Pencarian Cepat: Temukan sesi spesifik berdasarkan nama kasir atau nomor polisi kendaraan.', placement: 'bottom' },
        { target: 'table', content: 'Tabel sesi menampilkan seluruh data penugasan. Klik salah satu baris untuk melihat rincian lengkap sesi tersebut.', placement: 'top' },
        { target: '#buat-sesi-btn', content: 'Buat Sesi Baru: Formulir pembuatan penugasan kasir baru — fitur ini hanya tersedia untuk peran Admin.', placement: 'left' },
        {
          target: '.tour-menu-transaksi',
          content: <div className="tour-transition-step">Selanjutnya, klik menu <strong>Transaksi Lapangan</strong> untuk melanjutkan panduan.</div>,
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
        { target: 'body', content: 'Halaman Transaksi Lapangan menampilkan seluruh rekap penukaran koin yang dilakukan kasir di setiap toko.', placement: 'center', disableBeacon: true },
        { target: '#tour-trx-summary', content: 'Ringkasan Statistik: Total nilai koin yang diserahkan, uang kertas yang diterima, dan jumlah transaksi yang mengalami selisih saldo.', placement: 'bottom' },
        { target: '#tour-trx-filters', content: 'Panel Filter: Batasi tampilan data berdasarkan rentang tanggal untuk analisis periode tertentu.', placement: 'bottom' },
        { target: '#tour-trx-area-select', content: 'Filter Area: Saring data berdasarkan wilayah toko untuk menganalisis kebutuhan koin per area.', placement: 'bottom' },
        { target: '#tour-trx-search', content: 'Pencarian: Temukan transaksi tertentu dengan mengetikkan nama kasir, nama toko, atau kode toko.', placement: 'bottom' },
        { target: '#btn-terapkan-filter', content: 'Klik tombol Terapkan setelah mengatur filter untuk memperbarui tampilan data.', placement: 'top' },
        { target: '#tour-trx-table', content: 'Tabel Transaksi: Verifikasi detail nominal koin, uang kertas, status selisih, dan penanggung jawab (PIC) di setiap toko.', placement: 'top' },
        { target: '#btn-export-csv', content: 'Ekspor Data: Unduh seluruh data transaksi yang ter-filter ke dalam file CSV untuk keperluan pelaporan.', placement: 'left' },
        {
          target: '.tour-menu-kantor',
          content: <div className="tour-transition-step">Selanjutnya, klik menu <strong>Transaksi Kantor</strong> untuk melihat rekapan penukaran internal.</div>,
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
    } else if (location.pathname === '/dashboard/kantor') {
      newSteps = [
        { target: 'body', content: 'Halaman Penukaran Kantor merekam seluruh transaksi penukaran koin oleh toko yang datang langsung ke kantor cabang.', placement: 'center', disableBeacon: true },
        { target: '.grid-cols-3', content: 'Ringkasan total transaksi kantor pada periode terpilih — meliputi jumlah koin yang diserahkan dan uang kertas yang diterima.', placement: 'bottom' },
        { target: 'table', content: 'Tabel riwayat ini terpisah dari transaksi lapangan untuk memastikan kejelasan rekonsiliasi masing-masing jalur operasional.', placement: 'top' },
        {
          target: '.tour-menu-laporan',
          content: <div className="tour-transition-step">Langkah terakhir — klik menu <strong>Laporan</strong> untuk melihat analisis optimasi rute kunjungan.</div>,
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
        { target: 'body', content: 'Halaman Laporan & Analisis menyajikan insight berbasis data untuk mendukung pengambilan keputusan operasional Anda.', placement: 'center', disableBeacon: true },
        { target: '#tour-report-intro', content: 'Metodologi: Sistem menganalisis pola kunjungan kasir yang dilewati (skip) untuk mengidentifikasi toko dengan persediaan koin mandiri yang memadai.', placement: 'bottom' },
        { target: '#tour-report-metrics', content: 'Metrik Analisis: Jumlah toko yang direkomendasikan untuk turun prioritas, alasan skip terbanyak, dan akumulasi total kunjungan yang dilewati.', placement: 'bottom' },
        { target: '#tour-report-skipped-list', content: 'Tabel Analisis per Toko: Menampilkan rasio kunjungan yang dilewati. Toko dengan rasio ≥ 50% (ditandai merah) direkomendasikan untuk diturunkan prioritasnya.', placement: 'top' },
        { target: '#tour-report-reasons', content: 'Distribusi Alasan: Pemetaan alasan yang dilaporkan kasir saat melewati toko, untuk mendeteksi pola operasional secara keseluruhan.', placement: 'top' },
        { target: '#btn-export-rekomendasi', content: 'Ekspor Rekomendasi: Unduh daftar toko prioritas rendah ke file CSV sebagai acuan penyusunan rute kunjungan berikutnya.', placement: 'left' },
        {
          target: 'body',
          content: 'Anda telah menyelesaikan seluruh panduan interaktif Dashboard Tukar Koin Indomaret. Selamat bekerja dan semoga produktif!',
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
    const { status, action } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status) || action === 'close') {
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

      // Mark as completed regardless of which page they exit/finish on
      localStorage.setItem(`tour_completed_${currentRole}_onboarding`, 'true')
      localStorage.removeItem('admin_onboarding_active')
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
