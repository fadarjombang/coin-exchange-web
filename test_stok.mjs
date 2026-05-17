import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://spipfjpeldvxxozhwdhl.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaXBmanBlbGR2eHhvemh3ZGhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk3ODQ3MiwiZXhwIjoyMDk0NTU0NDcyfQ.z95vO9biJbabbnfY74PnAVoOYp54UgW6qLGd8UAjkAs'
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

const DENOM_LIST = [
  { key: 'koin_100' }, { key: 'koin_200' }, { key: 'koin_500' },
  { key: 'koin_1000' }, { key: 'koin_2000' }, { key: 'koin_5000' },
  { key: 'koin_10000' }, { key: 'koin_20000' },
]
function formatRp(n) { return 'Rp ' + (n||0).toLocaleString('id-ID') }

async function main() {
  // 1. Check stok log for recent history
  const { data: log } = await supabaseAdmin.from('stok_gudang_log')
    .select('*').order('created_at', { ascending: false }).limit(10)
  
  console.log('=== STOK LOG HISTORY ===')
  if (!log?.length) {
    console.log('❌ NO LOG ENTRIES — stok_gudang_log is EMPTY!')
    console.log('   This means the approve flow never inserts log entries,')
    console.log('   but more importantly: does the STOK VALUE itself change?')
  } else {
    log.forEach(l => console.log(`  [${new Date(l.created_at).toLocaleString('id-ID')}] ${l.tipe}: ${l.keterangan}`))
  }

  // 2. Verify what the active sesi modal is vs current stok
  const { data: stok } = await supabaseAdmin.from('stok_gudang').select('*').single()
  const { data: activeSesi } = await supabaseAdmin.from('sesi_tugas')
    .select('id, status, created_at, approved_at, modal_koin(*)')
    .eq('status', 'active').single()
  
  if (activeSesi) {
    const modal = activeSesi.modal_koin
    console.log('\n=== ACTIVE SESI ANALYSIS ===')
    console.log('Sesi ID:', activeSesi.id.slice(0,8), '| Approved at:', activeSesi.approved_at)
    console.log('modal_koin is:', Array.isArray(modal) ? 'ARRAY' : (modal ? 'OBJECT' : 'NULL'))
    if (modal) {
      console.log('\nIf approve correctly deducted stok, then CURRENT stok should be:')
      DENOM_LIST.forEach(d => {
        if (stok[d.key] > 0 || modal[d.key] > 0) {
          console.log(`  ${d.key}: current=${formatRp(stok[d.key])} | modal was=${formatRp(modal[d.key])}`)
          console.log(`         → pre-approve stok should have been: ${formatRp(stok[d.key] + (modal[d.key]||0))}`)
        }
      })
    }
  }

  // 3. Simulate the EXACT approve code path manually
  console.log('\n=== MANUAL APPROVE SIMULATION ===')
  if (activeSesi?.modal_koin) {
    const modal = activeSesi.modal_koin
    const currentStok = stok
    const updates = DENOM_LIST.reduce((acc, d) => {
      acc[d.key] = Math.max(0, (currentStok[d.key] || 0) - (modal[d.key] || 0))
      return acc
    }, {})
    
    console.log('Updates to apply (if sesi was still pending):')
    DENOM_LIST.forEach(d => {
      if (updates[d.key] !== currentStok[d.key]) {
        console.log(`  ${d.key}: ${formatRp(currentStok[d.key])} → ${formatRp(updates[d.key])}`)
      }
    })
    console.log('(NOT actually applying — just simulation)')
  }

  // 4. Check all sesi with their approve timestamps 
  const { data: allSesi } = await supabaseAdmin.from('sesi_tugas')
    .select('id, status, created_at, approved_at, modal_koin(koin_100, koin_200, koin_500, koin_1000, koin_2000, koin_5000)')
    .order('created_at', { ascending: false }).limit(6)
  
  console.log('\n=== ALL SESI STATUS ===')
  allSesi?.forEach(s => {
    const modal = s.modal_koin
    const totalModal = DENOM_LIST.reduce((sum, d) => sum + (modal?.[d.key] || 0), 0)
    console.log(`  [${s.status.padEnd(18)}] approved=${s.approved_at ? 'YES' : 'NO '} | total_modal=${formatRp(totalModal)}`)
  })
}

main().catch(console.error)
