// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/foundation", label: "Foundation" },
  { href: "/reflect", label: "Reflect" },
  { href: "/goals", label: "Goals" },
  { href: "/chat", label: "AI" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pb-4">
      <div className="mx-auto flex w-[92%] items-center justify-between rounded-full border border-slate-800 bg-slate-900/95 px-3 py-2 text-xs shadow-lg shadow-black/40">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-full px-3 py-1.5 text-center transition ${
                active
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-200 hover:text-slate-50"
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
