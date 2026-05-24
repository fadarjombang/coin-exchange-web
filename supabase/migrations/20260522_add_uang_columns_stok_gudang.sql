-- Migration: Tambah kolom uang_50000 dan uang_100000 ke tabel stok_gudang
-- Task 06: Fix Stok Gudang Schema Mismatch
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE stok_gudang
  ADD COLUMN IF NOT EXISTS uang_50000  BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uang_100000 BIGINT DEFAULT 0;
