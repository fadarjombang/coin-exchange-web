-- ============================================================
-- Fix: submit_rekonsiliasi — ganti INSERT biasa dengan UPSERT
-- Agar kasir bisa submit ulang rekonsiliasi setelah manager tolak,
-- tanpa error duplicate key meski record lama belum dihapus.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION submit_rekonsiliasi(
  p_sesi_id          UUID,
  p_sisa_koin_100    BIGINT DEFAULT 0,
  p_sisa_koin_200    BIGINT DEFAULT 0,
  p_sisa_koin_500    BIGINT DEFAULT 0,
  p_sisa_koin_1000   BIGINT DEFAULT 0,
  p_sisa_koin_2000   BIGINT DEFAULT 0,
  p_sisa_koin_5000   BIGINT DEFAULT 0,
  p_sisa_koin_10000  BIGINT DEFAULT 0,
  p_sisa_koin_20000  BIGINT DEFAULT 0,
  p_sisa_koin_nilai  BIGINT DEFAULT 0,
  p_expected_sisa    BIGINT DEFAULT 0,
  p_total_koin_keluar BIGINT DEFAULT 0,
  p_total_uang_masuk BIGINT DEFAULT 0,
  p_uang_setoran     BIGINT DEFAULT 0,
  p_selisih_koin     BIGINT DEFAULT 0,
  p_selisih_uang     BIGINT DEFAULT 0,
  p_is_balanced      BOOLEAN DEFAULT false,
  p_foto_sisa        TEXT DEFAULT NULL,
  p_ttd_kasir        TEXT DEFAULT NULL,
  p_catatan          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validasi: sesi harus milik kasir yang login dan statusnya active
  IF NOT EXISTS (
    SELECT 1 FROM sesi_tugas
    WHERE id = p_sesi_id AND kasir_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Sesi tidak valid atau bukan milik kasir ini';
  END IF;

  -- UPSERT: insert baru atau update jika sudah ada (resubmit setelah reject)
  INSERT INTO rekonsiliasi (
    sesi_tugas_id, kasir_id,
    sisa_koin_100, sisa_koin_200, sisa_koin_500, sisa_koin_1000,
    sisa_koin_2000, sisa_koin_5000, sisa_koin_10000, sisa_koin_20000,
    sisa_koin_nilai, expected_sisa_koin,
    total_koin_keluar, total_uang_masuk,
    uang_setoran, selisih_koin, selisih_uang, is_balanced,
    foto_sisa, ttd_kasir, catatan
  ) VALUES (
    p_sesi_id, auth.uid(),
    p_sisa_koin_100, p_sisa_koin_200, p_sisa_koin_500, p_sisa_koin_1000,
    p_sisa_koin_2000, p_sisa_koin_5000, p_sisa_koin_10000, p_sisa_koin_20000,
    p_sisa_koin_nilai, p_expected_sisa,
    p_total_koin_keluar, p_total_uang_masuk,
    p_uang_setoran, p_selisih_koin, p_selisih_uang, p_is_balanced,
    p_foto_sisa, p_ttd_kasir, p_catatan
  )
  ON CONFLICT (sesi_tugas_id) DO UPDATE SET
    kasir_id           = auth.uid(),
    sisa_koin_100      = EXCLUDED.sisa_koin_100,
    sisa_koin_200      = EXCLUDED.sisa_koin_200,
    sisa_koin_500      = EXCLUDED.sisa_koin_500,
    sisa_koin_1000     = EXCLUDED.sisa_koin_1000,
    sisa_koin_2000     = EXCLUDED.sisa_koin_2000,
    sisa_koin_5000     = EXCLUDED.sisa_koin_5000,
    sisa_koin_10000    = EXCLUDED.sisa_koin_10000,
    sisa_koin_20000    = EXCLUDED.sisa_koin_20000,
    sisa_koin_nilai    = EXCLUDED.sisa_koin_nilai,
    expected_sisa_koin = EXCLUDED.expected_sisa_koin,
    total_koin_keluar  = EXCLUDED.total_koin_keluar,
    total_uang_masuk   = EXCLUDED.total_uang_masuk,
    uang_setoran       = EXCLUDED.uang_setoran,
    selisih_koin       = EXCLUDED.selisih_koin,
    selisih_uang       = EXCLUDED.selisih_uang,
    is_balanced        = EXCLUDED.is_balanced,
    foto_sisa          = EXCLUDED.foto_sisa,
    ttd_kasir          = EXCLUDED.ttd_kasir,
    catatan            = EXCLUDED.catatan,
    submitted_at       = now();

  UPDATE sesi_tugas SET status = 'pending_close' WHERE id = p_sesi_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
