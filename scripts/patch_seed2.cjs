const fs = require('fs');
let code = fs.readFileSync('supabase/seed.js', 'utf8');
code = code.replace(/role\.padEnd/g, "role[0].padEnd");
fs.writeFileSync('supabase/seed.js', code);
