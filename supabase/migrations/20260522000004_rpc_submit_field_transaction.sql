-- Migration: RPC submit_field_transaction
-- Task 07: Implement Field Transaction RPC
-- Run in: Supabase Dashboard → SQL Editor
--
-- Membungkus INSERT transaksi + UPDATE toko_assignment dalam satu transaksi SQL
-- sehingga jika salah satu gagal, keduanya di-rollback (atomic).

CREATE OR REPLACE FUNCTION submit_field_transaction(
  p_assignment_id     UUID,
  p_sesi_tugas_id     UUID,
  p_toko_id           UUID,
  p_kasir_id          UUID,
  p_koin_100          BIGINT DEFAULT 0,
  p_koin_200          BIGINT DEFAULT 0,
  p_koin_500          BIGINT DEFAULT 0,
  p_koin_1000         BIGINT DEFAULT 0,
  p_koin_2000         BIGINT DEFAULT 0,
  p_koin_5000         BIGINT DEFAULT 0,
  p_koin_10000        BIGINT DEFAULT 0,
  p_koin_20000        BIGINT DEFAULT 0,
  p_total_koin_nilai  BIGINT DEFAULT 0,
  p_uang_50000        BIGINT DEFAULT 0,
  p_uang_100000       BIGINT DEFAULT 0,
  p_total_uang        BIGINT DEFAULT 0,
  p_pic_nama          TEXT   DEFAULT '',
  p_pic_jabatan       TEXT   DEFAULT '',
  p_foto_serah_terima TEXT   DEFAULT NULL,
  p_ttd_pic_toko      TEXT   DEFAULT NULL,
  p_ttd_kasir         TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaksi_id UUID;
BEGIN
  -- INSERT transaksi
  INSERT INTO transaksi (
    sesi_tugas_id, toko_id, kasir_id,
    koin_100, koin_200, koin_500, koin_1000,
    koin_2000, koin_5000, koin_10000, koin_20000,
    total_koin_nilai,
    uang_50000, uang_100000, total_uang_diterima,
    selisih, pic_nama, pic_jabatan,
    foto_serah_terima, ttd_pic_toko, ttd_kasir,
    status, jenis
  ) VALUES (
    p_sesi_tugas_id, p_toko_id, p_kasir_id,
    p_koin_100, p_koin_200, p_koin_500, p_koin_1000,
    p_koin_2000, p_koin_5000, p_koin_10000, p_koin_20000,
    p_total_koin_nilai,
    p_uang_50000, p_uang_100000, p_total_uang,
    0, p_pic_nama, p_pic_jabatan,
    p_foto_serah_terima, p_ttd_pic_toko, p_ttd_kasir,
    'submitted', 'field'
  )
  RETURNING id INTO v_transaksi_id;

  -- UPDATE toko_assignment status ke 'selesai'
  UPDATE toko_assignment
  SET status = 'selesai', updated_at = now()
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'transaksi_id', v_transaksi_id);
END;
$$;

-- Kasir bisa memanggil RPC ini
GRANT EXECUTE ON FUNCTION submit_field_transaction(
  UUID, UUID, UUID, UUID,
  BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, BIGINT, BIGINT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
