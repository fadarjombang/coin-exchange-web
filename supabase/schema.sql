-- ============================================================
-- SCHEMA: Sistem Manajemen Tukar Koin — Indomaret Finance
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. USERS (synced with auth.users via triggers)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik        TEXT        UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('superadmin','admin','manager','kasir','driver')),
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. MOBIL
-- ============================================================
CREATE TABLE IF NOT EXISTS mobil (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nopol      TEXT        UNIQUE NOT NULL,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TOKO
-- ============================================================
CREATE TABLE IF NOT EXISTS toko (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  kode_toko  TEXT        UNIQUE NOT NULL,
  nama_toko  TEXT        NOT NULL,
  alamat     TEXT,
  area       TEXT,
  "as"       TEXT,
  am         TEXT,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. SESI TUGAS
-- ============================================================
CREATE TABLE IF NOT EXISTS sesi_tugas (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal          DATE        NOT NULL,
  mobil_id         UUID        NOT NULL REFERENCES mobil(id),
  kasir_id         UUID        NOT NULL REFERENCES users(id),
  driver_id        UUID        NOT NULL REFERENCES users(id),
  nama_polisi      TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','pending_approval','active','pending_close','closed')),
  approved_by      UUID        REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  catatan_approval TEXT,
  closed_by        UUID        REFERENCES users(id),
  closed_at        TIMESTAMPTZ,
  catatan_close    TEXT,
  created_by       UUID        NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. MODAL KOIN (1-to-1 with sesi_tugas)
-- ============================================================
CREATE TABLE IF NOT EXISTS modal_koin (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID    NOT NULL REFERENCES sesi_tugas(id) ON DELETE CASCADE UNIQUE,
  koin_100      BIGINT  DEFAULT 0,
  koin_200      BIGINT  DEFAULT 0,
  koin_500      BIGINT  DEFAULT 0,
  koin_1000     BIGINT  DEFAULT 0,
  koin_2000     BIGINT  DEFAULT 0,
  koin_5000     BIGINT  DEFAULT 0,
  koin_10000    BIGINT  DEFAULT 0,
  koin_20000    BIGINT  DEFAULT 0,
  total_nilai   BIGINT  GENERATED ALWAYS AS (
    koin_100*100 + koin_200*200 + koin_500*500 + koin_1000*1000 +
    koin_2000*2000 + koin_5000*5000 + koin_10000*10000 + koin_20000*20000
  ) STORED
);

-- ============================================================
-- 6. TOKO ASSIGNMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS toko_assignment (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID        NOT NULL REFERENCES sesi_tugas(id) ON DELETE CASCADE,
  toko_id       UUID        NOT NULL REFERENCES toko(id),
  urutan        INT         NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','on_progress','selesai','skip')),
  alasan_skip   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sesi_tugas_id, toko_id)
);

-- ============================================================
-- 7. TRANSAKSI
-- ============================================================
CREATE TABLE IF NOT EXISTS transaksi (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id       UUID        NOT NULL REFERENCES sesi_tugas(id),
  toko_id             UUID        NOT NULL REFERENCES toko(id),
  kasir_id            UUID        NOT NULL REFERENCES users(id),
  tanggal_waktu       TIMESTAMPTZ DEFAULT now(),
  koin_100            BIGINT      DEFAULT 0,
  koin_200            BIGINT      DEFAULT 0,
  koin_500            BIGINT      DEFAULT 0,
  koin_1000           BIGINT      DEFAULT 0,
  koin_2000           BIGINT      DEFAULT 0,
  koin_5000           BIGINT      DEFAULT 0,
  koin_10000          BIGINT      DEFAULT 0,
  koin_20000          BIGINT      DEFAULT 0,
  total_koin_nilai    BIGINT      NOT NULL,
  uang_50000          BIGINT      DEFAULT 0,
  uang_100000         BIGINT      DEFAULT 0,
  total_uang_diterima BIGINT      NOT NULL,
  selisih             BIGINT      NOT NULL DEFAULT 0,
  pic_nama            TEXT        NOT NULL,
  pic_jabatan         TEXT,
  foto_serah_terima   TEXT,
  ttd_pic_toko        TEXT,
  ttd_kasir           TEXT,
  status              TEXT        NOT NULL DEFAULT 'submitted',
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sesi_tugas_id, toko_id)
);

-- ============================================================
-- 8. REKONSILIASI
-- ============================================================
CREATE TABLE IF NOT EXISTS rekonsiliasi (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id     UUID        NOT NULL REFERENCES sesi_tugas(id) UNIQUE,
  kasir_id          UUID        REFERENCES users(id),
  sisa_koin_100     BIGINT      DEFAULT 0,
  sisa_koin_200     BIGINT      DEFAULT 0,
  sisa_koin_500     BIGINT      DEFAULT 0,
  sisa_koin_1000    BIGINT      DEFAULT 0,
  sisa_koin_2000    BIGINT      DEFAULT 0,
  sisa_koin_5000    BIGINT      DEFAULT 0,
  sisa_koin_10000   BIGINT      DEFAULT 0,
  sisa_koin_20000   BIGINT      DEFAULT 0,
  sisa_koin_nilai   BIGINT      NOT NULL DEFAULT 0,
  total_koin_keluar BIGINT      NOT NULL DEFAULT 0,
  total_uang_masuk  BIGINT      NOT NULL DEFAULT 0,
  uang_setoran      BIGINT      DEFAULT 0,
  expected_sisa_koin BIGINT     NOT NULL DEFAULT 0,
  selisih_koin      BIGINT      NOT NULL DEFAULT 0,
  selisih_uang      BIGINT      NOT NULL DEFAULT 0,
  is_balanced       BOOLEAN     NOT NULL DEFAULT false,
  foto_sisa         TEXT,
  ttd_kasir         TEXT,
  catatan           TEXT,
  submitted_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. STOK GUDANG (singleton — exactly 1 row always)
-- ============================================================
CREATE TABLE IF NOT EXISTS stok_gudang (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  koin_100    BIGINT      DEFAULT 0,
  koin_200    BIGINT      DEFAULT 0,
  koin_500    BIGINT      DEFAULT 0,
  koin_1000   BIGINT      DEFAULT 0,
  koin_2000   BIGINT      DEFAULT 0,
  koin_5000   BIGINT      DEFAULT 0,
  koin_10000  BIGINT      DEFAULT 0,
  koin_20000  BIGINT      DEFAULT 0,
  total_nilai BIGINT      GENERATED ALWAYS AS (
    koin_100*100 + koin_200*200 + koin_500*500 + koin_1000*1000 +
    koin_2000*2000 + koin_5000*5000 + koin_10000*10000 + koin_20000*20000
  ) STORED,
  last_updated TIMESTAMPTZ DEFAULT now(),
  updated_by   UUID        REFERENCES users(id)
);

-- ============================================================
-- 10. STOK GUDANG LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS stok_gudang_log (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal       TIMESTAMPTZ DEFAULT now(),
  tipe          TEXT        NOT NULL CHECK (tipe IN ('keluar_modal','masuk_sisa','penyesuaian')),
  keterangan    TEXT,
  sesi_tugas_id UUID        REFERENCES sesi_tugas(id),
  delta_100     BIGINT      DEFAULT 0,
  delta_200     BIGINT      DEFAULT 0,
  delta_500     BIGINT      DEFAULT 0,
  delta_1000    BIGINT      DEFAULT 0,
  delta_2000    BIGINT      DEFAULT 0,
  delta_5000    BIGINT      DEFAULT 0,
  delta_10000   BIGINT      DEFAULT 0,
  delta_20000   BIGINT      DEFAULT 0,
  delta_total   BIGINT,
  created_by    UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sesi_tugas_status  ON sesi_tugas(status);
CREATE INDEX IF NOT EXISTS idx_sesi_tugas_kasir   ON sesi_tugas(kasir_id);
CREATE INDEX IF NOT EXISTS idx_sesi_tugas_tanggal ON sesi_tugas(tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_sesi     ON transaksi(sesi_tugas_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_toko     ON transaksi(toko_id);
CREATE INDEX IF NOT EXISTS idx_toko_assignment_sesi ON toko_assignment(sesi_tugas_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobil            ENABLE ROW LEVEL SECURITY;
ALTER TABLE toko             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesi_tugas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE modal_koin       ENABLE ROW LEVEL SECURITY;
ALTER TABLE toko_assignment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekonsiliasi     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_gudang      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_gudang_log  ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- USERS: all authenticated can read; only superadmin can write
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'superadmin');
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated USING (get_my_role() = 'superadmin');

-- TOKO: all authenticated can read; admin can write
CREATE POLICY "toko_select" ON toko FOR SELECT TO authenticated USING (true);
CREATE POLICY "toko_insert" ON toko FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','superadmin'));
CREATE POLICY "toko_update" ON toko FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','superadmin'));

-- MOBIL: all authenticated can read; admin can write
CREATE POLICY "mobil_select" ON mobil FOR SELECT TO authenticated USING (true);
CREATE POLICY "mobil_insert" ON mobil FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','superadmin'));
CREATE POLICY "mobil_update" ON mobil FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','superadmin'));

-- STOK GUDANG: admin/manager can read; admin can write
CREATE POLICY "stok_select" ON stok_gudang FOR SELECT TO authenticated USING (get_my_role() IN ('admin','manager','superadmin'));
CREATE POLICY "stok_update" ON stok_gudang FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','superadmin'));
CREATE POLICY "stok_log_select" ON stok_gudang_log FOR SELECT TO authenticated USING (get_my_role() IN ('admin','manager','superadmin'));
CREATE POLICY "stok_log_insert" ON stok_gudang_log FOR INSERT TO authenticated WITH CHECK (true);

-- SESI TUGAS: admin/manager see all; kasir sees own
CREATE POLICY "sesi_select_admin"  ON sesi_tugas FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','manager','superadmin'));
CREATE POLICY "sesi_select_kasir"  ON sesi_tugas FOR SELECT TO authenticated
  USING (kasir_id = auth.uid());
CREATE POLICY "sesi_insert"        ON sesi_tugas FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','superadmin'));
CREATE POLICY "sesi_update_admin"  ON sesi_tugas FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','manager','superadmin'));

-- MODAL KOIN: follow sesi_tugas access
CREATE POLICY "modal_select" ON modal_koin FOR SELECT TO authenticated USING (true);
CREATE POLICY "modal_insert" ON modal_koin FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','superadmin'));

-- TOKO ASSIGNMENT: admin/manager/kasir can read; kasir updates own; admin inserts
CREATE POLICY "assign_select" ON toko_assignment FOR SELECT TO authenticated USING (true);
CREATE POLICY "assign_insert" ON toko_assignment FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','superadmin'));
CREATE POLICY "assign_update" ON toko_assignment FOR UPDATE TO authenticated USING (true);

-- TRANSAKSI: admin/manager see all; kasir inserts/sees own
CREATE POLICY "trx_select_admin" ON transaksi FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','manager','superadmin'));
CREATE POLICY "trx_select_kasir" ON transaksi FOR SELECT TO authenticated
  USING (kasir_id = auth.uid());
CREATE POLICY "trx_insert"       ON transaksi FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'kasir');

-- REKONSILIASI: admin/manager see all; kasir inserts/sees own
CREATE POLICY "rek_select_admin" ON rekonsiliasi FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','manager','superadmin'));
CREATE POLICY "rek_select_kasir" ON rekonsiliasi FOR SELECT TO authenticated
  USING (kasir_id = auth.uid());
CREATE POLICY "rek_insert"       ON rekonsiliasi FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'kasir');

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE toko_assignment;
ALTER PUBLICATION supabase_realtime ADD TABLE sesi_tugas;

-- ============================================================
-- SEED: Stok gudang singleton row
-- ============================================================
INSERT INTO stok_gudang (koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000, koin_10000, koin_20000)
VALUES (0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;
