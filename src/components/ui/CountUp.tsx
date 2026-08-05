"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

const DURATION_MS = 240;

const FORMATTERS = {
  currency: formatCurrency,
} as const;

/** Anima de 0 até `value` uma única vez. `format` seleciona a formatação (evita passar função pela fronteira server/client). */
export function CountUp({ value, format }: { value: number; format: keyof typeof FORMATTERS }) {
  const [shown, setShown] = useState(value);
  const formatFn = FORMATTERS[format];

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setShown(value * progress);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatFn(shown)}</>;
}
