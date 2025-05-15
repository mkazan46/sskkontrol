
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
import { cn } from '@/lib/utils';

interface MergedDataTableProps {
  data: MergedExcelData | null;
  onAnalyzeDeletions?: () => void; 
  isAnalyzing?: boolean;
  highlightMarkerHeader?: string; // Optional prop to specify the header for highlighting
}

export function MergedDataTable({ data, onAnalyzeDeletions, isAnalyzing, highlightMarkerHeader }: MergedDataTableProps) {
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
  
  const hasSiraNo = data.headers[0]?.toLocaleLowerCase('tr-TR') === "sıra no";
  
  const markerColIndex = highlightMarkerHeader ? data.headers.indexOf(highlightMarkerHeader) : -1;

  // Filter out the marker header from displayHeaders
  const visibleHeaders = data.headers.filter(header => header !== highlightMarkerHeader);
  const displayHeaders = hasSiraNo ? [...visibleHeaders] : ["Sıra No", ...visibleHeaders];


  const formatCellContent = (cellValue: any, headerText: string): string => {
    if (cellValue === null || cellValue === undefined || String(cellValue).trim() === "") {
      return "";
    }

    const normalizedHeaderText = headerText.toLocaleLowerCase('tr-TR').trim();

    if (normalizedHeaderText === "sıra no") {
      return String(cellValue);
    }
    
    const isDateColumn = DATE_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    const isTimeColumn = TIME_HEADERS_TR_FORMATTING.includes(normalizedHeaderText);
    
    const parsedDate = parseTurkishDate(cellValue); 

    if (parsedDate && isValid(parsedDate)) {
      if (isTimeColumn && !isDateColumn) { 
        return format(parsedDate, 'HH:mm:ss');
      }
      if (isDateColumn && !isTimeColumn) { 
        return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
      }
      if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0 && parsedDate.getSeconds() === 0 && parsedDate.getMilliseconds() === 0) {
        if (isDateColumn) return format(parsedDate, 'dd.MM.yyyy', { locale: tr }); 
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
    <Card className="w-full mt-6 shadow-xl rounded-lg overflow-hidden flex flex-col flex-grow">
      <CardHeader className="border-b flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-2">
        <div>
          <CardTitle className="flex items-center text-xl sm:text-2xl text-primary">
            <Table2 className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7" />
            {onAnalyzeDeletions ? "Birleştirilmiş Veri Listesi" : "Analiz Sonuçları"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">
            {onAnalyzeDeletions 
              ? "Yüklediğiniz dosyalardan birleştirilmiş ve ilgili sütun bulunduğunda TC Kimlik No'suna göre sıralanmış veriler."
              : highlightMarkerHeader 
                ? "Tüm kayıtlar listelenmiştir. Analiz edilen ve birleştirilen silme kayıtları kırmızı ile vurgulanmıştır."
                : "İşlenmiş veri listesi."
            }
          </CardDescription>
        </div>
        {onAnalyzeDeletions && ( 
            <Button 
              onClick={onAnalyzeDeletions} 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary/10 whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm self-start sm:self-center"
              disabled={isAnalyzing || !data || data.rows.length === 0}
              size="sm"
            >
              {isAnalyzing ? <Loader2 className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <FileSearch2 className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
              Silme Kayıtlarını Çıkart & Analiz Et
            </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 flex flex-col flex-grow"> 
        {data.rows.length === 0 ? ( 
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground flex-grow">
            <Info className="h-12 w-12 mb-4 text-primary/70" />
            <p className="text-lg">Görüntülenecek veri bulunmamaktadır.</p>
             {onAnalyzeDeletions && <p className="text-sm">Lütfen dosya yükleyerek yeni bir birleştirme yapın veya dosyalarınızı kontrol edin.</p>}
          </div>
        ) : (
          <ScrollArea className="flex-grow w-full"> 
            <Table className="min-w-full table-auto">
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow className="border-b-0">
                  {displayHeaders.map((header, index) => (
                    <TableHead 
                      key={index} 
                      className="font-semibold text-card-foreground px-3 py-3 text-left sticky top-0 bg-card z-10 whitespace-nowrap" 
                    >
                      {String(header)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((originalRow, rowIndex) => {
                  const isHighlighted = markerColIndex !== -1 && originalRow[markerColIndex] === true;
                  
                  // Prepare row for display by filtering out marker column data
                  let rowCellsForDisplay = [...originalRow];
                  if (markerColIndex !== -1) {
                    rowCellsForDisplay.splice(markerColIndex, 1);
                  }
                  if (hasSiraNo) {
                    // rowCellsForDisplay already has Sıra No if it was in original data
                  } else {
                    rowCellsForDisplay = [rowIndex + 1, ...rowCellsForDisplay];
                  }

                  return (
                    <TableRow 
                      key={rowIndex} 
                      className={cn(
                        "hover:bg-muted/30 even:bg-background/30 border-b last:border-b-0",
                        isHighlighted && "bg-red-100 dark:bg-red-900/40 hover:bg-red-200/80 dark:hover:bg-red-800/60"
                      )}
                    >
                      {rowCellsForDisplay.map((cellData, cellIndex) => {
                        const headerText = displayHeaders[cellIndex];
                        return (
                          <TableCell 
                            key={cellIndex} 
                            className={cn(
                              "text-foreground px-3 py-2 text-left text-sm break-words",
                              isHighlighted && "text-red-900 dark:text-red-100"
                            )}
                            title={formatCellContent(cellData, String(headerText))} 
                          >
                            {formatCellContent(cellData, String(headerText))}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
        {data.rows.length > 0 && (
            <div className="p-3 text-xs text-muted-foreground text-right border-t">
                Toplam {data.rows.length} satır gösteriliyor.
            </div>
        )}
      </CardContent>
    </Card>
  );
}

    