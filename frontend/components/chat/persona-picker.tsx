"use client";

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Persona } from "@/lib/api";
import { PersonaAvatar } from "./persona-avatar";

/** ChatGPT のモデル選択のような、性格の切り替えメニュー */
export function PersonaPicker({
  personas,
  value,
  onChange,
}: {
  personas: Persona[];
  value: string;
  onChange: (id: string) => void;
}) {
  const current = personas.find((p) => p.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1.5 px-2 text-base font-medium">
          {current?.name ?? "性格を選ぶ"}
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>話す相手を選ぶ</DropdownMenuLabel>
        {personas.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => onChange(p.id)}>
            <PersonaAvatar persona={p} className="size-7 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.tagline}</div>
            </div>
            {p.id === value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
