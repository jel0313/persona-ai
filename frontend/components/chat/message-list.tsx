"use client";

import { useEffect, useRef } from "react";

import type { Message, Persona } from "@/lib/api";
import { PersonaAvatar } from "./persona-avatar";

/** 吹き出しの一覧。ユーザーは右の吹き出し、AI は左にアイコン付きで表示 */
export function MessageList({
  messages,
  persona,
  streaming,
}: {
  messages: Message[];
  persona?: Persona;
  streaming: boolean;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] rounded-3xl bg-secondary px-4 py-2.5 whitespace-pre-wrap">{m.content}</div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <PersonaAvatar persona={persona} className="mt-0.5" />
            <div className="min-w-0 flex-1 leading-7 whitespace-pre-wrap">
              {m.content}
              {streaming && i === messages.length - 1 && (
                <span className="ml-0.5 inline-block size-2.5 animate-pulse rounded-full bg-foreground align-middle" />
              )}
            </div>
          </div>
        ),
      )}
      <div ref={bottom} />
    </div>
  );
}
