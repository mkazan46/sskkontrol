
'use client';

import type { MergedExcelData } from './excel-utils';
import { parseTurkishDate, formatDateToDDMMYYYY, formatDateToHHMMSS, formatDateToYYYYMMDD } from './date-utils';

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
function extractTimeFromRow(row: any[], saatColIdx: number, islemColIdx: number, tarihColIdx: number): string {
    let timeValue = saatColIdx !== -1 ? row[saatColIdx] : null;
    
    // If no 'Saat' column or 'Saat' column is empty/same as date, try 'İşlem' column
    if (saatColIdx === -1 || timeValue === null || timeValue === "" || 
        (tarihColIdx !== -1 && String(row[tarihColIdx]) === String(timeValue))) {
      if (islemColIdx !== -1 && row[islemColIdx] !== null && String(row[islemColIdx]).trim() !== "") {
        const islemContent = String(row[islemColIdx]);
        // Basic regex to find time-like patterns (e.g., 10:30, 08:15:00)
        const timePattern = /\b(\d{1,2}:\d{2}(:\d{2})?)\b/;
        const match = islemContent.match(timePattern);
        if (match && match[1]) {
          timeValue = match[1];
        } else if (tarihColIdx !== -1 && row[tarihColIdx] !== row[islemColIdx]) {
           // If 'İşlem' is different from 'Tarih', it might contain the time as part of a datetime string
           timeValue = row[islemColIdx];
        }
      }
    }

    const parsedTime = parseTurkishDate(timeValue); // parseTurkishDate can handle time-only or datetime strings
    return parsedTime ? formatDateToHHMMSS(parsedTime) : (typeof timeValue === 'string' && timeValue.match(/\d{1,2}:\d{2}/) ? timeValue : "");
}


export function extractDeletionRelatedRecords(mergedData: MergedExcelData): MergedExcelData {
  if (!mergedData || mergedData.rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const tarihColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const saatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat"); // May be -1

  if (tcColIdx === -1 || tarihColIdx === -1 || islemColIdx === -1) {
    console.error("Gerekli sütunlar (TC Kimlik No, Tarih, İşlem) bulunamadı. Analiz yapılamıyor.");
    // Return original data with an error message or indication
    // For now, we return original data as the analysis cannot proceed.
    // A toast message will be shown from the calling page.
    return { 
        headers: [...originalHeaders, "Analiz Hatası"], 
        rows: originalRows.map(row => [...row, "TC Kimlik No, Tarih veya İşlem sütunu bulunamadı."]) 
    };
  }
  
  const augmentedHeaders = [...originalHeaders, ...ANALYSIS_HEADERS];
  const processedRows: any[][] = [];

  // Group records by TC and Date string for easier lookup of related entries
  const recordsByTcDate = new Map<string, { giris: any[][], cikis: any[][], silme: any[][] }>();
  originalRows.forEach(row => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[tarihColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedDate = parseTurkishDate(dateValue);
    if (!tc || !parsedDate) return; 

    const dateKey = formatDateToYYYYMMDD(parsedDate);
    const mapKey = `${tc}_${dateKey}`;

    if (!recordsByTcDate.has(mapKey)) {
      recordsByTcDate.set(mapKey, { giris: [], cikis: [], silme: [] });
    }
    const group = recordsByTcDate.get(mapKey)!;

    // Store the original row reference
    if (islem.includes(ISLEM_TYPES.GIRIS)) group.giris.push(row);
    else if (islem.includes(ISLEM_TYPES.CIKIS)) group.cikis.push(row);
    else if (islem.includes(ISLEM_TYPES.SILME)) group.silme.push(row);
  });


  for (const originalRow of originalRows) {
    const tc = String(originalRow[tcColIdx] || '').trim();
    const dateValue = originalRow[tarihColIdx];
    const islem = String(originalRow[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    const parsedOriginalDate = parseTurkishDate(dateValue);

    let ilgiliGirisSaati = "";
    let ilgiliCikisSaati = "";
    let silmeKaydiSaati = "";
    let silmeKaydiAciklamasi = "";

    if (tc && parsedOriginalDate && islem.includes(ISLEM_TYPES.SILME)) {
      silmeKaydiSaati = extractTimeFromRow(originalRow, saatColIdx, islemColIdx, tarihColIdx);
      silmeKaydiAciklamasi = String(originalRow[islemColIdx] || '').trim();
      
      const dateKey = formatDateToYYYYMMDD(parsedOriginalDate);
      const mapKey = `${tc}_${dateKey}`;
      const group = recordsByTcDate.get(mapKey);

      if (group) {
        if (group.giris.length > 0) {
          // Sort giriş by time to get the earliest, if multiple exists
          group.giris.sort((a, b) => {
            const timeA = extractTimeFromRow(a, saatColIdx, islemColIdx, tarihColIdx);
            const timeB = extractTimeFromRow(b, saatColIdx, islemColIdx, tarihColIdx);
            return timeA.localeCompare(timeB);
          });
          ilgiliGirisSaati = extractTimeFromRow(group.giris[0], saatColIdx, islemColIdx, tarihColIdx);
        }
        if (group.cikis.length > 0) {
           // Sort çıkış by time to get the earliest
          group.cikis.sort((a, b) => {
            const timeA = extractTimeFromRow(a, saatColIdx, islemColIdx, tarihColIdx);
            const timeB = extractTimeFromRow(b, saatColIdx, islemColIdx, tarihColIdx);
            return timeA.localeCompare(timeB);
          });
          ilgiliCikisSaati = extractTimeFromRow(group.cikis[0], saatColIdx, islemColIdx, tarihColIdx);
        }
      }
    }
    processedRows.push([...originalRow, ilgiliGirisSaati, ilgiliCikisSaati, silmeKaydiSaati, silmeKaydiAciklamasi]);
  }
  
  // No specific sorting needed here as original order is preserved. Sorting is done during initial merge.
  return { headers: augmentedHeaders, rows: processedRows };
}
