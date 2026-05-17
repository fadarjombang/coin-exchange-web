# Phase 5: Reconciliation
## Rekonsiliasi Pulang & Balance Validation

---

### Task 5.1: Reconciliation Form
**Goal**: Kasir submits end-of-day reconciliation

**Page**: `/app/rekonsiliasi`

**Pre-conditions**:
- Sesi status must be 'active'
- All toko_assignment must be 'selesai' or 'skip' (none left 'pending' or 'on_progress')
- If any toko still pending → show warning "Masih ada toko yang belum dikunjungi"

**Form sections**:

**Section 1 — Ringkasan Sesi (read-only)**:
- Total modal koin: Rp X (dari modal_koin)
- Total koin keluar: Rp Y (sum of transaksi.total_koin_nilai)
- Total uang masuk: Rp Z (sum of transaksi.total_uang_diterima)
- Toko selesai: A dari B

**Section 2 — Sisa Koin Fisik**:
- DenomInput component with prefix "sisa_koin"
- Auto-calculate total sisa koin nilai

**Section 3 — Validasi Otomatis (real-time)**:
```
Expected sisa koin = Modal - Total Koin Keluar
Actual sisa koin   = Input kasir (Section 2)
Selisih koin       = Actual - Expected

Total uang masuk   = Sum dari transaksi
Total koin keluar  = Sum dari transaksi
Selisih uang       = Uang masuk - Koin keluar
```

Display:
- ✅ "Koin seimbang" if selisih_koin = 0
- ❌ "Selisih koin: Rp X" if selisih_koin ≠ 0
- ✅ "Uang seimbang" if selisih_uang = 0
- ❌ "Selisih uang: Rp X" if selisih_uang ≠ 0

**Section 4 — Foto Bukti (optional)**:
- Camera capture for foto sisa koin/uang
- Same compress logic as transaction photo

**Section 5 — Catatan**:
- Textarea for additional notes

**Submit button**:
- Enabled even if not balanced (kasir tetap harus bisa submit, manager yang decide)
- But show clear warning if imbalanced
- On submit:
  1. INSERT `rekonsiliasi`
  2. UPDATE `sesi_tugas` status = 'pending_close'

**Files**:
- `src/pages/app/Rekonsiliasi.jsx`

---

### Task 5.2: Manager Close Approval
**Goal**: Manager reviews and approves session closure

**Integrated into**: `src/pages/dashboard/sesi/SesiDetail.jsx`

**When status = 'pending_close'**:
- Show rekonsiliasi data:
  - Expected vs actual sisa koin per denom
  - Selisih koin & uang with colored indicators
  - is_balanced flag
  - Foto bukti (if any)
  - Kasir's catatan
- Transaction summary table
- [APPROVE CLOSE] button:
  1. UPDATE `sesi_tugas` status = 'closed', closed_by, closed_at
  2. INSERT `stok_gudang_log` entry for 'keluar_modal' (negative deltas = modal koin)
  3. INSERT `stok_gudang_log` entry for 'masuk_sisa' (positive deltas = sisa koin)
  4. UPDATE `stok_gudang` with net changes
- [REJECT CLOSE] button + catatan textarea:
  1. UPDATE `sesi_tugas` status = 'active'
  2. DELETE `rekonsiliasi` row (kasir harus input ulang)

**Stok update logic**:
```js
// Net change per denom:
net_delta = sisa_koin_returned - modal_koin_taken

// For stok_gudang:
new_stock = current_stock + net_delta
// (net_delta is negative if koin were exchanged, which is expected)
```

**Acceptance Criteria**:
- [ ] Kasir can only open rekonsiliasi when all toko visited/skipped
- [ ] Balance validation calculates correctly
- [ ] Kasir can submit even if imbalanced (with warning)
- [ ] Manager sees full reconciliation detail
- [ ] Approve close updates stok gudang correctly
- [ ] Reject close resets to active and removes rekonsiliasi
- [ ] Stock log entries are created with correct tipe and deltas
