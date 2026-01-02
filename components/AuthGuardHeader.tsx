// components/AuthGuardHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";



export function AuthGuardHeader() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    };

    check();
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checking) {
    // Return a skeleton placeholder to prevent layout shift
    return (
      <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide text-app-muted uppercase">
            Foundation
          </span>
          <div className="h-5 w-16 animate-pulse rounded-full bg-app-card" />
        </div>
        <div className="h-4 w-14 animate-pulse rounded bg-app-card" />
      </header>
    );
  }

  return (
    <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-widest text-app-muted uppercase">
          Foundation
        </span>
      </div>
      <button
        onClick={logout}
        className="text-[11px] text-app-muted hover:text-red-300"
      >
        Sign out
      </button>
    </header>
  );
}
