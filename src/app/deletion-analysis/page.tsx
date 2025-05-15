
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable'; 
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, Info, Home, ArrowLeft, FileWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ANALYSIS_HIGHLIGHT_MARKER_HEADER } from '@/lib/analysis-utils';

export default function DeletionAnalysisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawData = localStorage.getItem('deletionAnalysisFullResults');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && Array.isArray(parsedData.headers) && Array.isArray(parsedData.rows)) {
         setAnalysisData(parsedData);
         toast({variant: "default", title:"Analiz Yüklendi", description: "İşlenmiş silme kayıtları vurgulanmıştır."})
        } else {
         toast({ variant: "destructive", title: "Hata", description: "Saklanan analiz verileri bozuk veya geçersiz formatta." });
         localStorage.removeItem('deletionAnalysisFullResults'); 
        }
      } catch (error) {
        console.error("Error parsing analysis data from localStorage:", error);
        toast({ variant: "destructive", title: "Veri Yükleme Hatası", description: "Saklanan analiz verileri okunurken bir sorun oluştu." });
        localStorage.removeItem('deletionAnalysisFullResults');
      }
    } else {
        toast({ variant: "warning", title: "Veri Yok", description: "Görüntülenecek analiz verisi bulunamadı. Lütfen birleştirme sayfasından analizi tekrar başlatın." });
    }
    setIsLoading(false);
  }, [toast]);

  const handleNewMerge = () => {
    localStorage.removeItem('mergedExcelData'); 
    localStorage.removeItem('deletionAnalysisFullResults');
    router.push('/');
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted/20">
      <header className="sticky top-0 z-30 w-full bg-card/95 backdrop-blur-md shadow-lg border-b border-border/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <div className="flex items-center">
            <Button onClick={() => router.push('/merged-data')} variant="ghost" size="icon" className="mr-2 text-primary hover:bg-primary/10" title="Birleştirilmiş Verilere Dön">
                <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center">
              Silme Kayıt Analizi (Vurgulanmış)
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleNewMerge} variant="outline" className="text-primary border-primary hover:bg-primary/10 shadow-sm hover:shadow-md transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Birleştirme
            </Button>
             <Button onClick={() => router.push('/')} variant="ghost" size="icon" title="Ana Sayfa" className="text-primary hover:bg-primary/10">
              <Home className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full py-8 px-0 sm:px-0 lg:px-0 flex flex-col"> 
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-8 mt-10 text-center">
            <Loader2 className="h-20 w-20 animate-spin mb-6" />
            <p className="text-2xl font-semibold">Analiz verileri yükleniyor...</p>
            <p className="text-muted-foreground mt-2">Lütfen bekleyin.</p>
          </div>
        )}

        {!isLoading && analysisData && (analysisData.headers.length > 0 || analysisData.rows.length > 0) && (
          <div className="px-0 sm:px-4 lg:px-6">
            <MergedDataTable 
              data={analysisData}
              highlightMarkerHeader={ANALYSIS_HIGHLIGHT_MARKER_HEADER}
            />
          </div>
        )}
        
        {!isLoading && (!analysisData || (analysisData.headers.length === 0 && analysisData.rows.length === 0)) && (
          <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4 text-center">
            <Card className="w-full max-w-lg shadow-xl rounded-lg border border-border/50">
              <CardHeader className="p-8">
                  <FileWarning className="h-20 w-20 text-destructive mx-auto mb-6" />
                <CardTitle className="text-3xl font-bold text-foreground">
                    Analiz Verisi Bulunamadı
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-10 px-8">
                <p className="text-muted-foreground text-md mb-8">
                  Görüntülenecek analiz edilmiş veri bulunmamaktadır. 
                  Lütfen önceki sayfaya dönüp analizi tekrar çalıştırın veya yeni bir birleştirme yapın.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Button onClick={() => router.push('/merged-data')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-md py-3 shadow-sm hover:shadow-md transition-shadow">
                    Birleştirilmiş Verilere Dön
                    </Button>
                    <Button onClick={handleNewMerge} variant="outline" className="w-full sm:w-auto text-md py-3 border-primary text-primary hover:bg-primary/10 shadow-sm hover:shadow-md transition-shadow">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Yeni Birleştirme
                    </Button>
                </div>
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
