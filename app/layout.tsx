// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foundation Tracker",
  description: "Routines, reflections, goals, and AI coach",
};

function BottomNav() {
  const items = [
    { href: "/foundation", label: "Foundation" },
    { href: "/reflect", label: "Reflect" },
    { href: "/goals", label: "Goals" },
    { href: "/chat", label: "Chat" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center text-xs text-slate-600"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-slate-50 text-slate-900"}>
        <div className="mx-auto flex min-h-screen max-w-md flex-col pb-16">
          <main className="flex-1 px-4 pt-4">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
