import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

export const metadata: Metadata = {
  title: "One Order: Rotterdam → Berlin, request to payment",
  description:
    "A working freight order: request, quotes, transport order, live tracking, proof of delivery on the driver's phone, invoice and two-signature payment, all on one hash-chained record.",
};

export const viewport: Viewport = { themeColor: "#0a0a08", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${wide.variable}`}>
      <body>{children}</body>
    </html>
  );
}
