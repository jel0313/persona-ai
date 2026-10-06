/** FastAPI サーバーとの通信をまとめたファイル */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Persona = {
  id: string;
  name: string;
  tagline: string;
  voicevox_speaker: number;
  color: string;
};

export type Role = "user" | "assistant";
export type Message = { role: Role; content: string };

export type Conversation = {
  id: string;
  persona_id: string;
  title: string;
  updated_at: string;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `通信エラー (${res.status})`);
  }
  return res.json();
}

export const api = {
  personas: () => fetch(`${API_BASE}/api/personas`).then((r) => json<Persona[]>(r)),

  conversations: () => fetch(`${API_BASE}/api/conversations`).then((r) => json<Conversation[]>(r)),

  conversation: (id: string) =>
    fetch(`${API_BASE}/api/conversations/${id}`).then((r) =>
      json<Conversation & { messages: Message[] }>(r),
    ),

  deleteConversation: (id: string) =>
    fetch(`${API_BASE}/api/conversations/${id}`, { method: "DELETE" }).then((r) => json(r)),

  addKnowledge: (persona_id: string, source: string, text: string) =>
    fetch(`${API_BASE}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id, source, text }),
    }).then((r) => json<{ chunks: number }>(r)),

  /** 文章 → 音声（VOICEVOX）。wav の Blob を返す */
  tts: async (persona_id: string, text: string, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id, text }),
      signal,
    });
    if (!res.ok) throw new Error("音声の作成に失敗しました（VOICEVOX は起動していますか？）");
    return res.blob();
  },

  /**
   * 返答をストリーミングで受け取る。
   * 文字が届くたびに onChunk が呼ばれ、最後に会話IDを返す。
   */
  chat: async (
    body: { persona_id: string; message: string; conversation_id: string | null },
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "サーバーに接続できません（FastAPI は起動していますか？）");
    }
    const conversationId = res.headers.get("X-Conversation-Id") ?? "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    return conversationId;
  },
};
