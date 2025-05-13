
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
  let firstFileHeadersOriginalCase: string[] = []; 

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let fileBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let currentWorkbook: XLSX.WorkBook | undefined;

    try {
      console.log(`Processing file: ${file.name}`);
      if (fileName.endsWith('.xls')) {
        console.log(`Attempting to read XLS file ${file.name} as Windows-1254, then convert to XLSX.`);
        // Read XLS with specified codepage
        const xlsWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, codepage: 1254 });
        // Convert to XLSX in memory (XLSX is UTF-8 based)
        const xlsxBuffer = XLSX.write(xlsWorkbook, { bookType: 'xlsx', type: 'array' });
        console.log(`${file.name} (XLS) converted to XLSX format. Reading the converted XLSX.`);
        // Read the converted XLSX (which should be UTF-8 based, codepage option usually ignored for XLSX)
        currentWorkbook = XLSX.read(xlsxBuffer, { type: 'array', cellDates: true });
        console.log(`${file.name} (XLS) processed successfully via XLSX conversion.`);
      } else if (fileName.endsWith('.csv')) {
        console.log(`Attempting to read CSV file ${file.name} as Windows-1254.`);
        currentWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, codepage: 1254 });
        console.log(`${file.name} (CSV) processed with codepage 1254.`);
      } else { // .xlsx, .ods, other XML-based or modern formats
        console.log(`Attempting to read file ${file.name} (e.g., XLSX, ODS) with default UTF-8 handling.`);
        // These are typically UTF-8; forcing a codepage can be problematic.
        currentWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
        console.log(`${file.name} (XLSX/ODS like) processed with default detection.`);
      }
    } catch (primaryError) {
      const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      console.warn(`Primary processing strategy for ${file.name} failed: ${errorMessage}`);
      try {
        console.warn(`Fallback: Attempting to read ${file.name} with SheetJS auto-detection (no specific codepage).`);
        // Ensure fileBuffer is pristine if it could have been modified, though ArrayBuffer is typically immutable by read ops.
        // fileBuffer = await file.arrayBuffer(); // Uncomment if there's a concern buffer was altered.
        currentWorkbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
        console.log(`${file.name} processed with fallback auto-detection.`);
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error(`Fallback reading of ${file.name} also failed: ${fallbackErrorMessage}`);
        // Errors will be caught and toasted by ExcelMergeControls
        throw new Error(`Dosya ${file.name} işlenemedi. Birincil deneme: ${errorMessage}. Yedek deneme: ${fallbackErrorMessage}`);
      }
    }
    
    if (!currentWorkbook) {
        console.warn(`Workbook could not be created for ${file.name}. Skipping.`);
        continue;
    }

    const firstSheetName = currentWorkbook.SheetNames[0];
    if (!firstSheetName) {
      console.warn(`File ${file.name} contains no sheets to read. Skipping.`);
      continue;
    }

    const worksheet = currentWorkbook.Sheets[firstSheetName];
    // Using raw: false to get formatted values.
    // defval: "" ensures empty cells are consistently handled.
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (sheetData.length > 0 && sheetData[0].length > 0) {
      const currentFileHeadersOriginalCase = sheetData[0].map(header => String(header === null || header === undefined ? "" : header).trim());
      const currentFileHeadersNormalized = currentFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
      
      // Set headers from the first successfully processed file with headers
      if (firstFileHeadersOriginalCase.length === 0) { 
        firstFileHeadersOriginalCase = [...currentFileHeadersOriginalCase];
        allRows.push(...sheetData.slice(1)); 
      } else {
        // Subsequent files: map to the first file's header structure
        const firstFileHeadersNormalized = firstFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
        if (currentFileHeadersNormalized.length === firstFileHeadersNormalized.length && 
            currentFileHeadersNormalized.every((h, idx) => h === firstFileHeadersNormalized[idx])) {
          // Headers match, append rows directly
          allRows.push(...sheetData.slice(1));
        } else {
          // Headers differ, map rows
          console.warn(`File ${file.name} has different headers. Mapping to first file's structure. Original: [${currentFileHeadersOriginalCase.join(', ')}], Target: [${firstFileHeadersOriginalCase.join(', ')}]`);
          const newRows = sheetData.slice(1).map(row => {
            const newRow = new Array(firstFileHeadersOriginalCase.length).fill(""); 
            currentFileHeadersNormalized.forEach((header, colIndex) => {
              const finalHeaderIndex = firstFileHeadersNormalized.indexOf(header);
              if (finalHeaderIndex !== -1 && colIndex < row.length) { 
                newRow[finalHeaderIndex] = row[colIndex];
              }
            });
            return newRow;
          });
          allRows.push(...newRows);
        }
      }
    } else {
      console.warn(`File ${file.name} is empty or contains no valid header row after processing. Data part skipped.`);
    }
  }

  // Sorting logic
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
      console.log("Data sorted by TC Kimlik No column found at index:", tcKimlikNoColumnIndex);
    } else {
      console.warn("TC Kimlik No column not found in the effective headers. Data will not be sorted by TC Kimlik No. Searched for (uppercase):", upperCaseTcHeaders.join(', '), ". Available headers from first file (uppercase):", firstFileHeadersNormalizedForSort.join(', '));
    }
  } else if (files.length > 0) { 
    console.warn("No headers or rows found after attempting to merge all processed files. The resulting dataset is empty.");
  }

  return { headers: firstFileHeadersOriginalCase, rows: allRows };
}
