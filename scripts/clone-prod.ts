import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'
import readline from 'readline'

// --- Env Parser Helper ---
function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8')
    const env: Record<string, string> = {}
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const parts = trimmed.split('=')
      const key = parts[0].trim()
      const val = parts.slice(1).join('=').trim()
      const unquoted = val.replace(/^['"]|['"]$/g, '')
      env[key] = unquoted
    })
    return env
  } catch (e) {
    return {}
  }
}

// Load env files
const envProd = loadEnvFile(resolve(process.cwd(), '.env.production'))
const envLocal = loadEnvFile(resolve(process.cwd(), '.env.local'))

const PROD_URL = envProd.VITE_SUPABASE_URL
const PROD_KEY = envProd.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const LOCAL_URL = envLocal.VITE_SUPABASE_URL || 'http://127.0.0.1:54421'
const LOCAL_KEY = envLocal.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!PROD_URL || !PROD_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env.production')
  process.exit(1)
}

if (!LOCAL_KEY || LOCAL_KEY === 'local-service-role-key-placeholder') {
  console.error('❌ Error: VITE_SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Please start local supabase first.')
  process.exit(1)
}

const prodClient = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } })

// Helper for SQL values formatting
function formatSqlVal(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return val.toString()
  if (Array.isArray(val)) {
    const items = val.map(item => {
      const s = typeof item === 'string' ? item : JSON.stringify(item)
      return `'${s.replace(/'/g, "''")}'`
    })
    return `ARRAY[${items.join(', ')}]::text[]`
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
  }
  return `'${val.toString().replace(/'/g, "''")}'`
}

async function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function run() {
  console.log('🔌 Connecting to production Supabase...')
  console.log(`   Source: ${PROD_URL}`)
  console.log(`   Target: ${LOCAL_URL}\n`)

  const confirmed = await askConfirmation('⚠️  This will replace all local database data. Continue? (y/n): ')
  if (!confirmed) {
    console.log('❌ Clone cancelled.')
    process.exit(0)
  }

  console.log('\n📥 Fetching production users...')
  let authUsers: any[] = []
  let page = 1
  while (true) {
    const { data, error } = await prodClient.auth.admin.listUsers({ page, perPage: 100 })
    if (error) {
      console.error(`❌ Failed to fetch auth users: ${error.message}`)
      process.exit(1)
    }
    if (!data || data.users.length === 0) break
    authUsers = authUsers.concat(data.users)
    if (data.users.length < 100) break
    page++
  }
  console.log(`   Fetched ${authUsers.length} auth users.`)

  // Define database tables in correct dependency order
  const tables = [
    'users',
    'mobil',
    'toko',
    'sesi_tugas',
    'modal_koin',
    'toko_assignment',
    'transaksi',
    'rekonsiliasi',
    'stok_gudang',
    'stok_gudang_log'
  ]

  const tableData: Record<string, any[]> = {}
  for (const table of tables) {
    console.log(`📥 Fetching table "${table}"...`)
    let results: any[] = []
    let from = 0
    const pageSize = 50 // smaller page size to prevent timeout on tables with large base64 signature/photo data
    while (true) {
      const { data, error } = await prodClient
        .from(table)
        .select('*')
        .range(from, from + pageSize - 1)
        .order('id', { ascending: true })

      if (error) {
        console.error(`❌ Failed to fetch table "${table}" at range ${from}-${from + pageSize - 1}: ${error.message}`)
        process.exit(1)
      }
      if (!data || data.length === 0) break
      results = results.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    tableData[table] = results
    console.log(`   Fetched ${tableData[table].length} rows.`)
  }

  console.log('\n🔏 Anonymizing data...')

  // User index mapping for anonymization
  const userUuidToIndex = new Map<string, number>()
  let userCounter = 0
  const getUserIndex = (uuid: string) => {
    if (!uuid) return 0
    if (!userUuidToIndex.has(uuid)) {
      userCounter++
      userUuidToIndex.set(uuid, userCounter)
    }
    return userUuidToIndex.get(uuid)!
  }

  // Pre-seed indexes for known auth users
  authUsers.forEach(u => getUserIndex(u.id))

  const sqlStatements: string[] = []

  // Clean local tables
  sqlStatements.push('BEGIN;')
  sqlStatements.push(`TRUNCATE TABLE ${tables.map(t => `public.${t}`).join(', ')} CASCADE;`)
  sqlStatements.push('DELETE FROM auth.users;')

  // 1. Insert auth.users
  authUsers.forEach(u => {
    const idx = getUserIndex(u.id)
    // Extract real NIK from metadata or email prefix (fallback)
    const realNik = u.user_metadata?.nik || u.email?.split('@')[0] || `user_${idx}`
    const anonymizedEmail = `${realNik}@coin.internal`
    const anonymizedName = `Test User ${idx}`
    const anonymizedPhone = u.phone ? `08000000${idx}` : null

    // Extract metadata
    const originalMetadata = u.user_metadata || {}
    const anonymizedMetadata = {
      ...originalMetadata,
      name: anonymizedName,
      nik: realNik
    }

    // Postgres auth.users insert
    sqlStatements.push(`
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, aud, role, phone,
        confirmation_token, email_change_token_current, email_change_token_new,
        phone_change_token, reauthentication_token, recovery_token,
        email_change, phone_change,
        created_at, updated_at
      ) VALUES (
        ${formatSqlVal(u.id)}, 
        '00000000-0000-0000-0000-000000000000',
        ${formatSqlVal(anonymizedEmail)}, 
        crypt('Admin123', gen_salt('bf')), 
        now(), 
        ${formatSqlVal(u.app_metadata || { provider: 'email', providers: ['email'] })}, 
        ${formatSqlVal(anonymizedMetadata)}, 
        'authenticated', 
        'authenticated',
        ${formatSqlVal(anonymizedPhone)},
        '', '', '', '', '', '',
        '', '',
        ${formatSqlVal(u.created_at)}, 
        ${formatSqlVal(u.updated_at)}
      );
    `)
  })

  // 2. Public.users
  tableData['users'].forEach(u => {
    const idx = getUserIndex(u.id)
    const anonymizedName = `Test User ${idx}`
    const realNik = u.nik // Keep NIK as is!

    sqlStatements.push(`
      INSERT INTO public.users (id, nik, name, role, is_active, created_at)
      VALUES (
        ${formatSqlVal(u.id)},
        ${formatSqlVal(realNik)},
        ${formatSqlVal(anonymizedName)},
        ${formatSqlVal(u.role)},
        ${formatSqlVal(u.is_active)},
        ${formatSqlVal(u.created_at)}
      ) ON CONFLICT (id) DO UPDATE 
      SET nik = EXCLUDED.nik, name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
    `)
  })

  // 3. Mobil (No sensitive data except maybe nopol but it's not personal identifiable to human names directly, we keep it or can keep as is)
  tableData['mobil'].forEach(m => {
    sqlStatements.push(`
      INSERT INTO public.mobil (id, nopol, is_active, created_at)
      VALUES (
        ${formatSqlVal(m.id)},
        ${formatSqlVal(m.nopol)},
        ${formatSqlVal(m.is_active)},
        ${formatSqlVal(m.created_at)}
      );
    `)
  })

  // 4. Toko
  let tokoCounter = 0
  tableData['toko'].forEach(t => {
    tokoCounter++
    const anonymizedAlamat = `Jl. Test Jombang No. ${tokoCounter}`
    sqlStatements.push(`
      INSERT INTO public.toko (id, kode_toko, nama_toko, alamat, area, "as", am, is_active, created_at)
      VALUES (
        ${formatSqlVal(t.id)},
        ${formatSqlVal(t.kode_toko)},
        ${formatSqlVal(t.nama_toko)},
        ${formatSqlVal(anonymizedAlamat)},
        ${formatSqlVal(t.area)},
        ${formatSqlVal(t.as)},
        ${formatSqlVal(t.am)},
        ${formatSqlVal(t.is_active)},
        ${formatSqlVal(t.created_at)}
      );
    `)
  })

  // 5. Sesi Tugas
  let sesiCounter = 0
  tableData['sesi_tugas'].forEach(s => {
    sesiCounter++
    const anonymizedPolisi = `Polisi Test ${sesiCounter}`
    sqlStatements.push(`
      INSERT INTO public.sesi_tugas (
        id, tanggal, mobil_id, kasir_id, driver_id, nama_polisi, status, 
        approved_by, approved_at, catatan_approval, closed_by, closed_at, catatan_close,
        created_by, created_at
      ) VALUES (
        ${formatSqlVal(s.id)},
        ${formatSqlVal(s.tanggal)},
        ${formatSqlVal(s.mobil_id)},
        ${formatSqlVal(s.kasir_id)},
        ${formatSqlVal(s.driver_id)},
        ${formatSqlVal(anonymizedPolisi)},
        ${formatSqlVal(s.status)},
        ${formatSqlVal(s.approved_by)},
        ${formatSqlVal(s.approved_at)},
        ${s.catatan_approval ? formatSqlVal(`Catatan Approval ${sesiCounter}`) : 'NULL'},
        ${formatSqlVal(s.closed_by)},
        ${formatSqlVal(s.closed_at)},
        ${s.catatan_close ? formatSqlVal(`Catatan Close ${sesiCounter}`) : 'NULL'},
        ${formatSqlVal(s.created_by)},
        ${formatSqlVal(s.created_at)}
      );
    `)
  })

  // 6. Modal Koin
  tableData['modal_koin'].forEach(m => {
    sqlStatements.push(`
      INSERT INTO public.modal_koin (
        id, sesi_tugas_id, koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000, koin_10000, koin_20000
      ) VALUES (
        ${formatSqlVal(m.id)},
        ${formatSqlVal(m.sesi_tugas_id)},
        ${formatSqlVal(m.koin_100)},
        ${formatSqlVal(m.koin_200)},
        ${formatSqlVal(m.koin_500)},
        ${formatSqlVal(m.koin_1000)},
        ${formatSqlVal(m.koin_2000)},
        ${formatSqlVal(m.koin_5000)},
        ${formatSqlVal(m.koin_10000)},
        ${formatSqlVal(m.koin_20000)}
      );
    `)
  })

  // 7. Toko Assignment
  tableData['toko_assignment'].forEach(a => {
    sqlStatements.push(`
      INSERT INTO public.toko_assignment (id, sesi_tugas_id, toko_id, urutan, status, alasan_skip, updated_at)
      VALUES (
        ${formatSqlVal(a.id)},
        ${formatSqlVal(a.sesi_tugas_id)},
        ${formatSqlVal(a.toko_id)},
        ${formatSqlVal(a.urutan)},
        ${formatSqlVal(a.status)},
        ${formatSqlVal(a.alasan_skip)},
        ${formatSqlVal(a.updated_at)}
      );
    `)
  })

  // 8. Transaksi
  let trxCounter = 0
  tableData['transaksi'].forEach(t => {
    trxCounter++
    const anonymizedPic = `PIC Test ${trxCounter}`
    const anonymizedJabatan = t.pic_jabatan ? `Jabatan Test ${trxCounter}` : null
    const dummySignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const dummyFoto = 'https://example.com/dummy_serah_terima.jpg'

    sqlStatements.push(`
      INSERT INTO public.transaksi (
        id, sesi_tugas_id, toko_id, kasir_id, tanggal_waktu,
        koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000, koin_10000, koin_20000,
        total_koin_nilai, uang_50000, uang_100000, total_uang_diterima, selisih,
        pic_nama, pic_jabatan, foto_serah_terima, ttd_pic_toko, ttd_kasir, status, jenis, created_at
      ) VALUES (
        ${formatSqlVal(t.id)},
        ${formatSqlVal(t.sesi_tugas_id)},
        ${formatSqlVal(t.toko_id)},
        ${formatSqlVal(t.kasir_id)},
        ${formatSqlVal(t.tanggal_waktu)},
        ${formatSqlVal(t.koin_100)},
        ${formatSqlVal(t.koin_200)},
        ${formatSqlVal(t.koin_500)},
        ${formatSqlVal(t.koin_1000)},
        ${formatSqlVal(t.koin_2000)},
        ${formatSqlVal(t.koin_5000)},
        ${formatSqlVal(t.koin_10000)},
        ${formatSqlVal(t.koin_20000)},
        ${formatSqlVal(t.total_koin_nilai)},
        ${formatSqlVal(t.uang_50000)},
        ${formatSqlVal(t.uang_100000)},
        ${formatSqlVal(t.total_uang_diterima)},
        ${formatSqlVal(t.selisih)},
        ${formatSqlVal(anonymizedPic)},
        ${formatSqlVal(anonymizedJabatan)},
        ${t.foto_serah_terima ? formatSqlVal(dummyFoto) : 'NULL'},
        ${t.ttd_pic_toko ? formatSqlVal(dummySignature) : 'NULL'},
        ${t.ttd_kasir ? formatSqlVal(dummySignature) : 'NULL'},
        ${formatSqlVal(t.status)},
        ${formatSqlVal(t.jenis)},
        ${formatSqlVal(t.created_at)}
      );
    `)
  })

  // 9. Rekonsiliasi
  let rekonCounter = 0
  tableData['rekonsiliasi'].forEach(r => {
    rekonCounter++
    const dummySignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const dummyFoto = 'https://example.com/dummy_sisa.jpg'

    sqlStatements.push(`
      INSERT INTO public.rekonsiliasi (
        id, sesi_tugas_id, kasir_id,
        sisa_koin_100, sisa_koin_200, sisa_koin_500, sisa_koin_1000, sisa_koin_2000, sisa_koin_5000, sisa_koin_10000, sisa_koin_20000,
        sisa_koin_nilai, total_koin_keluar, total_uang_masuk, uang_setoran, expected_sisa_koin, selisih_koin, selisih_uang,
        is_balanced, foto_sisa, ttd_kasir, catatan, submitted_at
      ) VALUES (
        ${formatSqlVal(r.id)},
        ${formatSqlVal(r.sesi_tugas_id)},
        ${formatSqlVal(r.kasir_id)},
        ${formatSqlVal(r.sisa_koin_100)},
        ${formatSqlVal(r.sisa_koin_200)},
        ${formatSqlVal(r.sisa_koin_500)},
        ${formatSqlVal(r.sisa_koin_1000)},
        ${formatSqlVal(r.sisa_koin_2000)},
        ${formatSqlVal(r.sisa_koin_5000)},
        ${formatSqlVal(r.sisa_koin_10000)},
        ${formatSqlVal(r.sisa_koin_20000)},
        ${formatSqlVal(r.sisa_koin_nilai)},
        ${formatSqlVal(r.total_koin_keluar)},
        ${formatSqlVal(r.total_uang_masuk)},
        ${formatSqlVal(r.uang_setoran)},
        ${formatSqlVal(r.expected_sisa_koin)},
        ${formatSqlVal(r.selisih_koin)},
        ${formatSqlVal(r.selisih_uang)},
        ${formatSqlVal(r.is_balanced)},
        ${r.foto_sisa ? formatSqlVal(dummyFoto) : 'NULL'},
        ${r.ttd_kasir ? formatSqlVal(dummySignature) : 'NULL'},
        ${r.catatan ? formatSqlVal(`Catatan Rekon ${rekonCounter}`) : 'NULL'},
        ${formatSqlVal(r.submitted_at)}
      );
    `)
  })

  // 10. Stok Gudang (only 1 row)
  tableData['stok_gudang'].forEach(sg => {
    sqlStatements.push(`
      INSERT INTO public.stok_gudang (id, koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000, koin_10000, koin_20000, uang_50000, uang_100000, last_updated, updated_by)
      VALUES (
        ${formatSqlVal(sg.id)},
        ${formatSqlVal(sg.koin_100)},
        ${formatSqlVal(sg.koin_200)},
        ${formatSqlVal(sg.koin_500)},
        ${formatSqlVal(sg.koin_1000)},
        ${formatSqlVal(sg.koin_2000)},
        ${formatSqlVal(sg.koin_5000)},
        ${formatSqlVal(sg.koin_10000)},
        ${formatSqlVal(sg.koin_20000)},
        ${formatSqlVal(sg.uang_50000)},
        ${formatSqlVal(sg.uang_100000)},
        ${formatSqlVal(sg.last_updated)},
        ${formatSqlVal(sg.updated_by)}
      ) ON CONFLICT DO NOTHING;
    `)
  })

  // 11. Stok Gudang Log
  let logCounter = 0
  tableData['stok_gudang_log'].forEach(l => {
    logCounter++
    sqlStatements.push(`
      INSERT INTO public.stok_gudang_log (
        id, tanggal, tipe, keterangan, sesi_tugas_id,
        delta_100, delta_200, delta_500, delta_1000, delta_2000, delta_5000, delta_10000, delta_20000, delta_total,
        delta_uang_50000, delta_uang_100000, created_by, created_at
      ) VALUES (
        ${formatSqlVal(l.id)},
        ${formatSqlVal(l.tanggal)},
        ${formatSqlVal(l.tipe)},
        ${l.keterangan ? formatSqlVal(`Log Keterangan ${logCounter}`) : 'NULL'},
        ${formatSqlVal(l.sesi_tugas_id)},
        ${formatSqlVal(l.delta_100)},
        ${formatSqlVal(l.delta_200)},
        ${formatSqlVal(l.delta_500)},
        ${formatSqlVal(l.delta_1000)},
        ${formatSqlVal(l.delta_2000)},
        ${formatSqlVal(l.delta_5000)},
        ${formatSqlVal(l.delta_10000)},
        ${formatSqlVal(l.delta_20000)},
        ${formatSqlVal(l.delta_total)},
        ${formatSqlVal(l.delta_uang_50000)},
        ${formatSqlVal(l.delta_uang_100000)},
        ${formatSqlVal(l.created_by)},
        ${formatSqlVal(l.created_at)}
      );
    `)
  })

  sqlStatements.push('COMMIT;')

  // Write SQL script to temp file
  const tempDir = resolve(process.cwd(), 'supabase', '.temp')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }
  const tempSqlFile = resolve(tempDir, 'clone.sql')
  writeFileSync(tempSqlFile, sqlStatements.join('\n'), 'utf-8')

  console.log('\n🚀 Uploading data to local Supabase...')
  try {
    let usePsql = false
    try {
      execSync('psql --version', { stdio: 'ignore' })
      usePsql = true
    } catch (e) {
      usePsql = false
    }

    if (usePsql) {
      console.log('   Using psql for fast direct import...')
      const dbUrl = envLocal.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'
      execSync(`psql -d "${dbUrl}" -f "${tempSqlFile}"`, { stdio: 'inherit' })
    } else {
      console.log('   psql not found. Executing statements one-by-one via Supabase CLI (this might take a moment)...')
      const fileContent = readFileSync(tempSqlFile, 'utf-8')
      // Simple parse to extract individual statements
      const queries = fileContent
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q !== 'BEGIN' && q !== 'COMMIT')

      for (const query of queries) {
        try {
          execSync(`npx supabase db query ${formatSqlVal(query)}`, { stdio: 'ignore' })
        } catch (err: any) {
          console.error(`   ⚠️ Failed to run statement: ${query.substring(0, 80)}...`)
          console.error(`     Reason: ${err.message}`)
        }
      }
    }
    console.log('\n✨ Data successfully cloned and anonymized to local database!')

    // Print summary
    console.log('\n📋 Clone Summary (Rows successfully written):')
    console.log('─'.repeat(45))
    console.log(`  auth.users       : ${authUsers.length}`)
    tables.forEach(table => {
      console.log(`  ${table.padEnd(17)}: ${tableData[table].length}`)
    })
    console.log('─'.repeat(45))
  } catch (error: any) {
    console.error(`\n❌ Error: Failed to execute SQL queries on local database. Make sure local supabase is running.`)
    console.error(error.message)
  } finally {
    // Clean up temporary sql file
    if (existsSync(tempSqlFile)) {
      unlinkSync(tempSqlFile)
    }
  }
}

run().catch(err => {
  console.error('\n❌ Script execution failed:', err)
  process.exit(1)
})
