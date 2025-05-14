
"use client";

import React from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table2, Info } from 'lucide-react';
import type { MergedExcelData } from '@/lib/excel-utils';
import { format, isValid, parseISO, parse } from 'date-fns';
import { tr } from 'date-fns/locale'; // For Turkish month/day names

interface MergedDataTableProps {
  data: MergedExcelData | null;
}

// Extended list of headers that might contain date or time values in Turkish
const DATE_HEADERS_TR = ["tarih", "işlem tarihi", "doğum tarihi", "kayıt tarihi", "başlangıç tarihi", "bitiş tarihi", "geçerlilik tarihi"];
const TIME_HEADERS_TR = ["işlem saati", "saat", "başlangıç saati", "bitiş saati", "kayıt saati"];

// Function to attempt parsing various Turkish and common international date formats
const parseTurkishDate = (dateString: string): Date | null => {
  const formats = [
    // Turkish formats (dd.MM.yyyy)
    'dd.MM.yyyy HH:mm:ss',
    'dd.MM.yyyy H:mm:ss',
    'd.M.yyyy HH:mm:ss',
    'd.M.yyyy H:mm:ss',
    'dd.MM.yyyy HH:mm',
    'dd.MM.yyyy H:mm',
    'd.M.yyyy HH:mm',
    'd.M.yyyy H:mm',
    'dd.MM.yyyy',
    'd.M.yyyy',

    // Turkish formats (dd/MM/yyyy)
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy H:mm:ss',
    'd/M/yyyy HH:mm:ss',
    'd/M/yyyy H:mm:ss',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy H:mm',
    'd/M/yyyy HH:mm',
    'd/M/yyyy H:mm',
    'dd/MM/yyyy',
    'd/M/yyyy',

    // ISO-like formats
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
    
    // US formats (M/d/yy) - Adding these to handle "3/21/25"
    'M/d/yy HH:mm:ss',
    'M/d/yy H:mm:ss',
    'M/d/yy HH:mm',
    'M/d/yy H:mm',
    'M/d/yy',
    'MM/dd/yy HH:mm:ss',
    'MM/dd/yy H:mm:ss',
    'MM/dd/yy HH:mm',
    'MM/dd/yy H:mm',
    'MM/dd/yy',

    // US formats (M/d/yyyy)
    'M/d/yyyy HH:mm:ss',
    'M/d/yyyy H:mm:ss',
    'M/d/yyyy HH:mm',
    'M/d/yyyy H:mm',
    'M/d/yyyy',
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy H:mm:ss',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy H:mm',
    'MM/dd/yyyy',

    // US formats with hyphens (M-d-yy)
    'M-d-yy HH:mm:ss',
    'M-d-yy H:mm:ss',
    'M-d-yy HH:mm',
    'M-d-yy H:mm',
    'M-d-yy',
    'MM-dd-yy HH:mm:ss',
    'MM-dd-yy H:mm:ss',
    'MM-dd-yy HH:mm',
    'MM-dd-yy H:mm',
    'MM-dd-yy',

    // US formats with hyphens (M-d-yyyy)
    'M-d-yyyy HH:mm:ss',
    'M-d-yyyy H:mm:ss',
    'M-d-yyyy HH:mm',
    'M-d-yyyy H:mm',
    'M-d-yyyy',
    'MM-dd-yyyy HH:mm:ss',
    'MM-dd-yyyy H:mm:ss',
    'MM-dd-yyyy HH:mm',
    'MM-dd-yyyy H:mm',
    'MM-dd-yyyy',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(dateString, fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch (e) {
      // continue trying other formats
    }
  }
  // Try ISO parse as a last resort for strings
  try {
    const isoParsed = parseISO(dateString);
    if (isValid(isoParsed)) return isoParsed;
  } catch (e) { /* ignore */ }

  return null;
};


export function MergedDataTable({ data }: MergedDataTableProps) {
  if (!data) {
    return (
        <Card className="w-full mt-6 shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                    <Info className="mr-3 h-7 w-7 text-primary" />
                    Veri Yok
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-6">
                Görüntülenecek birleştirilmiş veri bulunmamaktadır.
                </p>
            </CardContent>
        </Card>
    );
  }
  
  const displayHeadersWithSiraNo = ["Sıra No", ...data.headers];
  const displayRowsWithSiraNo = data.rows.map((row, index) => [index + 1, ...row]);

  const formatCellContent = (cellValue: any, headerText: string): string => {
    if (cellValue === null || cellValue === undefined || String(cellValue).trim() === "") {
      return "";
    }

    const normalizedHeaderText = headerText.toLocaleLowerCase('tr-TR').trim();

    if (normalizedHeaderText === "sıra no") {
      return String(cellValue);
    }
    
    const isDateColumn = DATE_HEADERS_TR.includes(normalizedHeaderText);
    const isTimeColumn = TIME_HEADERS_TR.includes(normalizedHeaderText);

    // Handle pre-parsed Date objects (e.g., from cellDates: true)
    if (cellValue instanceof Date && isValid(cellValue)) {
      if (isDateColumn && !isTimeColumn) { // Exclusively a date column
        return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      if (isTimeColumn && !isDateColumn) { // Exclusively a time column
        return format(cellValue, 'HH:mm:ss');
      }
      // If it's in both lists (e.g. "kayıt zamanı") or ambiguously a date/time column not specifically in only one list
      // Default to full date-time if time component exists, otherwise date only.
      if (cellValue.getHours() === 0 && cellValue.getMinutes() === 0 && cellValue.getSeconds() === 0 && cellValue.getMilliseconds() === 0) {
        return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
    }

    // Handle strings that might be dates or times
    if (typeof cellValue === 'string') {
      const trimmedValue = cellValue.trim();
      const parsedDate = parseTurkishDate(trimmedValue); // Use our enhanced parser
      
      if (parsedDate && isValid(parsedDate)) {
        if (isDateColumn && !isTimeColumn) { // Exclusively a date column
            return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
        }
        if (isTimeColumn && !isDateColumn) { // Exclusively a time column
          return format(parsedDate, 'HH:mm:ss');
        }
        // If it's in both lists or ambiguously a date/time column
        // Default to full date-time if time component exists, otherwise date only.
        if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0 && parsedDate.getSeconds() === 0 && parsedDate.getMilliseconds() === 0) {
            return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
        }
        return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
      }
      return trimmedValue; // original string if not a parsable date/time
    }
    
    // Handle numbers (could be Excel date serials)
    if (typeof cellValue === 'number') {
      // Plausible range for Excel dates. Excel time-only values are < 1.
      if (cellValue > 0 && cellValue < 2958466) { // Common Excel date serial range
          try {
              const excelEpoch = new Date(1899, 11, 30); // December 30, 1899 for Windows Excel
              // XLSX library with cellDates:true should handle this, but as a fallback:
              const dateObj = new Date(excelEpoch.getTime() + (cellValue - (cellValue > 60 ? 1 : 0) ) * 24 * 60 * 60 * 1000);
              // The above (cellValue > 60 ? 1:0) is a simplified leap year adjustment for 1900, 
              // but cellDates:true should be more accurate. This numeric conversion is a robust fallback.
              
              // Correction for timezone offset if the date was intended as local
              // const finalDateObj = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000);
              // Forcing UTC interpretation of serial and then formatting seems more reliable with date-fns
              // The issue with simple offset is that it double-applies if dateObj is already local.
              // Assuming dateObj from serial is effectively UTC for date-fns to handle localization.
              const finalDateObj = dateObj;


              if (isValid(finalDateObj)) {
                  if (isDateColumn && !isTimeColumn) {
                      return format(finalDateObj, 'dd.MM.yyyy', { locale: tr });
                  }
                  if (isTimeColumn && !isDateColumn) {
                      return format(finalDateObj, 'HH:mm:ss');
                  }
                  // Ambiguous or date+time column
                  if (finalDateObj.getHours() === 0 && finalDateObj.getMinutes() === 0 && finalDateObj.getSeconds() === 0 && finalDateObj.getMilliseconds() === 0) {
                     // If it's a whole day (like from an Excel date serial with no time part)
                     if (cellValue < 1) return format(finalDateObj, 'HH:mm:ss'); // Excel time value
                     return format(finalDateObj, 'dd.MM.yyyy', { locale: tr });
                  }
                  return format(finalDateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
              }
          } catch (e) { /* Fall through to string conversion */ }
      }
      return cellValue.toLocaleString('tr-TR'); // For non-date numbers or if conversion failed
    }

    // Fallback for other types (boolean, etc.)
    return String(cellValue);
  };

  return (
    <Card className="w-full mt-6 shadow-xl rounded-lg">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-2xl text-primary">
          <Table2 className="mr-3 h-7 w-7" />
          Birleştirilmiş Veri Listesi
        </CardTitle>
        <CardDescription>
          Yüklediğiniz dosyalardan birleştirilmiş ve ilgili sütun bulunduğunda TC Kimlik No'suna göre sıralanmış veriler.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0"> {/* Adjusted padding for full width table feel */}
        {displayRowsWithSiraNo.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Info className="h-12 w-12 mb-4 text-primary/70" />
            <p className="text-lg">Görüntülenecek veri bulunmamaktadır.</p>
            <p className="text-sm">Lütfen dosya yükleyerek yeni bir birleştirme yapın veya dosyalarınızı kontrol edin.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-280px)] w-full overflow-auto"> {/* Max height adjusted slightly */}
            <Table className="min-w-full"> {/* Removed whitespace-nowrap */}
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow className="border-b-0">
                  {displayHeadersWithSiraNo.map((header, index) => (
                    <TableHead 
                      key={index} 
                      className="font-semibold text-card-foreground px-3 py-3 text-left sticky top-0 bg-card z-10" // Enhanced sticky header
                    >
                      {String(header)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRowsWithSiraNo.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/30 even:bg-background/30 border-b last:border-b-0">
                    {displayHeadersWithSiraNo.map((header, cellIndex) => ( // Use header from displayHeadersWithSiraNo for consistency
                      <TableCell 
                        key={cellIndex} 
                        className="text-foreground px-3 py-2 text-left text-sm"
                        title={formatCellContent(row[cellIndex], header)} // Add title for full content on hover
                      >
                        {formatCellContent(row[cellIndex], header)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
             {/* Removed ScrollBar for vertical, ScrollArea handles it */}
          </ScrollArea>
        )}
        {displayRowsWithSiraNo.length > 0 && (
            <div className="p-3 text-xs text-muted-foreground text-right border-t">
                Toplam {displayRowsWithSiraNo.length} satır gösteriliyor.
            </div>
        )}
      </CardContent>
    </Card>
  );
}

