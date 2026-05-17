# Phase 6: Dashboard, Monitoring & Reports
## Realtime Dashboard, Toko History & Reports

---

### Task 6.1: Admin/Manager Dashboard
**Goal**: Overview page with key metrics and active session monitoring

**Page**: `/dashboard`

**Cards row**:
- Stok Gudang Total (Rp value)
- Sesi Aktif (count)
- Transaksi Hari Ini (count + total Rp)
- Pending Approval (count, with alert badge)

**Active Sessions Panel** (realtime):
- For each active sesi_tugas:
  - Header: Mobil nopol + Kasir name + Driver name
  - Progress: "3 dari 5 toko selesai"
  - Progress bar visual
  - Timeline/list of toko assignments with status:
    - ✅ Selesai — time — total Rp
    - 🔄 Sedang dikunjungi...
    - ⏳ Pending
    - ⛔ Skip — alasan
  - Total koin keluar / total uang masuk so far
- Subscribe to Supabase Realtime on `toko_assignment` table

**Pending Approvals Quick List**:
- List of sesi with status='pending_approval' or 'pending_close'
- Click → go to detail page

**Files**:
- `src/pages/dashboard/Dashboard.jsx`
- `src/components/shared/ActiveSessionCard.jsx` — Realtime session tracker
- `src/hooks/useRealtime.js` — Supabase Realtime subscription hook

**useRealtime hook**:
```js
export function useRealtime(table, filter, callback) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table,
        filter: filter,
      }, callback)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, filter]);
}
```

---

### Task 6.2: Toko Transaction History
**Goal**: View all transaction history for a specific store

**Page**: `/dashboard/toko/:id/riwayat`

**Features**:
- Toko info header: kode, nama, alamat, area
- Transaction history table (all transaksi for this toko_id):
  - Tanggal
  - Sesi (link to sesi detail)
  - Kasir name
  - Total koin
  - Total uang
  - Status
- Filter by date range
- Summary stats: total transactions, total koin exchanged, total uang received

**Access from**:
- `/dashboard/toko` list → "Riwayat" button per toko row
- `/dashboard/sesi/:id` detail → click toko name in assignment list

**Files**:
- `src/pages/dashboard/toko/TokoRiwayat.jsx`

---

### Task 6.3: Reports Page
**Goal**: Generate reports and recaps

**Page**: `/dashboard/laporan`

**Report types**:

**1. Rekap Harian**:
- Date picker (single date)
- Show all sesi on that date
- Summary: total koin keluar, total uang masuk, total sesi, total toko

**2. Rekap Per Periode**:
- Date range picker
- Aggregated data per day (table)
- Totals at bottom

**3. Rekap Per Kasir**:
- Select kasir (dropdown)
- Date range
- All sessions by that kasir with totals

**4. Stok Gudang Log**:
- Date range filter
- Full stok_gudang_log table display
- Filter by tipe (keluar_modal / masuk_sisa / penyesuaian)

**All reports**: "Export" button → generate simple CSV or table-based print

**Files**:
- `src/pages/dashboard/laporan/Laporan.jsx`
- `src/pages/dashboard/laporan/RekapHarian.jsx`
- `src/pages/dashboard/laporan/RekapPeriode.jsx`
- `src/pages/dashboard/laporan/RekapKasir.jsx`
- `src/pages/dashboard/laporan/StokLog.jsx`

---

### Task 6.4: Dashboard Sidebar & Navigation
**Goal**: Polished sidebar navigation for dashboard

**Sidebar items by role**:

**Admin sees**:
- 📊 Dashboard
- 📝 Sesi Tugas (with pending count badge)
- 🏪 Master Toko
- 🚗 Master Mobil
- 📦 Stok Gudang
- 📈 Laporan

**Manager sees**:
- 📊 Dashboard
- 📝 Sesi Tugas (with pending approval count badge)
- 🏪 Master Toko (read-only list + riwayat)
- 📈 Laporan

**Superadmin sees**:
- 👥 Manajemen Akun

**Files**:
- `src/components/layout/Sidebar.jsx`
- `src/components/layout/TopBar.jsx` — User info + logout

**Acceptance Criteria**:
- [ ] Dashboard shows live metrics (stok, sesi aktif, transaksi)
- [ ] Active sessions update in realtime when kasir submits
- [ ] Toko history page shows all past transactions
- [ ] Reports generate correctly with date filters
- [ ] Sidebar navigation works with role-based visibility
- [ ] Dashboard looks professional with charts/cards
