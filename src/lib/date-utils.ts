
'use client';

import { format, isValid, parse, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

// Extended list of headers that might contain date or time values in Turkish
export const DATE_HEADERS_TR_FORMATTING = ["tarih", "işlem tarihi", "doğum tarihi", "kayıt tarihi", "başlangıç tarihi", "bitiş tarihi", "geçerlilik tarihi"];
// Added new analysis-specific time headers
export const TIME_HEADERS_TR_FORMATTING = [
    "işlem saati", "saat", "başlangıç saati", "bitiş saati", "kayıt saati",
    "analiz: giriş saati", "analiz: çıkış saati", "analiz: silme saati", // New analysis headers for time formatting
    "ilgili giriş saati", "ilgili çıkış saati", "silme kaydı saati" // Alternative naming used in previous analysis logic
];

// Function to attempt parsing various Turkish and common international date formats
export const parseTurkishDate = (dateString: string | number | Date): Date | null => {
  if (dateString instanceof Date) {
    if (!isValid(dateString)) return null;
    let year = dateString.getFullYear();
    // Heuristic for 2-digit years that became e.g. 25 AD from cellDates: true
    // or years like 0024, 0025 due to data entry or other parsing issues.
    if (year >= 0 && year < 100) { 
      if (year <= 68) { // Assuming years 0-68 are 2000-2068
        dateString.setFullYear(year + 2000);
      } else { // Assuming years 69-99 are 1969-1999
        dateString.setFullYear(year + 1900);
      }
      if (!isValid(dateString)) return null; // Invalid after adjustment
    }
    return dateString;
  }

  if (typeof dateString === 'number') {
    if (dateString > 0 && dateString < 2958466) { // Check for Excel serial date range
      try {
        const excelEpoch = new Date(1899, 11, 30);
        const dateObj = new Date(excelEpoch.getTime() + (dateString - (dateString > 60 ? 1 : 0)) * 24 * 60 * 60 * 1000);
        
        if (!isValid(dateObj)) return null;

        let year = dateObj.getFullYear();
        if (year >= 0 && year < 100) {
            if(year <= 68) {
                dateObj.setFullYear(year + 2000);
            } else {
                dateObj.setFullYear(year + 1900);
            }
            if (!isValid(dateObj)) return null;
        }
        return dateObj;
      } catch (e) {
        return null;
      }
    }
    return null; // Not a valid Excel serial date number
  }


  if (typeof dateString !== 'string') {
    return null;
  }
  const trimmedDateString = dateString.trim();
  if (!trimmedDateString) return null;


  const formats = [
    // Turkish formats (dd.MM.yyyy)
    'dd.MM.yyyy HH:mm:ss', 'dd.MM.yyyy H:mm:ss', 'd.M.yyyy HH:mm:ss', 'd.M.yyyy H:mm:ss',
    'dd.MM.yyyy HH:mm', 'dd.MM.yyyy H:mm', 'd.M.yyyy HH:mm', 'd.M.yyyy H:mm',
    'dd.MM.yyyy', 'd.M.yyyy', 'dd.MM.yy', 'd.M.yy', // Added yy for Turkish

    // Turkish formats (dd/MM/yyyy)
    'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy H:mm:ss', 'd/M/yyyy HH:mm:ss', 'd/M/yyyy H:mm:ss',
    'dd/MM/yyyy HH:mm', 'dd/MM/yyyy H:mm', 'd/M/yyyy HH:mm', 'd/M/yyyy H:mm',
    'dd/MM/yyyy', 'd/M/yyyy', 'dd/MM/yy', 'd/M/yy', // Added yy for Turkish

    // ISO-like formats
    'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm', 'yyyy-MM-dd',
    'yyyy-MM-dd H:mm:ss', 'yyyy-MM-dd H:mm',

    // US formats (M/d/yy) - common in some Excel exports
    'M/d/yy HH:mm:ss', 'M/d/yy H:mm:ss', 'M/d/yy HH:mm', 'M/d/yy H:mm', 'M/d/yy',
    'MM/dd/yy HH:mm:ss', 'MM/dd/yy H:mm:ss', 'MM/dd/yy HH:mm', 'MM/dd/yy H:mm', 'MM/dd/yy',

    // US formats (M/d/yyyy)
    'M/d/yyyy HH:mm:ss', 'M/d/yyyy H:mm:ss', 'M/d/yyyy HH:mm', 'M/d/yyyy H:mm', 'M/d/yyyy',
    'MM/dd/yyyy HH:mm:ss', 'MM/dd/yyyy H:mm:ss', 'MM/dd/yyyy HH:mm', 'MM/dd/yyyy H:mm', 'MM/dd/yyyy',
    
    // US formats with hyphens (M-d-yy)
    'M-d-yy HH:mm:ss', 'M-d-yy H:mm:ss', 'M-d-yy HH:mm', 'M-d-yy H:mm', 'M-d-yy',
    'MM-dd-yy HH:mm:ss', 'MM-dd-yy H:mm:ss', 'MM-dd-yy HH:mm', 'MM-dd-yy H:mm', 'MM-dd-yy',

    // US formats with hyphens (M-d-yyyy)
    'M-d-yyyy HH:mm:ss', 'M-d-yyyy H:mm:ss', 'M-d-yyyy HH:mm', 'M-d-yyyy H:mm', 'M-d-yyyy',
    'MM-dd-yyyy HH:mm:ss', 'MM-dd-yyyy H:mm:ss', 'MM-dd-yyyy HH:mm', 'MM-dd-yyyy H:mm', 'MM-dd-yyyy',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(trimmedDateString, fmt, new Date());
      if (isValid(parsed)) {
        let year = parsed.getFullYear();
        // If the parsed year is between 0 and 99 (inclusive), 
        // it's likely a 20th/21st century year that needs adjustment.
        // This handles 'yy' formats or full dates that might have been misinterpreted initially.
        if (year >= 0 && year < 100) {
          if (year <= 68) { // Heuristic: years 0-68 are 2000-2068
            parsed.setFullYear(year + 2000);
          } else { // years 69-99 are 1969-1999
            parsed.setFullYear(year + 1900);
          }
          // After adjusting, if it becomes invalid, this format attempt failed.
          if (!isValid(parsed)) {
            continue; // Try next format
          }
        }
        return parsed; // Return the (potentially adjusted and still valid) date
      }
    } catch (e) {
      // continue trying other formats
    }
  }

  // Try ISO parse as a last resort for strings that might be like "2024-05-12T10:00:00.000Z"
  try {
    const isoParsed = parseISO(trimmedDateString);
    if (isValid(isoParsed)) {
      let year = isoParsed.getFullYear();
      // Apply year correction for ISO dates too, if they somehow ended up with a 2-digit year representation in data
      if (year >= 0 && year < 100) {
        if (year <= 68) {
          isoParsed.setFullYear(year + 2000);
        } else {
          isoParsed.setFullYear(year + 1900);
        }
        if (!isValid(isoParsed)) { // Check validity after adjustment
          return null; 
        }
      }
      return isoParsed;
    }
  } catch (e) { /* ignore if ISO parse fails */ }

  return null; // If no format matches
};

// Helper function to format Date object into dd.MM.yyyy string
export const formatDateToDDMMYYYY = (date: Date | null): string => {
  if (date && isValid(date)) {
    return format(date, 'dd.MM.yyyy', { locale: tr });
  }
  return "";
};

// Helper function to format Date object into HH:mm:ss string
export const formatDateToHHMMSS = (date: Date | null): string => {
  if (date && isValid(date)) {
    return format(date, 'HH:mm:ss');
  }
  return "";
};

// Helper function to format Date object into yyyy-MM-dd string for consistent key generation
export const formatDateToYYYYMMDD = (date: Date | null): string => {
  if (date && isValid(date)) {
    return format(date, 'yyyy-MM-dd');
  }
  return "";
};
