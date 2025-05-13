
"use client";

import React, { useState } from 'react';
import { ExcelMergeControls } from '@/components/ExcelMergeControls';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewState = 'upload' | 'loading' | 'table';

export default function Home() {
  const [mergedData, setMergedData] = useState<MergedExcelData | null>(null);
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [isMergingProcessActive, setIsMergingProcessActive] = useState(false); // For ExcelMergeControls button state

  const handleMergeStart = () => {
    setIsMergingProcessActive(true);
    setViewState('loading');
    setMergedData(null); 
  };

  const handleMergeComplete = (data: MergedExcelData) => {
    setIsMergingProcessActive(false);
    setMergedData(data);
    if (data && data.headers.length > 0 && (data.rows.length > 0 || selectedFilesCount > 0)) { // Consider files were processed even if no rows
      setViewState('table');
    } else {
      setViewState('upload'); // Stay or return to upload if no data or error
    }
  };
  
  // This state is to ensure we show the table view even if there are 0 rows, as long as files were processed.
  // It's a bit of a workaround for the case where processAndMergeFiles returns headers but empty rows for valid files.
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);

  const handleNewMerge = () => {
    setViewState('upload');
    setMergedData(null);
    setSelectedFilesCount(0);
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      {viewState === 'upload' && (
        <>
          <header className="w-full max-w-4xl mb-10 text-center sm:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight flex items-center justify-center sm:justify-start">
              <FileSpreadsheet className="mr-3 h-10 w-10" />
              SSK KONTROL SAYFASI
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Excel dosyalarınızı kolayca yükleyin ve birleştirin.
            </p>
          </header>
          <div className="w-full max-w-3xl">
            <ExcelMergeControls 
              onMergeStart={handleMergeStart}
              onMergeComplete={handleMergeComplete} 
              isLoading={isMergingProcessActive}
              onFilesSelected={(count) => setSelectedFilesCount(count)}
            />
          </div>
        </>
      )}
      
      {viewState === 'loading' && (
        <div className="mt-12 flex flex-col items-center text-lg text-primary">
          <Loader2 className="h-16 w-16 animate-spin mb-4" />
          <p className="text-xl">Dosyalar birleştiriliyor, lütfen bekleyin...</p>
        </div>
      )}

      {viewState === 'table' && mergedData && (
        <div className="w-full max-w-5xl mt-8 flex flex-col items-center">
          <Button onClick={handleNewMerge} className="mb-6 self-start bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" />
            Yeni Birleştirme Yap
          </Button>
          <MergedDataTable data={mergedData} />
        </div>
      )}
    </main>
  );
}

