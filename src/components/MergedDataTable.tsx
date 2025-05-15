
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table2, Info, FileSearch2, Loader2, AlertTriangle } from 'lucide-react';
import type { MergedExcelData } from '@/lib/excel-utils';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale'; 
import { parseTurkishDate, DATE_HEADERS_TR_FORMATTING, TIME_HEADERS_TR_FORMATTING } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ANALYSIS_HIGHLIGHT_MARKER_HEADER } from '@/lib/analysis-utils';


interface MergedDataTableProps {
  data: MergedExcelData | null;
  onAnalyzeDeletions?: () => void; 
  isAnalyzing?: boolean;
  highlightMarkerHeader?: string;
}

export function MergedDataTable({ data, onAnalyzeDeletions, isAnalyzing, highlightMarkerHeader }: MergedDataTableProps) {
  if (!data) {
    return (
        <Card className="w-full mt-6 shadow-xl rounded-lg border border-border/50">
            <CardHeader className="p-6 border-b border-border/50">
                <CardTitle className="flex items-center text-2xl font-semibold text-foreground">
                    <AlertTriangle className="mr-3 h-7 w-7 text-destructive" />
                    Veri Yok
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
                <p className="text-muted-foreground text-center text-lg py-6">
                Görüntülenecek birleştirilmiş veri bulunmamaktadır.
                </p>
            </CardContent>
        </Card>
    );
  }
  
  const hasSiraNo = data.headers[0]?.toLocaleLowerCase('tr-TR') === "sıra no";
  
  const markerColIndex = highlightMarkerHeader ? data.headers.indexOf(highlightMarkerHeader) : -1;

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
      // If it's both a date and time column, or if it's a date column with time components (not 00:00:00)
      if ((isDateColumn && isTimeColumn) || (isDateColumn && (parsedDate.getHours() !== 0 || parsedDate.getMinutes() !== 0 || parsedDate.getSeconds() !== 0))) {
        return format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
      }
      // If it's a date column and time is 00:00:00, just show date
      if (isDateColumn) {
        return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
      }
      // Fallback for other valid dates that might not fit specific D/T column types
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
    <Card className="w-full mt-0 shadow-2xl rounded-xl overflow-hidden border border-border/50 flex flex-col flex-grow">
      <CardHeader className="border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 gap-3 bg-card/50">
        <div>
          <CardTitle className="flex items-center text-xl sm:text-2xl font-bold text-primary">
            <Table2 className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7" />
            {onAnalyzeDeletions ? "Birleştirilmiş Veri Listesi" : "Analiz Sonuçları"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1.5 text-muted-foreground max-w-prose">
            {onAnalyzeDeletions 
              ? "Yüklediğiniz dosyalardan birleştirilmiş ve ilgili sütun bulunduğunda TC Kimlik No'suna göre sıralanmış veriler."
              : highlightMarkerHeader 
                ? "Tüm kayıtlar listelenmiştir. Analiz edilen ve birleştirilen silme kayıtları aşağıda kırmızı ile vurgulanmıştır."
                : "İşlenmiş veri listesi."
            }
          </CardDescription>
        </div>
        {onAnalyzeDeletions && ( 
            <Button 
              onClick={onAnalyzeDeletions} 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary/10 whitespace-nowrap px-4 py-2 text-sm sm:text-md self-start sm:self-center font-semibold shadow-sm hover:shadow-md transition-shadow"
              disabled={isAnalyzing || !data || data.rows.length === 0}
              size="default"
            >
              {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileSearch2 className="mr-2 h-5 w-5" />}
              Silme Kayıtlarını Çıkart & Analiz Et
            </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 flex flex-col flex-grow overflow-hidden"> 
        {data.rows.length === 0 ? ( 
          <div className="flex flex-col items-center justify-center h-80 text-muted-foreground flex-grow text-center p-6">
            <Info className="h-16 w-16 mb-6 text-primary/70" />
            <p className="text-xl font-semibold">Görüntülenecek veri bulunmamaktadır.</p>
             {onAnalyzeDeletions && <p className="text-md mt-2">Lütfen dosya yükleyerek yeni bir birleştirme yapın veya dosyalarınızı kontrol edin.</p>}
          </div>
        ) : (
          <ScrollArea className="flex-grow w-full relative"> {/* Added relative for potential absolute positioned elements inside */}
            <Table className="min-w-full table-auto">
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b border-border">
                <TableRow className="border-b-0">
                  {displayHeaders.map((header, index) => (
                    <TableHead 
                      key={index} 
                      className="font-bold text-card-foreground/90 px-4 py-3.5 text-left text-sm whitespace-nowrap bg-muted/40" 
                    >
                      {String(header)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/70">
                {data.rows.map((originalRow, rowIndex) => {
                  const isHighlighted = markerColIndex !== -1 && originalRow[markerColIndex] === true;
                  
                  let rowCellsForDisplay = [...originalRow];
                  if (markerColIndex !== -1) {
                    rowCellsForDisplay.splice(markerColIndex, 1);
                  }
                  if (hasSiraNo) {
                    // Sıra No already in rowCellsForDisplay
                  } else {
                    rowCellsForDisplay = [rowIndex + 1, ...rowCellsForDisplay];
                  }

                  return (
                    <TableRow 
                      key={rowIndex} 
                      className={cn(
                        "hover:bg-muted/50 transition-colors duration-150",
                        rowIndex % 2 === 0 ? "bg-background/20" : "bg-card/30",
                        isHighlighted && "bg-red-100 dark:bg-red-900/50 hover:bg-red-200/80 dark:hover:bg-red-800/70"
                      )}
                    >
                      {rowCellsForDisplay.map((cellData, cellIndex) => {
                        const headerText = displayHeaders[cellIndex];
                        return (
                          <TableCell 
                            key={cellIndex} 
                            className={cn(
                              "px-4 py-2.5 text-left text-sm break-words",
                              isHighlighted ? "text-red-900 dark:text-red-50 font-medium" : "text-foreground/90"
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
            <CardFooter className="p-4 text-xs text-muted-foreground text-right border-t border-border/50 bg-card/50">
                Toplam {data.rows.length} satır gösteriliyor.
            </CardFooter>
        )}
      </CardContent>
    </Card>
  );
}
