const fs = require('fs');
let code = fs.readFileSync('supabase/seed.js', 'utf8');
code = code.replace(/role: 'admin'/g, "role: ['admin']");
code = code.replace(/role: 'manager'/g, "role: ['manager']");
code = code.replace(/role: 'kasir'/g, "role: ['kasir']");
code = code.replace(/role: 'driver'/g, "role: ['driver']");
fs.writeFileSync('supabase/seed.js', code);
