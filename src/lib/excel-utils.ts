import * as XLSX from 'xlsx';

export interface MergedExcelData {
  headers: string[];
  rows: any[][];
}

// Common Turkish headers for TC Identification Number, case-insensitive matching with 'tr-TR' locale
const TC_KIMLIK_NO_HEADERS_TR = [
  "tc kimlik no", 
  "tckn", 
  "kimlik no", 
  "tc no", 
  "tc",
  "vatandaşlık no",
  "t.c. kimlik no"
];

export async function processAndMergeFiles(files: File[]): Promise<MergedExcelData> {
  if (files.length === 0) {
    return { headers: [], rows: [] };
  }

  let allRows: any[][] = [];
  let finalHeaders: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) continue;

    const worksheet = workbook.Sheets[firstSheetName];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (sheetData.length > 0) {
      const currentHeaders = sheetData[0].map(String); 
      if (i === 0) { 
        finalHeaders = currentHeaders;
        allRows.push(...sheetData.slice(1)); 
      } else {
        if (currentHeaders.length === finalHeaders.length && currentHeaders.every((h, idx) => h.toLocaleLowerCase('tr-TR').trim() === finalHeaders[idx].toLocaleLowerCase('tr-TR').trim())) {
          allRows.push(...sheetData.slice(1));
        } else {
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(finalHeaders.length).fill("");
            currentHeaders.forEach((header, colIndex) => {
              const finalHeaderIndex = finalHeaders.findIndex(fh => fh.toLocaleLowerCase('tr-TR').trim() === header.toLocaleLowerCase('tr-TR').trim());
              if (finalHeaderIndex !== -1) {
                newRow[finalHeaderIndex] = row[colIndex];
              }
            });
            return newRow;
          });
          allRows.push(...newRows);
          console.warn(`Dosya ${file.name} farklı bir sütun yapısına sahip olabilir. Veriler ilk dosyanın başlıklarına göre eşleştirildi.`);
        }
      }
    }
  }

  // Sort by TC Kimlik No after all files are merged
  if (finalHeaders.length > 0 && allRows.length > 0) {
    let tcKimlikNoColumnIndex = -1;
    for (let i = 0; i < finalHeaders.length; i++) {
      const headerToCheck = finalHeaders[i].toLocaleLowerCase('tr-TR').trim();
      if (TC_KIMLIK_NO_HEADERS_TR.includes(headerToCheck)) {
        tcKimlikNoColumnIndex = i;
        break;
      }
    }

    if (tcKimlikNoColumnIndex !== -1) {
      allRows.sort((rowA, rowB) => {
        const valueA = String(rowA[tcKimlikNoColumnIndex] || '');
        const valueB = String(rowB[tcKimlikNoColumnIndex] || '');
        // Use localeCompare with numeric option for proper sorting of TC numbers (strings of digits)
        // 'tr-TR' for Turkish locale specifics, 'base' sensitivity for ignoring accents for numbers.
        return valueA.localeCompare(valueB, 'tr-TR', { numeric: true, sensitivity: 'base' });
      });
    } else {
      console.warn("TC Kimlik No sütunu bulunamadı. Veriler TC Kimlik No'ya göre sıralanmayacak. Aranan başlıklar:", TC_KIMLIK_NO_HEADERS_TR.join(', '));
    }
  }

  return { headers: finalHeaders, rows: allRows };
}
