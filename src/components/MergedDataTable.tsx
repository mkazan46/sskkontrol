
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
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale'; 
import { parseTurkishDate, DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING } from '@/lib/date-utils';


interface MergedDataTableProps {
  data: MergedExcelData | null;
}


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
    
    // Use the new constants from date-utils
    const isDateColumn = DATE_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    const isTimeColumn = TIME_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    
    const parsedDate = parseTurkishDate(cellValue); // Handles Date, string, number

    if (parsedDate && isValid(parsedDate)) {
      // Only Date (e.g., "İşlem Tarihi")
      if (isDateColumn && !isTimeColumn) { 
        return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
      }
      // Only Time (e.g., "İşlem Saati")
      if (isTimeColumn && !isDateColumn) { 
        return format(parsedDate, 'HH:mm:ss');
      }
      // Both Date and Time implied or ambiguous, or a date value in a time column / time value in a date column
      // Default to dd.MM.yyyy HH:mm:ss if time component is present, otherwise dd.MM.yyyy
      if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0 && parsedDate.getSeconds() === 0 && parsedDate.getMilliseconds() === 0) {
        // If it's a date column with no time, or an Excel serial that's just a date
         if (isDateColumn) return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
         // If it's a time column but value is a date at midnight (e.g. Excel serial 45321 in a time column)
         // it's better to show the date to avoid confusion, or make it "00:00:00" if that's intended.
         // For now, if it was meant to be time, it will show 00:00:00. If it was a date, it shows date.
         if (isTimeColumn) return format(parsedDate, 'HH:mm:ss'); // Will show 00:00:00
      }
      return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
    }
    
    // Fallback for non-date/time strings or unparseable values
    if (typeof cellValue === 'string') {
      return cellValue.trim();
    }
    if (typeof cellValue === 'number') {
      return cellValue.toLocaleString('tr-TR');
    }
    return String(cellValue);
  };

  return (
    <Card className="w-full mt-6 shadow-xl rounded-lg overflow-hidden">
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
          <ScrollArea className="max-h-[calc(100vh-280px)] w-full">
            <Table className="min-w-full table-auto">
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
                        className="text-foreground px-3 py-2 text-left text-sm break-words"
                        title={formatCellContent(row[cellIndex], String(header))} 
                      >
                        {formatCellContent(row[cellIndex], String(header))}
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
