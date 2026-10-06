"use client";

import { Mic, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Persona } from "@/lib/api";
import { cn } from "@/lib/utils";

export type VoiceState = "listening" | "thinking" | "speaking" | "idle";

const LABEL: Record<VoiceState, string> = {
  listening: "聞いています…",
  thinking: "考え中…",
  speaking: "話しています（タップで割り込み）",
  idle: "タップして話しかける",
};

/** 音声会話モードの全画面表示。真ん中の丸が状態に合わせて動く */
export function VoiceOverlay({
  persona,
  state,
  transcript,
  error,
  onOrbClick,
  onClose,
}: {
  persona?: Persona;
  state: VoiceState;
  transcript: string;
  error: string | null;
  onOrbClick: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-10">
      <div className="text-center">
        <p className="text-lg font-medium">{persona?.name}</p>
        <p className="text-sm text-muted-foreground">{persona?.tagline}</p>
      </div>

      <button
        onClick={onOrbClick}
        className={cn(
          "size-48 rounded-full transition-opacity",
          state === "listening" && "orb-listening",
          state === "speaking" && "orb-speaking",
          state === "thinking" && "orb-thinking",
          state === "idle" && "opacity-60",
        )}
        style={{
          background: `radial-gradient(circle at 35% 30%, white 0%, ${persona?.color ?? "#737373"} 55%)`,
        }}
        aria-label={LABEL[state]}
      />

      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <p className="min-h-12 text-center text-muted-foreground">
          {error ?? (transcript || LABEL[state])}
        </p>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full"
            onClick={onOrbClick}
            aria-label="話す"
          >
            <Mic className="size-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full"
            onClick={onClose}
            aria-label="音声会話を終わる"
          >
            <X className="size-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
