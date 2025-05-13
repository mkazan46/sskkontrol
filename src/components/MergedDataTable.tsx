
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

interface MergedDataTableProps {
  data: MergedExcelData | null;
}

export function MergedDataTable({ data }: MergedDataTableProps) {
  if (!data || data.headers.length === 0) {
    return null;
  }

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
            <Table className="min-w-full"> {/* Tablonun minimum genişliğini ayarlayarak içeriğin sığmasını sağlar */}
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  {data.headers.map((header, index) => (
                    <TableHead key={index} className="font-semibold text-card-foreground px-4 py-3 text-left"> {/* whitespace-nowrap kaldırıldı, text-left eklendi */}
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50">
                    {data.headers.map((header, cellIndex) => ( // Use data.headers to map cells to ensure correct order and count
                      <TableCell key={cellIndex} className="text-foreground px-4 py-2 text-left"> {/* whitespace-nowrap kaldırıldı, text-left eklendi */}
                        {String(row[cellIndex] !== undefined && row[cellIndex] !== null ? row[cellIndex] : "")}
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
