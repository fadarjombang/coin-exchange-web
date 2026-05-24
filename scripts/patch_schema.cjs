const fs = require('fs');
const file = 'supabase/schema.sql';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /CREATE POLICY "sesi_insert"\s+ON sesi_tugas FOR INSERT TO authenticated\s+WITH CHECK \(get_my_role\(\) && ARRAY\['admin','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "sesi_insert"        ON sesi_tugas FOR INSERT TO authenticated
  WITH CHECK (get_my_role() && ARRAY['manager']::text[]);`
);

content = content.replace(
  /CREATE POLICY "sesi_update_admin"\s+ON sesi_tugas FOR UPDATE TO authenticated\s+USING \(get_my_role\(\) && ARRAY\['admin','manager','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "sesi_update_admin"  ON sesi_tugas FOR UPDATE TO authenticated
  USING (get_my_role() && ARRAY['manager']::text[]);`
);

fs.writeFileSync(file, content);
console.log('Schema patched');
