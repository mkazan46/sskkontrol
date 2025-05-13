import * as XLSX from 'xlsx';

export interface MergedExcelData {
  headers: string[];
  rows: any[][];
}

export async function processAndMergeFiles(files: File[]): Promise<MergedExcelData> {
  if (files.length === 0) {
    return { headers: [], rows: [] };
  }

  let allRows: any[][] = [];
  let finalHeaders: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    // cellDates: true seçeneği, tarih formatındaki hücrelerin JS Date nesnelerine dönüştürülmesini sağlar.
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) continue;

    const worksheet = workbook.Sheets[firstSheetName];
    // header: 1 ile veriler dizi içinde dizi olarak alınır.
    // defval: "" ile boş hücreler boş string olarak gelir.
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (sheetData.length > 0) {
      const currentHeaders = sheetData[0].map(String); // Başlıkları string yap
      if (i === 0) { 
        finalHeaders = currentHeaders;
        allRows.push(...sheetData.slice(1)); 
      } else {
        // Sonraki dosyalar için, başlık satırını atla ve veri satırlarını ekle
        // Başlık sayıları ve sıraları eşleşiyorsa doğrudan ekle
        if (currentHeaders.length === finalHeaders.length && currentHeaders.every((h, idx) => h === finalHeaders[idx])) {
          allRows.push(...sheetData.slice(1));
        } else {
          // Başlıklar farklıysa, finalHeaders'a göre eşleştirme yap
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(finalHeaders.length).fill("");
            currentHeaders.forEach((header, colIndex) => {
              const finalHeaderIndex = finalHeaders.indexOf(header);
              if (finalHeaderIndex !== -1) {
                newRow[finalHeaderIndex] = row[colIndex];
              }
            });
            return newRow;
          });
          allRows.push(...newRows);
          // Eğer ilk dosyanın başlıklarında olmayan yeni başlıklar varsa, bunları finalHeaders'a ekle (opsiyonel, mevcut durumda yapılmıyor)
          // ve mevcut satırlara boş değerler ekle. Bu, birleştirme stratejisine bağlıdır.
          // Şimdilik, ilk dosyanın başlıklarını temel alıyoruz.
          console.warn(`Dosya ${file.name} farklı bir sütun yapısına sahip olabilir. Veriler ilk dosyanın başlıklarına göre eşleştirildi.`);
        }
      }
    }
  }

  return { headers: finalHeaders, rows: allRows };
}

