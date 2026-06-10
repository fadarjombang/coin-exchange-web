-- Fix: delta_total di stok_gudang_log salah karena field menyimpan nilai Rp langsung
-- (bukan qty keping), tapi dihitung dengan koin_X * X (mengalikan dua kali).
-- Semua field koin_* dan uang_* di stok_gudang & modal_koin = nilai Rp langsung.
-- delta_total = sum nilai baru - sum nilai lama (tanpa perkalian denominasi).

-- ============================================================
-- 1. update_stok_gudang — Penyesuaian Manual
-- ============================================================
CREATE OR REPLACE FUNCTION update_stok_gudang(
  p_stok_id     UUID,
  p_koin_100    BIGINT, p_koin_200   BIGINT, p_koin_500   BIGINT, p_koin_1000  BIGINT,
  p_koin_2000   BIGINT, p_koin_5000  BIGINT, p_koin_10000 BIGINT, p_koin_20000 BIGINT,
  p_uang_50000  BIGINT, p_uang_100000 BIGINT,
  p_keterangan  TEXT,   p_updated_by UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stok  stok_gudang%ROWTYPE;
  v_delta BIGINT;
BEGIN
  IF NOT (SELECT role && ARRAY['admin','manager','superadmin']::text[]
          FROM public.users WHERE id = auth.uid() AND is_active = true)
  THEN RAISE EXCEPTION 'Forbidden: admin/manager only'; END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid()
  THEN RAISE EXCEPTION 'Forbidden: updated_by mismatch'; END IF;

  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok gudang tidak ditemukan'; END IF;

  -- delta = (nilai baru total) - (nilai lama total) — semua sudah dalam Rp
  v_delta := (p_koin_100 + p_koin_200 + p_koin_500 + p_koin_1000
            + p_koin_2000 + p_koin_5000 + p_koin_10000 + p_koin_20000
            + p_uang_50000 + p_uang_100000)
           - (COALESCE(v_stok.koin_100,0) + COALESCE(v_stok.koin_200,0)
            + COALESCE(v_stok.koin_500,0) + COALESCE(v_stok.koin_1000,0)
            + COALESCE(v_stok.koin_2000,0) + COALESCE(v_stok.koin_5000,0)
            + COALESCE(v_stok.koin_10000,0) + COALESCE(v_stok.koin_20000,0)
            + COALESCE(v_stok.uang_50000,0) + COALESCE(v_stok.uang_100000,0));

  UPDATE stok_gudang SET
    koin_100=p_koin_100, koin_200=p_koin_200, koin_500=p_koin_500, koin_1000=p_koin_1000,
    koin_2000=p_koin_2000, koin_5000=p_koin_5000, koin_10000=p_koin_10000, koin_20000=p_koin_20000,
    uang_50000=p_uang_50000, uang_100000=p_uang_100000,
    last_updated=now(), updated_by=p_updated_by
  WHERE id = p_stok_id;

  INSERT INTO stok_gudang_log (tipe, keterangan, delta_total, created_by)
  VALUES ('penyesuaian', COALESCE(p_keterangan,'Penyesuaian manual'), v_delta, p_updated_by);

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stok_gudang(UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION update_stok_gudang(UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,UUID) TO authenticated;

-- ============================================================
-- 2. approve_sesi_transaction — log keluar modal
-- ============================================================
CREATE OR REPLACE FUNCTION approve_sesi_transaction(
  p_sesi_id UUID, p_approved_by UUID, p_catatan TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stok  stok_gudang%ROWTYPE;
  v_modal modal_koin%ROWTYPE;
  v_delta BIGINT;
BEGIN
  SELECT * INTO v_stok FROM stok_gudang LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok gudang tidak ditemukan'; END IF;

  SELECT * INTO v_modal FROM modal_koin WHERE sesi_tugas_id = p_sesi_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Data modal koin tidak ditemukan untuk sesi ini'; END IF;

  IF v_modal.koin_100   > v_stok.koin_100   THEN RAISE EXCEPTION 'Stok koin Rp100 tidak mencukupi';    END IF;
  IF v_modal.koin_200   > v_stok.koin_200   THEN RAISE EXCEPTION 'Stok koin Rp200 tidak mencukupi';    END IF;
  IF v_modal.koin_500   > v_stok.koin_500   THEN RAISE EXCEPTION 'Stok koin Rp500 tidak mencukupi';    END IF;
  IF v_modal.koin_1000  > v_stok.koin_1000  THEN RAISE EXCEPTION 'Stok koin Rp1.000 tidak mencukupi';  END IF;
  IF v_modal.koin_2000  > v_stok.koin_2000  THEN RAISE EXCEPTION 'Stok koin Rp2.000 tidak mencukupi';  END IF;
  IF v_modal.koin_5000  > v_stok.koin_5000  THEN RAISE EXCEPTION 'Stok koin Rp5.000 tidak mencukupi';  END IF;
  IF v_modal.koin_10000 > v_stok.koin_10000 THEN RAISE EXCEPTION 'Stok koin Rp10.000 tidak mencukupi'; END IF;
  IF v_modal.koin_20000 > v_stok.koin_20000 THEN RAISE EXCEPTION 'Stok koin Rp20.000 tidak mencukupi'; END IF;

  -- delta negatif = koin keluar dari gudang; semua field sudah nilai Rp
  v_delta := -(v_modal.koin_100 + v_modal.koin_200 + v_modal.koin_500 + v_modal.koin_1000
             + v_modal.koin_2000 + v_modal.koin_5000 + v_modal.koin_10000 + v_modal.koin_20000);

  UPDATE stok_gudang SET
    koin_100=koin_100-v_modal.koin_100, koin_200=koin_200-v_modal.koin_200,
    koin_500=koin_500-v_modal.koin_500, koin_1000=koin_1000-v_modal.koin_1000,
    koin_2000=koin_2000-v_modal.koin_2000, koin_5000=koin_5000-v_modal.koin_5000,
    koin_10000=koin_10000-v_modal.koin_10000, koin_20000=koin_20000-v_modal.koin_20000,
    last_updated=now(), updated_by=p_approved_by
  WHERE id = v_stok.id;

  INSERT INTO stok_gudang_log (
    tipe, keterangan, sesi_tugas_id, delta_total, created_by,
    delta_100, delta_200, delta_500, delta_1000,
    delta_2000, delta_5000, delta_10000, delta_20000
  ) VALUES (
    'keluar_modal',
    'Modal diambil oleh kasir — Sesi ' || LEFT(p_sesi_id::TEXT, 8),
    p_sesi_id, v_delta, p_approved_by,
    -v_modal.koin_100, -v_modal.koin_200, -v_modal.koin_500, -v_modal.koin_1000,
    -v_modal.koin_2000, -v_modal.koin_5000, -v_modal.koin_10000, -v_modal.koin_20000
  );

  UPDATE sesi_tugas SET
    status='active', approved_by=p_approved_by,
    approved_at=now(), catatan_approval=p_catatan
  WHERE id = p_sesi_id;

  RETURN jsonb_build_object('success', true, 'delta_total', v_delta);
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_sesi_transaction(UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION approve_sesi_transaction(UUID,UUID,TEXT) TO service_role;

-- ============================================================
-- 3. close_sesi_transaction — log masuk sisa koin + uang besar
-- ============================================================
CREATE OR REPLACE FUNCTION close_sesi_transaction(
  p_sesi_id UUID, p_closed_by UUID, p_catatan TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stok       stok_gudang%ROWTYPE;
  v_rek        rekonsiliasi%ROWTYPE;
  v_uang_50k   BIGINT;
  v_uang_100k  BIGINT;
  v_delta_koin BIGINT;
  v_delta_uang BIGINT;
BEGIN
  SELECT * INTO v_stok FROM stok_gudang LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok gudang tidak ditemukan'; END IF;

  SELECT * INTO v_rek FROM rekonsiliasi WHERE sesi_tugas_id = p_sesi_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Data rekonsiliasi tidak ditemukan untuk sesi ini'; END IF;

  SELECT COALESCE(SUM(uang_50000),0), COALESCE(SUM(uang_100000),0)
  INTO v_uang_50k, v_uang_100k
  FROM transaksi WHERE sesi_tugas_id = p_sesi_id;

  -- semua field sudah nilai Rp — jumlahkan langsung
  v_delta_koin := v_rek.sisa_koin_100 + v_rek.sisa_koin_200 + v_rek.sisa_koin_500
                + v_rek.sisa_koin_1000 + v_rek.sisa_koin_2000 + v_rek.sisa_koin_5000
                + v_rek.sisa_koin_10000 + v_rek.sisa_koin_20000;
  v_delta_uang := v_uang_50k + v_uang_100k;

  UPDATE stok_gudang SET
    koin_100=koin_100+v_rek.sisa_koin_100, koin_200=koin_200+v_rek.sisa_koin_200,
    koin_500=koin_500+v_rek.sisa_koin_500, koin_1000=koin_1000+v_rek.sisa_koin_1000,
    koin_2000=koin_2000+v_rek.sisa_koin_2000, koin_5000=koin_5000+v_rek.sisa_koin_5000,
    koin_10000=koin_10000+v_rek.sisa_koin_10000, koin_20000=koin_20000+v_rek.sisa_koin_20000,
    uang_50000=COALESCE(uang_50000,0)+v_uang_50k,
    uang_100000=COALESCE(uang_100000,0)+v_uang_100k,
    last_updated=now(), updated_by=p_closed_by
  WHERE id = v_stok.id;

  INSERT INTO stok_gudang_log (
    tipe, keterangan, sesi_tugas_id, delta_total, created_by,
    delta_100, delta_200, delta_500, delta_1000,
    delta_2000, delta_5000, delta_10000, delta_20000,
    delta_uang_50000, delta_uang_100000
  ) VALUES (
    'masuk_sisa',
    'Sesi ditutup — Sisa koin: ' || v_delta_koin || ' | Uang besar: ' || v_delta_uang
      || ' | Sesi ' || LEFT(p_sesi_id::TEXT, 8),
    p_sesi_id, v_delta_koin + v_delta_uang, p_closed_by,
    v_rek.sisa_koin_100, v_rek.sisa_koin_200, v_rek.sisa_koin_500, v_rek.sisa_koin_1000,
    v_rek.sisa_koin_2000, v_rek.sisa_koin_5000, v_rek.sisa_koin_10000, v_rek.sisa_koin_20000,
    v_uang_50k, v_uang_100k
  );

  UPDATE sesi_tugas SET
    status='closed', closed_by=p_closed_by,
    closed_at=now(), catatan_close=p_catatan
  WHERE id = p_sesi_id;

  RETURN jsonb_build_object('success', true, 'delta_koin', v_delta_koin, 'delta_uang', v_delta_uang);
END;
$$;

REVOKE EXECUTE ON FUNCTION close_sesi_transaction(UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION close_sesi_transaction(UUID,UUID,TEXT) TO service_role;

-- ============================================================
-- 4. update_stok_gudang_kantor — fix v_total_koin calculation
--    Field menyimpan nilai Rp langsung, tidak perlu dikali denominasi
-- ============================================================
CREATE OR REPLACE FUNCTION update_stok_gudang_kantor(
  p_stok_id     UUID,   p_toko_id    UUID,   p_kasir_id   UUID,
  p_koin_100    BIGINT DEFAULT 0, p_koin_200   BIGINT DEFAULT 0,
  p_koin_500    BIGINT DEFAULT 0, p_koin_1000  BIGINT DEFAULT 0,
  p_koin_2000   BIGINT DEFAULT 0, p_koin_5000  BIGINT DEFAULT 0,
  p_koin_10000  BIGINT DEFAULT 0, p_koin_20000 BIGINT DEFAULT 0,
  p_uang_50000  BIGINT DEFAULT 0, p_uang_100000 BIGINT DEFAULT 0,
  p_pic_nama    TEXT DEFAULT '',  p_pic_jabatan TEXT DEFAULT 'Admin/Manager',
  p_updated_by  UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stok       stok_gudang%ROWTYPE;
  v_toko       toko%ROWTYPE;
  v_total_koin BIGINT;
  v_total_uang BIGINT;
BEGIN
  IF NOT (SELECT role && ARRAY['admin','manager','superadmin']::text[]
          FROM public.users WHERE id = auth.uid() AND is_active = true)
  THEN RAISE EXCEPTION 'Forbidden: admin/manager only'; END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid()
  THEN RAISE EXCEPTION 'Forbidden: updated_by mismatch'; END IF;

  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok gudang tidak ditemukan'; END IF;

  IF p_koin_100   > v_stok.koin_100   THEN RAISE EXCEPTION 'Stok koin Rp100 tidak mencukupi';    END IF;
  IF p_koin_200   > v_stok.koin_200   THEN RAISE EXCEPTION 'Stok koin Rp200 tidak mencukupi';    END IF;
  IF p_koin_500   > v_stok.koin_500   THEN RAISE EXCEPTION 'Stok koin Rp500 tidak mencukupi';    END IF;
  IF p_koin_1000  > v_stok.koin_1000  THEN RAISE EXCEPTION 'Stok koin Rp1.000 tidak mencukupi';  END IF;
  IF p_koin_2000  > v_stok.koin_2000  THEN RAISE EXCEPTION 'Stok koin Rp2.000 tidak mencukupi';  END IF;
  IF p_koin_5000  > v_stok.koin_5000  THEN RAISE EXCEPTION 'Stok koin Rp5.000 tidak mencukupi';  END IF;
  IF p_koin_10000 > v_stok.koin_10000 THEN RAISE EXCEPTION 'Stok koin Rp10.000 tidak mencukupi'; END IF;
  IF p_koin_20000 > v_stok.koin_20000 THEN RAISE EXCEPTION 'Stok koin Rp20.000 tidak mencukupi'; END IF;

  -- Semua field sudah nilai Rp langsung — jumlahkan tanpa perkalian denominasi
  v_total_koin := p_koin_100 + p_koin_200 + p_koin_500 + p_koin_1000
                + p_koin_2000 + p_koin_5000 + p_koin_10000 + p_koin_20000;
  v_total_uang := p_uang_50000 + p_uang_100000;

  IF p_toko_id IS NOT NULL AND v_total_koin <> v_total_uang THEN
    RAISE EXCEPTION 'Selisih harus 0 untuk transaksi kantor (koin=%, uang=%)', v_total_koin, v_total_uang;
  END IF;

  UPDATE stok_gudang SET
    koin_100=koin_100-p_koin_100, koin_200=koin_200-p_koin_200,
    koin_500=koin_500-p_koin_500, koin_1000=koin_1000-p_koin_1000,
    koin_2000=koin_2000-p_koin_2000, koin_5000=koin_5000-p_koin_5000,
    koin_10000=koin_10000-p_koin_10000, koin_20000=koin_20000-p_koin_20000,
    uang_50000=COALESCE(uang_50000,0)+p_uang_50000,
    uang_100000=COALESCE(uang_100000,0)+p_uang_100000,
    last_updated=now(), updated_by=p_updated_by
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
    CASE WHEN p_toko_id IS NULL THEN COALESCE(p_pic_nama,'Penyesuaian manual')
         ELSE 'Penukaran koin kantor - Toko: '||COALESCE(v_toko.nama_toko,'?')||' ('||COALESCE(v_toko.kode_toko,'?')||')' END,
    v_total_uang - v_total_koin, p_updated_by,
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
      total_uang_diterima, selisih, pic_nama, pic_jabatan, status, jenis
    ) VALUES (
      p_toko_id, p_kasir_id, now(),
      p_koin_100, p_koin_200, p_koin_500, p_koin_1000,
      p_koin_2000, p_koin_5000, p_koin_10000, p_koin_20000,
      v_total_koin, p_uang_50000, p_uang_100000,
      v_total_uang, 0, p_pic_nama, p_pic_jabatan, 'submitted', 'kantor'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'total_koin', v_total_koin, 'total_uang', v_total_uang);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stok_gudang_kantor(UUID,UUID,UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION update_stok_gudang_kantor(UUID,UUID,UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,UUID) TO authenticated;
