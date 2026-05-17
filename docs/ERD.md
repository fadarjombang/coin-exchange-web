# Entity Relationship Diagram (ERD)
## Sistem Manajemen Tukar Koin

---

## Visual ERD

```mermaid
erDiagram
    users ||--o{ sesi_tugas : "kasir_id"
    users ||--o{ sesi_tugas : "driver_id"
    users ||--o{ sesi_tugas : "created_by"
    users ||--o{ sesi_tugas : "approved_by"
    users ||--o{ sesi_tugas : "closed_by"
    users ||--o{ transaksi : "kasir_id"
    users ||--o{ stok_gudang : "updated_by"
    users ||--o{ stok_gudang_log : "created_by"
    
    mobil ||--o{ sesi_tugas : "mobil_id"
    toko ||--o{ toko_assignment : "toko_id"
    toko ||--o{ transaksi : "toko_id"
    
    sesi_tugas ||--|| modal_koin : "sesi_tugas_id"
    sesi_tugas ||--o{ toko_assignment : "sesi_tugas_id"
    sesi_tugas ||--o{ transaksi : "sesi_tugas_id"
    sesi_tugas ||--o| rekonsiliasi : "sesi_tugas_id"
    sesi_tugas ||--o{ stok_gudang_log : "sesi_tugas_id"

    users {
        uuid id PK
        text nik UK
        text name
        text role
        boolean is_active
        timestamptz created_at
    }

    mobil {
        uuid id PK
        text nopol UK
        boolean is_active
        timestamptz created_at
    }

    toko {
        uuid id PK
        text kode_toko UK
        text nama_toko
        text alamat
        text area
        boolean is_active
        timestamptz created_at
    }

    sesi_tugas {
        uuid id PK
        date tanggal
        uuid mobil_id FK
        uuid kasir_id FK
        uuid driver_id FK
        text nama_polisi
        text status
        uuid approved_by FK
        timestamptz approved_at
        text catatan_approval
        uuid closed_by FK
        timestamptz closed_at
        text catatan_close
        uuid created_by FK
        timestamptz created_at
    }

    modal_koin {
        uuid id PK
        uuid sesi_tugas_id FK_UK
        int koin_100
        int koin_200
        int koin_500
        int koin_1000
        int koin_2000
        int koin_5000
        int koin_10000
        int koin_20000
        bigint total_nilai "GENERATED"
    }

    toko_assignment {
        uuid id PK
        uuid sesi_tugas_id FK
        uuid toko_id FK
        int urutan
        text status
        text alasan_skip
        timestamptz updated_at
    }

    transaksi {
        uuid id PK
        uuid sesi_tugas_id FK
        uuid toko_id FK
        uuid kasir_id FK
        timestamptz tanggal_waktu
        int koin_100
        int koin_200
        int koin_500
        int koin_1000
        int koin_2000
        int koin_5000
        int koin_10000
        int koin_20000
        bigint total_koin_nilai
        int uang_50000
        int uang_100000
        bigint total_uang_diterima
        bigint selisih
        text pic_nama
        text pic_jabatan
        text foto_serah_terima "BASE64"
        text ttd_pic_toko "BASE64"
        text ttd_kasir "BASE64"
        text status
        timestamptz created_at
    }

    rekonsiliasi {
        uuid id PK
        uuid sesi_tugas_id FK_UK
        int sisa_koin_100
        int sisa_koin_200
        int sisa_koin_500
        int sisa_koin_1000
        int sisa_koin_2000
        int sisa_koin_5000
        int sisa_koin_10000
        int sisa_koin_20000
        bigint sisa_koin_nilai
        bigint total_koin_keluar
        bigint total_uang_masuk
        bigint expected_sisa_koin
        bigint selisih_koin
        bigint selisih_uang
        boolean is_balanced
        text foto_sisa "BASE64"
        text catatan
        timestamptz submitted_at
    }

    stok_gudang {
        uuid id PK
        int koin_100
        int koin_200
        int koin_500
        int koin_1000
        int koin_2000
        int koin_5000
        int koin_10000
        int koin_20000
        bigint total_nilai "GENERATED"
        timestamptz last_updated
        uuid updated_by FK
    }

    stok_gudang_log {
        uuid id PK
        timestamptz tanggal
        text tipe
        text keterangan
        uuid sesi_tugas_id FK
        int delta_100
        int delta_200
        int delta_500
        int delta_1000
        int delta_2000
        int delta_5000
        int delta_10000
        int delta_20000
        bigint delta_total
        uuid created_by FK
        timestamptz created_at
    }
```

---

## Full SQL Schema

```sql
-- ============================================
-- 1. USERS
-- ============================================
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nik TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin','admin','manager','kasir','driver')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. MOBIL
-- ============================================
CREATE TABLE mobil (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nopol TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. TOKO
-- ============================================
CREATE TABLE toko (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kode_toko TEXT UNIQUE NOT NULL,
  nama_toko TEXT NOT NULL,
  alamat TEXT,
  area TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. SESI TUGAS
-- ============================================
CREATE TABLE sesi_tugas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  mobil_id UUID NOT NULL REFERENCES mobil(id),
  kasir_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  nama_polisi TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','active','pending_close','closed')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  catatan_approval TEXT,
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  catatan_close TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. MODAL KOIN
-- ============================================
CREATE TABLE modal_koin (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID NOT NULL REFERENCES sesi_tugas(id) ON DELETE CASCADE UNIQUE,
  koin_100 INT DEFAULT 0,
  koin_200 INT DEFAULT 0,
  koin_500 INT DEFAULT 0,
  koin_1000 INT DEFAULT 0,
  koin_2000 INT DEFAULT 0,
  koin_5000 INT DEFAULT 0,
  koin_10000 INT DEFAULT 0,
  koin_20000 INT DEFAULT 0,
  total_nilai BIGINT GENERATED ALWAYS AS (
    koin_100*100 + koin_200*200 + koin_500*500 + koin_1000*1000 +
    koin_2000*2000 + koin_5000*5000 + koin_10000*10000 + koin_20000*20000
  ) STORED
);

-- ============================================
-- 6. TOKO ASSIGNMENT
-- ============================================
CREATE TABLE toko_assignment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID NOT NULL REFERENCES sesi_tugas(id) ON DELETE CASCADE,
  toko_id UUID NOT NULL REFERENCES toko(id),
  urutan INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','on_progress','selesai','skip')),
  alasan_skip TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sesi_tugas_id, toko_id)
);

-- ============================================
-- 7. TRANSAKSI
-- ============================================
CREATE TABLE transaksi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID NOT NULL REFERENCES sesi_tugas(id),
  toko_id UUID NOT NULL REFERENCES toko(id),
  kasir_id UUID NOT NULL REFERENCES users(id),
  tanggal_waktu TIMESTAMPTZ DEFAULT now(),
  koin_100 INT DEFAULT 0,
  koin_200 INT DEFAULT 0,
  koin_500 INT DEFAULT 0,
  koin_1000 INT DEFAULT 0,
  koin_2000 INT DEFAULT 0,
  koin_5000 INT DEFAULT 0,
  koin_10000 INT DEFAULT 0,
  koin_20000 INT DEFAULT 0,
  total_koin_nilai BIGINT NOT NULL,
  uang_50000 INT DEFAULT 0,
  uang_100000 INT DEFAULT 0,
  total_uang_diterima BIGINT NOT NULL,
  selisih BIGINT NOT NULL DEFAULT 0,
  pic_nama TEXT NOT NULL,
  pic_jabatan TEXT,
  foto_serah_terima TEXT,
  ttd_pic_toko TEXT,
  ttd_kasir TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sesi_tugas_id, toko_id)
);

-- ============================================
-- 8. REKONSILIASI
-- ============================================
CREATE TABLE rekonsiliasi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesi_tugas_id UUID NOT NULL REFERENCES sesi_tugas(id) UNIQUE,
  sisa_koin_100 INT DEFAULT 0,
  sisa_koin_200 INT DEFAULT 0,
  sisa_koin_500 INT DEFAULT 0,
  sisa_koin_1000 INT DEFAULT 0,
  sisa_koin_2000 INT DEFAULT 0,
  sisa_koin_5000 INT DEFAULT 0,
  sisa_koin_10000 INT DEFAULT 0,
  sisa_koin_20000 INT DEFAULT 0,
  sisa_koin_nilai BIGINT NOT NULL,
  total_koin_keluar BIGINT NOT NULL,
  total_uang_masuk BIGINT NOT NULL,
  expected_sisa_koin BIGINT NOT NULL,
  selisih_koin BIGINT NOT NULL,
  selisih_uang BIGINT NOT NULL,
  is_balanced BOOLEAN NOT NULL,
  foto_sisa TEXT,
  catatan TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 9. STOK GUDANG (singleton - only 1 row)
-- ============================================
CREATE TABLE stok_gudang (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  koin_100 INT DEFAULT 0,
  koin_200 INT DEFAULT 0,
  koin_500 INT DEFAULT 0,
  koin_1000 INT DEFAULT 0,
  koin_2000 INT DEFAULT 0,
  koin_5000 INT DEFAULT 0,
  koin_10000 INT DEFAULT 0,
  koin_20000 INT DEFAULT 0,
  total_nilai BIGINT GENERATED ALWAYS AS (
    koin_100*100 + koin_200*200 + koin_500*500 + koin_1000*1000 +
    koin_2000*2000 + koin_5000*5000 + koin_10000*10000 + koin_20000*20000
  ) STORED,
  last_updated TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- 10. STOK GUDANG LOG
-- ============================================
CREATE TABLE stok_gudang_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal TIMESTAMPTZ DEFAULT now(),
  tipe TEXT NOT NULL CHECK (tipe IN ('keluar_modal','masuk_sisa','penyesuaian')),
  keterangan TEXT,
  sesi_tugas_id UUID REFERENCES sesi_tugas(id),
  delta_100 INT DEFAULT 0,
  delta_200 INT DEFAULT 0,
  delta_500 INT DEFAULT 0,
  delta_1000 INT DEFAULT 0,
  delta_2000 INT DEFAULT 0,
  delta_5000 INT DEFAULT 0,
  delta_10000 INT DEFAULT 0,
  delta_20000 INT DEFAULT 0,
  delta_total BIGINT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_sesi_tugas_status ON sesi_tugas(status);
CREATE INDEX idx_sesi_tugas_kasir ON sesi_tugas(kasir_id);
CREATE INDEX idx_sesi_tugas_tanggal ON sesi_tugas(tanggal);
CREATE INDEX idx_transaksi_sesi ON transaksi(sesi_tugas_id);
CREATE INDEX idx_transaksi_toko ON transaksi(toko_id);
CREATE INDEX idx_toko_assignment_sesi ON toko_assignment(sesi_tugas_id);
CREATE INDEX idx_stok_gudang_log_sesi ON stok_gudang_log(sesi_tugas_id);

-- ============================================
-- SEED: Initial stok gudang row
-- ============================================
INSERT INTO stok_gudang (koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000, koin_10000, koin_20000)
VALUES (0, 0, 0, 0, 0, 0, 0, 0);

-- ============================================
-- SEED: Super admin account (password set via Supabase Auth)
-- ============================================
-- INSERT INTO users (nik, name, role) VALUES ('0000000000000001', 'Super Admin', 'superadmin');

-- ============================================
-- ENABLE REALTIME on toko_assignment for tracking
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE toko_assignment;
ALTER PUBLICATION supabase_realtime ADD TABLE sesi_tugas;
```
