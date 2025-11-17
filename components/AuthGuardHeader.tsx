// components/AuthGuardHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

export function AuthGuardHeader() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    };
    check();
  }, [router]);

  const logout = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checking) return null;

  return (
    <div className="mb-2 flex items-center justify-end">
      <button
        onClick={logout}
        className="text-[11px] text-slate-500 underline"
      >
        Sign out
      </button>
    </div>
  );
}
