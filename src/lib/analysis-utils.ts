
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

interface ProcessedDeletionData {
  headers: string[];
  rows: any[][];
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

export function extractDeletionRelatedRecords(mergedData: MergedExcelData): ProcessedDeletionData {
  if (!mergedData || mergedData.rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const adSoyadColIdx = findColumnIndex(originalHeaders, AD_SOYAD_HEADERS_ANALYSIS, "Adı Soyadı");
  const tarihColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const saatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat");

  if (tcColIdx === -1 || tarihColIdx === -1 || islemColIdx === -1) {
    console.error("Gerekli sütunlar (TC Kimlik No, Tarih, İşlem) bulunamadı. Analiz yapılamıyor.");
    // Return original headers but with a message row, or specific error headers
    return { 
        headers: ["Hata"], 
        rows: [["TC Kimlik No, Tarih veya İşlem sütunu bulunamadığı için silme analizi yapılamadı."]] 
    };
  }

  const outputHeaders = [
    "TC Kimlik No", 
    "Adı Soyadı", 
    "İşlem Tarihi", 
    "Giriş Saati", 
    "Çıkış Saati", 
    "Silme Saati", 
    "Silme İşlem Detayı"
  ];
  const analysisRows: any[][] = [];

  // Group records by TC and Date for easier lookup
  // Key: "TCKimlikNo_YYYY-MM-DD", Value: { giris: row[], cikis: row[], silme: row[] }
  const recordsByTcDate = new Map<string, { giris: any[][], cikis: any[][], silme: any[][] }>();

  originalRows.forEach(row => {
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[tarihColIdx];
    const islem = String(row[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
    
    const parsedDate = parseTurkishDate(dateValue);
    if (!tc || !parsedDate) return; // Skip if no TC or invalid date

    const dateKey = formatDateToYYYYMMDD(parsedDate);
    const mapKey = `${tc}_${dateKey}`;

    if (!recordsByTcDate.has(mapKey)) {
      recordsByTcDate.set(mapKey, { giris: [], cikis: [], silme: [] });
    }
    const group = recordsByTcDate.get(mapKey)!;

    if (islem.includes(ISLEM_TYPES.GIRIS)) group.giris.push(row);
    else if (islem.includes(ISLEM_TYPES.CIKIS)) group.cikis.push(row);
    else if (islem.includes(ISLEM_TYPES.SILME)) group.silme.push(row);
  });

  // Process groups that have "silme" records
  for (const [_mapKey, group] of recordsByTcDate) {
    if (group.silme.length > 0) {
      group.silme.forEach(silmeRow => {
        const tc = String(silmeRow[tcColIdx] || '').trim();
        const adSoyad = adSoyadColIdx !== -1 ? String(silmeRow[adSoyadColIdx] || '').trim() : "";
        
        const silmeDateValue = silmeRow[tarihColIdx];
        const parsedSilmeDate = parseTurkishDate(silmeDateValue);
        const formattedSilmeDate = parsedSilmeDate ? formatDateToDDMMYYYY(parsedSilmeDate) : "N/A";

        const silmeSaatValue = saatColIdx !== -1 ? silmeRow[saatColIdx] : (islemColIdx !== -1 && silmeRow[islemColIdx] !== silmeRow[tarihColIdx] ? silmeRow[islemColIdx] : "N/A"); // Attempt to get from 'Saat' or 'İşlem' if different from date
        const parsedSilmeSaat = parseTurkishDate(silmeSaatValue); // parseTurkishDate can handle time-only strings if they are part of its formats
        const formattedSilmeSaat = parsedSilmeSaat ? formatDateToHHMMSS(parsedSilmeSaat) : (typeof silmeSaatValue === 'string' && silmeSaatValue.match(/\d{1,2}:\d{2}/) ? silmeSaatValue : "N/A");
        
        const silmeIslemDetayi = String(silmeRow[islemColIdx] || '').trim();

        // Find first giriş and çıkış for this TC/Date
        let girisSaatStr = "";
        if (group.giris.length > 0) {
          const girisRow = group.giris[0]; // Take the first giriş
          const girisSaatValue = saatColIdx !== -1 ? girisRow[saatColIdx] : (islemColIdx !== -1 && girisRow[islemColIdx] !== girisRow[tarihColIdx] ? girisRow[islemColIdx] : "N/A");
          const parsedGirisSaat = parseTurkishDate(girisSaatValue);
          girisSaatStr = parsedGirisSaat ? formatDateToHHMMSS(parsedGirisSaat) : (typeof girisSaatValue === 'string' && girisSaatValue.match(/\d{1,2}:\d{2}/) ? girisSaatValue : "N/A");
        }

        let cikisSaatStr = "";
        if (group.cikis.length > 0) {
          const cikisRow = group.cikis[0]; // Take the first çıkış
          const cikisSaatValue = saatColIdx !== -1 ? cikisRow[saatColIdx] : (islemColIdx !== -1 && cikisRow[islemColIdx] !== cikisRow[tarihColIdx] ? cikisRow[islemColIdx] : "N/A");
          const parsedCikisSaat = parseTurkishDate(cikisSaatValue);
          cikisSaatStr = parsedCikisSaat ? formatDateToHHMMSS(parsedCikisSaat) : (typeof cikisSaatValue === 'string' && cikisSaatValue.match(/\d{1,2}:\d{2}/) ? cikisSaatValue : "N/A");
        }
        
        // Only add if there's a silme operation for this TC/Date
        analysisRows.push([
          tc,
          adSoyad,
          formattedSilmeDate,
          girisSaatStr,
          cikisSaatStr,
          formattedSilmeSaat,
          silmeIslemDetayi
        ]);
      });
    }
  }
  
  // Sort results by TC then Date for consistent output
  analysisRows.sort((a, b) => {
    const tcComp = String(a[0]).localeCompare(String(b[0]), 'tr-TR');
    if (tcComp !== 0) return tcComp;
    
    // Dates are at index 2, in dd.MM.yyyy. Convert back for sorting or sort as string.
    // For simplicity, string sort should be mostly fine if format is consistent.
    // A more robust sort would re-parse to Date objects.
    const dateA = parseTurkishDate(a[2]);
    const dateB = parseTurkishDate(b[2]);

    if (dateA && dateB) {
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return 0;
    } else if (dateA) {
      return -1; // dateA is valid, dateB is not
    } else if (dateB) {
      return 1; // dateB is valid, dateA is not
    }
    return String(a[2]).localeCompare(String(b[2])); // Fallback to string compare
  });


  return { headers: outputHeaders, rows: analysisRows };
}
