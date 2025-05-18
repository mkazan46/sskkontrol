
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToHHMMSS, DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING } from './date-utils';
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

export const ANALYSIS_HIGHLIGHT_MARKER_HEADER = "__isDeletionAnalyzedAndHighlighted";
export const CONSUMED_BY_ANALYSIS_MARKER_HEADER = "__isConsumedByAnalysis";

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

// Helper to get event time string, crucial for sorting and comparison
function getEventDateTimeString(row: any[], tarihColIdx: number, saatColIdx: number, islemColIdx: number, headers: string[]): string {
    const dateValue = tarihColIdx !== -1 ? row[tarihColIdx] : null;
    const parsedDateOnly = parseTurkishDate(dateValue);

    if (!parsedDateOnly || !isValid(parsedDateOnly)) {
        // If date itself is invalid, we can't reliably form a datetime string
        return "0000-00-00 00:00:00"; // Default for unparseable dates for sorting
    }

    let timeString = saatColIdx !== -1 ? String(row[saatColIdx] || '').trim() : '';
    let extractedFromIslem = false;

    // Try to extract time from 'İşlem' column if 'Saat' is empty, or if 'Saat' might be a full date string itself
    if (!timeString || (timeString && parseTurkishDate(timeString)?.toDateString() === parsedDateOnly.toDateString())) {
        const islemValue = islemColIdx !== -1 ? String(row[islemColIdx] || '').trim() : '';
        const timePattern = /\b(\d{1,2}:\d{2}(:\d{2})?)\b/; // HH:mm or HH:mm:ss
        const match = islemValue.match(timePattern);
        if (match && match[1]) {
            timeString = match[1];
            extractedFromIslem = true;
        }
    }
    
    const parsedTime = parseTurkishDate(timeString); // This can parse "HH:mm", "HH:mm:ss", or even a full date-time if timeString ended up being that
    
    let eventDateTime = new Date(parsedDateOnly); // Start with the date part

    if (parsedTime && isValid(parsedTime)) {
        // If timeString was just time (e.g., "14:30") or a full date-time where time is relevant
        if (extractedFromIslem || (timeString.length <= 8 && timeString.includes(':'))) { // Likely just time
             eventDateTime.setHours(parsedTime.getHours(), parsedTime.getMinutes(), parsedTime.getSeconds(), parsedTime.getMilliseconds());
        } else if (parsedTime.toDateString() === parsedDateOnly.toDateString()) { // If parsedTime is a full date-time that matches parsedDateOnly, use its time
             eventDateTime.setHours(parsedTime.getHours(), parsedTime.getMinutes(), parsedTime.getSeconds(), parsedTime.getMilliseconds());
        } else if (timeString) { // If timeString was something but didn't parse into a simple time or matching date-time, less certain
             // This case might need more specific handling if time is embedded in complex strings not caught by regex
             // For now, if we have a parsedTime, we'll use its time components.
             eventDateTime.setHours(parsedTime.getHours(), parsedTime.getMinutes(), parsedTime.getSeconds(), parsedTime.getMilliseconds());
        }
    }
    // If no valid time component was found or parsed, eventDateTime remains just the date with 00:00:00.000

    if (!isValid(eventDateTime)) { // Final check
        return format(parsedDateOnly, 'yyyy-MM-dd') + " 00:00:00"; // Fallback if combination becomes invalid
    }
    return format(eventDateTime, 'yyyy-MM-dd HH:mm:ss');
}


export async function extractDeletionRelatedRecords(mergedData: MergedExcelData): Promise<MergedExcelData> {
  if (!mergedData || mergedData.rows.length === 0) {
    return { 
      headers: [...(mergedData?.headers || []), ANALYSIS_HIGHLIGHT_MARKER_HEADER, CONSUMED_BY_ANALYSIS_MARKER_HEADER], 
      rows: [] 
    };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const tarihColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const saatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat");

  if (tcColIdx === -1 || tarihColIdx === -1 || islemColIdx === -1) {
    console.error("Analiz için gerekli sütunlar (TC Kimlik No, Tarih, İşlem) bulunamadı.");
    const rowsWithMarkers = originalRows.map(row => [...row, false, false]);
    return { headers: [...originalHeaders, ANALYSIS_HIGHLIGHT_MARKER_HEADER, CONSUMED_BY_ANALYSIS_MARKER_HEADER], rows: rowsWithMarkers };
  }

  const outputHeaders = [...originalHeaders, ANALYSIS_HIGHLIGHT_MARKER_HEADER, CONSUMED_BY_ANALYSIS_MARKER_HEADER];
  const highlightMarkerColOutputIdx = outputHeaders.indexOf(ANALYSIS_HIGHLIGHT_MARKER_HEADER);
  const consumedMarkerColOutputIdx = outputHeaders.indexOf(CONSUMED_BY_ANALYSIS_MARKER_HEADER);

  const workingRows: any[][] = originalRows.map(row => [...row, false, false]);

  type EventRecord = { rowData: any[], originalIndex: number, eventTime: string, type: 'giriş' | 'çıkış' };
  const eventsByTcDate = new Map<string, { giris: EventRecord[], cikis: EventRecord[] }>();

  for (let i = 0; i < workingRows.length; i++) {
    const row = workingRows[i]; // This is the raw row from original data, markers not yet reliable here
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[tarihColIdx];
    const parsedDate = parseTurkishDate(dateValue);

    if (!tc || !parsedDate || !isValid(parsedDate)) continue;

    const dateKey = format(parsedDate, 'yyyy-MM-dd');
    const mapKey = `${tc}_${dateKey}`;
    const islemContent = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    const eventTime = getEventDateTimeString(row, tarihColIdx, saatColIdx, islemColIdx, originalHeaders);

    if (!eventsByTcDate.has(mapKey)) {
      eventsByTcDate.set(mapKey, { giris: [], cikis: [] });
    }
    const group = eventsByTcDate.get(mapKey)!;

    // We use workingRows[i] here to ensure we're referencing the mutable copy
    if (islemContent.includes(ISLEM_TYPES.GIRIS) || islemContent.includes(ISLEM_TYPES.KAYIT)) {
      group.giris.push({ rowData: workingRows[i], originalIndex: i, eventTime, type: 'giriş' });
    } else if (islemContent.includes(ISLEM_TYPES.CIKIS)) {
      group.cikis.push({ rowData: workingRows[i], originalIndex: i, eventTime, type: 'çıkış' });
    }
    if (i > 0 && i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const groupKeys = Array.from(eventsByTcDate.keys());
  for (let i = 0; i < groupKeys.length; i++) {
    const key = groupKeys[i];
    const group = eventsByTcDate.get(key)!;
    group.giris.sort((a, b) => a.eventTime.localeCompare(b.eventTime));
    group.cikis.sort((a, b) => a.eventTime.localeCompare(b.eventTime));
    if (i > 0 && i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  for (let i = 0; i < workingRows.length; i++) {
    const currentRow = workingRows[i]; 
    const currentIslemContentOriginalCase = String(currentRow[islemColIdx] || '').trim();
    const currentIslemContentLc = currentIslemContentOriginalCase.toLocaleLowerCase('tr-TR');

    if (currentIslemContentLc.includes(ISLEM_TYPES.SILME)) {
      currentRow[highlightMarkerColOutputIdx] = true; 

      const tc = String(currentRow[tcColIdx] || '').trim();
      const dateValue = currentRow[tarihColIdx];
      const parsedDate = parseTurkishDate(dateValue);

      if (tc && parsedDate && isValid(parsedDate)) {
        const dateKey = format(parsedDate, 'yyyy-MM-dd');
        const mapKey = `${tc}_${dateKey}`;
        const relatedEventsGroup = eventsByTcDate.get(mapKey);

        if (relatedEventsGroup) {
          const girisEvent = relatedEventsGroup.giris.find(
            g => workingRows[g.originalIndex][consumedMarkerColOutputIdx] === false
          );

          if (girisEvent) {
            const originalGirisIslem = String(girisEvent.rowData[islemColIdx] || '').trim();
            
            currentRow[islemColIdx] = `${originalGirisIslem} Kaydı İptal Edildi (${currentIslemContentOriginalCase})`;
            
            const girisSaatValue = parseTurkishDate(girisEvent.eventTime); // eventTime is 'yyyy-MM-dd HH:mm:ss'
            if (saatColIdx !== -1 && girisSaatValue && isValid(girisSaatValue)) {
              currentRow[saatColIdx] = formatDateToHHMMSS(girisSaatValue);
            } else if (saatColIdx !== -1) {
                 currentRow[saatColIdx] = ""; // Clear or set to a placeholder if no valid time
            }
            
            workingRows[girisEvent.originalIndex][consumedMarkerColOutputIdx] = true;

            const cikisEvent = relatedEventsGroup.cikis.find(
              c => workingRows[c.originalIndex][consumedMarkerColOutputIdx] === false &&
                   c.eventTime >= girisEvent.eventTime 
            );
            if (cikisEvent) {
              workingRows[cikisEvent.originalIndex][consumedMarkerColOutputIdx] = true;
              // Optionally, refine the 'İşlem' message further
              // currentRow[islemColIdx] = `${originalGirisIslem} ve İlişkili Çıkış Kaydı İptal Edildi (${currentIslemContentOriginalCase})`;
            }
          } else {
            currentRow[islemColIdx] = `İlişkili Giriş Bulunamadı / ${currentIslemContentOriginalCase}`;
          }
        } else {
           currentRow[islemColIdx] = `İlişkili Giriş/Çıkış Grubu Yok / ${currentIslemContentOriginalCase}`;
        }
      }
    }
    if (i > 0 && i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return { headers: outputHeaders, rows: workingRows };
}

