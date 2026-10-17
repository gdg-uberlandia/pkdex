import "./globals.css"

import { GeistMono } from "geist/font/mono"
import { GeistPixelSquare } from "geist/font/pixel"
import { GeistSans } from "geist/font/sans"
import type { Metadata, Viewport } from "next"

import { ThemeProvider } from "@/providers/theme-provider"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL("https://pokedex.devfesttriangulo.com.br"),
  appleWebApp: { capable: true, title: "Pokedex", statusBarStyle: "default" },
  icons: { apple: "/icons/pwa-192.png" },
  applicationName: "DevFest Triângulo Pokedex",
  title: {
    default: "DevFest Triângulo Pokedex",
    template: "%s | Pokedex",
  },
  description:
    "Passaporte digital do DevFest Triângulo para networking, missões, palestras e gamificação durante o evento.",
  creator: "@devfesttriangulo",
  publisher: "DevFest Triângulo",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "DevFest Triângulo Pokedex",
    title: "DevFest Triângulo Pokedex",
    description:
      "Passaporte digital do DevFest Triângulo para networking, missões, palestras e gamificação durante o evento.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
