-- =========================================================================
-- DATABASE MIGRATION: Fix RLS Policies for Array-based User Roles
-- Run this in: Supabase Dashboard → SQL Editor
-- =========================================================================

-- 1. Drop all policies that depend on get_my_role() first to allow changing the function signature
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

DROP POLICY IF EXISTS "toko_insert" ON toko;
DROP POLICY IF EXISTS "toko_update" ON toko;
DROP POLICY IF EXISTS "toko_delete" ON toko;

DROP POLICY IF EXISTS "mobil_insert" ON mobil;
DROP POLICY IF EXISTS "mobil_update" ON mobil;
DROP POLICY IF EXISTS "mobil_delete" ON mobil;

DROP POLICY IF EXISTS "stok_select" ON stok_gudang;
DROP POLICY IF EXISTS "stok_update" ON stok_gudang;
DROP POLICY IF EXISTS "stok_log_select" ON stok_gudang_log;

DROP POLICY IF EXISTS "sesi_select_admin" ON sesi_tugas;
DROP POLICY IF EXISTS "sesi_insert" ON sesi_tugas;
DROP POLICY IF EXISTS "sesi_update_admin" ON sesi_tugas;
DROP POLICY IF EXISTS "sesi_delete" ON sesi_tugas;

DROP POLICY IF EXISTS "modal_insert" ON modal_koin;
DROP POLICY IF EXISTS "modal_update" ON modal_koin;
DROP POLICY IF EXISTS "modal_delete" ON modal_koin;

DROP POLICY IF EXISTS "assign_insert" ON toko_assignment;
DROP POLICY IF EXISTS "assign_delete" ON toko_assignment;

DROP POLICY IF EXISTS "trx_select_admin" ON transaksi;
DROP POLICY IF EXISTS "trx_insert" ON transaksi;
DROP POLICY IF EXISTS "transaksi_insert" ON transaksi;

DROP POLICY IF EXISTS "rek_select_admin" ON rekonsiliasi;
DROP POLICY IF EXISTS "rek_insert" ON rekonsiliasi;

-- 2. Drop the old function (with CASCADE just in case there are other custom policies)
DROP FUNCTION IF EXISTS get_my_role() CASCADE;

-- 3. Recreate get_my_role() returning TEXT[] to match the active users.role column
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT[] AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Recreate all RLS policies using proper array checks

-- USERS
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK ('superadmin' = ANY (get_my_role()));
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated USING ('superadmin' = ANY (get_my_role()));
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated USING ('superadmin' = ANY (get_my_role()));

-- TOKO
CREATE POLICY "toko_insert" ON toko FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "toko_update" ON toko FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "toko_delete" ON toko FOR DELETE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- MOBIL
CREATE POLICY "mobil_insert" ON mobil FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "mobil_update" ON mobil FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "mobil_delete" ON mobil FOR DELETE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- STOK GUDANG
CREATE POLICY "stok_select" ON stok_gudang FOR SELECT TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);
CREATE POLICY "stok_update" ON stok_gudang FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "stok_log_select" ON stok_gudang_log FOR SELECT TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);

-- SESI TUGAS
CREATE POLICY "sesi_select_admin" ON sesi_tugas FOR SELECT TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);
CREATE POLICY "sesi_insert" ON sesi_tugas FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "sesi_update_admin" ON sesi_tugas FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);
CREATE POLICY "sesi_delete" ON sesi_tugas FOR DELETE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- MODAL KOIN
CREATE POLICY "modal_insert" ON modal_koin FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "modal_update" ON modal_koin FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "modal_delete" ON modal_koin FOR DELETE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- TOKO ASSIGNMENT
CREATE POLICY "assign_insert" ON toko_assignment FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['admin','superadmin']::text[]);
CREATE POLICY "assign_delete" ON toko_assignment FOR DELETE TO authenticated USING (get_my_role() && ARRAY['admin','superadmin']::text[]);

-- TRANSAKSI
CREATE POLICY "trx_select_admin" ON transaksi FOR SELECT TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);
CREATE POLICY "trx_insert" ON transaksi FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['kasir','admin','superadmin']::text[]);

-- REKONSILIASI
CREATE POLICY "rek_select_admin" ON rekonsiliasi FOR SELECT TO authenticated USING (get_my_role() && ARRAY['admin','manager','superadmin']::text[]);
CREATE POLICY "rek_insert" ON rekonsiliasi FOR INSERT TO authenticated WITH CHECK ('kasir' = ANY (get_my_role()));
