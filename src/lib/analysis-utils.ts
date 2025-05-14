
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToHHMMSS, DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING } from './date-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

// Constants for column header matching (all lowercase for case-insensitive comparison)
const TC_KIMLIK_NO_HEADERS_ANALYSIS = ["tc kimlik no", "tckn", "kimlik no", "tc no", "tc", "vatandaşlık no", "t.c. kimlik no", "t.c kimlik no", "t.c. no", "tc kimlik numarası"];
const AD_SOYAD_HEADERS_ANALYSIS = ["ad soyad", "adı soyadı", "isim soyisim", "adsoyad", "isim", "personel", "çalışan"];
const TARIH_HEADERS_ANALYSIS = ["tarih", "işlem tarihi", "kayıt tarihi", "gün"]; // Used for grouping
const ISLEM_HEADERS_ANALYSIS = ["işlem", "açıklama", "işlem türü", "olay", "hareket tipi"];
const SAAT_HEADERS_ANALYSIS = ["saat", "işlem saati", "zaman", "giriş saati", "çıkış saati"]; // Used for event time

const ISLEM_TYPES = {
  SILME: "silme",
  GIRIS: "giriş",
  CIKIS: "çıkış", // Currently not used for consumption logic but defined
  KAYIT: "kayıt",
};

const ANALYSIS_MARKER_HEADER = "__isAnalyzedDeletion";
const ANALYSIS_MARKER_VALUE = "ANALYZED_DELETION_ROW_MARKER";
const CONSUMED_BY_ANALYSIS_MARKER_HEADER = "__isConsumedByAnalysis";
const CONSUMED_BY_ANALYSIS_MARKER_VALUE = "CONSUMED_BY_ANALYSIS_ROW_MARKER";

interface MappedRecordEntry {
  // rowArray: any[]; // Reference to the row in workingRows - not needed if we use originalIndex
  originalIndex: number; // The index of this row in the workingRows array
  eventTime: string; // Formatted time string for sorting "HH:mm:ss" or full "dd.MM.yyyy HH:mm:ss"
}


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
    
    // If Saat column is empty, not present, or contains the same value as the grouping date (common if date is in time field)
    // try extracting from İşlem column.
    if (saatColIdx === -1 || timeValue === null || String(timeValue).trim() === "" || 
        (groupingDateColIdx !== -1 && String(row[groupingDateColIdx]) === String(timeValue))) {
      if (islemColIdx !== -1 && row[islemColIdx] !== null && String(row[islemColIdx]).trim() !== "") {
        const islemContent = String(row[islemColIdx]);
        const timePattern = /\b(\d{1,2}:\d{2}(:\d{2})?)\b/; // Matches HH:MM or HH:MM:SS
        const match = islemContent.match(timePattern);
        if (match && match[1]) {
          timeValue = match[1]; // Use time found in işlem description
        } else if (groupingDateColIdx !== -1 && row[groupingDateColIdx] !== row[islemColIdx]) {
           // Fallback: if no time pattern but işlem content is different from date, consider it as time value
           timeValue = row[islemColIdx];
        }
      }
    }

    const parsedTime = parseTurkishDate(timeValue); // Handles various date/time string formats
    return parsedTime && isValid(parsedTime) ? formatDateToHHMMSS(parsedTime) : (typeof timeValue === 'string' && timeValue.match(/\d{1,2}:\d{2}/) ? timeValue : "");
}

// Gets a full date-time string for an event, using grouping date and specific time from row.
function getFormattedEventDateTime(row: any[], groupingDateColIdx: number, eventSpecificSaatColIdx: number, eventSpecificIslemColIdx: number): string {
  let eventDateObj: Date | null = null;
  
  // Try to parse time from the dedicated "Saat" column first
  if (eventSpecificSaatColIdx !== -1 && row[eventSpecificSaatColIdx] !== null && String(row[eventSpecificSaatColIdx]).trim() !== "") {
    eventDateObj = parseTurkishDate(row[eventSpecificSaatColIdx]);
  }

  // If "Saat" column didn't yield a valid date, try "İşlem" column
  if ((!eventDateObj || !isValid(eventDateObj)) && eventSpecificIslemColIdx !== -1 && row[eventSpecificIslemColIdx] !== null && String(row[eventSpecificIslemColIdx]).trim() !== "") {
      eventDateObj = parseTurkishDate(row[eventSpecificIslemColIdx]);
  }

  // If still no valid date object, try to combine groupingDate with extracted time
  if (!eventDateObj || !isValid(eventDateObj)) {
    const groupingDate = groupingDateColIdx !== -1 ? parseTurkishDate(row[groupingDateColIdx]) : null;
    if (groupingDate && isValid(groupingDate)) {
      const timeStr = extractTimeFromRow(row, eventSpecificSaatColIdx, eventSpecificIslemColIdx, groupingDateColIdx);
      if (timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        if (hours !== undefined && minutes !== undefined) {
          const combinedDate = new Date(groupingDate); // Clone to avoid modifying original
          combinedDate.setHours(hours, minutes, seconds || 0, 0);
          eventDateObj = combinedDate;
        }
      } else {
         // If no specific time, use the grouping date as is (time will be 00:00:00)
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
    const errorHeader = "Analiz Hatası";
    let headersWithError = [...originalHeaders];
    if (!headersWithError.includes(errorHeader)) {
        headersWithError.push(errorHeader);
    }
    const errorColIdxCurrent = headersWithError.indexOf(errorHeader);
    const rowsWithError = originalRows.map(row => {
        const newRow = [...row];
        if (newRow.length < headersWithError.length) {
            newRow.length = headersWithError.length;
            newRow.fill("", row.length);
        }
        newRow[errorColIdxCurrent] = "TC Kimlik No, Tarih (Gruplama) veya İşlem sütunu bulunamadı.";
        return newRow;
    });
    return { headers: headersWithError, rows: rowsWithError };
  }
  
  let finalHeaders = [...originalHeaders];
  if (!finalHeaders.includes(ANALYSIS_MARKER_HEADER)) {
    finalHeaders.push(ANALYSIS_MARKER_HEADER);
  }
  if (!finalHeaders.includes(CONSUMED_BY_ANALYSIS_MARKER_HEADER)) {
    finalHeaders.push(CONSUMED_BY_ANALYSIS_MARKER_HEADER);
  }
  
  const analysisMarkerColIdx = finalHeaders.indexOf(ANALYSIS_MARKER_HEADER);
  const consumedMarkerColIdx = finalHeaders.indexOf(CONSUMED_BY_ANALYSIS_MARKER_HEADER);

  const workingRows = originalRows.map(row => {
    const newRow = [...row];
    if (newRow.length < finalHeaders.length) {
      newRow.length = finalHeaders.length;
      newRow.fill("", row.length);
    }
    return newRow;
  });

  const recordsByTcDate = new Map<string, { giris: MappedRecordEntry[] }>(); // Only storing 'giris' for consumption
  
  workingRows.forEach((row, index) => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[groupingDateColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedGroupingDate = parseTurkishDate(dateValue);
    if (!tc || !parsedGroupingDate || !isValid(parsedGroupingDate)) return; 

    const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
    const mapKey = `${tc}_${dateKey}`;

    if (islem.includes(ISLEM_TYPES.GIRIS) || islem.includes(ISLEM_TYPES.KAYIT)) {
        if (!recordsByTcDate.has(mapKey)) {
          recordsByTcDate.set(mapKey, { giris: [] });
        }
        const group = recordsByTcDate.get(mapKey)!;
        const eventDateTimeStr = getFormattedEventDateTime(row, groupingDateColIdx, eventSaatColIdx, islemColIdx);
        group.giris.push({ originalIndex: index, eventTime: eventDateTimeStr });
    }
  });

  recordsByTcDate.forEach(group => {
    group.giris.sort((a, b) => (a.eventTime || "").localeCompare(b.eventTime || ""));
  });

  for (let i = 0; i < workingRows.length; i++) {
    const rowToProcess = workingRows[i];
    if (!rowToProcess) continue;

    const tc = String(rowToProcess[tcColIdx] || '').trim();
    const groupingDateValue = rowToProcess[groupingDateColIdx];
    const currentIslem = String(rowToProcess[islemColIdx] || '').trim();
    const currentIslemLc = currentIslem.toLocaleLowerCase('tr-TR');
    
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);

    if (tc && parsedGroupingDate && isValid(parsedGroupingDate) && currentIslemLc.includes(ISLEM_TYPES.SILME)) {
      rowToProcess[analysisMarkerColIdx] = ANALYSIS_MARKER_VALUE; 

      const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
      const mapKey = `${tc}_${dateKey}`;
      const group = recordsByTcDate.get(mapKey);

      if (group && group.giris.length > 0) {
        for (const girisEntry of group.giris) {
          const ilgiliGirisRowFromWorkingRows = workingRows[girisEntry.originalIndex];

          if (ilgiliGirisRowFromWorkingRows && ilgiliGirisRowFromWorkingRows[consumedMarkerColIdx] !== CONSUMED_BY_ANALYSIS_MARKER_VALUE) {
            const girisIslemTuru = String(ilgiliGirisRowFromWorkingRows[islemColIdx] || '').trim();
            
            rowToProcess[islemColIdx] = `${girisIslemTuru} / ${currentIslem}`;
            
            const girisEventTimeStr = extractTimeFromRow(ilgiliGirisRowFromWorkingRows, eventSaatColIdx, islemColIdx, groupingDateColIdx);
            
            if (eventSaatColIdx !== -1) {
              rowToProcess[eventSaatColIdx] = girisEventTimeStr;
            }
            
            ilgiliGirisRowFromWorkingRows[consumedMarkerColIdx] = CONSUMED_BY_ANALYSIS_MARKER_VALUE;
            break; 
          }
        }
      }
    }
  }
  
  return { headers: finalHeaders, rows: workingRows };
}

    