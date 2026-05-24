const fs = require('fs');
const file = 'supabase/schema.sql';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /CREATE POLICY "modal_insert" ON modal_koin FOR INSERT TO authenticated WITH CHECK \(get_my_role\(\) && ARRAY\['admin','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "modal_insert" ON modal_koin FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['manager']::text[]);`
);

content = content.replace(
  /CREATE POLICY "modal_update" ON modal_koin FOR UPDATE TO authenticated USING \(get_my_role\(\) && ARRAY\['admin','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "modal_update" ON modal_koin FOR UPDATE TO authenticated USING (get_my_role() && ARRAY['manager']::text[]);`
);

content = content.replace(
  /CREATE POLICY "assign_insert" ON toko_assignment FOR INSERT TO authenticated WITH CHECK \(get_my_role\(\) && ARRAY\['admin','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "assign_insert" ON toko_assignment FOR INSERT TO authenticated WITH CHECK (get_my_role() && ARRAY['manager']::text[]);`
);

content = content.replace(
  /CREATE POLICY "assign_delete" ON toko_assignment FOR DELETE TO authenticated USING \(get_my_role\(\) && ARRAY\['admin','superadmin'\]::text\[\]\);/g,
  `CREATE POLICY "assign_delete" ON toko_assignment FOR DELETE TO authenticated USING (get_my_role() && ARRAY['manager']::text[]);`
);

fs.writeFileSync(file, content);
console.log('Schema patched more');
