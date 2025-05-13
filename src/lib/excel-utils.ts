
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

  for (const file of files) {
    const fileBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let workbookToProcess: XLSX.WorkBook | undefined;

    console.log(`Processing file: ${file.name}`);

    if (fileName.endsWith('.xlsx')) {
      try {
        console.log(`Reading XLSX file: ${file.name}`);
        workbookToProcess = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error reading XLSX file ${file.name}: ${errorMessage}`);
        throw new Error(`XLSX dosyası ${file.name} okunamadı: ${errorMessage}`);
      }
    } else if (fileName.endsWith('.xls')) { // BIFF formats (Excel 97-2003)
      try {
        console.log(`Attempting to read XLS file ${file.name} with codepage 1254 (Turkish).`);
        workbookToProcess = XLSX.read(fileBuffer, { type: 'array', cellDates: true, codepage: 1254 });
      } catch (e1) {
        const errorMsg1 = e1 instanceof Error ? e1.message : String(e1);
        console.warn(`Failed to read XLS ${file.name} with codepage 1254: ${errorMsg1}. Falling back to auto-detection (no specific codepage).`);
        try {
          workbookToProcess = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
        } catch (e2) {
          const errorMsg2 = e2 instanceof Error ? e2.message : String(e2);
          console.error(`Error reading XLS file ${file.name} (both attempts failed). CP1254 error: ${errorMsg1}, Fallback error: ${errorMsg2}`);
          throw new Error(`XLS dosyası ${file.name} okunamadı. CP1254 denemesi: ${errorMsg1}. Otomatik deneme: ${errorMsg2}`);
        }
      }
    } else if (fileName.endsWith('.csv')) {
      let csvTextContent: string;
      try {
        // Prefer UTF-8 for CSV as it's a modern standard
        console.log(`Attempting to read CSV ${file.name} as UTF-8 text (using browser default).`);
        csvTextContent = await file.text();
        console.log(`CSV ${file.name} read as text, assuming UTF-8 or browser-detected encoding.`);
      } catch (e_utf8_read) {
        const utf8ReadError = e_utf8_read instanceof Error ? e_utf8_read.message : String(e_utf8_read);
        console.warn(`Failed to read CSV ${file.name} as UTF-8 text: ${utf8ReadError}. Falling back to windows-1254 text reading.`);
        try {
          const reader = new FileReader();
          csvTextContent = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (err) => reject(new Error(`FileReader error with windows-1254: ${err.type}`)); 
            reader.readAsText(file, 'windows-1254'); // Turkish ANSI
          });
          console.log(`CSV ${file.name} read as text with windows-1254 encoding.`);
        } catch (e_cp1254_read) {
          const cp1254ReadError = e_cp1254_read instanceof Error ? e_cp1254_read.message : String(e_cp1254_read);
          console.error(`Failed to read CSV ${file.name} text with both UTF-8 and windows-1254 methods. UTF-8 Error: ${utf8ReadError}, CP1254 Error: ${cp1254ReadError}`);
          throw new Error(`CSV dosyası ${file.name} metin olarak okunamadı. Hata (UTF-8): ${utf8ReadError}. Hata (Win-1254): ${cp1254ReadError}`);
        }
      }
      
      try {
        // Parse the obtained text content
        workbookToProcess = XLSX.read(csvTextContent, { type: 'string', cellDates: true, raw: false });
        console.log(`CSV ${file.name} parsed from text successfully.`);
      } catch (e_parse) {
        const parseError = e_parse instanceof Error ? e_parse.message : String(e_parse);
        // Log first 200 chars to help debug if text was garbled
        console.error(`Failed to parse CSV text for ${file.name}. Error: ${parseError}. Text started with: "${csvTextContent.substring(0,200)}"`);
        throw new Error(`CSV dosyası ${file.name} içeriği ayrıştırılamadı: ${parseError}`);
      }

    } else if (fileName.endsWith('.ods')) {
      try {
        console.log(`Reading ODS file: ${file.name}`);
        workbookToProcess = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error reading ODS file ${file.name}: ${errorMessage}`);
        throw new Error(`ODS dosyası ${file.name} okunamadı: ${errorMessage}`);
      }
    } else {
      // Fallback for other extensions, try generic read
      const fileExtension = fileName.split('.').pop() || "unknown";
      console.warn(`Unsupported file extension ".${fileExtension}" for ${file.name}. Attempting generic read.`);
      try {
        workbookToProcess = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error reading file ${file.name} with unsupported extension ".${fileExtension}": ${errorMessage}`);
        throw new Error(`Dosya ${file.name} (tip: .${fileExtension}) okunamadı: ${errorMessage}`);
      }
    }

    // Convert to in-memory XLSX representation if not already
    // This ensures consistent handling for header/row extraction
    let currentWorkbook: XLSX.WorkBook;
    if (workbookToProcess) {
      if (fileName.endsWith('.xlsx')) {
        currentWorkbook = workbookToProcess; // Already in desired format
        console.log(`${file.name} is XLSX, using directly.`);
      } else {
        // Convert XLS, CSV (parsed into workbook), ODS to an in-memory XLSX structure
        console.log(`Converting ${file.name} to in-memory XLSX representation.`);
        try {
          const xlsxBuffer = XLSX.write(workbookToProcess, { bookType: 'xlsx', type: 'array' });
          // Re-read from this buffer to ensure it's a "clean" XLSX workbook object
          currentWorkbook = XLSX.read(xlsxBuffer, { type: 'array', cellDates: true });
          console.log(`${file.name} successfully converted and re-read as XLSX.`);
        } catch (conversionError) {
          const convErrorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
          console.error(`Error converting ${file.name} to XLSX format for internal processing: ${convErrorMsg}`);
          throw new Error(`${file.name} dosyası iç işleme için XLSX formatına dönüştürülürken hata oluştu: ${convErrorMsg}`);
        }
      }
    } else {
      console.warn(`Workbook could not be created or processed for ${file.name}. Skipping this file.`);
      continue; // Move to the next file
    }
    
    // Extract data from the (now XLSX-formatted) workbook
    const firstSheetName = currentWorkbook.SheetNames[0];
    if (!firstSheetName) {
      console.warn(`File ${file.name} (after processing) contains no sheets. Skipping.`);
      continue;
    }

    const worksheet = currentWorkbook.Sheets[firstSheetName];
    // Using raw:false to get parsed values, defval to handle empty cells.
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (sheetData.length > 0 && sheetData[0].length > 0) {
      const currentFileHeadersOriginalCase = sheetData[0].map(header => String(header === null || header === undefined ? "" : header).trim());
      const currentFileHeadersNormalized = currentFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
      
      if (firstFileHeadersOriginalCase.length === 0) { 
        firstFileHeadersOriginalCase = [...currentFileHeadersOriginalCase];
        allRows.push(...sheetData.slice(1)); 
      } else {
        const firstFileHeadersNormalized = firstFileHeadersOriginalCase.map(h => h.toLocaleUpperCase('tr-TR'));
        if (currentFileHeadersNormalized.length === firstFileHeadersNormalized.length && 
            currentFileHeadersNormalized.every((h, idx) => h === firstFileHeadersNormalized[idx])) {
          allRows.push(...sheetData.slice(1));
        } else {
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
      console.warn(`File ${file.name} (after processing) is empty or has no header row. Data part skipped.`);
    }
  } // End of loop through files

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
