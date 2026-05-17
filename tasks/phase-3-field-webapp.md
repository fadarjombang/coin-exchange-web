# Phase 3: Field Officer Webapp
## Kasir Mobile Webapp — Transactions & Tracking

---

### Task 3.1: Kasir Home Page
**Goal**: Show active session overview for logged-in kasir

**Page**: `/app` (mobile-first layout)

**States**:
- **No active session**: Show "Belum ada sesi tugas aktif. Menunggu assignment dari admin."
- **Session pending approval**: Show "Sesi tugas menunggu persetujuan manager."
- **Session active**: Show full dashboard

**Active session dashboard**:
- Session info card: tanggal, mobil (nopol), driver, polisi
- Modal koin summary: total nilai + breakdown per denom
- Sisa koin real-time: modal - total koin yang sudah ditransaksikan
- Progress bar: X dari Y toko selesai
- Quick stats: total koin keluar, total uang masuk hari ini
- Button: "Lihat Daftar Toko" → `/app/toko`

**Query**: Get `sesi_tugas` where kasir_id = current user AND status IN ('pending_approval', 'active')

**Files**:
- `src/pages/app/Home.jsx`
- `src/components/shared/KoinSummaryCard.jsx` — Reusable denom breakdown card

---

### Task 3.2: Toko List Page
**Goal**: Show assigned stores with visit status

**Page**: `/app/toko`

**Display per toko**:
- Urutan number
- Kode toko + nama toko
- Status badge (Pending / Sedang Dikunjungi / Selesai / Skip)
- If selesai: show total koin nilai + waktu selesai
- If skip: show alasan

**Actions per toko**:
- Tap "Mulai Kunjungan" → update status to 'on_progress' → redirect to `/app/toko/:assignmentId/transaksi`
- Tap "Skip" → open modal with textarea for alasan → update status to 'skip'
- Already selesai → tap to view transaction detail (read-only)

**Realtime**: toko_assignment status changes broadcast to dashboard

**Files**:
- `src/pages/app/TokoList.jsx`
- `src/components/shared/TokoCard.jsx`

---

### Task 3.3: Transaction Form
**Goal**: Record coin exchange transaction at a store

**Page**: `/app/toko/:assignmentId/transaksi`

**Form sections**:

**Section 1 — Info Toko (read-only)**:
- Kode toko, nama toko, alamat

**Section 2 — PIC Toko**:
- Nama PIC (text input, required)
- Jabatan PIC (text input, optional)

**Section 3 — Koin Diserahkan**:
- DenomInput component (reuse)
- Each denom max = sisa koin yang tersedia untuk denom itu
- Auto-calculate total koin nilai
- Sisa koin info displayed above

**Section 4 — Uang Besar Diterima**:
- Input: Jumlah lembar Rp 50.000 (number)
- Input: Jumlah lembar Rp 100.000 (number)
- Auto-calculate total uang diterima
- **SELISIH indicator**: total_koin - total_uang
  - Selisih = 0 → green badge "✅ SEIMBANG"
  - Selisih ≠ 0 → red badge "❌ SELISIH: Rp XXX" + submit button disabled

**Section 5 — Foto Serah Terima**:
- Camera button → open device camera
- Preview captured photo
- Auto-compress: maxWidth 800px, JPEG quality 0.6, max 150KB
- Convert to Base64 for storage

**Section 6 — Tanda Tangan**:
- Signature pad 1: "Tanda Tangan PIC Toko" + clear button
- Signature pad 2: "Tanda Tangan Kasir" + clear button
- Both required before submit

**Submit button**: Only enabled when:
- PIC nama filled
- At least 1 denom > 0
- Selisih = 0
- Photo captured
- Both signatures done

**On Submit**:
1. INSERT `transaksi` with all data + Base64 media
2. UPDATE `toko_assignment` status = 'selesai'
3. Redirect to preview/PDF page

**Files**:
- `src/pages/app/TransaksiForm.jsx`
- `src/components/shared/SignaturePad.jsx` — Wrapper around signature_pad.js
- `src/components/shared/CameraCapture.jsx` — Camera + compress + preview
- `src/hooks/useImageCompress.js` — Image compression hook
- `src/components/shared/SelisihBadge.jsx` — Balance indicator component

---

### Task 3.4: Kasir Riwayat Page
**Goal**: View today's completed transactions

**Page**: `/app/riwayat`

**Features**:
- List of all transactions in current session
- Each item: toko name, total koin, total uang, waktu
- Tap to view detail (read-only, same as TransaksiForm but all disabled)
- Summary at bottom: total koin keluar, total uang masuk

**Files**:
- `src/pages/app/Riwayat.jsx`
- `src/pages/app/TransaksiDetail.jsx`

---

### Task 3.5: Mobile Layout & Navigation
**Goal**: Mobile-first layout with bottom navigation

**Bottom nav items**:
1. 🏠 Home (`/app`)
2. 🏪 Toko (`/app/toko`)
3. 📋 Riwayat (`/app/riwayat`)
4. 👤 Profil (show name, NIK, logout button)

**MobileLayout features**:
- Top bar: "Sistem Tukar Koin" + active session badge
- Content area (scrollable)
- Bottom nav (fixed, 4 tabs)
- Safe area padding for mobile

**Files**:
- `src/components/layout/MobileLayout.jsx`
- `src/components/layout/BottomNav.jsx`

**Acceptance Criteria**:
- [ ] Kasir sees active session on home page
- [ ] Toko list shows correct status per store
- [ ] Transaction form validates selisih = 0
- [ ] Camera capture and compress works on mobile
- [ ] Signature pad captures both signatures
- [ ] Submit creates transaction + updates assignment status
- [ ] Realtime: assignment status updates visible on dashboard
- [ ] Mobile layout looks professional on smartphone
