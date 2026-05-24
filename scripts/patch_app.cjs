const fs = require('fs');
const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// Change /dashboard/sesi/buat and /dashboard/sesi/edit/:editId to allowedRoles={['manager']}
content = content.replace(
  /<Route path="\/dashboard\/sesi\/buat" element=\{\s*<ProtectedRoute allowedRoles=\{\['admin'\]\}>\s*<BuatSesi \/>\s*<\/ProtectedRoute>\s*\} \/>/,
  `<Route path="/dashboard/sesi/buat" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <BuatSesi />
            </ProtectedRoute>
          } />`
);

content = content.replace(
  /<Route path="\/dashboard\/sesi\/edit\/:editId" element=\{\s*<ProtectedRoute allowedRoles=\{\['admin'\]\}>\s*<BuatSesi \/>\s*<\/ProtectedRoute>\s*\} \/>/,
  `<Route path="/dashboard/sesi/edit/:editId" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <BuatSesi />
            </ProtectedRoute>
          } />`
);

fs.writeFileSync(file, content);
console.log('App.jsx patched');
