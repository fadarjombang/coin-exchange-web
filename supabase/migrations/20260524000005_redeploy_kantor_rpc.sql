-- Redeploy update_stok_gudang_kantor — versi bersih
DROP FUNCTION IF EXISTS update_stok_gudang_kantor(UUID,UUID,UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,UUID);

CREATE OR REPLACE FUNCTION update_stok_gudang_kantor(
  p_stok_id     UUID,
  p_toko_id     UUID,
  p_kasir_id    UUID,
  p_koin_100    BIGINT DEFAULT 0,
  p_koin_200    BIGINT DEFAULT 0,
  p_koin_500    BIGINT DEFAULT 0,
  p_koin_1000   BIGINT DEFAULT 0,
  p_koin_2000   BIGINT DEFAULT 0,
  p_koin_5000   BIGINT DEFAULT 0,
  p_koin_10000  BIGINT DEFAULT 0,
  p_koin_20000  BIGINT DEFAULT 0,
  p_uang_50000  BIGINT DEFAULT 0,
  p_uang_100000 BIGINT DEFAULT 0,
  p_pic_nama    TEXT   DEFAULT '',
  p_pic_jabatan TEXT   DEFAULT 'Admin/Manager',
  p_updated_by  UUID   DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stok       stok_gudang%ROWTYPE;
  v_nama_toko  TEXT;
  v_kode_toko  TEXT;
  v_total_koin BIGINT;
  v_total_uang BIGINT;
BEGIN
  -- Role check
  IF NOT (SELECT role && ARRAY['admin','manager','superadmin']::text[]
          FROM public.users WHERE id = auth.uid() AND is_active = true)
  THEN RAISE EXCEPTION 'Forbidden: admin/manager only'; END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid()
  THEN RAISE EXCEPTION 'Forbidden: updated_by mismatch'; END IF;

  -- Lock stok row
  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok gudang tidak ditemukan'; END IF;

  -- Cek stok cukup
  IF p_koin_100   > COALESCE(v_stok.koin_100,0)   THEN RAISE EXCEPTION 'Stok koin Rp100 tidak mencukupi';    END IF;
  IF p_koin_200   > COALESCE(v_stok.koin_200,0)   THEN RAISE EXCEPTION 'Stok koin Rp200 tidak mencukupi';    END IF;
  IF p_koin_500   > COALESCE(v_stok.koin_500,0)   THEN RAISE EXCEPTION 'Stok koin Rp500 tidak mencukupi';    END IF;
  IF p_koin_1000  > COALESCE(v_stok.koin_1000,0)  THEN RAISE EXCEPTION 'Stok koin Rp1000 tidak mencukupi';   END IF;
  IF p_koin_2000  > COALESCE(v_stok.koin_2000,0)  THEN RAISE EXCEPTION 'Stok koin Rp2000 tidak mencukupi';   END IF;
  IF p_koin_5000  > COALESCE(v_stok.koin_5000,0)  THEN RAISE EXCEPTION 'Stok koin Rp5000 tidak mencukupi';   END IF;
  IF p_koin_10000 > COALESCE(v_stok.koin_10000,0) THEN RAISE EXCEPTION 'Stok koin Rp10000 tidak mencukupi';  END IF;
  IF p_koin_20000 > COALESCE(v_stok.koin_20000,0) THEN RAISE EXCEPTION 'Stok koin Rp20000 tidak mencukupi';  END IF;

  -- Hitung total (field menyimpan nilai Rp langsung)
  v_total_koin := p_koin_100 + p_koin_200 + p_koin_500 + p_koin_1000
                + p_koin_2000 + p_koin_5000 + p_koin_10000 + p_koin_20000;
  v_total_uang := p_uang_50000 + p_uang_100000;

  -- Selisih harus 0
  IF v_total_koin <> v_total_uang THEN
    RAISE EXCEPTION 'Selisih harus 0 (koin=%, uang=%)', v_total_koin, v_total_uang;
  END IF;

  -- Update stok gudang
  UPDATE stok_gudang SET
    koin_100    = COALESCE(koin_100,0)    - p_koin_100,
    koin_200    = COALESCE(koin_200,0)    - p_koin_200,
    koin_500    = COALESCE(koin_500,0)    - p_koin_500,
    koin_1000   = COALESCE(koin_1000,0)   - p_koin_1000,
    koin_2000   = COALESCE(koin_2000,0)   - p_koin_2000,
    koin_5000   = COALESCE(koin_5000,0)   - p_koin_5000,
    koin_10000  = COALESCE(koin_10000,0)  - p_koin_10000,
    koin_20000  = COALESCE(koin_20000,0)  - p_koin_20000,
    uang_50000  = COALESCE(uang_50000,0)  + p_uang_50000,
    uang_100000 = COALESCE(uang_100000,0) + p_uang_100000,
    last_updated = now(),
    updated_by   = p_updated_by
  WHERE id = p_stok_id;

  -- Ambil nama toko untuk keterangan log
  SELECT nama_toko, kode_toko INTO v_nama_toko, v_kode_toko
  FROM toko WHERE id = p_toko_id;

  -- Insert log
  INSERT INTO stok_gudang_log (
    tipe, keterangan, delta_total, created_by,
    delta_100, delta_200, delta_500, delta_1000,
    delta_2000, delta_5000, delta_10000, delta_20000,
    delta_uang_50000, delta_uang_100000
  ) VALUES (
    'penukaran_kantor',
    'Kantor - Toko: ' || COALESCE(v_nama_toko,'?') || ' (' || COALESCE(v_kode_toko,'?') || ')',
    0, -- delta 0 karena koin keluar = uang masuk
    p_updated_by,
    -p_koin_100, -p_koin_200, -p_koin_500, -p_koin_1000,
    -p_koin_2000, -p_koin_5000, -p_koin_10000, -p_koin_20000,
    p_uang_50000, p_uang_100000
  );

  -- Insert transaksi (tanpa sesi_tugas_id untuk transaksi kantor)
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

  RETURN jsonb_build_object('success', true, 'total_koin', v_total_koin, 'total_uang', v_total_uang);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stok_gudang_kantor(UUID,UUID,UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION update_stok_gudang_kantor(UUID,UUID,UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,UUID) TO authenticated;
