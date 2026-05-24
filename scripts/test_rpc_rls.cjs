const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Load from environment — NEVER hardcode service role key
// Create .env.local with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=...
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('❌ Missing env vars. Create .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

async function runTests() {
  console.log('--- STARTING TESTS ---');

  try {
    // 1. Check RPC update_stok_gudang
    console.log('\n--- Checking RPC update_stok_gudang ---');
    const { data: rpcData, error: rpcError } = await admin.rpc('update_stok_gudang', {
        p_stok_id: '00000000-0000-0000-0000-000000000000',
        p_koin_100: 0, p_koin_200: 0, p_koin_500: 0, p_koin_1000: 0,
        p_koin_2000: 0, p_koin_5000: 0, p_koin_10000: 0, p_koin_20000: 0,
        p_uang_50000: 0, p_uang_100000: 0,
        p_keterangan: 'Test', p_updated_by: null
    });
    console.log('update_stok_gudang RPC call result:', rpcError?.message || rpcData);

    // 2. RLS Testing
    console.log('\n--- Checking RLS Policies ---');
    // Login as kasir
    const { data: kasirAuth, error: kasirErr } = await client.auth.signInWithPassword({
        email: '3000000000000001@coin.internal', password: 'Kasir123!'
    });
    if (kasirErr) throw kasirErr;
    const kasirId = kasirAuth.user.id;
    
    // Login as admin
    const adminClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: adminAuth, error: adminErr } = await adminClient.auth.signInWithPassword({
        email: '1000000000000001@coin.internal', password: 'Admin123!'
    });
    if (adminErr) throw adminErr;
    const adminId = adminAuth.user.id;

    // A. RLS: Kasir inserting transaction for ANOTHER user (Should fail)
    console.log('\nTest: Kasir inserting transaction for ANOTHER user (Should fail)');
    const { data: trxData1, error: trxErr1 } = await client.from('transaksi').insert({
        sesi_tugas_id: '00000000-0000-0000-0000-000000000000',
        toko_id: '00000000-0000-0000-0000-000000000000',
        kasir_id: adminId, // Trying to insert as Admin
        total_koin_nilai: 100,
        total_uang_diterima: 100,
        selisih: 0,
        pic_nama: 'Test',
        status: 'submitted',
        jenis: 'field'
    });
    console.log('Result:', trxErr1 ? trxErr1.message : 'SUCCESS (Unexpected)');

    // B. RLS: Admin inserting transaction for themselves
    console.log('\nTest: Admin inserting transaction for themselves');
    const { data: trxData2, error: trxErr2 } = await adminClient.from('transaksi').insert({
        sesi_tugas_id: '00000000-0000-0000-0000-000000000000', // Still foreign key fail, but not RLS block
        toko_id: '00000000-0000-0000-0000-000000000000',
        kasir_id: adminId, 
        total_koin_nilai: 100,
        total_uang_diterima: 100,
        selisih: 0,
        pic_nama: 'Test',
        status: 'submitted',
        jenis: 'field'
    });
    console.log('Result:', trxErr2 ? trxErr2.message : 'SUCCESS');

    // C. RLS: Kasir modifying stok_gudang_log directly (Should fail)
    console.log('\nTest: Kasir inserting into stok_gudang_log directly (Should fail)');
    const { data: logData, error: logErr } = await client.from('stok_gudang_log').insert({
        tipe: 'penyesuaian',
        keterangan: 'Hacker',
        delta_total: 100
    });
    console.log('Result:', logErr ? logErr.message : 'SUCCESS (Unexpected)');

  } catch (err) {
    console.error('Test script error:', err);
  }
}

runTests();
