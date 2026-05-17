# Product Requirements Document (PRD)
## Sistem Manajemen Tukar Koin — Indomaret Finance

---

### 1. Latar Belakang
Tim Finance Indomaret secara rutin mengirim koin ke toko-toko menggunakan mobil operasional. Proses penukaran koin dengan uang besar saat ini belum terdigitalisasi dengan baik, menyebabkan kesulitan dalam tracking stok, pencatatan transaksi, dan rekonsiliasi keuangan.

### 2. Tujuan
Membangun webapp yang:
- Memudahkan petugas lapangan mencatat transaksi penukaran koin di setiap toko
- Menyediakan dashboard admin & manager untuk monitoring dan approval
- Menjaga integritas stok koin gudang dengan pencatatan yang akurat
- Menghasilkan berita acara PDF per transaksi untuk dokumentasi

### 3. User Personas

#### 3.1 Super Admin
- **Siapa**: IT / pimpinan yang setup sistem
- **Kebutuhan**: Membuat dan mengelola semua akun user (admin, manager, kasir, driver)
- **Frekuensi**: Jarang, hanya saat ada perubahan personel

#### 3.2 Admin
- **Siapa**: Staf finance gudang
- **Kebutuhan**: Mengelola stok gudang, membuat sesi tugas harian, mengelola master data
- **Frekuensi**: Setiap hari kerja, pagi sebelum petugas berangkat

#### 3.3 Manager
- **Siapa**: Kepala tim finance
- **Kebutuhan**: Approve keberangkatan & kepulangan, monitoring petugas, lihat laporan
- **Frekuensi**: Setiap hari, beberapa kali sehari (approve pagi & sore)

#### 3.4 Kasir
- **Siapa**: Petugas lapangan yang masuk ke toko
- **Kebutuhan**: Catat transaksi, foto bukti, tanda tangan digital, generate PDF
- **Frekuensi**: Setiap hari kerja, full day di lapangan

#### 3.5 Driver
- **Siapa**: Pengemudi mobil operasional (karyawan Indomaret)
- **Kebutuhan**: Hanya terdaftar di sistem, tidak perlu login aktif
- **Frekuensi**: Passive — di-assign oleh admin ke sesi

### 4. Fitur per Role

#### 4.1 Super Admin
| ID | Fitur | Prioritas |
|---|---|---|
| SA-1 | Login dengan NIK + password | P0 |
| SA-2 | List semua akun user | P0 |
| SA-3 | Tambah akun baru (NIK, nama, role, password) | P0 |
| SA-4 | Edit akun (nama, role, reset password) | P0 |
| SA-5 | Nonaktifkan/aktifkan akun | P0 |

#### 4.2 Admin
| ID | Fitur | Prioritas |
|---|---|---|
| AD-1 | Dashboard overview (stok, sesi aktif, transaksi hari ini) | P0 |
| AD-2 | CRUD master data toko (kode, nama, alamat, area) | P0 |
| AD-3 | CRUD master data mobil (nopol) | P0 |
| AD-4 | Lihat & adjust stok gudang per denom | P0 |
| AD-5 | Lihat history log perubahan stok | P1 |
| AD-6 | Buat sesi tugas (4 step form) | P0 |
| AD-7 | Edit sesi yang masih draft | P0 |
| AD-8 | Lihat semua sesi + detail | P0 |
| AD-9 | Monitoring realtime progress petugas | P1 |
| AD-10 | Lihat riwayat transaksi per toko | P1 |

#### 4.3 Manager
| ID | Fitur | Prioritas |
|---|---|---|
| MG-1 | Dashboard dengan alert sesi pending | P0 |
| MG-2 | Review & approve/reject keberangkatan | P0 |
| MG-3 | Review & approve/reject kepulangan (rekonsiliasi) | P0 |
| MG-4 | Monitoring realtime progress semua sesi aktif | P0 |
| MG-5 | Lihat riwayat transaksi per toko | P1 |
| MG-6 | Laporan rekap per periode | P1 |

#### 4.4 Kasir (Webapp Mobile)
| ID | Fitur | Prioritas |
|---|---|---|
| KS-1 | Login NIK + password | P0 |
| KS-2 | Home: lihat sesi aktif, modal, progress | P0 |
| KS-3 | Daftar toko assignment + status | P0 |
| KS-4 | Form transaksi: input koin per denom | P0 |
| KS-5 | Form transaksi: input uang besar diterima | P0 |
| KS-6 | Validasi realtime: selisih harus 0 | P0 |
| KS-7 | Foto serah terima (1 foto, dari kamera) | P0 |
| KS-8 | Signature pad PIC toko + kasir | P0 |
| KS-9 | Submit transaksi | P0 |
| KS-10 | Generate & download PDF berita acara | P0 |
| KS-11 | Share PDF via WhatsApp (wa.me) | P1 |
| KS-12 | Skip toko + alasan | P0 |
| KS-13 | Form rekonsiliasi pulang | P0 |
| KS-14 | Riwayat transaksi hari ini | P1 |

### 5. Non-Functional Requirements
- **Online-only**: No offline support needed
- **Mobile-first**: Kasir webapp optimized for smartphone
- **Desktop-first**: Admin/Manager dashboard optimized for desktop
- **Performance**: Photo compressed to <200KB before Base64 storage
- **Security**: RLS policies on all tables, role-based access
- **Cost**: 100% free tier (Supabase free + Vercel free)

### 6. Out of Scope (v1)
- GPS tracking petugas
- Push notifications
- Multi-language support
- Audit trail per field change
- Integration with ERP/SAP
