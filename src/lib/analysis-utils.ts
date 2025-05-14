
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToDDMMYYYY, formatDateToHHMMSS, formatDateToYYYYMMDD } from './date-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

// Constants for column header matching (all lowercase for case-insensitive comparison)
const TC_KIMLIK_NO_HEADERS_ANALYSIS = ["tc kimlik no", "tckn", "kimlik no", "tc no", "tc", "vatandaşlık no", "t.c. kimlik no", "t.c kimlik no", "t.c. no", "tc kimlik numarası"];
const AD_SOYAD_HEADERS_ANALYSIS = ["ad soyad", "adı soyadı", "isim soyisim", "adsoyad", "isim", "personel", "çalışan"];
const TARIH_HEADERS_ANALYSIS = ["tarih", "işlem tarihi", "kayıt tarihi", "gün"]; // This is expected to be the GROUPING date
const ISLEM_HEADERS_ANALYSIS = ["işlem", "açıklama", "işlem türü", "olay", "hareket tipi"];
const SAAT_HEADERS_ANALYSIS = ["saat", "işlem saati", "zaman", "giriş saati", "çıkış saati"]; // This is expected to be the EVENT time

const ISLEM_TYPES = {
  SILME: "silme",
  GIRIS: "giriş",
  CIKIS: "çıkış",
  KAYIT: "kayıt", // Added for flexibility, as "Kayıt" was in user image
};

const ANALYSIS_HEADERS = [
  "Analiz: Giriş Saati",
  "Analiz: Çıkış Saati",
  "Analiz: Silme Saati",
  "Analiz: Silme Detayı"
];

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

// Extracts time from either dedicated 'Saat' column or 'İşlem' column if applicable
// tarihColIdx here is the GROUPING date column index.
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

// Helper to get full date-time string for an event
// groupingDateColIdx is the index of the main date column used for grouping (e.g., Col D in image)
// eventSpecificSaatColIdx is the index of the column containing the specific time (or datetime) of the event (e.g., Col I or H+I)
// eventSpecificIslemColIdx is the index of the column containing the işlem string, which might contain date/time.
function getFormattedEventDateTime(row: any[], groupingDateColIdx: number, eventSpecificSaatColIdx: number, eventSpecificIslemColIdx: number): string {
  let eventDateObj: Date | null = null;
  
  // Try to parse date from the event's specific "saat" column first, as it might be a full datetime string
  if (eventSpecificSaatColIdx !== -1 && row[eventSpecificSaatColIdx] !== null && String(row[eventSpecificSaatColIdx]).trim() !== "") {
    eventDateObj = parseTurkishDate(row[eventSpecificSaatColIdx]);
  }

  // If not a valid date from "saat" column, try to parse from "işlem" column
  if ((!eventDateObj || !isValid(eventDateObj)) && eventSpecificIslemColIdx !== -1 && row[eventSpecificIslemColIdx] !== null && String(row[eventSpecificIslemColIdx]).trim() !== "") {
      eventDateObj = parseTurkishDate(row[eventSpecificIslemColIdx]);
  }

  // If still no valid date, fall back to the grouping date column and try to combine with time from "saat" or "işlem"
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
         // If no time found, use grouping date as is (time will be 00:00:00)
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
  // This 'tarihColIdx' is the main date used for grouping records by day for a TC.
  const groupingDateColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih (Gruplama İçin)");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  // This 'saatColIdx' is the column most likely to hold the specific time (or datetime) of the event.
  const eventSaatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat (Etkinlik Zamanı)");


  if (tcColIdx === -1 || groupingDateColIdx === -1 || islemColIdx === -1) {
    console.error("Gerekli sütunlar (TC Kimlik No, Tarih (Gruplama), İşlem) bulunamadı. Analiz yapılamıyor.");
    return { 
        headers: [...originalHeaders, "Analiz Hatası"], 
        rows: originalRows.map(row => [...row, "TC Kimlik No, Tarih (Gruplama) veya İşlem sütunu bulunamadı."]) 
    };
  }
  
  const augmentedHeaders = [...originalHeaders, ...ANALYSIS_HEADERS];
  const processedRows: any[][] = [];

  const recordsByTcDate = new Map<string, { giris: any[][], cikis: any[][], silme: any[][] }>();
  originalRows.forEach(row => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[groupingDateColIdx]; // Use grouping date
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedGroupingDate = parseTurkishDate(dateValue);
    if (!tc || !parsedGroupingDate) return; 

    const dateKey = formatDateToYYYYMMDD(parsedGroupingDate);
    const mapKey = `${tc}_${dateKey}`;

    if (!recordsByTcDate.has(mapKey)) {
      recordsByTcDate.set(mapKey, { giris: [], cikis: [], silme: [] });
    }
    const group = recordsByTcDate.get(mapKey)!;

    if (islem.includes(ISLEM_TYPES.GIRIS) || islem.includes(ISLEM_TYPES.KAYIT)) group.giris.push(row);
    else if (islem.includes(ISLEM_TYPES.CIKIS)) group.cikis.push(row);
    else if (islem.includes(ISLEM_TYPES.SILME)) group.silme.push(row);
  });


  for (const originalRow of originalRows) {
    const tc = String(originalRow[tcColIdx] || '').trim();
    const groupingDateValue = originalRow[groupingDateColIdx]; // Grouping date
    const islem = String(originalRow[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);

    let analizGirisFormatted = "";
    let analizCikisFormatted = "";
    let analizSilmeFormatted = "";
    let analizIslemDetayi = String(originalRow[islemColIdx] || '').trim(); // Default to its own işlem

    if (tc && parsedGroupingDate && islem.includes(ISLEM_TYPES.SILME)) {
      // Format Silme event's own date and time
      analizSilmeFormatted = getFormattedEventDateTime(originalRow, groupingDateColIdx, eventSaatColIdx, islemColIdx);
      
      const dateKey = formatDateToYYYYMMDD(parsedGroupingDate);
      const mapKey = `${tc}_${dateKey}`;
      const group = recordsByTcDate.get(mapKey);

      if (group) {
        // Process Giriş records
        if (group.giris.length > 0) {
          group.giris.sort((a, b) => { // Sort by event time to get the earliest
            const timeA = getFormattedEventDateTime(a, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            const timeB = getFormattedEventDateTime(b, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            return (timeA || "").localeCompare(timeB || "");
          });
          analizGirisFormatted = getFormattedEventDateTime(group.giris[0], groupingDateColIdx, eventSaatColIdx, islemColIdx);
          
          // Update işlem detayı
          const girisIslemTuru = String(group.giris[0][islemColIdx] || '').trim();
          const silmeIslemTuru = String(originalRow[islemColIdx] || '').trim();
          analizIslemDetayi = `${girisIslemTuru} / ${silmeIslemTuru}`;
        }
        
        // Process Çıkış records
        if (group.cikis.length > 0) {
           group.cikis.sort((a, b) => { // Sort by event time
            const timeA = getFormattedEventDateTime(a, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            const timeB = getFormattedEventDateTime(b, groupingDateColIdx, eventSaatColIdx, islemColIdx);
            return (timeA || "").localeCompare(timeB || "");
          });
          analizCikisFormatted = getFormattedEventDateTime(group.cikis[0], groupingDateColIdx, eventSaatColIdx, islemColIdx);
        }
      }
    }
    processedRows.push([...originalRow, analizGirisFormatted, analizCikisFormatted, analizSilmeFormatted, analizIslemDetayi]);
  }
  
  return { headers: augmentedHeaders, rows: processedRows };
}
