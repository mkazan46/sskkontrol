
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
    
    // US formats (M/d/yy)
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
        let year = parsed.getFullYear();
        
        // If the parsed year is between 0 and 99 (inclusive), 
        // it's likely a 20th/21st century year that needs adjustment.
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

  // Try ISO parse as a last resort for strings
  try {
    const isoParsed = parseISO(dateString);
    if (isValid(isoParsed)) {
      let year = isoParsed.getFullYear();
      if (year >= 0 && year < 100) {
        if (year <= 68) {
          isoParsed.setFullYear(year + 2000);
        } else {
          isoParsed.setFullYear(year + 1900);
        }
        if (!isValid(isoParsed)) {
          return null; // Adjustment made ISO date invalid
        }
      }
      return isoParsed;
    }
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
    let originalCellValue = cellValue; // Keep original for fallbacks

    // Handle pre-parsed Date objects (e.g., from cellDates: true)
    if (cellValue instanceof Date) {
      if (!isValid(cellValue)) return String(originalCellValue); // if original date is invalid, just stringify

      let year = cellValue.getFullYear();
      if (year >= 0 && year < 100) { // Heuristic for 2-digit years that became e.g. 25 AD
        if (year <= 68) { 
          cellValue.setFullYear(year + 2000);
        } else {
          cellValue.setFullYear(year + 1900);
        }
        // Re-check validity after potential modification
        if (!isValid(cellValue)) return String(originalCellValue); // Fallback if adjustment made it invalid
      }
      // Now cellValue has potentially an adjusted year. Proceed to format.
      if (isDateColumn && !isTimeColumn) { 
        return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      if (isTimeColumn && !isDateColumn) { 
        return format(cellValue, 'HH:mm:ss');
      }
      // Default for date columns that might also be time or for ambiguous columns
      if (cellValue.getHours() === 0 && cellValue.getMinutes() === 0 && cellValue.getSeconds() === 0 && cellValue.getMilliseconds() === 0) {
        // If it's a date column and time is midnight, just show date
        if (isDateColumn) return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
    }

    // Handle strings that might be dates or times
    if (typeof cellValue === 'string') {
      const trimmedValue = cellValue.trim();
      const parsedDate = parseTurkishDate(trimmedValue); 
      
      if (parsedDate && isValid(parsedDate)) { // parseTurkishDate now handles year adjustment
        if (isDateColumn && !isTimeColumn) { 
            return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
        }
        if (isTimeColumn && !isDateColumn) { 
          return format(parsedDate, 'HH:mm:ss');
        }
        // Default for date columns that might also be time or for ambiguous columns
        if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0 && parsedDate.getSeconds() === 0 && parsedDate.getMilliseconds() === 0) {
            if (isDateColumn) return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
        }
        return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
      }
      return trimmedValue; 
    }
    
    // Handle numbers (could be Excel date serials)
    if (typeof cellValue === 'number') {
      if (cellValue > 0 && cellValue < 2958466) { // Check for Excel serial date range
          try {
              // Excel epoch: December 30, 1899 (day 0)
              // JavaScript epoch: January 1, 1970
              // Excel has a bug where it thinks 1900 is a leap year.
              const excelEpoch = new Date(1899, 11, 30); 
              // Subtract 1 if the serial date is after Feb 28, 1900 (day 60 in Excel) to account for the leap year bug.
              const dateObj = new Date(excelEpoch.getTime() + (cellValue - (cellValue > 60 ? 1 : 0) ) * 24 * 60 * 60 * 1000);
              
              let finalDateObj = dateObj;

              let year = finalDateObj.getFullYear();
              if (isValid(finalDateObj) && year >=0 && year < 100) {
                  if(year <= 68) {
                      finalDateObj.setFullYear(year + 2000);
                  } else {
                      finalDateObj.setFullYear(year + 1900);
                  }
                  if (!isValid(finalDateObj)) return String(originalCellValue); // Fallback
              }


              if (isValid(finalDateObj)) {
                  if (isDateColumn && !isTimeColumn) {
                      return format(finalDateObj, 'dd.MM.yyyy', { locale: tr });
                  }
                  if (isTimeColumn && !isDateColumn) {
                      if (cellValue < 1 && cellValue > 0) return format(finalDateObj, 'HH:mm:ss'); // Excel time is fraction of a day
                      // If it's a whole number date that landed in a time column, show time if non-midnight
                      if (finalDateObj.getHours() !== 0 || finalDateObj.getMinutes() !== 0 || finalDateObj.getSeconds() !== 0) {
                        return format(finalDateObj, 'HH:mm:ss');
                      }
                      // If it's midnight, and forced as time, maybe show date for clarity or just time "00:00:00"
                      return format(finalDateObj, 'HH:mm:ss'); 
                  }
                  // Ambiguous or date+time column
                  if (finalDateObj.getHours() === 0 && finalDateObj.getMinutes() === 0 && finalDateObj.getSeconds() === 0 && finalDateObj.getMilliseconds() === 0) {
                     if (cellValue < 1 && cellValue > 0) return format(finalDateObj, 'HH:mm:ss'); // Excel time value
                     return format(finalDateObj, 'dd.MM.yyyy', { locale: tr }); // Date only if midnight
                  }
                  return format(finalDateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr }); // Full date and time
              }
          } catch (e) { /* Fall through to string conversion */ }
      }
      return cellValue.toLocaleString('tr-TR'); 
    }

    // Fallback for other types (boolean, etc.)
    return String(cellValue);
  };

  return (
    <Card className="w-full mt-6 shadow-xl rounded-lg overflow-hidden"> {/* Added overflow-hidden */}
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-2xl text-primary">
          <Table2 className="mr-3 h-7 w-7" />
          Birleştirilmiş Veri Listesi
        </CardTitle>
        <CardDescription>
          Yüklediğiniz dosyalardan birleştirilmiş ve ilgili sütun bulunduğunda TC Kimlik No'suna göre sıralanmış veriler.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0"> 
        {displayRowsWithSiraNo.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Info className="h-12 w-12 mb-4 text-primary/70" />
            <p className="text-lg">Görüntülenecek veri bulunmamaktadır.</p>
            <p className="text-sm">Lütfen dosya yükleyerek yeni bir birleştirme yapın veya dosyalarınızı kontrol edin.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-280px)] w-full"> {/* Removed overflow-auto from here */}
            <Table className="min-w-full table-auto"> {/* Removed whitespace-nowrap */}
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow className="border-b-0">
                  {displayHeadersWithSiraNo.map((header, index) => (
                    <TableHead 
                      key={index} 
                      className="font-semibold text-card-foreground px-3 py-3 text-left sticky top-0 bg-card z-10" 
                    >
                      {String(header)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRowsWithSiraNo.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/30 even:bg-background/30 border-b last:border-b-0">
                    {displayHeadersWithSiraNo.map((header, cellIndex) => ( 
                      <TableCell 
                        key={cellIndex} 
                        className="text-foreground px-3 py-2 text-left text-sm break-words" // Added break-words
                        title={formatCellContent(row[cellIndex], header)} 
                      >
                        {formatCellContent(row[cellIndex], header)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
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

