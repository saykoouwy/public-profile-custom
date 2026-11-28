import type { Metadata, Viewport } from "next";
import {
  Cinzel,
  Creepster,
  Geist,
  Geist_Mono,
  Great_Vibes,
  Lexend,
  Monoton,
  Permanent_Marker,
  Playfair_Display,
  Silkscreen,
  UnifrakturMaguntia,
} from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Títulos da página inicial (classe font-heading).
const heading = Lexend({ variable: "--font-lexend", subsets: ["latin"], weight: ["500", "600", "700"] });
const display = UnifrakturMaguntia({ variable: "--font-display", subsets: ["latin"], weight: "400" });
// Fontes opcionais do nome de exibição (src/lib/display-name.ts). preload: false = o navegador só
// baixa o arquivo da fonte que algum elemento da página realmente usa.
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600"], preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["700"], style: ["italic"], preload: false });
const greatVibes = Great_Vibes({ variable: "--font-great-vibes", subsets: ["latin"], weight: "400", preload: false });
const marker = Permanent_Marker({ variable: "--font-marker", subsets: ["latin"], weight: "400", preload: false });
const monoton = Monoton({ variable: "--font-monoton", subsets: ["latin"], weight: "400", preload: false });
const creepster = Creepster({ variable: "--font-creepster", subsets: ["latin"], weight: "400", preload: false });
const silkscreen = Silkscreen({ variable: "--font-silkscreen", subsets: ["latin"], weight: "400", preload: false });
const nameFonts = [cinzel, playfair, greatVibes, marker, monoton, creepster, silkscreen].map((f) => f.variable).join(" ");

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
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${heading.variable} ${nameFonts} h-full overflow-x-clip antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-clip">{children}</body>
    </html>
  );
}
