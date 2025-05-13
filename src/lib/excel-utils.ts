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
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Assuming we merge the first sheet of each file
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) continue;

    const worksheet = workbook.Sheets[firstSheetName];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (sheetData.length > 0) {
      if (i === 0) { // Use headers from the first file's first sheet
        finalHeaders = sheetData[0].map(String); // Ensure headers are strings
        allRows.push(...sheetData.slice(1)); // Add data rows
      } else {
        // For subsequent files, skip their header row and append data rows
        // Basic check: if column count matches, append. Otherwise, this simple merge might misalign data.
        // A more robust solution would involve column mapping.
        if (sheetData.length > 1 && sheetData[0].length === finalHeaders.length) {
          allRows.push(...sheetData.slice(1));
        } else if (sheetData.length > 1) {
          // Handle potential column mismatch, e.g., by padding or logging a warning
          // For now, we'll add rows if they exist, even if column counts don't perfectly match.
          // User should be aware of this simplification.
          console.warn(`File ${file.name} has a different column structure or is empty after header.`);
          // Attempt to add rows by matching available columns
          const rowsToAdd = sheetData.slice(1).map(row => {
            const newRow = new Array(finalHeaders.length).fill("");
            for(let j=0; j < Math.min(row.length, finalHeaders.length); j++) {
              newRow[j] = row[j];
            }
            return newRow;
          });
          allRows.push(...rowsToAdd);
        }
      }
    }
  }

  return { headers: finalHeaders, rows: allRows };
}
