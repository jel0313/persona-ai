"use client";

import { ArrowUp, AudioLines, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * 入力欄。
 * - マイク：話した内容を入力欄に書き込む（音声入力）
 * - 右端：文字があれば送信、空なら「音声会話モード」ボタン（ChatGPT と同じ）
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onVoiceMode,
  onMic,
  streaming,
  listening,
  micSupported,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onVoiceMode: () => void;
  onMic: () => void;
  streaming: boolean;
  listening: boolean;
  micSupported: boolean;
  placeholder: string;
}) {
  const hasText = value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="rounded-3xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // 日本語変換中の Enter では送信しない
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (hasText && !streaming) onSend();
            }
          }}
          placeholder={listening ? "聞き取り中…" : placeholder}
          rows={1}
          className="max-h-48 min-h-11 resize-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between px-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full", listening && "bg-red-500/10 text-red-500 hover:bg-red-500/20")}
            onClick={onMic}
            disabled={!micSupported}
            aria-label={listening ? "音声入力を止める" : "音声入力"}
            title={micSupported ? "音声入力" : "このブラウザは音声入力に未対応です"}
          >
            <Mic />
          </Button>

          {streaming ? (
            <Button size="icon" className="rounded-full" onClick={onStop} aria-label="生成を止める">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : hasText ? (
            <Button size="icon" className="rounded-full" onClick={onSend} aria-label="送信">
              <ArrowUp />
            </Button>
          ) : (
            <Button
              size="icon"
              className="rounded-full"
              onClick={onVoiceMode}
              disabled={!micSupported}
              aria-label="音声会話モード"
              title="音声で会話する"
            >
              <AudioLines />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        AI の返答は間違えることがあります。
      </p>
    </div>
  );
}
