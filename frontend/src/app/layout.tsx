import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const ibmPlexMono = IBM_Plex_Mono({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'], 
  variable: '--font-mono' 
});

export const metadata: Metadata = {
  title: "ZeroVault — Verifiable Vulnerability Escrow",
  description: "Cryptographic partial disclosure protocol and trustless zero-day escrow on Ethereum.",
};

import { AuthProvider } from "@/providers/AuthProvider";
import { cookies } from 'next/headers';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const hasSession = cookieStore.has('session');

  return (
    <html lang="en" className={cn("dark", inter.variable, ibmPlexMono.variable)}>
      <body className="antialiased font-sans min-h-screen bg-[#0C0E12] text-[#F0F2F5] selection:bg-[#2563EB]/25 relative">
        <AuthProvider hasSession={hasSession}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
