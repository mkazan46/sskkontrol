
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
  "t.c kimlik no",
  "t.c. no",
  "tc kimlik numarası"
];

export async function processAndMergeFiles(files: File[]): Promise<MergedExcelData> {
  if (files.length === 0) {
    return { headers: [], rows: [] };
  }

  let allRows: any[][] = [];
  let finalHeaders: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let arrayBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();

    // Convert XLS to XLSX in memory if necessary
    if (fileName.endsWith('.xls')) {
      try {
        console.log(`Converting ${file.name} from XLS to XLSX format...`);
        const xlsWorkbook = XLSX.read(arrayBuffer, { type: 'array' });
        // Write the workbook to an XLSX ArrayBuffer
        // This ensures we are working with the XLSX format internally
        arrayBuffer = XLSX.write(xlsWorkbook, { bookType: 'xlsx', type: 'array' });
        console.log(`${file.name} converted to XLSX successfully.`);
      } catch (conversionError) {
        console.error(`Error converting ${file.name} from XLS to XLSX:`, conversionError);
        // Optionally, skip this file or try to process as is, though conversion failure might indicate deeper issues.
        // For now, we'll attempt to read it as is, but a more robust solution might skip.
        // Re-assign original arrayBuffer if conversion fails and we want to try original
        // arrayBuffer = await file.arrayBuffer(); // uncomment if you want to retry with original on conversion failure
        // Or simply continue to the next file:
        // continue;
      }
    }
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      console.warn(`Dosya ${file.name} için okunacak sayfa bulunamadı.`);
      continue;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (sheetData.length > 0) {
      const currentHeaders = sheetData[0].map(header => String(header || "").trim().toLocaleUpperCase('tr-TR')); 
      
      if (i === 0) { 
        finalHeaders = currentHeaders;
        allRows.push(...sheetData.slice(1)); 
      } else {
        if (currentHeaders.length === finalHeaders.length && 
            currentHeaders.every((h, idx) => h === finalHeaders[idx])) { // Already uppercased and trimmed
          allRows.push(...sheetData.slice(1));
        } else {
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(finalHeaders.length).fill(""); 
            currentHeaders.forEach((header, colIndex) => {
              const finalHeaderIndex = finalHeaders.findIndex(fh => fh === header); // Already uppercased
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

  if (finalHeaders.length > 0 && allRows.length > 0) {
    let tcKimlikNoColumnIndex = -1;
    const upperCaseTcHeaders = TC_KIMLIK_NO_HEADERS_TR.map(h => h.toLocaleUpperCase('tr-TR'));
    for (let i = 0; i < finalHeaders.length; i++) {
      // finalHeaders are already uppercased and trimmed
      if (upperCaseTcHeaders.includes(finalHeaders[i])) {
        tcKimlikNoColumnIndex = i;
        break;
      }
    }

    if (tcKimlikNoColumnIndex !== -1) {
      allRows.sort((rowA, rowB) => {
        const valueA = String(rowA[tcKimlikNoColumnIndex] || '');
        const valueB = String(rowB[tcKimlikNoColumnIndex] || '');
        return valueA.localeCompare(valueB, 'tr-TR', { numeric: true, sensitivity: 'base' });
      });
    } else {
      console.warn("TC Kimlik No sütunu bulunamadı. Veriler TC Kimlik No'ya göre sıralanmayacak. Aranan başlıklar (büyük harf):", upperCaseTcHeaders.join(', '), "Mevcut başlıklar (büyük harf):", finalHeaders.join(', '));
    }
  } else {
    if (files.length > 0) {
      console.warn("Birleştirme sonrası başlık veya satır verisi bulunamadı.");
    }
  }

  // Return original case headers for display if needed, or stick to uppercase.
  // For consistency, let's stick to the case from the first file's headers.
  // This requires storing original first file headers before uppercasing for comparison.
  // For simplicity, current implementation uses uppercased headers from the first file if it was the determiner.
  // Or, retrieve original headers from the first file again if that's desired.
  // The current finalHeaders are derived from the first file and uppercased if it was processed first.
  // To maintain original casing, we'd need to store them before this transformation.

  // For now, the headers returned will be the uppercased ones from the first file that set the standard.
  // If original casing from the *first* file is critical, we'd need to re-fetch or store them.
  // The example will proceed with `finalHeaders` as they are (uppercased from the first determining file).

  return { headers: finalHeaders, rows: allRows };
}
