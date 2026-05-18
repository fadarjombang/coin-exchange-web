import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { formatDate } from '@/lib/utils'
import logoImg from '../../logo.png'

export const generateSuratTugasPDF = async (sessions, setPdfLoading, toast) => {
  setPdfLoading(true)
  try {
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '794px' // A4 exact width in pixels at 96 DPI
    document.body.appendChild(container)

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]

      // Hitung bulan romawi untuk nomor surat
      const tgl = new Date(s.tanggal)
      const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
      const bulanRomawi = romawi[tgl.getMonth()]
      const tahun = tgl.getFullYear()
      const noSesiShort = s.id.slice(0, 4).toUpperCase()
      const nomorSurat = `No(${noSesiShort}/OM-JBG/${bulanRomawi}/${tahun})`

      const storeCount = s.toko_assignment?.length || 0
      const isUltraCompact = storeCount > 17
      const isCompact = storeCount > 11 && storeCount <= 17

      // Kop Surat & Header: ALWAYS stuck to the top and compact!
      const pagePadding = isUltraCompact 
        ? '15px 40px 30px 40px' 
        : (isCompact ? '15px 40px 35px 40px' : '15px 40px 40px 40px') // Always close to top
      const logoHeight = '50px' // Consistent height
      const kopMargin = '8px' // Consistent margin
      const headerMargin = '8px' // Consistent margin
      const headerTitleSize = '14px' // Consistent font size
      const headerSubtitleSize = '10.5px' // Consistent font size
      const pSize = '10.5px' // Consistent font size
      const pMargin = '8px' // Consistent margin

      const petTitleSize = '10px' // Consistent font size
      const petTableMargin = '10px' // Consistent margin
      const petFontSize = '9px' // Consistent font size
      const petPadding = '4px 5px' // Consistent padding

      // DYNAMIC: Spacing below the store table adjusts to fit or relax
      const storeFontSize = isUltraCompact ? '8px' : (isCompact ? '8.5px' : '9.5px')
      const storePaddingY = isUltraCompact ? '2.5px' : (isCompact ? '3.5px' : '4.5px')
      const storePaddingX = isUltraCompact ? '4px' : (isCompact ? '5px' : '6px')

      const fnMarginTop = isUltraCompact ? '8px' : (isCompact ? '15px' : '25px')
      const fnMarginBottom = isUltraCompact ? '5px' : (isCompact ? '10px' : '15px')
      const fnFontSize = isUltraCompact ? '8px' : (isCompact ? '8.5px' : '9.5px')

      const tagWidth = isUltraCompact ? '95px' : (isCompact ? '100px' : '110px')
      const tagImgSize = isUltraCompact ? '80px' : (isCompact ? '85px' : '95px')
      const tagPadding = isUltraCompact ? '5px' : (isCompact ? '6px' : '8px')
      const tagFontSizeName = isUltraCompact ? '7.5px' : (isCompact ? '8px' : '9px')
      const tagFontSizeNik = isUltraCompact ? '7px' : (isCompact ? '7.5px' : '8px')

      const sigHeight = isUltraCompact ? '110px' : (isCompact ? '115px' : '125px')
      const sigFontSize = isUltraCompact ? '9.5px' : (isCompact ? '10.5px' : '11.5px')
      const sigMarginTop = isUltraCompact ? '20px' : (isCompact ? '30px' : '40px')

      const pageEl = document.createElement('div')
      pageEl.style.width = '794px'
      pageEl.style.height = '1123px' // A4 exact height in pixels
      pageEl.style.padding = pagePadding
      pageEl.style.boxSizing = 'border-box'
      pageEl.style.backgroundColor = '#ffffff'
      pageEl.style.fontFamily = 'Arial, sans-serif'
      pageEl.style.position = 'relative'
      pageEl.style.display = 'flex'
      pageEl.style.flexDirection = 'column'

      // Render layout Kop Surat, Tabel 1, Tabel 2, Nametags, Signatures
      pageEl.innerHTML = `
        <!-- Kop Surat -->
        <div style="width: 100%; margin-bottom: ${kopMargin};">
          <img src="${logoImg}" style="width: 100%; height: ${logoHeight}; display: block; object-fit: fill;" />
        </div>

        <div style="text-align: center; margin-bottom: ${headerMargin};">
          <h2 style="margin: 0; font-size: ${headerTitleSize}; text-decoration: underline; letter-spacing: 0.5px; font-weight: bold; color: #000;">SURAT TUGAS</h2>
          <p style="margin: 2px 0 0 0; font-size: ${headerSubtitleSize}; font-weight: 500; color: #333;">${nomorSurat}</p>
        </div>

        <p style="margin: 0 0 ${pMargin} 0; font-size: ${pSize}; line-height: 1.35; color: #000;">
          Bersama ini kami informasikan bahwa karyawan di bawah ini bertugas untuk melakukan alokasi koin uang pecahan (UPK) di toko IDM pada tanggal <strong>${formatDate(s.tanggal)}</strong>, Dengan rincian sbb:
        </p>

        <!-- Nama Petugas Table -->
        <h3 style="margin: 0 0 4px 0; font-size: ${petTitleSize}; font-weight: bold; color: #000;">Nama Petugas</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: ${petTableMargin}; font-size: ${petFontSize}; border: 1px solid #000;">
          <thead>
            <tr style="background-color: #00a0e9; color: #fff;">
              <th style="border: 1px solid #000; padding: ${petPadding}; width: 35px; text-align: center;">NO</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: left;">NAMA PETUGAS</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: center; width: 100px;">POSISI</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: center; width: 100px;">NIK</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: center; width: 120px;">JENIS KENDARAAN</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: center; width: 100px;">NOMER POLISI KENDARAAN</th>
              <th style="border: 1px solid #000; padding: ${petPadding}; text-align: center; width: 80px;">WARNA MOBIL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; background-color: #fff;">1</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; font-weight: bold; text-transform: uppercase; background-color: #fff;">${s.driver?.name || '-'}</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; background-color: #fff;">DRIVER</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; font-family: monospace; background-color: #fff;">${s.driver?.nik || '-'}</td>
              <td rowspan="2" style="border: 1px solid #000; padding: ${petPadding}; text-align: center; font-weight: bold; text-transform: uppercase; vertical-align: middle; background-color: #fff;">${s.mobil?.jenis_kendaraan || '-'}</td>
              <td rowspan="2" style="border: 1px solid #000; padding: ${petPadding}; text-align: center; font-weight: bold; font-family: monospace; vertical-align: middle; background-color: #fff;">${s.mobil?.nopol || '-'}</td>
              <td rowspan="2" style="border: 1px solid #000; padding: ${petPadding}; text-align: center; text-transform: uppercase; vertical-align: middle; background-color: #fff;">${s.mobil?.warna_mobil || '-'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; background-color: #fff;">2</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; font-weight: bold; text-transform: uppercase; background-color: #fff;">${s.kasir?.name || '-'}</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; background-color: #fff;">COLLECTOR</td>
              <td style="border: 1px solid #000; padding: ${petPadding}; text-align: center; font-family: monospace; background-color: #fff;">${s.kasir?.nik || '-'}</td>
            </tr>
          </tbody>
        </table>

        <p style="margin: 0 0 6px 0; font-size: ${petTitleSize}; color: #000;">
          Untuk melakukan alokasi koin uang pecahan (UPK) di toko sbb:
        </p>

        <!-- Daftar Toko Table -->
        <div style="margin-bottom: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: ${storeFontSize}; border: 1px solid #000;">
            <thead>
              <tr style="background-color: #00a0e9; color: #fff;">
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; width: 30px; text-align: center;">NO</th>
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; width: 55px; text-align: center;">TOKO</th>
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: left;">NAMA TOKO</th>
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: left; width: 140px;">AS</th>
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: left; width: 140px;">AM</th>
                <th style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: right; width: 90px;">RUPIAH</th>
              </tr>
            </thead>
            <tbody>
              ${(s.toko_assignment || []).sort((a, b) => a.urutan - b.urutan).map((a, index) => `
                <tr>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: center; background-color: #fff;">${index + 1}</td>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: center; font-family: monospace; background-color: #fff;">${a.toko?.kode_toko || '-'}</td>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-transform: uppercase; background-color: #fff;">${a.toko?.nama_toko || '-'}</td>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-transform: uppercase; background-color: #fff;">${a.toko?.as || '-'}</td>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-transform: uppercase; background-color: #fff;">${a.toko?.am || '-'}</td>
                  <td style="border: 1px solid #000; padding: ${storePaddingY} ${storePaddingX}; text-align: right; font-weight: bold; background-color: #fff;">${(a.alokasi_koin || 0).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footnotes -->
        <p style="margin: ${fnMarginTop} 0 ${fnMarginBottom} 0; font-size: ${fnFontSize}; font-weight: 500; line-height: 1.25; color: #000;">
          Sehubungan dengan hal tersebut diatas Berikut ini kami sampaikan pula fotocopy nametag dari karyawan idm, yang melakukan alokasi koin uang pecahan (UPK)
        </p>
        <p style="margin: 0 0 ${fnMarginBottom} 0; font-size: ${fnFontSize}; font-weight: 500; line-height: 1.25; color: #000; text-align: justify;">
          Mohon bantuan dari bpk/ibu pemegang shift Toko Idm Ybs, Agar melakukan pengecekan kembali Identitas karyawan yang sesuai dengan nama yang tercantum di surat tugas ini dan melakukan konfirmasi ke Area Spv/jr Spv atau area Mgr/jr Mgr, yang membawahi toko ini.
        </p>
        <p style="margin: 0 0 ${fnMarginBottom} 0; font-size: ${fnFontSize}; color: #000; line-height: 1.25;">
          Demikian surat tugas ini dibuat, mohon dapat dipergunakan sebaik-baiknya. Atas bantuan dan kerjasamanya, kami ucapkan Terimakasih.
        </p>

        <!-- Nametags Section -->
        <div style="margin-top: ${isCompact ? '6px' : '10px'}; margin-bottom: ${isCompact ? '6px' : '10px'};">
          <div style="display: flex; gap: 15px;">
            <!-- Driver Nametag -->
            <div style="border: 1px solid #000; padding: ${tagPadding}; width: ${tagWidth}; display: flex; flex-direction: column; align-items: center; background-color: #fff; box-shadow: 1px 1px 3px rgba(0,0,0,0.1); border-radius: 4px;">
              <p style="margin: 0 0 2px 0; font-size: ${tagFontSizeName}; font-weight: bold; text-align: center; text-transform: uppercase; width: calc(${tagWidth} - 10px); overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${s.driver?.name || '-'}</p>
              <p style="margin: 0 0 4px 0; font-size: ${tagFontSizeNik}; font-family: monospace; text-align: center; color: #555;">${s.driver?.nik || '-'}</p>
              <div style="width: ${tagImgSize}; height: ${tagImgSize}; background-color: #eaeaea; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${s.driver?.foto_profil ? `<img src="${s.driver.foto_profil}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="font-size: ${tagFontSizeName}; color: #aaa; margin: auto;">FOTO</div>`}
              </div>
            </div>
            <!-- Collector Nametag -->
            <div style="border: 1px solid #000; padding: ${tagPadding}; width: ${tagWidth}; display: flex; flex-direction: column; align-items: center; background-color: #fff; box-shadow: 1px 1px 3px rgba(0,0,0,0.1); border-radius: 4px;">
              <p style="margin: 0 0 2px 0; font-size: ${tagFontSizeName}; font-weight: bold; text-align: center; text-transform: uppercase; width: calc(${tagWidth} - 10px); overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${s.kasir?.name || '-'}</p>
              <p style="margin: 0 0 4px 0; font-size: ${tagFontSizeNik}; font-family: monospace; text-align: center; color: #555;">${s.kasir?.nik || '-'}</p>
              <div style="width: ${tagImgSize}; height: ${tagImgSize}; background-color: #eaeaea; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${s.kasir?.foto_profil ? `<img src="${s.kasir.foto_profil}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="font-size: ${tagFontSizeName}; color: #aaa; margin: auto;">FOTO</div>`}
              </div>
            </div>
          </div>
        </div>

        <!-- Signatures Section -->
        <div style="display: flex; justify-content: space-between; margin-top: ${sigMarginTop}; font-size: ${sigFontSize}; height: ${sigHeight};">
          <!-- Left Signature: Mengetahui -->
          <div style="text-align: left; width: 250px; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #000;">Mengetahui,</p>
            </div>
            <div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline; color: #000;">BM / DBM Adm / DBM Opr</p>
            </div>
          </div>

          <!-- Right Signature: Hormat Kami -->
          <div style="text-align: right; width: 250px; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #000;">Jombang, ${formatDate(s.tanggal)}</p>
              <p style="margin: 3px 0 0 0; font-weight: bold; color: #000;">Hormat Kami,</p>
            </div>
            <div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline; color: #000;">Christo Ridel W</p>
              <p style="margin: 1.5px 0 0 0; color: #555;">Office Manager</p>
            </div>
          </div>
        </div>
      `
      container.appendChild(pageEl)

      // Render page via html2canvas
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 794,
        windowHeight: 1123
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      if (i > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297) // A4 exact width/height in mm

      container.removeChild(pageEl)
    }

    document.body.removeChild(container)

    const filename = sessions.length === 1
      ? `Surat_Tugas_${sessions[0].id.slice(0, 8)}.pdf`
      : `Surat_Tugas_Gabungan_${new Date().toISOString().slice(0, 10)}.pdf`

    pdf.save(filename)
    if (toast) toast({ title: 'Cetak Berhasil', description: 'File PDF Surat Tugas berhasil diunduh.', variant: 'success' })
  } catch (err) {
    console.error(err)
    if (toast) toast({ title: 'Cetak Gagal', description: err.message, variant: 'destructive' })
  } finally {
    setPdfLoading(false)
  }
}
