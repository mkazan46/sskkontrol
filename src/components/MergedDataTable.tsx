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

const DATE_HEADERS_TR = ["tarih", "işlem tarihi"];
const TIME_HEADERS_TR = ["işlem saati"];

export function MergedDataTable({ data }: MergedDataTableProps) {
  if (!data || data.headers.length === 0) {
    return null;
  }

  const formatCellContent = (cellValue: any, headerText: string): string => {
    if (cellValue === null || cellValue === undefined) {
      return "";
    }

    const normalizedHeaderText = headerText.toLocaleLowerCase('tr-TR').trim();

    if (cellValue instanceof Date && isValid(cellValue)) {
      if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
        return format(cellValue, 'dd.MM.yyyy');
      }
      if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        return format(cellValue, 'HH:mm:ss');
      }
      // Eğer Date nesnesi ama bilinen bir başlık değilse, genel bir formatta göster
      return format(cellValue, 'dd.MM.yyyy HH:mm:ss');
    }

    if (typeof cellValue === 'string') {
      // String ise parse etmeyi dene
      let parsedDate: Date | null = null;
      if (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText)) {
        try {
          // ISO formatını dene (örn: "2023-10-27T10:00:00.000Z")
          const isoDate = parseISO(cellValue);
          if (isValid(isoDate)) {
            parsedDate = isoDate;
          } else {
            // Genel string tarihleri new Date() ile dene
            const genericDate = new Date(cellValue);
            if (isValid(genericDate) && genericDate.getFullYear() > 1800) { // Geçerli bir yıl kontrolü
              parsedDate = genericDate;
            }
          }
        } catch (e) { /* Hata olursa string olarak kalır */ }

        if (parsedDate && isValid(parsedDate)) {
          if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
            return format(parsedDate, 'dd.MM.yyyy');
          }
          if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
            // Eğer string sadece saat içeriyorsa (örn: "10:30")
            if (cellValue.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                const timeParts = cellValue.split(':').map(Number);
                const tempDateForTime = new Date();
                tempDateForTime.setHours(timeParts[0], timeParts[1], timeParts[2] || 0, 0);
                 if(isValid(tempDateForTime)){
                    return format(tempDateForTime, 'HH:mm:ss');
                 }
            }
            return format(parsedDate, 'HH:mm:ss');
          }
        }
      }
    }
    
    // Excel'den gelen sayısal tarihleri (serial date) işlemek için:
    // Bu kısım, `cellDates: true` sayesinde Date nesneleri gelmiyorsa ve sayılar geliyorsa devreye girer.
    // `excel-utils.ts` içinde `cellDates: true` olduğundan bu bloğa genellikle girilmemesi beklenir.
    if (typeof cellValue === 'number' && (DATE_HEADERS_TR.includes(normalizedHeaderText) || TIME_HEADERS_TR.includes(normalizedHeaderText))) {
        // Excel serial date to JS Date conversion (basitleştirilmiş)
        // XLSX.SSF.parse_date_code kullanmak en doğrusudur, ama burada doğrudan erişim yok.
        // Bu basit dönüşüm her zaman %100 doğru olmayabilir.
        try {
            const excelBaseDateEpoch = Date.UTC(1899, 11, 30); // Excel'in 0. günü
            const jsDateEpoch = Date.UTC(1970, 0, 1);
            const epochDifferenceInMs = jsDateEpoch - excelBaseDateEpoch;
            
            // Gün ve saat kısmını ayır
            const days = Math.floor(cellValue);
            const timeFraction = cellValue - days;
            
            const dateMilliseconds = days * 24 * 60 * 60 * 1000 - epochDifferenceInMs;
            const timeMilliseconds = timeFraction * 24 * 60 * 60 * 1000;

            const finalDate = new Date(dateMilliseconds + timeMilliseconds);

            if (isValid(finalDate)) {
                 if (DATE_HEADERS_TR.includes(normalizedHeaderText)) {
                    return format(finalDate, 'dd.MM.yyyy');
                }
                if (TIME_HEADERS_TR.includes(normalizedHeaderText)) {
                    return format(finalDate, 'HH:mm:ss');
                }
            }
        } catch(e) { /* Hata durumunda string olarak kalır */ }
    }


    return String(cellValue);
  };

  return (
    <Card className="w-full mt-8 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Table2 className="mr-3 h-7 w-7 text-primary" />
          Birleştirilmiş Excel Verileri
        </CardTitle>
        <CardDescription>
          Yüklediğiniz dosyalardan birleştirilmiş veriler aşağıda gösterilmektedir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Birleştirilmiş veri bulunmamaktadır veya seçilen dosyalarda veri yoktu.</p>
        ) : (
          <ScrollArea className="max-h-[500px] w-full overflow-auto border rounded-md">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  {data.headers.map((header, index) => (
                    <TableHead key={index} className="font-semibold text-card-foreground px-4 py-3 text-left">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50">
                    {data.headers.map((header, cellIndex) => (
                      <TableCell key={cellIndex} className="text-foreground px-4 py-2 text-left">
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
        <p className="text-sm text-muted-foreground mt-4 text-right">
          Toplam {data.rows.length} satır gösteriliyor.
        </p>
      </CardContent>
    </Card>
  );
}
