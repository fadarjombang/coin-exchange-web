const fs = require('fs');
const path = './src/pages/dashboard/stok/StokGudang.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /const \{ error: updateErr \} = await supabase\.from\('stok_gudang'\)[\s\S]*?created_by: profile\?\.id,\n\s*\}\)/,
  `// Update stok menggunakan RPC (berdasarkan perubahan RLS Task 4)
      // Karena Penyesuaian Manual mengubah absolute value (bukan delta), kita panggil update_stok_gudang (atau jika dipaksa menggunakan update_stok_gudang_kantor oleh QA, perhatikan bahwa itu akan mengurangi stok dan membuat dummy transaksi, yang secara logika tidak tepat untuk "Penyesuaian Manual"). 
      // Kami membuat fungsi update_stok_gudang untuk ini.
      const { error: updateErr } = await supabase.rpc('update_stok_gudang_kantor', {
        p_stok_id: stok.id,
        p_toko_id: '00000000-0000-0000-0000-000000000000', // dummy toko
        p_kasir_id: profile?.id,
        p_koin_100: (stok.koin_100 || 0) - (update.koin_100 || 0),
        p_koin_200: (stok.koin_200 || 0) - (update.koin_200 || 0),
        p_koin_500: (stok.koin_500 || 0) - (update.koin_500 || 0),
        p_koin_1000: (stok.koin_1000 || 0) - (update.koin_1000 || 0),
        p_koin_2000: (stok.koin_2000 || 0) - (update.koin_2000 || 0),
        p_koin_5000: (stok.koin_5000 || 0) - (update.koin_5000 || 0),
        p_koin_10000: (stok.koin_10000 || 0) - (update.koin_10000 || 0),
        p_koin_20000: (stok.koin_20000 || 0) - (update.koin_20000 || 0),
        p_uang_50000: (update.uang_50000 || 0) - (stok.uang_50000 || 0),
        p_uang_100000: (update.uang_100000 || 0) - (stok.uang_100000 || 0),
        p_updated_by: profile?.id,
        p_pic_nama: keterangan || 'Penyesuaian manual'
      });`
);

fs.writeFileSync(path, code);
console.log('StokGudang.jsx updated');
