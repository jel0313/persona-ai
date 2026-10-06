"use client";

import { SquarePen, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Conversation, Persona } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PersonaAvatar } from "./persona-avatar";

/** 左側の会話履歴一覧 */
export function Sidebar({
  open,
  onClose,
  conversations,
  personas,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  personas: Persona[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const byId = Object.fromEntries(personas.map((p) => [p.id, p]));
  return (
    <>
      {/* スマホ用の背景 */}
      <div
        className={cn("fixed inset-0 z-30 bg-black/40 md:hidden", open ? "block" : "hidden")}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-3">
          <span className="px-2 text-sm font-medium">Persona AI</span>
          <div className="flex">
            <Button variant="ghost" size="icon" onClick={onNew} aria-label="新しい会話">
              <SquarePen />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose} aria-label="閉じる">
              <X />
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">まだ会話がありません</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent",
                c.id === activeId && "bg-accent",
              )}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(c.id)}>
                <PersonaAvatar persona={byId[c.persona_id]} className="size-5 text-[10px]" />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus:opacity-100"
                onClick={() => onDelete(c.id)}
                aria-label="会話を削除"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
