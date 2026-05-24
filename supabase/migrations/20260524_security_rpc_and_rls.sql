-- ============================================================
-- Security Migration: Task 11, 12, 13
-- 1. get_my_role() filter is_active
-- 2. submit_field_transaction: auth.uid() check + ownership validation
-- 3. update_stok_gudang_kantor: role gate + auth.uid() check
-- 4. update_stok_gudang: role gate + auth.uid() check
-- 5. REVOKE PUBLIC execute on all SECURITY DEFINER RPCs
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- Task 13: get_my_role() — filter is_active=true
-- Akun nonaktif otomatis return NULL → semua RLS check gagal
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.users
   WHERE id = auth.uid() AND is_active = true
$$;

-- ============================================================
-- Task 11 + 12: submit_field_transaction — auth.uid() + ownership
-- ============================================================
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
  -- Task 11: kasir_id harus cocok dengan caller
  IF p_kasir_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: kasir_id mismatch';
  END IF;

  -- Task 12: validasi ownership assignment + status sesi
  IF NOT EXISTS (
    SELECT 1
    FROM toko_assignment ta
    JOIN sesi_tugas s ON s.id = ta.sesi_tugas_id
    WHERE ta.id            = p_assignment_id
      AND ta.sesi_tugas_id = p_sesi_tugas_id
      AND ta.toko_id       = p_toko_id
      AND ta.status        IN ('pending', 'on_progress')
      AND s.kasir_id       = auth.uid()
      AND s.status         = 'active'
  ) THEN
    RAISE EXCEPTION 'Assignment tidak valid / sudah selesai / bukan milik kasir ini';
  END IF;

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

  UPDATE toko_assignment
  SET status = 'selesai', updated_at = now()
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'transaksi_id', v_transaksi_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_field_transaction(
  UUID, UUID, UUID, UUID,
  BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, BIGINT, BIGINT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_field_transaction(
  UUID, UUID, UUID, UUID,
  BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, BIGINT, BIGINT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ============================================================
-- Task 11: update_stok_gudang_kantor — role gate + auth.uid() check
-- ============================================================
CREATE OR REPLACE FUNCTION update_stok_gudang_kantor(
  p_stok_id       UUID,
  p_toko_id       UUID,
  p_kasir_id      UUID,
  p_koin_100      BIGINT DEFAULT 0,
  p_koin_200      BIGINT DEFAULT 0,
  p_koin_500      BIGINT DEFAULT 0,
  p_koin_1000     BIGINT DEFAULT 0,
  p_koin_2000     BIGINT DEFAULT 0,
  p_koin_5000     BIGINT DEFAULT 0,
  p_koin_10000    BIGINT DEFAULT 0,
  p_koin_20000    BIGINT DEFAULT 0,
  p_uang_50000    BIGINT DEFAULT 0,
  p_uang_100000   BIGINT DEFAULT 0,
  p_pic_nama      TEXT   DEFAULT '',
  p_pic_jabatan   TEXT   DEFAULT 'Admin/Manager',
  p_updated_by    UUID   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stok          stok_gudang%ROWTYPE;
  v_toko          toko%ROWTYPE;
  v_total_koin    BIGINT;
  v_total_uang    BIGINT;
BEGIN
  -- Task 11: role gate — hanya admin/manager/superadmin
  IF NOT (
    SELECT role && ARRAY['admin','manager','superadmin']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin/manager only';
  END IF;

  -- Task 11: updated_by harus cocok dengan caller
  IF p_updated_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: updated_by mismatch';
  END IF;

  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok gudang tidak ditemukan';
  END IF;

  IF p_koin_100   > v_stok.koin_100   THEN RAISE EXCEPTION 'Stok koin Rp100 tidak mencukupi';   END IF;
  IF p_koin_200   > v_stok.koin_200   THEN RAISE EXCEPTION 'Stok koin Rp200 tidak mencukupi';   END IF;
  IF p_koin_500   > v_stok.koin_500   THEN RAISE EXCEPTION 'Stok koin Rp500 tidak mencukupi';   END IF;
  IF p_koin_1000  > v_stok.koin_1000  THEN RAISE EXCEPTION 'Stok koin Rp1.000 tidak mencukupi'; END IF;
  IF p_koin_2000  > v_stok.koin_2000  THEN RAISE EXCEPTION 'Stok koin Rp2.000 tidak mencukupi'; END IF;
  IF p_koin_5000  > v_stok.koin_5000  THEN RAISE EXCEPTION 'Stok koin Rp5.000 tidak mencukupi'; END IF;
  IF p_koin_10000 > v_stok.koin_10000 THEN RAISE EXCEPTION 'Stok koin Rp10.000 tidak mencukupi'; END IF;
  IF p_koin_20000 > v_stok.koin_20000 THEN RAISE EXCEPTION 'Stok koin Rp20.000 tidak mencukupi'; END IF;

  v_total_koin := p_koin_100*100 + p_koin_200*200 + p_koin_500*500 + p_koin_1000*1000
                + p_koin_2000*2000 + p_koin_5000*5000 + p_koin_10000*10000 + p_koin_20000*20000;
  v_total_uang := p_uang_50000 + p_uang_100000;

  -- Task 14: validasi selisih=0 untuk transaksi kantor (bukan penyesuaian)
  IF p_toko_id IS NOT NULL AND v_total_koin <> v_total_uang THEN
    RAISE EXCEPTION 'Selisih harus 0 untuk transaksi kantor (koin=%, uang=%)', v_total_koin, v_total_uang;
  END IF;

  UPDATE stok_gudang SET
    koin_100    = koin_100    - p_koin_100,
    koin_200    = koin_200    - p_koin_200,
    koin_500    = koin_500    - p_koin_500,
    koin_1000   = koin_1000   - p_koin_1000,
    koin_2000   = koin_2000   - p_koin_2000,
    koin_5000   = koin_5000   - p_koin_5000,
    koin_10000  = koin_10000  - p_koin_10000,
    koin_20000  = koin_20000  - p_koin_20000,
    uang_50000  = COALESCE(uang_50000, 0)  + p_uang_50000,
    uang_100000 = COALESCE(uang_100000, 0) + p_uang_100000,
    last_updated = now(),
    updated_by   = p_updated_by
  WHERE id = p_stok_id;

  IF p_toko_id IS NOT NULL THEN
    SELECT nama_toko, kode_toko INTO v_toko FROM toko WHERE id = p_toko_id;
  END IF;

  INSERT INTO stok_gudang_log (
    tipe, keterangan, delta_total, created_by,
    delta_100, delta_200, delta_500, delta_1000,
    delta_2000, delta_5000, delta_10000, delta_20000,
    delta_uang_50000, delta_uang_100000
  ) VALUES (
    CASE WHEN p_toko_id IS NULL THEN 'penyesuaian' ELSE 'penukaran_kantor' END,
    CASE WHEN p_toko_id IS NULL THEN COALESCE(p_pic_nama, 'Penyesuaian manual')
         ELSE 'Penukaran koin kantor - Toko: ' || COALESCE(v_toko.nama_toko, '?') || ' (' || COALESCE(v_toko.kode_toko, '?') || ')' END,
    v_total_uang - v_total_koin,
    p_updated_by,
    -p_koin_100, -p_koin_200, -p_koin_500, -p_koin_1000,
    -p_koin_2000, -p_koin_5000, -p_koin_10000, -p_koin_20000,
    p_uang_50000, p_uang_100000
  );

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
  END IF;

  RETURN jsonb_build_object('success', true, 'total_koin', v_total_koin, 'total_uang', v_total_uang);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stok_gudang_kantor(
  UUID, UUID, UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, TEXT, TEXT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_stok_gudang_kantor(
  UUID, UUID, UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT,
  BIGINT, BIGINT, TEXT, TEXT, UUID
) TO authenticated;

-- ============================================================
-- Task 11: update_stok_gudang — role gate + auth.uid() check
-- ============================================================
CREATE OR REPLACE FUNCTION update_stok_gudang(
  p_stok_id       UUID,
  p_koin_100      BIGINT,
  p_koin_200      BIGINT,
  p_koin_500      BIGINT,
  p_koin_1000     BIGINT,
  p_koin_2000     BIGINT,
  p_koin_5000     BIGINT,
  p_koin_10000    BIGINT,
  p_koin_20000    BIGINT,
  p_uang_50000    BIGINT,
  p_uang_100000   BIGINT,
  p_keterangan    TEXT,
  p_updated_by    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stok      stok_gudang%ROWTYPE;
  v_new_total BIGINT;
  v_old_total BIGINT;
  v_delta     BIGINT;
BEGIN
  -- Task 11: role gate
  IF NOT (
    SELECT role && ARRAY['admin','manager','superadmin']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin/manager only';
  END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: updated_by mismatch';
  END IF;

  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok gudang tidak ditemukan';
  END IF;

  v_old_total := v_stok.koin_100*100 + v_stok.koin_200*200 + v_stok.koin_500*500 + v_stok.koin_1000*1000
              + v_stok.koin_2000*2000 + v_stok.koin_5000*5000 + v_stok.koin_10000*10000 + v_stok.koin_20000*20000
              + COALESCE(v_stok.uang_50000, 0) + COALESCE(v_stok.uang_100000, 0);
  v_new_total := p_koin_100*100 + p_koin_200*200 + p_koin_500*500 + p_koin_1000*1000
              + p_koin_2000*2000 + p_koin_5000*5000 + p_koin_10000*10000 + p_koin_20000*20000
              + p_uang_50000 + p_uang_100000;
  v_delta := v_new_total - v_old_total;

  UPDATE stok_gudang SET
    koin_100 = p_koin_100, koin_200 = p_koin_200, koin_500 = p_koin_500,
    koin_1000 = p_koin_1000, koin_2000 = p_koin_2000, koin_5000 = p_koin_5000,
    koin_10000 = p_koin_10000, koin_20000 = p_koin_20000,
    uang_50000 = p_uang_50000, uang_100000 = p_uang_100000,
    last_updated = now(), updated_by = p_updated_by
  WHERE id = p_stok_id;

  INSERT INTO stok_gudang_log (tipe, keterangan, delta_total, created_by)
  VALUES ('penyesuaian', COALESCE(p_keterangan, 'Penyesuaian manual'), v_delta, p_updated_by);

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stok_gudang(
  UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TEXT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_stok_gudang(
  UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TEXT, UUID
) TO authenticated;

-- ============================================================
-- Task 11: approve_sesi_transaction & close_sesi_transaction
-- Dipanggil dari Edge Function via service_role — sudah aman
-- Tapi tambah REVOKE PUBLIC untuk defense in depth
-- ============================================================
REVOKE EXECUTE ON FUNCTION approve_sesi_transaction(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION close_sesi_transaction(UUID, UUID, TEXT) FROM PUBLIC, anon;
