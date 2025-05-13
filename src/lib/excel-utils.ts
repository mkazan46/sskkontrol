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
  "t.c. kimlik no",
  "t.c kimlik no", // Added variation
  "t.c. no",
  "tc kimlik numarası" // Added variation
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
    // Attempt to read with cellDates: true. If specific encoding issues arise with files,
    // one might experiment with opts.codepage here, e.g., { codepage: 1254 } for Turkish Windows ANSI.
    // However, this is usually not needed for modern .xlsx files which are UTF-8.
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      console.warn(`Dosya ${file.name} için okunacak sayfa bulunamadı.`);
      continue;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    // Ensure defval is an empty string to prevent "undefined" strings.
    // Raw values are not typically needed if cellDates is true.
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (sheetData.length > 0) {
      // Ensure all headers are treated as strings and trimmed.
      const currentHeaders = sheetData[0].map(header => String(header || "").trim()); 
      
      if (i === 0) { 
        finalHeaders = currentHeaders;
        // Process rows, ensuring all cell data is converted to string initially for uniformity if needed,
        // or handle types appropriately in MergedDataTable. For now, keep as is from sheet_to_json.
        allRows.push(...sheetData.slice(1)); 
      } else {
        // Compare headers using Turkish locale.
        if (currentHeaders.length === finalHeaders.length && 
            currentHeaders.every((h, idx) => h.toLocaleLowerCase('tr-TR') === finalHeaders[idx].toLocaleLowerCase('tr-TR'))) {
          allRows.push(...sheetData.slice(1));
        } else {
          // Column structures differ; attempt to map data.
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(finalHeaders.length).fill(""); // Default to empty string
            currentHeaders.forEach((header, colIndex) => {
              const finalHeaderIndex = finalHeaders.findIndex(fh => fh.toLocaleLowerCase('tr-TR') === header.toLocaleLowerCase('tr-TR'));
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
    } else {
      console.warn(`Dosya ${file.name} boş veya veri içermiyor.`);
    }
  }

  // Sort by TC Kimlik No after all files are merged
  if (finalHeaders.length > 0 && allRows.length > 0) {
    let tcKimlikNoColumnIndex = -1;
    for (let i = 0; i < finalHeaders.length; i++) {
      const headerToCheck = finalHeaders[i].toLocaleLowerCase('tr-TR'); // Already trimmed
      if (TC_KIMLIK_NO_HEADERS_TR.includes(headerToCheck)) {
        tcKimlikNoColumnIndex = i;
        break;
      }
    }

    if (tcKimlikNoColumnIndex !== -1) {
      allRows.sort((rowA, rowB) => {
        // Ensure values are treated as strings for localeCompare.
        const valueA = String(rowA[tcKimlikNoColumnIndex] || '');
        const valueB = String(rowB[tcKimlikNoColumnIndex] || '');
        return valueA.localeCompare(valueB, 'tr-TR', { numeric: true, sensitivity: 'base' });
      });
    } else {
      console.warn("TC Kimlik No sütunu bulunamadı. Veriler TC Kimlik No'ya göre sıralanmayacak. Aranan başlıklar:", TC_KIMLIK_NO_HEADERS_TR.join(', '), "Mevcut başlıklar:", finalHeaders.join(', '));
    }
  } else {
    if (files.length > 0) {
      console.warn("Birleştirme sonrası başlık veya satır verisi bulunamadı.");
    }
  }

  return { headers: finalHeaders, rows: allRows };
}
