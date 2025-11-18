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
    <nav className="sticky bottom-0 flex w-full justify-center bg-slate-950/90 pb-3 pt-2 backdrop-blur">
      <div className="flex w-full max-w-md items-center justify-between rounded-full border border-slate-800 bg-slate-900/80 px-2 py-1 text-[11px]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-full px-2 py-1 text-center transition ${
                active
                  ? "bg-emerald-500 text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-100"
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
