-- Migration: Task 18 — Atomic create/update sesi
-- Task 19 — Atomic submit rekonsiliasi
-- Run in: Supabase Dashboard → SQL Editor

-- ============================================================
-- Task 18: create_sesi_tugas — atomic INSERT sesi + modal + assignments
-- ============================================================
CREATE OR REPLACE FUNCTION create_sesi_tugas(
  p_tanggal      DATE,
  p_mobil_id     UUID,
  p_kasir_id     UUID,
  p_driver_id    UUID,
  p_nama_polisi  TEXT,
  p_status       TEXT,
  p_created_by   UUID,
  p_modal        JSONB,   -- {koin_100, koin_200, ..., koin_20000}
  p_assignments  JSONB    -- [{toko_id, urutan, alokasi_koin}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi_id UUID;
  v_assign  JSONB;
BEGIN
  -- Role gate: hanya manager
  IF NOT (
    SELECT role && ARRAY['manager']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager only';
  END IF;

  INSERT INTO sesi_tugas (
    tanggal, mobil_id, kasir_id, driver_id, nama_polisi, status, created_by
  ) VALUES (
    p_tanggal, p_mobil_id, p_kasir_id, p_driver_id, p_nama_polisi, p_status, p_created_by
  ) RETURNING id INTO v_sesi_id;

  INSERT INTO modal_koin (
    sesi_tugas_id,
    koin_100, koin_200, koin_500, koin_1000,
    koin_2000, koin_5000, koin_10000, koin_20000
  ) VALUES (
    v_sesi_id,
    COALESCE((p_modal->>'koin_100')::BIGINT, 0),
    COALESCE((p_modal->>'koin_200')::BIGINT, 0),
    COALESCE((p_modal->>'koin_500')::BIGINT, 0),
    COALESCE((p_modal->>'koin_1000')::BIGINT, 0),
    COALESCE((p_modal->>'koin_2000')::BIGINT, 0),
    COALESCE((p_modal->>'koin_5000')::BIGINT, 0),
    COALESCE((p_modal->>'koin_10000')::BIGINT, 0),
    COALESCE((p_modal->>'koin_20000')::BIGINT, 0)
  );

  FOR v_assign IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    INSERT INTO toko_assignment (sesi_tugas_id, toko_id, urutan, alokasi_koin)
    VALUES (
      v_sesi_id,
      (v_assign->>'toko_id')::UUID,
      (v_assign->>'urutan')::INT,
      COALESCE((v_assign->>'alokasi_koin')::BIGINT, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'sesi_id', v_sesi_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_sesi_tugas(DATE,UUID,UUID,UUID,TEXT,TEXT,UUID,JSONB,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_sesi_tugas(DATE,UUID,UUID,UUID,TEXT,TEXT,UUID,JSONB,JSONB) TO authenticated;

-- ============================================================
-- Task 18: update_sesi_tugas — atomic UPDATE sesi + modal + replace assignments
-- ============================================================
CREATE OR REPLACE FUNCTION update_sesi_tugas(
  p_sesi_id      UUID,
  p_tanggal      DATE,
  p_mobil_id     UUID,
  p_kasir_id     UUID,
  p_driver_id    UUID,
  p_nama_polisi  TEXT,
  p_status       TEXT,
  p_modal        JSONB,
  p_assignments  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assign JSONB;
BEGIN
  IF NOT (
    SELECT role && ARRAY['manager']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager only';
  END IF;

  UPDATE sesi_tugas SET
    tanggal = p_tanggal, mobil_id = p_mobil_id, kasir_id = p_kasir_id,
    driver_id = p_driver_id, nama_polisi = p_nama_polisi, status = p_status
  WHERE id = p_sesi_id;

  UPDATE modal_koin SET
    koin_100  = COALESCE((p_modal->>'koin_100')::BIGINT, 0),
    koin_200  = COALESCE((p_modal->>'koin_200')::BIGINT, 0),
    koin_500  = COALESCE((p_modal->>'koin_500')::BIGINT, 0),
    koin_1000 = COALESCE((p_modal->>'koin_1000')::BIGINT, 0),
    koin_2000 = COALESCE((p_modal->>'koin_2000')::BIGINT, 0),
    koin_5000 = COALESCE((p_modal->>'koin_5000')::BIGINT, 0),
    koin_10000= COALESCE((p_modal->>'koin_10000')::BIGINT, 0),
    koin_20000= COALESCE((p_modal->>'koin_20000')::BIGINT, 0)
  WHERE sesi_tugas_id = p_sesi_id;

  DELETE FROM toko_assignment WHERE sesi_tugas_id = p_sesi_id;

  FOR v_assign IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    INSERT INTO toko_assignment (sesi_tugas_id, toko_id, urutan, alokasi_koin)
    VALUES (
      p_sesi_id,
      (v_assign->>'toko_id')::UUID,
      (v_assign->>'urutan')::INT,
      COALESCE((v_assign->>'alokasi_koin')::BIGINT, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'sesi_id', p_sesi_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_sesi_tugas(UUID,DATE,UUID,UUID,UUID,TEXT,TEXT,JSONB,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_sesi_tugas(UUID,DATE,UUID,UUID,UUID,TEXT,TEXT,JSONB,JSONB) TO authenticated;

-- ============================================================
-- Task 19: submit_rekonsiliasi — atomic INSERT rekonsiliasi + UPDATE sesi
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
  -- Validasi: sesi harus milik kasir yang login
  IF NOT EXISTS (
    SELECT 1 FROM sesi_tugas
    WHERE id = p_sesi_id AND kasir_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Sesi tidak valid atau bukan milik kasir ini';
  END IF;

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
  );

  UPDATE sesi_tugas SET status = 'pending_close' WHERE id = p_sesi_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_rekonsiliasi(
  UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_rekonsiliasi(
  UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT, TEXT, TEXT
) TO authenticated;
