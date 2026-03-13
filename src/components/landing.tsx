"use client";

import Link from "next/link";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { ArrowRight } from "lucide-react";

export function LandingPage() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <ShaderAnimation />

      <div className="pointer-events-none z-10 flex flex-col items-center gap-8">
        {/* Glassmorphism backdrop */}
        <div className="rounded-3xl border border-white/10 bg-black/30 px-12 py-10 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-light uppercase tracking-[0.4em] text-white/50">
              Alvora Partners
            </span>
            <h1
              className="text-center text-8xl font-light tracking-tight text-white drop-shadow-[0_4px_32px_rgba(255,255,255,0.2)] sm:text-9xl"
            >
              Screening OS
            </h1>
            <p className="mt-1 max-w-md text-center text-base font-light text-white/60">
              Parce que Pappers, c&apos;est du vol — 300&nbsp;€ pour une liste mdr
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition-all hover:scale-105 hover:bg-white/90 hover:shadow-lg hover:shadow-white/20"
        >
          Connexion
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="pointer-events-none absolute bottom-8 z-10">
        <span className="text-xs font-light text-white/30">
          6M+ entreprises fran&ccedil;aises &middot; 0&nbsp;&euro; &middot; built with love &amp; rage
        </span>
      </div>
    </div>
  );
}
