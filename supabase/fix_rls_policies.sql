-- ============================================================
-- RLS Policy Tightening
-- Task 4: Tighten RLS Policies
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. transaksi_insert: kasir hanya bisa insert atas namanya sendiri
-- ============================================================
DROP POLICY IF EXISTS "trx_insert" ON transaksi;
CREATE POLICY "trx_insert" ON transaksi
  FOR INSERT TO authenticated
  WITH CHECK (
    kasir_id = auth.uid()
    AND get_my_role() && ARRAY['kasir','admin','superadmin']::text[]
  );

-- ============================================================
-- 2. assign_update: kasir hanya bisa update assignment miliknya sendiri
--    (via sesi_tugas yang dia miliki); admin/manager bisa update semua
-- ============================================================
DROP POLICY IF EXISTS "assign_update" ON toko_assignment;
CREATE POLICY "assign_update" ON toko_assignment
  FOR UPDATE TO authenticated
  USING (
    -- Admin/manager/superadmin bisa update semua
    get_my_role() && ARRAY['admin','manager','superadmin']::text[]
    OR
    -- Kasir hanya bisa update assignment di sesi miliknya
    EXISTS (
      SELECT 1 FROM sesi_tugas
      WHERE sesi_tugas.id = toko_assignment.sesi_tugas_id
        AND sesi_tugas.kasir_id = auth.uid()
    )
  );

-- ============================================================
-- 3. stok_log_insert: hanya service_role (via RPC SECURITY DEFINER)
--    yang bisa insert log. User biasa tidak bisa inject log palsu.
--    RPC functions (approve_sesi_transaction, close_sesi_transaction,
--    update_stok_gudang_kantor) sudah SECURITY DEFINER sehingga
--    berjalan sebagai owner dan bypass RLS.
-- ============================================================
DROP POLICY IF EXISTS "stok_log_insert" ON stok_gudang_log;
-- Tidak ada policy INSERT untuk authenticated — hanya bisa via RPC SECURITY DEFINER
-- Jika ada kebutuhan penyesuaian manual, harus dilakukan oleh superadmin via Edge Function

-- Tambahkan policy insert khusus untuk superadmin (manual adjustment)
CREATE POLICY "stok_log_insert_superadmin" ON stok_gudang_log
  FOR INSERT TO authenticated
  WITH CHECK ('superadmin' = ANY (get_my_role()));

-- ============================================================
-- 4. toko upsert: hanya admin/superadmin (sudah ada, tapi pastikan
--    policy update juga mencakup upsert via ON CONFLICT)
-- ============================================================
DROP POLICY IF EXISTS "toko_upsert" ON toko;
CREATE POLICY "toko_upsert" ON toko
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- ============================================================
-- 5. modal_koin update: admin/manager bisa update (untuk koreksi modal)
--    Kasir tidak bisa update modal setelah sesi disubmit
-- ============================================================
DROP POLICY IF EXISTS "modal_update" ON modal_koin;
CREATE POLICY "modal_update" ON modal_koin
  FOR UPDATE TO authenticated
  USING (
    get_my_role() && ARRAY['admin','manager','superadmin']::text[]
  );

-- ============================================================
-- 6. stok_gudang update: hanya via RPC (SECURITY DEFINER)
--    Hapus policy update langsung untuk authenticated user biasa
-- ============================================================
DROP POLICY IF EXISTS "stok_update" ON stok_gudang;
CREATE POLICY "stok_update_superadmin" ON stok_gudang
  FOR UPDATE TO authenticated
  USING ('superadmin' = ANY (get_my_role()));
-- Note: update normal stok dilakukan via RPC SECURITY DEFINER (bypass RLS)

-- ============================================================
-- 7. sesi_insert & sesi_update: HANYA manager yang bisa insert/update
--    (Membuat, menyetujui, menutup sesi)
-- ============================================================
DROP POLICY IF EXISTS "sesi_insert" ON sesi_tugas;
CREATE POLICY "sesi_insert" ON sesi_tugas
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['manager']::text[]);

DROP POLICY IF EXISTS "sesi_update_admin" ON sesi_tugas;
CREATE POLICY "sesi_update_admin" ON sesi_tugas
  FOR UPDATE TO authenticated
  USING (get_my_role() && ARRAY['manager']::text[]);

-- ============================================================
-- 8. modal_koin & toko_assignment: Sesuaikan agar manager bisa insert/update
--    karena pembuatan sesi sekarang HANYA oleh role manager
-- ============================================================
DROP POLICY IF EXISTS "modal_insert" ON modal_koin;
CREATE POLICY "modal_insert" ON modal_koin
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['manager']::text[]);

DROP POLICY IF EXISTS "modal_update" ON modal_koin;
CREATE POLICY "modal_update" ON modal_koin
  FOR UPDATE TO authenticated
  USING (get_my_role() && ARRAY['manager']::text[]);

DROP POLICY IF EXISTS "assign_insert" ON toko_assignment;
CREATE POLICY "assign_insert" ON toko_assignment
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['manager']::text[]);

DROP POLICY IF EXISTS "assign_delete" ON toko_assignment;
CREATE POLICY "assign_delete" ON toko_assignment
  FOR DELETE TO authenticated
  USING (get_my_role() && ARRAY['manager']::text[]);

-- Update assign_update agar admin tidak bisa edit
DROP POLICY IF EXISTS "assign_update" ON toko_assignment;
CREATE POLICY "assign_update" ON toko_assignment
  FOR UPDATE TO authenticated
  USING (
    get_my_role() && ARRAY['manager']::text[]
    OR
    EXISTS (
      SELECT 1 FROM sesi_tugas
      WHERE sesi_tugas.id = toko_assignment.sesi_tugas_id
        AND sesi_tugas.kasir_id = auth.uid()
    )
  );
