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
  v_stok          stok_gudang%ROWTYPE;
  v_new_total     BIGINT;
  v_old_total     BIGINT;
  v_delta         BIGINT;
BEGIN
  -- Lock stok row untuk prevent race condition
  SELECT * INTO v_stok FROM stok_gudang WHERE id = p_stok_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok gudang tidak ditemukan';
  END IF;

  v_old_total := v_stok.koin_100*100 + v_stok.koin_200*200 + v_stok.koin_500*500 + v_stok.koin_1000*1000 + v_stok.koin_2000*2000 + v_stok.koin_5000*5000 + v_stok.koin_10000*10000 + v_stok.koin_20000*20000 + COALESCE(v_stok.uang_50000, 0) + COALESCE(v_stok.uang_100000, 0);
  v_new_total := p_koin_100*100 + p_koin_200*200 + p_koin_500*500 + p_koin_1000*1000 + p_koin_2000*2000 + p_koin_5000*5000 + p_koin_10000*10000 + p_koin_20000*20000 + p_uang_50000 + p_uang_100000;
  v_delta := v_new_total - v_old_total;

  UPDATE stok_gudang SET
    koin_100 = p_koin_100, koin_200 = p_koin_200, koin_500 = p_koin_500, koin_1000 = p_koin_1000, koin_2000 = p_koin_2000, koin_5000 = p_koin_5000, koin_10000 = p_koin_10000, koin_20000 = p_koin_20000, uang_50000 = p_uang_50000, uang_100000 = p_uang_100000, last_updated = now(), updated_by = p_updated_by
  WHERE id = p_stok_id;

  INSERT INTO stok_gudang_log (
    tipe, keterangan, delta_total, created_by
  ) VALUES (
    'penyesuaian', COALESCE(p_keterangan, 'Penyesuaian manual'), v_delta, p_updated_by
  );

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;
GRANT EXECUTE ON FUNCTION update_stok_gudang TO authenticated;
