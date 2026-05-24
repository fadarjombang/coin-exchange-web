const fs = require('fs');
const file = 'src/pages/dashboard/sesi/SesiDetail.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const canEdit\s*=\s*isAdmin && status === 'draft'\s*\/\/\s*hanya admin/,
  "const canEdit       = isManager && status === 'draft'                // hanya manager"
);

content = content.replace(
  /const canEditModal\s*=\s*isAdmin && status === 'pending_approval'\s*\/\/\s*hanya admin/,
  "const canEditModal  = isManager && status === 'pending_approval'     // hanya manager"
);

fs.writeFileSync(file, content);
console.log('SesiDetail.jsx patched');
