"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Foundation", href: "/foundation" },
  { label: "Plan", href: "/plan" },
  { label: "Reflect", href: "/reflect" },
  { label: "Settings", href: "/settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-30 w-full max-w-md -translate-x-1/2 bg-gradient-to-t from-app-main via-app-main/80 to-transparent pb-1">
      <div className="mx-auto flex w-[92%] items-center justify-between rounded-full border border-app-border bg-app-card px-3 py-2 text-xs shadow-lg shadow-black/40">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const isSettings = tab.label === "Settings";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${isSettings ? "flex-none w-10" : "flex-1"} rounded-full px-2 py-1 text-center transition flex items-center justify-center ${active
                ? "bg-app-accent text-app-accent-text font-semibold"
                : "text-app-muted hover:text-app-main"
                }`}
            >
              {isSettings ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.389c-.42.18-.81.405-1.174.675l-1.28-.637a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c-.095.345-.158.71-.158 1.086 0 .375.063.738.158 1.082l-.84.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.28-.637c.363.27.752.495 1.174.675l.179 1.571c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.572c.42-.18.81-.405 1.174-.675l1.28.637a1.875 1.875 0 002.282-.818l.922-1.597a1.875 1.875 0 00-.432-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.819l-1.28.637c-.363-.27-.753-.495-1.174-.675l-.178-1.571c-.151-.904-.933-1.567-1.85-1.567h-1.844zM12 7.875a4.125 4.125 0 100 8.25 4.125 4.125 0 000-8.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                tab.label
              )}
            </Link>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-0 w-full h-4 bg-app-main z-40" />
    </nav>
  );
}
