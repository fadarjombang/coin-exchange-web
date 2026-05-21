-- 2. Tambah kolom 'jenis' ke tabel transaksi
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS jenis TEXT DEFAULT 'field';
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS transaksi_jenis_check;
ALTER TABLE transaksi ADD CONSTRAINT transaksi_jenis_check CHECK (jenis IN ('field','kantor'));

-- 3. Tambah tipe log baru untuk penukaran kantor
ALTER TABLE stok_gudang_log DROP CONSTRAINT IF EXISTS stok_gudang_log_tipe_check;
ALTER TABLE stok_gudang_log ADD CONSTRAINT stok_gudang_log_tipe_check
  CHECK (tipe IN ('keluar_modal','masuk_sisa','penyesuaian','penukaran_kantor'));

-- 4. Tambah kolom delta uang ke log
ALTER TABLE stok_gudang_log ADD COLUMN IF NOT EXISTS delta_uang_50000 BIGINT DEFAULT 0;
ALTER TABLE stok_gudang_log ADD COLUMN IF NOT EXISTS delta_uang_100000 BIGINT DEFAULT 0;

-- 5. Update policy agar admin bisa insert transaksi (tanpa drop function)
DROP POLICY IF EXISTS "trx_insert" ON transaksi;
CREATE POLICY "trx_insert" ON transaksi FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['kasir','admin','superadmin']::text[]);

-- 6. Set default value for existing rows
UPDATE transaksi SET jenis = 'field' WHERE jenis IS NULL;