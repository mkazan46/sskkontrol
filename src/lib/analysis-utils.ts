
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToHHMMSS } from './date-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

// Constants for column header matching (all lowercase for case-insensitive comparison)
const TC_KIMLIK_NO_HEADERS_ANALYSIS = ["tc kimlik no", "tckn", "kimlik no", "tc no", "tc", "vatandaşlık no", "t.c. kimlik no", "t.c kimlik no", "t.c. no", "tc kimlik numarası"];
const AD_SOYAD_HEADERS_ANALYSIS = ["adı soyadı", "ad soyad", "isim soyisim", "personel adı", "personel", "çalışan"];
const TARIH_HEADERS_ANALYSIS = ["tarih", "işlem tarihi", "kayıt tarihi", "gün"]; 
const ISLEM_HEADERS_ANALYSIS = ["işlem", "açıklama", "işlem türü", "olay", "hareket tipi"];
const SAAT_HEADERS_ANALYSIS = ["saat", "işlem saati", "zaman", "giriş saati", "çıkış saati"]; 

const ISLEM_TYPES = {
  SILME: "silme",
  GIRIS: "giriş",
  CIKIS: "çıkış", 
  KAYIT: "kayıt",
};

export const ANALYSIS_HIGHLIGHT_MARKER_HEADER = "__isDeletionAnalyzedAndHighlighted";

function findColumnIndex(headers: string[], targetHeaders: string[], headerOriginalCase: string): number {
  const lowerCaseTargetHeaders = targetHeaders.map(h => h.toLocaleLowerCase('tr-TR'));
  const lowerCaseHeaders = headers.map(h => String(h).toLocaleLowerCase('tr-TR'));
  
  for (let i = 0; i < lowerCaseHeaders.length; i++) {
    if (lowerCaseTargetHeaders.includes(lowerCaseHeaders[i])) {
      return i;
    }
  }
  console.warn(`Analiz için sütun "${headerOriginalCase}" bulunamadı. Arananlar: [${targetHeaders.join(', ')}] Mevcut başlıklar: [${headers.join(', ')}]`);
  return -1; 
}

// Function to get a comparable date-time string for sorting and comparison.
// This function is defined locally as it's only used by extractDeletionRelatedRecords.
function getFormattedEventDateTime(row: any[], groupingDateColIdx: number, eventSaatColIdx: number, islemColIdx: number, headers: string[]): string {
    const groupingDateValue = groupingDateColIdx !== -1 ? row[groupingDateColIdx] : null;
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);
    if (!parsedGroupingDate || !isValid(parsedGroupingDate)) return "";

    let timeValue = eventSaatColIdx !== -1 ? row[eventSaatColIdx] : null;
    
    if (timeValue === null || String(timeValue).trim() === "" || 
        (groupingDateColIdx !== -1 && String(row[groupingDateColIdx]) === String(timeValue))) {
      if (islemColIdx !== -1 && row[islemColIdx] !== null && String(row[islemColIdx]).trim() !== "") {
        const islemContent = String(row[islemColIdx]);
        const timePattern = /\b(\d{1,2}:\d{2}(:\d{2})?)\b/; 
        const match = islemContent.match(timePattern);
        if (match && match[1]) {
          timeValue = match[1]; 
        } else if (groupingDateColIdx !== -1 && row[groupingDateColIdx] !== row[islemColIdx] && islemColIdx !== -1) {
           timeValue = row[islemColIdx]; 
        }
      }
    }

    const parsedTime = parseTurkishDate(timeValue); 
    const formattedTime = parsedTime && isValid(parsedTime) ? formatDateToHHMMSS(parsedTime) : (typeof timeValue === 'string' && timeValue.match(/\d{1,2}:\d{2}/) ? timeValue : "");

    if (!formattedTime) return format(parsedGroupingDate, 'yyyy-MM-dd HH:mm:ss'); 

    const [hours, minutes, seconds] = formattedTime.split(':').map(Number);
    
    const eventDateTime = new Date(parsedGroupingDate);
    eventDateTime.setHours(hours || 0, minutes || 0, seconds || 0, 0);
    
    if (!isValid(eventDateTime)) return format(parsedGroupingDate, 'yyyy-MM-dd HH:mm:ss'); 

    return format(eventDateTime, 'yyyy-MM-dd HH:mm:ss');
}


export async function extractDeletionRelatedRecords(mergedData: MergedExcelData): Promise<MergedExcelData> {
  if (!mergedData || mergedData.rows.length === 0) {
    return { headers: [...(mergedData?.headers || []), ANALYSIS_HIGHLIGHT_MARKER_HEADER], rows: [] };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const tarihColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const saatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat");

  if (tcColIdx === -1 || tarihColIdx === -1 || islemColIdx === -1) {
    console.error("Analiz için gerekli sütunlar (TC Kimlik No, Tarih, İşlem) bulunamadı.");
    const rowsWithMarker = originalRows.map(row => [...row, false]);
    return { headers: [...originalHeaders, ANALYSIS_HIGHLIGHT_MARKER_HEADER], rows: rowsWithMarker };
  }
  
  const workingRows = originalRows.map(row => [...row, false]); 
  const outputHeaders = [...originalHeaders, ANALYSIS_HIGHLIGHT_MARKER_HEADER];
  const highlightMarkerColIdx = outputHeaders.length - 1;

  const entryRecordsByTcDate = new Map<string, Array<{row: any[], originalIndex: number, eventTime: string}>>();

  // Group entry records
  for (let i = 0; i < workingRows.length; i++) {
    const row = workingRows[i];
    const islemContent = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    if (islemContent.includes(ISLEM_TYPES.GIRIS) || islemContent.includes(ISLEM_TYPES.KAYIT)) {
      const tc = String(row[tcColIdx] || '').trim();
      const dateValue = row[tarihColIdx];
      const parsedDate = parseTurkishDate(dateValue);

      if (tc && parsedDate && isValid(parsedDate)) {
        const dateKey = format(parsedDate, 'yyyy-MM-dd');
        const mapKey = `${tc}_${dateKey}`;
        if (!entryRecordsByTcDate.has(mapKey)) {
          entryRecordsByTcDate.set(mapKey, []);
        }
        const eventTime = getFormattedEventDateTime(row, tarihColIdx, saatColIdx, islemColIdx, originalHeaders);
        entryRecordsByTcDate.get(mapKey)!.push({ row, originalIndex: i, eventTime });
      }
    }
    if (i > 0 && i % 100 === 0) { // Reduced chunk size to 100
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
    }
  }
  
  // Sort grouped entry records by event time
  const groupKeys = Array.from(entryRecordsByTcDate.keys());
  for (let i = 0; i < groupKeys.length; i++) {
    const key = groupKeys[i];
    entryRecordsByTcDate.get(key)!.sort((a, b) => (a.eventTime || "").localeCompare(b.eventTime || ""));
    if (i > 0 && i % 50 === 0) { // Yield after sorting a batch of groups
        await new Promise(resolve => setTimeout(resolve, 0));
    }
  }


  // Process deletion records
  for (let i = 0; i < workingRows.length; i++) {
    const currentRow = workingRows[i];
    const currentIslemOriginalCase = String(currentRow[islemColIdx] || '').trim();
    const currentIslemLc = currentIslemOriginalCase.toLocaleLowerCase('tr-TR');
    
    if (currentIslemLc.includes(ISLEM_TYPES.SILME)) {
      currentRow[highlightMarkerColIdx] = true; 

      const tc = String(currentRow[tcColIdx] || '').trim();
      const dateValue = currentRow[tarihColIdx];
      const parsedDate = parseTurkishDate(dateValue);

      if (tc && parsedDate && isValid(parsedDate)) {
        const dateKey = format(parsedDate, 'yyyy-MM-dd');
        const mapKey = `${tc}_${dateKey}`;
        const relatedEntryRecords = entryRecordsByTcDate.get(mapKey) || [];
        
        if (relatedEntryRecords.length > 0) {
          const entryRecordInfo = relatedEntryRecords[0]; 
          const entryRow = entryRecordInfo.row;
          const entryIslemOriginalCase = String(entryRow[islemColIdx] || '').trim();
          
          currentRow[islemColIdx] = `${entryIslemOriginalCase} / ${currentIslemOriginalCase}`;
          
          const entryTime = formatDateToHHMMSS(parseTurkishDate(getFormattedEventDateTime(entryRow, tarihColIdx, saatColIdx, islemColIdx, originalHeaders)));
          if (saatColIdx !== -1) {
            currentRow[saatColIdx] = entryTime;
          } else {
             console.warn("Saat sütunu bulunamadı, giriş saati Silme kaydının Saat sütununa yazılamadı.");
          }
        } else {
           currentRow[islemColIdx] = `Giriş/Kayıt Bulunamadı / ${currentIslemOriginalCase}`;
        }
      }
    }
    if (i > 0 && i % 100 === 0) { // Reduced chunk size to 100
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
    }
  }
  
  return { headers: outputHeaders, rows: workingRows };
}

