
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

// Function to attempt parsing various Turkish date formats
const parseTurkishDate = (dateString: string): Date | null => {
  const formats = [
    'dd.MM.yyyy HH:mm:ss',
    'dd.MM.yyyy H:mm:ss',
    'd.M.yyyy HH:mm:ss',
    'd.M.yyyy H:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy H:mm:ss',
    'd/M/yyyy HH:mm:ss',
    'd/M/yyyy H:mm:ss',
    'dd.MM.yyyy HH:mm',
    'dd.MM.yyyy H:mm',
    'd.M.yyyy HH:mm',
    'd.M.yyyy H:mm',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy H:mm',
    'd/M/yyyy HH:mm',
    'd/M/yyyy H:mm',
    'dd.MM.yyyy',
    'd.M.yyyy',
    'dd/MM/yyyy',
    'd/M/yyyy',
    'yyyy-MM-dd HH:mm:ss', // ISO-like
    'yyyy-MM-dd' // ISO-like date only
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
    
    // Handle pre-parsed Date objects (e.g., from cellDates: true)
    if (cellValue instanceof Date && isValid(cellValue)) {
      if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
        return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
         // Check if it's a date object that only contains time (date part is epoch or similar)
        if (cellValue.getFullYear() === 1970 || cellValue.getFullYear() === 1899) { // Common epoch start for time-only
            return format(cellValue, 'HH:mm:ss');
        }
        return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr }); // Full date-time if not just time
      }
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr }); // Default for other Date objects
    }

    // Handle strings that might be dates or times
    if (typeof cellValue === 'string') {
      const trimmedValue = cellValue.trim();
      if (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        const parsedDate = parseTurkishDate(trimmedValue);
        if (parsedDate && isValid(parsedDate)) {
          if (DATE_HEADERS_TR.includes(normalizedHeaderText) && !TIME_HEADERS_TR.includes(normalizedHeaderText)) {
            // If it's primarily a date column, format as date only.
             return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
          }
          if (TIME_HEADERS_TR.includes(normalizedHeaderText) && !DATE_HEADERS_TR.includes(normalizedHeaderText)) {
            // If it's primarily a time column, format as time only.
            return format(parsedDate, 'HH:mm:ss');
          }
          // If it could be both or is ambiguous, format as full date-time
          return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
        }
      }
      // Return original string if not a parsable date/time or not in a date/time column.
      // This ensures Turkish characters in regular strings are preserved.
      return trimmedValue;
    }
    
    // Handle numbers (could be Excel date serials if cellDates:false, or just numbers)
    if (typeof cellValue === 'number') {
      if (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        // Attempt to convert Excel serial date number to Date object
        // Excel for Windows serial date base: 30th December 1899
        // Excel for Mac serial date base: 1st January 1904
        // This simple conversion assumes Windows base and doesn't handle Mac 1904 base or leap year bug.
        // For robust Excel date number conversion, XLSX.SSF.parse_date_code(cellValue) is better if available directly.
        if (cellValue > 1 && cellValue < 2958466) { // Plausible range for Excel dates
            try {
                const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
                const dateObj = new Date(excelEpoch.getTime() + (cellValue -1) * 24 * 60 * 60 * 1000);
                 // Adjust for timezone offset if numbers represent UTC dates but should be shown in local time
                dateObj.setTime(dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000);

                if (isValid(dateObj)) {
                    if (DATE_HEADERS_TR.includes(normalizedHeaderText) && !TIME_HEADERS_TR.includes(normalizedHeaderText)) {
                        return format(dateObj, 'dd.MM.yyyy', { locale: tr });
                    }
                    if (TIME_HEADERS_TR.includes(normalizedHeaderText) && !DATE_HEADERS_TR.includes(normalizedHeaderText)) {
                        // If it's a time column and the number is < 1, it's likely just time.
                        // Otherwise, it might be a full date being shown in a time column.
                        if (cellValue > 0 && cellValue < 1) return format(dateObj, 'HH:mm:ss');
                         // For full dates in time columns, you might choose to show full or just time.
                        return format(dateObj, 'HH:mm:ss'); // Default to time for time column
                    }
                    return format(dateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
                }
            } catch (e) { /* Fall through to string conversion */ }
        }
      }
      // For non-date numbers, format with Turkish locale for number formatting (e.g., decimal points)
      return cellValue.toLocaleString('tr-TR');
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

