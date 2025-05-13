"use client";

import React, { useState } from 'react';
import { ExcelMergeControls } from '@/components/ExcelMergeControls';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [mergedData, setMergedData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleMergeStart = () => {
    setIsLoading(true);
    setMergedData(null); // Clear previous results
  };

  const handleMergeComplete = (data: MergedExcelData) => {
    setMergedData(data);
    setIsLoading(false);
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      <header className="w-full max-w-4xl mb-8 text-center sm:text-left">
        <h1 className="text-4xl font-bold text-primary tracking-tight">
          SSK KONTROL SAYFASI
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Excel dosyalarınızı kolayca yükleyin ve birleştirin.
        </p>
      </header>

      <div className="w-full max-w-2xl">
        <ExcelMergeControls 
          onMergeStart={handleMergeStart}
          onMergeComplete={handleMergeComplete} 
          isLoading={isLoading} 
        />
      </div>
      
      {isLoading && (
        <div className="mt-8 flex flex-col items-center text-lg text-primary">
          <Loader2 className="h-12 w-12 animate-spin mb-3" />
          <p>Dosyalar birleştiriliyor, lütfen bekleyin...</p>
        </div>
      )}

      {!isLoading && mergedData && (
        <div className="w-full max-w-5xl mt-8"> {/* Wider container for table */}
          <MergedDataTable data={mergedData} />
        </div>
      )}
    </main>
  );
}
