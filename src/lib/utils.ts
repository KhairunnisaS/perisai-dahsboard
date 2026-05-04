import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (handles conflicts). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a percentage string. e.g. 24 → "24%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Initials from a full name. "Dewi Lestari" → "DL" */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
export function formatZone(zone: string): string {
  const n = parseInt(zone, 10);
  return isNaN(n) ? zone : `[${ROMAN[n - 1] ?? zone}]`;
}
