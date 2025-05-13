import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'], // Added latin-ext for broader character support
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'], // Added latin-ext for broader character support
});

export const metadata: Metadata = {
  title: 'Excel Birleştirme Uzmanı', // Changed title to Turkish
  description: 'SSK Kontrol Sayfası - Excel Dosyalarını Birleştirin ve Analiz Edin', // Updated description in Turkish
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
