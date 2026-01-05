import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "x402 + Superfluid | Streaming Payments for Internet-Native APIs",
  description: "x402 extension integrated with Superfluid for real-time streaming payments. Enable continuous, instant payments for your APIs with zero protocol fees.",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers cookies={cookies}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
