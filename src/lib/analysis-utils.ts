
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

// Output headers for the new analysis table
const ANALYSIS_RESULT_HEADERS = [
  "TC Kimlik No", 
  "Adı Soyadı",
  "İşlem Tarihi", 
  "Birleştirilmiş İşlem", 
  "Olay Saati (Giriş/Silme)"
];


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

function getFormattedEventDateTime(row: any[], groupingDateColIdx: number, eventSaatColIdx: number, islemColIdx: number): string {
    const groupingDateValue = row[groupingDateColIdx];
    const parsedGroupingDate = parseTurkishDate(groupingDateValue);
    if (!parsedGroupingDate || !isValid(parsedGroupingDate)) return "";

    const timeStr = extractTimeFromRow(row, eventSaatColIdx, islemColIdx, groupingDateColIdx);
    if (!timeStr) return format(parsedGroupingDate, 'yyyy-MM-dd HH:mm:ss'); 

    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    
    const eventDateTime = new Date(parsedGroupingDate);
    eventDateTime.setHours(hours || 0, minutes || 0, seconds || 0, 0);
    
    if (!isValid(eventDateTime)) return format(parsedGroupingDate, 'yyyy-MM-dd HH:mm:ss'); 

    return format(eventDateTime, 'yyyy-MM-dd HH:mm:ss');
}


export async function extractDeletionRelatedRecords(mergedData: MergedExcelData): Promise<MergedExcelData> {
  if (!mergedData || mergedData.rows.length === 0) {
    return { headers: ANALYSIS_RESULT_HEADERS, rows: [] };
  }

  const { headers: originalHeaders, rows: originalRows } = mergedData;

  const tcColIdx = findColumnIndex(originalHeaders, TC_KIMLIK_NO_HEADERS_ANALYSIS, "TC Kimlik No");
  const adSoyadColIdx = findColumnIndex(originalHeaders, AD_SOYAD_HEADERS_ANALYSIS, "Adı Soyadı");
  const tarihColIdx = findColumnIndex(originalHeaders, TARIH_HEADERS_ANALYSIS, "Tarih");
  const islemColIdx = findColumnIndex(originalHeaders, ISLEM_HEADERS_ANALYSIS, "İşlem");
  const saatColIdx = findColumnIndex(originalHeaders, SAAT_HEADERS_ANALYSIS, "Saat");

  if (tcColIdx === -1 || tarihColIdx === -1 || islemColIdx === -1) {
    console.error("Analiz için gerekli sütunlar (TC Kimlik No, Tarih, İşlem) bulunamadı.");
    // Return an empty structure with analysis headers so the target page can render "no data"
    return { headers: ANALYSIS_RESULT_HEADERS, rows: [] };
  }
  
  const analysisResultRows: any[][] = [];

  const recordsByTcDate = new Map<string, any[][]>();
  for (let i = 0; i < originalRows.length; i++) {
    const row = originalRows[i];
    const tc = String(row[tcColIdx] || '').trim();
    const dateValue = row[tarihColIdx];
    const parsedDate = parseTurkishDate(dateValue);

    if (tc && parsedDate && isValid(parsedDate)) {
      const dateKey = format(parsedDate, 'yyyy-MM-dd');
      const mapKey = `${tc}_${dateKey}`;
      if (!recordsByTcDate.has(mapKey)) {
        recordsByTcDate.set(mapKey, []);
      }
      // Store the original row, not a modified version
      recordsByTcDate.get(mapKey)!.push(row); 
    }
    if (i > 0 && i % 200 === 0) { 
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  const groupKeys = Array.from(recordsByTcDate.keys());
  for (let i = 0; i < groupKeys.length; i++) {
      const key = groupKeys[i];
      const group = recordsByTcDate.get(key)!;
      group.sort((rowA, rowB) => {
        const timeA = getFormattedEventDateTime(rowA, tarihColIdx, saatColIdx, islemColIdx);
        const timeB = getFormattedEventDateTime(rowB, tarihColIdx, saatColIdx, islemColIdx);
        return (timeA || "").localeCompare(timeB || "");
      });
      if (i > 0 && i % 100 === 0) { 
           await new Promise(resolve => setTimeout(resolve, 0));
      }
  }

  for (let i = 0; i < originalRows.length; i++) {
    const currentRow = originalRows[i];
    const currentIslemOriginalCase = String(currentRow[islemColIdx] || '').trim();
    const currentIslemLc = currentIslemOriginalCase.toLocaleLowerCase('tr-TR');
    
    if (currentIslemLc.includes(ISLEM_TYPES.SILME)) {
      const tc = String(currentRow[tcColIdx] || '').trim();
      const dateValue = currentRow[tarihColIdx];
      const parsedDate = parseTurkishDate(dateValue);

      if (tc && parsedDate && isValid(parsedDate)) {
        const dateKey = format(parsedDate, 'yyyy-MM-dd');
        const mapKey = `${tc}_${dateKey}`;
        const relatedRecordsOnSameDay = recordsByTcDate.get(mapKey) || [];
        
        let foundGirisRow: any = null;
        for (const relatedRow of relatedRecordsOnSameDay) {
            const relatedIslemLc = String(relatedRow[islemColIdx] || '').toLocaleLowerCase('tr-TR').trim();
            if (relatedIslemLc.includes(ISLEM_TYPES.GIRIS) || relatedIslemLc.includes(ISLEM_TYPES.KAYIT)) {
                foundGirisRow = relatedRow;
                break; 
            }
        }

        const silmeSaatStr = extractTimeFromRow(currentRow, saatColIdx, islemColIdx, tarihColIdx);
        const adiSoyadi = adSoyadColIdx !== -1 ? String(currentRow[adSoyadColIdx] || '') : '';
        const islemTarihiFormatted = format(parsedDate, 'dd.MM.yyyy');

        if (foundGirisRow) {
          const girisIslemOriginalCase = String(foundGirisRow[islemColIdx] || '').trim();
          const girisSaatStr = extractTimeFromRow(foundGirisRow, saatColIdx, islemColIdx, tarihColIdx);
          const girisAdiSoyadi = adSoyadColIdx !== -1 ? String(foundGirisRow[adSoyadColIdx] || '') : adiSoyadi;
          
          analysisResultRows.push([
            tc,
            girisAdiSoyadi,
            islemTarihiFormatted,
            `${girisIslemOriginalCase} / ${currentIslemOriginalCase}`,
            girisSaatStr || silmeSaatStr, 
          ]);
        } else {
          // Silme kaydı var ama ilişkili Giriş bulunamadı.
          analysisResultRows.push([
            tc,
            adiSoyadi,
            islemTarihiFormatted,
            `Giriş Bulunamadı / ${currentIslemOriginalCase}`,
            silmeSaatStr,
          ]);
        }
      }
    }
    if (i > 0 && i % 200 === 0) { 
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return { headers: ANALYSIS_RESULT_HEADERS, rows: analysisResultRows };
}
