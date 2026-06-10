-- Migration: Task 16 — Add missing columns (schema drift fix)
-- Task 27 — Singleton constraint for stok_gudang
-- Run in: Supabase Dashboard → SQL Editor

-- ============================================================
-- Task 16: Kolom yang dipakai di FE tapi tidak ada di schema
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_profil TEXT;

ALTER TABLE mobil
  ADD COLUMN IF NOT EXISTS jenis_kendaraan TEXT,
  ADD COLUMN IF NOT EXISTS warna_mobil TEXT;

ALTER TABLE toko_assignment ADD COLUMN IF NOT EXISTS alokasi_koin BIGINT DEFAULT 0;

-- ============================================================
-- Task 27: Singleton constraint untuk stok_gudang
-- Memastikan hanya 1 baris yang bisa exist
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS stok_gudang_singleton ON stok_gudang ((true));
