
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MergedDataTable } from '@/components/MergedDataTable';
import type { MergedExcelData } from '@/lib/excel-utils';
import { Loader2, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      <div className="w-full px-4 sm:px-8 py-6">
        <Button onClick={handleNewMerge} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-5 w-5" />
          Yeni Birleştirme Yap
        </Button>
      </div>

      {/* Content Section: Loader, Table, or No Data Message */}
      {/* This container ensures content below button can take up available space or have its own controlled layout */}
      <div className="w-full flex-grow flex flex-col">
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center text-lg text-primary p-4">
            <Loader2 className="h-12 w-12 animate-spin mb-3" />
            <p>Veriler yükleniyor...</p>
          </div>
        )}

        {!isLoading && mergedData && mergedData.headers.length > 0 && (
          // MergedDataTable includes a Card with w-full and mt-8.
          // The mt-8 on the Card will create vertical space from the button section above.
          // This page structure ensures no horizontal padding is applied to MergedDataTable, allowing it to be full-width.
          <MergedDataTable data={mergedData} />
        )}
        
        {!isLoading && (!mergedData || mergedData.headers.length === 0) && (
          // This div has mt-8 to match the table's Card margin, and px for its text content.
          <div className="w-full text-center px-4 sm:px-8 mt-8 py-10"> 
            <p className="text-muted-foreground">Yüklenecek birleştirilmiş veri bulunmamaktadır.</p>
            <p className="text-sm text-muted-foreground mt-2">Dosya yükleme sayfasına geri dönmek için yukarıdaki butonu kullanın.</p>
          </div>
        )}
      </div>
    </main>
  );
}
