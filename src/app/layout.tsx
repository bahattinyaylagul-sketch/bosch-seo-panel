import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global SEO Paneli — Bosch Aftermarket",
  description: "İçerik hazırlama, otomatik çeviri, lokal onay ve koordinasyon merkezi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased text-ink-body bg-white">{children}</body>
    </html>
  );
}
