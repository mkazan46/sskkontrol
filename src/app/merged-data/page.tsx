
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

export default function MergedDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mergedData, setMergedData] = useState<MergedExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawData = localStorage.getItem('mergedExcelData');
    if (rawData) {
      try {
        const parsedData: MergedExcelData = JSON.parse(rawData);
        if (parsedData && parsedData.headers && parsedData.rows) {
         setMergedData(parsedData);
        } else {
         toast({ variant: "destructive", title: "Hata", description: "Saklanan veriler bozuk veya eksik." });
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
    router.push('/');
  };

  return (
    <main className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Button Section with its own padding */}
      <div className="w-full px-4 sm:px-8 py-6 bg-background shadow-sm sticky top-0 z-20">
        <Button onClick={handleNewMerge} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-5 w-5" />
          Yeni Birleştirme Yap
        </Button>
      </div>

      {/* Content Section: Loader, Table, or No Data Message */}
      <div className="w-full flex-grow flex flex-col p-4 sm:p-8">
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-4">
            <Loader2 className="h-16 w-16 animate-spin mb-4" />
            <p className="text-xl">Veriler yükleniyor...</p>
          </div>
        )}

        {!isLoading && mergedData && mergedData.headers.length > 0 && (
          <MergedDataTable data={mergedData} />
        )}
        
        {!isLoading && (!mergedData || mergedData.headers.length === 0) && (
          <div className="flex-grow flex flex-col items-center justify-center">
            <Card className="w-full max-w-md shadow-lg">
              <CardContent className="p-8 text-center">
                <Info className="h-12 w-12 text-primary mx-auto mb-4" />
                <p className="text-xl font-semibold text-foreground mb-2">Veri Bulunamadı</p>
                <p className="text-muted-foreground">
                  Görüntülenecek birleştirilmiş veri bulunmamaktadır. 
                  Yeni bir birleştirme yapmak için yukarıdaki butonu kullanabilirsiniz.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

