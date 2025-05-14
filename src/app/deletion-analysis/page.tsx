
// This file is no longer needed as the deletion analysis is integrated into the main merged data table.
// It can be safely deleted. 
// To prevent build errors if it's somehow still referenced, returning a simple component.
"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

export default function DeprecatedDeletionAnalysisPage() {
  const router = useRouter();
  React.useEffect(() => {
    // Redirect to merged data page as this page is deprecated
    router.replace('/merged-data');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <Info className="h-12 w-12 text-primary mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Bu sayfa artık kullanılmıyor.</h1>
      <p className="text-muted-foreground mb-4">Silme analizi artık ana birleştirilmiş veri tablosunda gösterilmektedir.</p>
      <Button onClick={() => router.push('/merged-data')}>
        Birleştirilmiş Verilere Git
      </Button>
    </div>
  );
}
