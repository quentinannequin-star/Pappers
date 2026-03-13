"use client";

import Link from "next/link";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { ArrowRight } from "lucide-react";

export function LandingPage() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <ShaderAnimation />

      <div className="pointer-events-none z-10 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-white/40">
            Alvora Partners
          </span>
          <h1 className="text-center text-7xl font-bold tracking-tighter text-white sm:text-8xl">
            Screening OS
          </h1>
          <p className="mt-2 max-w-lg text-center text-lg text-white/50">
            Parce que Pappers, c&apos;est du vol — 300&nbsp;€ pour une liste mdr
          </p>
        </div>

        <Link
          href="/login"
          className="pointer-events-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition-all hover:scale-105 hover:bg-white/90 hover:shadow-lg hover:shadow-white/20"
        >
          Connexion
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="pointer-events-none absolute bottom-8 z-10">
        <span className="text-xs text-white/20">
          6M+ entreprises françaises · 0 € · built with love & rage
        </span>
      </div>
    </div>
  );
}
