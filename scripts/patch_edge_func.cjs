const fs = require('fs');
const file = 'supabase/functions/admin-user/index.ts';
let content = fs.readFileSync(file, 'utf8');

// Find:
// const managerActions = ['approve-session', 'close-session']
// 
// if (managerActions.includes(action) && !isManagerOrAdmin) {
//   return new Response(JSON.stringify({ error: 'Forbidden: manager or admin required' }), { status: 403, headers: corsHeaders })
// }

// And also replace: const isManagerOrAdmin = callerRoles.some(r => ['manager', 'admin', 'superadmin'].includes(r))
// with: const isManager = callerRoles.includes('manager')

content = content.replace(
  /const isManagerOrAdmin = callerRoles.some\(r => \['manager', 'admin', 'superadmin'\].includes\(r\)\)/g,
  "const isManager = callerRoles.includes('manager')"
);

content = content.replace(
  /if \(managerActions\.includes\(action\) && !isManagerOrAdmin\)\s*\{\s*return new Response\(JSON\.stringify\(\{ error: 'Forbidden: manager or admin required' \}\), \{ status: 403, headers: corsHeaders \}\)\s*\}/,
  `if (managerActions.includes(action) && !isManager) {
      return new Response(JSON.stringify({ error: 'Forbidden: ONLY manager required' }), { status: 403, headers: corsHeaders })
    }`
);

fs.writeFileSync(file, content);
console.log('Edge Function patched');
