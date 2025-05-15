
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, GitMerge, Loader2, FileText, XCircle, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MergedExcelData } from '@/lib/excel-utils';
import { processAndMergeFiles } from '@/lib/excel-utils';

interface ExcelMergeControlsProps {
  onMergeStart: () => void;
  onMergeComplete: (data: MergedExcelData) => void;
  isLoading: boolean;
  onFilesSelected: (count: number) => void;
}

export function ExcelMergeControls({ onMergeStart, onMergeComplete, isLoading, onFilesSelected }: ExcelMergeControlsProps) {
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
      
      const updatedFiles = [...selectedFiles];
      validFiles.forEach(newFile => {
        if (!updatedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
          updatedFiles.push(newFile);
        } else {
          toast({
            variant: "default",
            title: "Dosya Zaten Seçili",
            description: `${newFile.name} adlı dosya zaten listede. Farklı bir dosya seçebilir veya mevcut olanı kaldırabilirsiniz.`,
          });
        }
      });
      setSelectedFiles(updatedFiles);
      onFilesSelected(updatedFiles.length);
      event.target.value = ''; 
    }
  };

  const removeFile = (fileName: string) => {
    const updatedFiles = selectedFiles.filter(file => file.name !== fileName);
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles.length);
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
          variant: "warning", 
          title: "Veri Bulunamadı",
          description: "Dosyalar işlendi ancak birleştirilecek veri bulunamadı veya dosyalar boştu.",
        });
         onMergeComplete({ headers: data.headers, rows: data.rows }); 
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
      onMergeComplete({ headers: [], rows: [] }); 
    }
  };

  return (
    <Card className="w-full shadow-none border-none bg-transparent">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="flex items-center text-2xl font-semibold text-foreground">
          <UploadCloud className="mr-3 h-7 w-7 text-primary" />
          Dosyaları Yükleyin
        </CardTitle>
        <CardDescription className="mt-1 text-muted-foreground">
          Birleştirmek istediğiniz Excel (.xlsx, .xls), CSV (.csv) veya ODS (.ods) dosyalarını seçin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-0">
        <div className="space-y-3">
          <label htmlFor="file-upload" className="sr-only">
            Dosyaları Seçin
          </label>
          <Input
            id="file-upload"
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.ods"
            onChange={handleFileChange}
            className="flex-grow w-full h-12 text-base file:mr-4 file:py-2.5 file:px-5 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:whitespace-nowrap file:rounded-md file:border-0 cursor-pointer focus-visible:ring-primary"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{selectedFiles.length} dosya seçildi:</h3>
              <ul className="list-none p-0 max-h-40 overflow-y-auto rounded-lg border border-border bg-card/50 divide-y divide-border">
                {selectedFiles.map(file => (
                  <li key={file.name + file.size} className="flex justify-between items-center p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                      <span className="text-sm text-foreground min-w-0 overflow-hidden text-ellipsis whitespace-nowrap mr-2" title={file.name}>{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file.name)} className="p-1 h-7 w-7 shrink-0">
                      <XCircle className="h-5 w-5 text-destructive/70 hover:text-destructive transition-colors" />
                      <span className="sr-only">{file.name} dosyasını kaldır</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-0 mt-8">
        <Button 
          onClick={handleMergeClick} 
          disabled={isLoading || selectedFiles.length === 0} 
          className="w-full text-lg py-6 font-semibold tracking-wide shadow-md hover:shadow-lg transition-shadow"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : (
            <GitMerge className="mr-3 h-6 w-6" />
          )}
          Birleştir ve Görüntüle
        </Button>
      </CardFooter>
    </Card>
  );
}
