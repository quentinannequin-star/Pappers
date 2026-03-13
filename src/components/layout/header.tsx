"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Search } from "lucide-react";

export function Header() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-100 bg-white/80 px-6 backdrop-blur-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <Search className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-zinc-900">
            Screening OS
          </h1>
          <span className="text-xs text-zinc-400">Alvora Partners</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-zinc-400 hover:text-zinc-600"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Déconnexion
      </Button>
    </header>
  );
}
