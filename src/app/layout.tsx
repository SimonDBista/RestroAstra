import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RestroAstra | One platform. Every restaurant operation.',
  description:
    'RestroAstra is an enterprise multi-tenant restaurant operating system — contactless tabletop QR ordering, real-time kitchen display (KOT), POS billing, live staff chat, and intelligent inventory tracking.',
  manifest: '/manifest.json',
  applicationName: 'RestroAstra',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'RestroAstra — One platform. Every restaurant operation.',
    description:
      'Contactless tabletop QR ordering, real-time kitchen display, POS billing, live staff chat, and inventory operations in one unified suite.',
    siteName: 'RestroAstra',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RestroAstra — One platform. Every restaurant operation.',
    description: 'Enterprise luxury restaurant management suite and contactless digital dining.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        {/* Google Model Viewer for 3D food preview */}
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          async
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-amber-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
