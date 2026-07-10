import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global SEO Paneli — Bosch Aftermarket",
  description: "İçerik hazırlama, otomatik çeviri, lokal onay ve koordinasyon merkezi.",
  // Prototip: arama motorları taramasın / indekslemesin
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased text-ink-body bg-white">{children}</body>
    </html>
  );
}
