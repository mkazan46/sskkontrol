
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, Info, Home, ArrowLeft, FileWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      // Yield to the browser to update UI before starting heavy computation
      await new Promise(resolve => setTimeout(resolve, 0));
      const analysisResult = await extractDeletionRelatedRecords(mergedData); 
      
      localStorage.setItem('deletionAnalysisFullResults', JSON.stringify(analysisResult));
      toast({ variant: "default", title: "Analiz Tamamlandı", description: "Veriler işlendi. Sonuçlar yeni sayfada gösteriliyor." });
      router.push('/deletion-analysis');
      
    } catch (error) {
      console.error("Error during deletion analysis trigger:", error);
      toast({ variant: "destructive", title: "Analiz Sırasında Hata", description: `Bir hata oluştu: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted/20">
      <header className="sticky top-0 z-30 w-full bg-card/95 backdrop-blur-md shadow-lg border-b border-border/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <div className="flex items-center">
            <Button onClick={() => router.push('/')} variant="ghost" size="icon" className="mr-2 text-primary hover:bg-primary/10" title="Ana Sayfa">
              <Home className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold text-primary tracking-tight">
              Birleştirilmiş Veri Sonuçları
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleNewMerge} variant="outline" className="text-primary border-primary hover:bg-primary/10 shadow-sm hover:shadow-md transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Birleştirme
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full py-8 px-0 sm:px-0 lg:px-0 flex flex-col"> 
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-8 mt-10 text-center">
            <Loader2 className="h-20 w-20 animate-spin mb-6" />
            <p className="text-2xl font-semibold">Birleştirilmiş veriler yükleniyor...</p>
            <p className="text-muted-foreground mt-2">Lütfen bekleyin.</p>
          </div>
        )}

        {!isLoading && mergedData && (mergedData.headers.length > 0 || mergedData.rows.length > 0) && (
          <div className="px-0 sm:px-4 lg:px-6">
            <MergedDataTable 
              data={mergedData} 
              onAnalyzeDeletions={handleTriggerDeletionAnalysis}
              isAnalyzing={isAnalyzing}
            />
          </div>
        )}
        
        {!isLoading && (!mergedData || (mergedData.headers.length === 0 && mergedData.rows.length === 0)) && (
          <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4 text-center">
            <Card className="w-full max-w-lg shadow-xl rounded-lg border border-border/50">
              <CardHeader className="p-8">
                  <FileWarning className="h-20 w-20 text-destructive mx-auto mb-6" />
                <CardTitle className="text-3xl font-bold text-foreground">
                    Veri Bulunamadı
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-10 px-8">
                <p className="text-muted-foreground text-md mb-8">
                  Görüntülenecek birleştirilmiş veri bulunmamaktadır. 
                  Bu durum, daha önce bir birleştirme yapılmadığını veya saklanan verinin silinmiş/bozulmuş olabileceğini gösterir.
                </p>
                <Button onClick={handleNewMerge} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6 shadow-md hover:shadow-lg transition-shadow">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Yeni Birleştirme Yap
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-card/50">
         © {new Date().getFullYear()} Excel Birleştirme Aracı.
      </footer>
    </div>
  );
}
