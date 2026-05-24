const fs = require('fs');
const path = './src/pages/dashboard/stok/StokGudang.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /const { error: updateErr } = await supabase.from\('stok_gudang'\)[\s\S]*?created_by: profile\?\.id,\n\s*\}\)/,
  `// Memanggil RPC sesuai perbaikan atomic transactions dan RLS
      const { error: updateErr } = await supabase.rpc('update_stok_gudang', {
        p_stok_id: stok.id,
        p_koin_100: update.koin_100 || 0,
        p_koin_200: update.koin_200 || 0,
        p_koin_500: update.koin_500 || 0,
        p_koin_1000: update.koin_1000 || 0,
        p_koin_2000: update.koin_2000 || 0,
        p_koin_5000: update.koin_5000 || 0,
        p_koin_10000: update.koin_10000 || 0,
        p_koin_20000: update.koin_20000 || 0,
        p_uang_50000: update.uang_50000 || 0,
        p_uang_100000: update.uang_100000 || 0,
        p_keterangan: keterangan || 'Penyesuaian manual',
        p_updated_by: profile?.id
      });
      if (updateErr) throw updateErr;`
);

fs.writeFileSync(path, code);
console.log('StokGudang.jsx updated');
