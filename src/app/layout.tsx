import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const aptos = localFont({
  src: [
    { path: "../fonts/aptos-light.ttf", weight: "300", style: "normal" },
    { path: "../fonts/aptos.ttf", weight: "400", style: "normal" },
    { path: "../fonts/aptos-semibold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/aptos-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-aptos",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alvora Partners — Base M&A France",
  description: "Base de screening M&A pour les entreprises françaises",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${aptos.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
