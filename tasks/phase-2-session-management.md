# Phase 2: Session Management
## Sesi Tugas, Stok Gudang, & Approval Flow

---

### Task 2.1: Stok Gudang Management
**Goal**: Admin can view and adjust warehouse coin stock

**Pages**:
- `/dashboard/stok` — View current stock per denom + total value + adjustment form + history log

**Features**:
- Display current stock per denomination (keping + nilai)
- Total value auto-calculated
- "Penyesuaian Manual" form: input new stock values per denom + keterangan
- On save: update `stok_gudang`, create `stok_gudang_log` entry with tipe='penyesuaian'
- History log table below (from `stok_gudang_log`): tanggal, tipe, keterangan, delta per denom

**Files**:
- `src/pages/dashboard/stok/StokGudang.jsx`
- `src/components/shared/DenomInput.jsx` — Reusable 8-denom input grid (used in stok, modal, transaksi)
- `src/lib/utils.js` — Add `formatRupiah()`, `calculateDenomTotal()`, `DENOM_LIST` constant

**DenomInput component spec**:
```jsx
// Reusable across: stok gudang, modal koin, transaksi, rekonsiliasi
<DenomInput
  values={{ koin_100: 0, koin_200: 0, ... }}
  onChange={(values) => {}}
  readOnly={false}
  showTotal={true}
  prefix="koin" // or "sisa_koin" or "delta"
/>
```

**DENOM_LIST constant**:
```js
export const DENOM_LIST = [
  { key: 'koin_100', label: '100', value: 100 },
  { key: 'koin_200', label: '200', value: 200 },
  { key: 'koin_500', label: '500', value: 500 },
  { key: 'koin_1000', label: '1.000', value: 1000 },
  { key: 'koin_2000', label: '2.000', value: 2000 },
  { key: 'koin_5000', label: '5.000', value: 5000 },
  { key: 'koin_10000', label: '10.000', value: 10000 },
  { key: 'koin_20000', label: '20.000', value: 20000 },
];
```

---

### Task 2.2: Create Sesi Tugas (Multi-Step Form)
**Goal**: Admin creates a task session for field officers

**Page**: `/dashboard/sesi/buat`

**Step 1 — Tim & Kendaraan**:
- Tanggal (date picker, default today)
- Mobil (dropdown from `mobil` where is_active=true)
- Kasir (dropdown from `users` where role='kasir', is_active=true, no active session)
- Driver (dropdown from `users` where role='driver', is_active=true)
- Nama Polisi (text input)

**Step 2 — Pilih Toko**:
- List all `toko` where is_active=true (checkboxes)
- Search/filter by nama or kode
- Selected toko shown with drag-to-reorder or number input for urutan
- Min 1 toko required

**Step 3 — Modal Koin**:
- DenomInput component (reuse from Task 2.1)
- Show current stok gudang per denom as reference
- Validation: each denom input ≤ stok gudang available
- Auto-calculate total modal

**Step 4 — Review & Submit**:
- Full summary of all inputs
- [BATAL] button → discard, go back to list
- [SIMPAN DRAFT] → save as status='draft'
- [SUBMIT KE MANAGER] → save as status='pending_approval'

**Files**:
- `src/pages/dashboard/sesi/BuatSesi.jsx` — Multi-step form container
- `src/pages/dashboard/sesi/steps/StepTim.jsx`
- `src/pages/dashboard/sesi/steps/StepToko.jsx`
- `src/pages/dashboard/sesi/steps/StepModal.jsx`
- `src/pages/dashboard/sesi/steps/StepReview.jsx`

**DB Operations on Submit**:
1. INSERT `sesi_tugas`
2. INSERT `modal_koin`
3. INSERT multiple `toko_assignment` rows
4. All in a single transaction (use Supabase RPC or sequential with error handling)

---

### Task 2.3: Sesi List & Detail
**Goal**: View all sessions with status filters

**Pages**:
- `/dashboard/sesi` — List all sesi tugas
- `/dashboard/sesi/:id` — Detail view of a single sesi

**List features**:
- Table with columns: tanggal, kasir, driver, mobil, jumlah toko, total modal, status
- Filter by status (all/draft/pending/active/pending_close/closed)
- Status shown as colored badge
- Click row → detail page

**Detail features**:
- Header: session info (tanggal, tim, mobil, status)
- Tab 1: Modal koin breakdown
- Tab 2: Toko assignment list with status per toko
- Tab 3: Transactions list (if any)
- Tab 4: Rekonsiliasi data (if exists)
- Admin can edit if status='draft'

**Files**:
- `src/pages/dashboard/sesi/SesiList.jsx`
- `src/pages/dashboard/sesi/SesiDetail.jsx`

---

### Task 2.4: Manager Approval Flow
**Goal**: Manager can approve/reject sessions

**Page**: `/dashboard/sesi/:id/approval` (accessible by manager only)

**Approval Keberangkatan** (when status='pending_approval'):
- Show full session detail (read-only)
- [APPROVE] button → status='active', set approved_by & approved_at
- [REJECT] button → show textarea for catatan → status='draft', set catatan_approval

**Approval Kepulangan** (when status='pending_close'):
- Show session detail + rekonsiliasi data
- Show balance check results (is_balanced, selisih_koin, selisih_uang)
- [APPROVE CLOSE] → status='closed', set closed_by & closed_at, trigger stok gudang update
- [REJECT CLOSE] → textarea for catatan → status='active'

**Stok Gudang Update on Close**:
1. LOG `keluar_modal`: negative deltas (modal koin yang dibawa keluar)
2. LOG `masuk_sisa`: positive deltas (sisa koin yang dikembalikan)
3. UPDATE `stok_gudang`: apply net change

**Files**:
- Integrated into `src/pages/dashboard/sesi/SesiDetail.jsx` (approval buttons shown for manager role)

**Acceptance Criteria**:
- [ ] Admin can view and adjust warehouse stock
- [ ] Admin can create session with 4-step form
- [ ] Modal koin validated against warehouse stock
- [ ] Session list with status filter works
- [ ] Manager can approve/reject departure
- [ ] Manager can approve/reject return (with stock update)
- [ ] Stock log entries created automatically
