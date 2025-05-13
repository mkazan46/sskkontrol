
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
import { Table2 } from 'lucide-react';
import type { MergedExcelData } from '@/lib/excel-utils';
import { format, isValid, parseISO } from 'date-fns';
// Türkçe ay ve gün isimleri için gerekirse: import { tr } from 'date-fns/locale';

interface MergedDataTableProps {
  data: MergedExcelData | null;
}

// Extended list of headers that might contain date or time values in Turkish
const DATE_HEADERS_TR = ["tarih", "işlem tarihi", "doğum tarihi", "kayıt tarihi", "başlangıç tarihi", "bitiş tarihi"];
const TIME_HEADERS_TR = ["işlem saati", "saat", "başlangıç saati", "bitiş saati"];

export function MergedDataTable({ data }: MergedDataTableProps) {
  if (!data) {
    return null;
  }
  // Even if data object exists, if there are no headers, it's not a meaningful table.
  // Rows might be empty even if headers exist (e.g. after filtering or if source files were empty except headers).
  // The logic below handles displayRowsWithSiraNo.length === 0 for the message.

  const displayHeadersWithSiraNo = ["Sıra No", ...data.headers];
  const displayRowsWithSiraNo = data.rows.map((row, index) => [index + 1, ...row]);

  const formatCellContent = (cellValue: any, headerText: string): string => {
    if (cellValue === null || cellValue === undefined) {
      return "";
    }

    const normalizedHeaderText = headerText.toLocaleLowerCase('tr-TR').trim();

    // Handle "Sıra No" separately first as it's always a number.
    if (normalizedHeaderText === "sıra no") {
      return String(cellValue);
    }

    // Date object handling (most reliable if `cellDates: true` worked in excel-utils)
    if (cellValue instanceof Date && isValid(cellValue)) {
      if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
        return format(cellValue, 'dd.MM.yyyy'); // Consider { locale: tr } for Turkish month names
      }
      if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        return format(cellValue, 'HH:mm:ss');
      }
      // Default format for Date objects not matching specific headers (e.g., a 'Modified At' column)
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss');
    }

    // String parsing for dates/times (fallback)
    if (typeof cellValue === 'string') {
      if (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        let parsedDate: Date | null = null;
        try {
          // Try ISO format first
          const isoDate = parseISO(cellValue);
          if (isValid(isoDate)) {
            parsedDate = isoDate;
          } else {
            // Attempt to parse common Turkish date formats if necessary, or rely on generic new Date()
            // Example: DD.MM.YYYY or DD/MM/YYYY - this requires more complex parsing logic.
            // For now, new Date() is a general fallback.
            const genericDate = new Date(cellValue);
            if (isValid(genericDate) && genericDate.getFullYear() > 1800) { // Basic sanity check
              parsedDate = genericDate;
            }
          }
        } catch (e) { /* Parsing failed, will return as string */ }

        if (parsedDate && isValid(parsedDate)) {
          if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
            return format(parsedDate, 'dd.MM.yyyy');
          }
          if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
            // Check if the original string was likely just a time
            if (cellValue.match(/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i)) {
                const timeParts = cellValue.match(/(\d+)/g);
                if (timeParts && timeParts.length >= 2) {
                    const tempDateForTime = new Date(0); // Use a fixed date to avoid DST issues
                    tempDateForTime.setUTCHours(parseInt(timeParts[0],10), parseInt(timeParts[1],10), timeParts[2] ? parseInt(timeParts[2],10) : 0, 0);
                    if(isValid(tempDateForTime)){
                        return format(tempDateForTime, 'HH:mm:ss');
                    }
                }
            }
            return format(parsedDate, 'HH:mm:ss');
          }
        }
      }
    }
    
    // Excel numeric serial date handling (another fallback, less common if `cellDates: true` is effective)
    if (typeof cellValue === 'number' && 
        (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText))) {
        try {
            // Excel stores dates as days since 1899-12-30 (or 1904-01-01 for Mac).
            // XLSX.SSF.parse_date_code is the most robust way if direct access to XLSX library is feasible here.
            // This is a simplified conversion and might have edge cases (e.g., Excel 1900 leap year bug).
            const excelBaseDateEpoch = Date.UTC(1899, 11, 30); // Day 0 for Windows Excel
            
            const days = Math.floor(cellValue);
            const timeFraction = cellValue - days;
            
            // Convert days to milliseconds and add to Excel base epoch
            const dateMilliseconds = days * 24 * 60 * 60 * 1000;
            // Convert time fraction to milliseconds
            const timeMilliseconds = Math.round(timeFraction * 24 * 60 * 60 * 1000);

            const finalDate = new Date(excelBaseDateEpoch + dateMilliseconds + timeMilliseconds);
            
            // Adjust for timezone offset if numbers are UTC and display should be local
            // finalDate.setTime(finalDate.getTime() + finalDate.getTimezoneOffset() * 60 * 1000);


            if (isValid(finalDate)) {
                 if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
                    // If it's a date column and the number had no fractional part (was a whole day number)
                    // or if it had a fractional part, still format as date.
                    return format(finalDate, 'dd.MM.yyyy');
                }
                if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
                    // If it's a time column, and the number had a fractional part (time component)
                    // or if it was purely a time value (number between 0 and 1)
                    if (timeFraction > 0 || (cellValue > 0 && cellValue < 1)) {
                         return format(finalDate, 'HH:mm:ss');
                    }
                    // If it's a whole number in a time column, it might be a date being forced into time view.
                    // Showing 00:00:00 or the date itself might be options.
                    return format(finalDate, 'HH:mm:ss'); // Default to showing time part.
                }
            }
        } catch(e) { /* Conversion failed, will return as string */ }
    }

    return String(cellValue);
  };

  return (
    <Card className="w-full mt-6 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Table2 className="mr-3 h-7 w-7 text-primary" />
          Birleştirilmiş Veri Listesi
        </CardTitle>
        <CardDescription>
          Yüklediğiniz dosyalardan birleştirilmiş ve TC Kimlik No'suna (eğer varsa) göre sıralanmış veriler.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {displayRowsWithSiraNo.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            Görüntülenecek veri bulunmamaktadır. Lütfen dosya yükleyerek yeni bir birleştirme yapın.
          </p>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-260px)] w-full overflow-auto border rounded-md">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  {displayHeadersWithSiraNo.map((header, index) => (
                    <TableHead 
                      key={index} 
                      className="font-semibold text-card-foreground px-3 py-2.5 text-left whitespace-nowrap"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRowsWithSiraNo.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50 even:bg-background/50">
                    {displayHeadersWithSiraNo.map((_header, cellIndex) => (
                      <TableCell 
                        key={cellIndex} 
                        className="text-foreground px-3 py-1.5 text-left whitespace-nowrap text-sm"
                      >
                        {formatCellContent(row[cellIndex], displayHeadersWithSiraNo[cellIndex])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
        <p className="text-xs text-muted-foreground mt-3 text-right pr-1">
          Toplam {displayRowsWithSiraNo.length} satır gösteriliyor.
        </p>
      </CardContent>
    </Card>
  );
}

