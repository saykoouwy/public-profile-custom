import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Lexend, UnifrakturMaguntia } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Títulos da página inicial (classe font-heading).
const heading = Lexend({ variable: "--font-lexend", subsets: ["latin"], weight: ["500", "600", "700"] });
const display = UnifrakturMaguntia({ variable: "--font-display", subsets: ["latin"], weight: "400" });

const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: BRAND_NAME,
  description: "Perfil pessoal, links e música.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // overflow-x-clip (e não hidden) corta o excesso lateral sem criar um contêiner de
  // rolagem; com hidden, o position: sticky da navbar para de funcionar.
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${heading.variable} h-full overflow-x-clip antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-clip">{children}</body>
    </html>
  );
}
