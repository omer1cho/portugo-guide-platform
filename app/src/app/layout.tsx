import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-heebo',
});

export const metadata: Metadata = {
  title: 'פורטוגו - מערכת מדריכים',
  description: 'מערכת ניהול למדריכי פורטוגו',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 text-gray-900" style={{ fontFamily: 'var(--font-heebo), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
