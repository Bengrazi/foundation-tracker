// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foundation",
  description: "Daily foundations, reflections, and AI insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#020617" />
        <link rel="icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={
          inter.className +
          " bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/40"
        }
      >
        <div className="flex min-h-screen justify-center bg-slate-950">
          <div className="flex w-full max-w-md flex-col pb-16">
            <main className="flex-1 bg-slate-950 px-4 pt-4">{children}</main>
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}
