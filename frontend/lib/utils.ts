import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind のクラスをきれいに合成する（shadcn/ui の定番関数） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
