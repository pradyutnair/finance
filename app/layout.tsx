import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/contexts/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { CurrencyProvider } from "@/contexts/currency-context";

const inter = Inter({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexpass - Finance Dashboard",
  description: "Your personal finance management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
        style={{ fontFamily: "var(--font-host-grotesk), system-ui, sans-serif" }}
      >
        <QueryProvider>
          <AuthProvider>
            <CurrencyProvider>
              {children}
              <Toaster />
            </CurrencyProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
