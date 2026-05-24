-- ============================================================
-- Diagnosa: Cek constraint sesi_tugas_id di tabel transaksi
-- ============================================================

-- 1. Cek apakah sesi_tugas_id masih NOT NULL
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'transaksi'
  AND table_schema = 'public'
  AND column_name = 'sesi_tugas_id';

-- Jika is_nullable = 'NO', berarti masih NOT NULL dan perlu difix.
-- Jalankan ini untuk membuat sesi_tugas_id boleh NULL (untuk transaksi kantor):

ALTER TABLE transaksi
  ALTER COLUMN sesi_tugas_id DROP NOT NULL;

-- 2. Drop UNIQUE constraint lama (sesi_tugas_id, toko_id) yang masalah untuk kantor
--    karena semua kantor akan punya sesi_tugas_id = NULL, tapi toko_id berbeda-beda
ALTER TABLE transaksi
  DROP CONSTRAINT IF EXISTS transaksi_sesi_tugas_id_toko_id_key;

-- 3. Tambah partial unique constraint: hanya enforce unique untuk transaksi field (non-null sesi)
CREATE UNIQUE INDEX IF NOT EXISTS transaksi_sesi_toko_unique
  ON transaksi (sesi_tugas_id, toko_id)
  WHERE sesi_tugas_id IS NOT NULL;
