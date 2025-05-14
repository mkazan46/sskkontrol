
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToHHMMSS } from './date-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

// Constants for column header matching (all lowercase for case-insensitive comparison)
const TC_KIMLIK_NO_HEADERS_ANALYSIS = ["tc kimlik no", "tckn", "kimlik no", "tc no", "tc", "vatandaşlık no", "t.c. kimlik no", "t.c kimlik no", "t.c. no", "tc kimlik numarası"];
const AD_SOYAD_HEADERS_ANALYSIS = ["ad soyad", "adı soyadı", "isim soyisim", "adsoyad", "isim", "personel", "çalışan"];
const TARIH_HEADERS_ANALYSIS = ["tarih", "işlem tarihi", "kayıt tarihi", "gün"];
const ISLEM_HEADERS_ANALYSIS = ["işlem", "açıklama", "işlem türü", "olay", "hareket tipi"];
const SAAT_HEADERS_ANALYSIS = ["saat", "işlem saati", "zaman", "giriş saati", "çıkış saati"];

const ISLEM_TYPES = {
  SILME: "silme",
  GIRIS: "giriş",
  CIKIS: "çıkış",
  KAYIT: "kayıt",
};

const ANALYSIS_MARKER_HEADER = "__isAnalyzedDeletion";
const ANALYSIS_MARKER_VALUE = "ANALYZED_DELETION_ROW_MARKER";

function findColumnIndex(headers: string[], targetHeaders: string[], headerOriginalCase: string): number {
  const lowerCaseTargetHeaders = targetHeaders.map(h => h.toLocaleLowerCase('tr-TR'));
  const lowerCaseHeaders = headers.map(h => String(h).toLocaleLowerCase('tr-TR'));
  
  for (let i = 0; i < lowerCaseHeaders.length; i++) {
    if (lowerCaseTargetHeaders.includes(lowerCaseHeaders[i])) {
      return i;
    }
  }
  console.warn(`Column for "${headerOriginalCase}" not found. Looked for: [${targetHeaders.join(', ')}] in [${headers.join(', ')}]`);
  return -1; 
}

function extractTimeFromRow(row: any[], saatColIdx: number, islemColIdx: number, groupingDateColIdx: number): string {
    let timeValue = saatColIdx !== -1 ? row[saatColIdx] : null;
    
    if (saatColIdx === -1 || timeValue === null || timeValue === "" || 
        (groupingDateColIdx !== -1 && String(row[groupingDateColIdx]) === String(timeValue))) {
      if (islemColIdx !== -1 && row[islemColIdx] !== null && String(row[islemColIdx]).trim() !== "") {
        const islemContent = String(row[islemColIdx]);
        const timePattern = /\b(\d{1,2}:\d{2}(:\d{2})?)\b/;
        const match = islemContent.match(timePattern);
        if (match && match[1]) {
          timeValue = match[1];
        } else if (groupingDateColIdx !== -1 && row[groupingDateColIdx] !== row[islemColIdx]) {
           timeValue = row[islemColIdx];
        }
      }
    }

    const parsedTime = parseTurkishDate(timeValue);
    return parsedTime ? formatDateToHHMMSS(parsedTime) : (typeof timeValue === 'string' && timeValue.match(/\d{1,2}:\d{2}/) ? timeValue : "");
}

function getFormattedEventDateTime(row: any[], groupingDateColIdx: number, eventSpecificSaatColIdx: number, eventSpecificIslemColIdx: number): string {
  let eventDateObj: Date | null = null;
  
  if (eventSpecificSaatColIdx !== -1 && row[eventSpecificSaatColIdx] !== null && String(row[eventSpecificSaatColIdx]).trim() !== "") {
    eventDateObj = parseTurkishDate(row[eventSpecificSaatColIdx]);
  }

  if ((!eventDateObj || !isValid(eventDateObj)) && eventSpecificIslemColIdx !== -1 && row[eventSpecificIslemColIdx] !== null && String(row[eventSpecificIslemColIdx]).trim() !== "") {
      eventDateObj = parseTurkishDate(row[eventSpecificIslemColIdx]);
  }

  if (!eventDateObj || !isValid(eventDateObj)) {
    const groupingDate = groupingDateColIdx !== -1 ? parseTurkishDate(row[groupingDateColIdx]) : null;
    if (groupingDate && isValid(groupingDate)) {
      const timeStr = extractTimeFromRow(row, eventSpecificSaatColIdx, eventSpecificIslemColIdx, groupingDateColIdx);
      if (timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        if (hours !== undefined && minutes !== undefined) {
          groupingDate.setHours(hours, minutes, seconds || 0, 0);
          eventDateObj = groupingDate;
        }
      } else {
         eventDateObj = groupingDate;
      }
    }
  }
  
  return eventDateObj && isValid(eventDateObj) ? format(eventDateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr }) : "";
}


export function extractDeletionRelatedRecords(mergedData: MergedExcelData): MergedExcelData {
  if (!mergedData || mergedData.rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const groupingDateColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih (Gruplama İçin)");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const eventSaatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat (Etkinlik Zamanı)");

  if (tcColIdx === -1 || groupingDateColIdx === -1 || islemColIdx === -1) {
    console.error("Gerekli sütunlar (TC Kimlik No, Tarih (Gruplama), İşlem) bulunamadı. Analiz yapılamıyor.");
    // Return original data with an error message in a new column if critical columns are missing
    const errorHeader = "Analiz Hatası";
    if (!originalHeaders.includes(errorHeader)) {
        const headersWithError = [...originalHeaders, errorHeader];
        const rowsWithError = originalRows.map(row => [...row, "TC Kimlik No, Tarih (Gruplama) veya İşlem sütunu bulunamadı."]);
        return { headers: headersWithError, rows: rowsWithError };
    }
    return mergedData; // Return as is if error column already exists or no modification needed
  }
  
  // Add a marker header if it doesn't exist
  const finalHeaders = originalHeaders.includes(ANALYSIS_MARKER_HEADER) 
    ? [...originalHeaders] 
    : [...originalHeaders, ANALYSIS_MARKER_HEADER];
  
  const markerColIdx = finalHeaders.indexOf(ANALYSIS_MARKER_HEADER);

  const recordsByTcDate = new Map<string, { giris: any[][], cikis: any[][] }>();
  originalRows.forEach(row => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[groupingDateColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedGroupingDate = parseTurkishDate(dateValue);
    if (!tc || !parsedGroupingDate) return; 

    const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd'); // Use yyyy-MM-dd for consistent key
    const mapKey = `${tc}_${dateKey}`;

    if (!recordsByTcDate.has(mapKey)) {
      recordsByTcDate.set(mapKey, { giris: [], cikis: [] });
    }
    const group = recordsByTcDate.get(mapKey)!;

    if (islem.includes(ISLEM_TYPES.GIRIS) || islem.includes(ISLEM_TYPES.KAYIT)) group.giris.push(row);
    else if (islem.includes(ISLEM_TYPES.CIKIS)) group.cikis.push(row);
    // Silme rows are processed directly later, not stored in this map for this specific logic
  });

  const processedRows = originalRows.map(originalRow => {
    // Ensure each row has space for the marker, initialized to not analyzed
    const rowWithMarkerSpace = [...originalRow];
    if (rowWithMarkerSpace.length < finalHeaders.length) {
      rowWithMarkerSpace[markerColIdx] = ""; // Initialize marker cell if new
    }

    const tc = String(originalRow[tcColIdx] || '').trim();
    const groupingDateValue = originalRow[groupingDateColIdx];
    const currentIslem = String(originalRow[islemColIdx] || '').trim();
    const currentIslemLc = currentIslem.toLocaleLowerCase('tr-TR');
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);

    if (tc && parsedGroupingDate && currentIslemLc.includes(ISLEM_TYPES.SILME)) {
      const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
      const mapKey = `${tc}_${dateKey}`;
      const group = recordsByTcDate.get(mapKey);

      if (group && group.giris.length > 0) {
        // Sort giriş records by their event time to find the earliest
        group.giris.sort((a, b) => {
            const timeA = getFormattedEventDateTime(a, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            const timeB = getFormattedEventDateTime(b, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            return (timeA || "").localeCompare(timeB || "");
        });
        const ilgiliGirisRow = group.giris[0];
        const girisIslemTuru = String(ilgiliGirisRow[islemColIdx] || '').trim();
        
        // Modify the "İşlem" cell of the silme row
        rowWithMarkerSpace[islemColIdx] = `${girisIslemTuru} / ${currentIslem}`;
        
        // Modify the "Saat" cell of the silme row with the "Giriş" event's time
        const girisEventTimeStr = extractTimeFromRow(ilgiliGirisRow, eventSaatColIdx, islemColIdx, groupingDateColIdx);
        if (eventSaatColIdx !== -1) {
          rowWithMarkerSpace[eventSaatColIdx] = girisEventTimeStr;
        } else {
            // If no dedicated Saat column, this is tricky. For now, we assume 'Saat' column exists for this.
            // If not, the logic for where to put the time would need to be more complex.
            console.warn("No 'Saat' column index found to update with giriş time for analyzed silme record.");
        }
        
        // Mark this row as analyzed
        rowWithMarkerSpace[markerColIdx] = ANALYSIS_MARKER_VALUE;
      } else {
        // No related giriş found, mark as analyzed but with original silme details
        rowWithMarkerSpace[markerColIdx] = ANALYSIS_MARKER_VALUE; // Still mark it to show it was processed
      }
    }
    return rowWithMarkerSpace;
  });
  
  return { headers: finalHeaders, rows: processedRows };
}
