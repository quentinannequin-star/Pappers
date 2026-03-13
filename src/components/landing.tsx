"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { SpecialText } from "@/components/ui/special-text";
import { ArrowRight } from "lucide-react";

export function LandingPage() {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);
  const [showText, setShowText] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setTransitioning(true);

      // After fade to black (800ms), show the SpecialText
      setTimeout(() => {
        setShowText(true);
      }, 800);

      // After text animation completes (~3s), navigate to login
      setTimeout(() => {
        router.push("/login");
      }, 3500);
    },
    [router]
  );

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <ShaderAnimation />

      {/* Fade-to-black overlay */}
      <div
        className={`absolute inset-0 z-20 bg-black transition-opacity duration-700 ${
          transitioning ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* SpecialText centered on black screen */}
        {showText && (
          <div className="flex h-full items-center justify-center">
            <SpecialText
              className="text-4xl font-bold text-white sm:text-5xl md:text-6xl"
              speed={25}
            >
              Welcome to Alvora OS
            </SpecialText>
          </div>
        )}
      </div>

      {/* Main content */}
      <div
        className={`pointer-events-none z-10 flex flex-col items-center gap-8 transition-opacity duration-500 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Glassmorphism backdrop */}
        <div className="rounded-3xl border border-white/10 bg-black/30 px-12 py-10 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-light uppercase tracking-[0.4em] text-white/50">
              Alvora Partners
            </span>
            <h1 className="text-center text-8xl font-bold tracking-tight text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.25)] sm:text-9xl">
              Screening OS
            </h1>
            <p className="mt-1 max-w-md text-center text-base font-light text-white/60">
              Parce que Pappers, c&apos;est du vol — 300&nbsp;€ pour une liste
              mdr
            </p>
          </div>
        </div>

        <div className="pointer-events-auto relative rounded-full p-[3px]">
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={3}
          />
          <button
            onClick={handleClick}
            className="relative inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition-all hover:scale-105 hover:bg-white/90"
          >
            Connexion
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute bottom-8 z-10 transition-opacity duration-500 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="text-xs font-light text-white/30">
          6M+ entreprises fran&ccedil;aises &middot; 0&nbsp;&euro; &middot;
          built with love &amp; rage
        </span>
      </div>
    </div>
  );
}
