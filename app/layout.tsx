import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import "./globals.css"

// Fuentes alojadas en el propio proyecto (app/fonts, licencia SIL OFL, subset
// latino de Google Fonts). Antes se usaba next/font/google, que DESCARGA las
// fuentes en cada build: un fallo de red de Google tumbaba el deploy en Vercel
// ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'"). Son
// fuentes variables: un archivo cubre todo el rango de pesos.

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 700",
  display: "swap",
})

const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  variable: "--font-fraunces",
  weight: "400 600",
  display: "swap",
  adjustFontFallback: "Times New Roman",
})

const jetbrains = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains",
  weight: "400 600",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
})

// Wordmark de marca: geométrica fina (tipo Futura), para el logotipo UMBRA
// del hero sobre el robot. Sólo se usa el peso 300.
const jost = localFont({
  src: "./fonts/jost-300-latin.woff2",
  variable: "--font-jost",
  weight: "300",
  display: "swap",
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
  themeColor: "#E3E3E3",
}

// Aplica el tema y el idioma antes del primer paint para evitar flash.
// Tema por defecto: claro. El oscuro es opcional (se guarda en umbra_theme).
const themeScript = `(function(){try{var t=localStorage.getItem('umbra_theme')||'light';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('umbra_lang');if(l==='es'||l==='en')document.documentElement.setAttribute('lang',l);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${jost.variable}`}
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
