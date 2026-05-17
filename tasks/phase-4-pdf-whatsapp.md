# Phase 4: PDF Generation & WhatsApp Share
## Generate Berita Acara PDF & Share via WhatsApp

---

### Task 4.1: PDF Template Component
**Goal**: Create a hidden HTML template that will be converted to PDF

**Approach**: 
1. Render a hidden `<div>` with the full berita acara layout
2. Use `html2canvas` to capture it as canvas
3. Use `jsPDF` to convert canvas to PDF
4. Trigger download

**Template content**:
```
BERITA ACARA SERAH TERIMA KOIN
No: TRX-{YYYY-MM-DD}-{sequence}
Tanggal: {tanggal_waktu formatted}

DATA TOKO
  Kode  : {kode_toko}
  Nama  : {nama_toko}
  PIC   : {pic_nama} ({pic_jabatan})

DATA PETUGAS
  Kasir  : {kasir_name}
  Driver : {driver_name}
  Mobil  : {nopol}

RINCIAN KOIN DISERAHKAN
  (table: denom × keping = subtotal)
  TOTAL KOIN: Rp {total_koin_nilai}

UANG BESAR DITERIMA
  Rp 50.000  × {lembar} = Rp {subtotal}
  Rp 100.000 × {lembar} = Rp {subtotal}
  TOTAL UANG: Rp {total_uang_diterima}
  
  SELISIH: Rp 0 ✅

FOTO SERAH TERIMA
  (rendered Base64 image)

TANDA TANGAN
  [PIC Toko signature]    [Kasir signature]
  {pic_nama}              {kasir_name}
```

**Files**:
- `src/components/shared/PDFTemplate.jsx` — Hidden div with print layout
- `src/lib/pdfGenerator.js` — Utility: html2canvas → jsPDF → download

**PDF Generation function**:
```js
export async function generatePDF(elementId, filename) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.8);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
  pdf.save(filename);
}
```

---

### Task 4.2: Transaction Preview & PDF Page
**Goal**: After submitting transaction, show preview + PDF + WA share

**Page**: `/app/toko/:assignmentId/preview`

**Features**:
- Full transaction detail displayed (like the PDF but styled for screen)
- [📥 Download PDF] button → triggers generatePDF()
- [📱 Share ke WhatsApp] button → opens wa.me link
- [← Kembali ke Daftar Toko] button

**Files**:
- `src/pages/app/TransaksiPreview.jsx`

---

### Task 4.3: WhatsApp Share
**Goal**: Open WhatsApp with pre-filled message

**Implementation**:
```js
function shareToWhatsApp(transaksi, toko) {
  const text = encodeURIComponent(
    `*BERITA ACARA SERAH TERIMA KOIN*\n` +
    `Tanggal: ${formatDate(transaksi.tanggal_waktu)}\n\n` +
    `Toko: ${toko.nama_toko} (${toko.kode_toko})\n` +
    `PIC: ${transaksi.pic_nama}\n\n` +
    `Total Koin: ${formatRupiah(transaksi.total_koin_nilai)}\n` +
    `Total Uang: ${formatRupiah(transaksi.total_uang_diterima)}\n` +
    `Selisih: Rp 0 ✅\n\n` +
    `_PDF berita acara telah didownload_`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}
```

> Note: PDF file cannot be auto-attached via wa.me. User downloads PDF first, then shares text via WA, then manually attaches PDF in WA.

**Files**:
- `src/lib/whatsapp.js` — Share utility function

**Acceptance Criteria**:
- [ ] PDF generates correctly with all transaction data
- [ ] PDF includes photo and both signatures
- [ ] PDF fits on single A4 page
- [ ] Download works on mobile browser
- [ ] WhatsApp opens with formatted message
