import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/api";

/** 性格ごとの色付き丸アイコン（名前の1文字目） */
export function PersonaAvatar({ persona, className }: { persona?: Persona; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white select-none",
        className,
      )}
      style={{ backgroundColor: persona?.color ?? "#737373" }}
      aria-hidden
    >
      {persona?.name.slice(0, 1) ?? "?"}
    </div>
  );
}
