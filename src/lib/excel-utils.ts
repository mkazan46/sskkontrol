
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
  let firstFileHeadersOriginalCase: string[] = []; // Store original case from the first file for final output

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let fileBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let currentWorkbook;

    try {
      if (fileName.endsWith('.xls')) {
        console.log(`Processing XLS file: ${file.name}. Attempting to read with codepage 1254 and convert to XLSX.`);
        // Read XLS with specified codepage
        const xlsWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, codepage: 1254 });
        // Convert to XLSX in memory (XLSX is UTF-8 based)
        const xlsxBuffer = XLSX.write(xlsWorkbook, { bookType: 'xlsx', type: 'array' });
        console.log(`${file.name} converted to XLSX format. Reading the converted XLSX.`);
        // Read the converted XLSX (which should be UTF-8 based, codepage option usually ignored for XLSX)
        currentWorkbook = XLSX.read(xlsxBuffer, { type: 'array', cellDates: true });
      } else {
        // For .xlsx, .csv, .ods
        // For XLSX/ODS, codepage is generally ignored (they are XML/UTF-8).
        // For CSV, codepage: 1254 might help if it's Windows-1254 encoded.
        console.log(`Processing file: ${file.name}. Attempting to read with codepage 1254 (if applicable for format).`);
        currentWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, codepage: 1254 });
      }
    } catch (error) {
      console.error(`Error processing file ${file.name} with specified codepage:`, error);
      // Fallback: Attempt to read the file with default codepage detection.
      // This is useful if the codepage 1254 assumption was incorrect or caused an issue.
      try {
        console.warn(`Fallback: Attempting to read ${file.name} with default codepage detection.`);
        fileBuffer = await file.arrayBuffer(); // Re-fetch original buffer, as it might have been overwritten
        currentWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
      } catch (fallbackError) {
         console.error(`Error in fallback reading of ${file.name}:`, fallbackError);
         continue; // Skip this file if all attempts fail
      }
    }
    
    if (!currentWorkbook) {
        console.warn(`Workbook could not be created for ${file.name}. Skipping.`);
        continue;
    }

    const firstSheetName = currentWorkbook.SheetNames[0];
    if (!firstSheetName) {
      console.warn(`File ${file.name} contains no sheets to read.`);
      continue;
    }

    const worksheet = currentWorkbook.Sheets[firstSheetName];
    // Using raw: false to get formatted values (like dates as strings if cellDates wasn't effective or for other types).
    // defval: "" ensures empty cells are consistently handled.
    // Date objects from cellDates:true in XLSX.read should be preserved through sheet_to_json if raw:false.
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (sheetData.length > 0 && sheetData[0].length > 0) {
      const currentFileHeadersOriginalCase = sheetData[0].map(header => String(header === null || header === undefined ? "" : header).trim());
      const currentFileHeadersNormalized = currentFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
      
      if (i === 0) { 
        firstFileHeadersOriginalCase = [...currentFileHeadersOriginalCase];
        allRows.push(...sheetData.slice(1)); 
      } else {
        const firstFileHeadersNormalized = firstFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
        // Check if headers match the normalized headers of the first file
        if (currentFileHeadersNormalized.length === firstFileHeadersNormalized.length && 
            currentFileHeadersNormalized.every((h, idx) => h === firstFileHeadersNormalized[idx])) {
          allRows.push(...sheetData.slice(1));
        } else {
          // Map rows based on normalized header matching
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(firstFileHeadersOriginalCase.length).fill(""); 
            currentFileHeadersNormalized.forEach((header, colIndex) => {
              const finalHeaderIndex = firstFileHeadersNormalized.indexOf(header);
              if (finalHeaderIndex !== -1 && colIndex < row.length) { // Ensure colIndex is within bounds for row
                newRow[finalHeaderIndex] = row[colIndex];
              }
            });
            return newRow;
          });
          allRows.push(...newRows);
          console.warn(`File ${file.name} might have a different column structure or ordering. Data mapped to first file's headers.`);
        }
      }
    } else {
      console.warn(`File ${file.name} is empty or contains no valid header row.`);
    }
  }

  // Sorting logic (using normalized headers from the first file for TC Kimlik No lookup)
  if (firstFileHeadersOriginalCase.length > 0 && allRows.length > 0) {
    const firstFileHeadersNormalizedForSort = firstFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
    let tcKimlikNoColumnIndex = -1;
    const upperCaseTcHeaders = TC_KIMLIK_NO_HEADERS_TR.map(h => h.toLocaleUpperCase('tr-TR'));

    for (let k = 0; k < firstFileHeadersNormalizedForSort.length; k++) {
      if (upperCaseTcHeaders.includes(firstFileHeadersNormalizedForSort[k])) {
        tcKimlikNoColumnIndex = k;
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
      console.warn("TC Kimlik No column not found in the effective headers. Data will not be sorted by TC Kimlik No. Searched for (uppercase):", upperCaseTcHeaders.join(', '), "Available headers from first file (uppercase):", firstFileHeadersNormalizedForSort.join(', '));
    }
  } else {
    if (files.length > 0) { // Only warn if files were processed but resulted in no data
      console.warn("No headers or rows found after attempting to merge files. The resulting dataset is empty.");
    }
  }

  // Return headers with the original casing from the first successfully processed file
  return { headers: firstFileHeadersOriginalCase, rows: allRows };
}
