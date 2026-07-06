-- Menu "Transaksi Lapangan" memfilter transaksi berdasarkan jenis + rentang created_at,
-- tapi kolom tersebut belum punya index sehingga Postgres full table scan.
-- Untuk rentang pendek (hari ini) masih cukup cepat, tapi untuk rentang 1 bulan penuh
-- query kena statement timeout (57014) dan gagal total.
CREATE INDEX IF NOT EXISTS idx_transaksi_jenis_created_at ON transaksi(jenis, created_at);
