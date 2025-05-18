
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExcelMergeControls } from '@/components/ExcelMergeControls';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, FileSpreadsheet, Info, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type ViewState = 'upload' | 'loading';

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [isMergingProcessActive, setIsMergingProcessActive] = useState(false);
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);

  const router = useRouter();
  const { toast } = useToast();

  const handleMergeStart = () => {
    setIsMergingProcessActive(true);
    setViewState('loading');
  };

  const handleMergeComplete = (data: MergedExcelData) => {
    setIsMergingProcessActive(false);
    if (data && data.headers.length > 0 && (data.rows.length > 0 || selectedFilesCount > 0)) {
      localStorage.setItem('mergedExcelData', JSON.stringify(data));
      router.push('/merged-data');
    } else {
      if (selectedFilesCount > 0) {
        toast({
          variant: "warning",
          title: "Veri Bulunamadı",
          description: "Dosyalar işlendi ancak birleştirilecek uygun veri bulunamadı veya dosyalar boştu. Lütfen dosyalarınızı kontrol edin.",
        });
      } else {
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
    const rawData = localStorage.getItem('mergedExcelData');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && parsedData.headers && parsedData.rows) {
          router.push('/merged-data');
          return;
        }
      } catch (error) {
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
    <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-gradient-to-br from-background to-muted/30 text-foreground">
      {viewState === 'upload' && (
        <div className="w-full max-w-3xl">
          
          <Card className="w-full shadow-xl rounded-xl overflow-hidden border border-border/50">
            <CardHeader className="bg-card/80 p-8 border-b border-border/50">
              <div className="flex flex-col items-center text-center">
                <FileSpreadsheet className="h-20 w-20 text-primary mb-4" />
                <CardTitle className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                  SSK KONTROL SAYFASI
                </CardTitle>
                <CardDescription className="text-md sm:text-lg text-muted-foreground mt-3 max-w-lg mx-auto">
                  Excel dosyalarınızı kolayca yükleyin, birleştirin ve TC Kimlik No'suna göre sıralanmış olarak görüntüleyin.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-10 bg-background/50">
              <ExcelMergeControls 
                onMergeStart={handleMergeStart}
                onMergeComplete={handleMergeComplete} 
                isLoading={isMergingProcessActive}
                onFilesSelected={(count) => setSelectedFilesCount(count)}
              />
            </CardContent>
             <CardFooter className="p-6 bg-card/80 border-t border-border/50 text-center block">
                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Excel Birleştirme Aracı. Tüm hakları saklıdır.
                </p>
            </CardFooter>
          </Card>
        </div>
      )}
      
      {viewState === 'loading' && (
         <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-4 text-center">
            <Loader2 className="h-24 w-24 animate-spin mb-8 text-primary" />
            <p className="text-3xl font-semibold">Dosyalar birleştiriliyor...</p>
            <p className="text-muted-foreground mt-3 text-lg">Lütfen bekleyin, bu işlem dosya boyutuna göre biraz zaman alabilir.</p>
        </div>
      )}
    </main>
  );
}
