/**
 * seed.js — Seed script untuk membuat akun test dan data master
 * Jalankan: node supabase/seed.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://spipfjpeldvxxozhwdhl.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaXBmanBlbGR2eHhvemh3ZGhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk3ODQ3MiwiZXhwIjoyMDk0NTU0NDcyfQ.z95vO9biJbabbnfY74PnAVoOYp54UgW6qLGd8UAjkAs'

const admin  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── Akun test yang akan dibuat ─────────────────────────────
const USERS = [
  { nik: '1000000000000001', name: 'Ahmad Fauzi (Admin)',   role: 'admin',   password: 'Admin123!' },
  { nik: '2000000000000001', name: 'Budi Santoso (Manager)',role: 'manager', password: 'Manager123!' },
  { nik: '3000000000000001', name: 'Citra Dewi (Kasir)',    role: 'kasir',   password: 'Kasir123!' },
  { nik: '4000000000000001', name: 'Dodi Ramadan (Driver)', role: 'driver',  password: 'Driver123!' },
]

// ── Master Toko ─────────────────────────────────────────────
const TOKO = [
  { kode_toko: 'IDFM-001', nama_toko: 'Indomaret Jl. Merdeka',     area: 'Jombang Kota', alamat: 'Jl. Merdeka No. 12, Jombang' },
  { kode_toko: 'IDFM-002', nama_toko: 'Indomaret Jl. Sudirman',    area: 'Jombang Kota', alamat: 'Jl. Sudirman No. 45, Jombang' },
  { kode_toko: 'IDFM-003', nama_toko: 'Indomaret Perum Bhayangkara',area: 'Peterongan',   alamat: 'Perum Bhayangkara Blok B, Jombang' },
  { kode_toko: 'IDFM-004', nama_toko: 'Indomaret Ploso',           area: 'Ploso',        alamat: 'Jl. Raya Ploso No. 8, Jombang' },
  { kode_toko: 'IDFM-005', nama_toko: 'Indomaret Mojoagung',       area: 'Mojoagung',    alamat: 'Jl. Raya Mojoagung No. 22, Jombang' },
]

// ── Master Mobil ────────────────────────────────────────────
const MOBIL = [
  { nopol: 'S 1234 AB' },
  { nopol: 'S 5678 CD' },
]

async function createUser({ nik, name, role, password }) {
  const email = `${nik}@coin.internal`

  // Check if auth user already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  const exists = existing?.users?.find(u => u.email === email)

  let uid
  if (exists) {
    console.log(`  ⚠️  Auth user already exists: ${email}`)
    uid = exists.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`Auth createUser failed for ${nik}: ${error.message}`)
    uid = data.user.id
  }

  // Upsert into public.users
  const { error: dbErr } = await admin
    .from('users')
    .upsert({ id: uid, nik, name, role }, { onConflict: 'nik' })
  if (dbErr) throw new Error(`DB upsert failed for ${nik}: ${dbErr.message}`)

  console.log(`  ✅ ${role.padEnd(9)} | ${nik} | ${name}`)
  return uid
}

async function main() {
  console.log('\n🚀 Seed: Sistem Manajemen Tukar Koin\n')

  // 1. Create users
  console.log('👤 Membuat akun test...')
  for (const u of USERS) {
    await createUser(u)
  }

  // 2. Seed toko
  console.log('\n🏪 Menambahkan master toko...')
  const { error: tokoErr } = await admin
    .from('toko')
    .upsert(TOKO, { onConflict: 'kode_toko' })
  if (tokoErr) console.error('  ❌ Toko error:', tokoErr.message)
  else console.log(`  ✅ ${TOKO.length} toko ditambahkan`)

  // 3. Seed mobil
  console.log('\n🚗 Menambahkan master mobil...')
  const { error: mobilErr } = await admin
    .from('mobil')
    .upsert(MOBIL, { onConflict: 'nopol' })
  if (mobilErr) console.error('  ❌ Mobil error:', mobilErr.message)
  else console.log(`  ✅ ${MOBIL.length} mobil ditambahkan`)

  // 4. Verify stok gudang row exists
  console.log('\n📦 Memverifikasi stok gudang...')
  const { data: stok, error: stokErr } = await admin.from('stok_gudang').select('id').maybeSingle()
  if (!stok) {
    await admin.from('stok_gudang').insert({
      koin_100:0, koin_200:0, koin_500:0, koin_1000:0,
      koin_2000:0, koin_5000:0, koin_10000:0, koin_20000:0
    })
    console.log('  ✅ Stok gudang row created')
  } else {
    console.log('  ✅ Stok gudang row already exists')
  }

  console.log('\n✨ Seed selesai!\n')
  console.log('📋 Akun login:')
  console.log('─'.repeat(55))
  console.log('  Role       NIK                Password')
  console.log('─'.repeat(55))
  console.log('  superadmin 0000000000000001   SuperAdmin123!')
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(10)} ${u.nik}   ${u.password}`)
  }
  console.log('─'.repeat(55))
  console.log()
}

main().catch(err => {
  console.error('\n❌ Seed gagal:', err.message)
  process.exit(1)
})
