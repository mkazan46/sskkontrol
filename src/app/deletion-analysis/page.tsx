
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable'; 
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, Info, Home, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DeletionAnalysisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawData = localStorage.getItem('deletionAnalysisResults');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && Array.isArray(parsedData.headers) && Array.isArray(parsedData.rows)) {
         setAnalysisData(parsedData);
        } else {
         toast({ variant: "destructive", title: "Hata", description: "Saklanan analiz verileri bozuk veya geçersiz formatta." });
         localStorage.removeItem('deletionAnalysisResults'); 
        }
      } catch (error) {
        console.error("Error parsing analysis data from localStorage:", error);
        toast({ variant: "destructive", title: "Veri Yükleme Hatası", description: "Saklanan analiz verileri okunurken bir sorun oluştu." });
        localStorage.removeItem('deletionAnalysisResults');
      }
    } else {
        toast({ variant: "warning", title: "Veri Yok", description: "Görüntülenecek analiz verisi bulunamadı. Lütfen birleştirme sayfasından analizi tekrar başlatın." });
    }
    setIsLoading(false);
  }, [toast]);

  const handleNewMerge = () => {
    localStorage.removeItem('mergedExcelData'); 
    localStorage.removeItem('deletionAnalysisResults');
    router.push('/');
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted/30">
      <header className="sticky top-0 z-30 w-full bg-card shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold text-primary flex items-center">
            <ArrowLeft className="mr-2 h-5 w-5 cursor-pointer hover:text-primary/80" onClick={() => router.push('/merged-data')} title="Birleştirilmiş Verilere Dön"/>
            Silme Kayıt Analizi Sonuçları
          </h1>
          <div className="flex items-center gap-3">
            <Button onClick={handleNewMerge} variant="outline" className="text-primary border-primary hover:bg-primary/10">
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Birleştirme
            </Button>
             <Button onClick={() => router.push('/')} variant="ghost" size="icon" title="Ana Sayfa">
              <Home className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full py-6 px-0 sm:px-0 lg:px-0 flex flex-col"> 
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-8 mt-10">
            <Loader2 className="h-16 w-16 animate-spin mb-4" />
            <p className="text-xl font-semibold">Analiz verileri yükleniyor...</p>
            <p className="text-muted-foreground mt-1">Lütfen bekleyin.</p>
          </div>
        )}

        {!isLoading && analysisData && (analysisData.headers.length > 0 || analysisData.rows.length > 0) && (
          <MergedDataTable 
            data={analysisData} 
            // onAnalyzeDeletions prop is not passed here as this page only displays results
          />
        )}
        
        {!isLoading && (!analysisData || (analysisData.headers.length === 0 && analysisData.rows.length === 0)) && (
          <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4">
            <Card className="w-full max-w-lg shadow-xl rounded-lg">
              <CardHeader className="text-center">
                  <Info className="h-16 w-16 text-primary mx-auto mb-5" />
                <CardTitle className="text-2xl font-bold text-foreground">
                    Analiz Verisi Bulunamadı
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <p className="text-muted-foreground text-md mb-6">
                  Görüntülenecek analiz edilmiş veri bulunmamaktadır. 
                  Lütfen önceki sayfaya dönüp analizi tekrar çalıştırın veya yeni bir birleştirme yapın.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-2">
                    <Button onClick={() => router.push('/merged-data')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                    Birleştirilmiş Verilere Dön
                    </Button>
                    <Button onClick={handleNewMerge} variant="outline" className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Yeni Birleştirme
                    </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
       <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
         © {new Date().getFullYear()} Excel Birleştirme Aracı.
      </footer>
    </div>
  );
}
