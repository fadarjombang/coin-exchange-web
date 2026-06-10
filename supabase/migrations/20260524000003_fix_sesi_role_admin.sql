-- Migration: Fix sesi creation role — admin creates, manager approves/closes
-- Admin: create/edit/delete sesi (draft → pending_approval)
-- Manager: approve (pending_approval → active) and close (pending_close → closed)

-- ============================================================
-- RLS Policies
-- ============================================================
DROP POLICY IF EXISTS "sesi_insert" ON sesi_tugas;
CREATE POLICY "sesi_insert" ON sesi_tugas
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);

DROP POLICY IF EXISTS "sesi_update_admin" ON sesi_tugas;
CREATE POLICY "sesi_update_admin" ON sesi_tugas
  FOR UPDATE TO authenticated
  USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);

-- modal_koin: admin creates, manager can edit before approval
DROP POLICY IF EXISTS "modal_insert" ON modal_koin;
CREATE POLICY "modal_insert" ON modal_koin
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);

DROP POLICY IF EXISTS "modal_update" ON modal_koin;
CREATE POLICY "modal_update" ON modal_koin
  FOR UPDATE TO authenticated
  USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);

-- toko_assignment: admin creates/deletes, kasir updates status
DROP POLICY IF EXISTS "assign_insert" ON toko_assignment;
CREATE POLICY "assign_insert" ON toko_assignment
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);

DROP POLICY IF EXISTS "assign_delete" ON toko_assignment;
CREATE POLICY "assign_delete" ON toko_assignment
  FOR DELETE TO authenticated
  USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- ============================================================
-- RPC: create_sesi_tugas — admin only
-- ============================================================
CREATE OR REPLACE FUNCTION create_sesi_tugas(
  p_tanggal      DATE,
  p_mobil_id     UUID,
  p_kasir_id     UUID,
  p_driver_id    UUID,
  p_nama_polisi  TEXT,
  p_status       TEXT,
  p_created_by   UUID,
  p_modal        JSONB,
  p_assignments  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi_id UUID;
  v_assign  JSONB;
BEGIN
  IF NOT (
    SELECT role && ARRAY['admin','superadmin']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
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
-- RPC: update_sesi_tugas — admin only
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
    SELECT role && ARRAY['admin','superadmin']::text[]
    FROM public.users WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
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
