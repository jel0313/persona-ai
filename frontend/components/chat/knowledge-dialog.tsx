"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, type Persona } from "@/lib/api";

/** 今の性格に RAG 用の資料（設定・知識）を追加する */
export function KnowledgeDialog({ persona }: { persona?: Persona }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!persona || !source.trim() || !text.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const { chunks } = await api.addKnowledge(persona.id, source.trim(), text);
      setStatus(`保存しました（${chunks} 個に分割して登録）`);
      setText("");
      setSource("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setStatus(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="資料を追加" title="この性格に資料を追加（RAG）">
          <BookOpen />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{persona?.name} に資料を覚えさせる</DialogTitle>
          <DialogDescription>
            ここに入れた文章は、この性格だけが検索して使います（RAG）。キャラの設定や専門知識などをどうぞ。
          </DialogDescription>
        </DialogHeader>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="資料の名前（例：好きな食べ物）"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="資料の本文"
          className="max-h-72 min-h-40"
        />
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        <DialogFooter>
          <Button onClick={save} disabled={saving || !source.trim() || !text.trim()}>
            {saving ? "保存中…" : "保存する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
