"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/foundation", label: "Foundation" },
  { href: "/reflect", label: "Reflect" },
  { href: "/goals", label: "Goals" },
  { href: "/chat", label: "AI" },
  { href: "/settings", label: "Settings" } // 👈 new tab
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 bg-gradient-to-t from-app-main via-app-main/80 to-transparent pb-3">
      <div className="mx-auto flex w-[92%] items-center justify-between rounded-full border border-app-border bg-app-card px-3 py-2 text-xs shadow-lg shadow-black/40">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-full px-2 py-1 text-center transition ${active
                ? "bg-app-accent text-app-accent-text font-semibold"
                : "text-app-muted hover:text-app-main"
                }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
