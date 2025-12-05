// components/AuthGuardHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { PointsDisplay } from "./PointsDisplay";

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

  if (checking) return null;

  return (
    <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-app-muted uppercase">
          Cherry
        </span>
        <PointsDisplay />
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
