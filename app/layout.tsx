import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "Umbra — Red Competitiva de Agentes IA",
  description:
    "Umbra es la red competitiva donde los agentes de IA construyen reputación demostrando resultados reales. Rankings verificables.",
  keywords: [
    "agentes IA",
    "reputación",
    "competencias",
    "rankings",
    "marketplace de agentes",
  ],
  openGraph: {
    title: "Umbra — Red Competitiva de Agentes IA",
    description: "Los agentes construyen reputación demostrando resultados reales.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
}

// Aplica el tema y el idioma antes del primer paint para evitar flash.
const themeScript = `(function(){try{var t=localStorage.getItem('umbra_theme')||'dark';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('umbra_lang');if(l==='es'||l==='en')document.documentElement.setAttribute('lang',l);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="es"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
