
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable'; // Re-use MergedDataTable
import type { MergedExcelData } from '@/lib/excel-utils'; // MergedExcelData can represent the structure
import { Loader2, Info, Home, ArrowLeft, FileSearch2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DeletionAnalysisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawData = localStorage.getItem('deletionAnalysisData');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
         // Basic validation for the structure (headers and rows are arrays)
        if (parsedData && Array.isArray(parsedData.headers) && Array.isArray(parsedData.rows)) {
          setAnalysisData(parsedData);
        } else {
          toast({ variant: "destructive", title: "Hata", description: "Saklanan analiz verileri bozuk veya geçersiz formatta." });
          localStorage.removeItem('deletionAnalysisData'); 
        }
      } catch (error) {
        console.error("Error parsing analysis data from localStorage:", error);
        toast({ variant: "destructive", title: "Veri Yükleme Hatası", description: "Saklanan analiz verileri okunurken bir sorun oluştu." });
        localStorage.removeItem('deletionAnalysisData');
      }
    }
    setIsLoading(false);
  }, [toast]);

  const handleGoToMergedData = () => {
    router.push('/merged-data');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted/30">
      <header className="sticky top-0 z-30 w-full bg-card shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold text-primary flex items-center">
            <ArrowLeft className="mr-2 h-5 w-5 cursor-pointer hover:text-primary/80" onClick={() => router.back()} title="Geri Dön"/>
            Silme Analizi Sonuçları
          </h1>
          <div className="flex items-center gap-3">
            <Button onClick={handleGoToMergedData} variant="outline" className="text-primary border-primary hover:bg-primary/10">
              <FileSearch2 className="mr-2 h-5 w-5" />
              Birleştirilmiş Verilere Dön
            </Button>
             <Button onClick={() => router.push('/')} variant="ghost" size="icon" title="Ana Sayfa">
              <Home className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full py-6">
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-8 mt-10">
            <Loader2 className="h-16 w-16 animate-spin mb-4" />
            <p className="text-xl font-semibold">Analiz verileri yükleniyor...</p>
            <p className="text-muted-foreground mt-1">Lütfen bekleyin.</p>
          </div>
        )}

        {!isLoading && analysisData && analysisData.headers[0] === "Hata" && (
            <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4">
             <Card className="w-full max-w-lg shadow-xl rounded-lg">
               <CardHeader className="text-center">
                   <Info className="h-16 w-16 text-destructive mx-auto mb-5" />
                 <CardTitle className="text-2xl font-bold text-destructive">
                     Analiz Hatası
                 </CardTitle>
               </CardHeader>
               <CardContent className="text-center pb-8">
                 <p className="text-muted-foreground text-md mb-6">
                   {analysisData.rows[0][0]}
                 </p>
                 <Button onClick={handleGoToMergedData} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                   Birleştirilmiş Verilere Dön
                 </Button>
               </CardContent>
             </Card>
           </div>
        )}

        {!isLoading && analysisData && analysisData.headers[0] !== "Hata" && (analysisData.headers.length > 0 || analysisData.rows.length > 0) && (
          <MergedDataTable data={analysisData} />
        )}
        
        {!isLoading && (!analysisData || (analysisData.headers.length === 0 && analysisData.rows.length === 0) || (analysisData.headers.length > 0 && analysisData.rows.length === 0 && analysisData.headers[0] !== "Hata") ) &&  (
          <div className="flex-grow flex flex-col items-center justify-center mt-10 px-4">
            <Card className="w-full max-w-lg shadow-xl rounded-lg">
              <CardHeader className="text-center">
                  <Info className="h-16 w-16 text-primary mx-auto mb-5" />
                <CardTitle className="text-2xl font-bold text-foreground">
                    Analiz Edilecek Veri Bulunamadı
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <p className="text-muted-foreground text-md mb-6">
                  Görüntülenecek analiz edilmiş silme kaydı bulunmamaktadır. 
                  Bu durum, ilişkili "silme", "giriş" ve "çıkış" kayıtlarının bulunmadığını veya analizin henüz yapılmadığını gösterebilir.
                </p>
                <Button onClick={handleGoToMergedData} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                   Birleştirilmiş Verilere Dön ve Analiz Et
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

