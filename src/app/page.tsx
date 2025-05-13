
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExcelMergeControls } from '@/components/ExcelMergeControls';
// MergedDataTable is not directly used here anymore, as we navigate to a new page.
// import { MergedDataTable } from '@/components/MergedDataTable'; 
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, FileSpreadsheet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';


type ViewState = 'upload' | 'loading'; // 'table' state is removed as we navigate

export default function Home() {
  // const [mergedData, setMergedData] = useState<MergedExcelData | null>(null); // Not needed if redirecting
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [isMergingProcessActive, setIsMergingProcessActive] = useState(false);
  const [selectedFilesCount, setSelectedFilesCount] = useState(0); // Keep track for empty data message

  const router = useRouter();
  const { toast } = useToast();

  const handleMergeStart = () => {
    setIsMergingProcessActive(true);
    setViewState('loading');
    // setMergedData(null); // Not needed
  };

  const handleMergeComplete = (data: MergedExcelData) => {
    setIsMergingProcessActive(false);
    if (data && data.headers.length > 0 && (data.rows.length > 0 || selectedFilesCount > 0)) {
      localStorage.setItem('mergedExcelData', JSON.stringify(data)); // Data from processAndMergeFiles is already sorted
      router.push('/merged-data');
    } else {
      if (selectedFilesCount > 0) { // Files were selected and processed, but no data resulted
        toast({
          variant: "warning",
          title: "Veri Bulunamadı",
          description: "Dosyalar işlendi ancak birleştirilecek uygun veri bulunamadı veya dosyalar boştu. Lütfen dosyalarınızı kontrol edin.",
        });
      } else {
         // This case (no files selected) should be handled by ExcelMergeControls, but as a fallback:
         toast({
          variant: "destructive",
          title: "Dosya Seçilmedi",
          description: "Lütfen birleştirmek için en az bir Excel dosyası seçin.",
        });
      }
      setViewState('upload'); 
    }
  };
  
  const handleViewPreviousMerge = () => {
    // Check if there's data in localStorage
    const rawData = localStorage.getItem('mergedExcelData');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && parsedData.headers && parsedData.rows) {
          router.push('/merged-data');
          return;
        }
      } catch (error) {
        // Invalid data in localStorage, remove it
        localStorage.removeItem('mergedExcelData');
      }
    }
    toast({
      title: "Önceki Veri Yok",
      description: "Görüntülenecek daha önce birleştirilmiş bir veri bulunamadı.",
      variant: "default"
    });
  };


  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-br from-background to-muted/30 text-foreground">
      <div className="absolute top-4 right-4">
        <Button onClick={handleViewPreviousMerge} variant="outline" size="sm">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Önceki Birleştirmeyi Gör
        </Button>
      </div>
      {viewState === 'upload' && (
        <div className="flex flex-col items-center justify-center flex-grow w-full">
          <Card className="w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden">
            <CardHeader className="bg-primary/5 p-8">
              <div className="flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-16 w-16 text-primary" />
              </div>
              <CardTitle className="text-4xl font-bold text-primary tracking-tight text-center">
                SSK KONTROL SAYFASI
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-3 text-center max-w-md mx-auto">
                Excel dosyalarınızı kolayca yükleyin, birleştirin ve TC Kimlik No'suna göre sıralanmış olarak görüntüleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <ExcelMergeControls 
                onMergeStart={handleMergeStart}
                onMergeComplete={handleMergeComplete} 
                isLoading={isMergingProcessActive}
                onFilesSelected={(count) => setSelectedFilesCount(count)}
              />
            </CardContent>
             <CardFooter className="p-6 bg-primary/5 text-center block">
                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Excel Birleştirme Aracı. Tüm hakları saklıdır.
                </p>
            </CardFooter>
          </Card>
        </div>
      )}
      
      {viewState === 'loading' && (
         <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-4">
            <Loader2 className="h-20 w-20 animate-spin mb-6 text-primary" />
            <p className="text-2xl font-semibold">Dosyalar birleştiriliyor...</p>
            <p className="text-muted-foreground mt-2">Lütfen bekleyin, bu işlem dosya boyutuna göre biraz zaman alabilir.</p>
        </div>
      )}

      {/* Table view is now handled by /merged-data page */}
    </main>
  );
}
