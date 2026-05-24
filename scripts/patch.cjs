const fs = require('fs');
const path = './supabase/migrations/20260522_rpc_atomic_transactions.sql';
let sql = fs.readFileSync(path, 'utf8');

// Replace the insert into transaksi logic
sql = sql.replace(
  /-- Ambil info toko untuk keterangan log[\s\S]*?p_pic_jabatan, 'submitted', 'kantor'\n\s*\);/m,
  `-- Ambil info toko untuk keterangan log
  IF p_toko_id IS NOT NULL THEN
    SELECT nama_toko, kode_toko INTO v_toko FROM toko WHERE id = p_toko_id;
  END IF;

  -- Insert log
  INSERT INTO stok_gudang_log (
    tipe, keterangan, delta_total, created_by,
    delta_100, delta_200, delta_500, delta_1000,
    delta_2000, delta_5000, delta_10000, delta_20000,
    delta_uang_50000, delta_uang_100000
  ) VALUES (
    CASE WHEN p_toko_id IS NULL THEN 'penyesuaian' ELSE 'penukaran_kantor' END,
    CASE WHEN p_toko_id IS NULL THEN COALESCE(p_pic_nama, 'Penyesuaian manual') ELSE 'Penukaran koin kantor - Toko: ' || COALESCE(v_toko.nama_toko, '?') || ' (' || COALESCE(v_toko.kode_toko, '?') || ')' END,
    v_total_uang - v_total_koin,
    p_updated_by,
    -p_koin_100, -p_koin_200, -p_koin_500, -p_koin_1000,
    -p_koin_2000, -p_koin_5000, -p_koin_10000, -p_koin_20000,
    p_uang_50000, p_uang_100000
  );

  -- Insert transaksi (only if toko_id is provided)
  IF p_toko_id IS NOT NULL THEN
    INSERT INTO transaksi (
      toko_id, kasir_id, tanggal_waktu,
      koin_100, koin_200, koin_500, koin_1000,
      koin_2000, koin_5000, koin_10000, koin_20000,
      total_koin_nilai, uang_50000, uang_100000,
      total_uang_diterima, selisih,
      pic_nama, pic_jabatan, status, jenis
    ) VALUES (
      p_toko_id, p_kasir_id, now(),
      p_koin_100, p_koin_200, p_koin_500, p_koin_1000,
      p_koin_2000, p_koin_5000, p_koin_10000, p_koin_20000,
      v_total_koin, p_uang_50000, p_uang_100000,
      v_total_uang, 0,
      p_pic_nama, p_pic_jabatan, 'submitted', 'kantor'
    );
  END IF;`
);

fs.writeFileSync(path, sql);
console.log('Migration updated');
