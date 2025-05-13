
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
          // Removed ScrollArea, Table component handles its own overflow
          <div className="max-h-[500px] overflow-auto border rounded-md"> {/* Added a div to constrain height and enable y-scroll for table */}
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  {data.headers.map((header, index) => (
                    <TableHead key={index} className="font-semibold text-card-foreground whitespace-nowrap px-4 py-3"> {/* Added padding for better spacing */}
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, rowIndex) => ( // Corrected: (row, rowIndex)
                  <TableRow key={rowIndex} className="hover:bg-muted/50">
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="text-foreground whitespace-nowrap px-4 py-2"> {/* Added padding for better spacing */}
                        {String(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-4 text-right"> {/* Increased margin-top for spacing */}
          Toplam {data.rows.length} satır gösteriliyor.
        </p>
      </CardContent>
    </Card>
  );
}

