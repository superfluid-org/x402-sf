import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "x402-superfluid | Internet-Native Subscriptions",
  description: "x402-superfluid extends the x402 standard with continuous payment streams. An end-to-end internet-native subscription infrastructure for the agentic economy.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Retrieve cookies from request headers on the server
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="en">
      <body className={`${inter.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        <Providers cookies={cookies}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
