
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
import { Table2, Info, FileSearch2, Loader2 } from 'lucide-react';
import type { MergedExcelData } from '@/lib/excel-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale'; 
import { parseTurkishDate, DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';


interface MergedDataTableProps {
  data: MergedExcelData | null;
  onAnalyzeDeletions?: () => void; // Optional for now, will be used from MergedDataPage
  isAnalyzing?: boolean; // Optional for now
}


export function MergedDataTable({ data, onAnalyzeDeletions, isAnalyzing }: MergedDataTableProps) {
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
  
  // If "Sıra No" is already a header, don't add it again.
  // This can happen if analysis adds it, then user re-analyzes.
  // For now, analysis adds its own columns, not "Sıra No".
  // So, this logic should be fine.
  const hasSiraNo = data.headers[0]?.toLocaleLowerCase('tr-TR') === "sıra no";
  const displayHeaders = hasSiraNo ? [...data.headers] : ["Sıra No", ...data.headers];
  const displayRows = hasSiraNo 
    ? data.rows 
    : data.rows.map((row, index) => [index + 1, ...row]);


  const formatCellContent = (cellValue: any, headerText: string): string => {
    if (cellValue === null || cellValue === undefined || String(cellValue).trim() === "") {
      return "";
    }

    const normalizedHeaderText = headerText.toLocaleLowerCase('tr-TR').trim();

    if (normalizedHeaderText === "sıra no") {
      return String(cellValue);
    }
    
    const isDateColumn = DATE_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    // Check against TIME_HEADERS_TR_FORMATTING from date-utils, which now includes analysis time headers
    const isTimeColumn = TIME_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    
    const parsedDate = parseTurkishDate(cellValue); 

    if (parsedDate && isValid(parsedDate)) {
      if (isTimeColumn && !isDateColumn) { // Specifically a time column
        return format(parsedDate, 'HH:mm:ss');
      }
      if (isDateColumn && !isTimeColumn) { // Specifically a date column
        return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
      }
      // Default for datetime or ambiguous columns, or if a date object is in a column not strictly date/time
      if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0 && parsedDate.getSeconds() === 0 && parsedDate.getMilliseconds() === 0) {
        // It's a date at midnight. If column expects date, show date. If expects time, show 00:00:00
        if (isDateColumn) return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
        if (isTimeColumn) return format(parsedDate, 'HH:mm:ss'); // Will show 00:00:00
      }
      return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
    }
    
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
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center text-2xl text-primary">
            <Table2 className="mr-3 h-7 w-7" />
            Birleştirilmiş Veri Listesi
          </CardTitle>
          <CardDescription>
            Yüklediğiniz dosyalardan birleştirilmiş ve ilgili sütun bulunduğunda TC Kimlik No'suna göre sıralanmış veriler.
            {data.headers.includes("Analiz: Silme Saati") && " (Silme analizi uygulandı.)"}
          </CardDescription>
        </div>
        {onAnalyzeDeletions && (
            <Button 
              onClick={onAnalyzeDeletions} 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary/10 whitespace-nowrap"
              disabled={isAnalyzing || !data || data.rows.length === 0}
              size="sm"
            >
              {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileSearch2 className="mr-2 h-5 w-5" />}
              Silme Kayıtlarını Çıkart & Analiz Et
            </Button>
        )}
      </CardHeader>
      <CardContent className="p-0"> 
        {displayRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Info className="h-12 w-12 mb-4 text-primary/70" />
            <p className="text-lg">Görüntülenecek veri bulunmamaktadır.</p>
            <p className="text-sm">Lütfen dosya yükleyerek yeni bir birleştirme yapın veya dosyalarınızı kontrol edin.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-320px)] w-full"> {/* Adjusted max-height */}
            <Table className="min-w-full table-auto"> {/* Removed whitespace-nowrap */}
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow className="border-b-0">
                  {displayHeaders.map((header, index) => (
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
                {displayRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/30 even:bg-background/30 border-b last:border-b-0">
                    {displayHeaders.map((originalHeader, cellIndex) => {
                      // If originalHeader is "Sıra No" and displayHeaders also starts with "Sıra No" (meaning it was added by this component)
                      // then the actual data for this cell is in row[cellIndex] (if hasSiraNo is true) or row[cellIndex-1] (if hasSiraNo is false).
                      // The current `row` is already `displayRows` which has Sıra No at index 0 if added.
                      const cellData = row[cellIndex];
                      return (
                        <TableCell 
                          key={cellIndex} 
                          className="text-foreground px-3 py-2 text-left text-sm break-words" // Added break-words
                          title={formatCellContent(cellData, String(originalHeader))} 
                        >
                          {formatCellContent(cellData, String(originalHeader))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
        {displayRows.length > 0 && (
            <div className="p-3 text-xs text-muted-foreground text-right border-t">
                Toplam {data.rows.length} satır gösteriliyor. {/* Use original data.rows.length for count */}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
