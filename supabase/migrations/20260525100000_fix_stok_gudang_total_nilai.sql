-- Migration: Fix total_nilai generated columns in stok_gudang and modal_koin
-- Task: Fix discrepancy where generated columns assumed coin count but stored absolute Rupiah value.

-- 1. Clean up any existing NULLs in stok_gudang columns
UPDATE public.stok_gudang SET
  koin_100 = COALESCE(koin_100, 0),
  koin_200 = COALESCE(koin_200, 0),
  koin_500 = COALESCE(koin_500, 0),
  koin_1000 = COALESCE(koin_1000, 0),
  koin_2000 = COALESCE(koin_2000, 0),
  koin_5000 = COALESCE(koin_5000, 0),
  koin_10000 = COALESCE(koin_10000, 0),
  koin_20000 = COALESCE(koin_20000, 0),
  uang_50000 = COALESCE(uang_50000, 0),
  uang_100000 = COALESCE(uang_100000, 0);

-- 2. Enforce NOT NULL on stok_gudang columns
ALTER TABLE public.stok_gudang
  ALTER COLUMN koin_100 SET NOT NULL,
  ALTER COLUMN koin_200 SET NOT NULL,
  ALTER COLUMN koin_500 SET NOT NULL,
  ALTER COLUMN koin_1000 SET NOT NULL,
  ALTER COLUMN koin_2000 SET NOT NULL,
  ALTER COLUMN koin_5000 SET NOT NULL,
  ALTER COLUMN koin_10000 SET NOT NULL,
  ALTER COLUMN koin_20000 SET NOT NULL,
  ALTER COLUMN uang_50000 SET NOT NULL,
  ALTER COLUMN uang_100000 SET NOT NULL;

-- 3. Clean up any existing NULLs in modal_koin columns
UPDATE public.modal_koin SET
  koin_100 = COALESCE(koin_100, 0),
  koin_200 = COALESCE(koin_200, 0),
  koin_500 = COALESCE(koin_500, 0),
  koin_1000 = COALESCE(koin_1000, 0),
  koin_2000 = COALESCE(koin_2000, 0),
  koin_5000 = COALESCE(koin_5000, 0),
  koin_10000 = COALESCE(koin_10000, 0),
  koin_20000 = COALESCE(koin_20000, 0);

-- 4. Enforce NOT NULL on modal_koin columns
ALTER TABLE public.modal_koin
  ALTER COLUMN koin_100 SET NOT NULL,
  ALTER COLUMN koin_200 SET NOT NULL,
  ALTER COLUMN koin_500 SET NOT NULL,
  ALTER COLUMN koin_1000 SET NOT NULL,
  ALTER COLUMN koin_2000 SET NOT NULL,
  ALTER COLUMN koin_5000 SET NOT NULL,
  ALTER COLUMN koin_10000 SET NOT NULL,
  ALTER COLUMN koin_20000 SET NOT NULL;

-- 5. Recreate total_nilai in stok_gudang (including coins + big money)
ALTER TABLE public.stok_gudang DROP COLUMN IF EXISTS total_nilai;
ALTER TABLE public.stok_gudang ADD COLUMN total_nilai BIGINT GENERATED ALWAYS AS (
  koin_100 + koin_200 + koin_500 + koin_1000 + koin_2000 + koin_5000 + koin_10000 + koin_20000 + uang_50000 + uang_100000
) STORED;

-- 6. Recreate total_nilai in modal_koin
ALTER TABLE public.modal_koin DROP COLUMN IF EXISTS total_nilai;
ALTER TABLE public.modal_koin ADD COLUMN total_nilai BIGINT GENERATED ALWAYS AS (
  koin_100 + koin_200 + koin_500 + koin_1000 + koin_2000 + koin_5000 + koin_10000 + koin_20000
) STORED;
