
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToHHMMSS, getFormattedEventDateTime } from './date-utils'; // Removed DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING as they are used internally by date-utils
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

// Constants for column header matching (all lowercase for case-insensitive comparison)
const TC_KIMLIK_NO_HEADERS_ANALYSIS = ["tc kimlik no", "tckn", "kimlik no", "tc no", "tc", "vatandaşlık no", "t.c. kimlik no", "t.c kimlik no", "t.c. no", "tc kimlik numarası"];
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

interface MappedRecordEntry {
  originalIndex: number; 
  eventTime: string; 
  islemTuru: string;
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
    
    if (saatColIdx === -1 || timeValue === null || String(timeValue).trim() === "" || 
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
    return parsedTime && isValid(parsedTime) ? formatDateToHHMMSS(parsedTime) : (typeof timeValue === 'string' && timeValue.match(/\d{1,2}:\d{2}/) ? timeValue : "");
}


export async function extractDeletionRelatedRecords(mergedData: MergedExcelData): Promise<MergedExcelData> {
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

  const recordsByTcDate = new Map<string, { giris: MappedRecordEntry[] }>(); 
  
  for (let index = 0; index < workingRows.length; index++) {
    const row = workingRows[index];
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[groupingDateColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    const islemOriginalCase = String(row[islemColIdx] || '').trim();
    
    const parsedGroupingDate = parseTurkishDate(dateValue);
    if (!tc || !parsedGroupingDate || !isValid(parsedGroupingDate)) continue; 

    const dateKey = format(parsedGroupingDate, 'yyyy-MM-dd');
    const mapKey = `${tc}_${dateKey}`;

    if (islem.includes(ISLEM_TYPES.GIRIS) || islem.includes(ISLEM_TYPES.KAYIT)) {
        if (!recordsByTcDate.has(mapKey)) {
          recordsByTcDate.set(mapKey, { giris: [] });
        }
        const group = recordsByTcDate.get(mapKey)!;
        const eventDateTimeStr = getFormattedEventDateTime(row, groupingDateColIdx, eventSaatColIdx, islemColIdx);
        group.giris.push({ originalIndex: index, eventTime: eventDateTimeStr, islemTuru: islemOriginalCase });
    }
    if (index > 0 && index % 200 === 0) { // Yield every 200 rows
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  const groupKeys = Array.from(recordsByTcDate.keys());
  for (let i = 0; i < groupKeys.length; i++) {
      const key = groupKeys[i];
      const group = recordsByTcDate.get(key)!;
      group.giris.sort((a, b) => (a.eventTime || "").localeCompare(b.eventTime || ""));
      if (i > 0 && i % 100 === 0) { // Yield every 100 groups sorted
           await new Promise(resolve => setTimeout(resolve, 0));
      }
  }


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
            // const girisIslemTuru = String(ilgiliGirisRowFromWorkingRows[islemColIdx] || '').trim();
            const girisIslemTuru = girisEntry.islemTuru;
            
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
    if (i > 0 && i % 200 === 0) { // Yield every 200 rows
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return { headers: finalHeaders, rows: workingRows };
}
