import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FreeHouse',
  description: 'Gestión financiera entre socios',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#07090d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Aplicar tema guardado antes del render para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('fh-theme');
              if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
