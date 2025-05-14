
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
const CONSUMED_BY_ANALYSIS_MARKER_HEADER = "__isConsumedByAnalysis";
const CONSUMED_BY_ANALYSIS_MARKER_VALUE = "CONSUMED_BY_ANALYSIS_ROW_MARKER";


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
    const errorHeader = "Analiz Hatası";
    let headersWithError = [...originalHeaders];
    if (!headersWithError.includes(errorHeader)) {
        headersWithError.push(errorHeader);
    }
    const errorColIdx = headersWithError.indexOf(errorHeader);
    const rowsWithError = originalRows.map(row => {
        const newRow = [...row];
        if (newRow.length < headersWithError.length) {
            newRow.length = headersWithError.length;
            newRow.fill("", row.length);
        }
        newRow[errorColIdx] = "TC Kimlik No, Tarih (Gruplama) veya İşlem sütunu bulunamadı.";
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

  // Create rows that are wide enough for the new markers from the start
  const workingRows = originalRows.map(row => {
    const newRow = [...row];
    if (newRow.length < finalHeaders.length) {
      newRow.length = finalHeaders.length;
      newRow.fill("", row.length);
    }
    return newRow;
  });

  const recordsByTcDate = new Map<string, { giris: any[][], cikis: any[][] }>();
  workingRows.forEach(row => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[groupingDateColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedGroupingDate = parseTurkishDate(dateValue);
    if (!tc || !parsedGroupingDate) return; 

    const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
    const mapKey = `${tc}_${dateKey}`;

    if (!recordsByTcDate.has(mapKey)) {
      recordsByTcDate.set(mapKey, { giris: [], cikis: [] });
    }
    const group = recordsByTcDate.get(mapKey)!;

    // Store references to rows in workingRows
    if (islem.includes(ISLEM_TYPES.GIRIS) || islem.includes(ISLEM_TYPES.KAYIT)) group.giris.push(row);
    else if (islem.includes(ISLEM_TYPES.CIKIS)) group.cikis.push(row);
  });

  // Process rows - modify workingRows directly for consumed markers
  workingRows.forEach(rowToProcess => {
    const tc = String(rowToProcess[tcColIdx] || '').trim();
    const groupingDateValue = rowToProcess[groupingDateColIdx];
    const currentIslem = String(rowToProcess[islemColIdx] || '').trim();
    const currentIslemLc = currentIslem.toLocaleLowerCase('tr-TR');
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);

    if (tc && parsedGroupingDate && currentIslemLc.includes(ISLEM_TYPES.SILME)) {
      const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
      const mapKey = `${tc}_${dateKey}`;
      const group = recordsByTcDate.get(mapKey);

      if (group && group.giris.length > 0) {
        group.giris.sort((a, b) => {
            const timeA = getFormattedEventDateTime(a, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            const timeB = getFormattedEventDateTime(b, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            return (timeA || "").localeCompare(timeB || "");
        });
        const ilgiliGirisRow = group.giris[0]; // This is a row from workingRows
        
        if (ilgiliGirisRow && ilgiliGirisRow[consumedMarkerColIdx] !== CONSUMED_BY_ANALYSIS_MARKER_VALUE) {
            const girisIslemTuru = String(ilgiliGirisRow[islemColIdx] || '').trim();
            
            rowToProcess[islemColIdx] = `${girisIslemTuru} / ${currentIslem}`;
            
            const girisEventTimeStr = extractTimeFromRow(ilgiliGirisRow, eventSaatColIdx, islemColIdx, groupingDateColIdx);
            if (eventSaatColIdx !== -1) {
              rowToProcess[eventSaatColIdx] = girisEventTimeStr;
            } else {
              console.warn("No 'Saat' column index found to update with giriş time for analyzed silme record.");
            }
            
            rowToProcess[analysisMarkerColIdx] = ANALYSIS_MARKER_VALUE;
            ilgiliGirisRow[consumedMarkerColIdx] = CONSUMED_BY_ANALYSIS_MARKER_VALUE; // Mark original giriş row as consumed
        } else {
            // No available (non-consumed) giriş found, or giriş already consumed
            rowToProcess[analysisMarkerColIdx] = ANALYSIS_MARKER_VALUE; 
        }

      } else {
        rowToProcess[analysisMarkerColIdx] = ANALYSIS_MARKER_VALUE;
      }
    }
  });
  
  return { headers: finalHeaders, rows: workingRows };
}
