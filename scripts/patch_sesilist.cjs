const fs = require('fs');
const file = 'src/pages/dashboard/sesi/SesiList.jsx';
let content = fs.readFileSync(file, 'utf8');

// roles.includes('admin') to roles.includes('manager')
content = content.replace(
  /\{roles\.includes\('admin'\) && \(\s*<Button onClick=\{\(\) => navigate\('\/dashboard\/sesi\/buat'\)\} id="buat-sesi-btn">\s*<Plus size=\{16\} \/> Buat Sesi\s*<\/Button>\s*\)\}/,
  `{roles.includes('manager') && (
             <Button onClick={() => navigate('/dashboard/sesi/buat')} id="buat-sesi-btn">
               <Plus size={16} /> Buat Sesi
             </Button>
           )}`
);

fs.writeFileSync(file, content);
console.log('SesiList.jsx patched');
