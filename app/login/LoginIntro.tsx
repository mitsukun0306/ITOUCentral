"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { randomQuote } from "@/lib/quotes";

const DURATION = 4200; // ms

export function LoginIntro() {
  const router = useRouter();
  const [quote] = useState(randomQuote);

  useEffect(() => {
    router.prefetch("/dashboard");
    const t = setTimeout(() => router.push("/dashboard"), DURATION);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="intro-overlay fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* 背景の光の演出 */}
      <div className="intro-glow" aria-hidden />

      <div
        className="intro-item text-sm tracking-[0.3em] text-white/60 uppercase"
        style={{ animationDelay: "0.1s" }}
      >
        ITOU<span className="text-brand">CENTRAL</span>
      </div>

      <blockquote
        className="intro-item mt-8 max-w-2xl text-2xl md:text-4xl font-semibold leading-relaxed text-white"
        style={{ animationDelay: "0.5s" }}
      >
        “{quote.text}”
      </blockquote>

      <p
        className="intro-item mt-5 max-w-xl text-base md:text-lg text-white/70"
        style={{ animationDelay: "1.0s" }}
      >
        {quote.ja}
      </p>

      <p
        className="intro-item mt-6 text-sm text-brand tracking-widest"
        style={{ animationDelay: "1.5s" }}
      >
        — {quote.author}
      </p>

      {/* 進行バー */}
      <div className="intro-item mt-10 h-0.5 w-56 overflow-hidden rounded-full bg-white/15">
        <div
          className="intro-bar h-full bg-brand"
          style={{ animationDuration: `${DURATION}ms` }}
        />
      </div>

      <button
        onClick={() => router.push("/dashboard")}
        className="intro-item mt-8 text-xs text-white/50 hover:text-white/90 transition-colors"
        style={{ animationDelay: "1.8s" }}
      >
        スキップ →
      </button>
    </div>
  );
}
