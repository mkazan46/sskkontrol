"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, GitMerge, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MergedExcelData } from '@/lib/excel-utils';
import { processAndMergeFiles } from '@/lib/excel-utils';

interface ExcelMergeControlsProps {
  onMergeStart: () => void;
  onMergeComplete: (data: MergedExcelData) => void;
  isLoading: boolean;
}

export function ExcelMergeControls({ onMergeStart, onMergeComplete, isLoading }: ExcelMergeControlsProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const validFiles = newFiles.filter(file => 
        ['.xlsx', '.xls', '.csv', '.ods'].some(ext => file.name.toLowerCase().endsWith(ext))
      );
      
      if (validFiles.length !== newFiles.length) {
        toast({
          variant: "destructive",
          title: "Geçersiz Dosya Türü",
          description: "Lütfen sadece Excel (.xlsx, .xls), CSV (.csv) veya ODS (.ods) dosyaları yükleyin.",
        });
      }
      setSelectedFiles(validFiles);
    } else {
      setSelectedFiles([]);
    }
  };

  const handleMergeClick = async () => {
    if (selectedFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Dosya Seçilmedi",
        description: "Lütfen birleştirmek için en az bir Excel dosyası seçin.",
      });
      return;
    }
    onMergeStart();
    try {
      const data = await processAndMergeFiles(selectedFiles);
      if (data.headers.length === 0 && data.rows.length === 0 && selectedFiles.length > 0) {
        toast({
          variant: "destructive",
          title: "Birleştirme Hatası",
          description: "Dosyalar işlenemedi veya boş içerik. Lütfen dosyaları kontrol edin.",
        });
         onMergeComplete({ headers: [], rows: [] });
      } else {
        onMergeComplete(data);
        toast({
          title: "Başarılı!",
          description: `${selectedFiles.length} dosya başarıyla birleştirildi.`,
        });
      }
    } catch (error) {
      console.error("Error merging files:", error);
      toast({
        variant: "destructive",
        title: "Birleştirme Hatası",
        description: `Dosyalar birleştirilirken bir hata oluştu: ${error instanceof Error ? error.message : String(error)}`,
      });
      onMergeComplete({ headers: [], rows: [] }); // Reset data on error
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <FileText className="mr-3 h-7 w-7 text-primary" />
          Excel Dosyalarını Yükle ve Birleştir
        </CardTitle>
        <CardDescription>
          Birleştirmek istediğiniz Excel (.xlsx, .xls), CSV (.csv) veya ODS (.ods) dosyalarını seçin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="file-upload" className="block text-sm font-medium text-card-foreground/80">
            Dosyaları Seçin
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="file-upload"
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.ods"
              onChange={handleFileChange}
              className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p>{selectedFiles.length} dosya seçildi:</p>
              <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
                {selectedFiles.map(file => <li key={file.name}>{file.name}</li>)}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleMergeClick} 
          disabled={isLoading || selectedFiles.length === 0} 
          className="w-full text-base py-3"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <GitMerge className="mr-2 h-5 w-5" />
          )}
          Birleştir
        </Button>
      </CardFooter>
    </Card>
  );
}
