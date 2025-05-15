
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, Info, Home, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { extractDeletionRelatedRecords } from '@/lib/analysis-utils'; 

export default function MergedDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mergedData, setMergedData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 


  useEffect(() => {
    const rawData = localStorage.getItem('mergedExcelData');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && Array.isArray(parsedData.headers) && Array.isArray(parsedData.rows)) {
         setMergedData(parsedData);
        } else {
         toast({ variant: "destructive", title: "Hata", description: "Saklanan birleştirilmiş veriler bozuk veya geçersiz formatta." });
         localStorage.removeItem('mergedExcelData');
        }
      } catch (error) {
        console.error("Error parsing merged data from localStorage:", error);
        toast({ variant: "destructive", title: "Veri Yükleme Hatası", description: "Saklanan veriler okunurken bir sorun oluştu." });
        localStorage.removeItem('mergedExcelData');
      }
    }
    setIsLoading(false);
  }, [toast]);

  const handleNewMerge = () => {
    localStorage.removeItem('mergedExcelData');
    localStorage.removeItem('deletionAnalysisFullResults'); 
    router.push('/');
  };

  const handleTriggerDeletionAnalysis = async () => {
    if (!mergedData) {
      toast({ variant: "warning", title: "Veri Yok", description: "Analiz edilecek birleştirilmiş veri bulunmuyor." });
      return;
    }
    setIsAnalyzing(true);
    toast({ variant: "default", title: "Analiz Başlatıldı", description: "Silme kayıtları analiz ediliyor, lütfen bekleyin..." });
    
    try {
      const analysisResult = await extractDeletionRelatedRecords(mergedData); 
      
      localStorage.setItem('deletionAnalysisFullResults', JSON.stringify(analysisResult));
      router.push('/deletion-analysis');
      // Toast for success will be shown on the new page or to indicate process start
      
    } catch (error) {
      console.error("Error during deletion analysis trigger:", error);
      toast({ variant: "destructive", title: "Analiz Sırasında Hata", description: `Bir hata oluştu: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted/30">
      <header className="sticky top-0 z-30 w-full bg-card shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold text-primary flex items-center">
            <ArrowLeft className="mr-2 h-5 w-5 cursor-pointer hover:text-primary/80" onClick={() => router.back()} title="Geri Dön"/>
            Birleştirilmiş Veri Sonuçları
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
            <p className="text-xl font-semibold">Birleştirilmiş veriler yükleniyor...</p>
            <p className="text-muted-foreground mt-1">Lütfen bekleyin.</p>
          </div>
        )}

        {!isLoading && mergedData && (mergedData.headers.length > 0 || mergedData.rows.length > 0) && (
          <MergedDataTable 
            data={mergedData} 
            onAnalyzeDeletions={handleTriggerDeletionAnalysis}
            isAnalyzing={isAnalyzing}
          />
        )}
        
        {!isLoading && (!mergedData || (mergedData.headers.length === 0 && mergedData.rows.length === 0)) && (
          <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4">
            <Card className="w-full max-w-lg shadow-xl rounded-lg">
              <CardHeader className="text-center">
                  <Info className="h-16 w-16 text-primary mx-auto mb-5" />
                <CardTitle className="text-2xl font-bold text-foreground">
                    Veri Bulunamadı
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <p className="text-muted-foreground text-md mb-6">
                  Görüntülenecek birleştirilmiş veri bulunmamaktadır. 
                  Bu durum, daha önce bir birleştirme yapılmadığını veya saklanan verinin silinmiş/bozulmuş olabileceğini gösterir.
                </p>
                <Button onClick={handleNewMerge} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Yeni Birleştirme Sayfasına Git
                </Button>
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

    