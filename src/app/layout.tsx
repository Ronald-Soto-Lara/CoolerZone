import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Geist, Geist_Mono } from "next/font/google";
import { TawkChat } from "@/components/tawk-chat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cooler-zone.vercel.app/"),
  title: "CoolerZone | Tu tienda online",
  description: "Descubre productos y soluciones para disfrutar cada espacio con CoolerZone.",
  keywords: ["CoolerZone", "tienda online", "productos", "compras online"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "CoolerZone | Tu tienda online",
    description: "Descubre productos y soluciones para disfrutar cada espacio con CoolerZone.",
    url: "https://cooler-zone.vercel.app/",
    siteName: "CoolerZone",
    locale: "es_LA",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        {gaId && <GoogleAnalytics gaId={gaId} />}
        <TawkChat />
      </body>
    </html>
  );
}
