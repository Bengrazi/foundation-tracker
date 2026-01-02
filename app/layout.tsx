// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FOUNDATION",
  description: "A private system of self-discipline and self-honesty.",
};

import { SettingsSync } from "@/components/SettingsSync";
import { GlobalStateProvider } from "@/components/GlobalStateProvider";
import { LayoutTransition } from "@/components/LayoutTransition";

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
          " bg-app-main text-app-main antialiased selection:bg-app-accent/40 transition-colors duration-300"
        }
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('foundation_theme');
                  if (saved) {
                    document.documentElement.setAttribute('data-theme', saved);
                  }
                  var savedSize = localStorage.getItem('foundation_ui_text_size_v1');
                  if (savedSize) {
                    document.documentElement.setAttribute('data-text-size', savedSize);
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
        <SettingsSync />
        <GlobalStateProvider>
          <div className="flex min-h-screen justify-center bg-app-main">
            <div className="flex w-full max-w-md flex-col pb-16">
              <main className="flex-1 bg-app-main px-4 pt-4 relative overflow-hidden">
                <LayoutTransition>{children}</LayoutTransition>
              </main>
              <BottomNav />
            </div>
          </div>
        </GlobalStateProvider>
      </body>
    </html>
  );
}
