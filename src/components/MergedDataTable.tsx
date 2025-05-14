
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
      if (isDateColumn && isTimeColumn) { // Column is marked as both (e.g. "kayıt zamanı")
        return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
      }
      // Default for Date objects not in specified headers:
      // Guess based on content: if time is midnight, format as date only.
      if (cellValue.getHours() === 0 && cellValue.getMinutes() === 0 && cellValue.getSeconds() === 0 && cellValue.getMilliseconds() === 0) {
        return format(cellValue, 'dd.MM.yyyy', { locale: tr });
      }
      // Otherwise, format as full date-time as a sensible default
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
    }

    // Handle strings that might be dates or times
    if (typeof cellValue === 'string') {
      const trimmedValue = cellValue.trim();
      if (isDateColumn || isTimeColumn) { // Only attempt parsing if in a date/time column
        const parsedDate = parseTurkishDate(trimmedValue);
        if (parsedDate && isValid(parsedDate)) {
          if (isDateColumn && !isTimeColumn) { // Exclusively a date column
             return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
          }
          if (isTimeColumn && !isDateColumn) { // Exclusively a time column
            return format(parsedDate, 'HH:mm:ss');
          }
          // If it could be both (e.g. header is in both lists, or logic leads here)
          return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
        }
      }
      return trimmedValue; // original string if not a parsable date/time or not in date/time column
    }
    
    // Handle numbers (could be Excel date serials if cellDates:false, or if cellDates:true failed)
    if (typeof cellValue === 'number') {
      if (isDateColumn || isTimeColumn) { // Only attempt conversion if it's a date/time column
         // Plausible range for Excel dates. Excel time-only values are < 1.
        if (cellValue > 0 && cellValue < 2958466) {
            try {
                // This is the existing simplified conversion from the codebase.
                // It assumes Windows Excel 1900 date system and attempts a local time conversion.
                // `cellDates: true` in `excel-utils.ts` is the primary mechanism for date conversion.
                // This numeric conversion is a fallback.
                const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
                const dateObj = new Date(excelEpoch.getTime() + (cellValue -1) * 24 * 60 * 60 * 1000);
                // The following line attempts to adjust for timezone, assuming the calculated dateObj is UTC.
                // This can be problematic. date-fns `format` handles localization from a JS Date object well.
                // For simplicity, we'll keep the existing numeric conversion logic structure but apply consistent formatting.
                // To be more robust, one would ideally use a proper Excel SSF parser or rely solely on `cellDates: true`.
                const finalDateObj = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000);


                if (isValid(finalDateObj)) { // Use finalDateObj after timezone adjustment attempt
                    if (isDateColumn && !isTimeColumn) {
                        return format(finalDateObj, 'dd.MM.yyyy', { locale: tr });
                    }
                    if (isTimeColumn && !isDateColumn) {
                        // If the original number was < 1, it's likely just time.
                        // Otherwise, it might be a full date being shown in a time column.
                        return format(finalDateObj, 'HH:mm:ss');
                    }
                    if (isDateColumn && isTimeColumn) { // Column is marked as both
                        return format(finalDateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
                    }
                     // Fallback for numeric dates in ambiguously typed columns or if not fitting above
                    if (cellValue > 0 && cellValue < 1) { // Excel time is a fraction of a day
                        return format(finalDateObj, 'HH:mm:ss');
                    }
                    return format(finalDateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
                }
            } catch (e) { /* Fall through to string conversion */ }
        }
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

