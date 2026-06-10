import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations')

function readMigration(filename) {
  return readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf-8')
}

// ── Task 11: RPC auth.uid() guards ───────────────────────────
describe('Task 11 — RPC security guards in migration', () => {
  const sql = readMigration('20260524000007_security_rpc_and_rls.sql')

  it('submit_field_transaction checks kasir_id = auth.uid()', () => {
    expect(sql).toContain('p_kasir_id IS DISTINCT FROM auth.uid()')
  })

  it('update_stok_gudang_kantor has role gate', () => {
    expect(sql).toContain("ARRAY['admin','manager','superadmin']::text[]")
  })

  it('update_stok_gudang_kantor checks updated_by = auth.uid()', () => {
    expect(sql).toContain('p_updated_by IS DISTINCT FROM auth.uid()')
  })

  it('update_stok_gudang has role gate', () => {
    // Should appear at least twice (once per function)
    const count = (sql.match(/Forbidden: admin\/manager only/g) || []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('REVOKE FROM PUBLIC and anon on all RPCs', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION submit_field_transaction')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION update_stok_gudang_kantor')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION update_stok_gudang')
    expect(sql).toContain('FROM PUBLIC, anon')
  })
})

// ── Task 12: Ownership validation ────────────────────────────
describe('Task 12 — submit_field_transaction ownership check', () => {
  const sql = readMigration('20260524000007_security_rpc_and_rls.sql')

  it('validates assignment belongs to caller sesi', () => {
    expect(sql).toContain('s.kasir_id       = auth.uid()')
  })

  it('validates sesi status is active', () => {
    expect(sql).toContain("s.status         = 'active'")
  })

  it('validates assignment status is pending or on_progress', () => {
    expect(sql).toContain("ta.status        IN ('pending', 'on_progress')")
  })

  it('raises exception on invalid assignment', () => {
    expect(sql).toContain('Assignment tidak valid / sudah selesai / bukan milik kasir ini')
  })
})

// ── Task 13: get_my_role is_active filter ────────────────────
describe('Task 13 — get_my_role filters is_active', () => {
  const sql = readMigration('20260524000007_security_rpc_and_rls.sql')

  it('get_my_role includes is_active = true filter', () => {
    expect(sql).toContain('WHERE id = auth.uid() AND is_active = true')
  })
})

// ── Task 14: Balance check in RPC ────────────────────────────
describe('Task 14 — update_stok_gudang_kantor balance check', () => {
  const sql = readMigration('20260524000007_security_rpc_and_rls.sql')

  it('raises exception when koin != uang for kantor transaction', () => {
    expect(sql).toContain('Selisih harus 0 untuk transaksi kantor')
  })

  it('only applies balance check when p_toko_id IS NOT NULL', () => {
    expect(sql).toContain('IF p_toko_id IS NOT NULL AND v_total_koin <> v_total_uang')
  })
})

// ── Task 16: Schema drift columns ────────────────────────────
describe('Task 16 — Missing columns migration', () => {
  const sql = readMigration('20260524000006_schema_drift_and_singleton.sql')

  it('adds foto_profil to users', () => {
    expect(sql).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_profil')
  })

  it('adds jenis_kendaraan to mobil', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS jenis_kendaraan')
  })

  it('adds warna_mobil to mobil', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS warna_mobil')
  })

  it('adds alokasi_koin to toko_assignment', () => {
    expect(sql).toContain('ALTER TABLE toko_assignment ADD COLUMN IF NOT EXISTS alokasi_koin')
  })
})

// ── Task 18: Atomic sesi creation ────────────────────────────
describe('Task 18 — create_sesi_tugas and update_sesi_tugas RPCs', () => {
  const sql = readMigration('20260524000001_atomic_sesi_and_rekonsiliasi.sql')

  it('create_sesi_tugas function exists', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_sesi_tugas')
  })

  it('update_sesi_tugas function exists', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION update_sesi_tugas')
  })

  it('create_sesi_tugas has manager role gate', () => {
    expect(sql).toContain("ARRAY['manager']::text[]")
  })

  it('create_sesi_tugas inserts sesi + modal + assignments', () => {
    expect(sql).toContain('INSERT INTO sesi_tugas')
    expect(sql).toContain('INSERT INTO modal_koin')
    expect(sql).toContain('INSERT INTO toko_assignment')
  })

  it('update_sesi_tugas deletes old assignments before re-inserting', () => {
    expect(sql).toContain('DELETE FROM toko_assignment WHERE sesi_tugas_id = p_sesi_id')
  })
})

// ── Task 19: Atomic rekonsiliasi ─────────────────────────────
describe('Task 19 — submit_rekonsiliasi RPC', () => {
  const sql = readMigration('20260524000001_atomic_sesi_and_rekonsiliasi.sql')

  it('submit_rekonsiliasi function exists', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION submit_rekonsiliasi')
  })

  it('validates sesi belongs to caller', () => {
    expect(sql).toContain('kasir_id = auth.uid()')
  })

  it('validates sesi status is active', () => {
    expect(sql).toContain("status = 'active'")
  })

  it('updates sesi to pending_close atomically', () => {
    expect(sql).toContain("UPDATE sesi_tugas SET status = 'pending_close'")
  })

  it('inserts rekonsiliasi with is_balanced field', () => {
    expect(sql).toContain('is_balanced')
  })
})

// ── Task 27: Singleton constraint ────────────────────────────
describe('Task 27 — stok_gudang singleton constraint', () => {
  const sql = readMigration('20260524000006_schema_drift_and_singleton.sql')

  it('creates unique index to enforce singleton', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS stok_gudang_singleton')
    expect(sql).toContain('ON stok_gudang ((true))')
  })
})

// ── Generated Columns Fix ────────────────────────────────────
describe('Generated Columns Fix migration', () => {
  const sql = readMigration('20260525100000_fix_stok_gudang_total_nilai.sql')

  it('drops and recreates stok_gudang.total_nilai without multipliers', () => {
    expect(sql).toContain('ALTER TABLE public.stok_gudang DROP COLUMN IF EXISTS total_nilai')
    expect(sql).toContain('uang_50000 + uang_100000')
    expect(sql).not.toContain('koin_100*100')
  })

  it('drops and recreates modal_koin.total_nilai without multipliers', () => {
    expect(sql).toContain('ALTER TABLE public.modal_koin DROP COLUMN IF EXISTS total_nilai')
    expect(sql).toContain('koin_10000 + koin_20000')
    expect(sql).not.toContain('koin_100*100')
  })
})

