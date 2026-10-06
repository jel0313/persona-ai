"use client";

/**
 * 画面全体のまとめ役。
 *  入力（文字 or 音声）→ FastAPI にストリーミング送信 → 届いた文字を表示しつつ1文ずつ読み上げ
 */
import { Menu, SquarePen, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSpeaker, takeSentences } from "@/hooks/use-speaker";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { api, type Conversation, type Message, type Persona } from "@/lib/api";
import { Composer } from "./composer";
import { KnowledgeDialog } from "./knowledge-dialog";
import { MessageList } from "./message-list";
import { PersonaAvatar } from "./persona-avatar";
import { PersonaPicker } from "./persona-picker";
import { Sidebar } from "./sidebar";
import { VoiceOverlay, type VoiceState } from "./voice-overlay";

export function ChatApp() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const persona = personas.find((p) => p.id === personaId);
  const abortRef = useRef<AbortController | null>(null);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;

  // ---- 最初に性格と履歴を読み込む ----
  const refreshConversations = useCallback(() => {
    api.conversations().then(setConversations).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .personas()
      .then((ps) => {
        setPersonas(ps);
        setPersonaId((cur) => cur || ps[0]?.id || "");
      })
      .catch((e) => setError(e.message));
    refreshConversations();
  }, [refreshConversations]);

  // ---- 読み上げ（読み終わったら、音声会話モードならまた聞き取りを始める）----
  const speaker = useSpeaker(() => {
    if (voiceModeRef.current) recognition.start();
  });

  // ---- 送信 ----
  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || streaming || !personaId) return;

      speaker.stop();
      setError(null);
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
      setStreaming(true);

      const speak = autoSpeak || voiceModeRef.current;
      if (speak) speaker.begin();
      let buffer = "";
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const cid = await api.chat(
          { persona_id: personaId, message, conversation_id: conversationId },
          (chunk) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + chunk };
              return next;
            });
            if (speak) {
              buffer += chunk;
              const { sentences, rest } = takeSentences(buffer);
              buffer = rest;
              sentences.forEach((s) => speaker.enqueue(personaId, s));
            }
          },
          controller.signal,
        );
        if (cid) setConversationId(cid);
        refreshConversations();
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "エラーが発生しました");
          // 空のままの返答欄は消す
          setMessages((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
        }
      } finally {
        if (speak) {
          if (buffer.trim() && !controller.signal.aborted) speaker.enqueue(personaId, buffer);
          speaker.finish();
        }
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, personaId, conversationId, autoSpeak, speaker, refreshConversations],
  );

  // ---- 音声入力：通常は入力欄へ、音声会話モードではそのまま送信 ----
  const recognition = useSpeechRecognition((text) => {
    if (voiceModeRef.current) void send(text);
    else setInput((cur) => (cur ? `${cur} ${text}` : text));
  });

  const stopGenerating = () => {
    abortRef.current?.abort();
    speaker.stop();
  };

  // ---- 会話の切り替え ----
  const newChat = () => {
    stopGenerating();
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  };

  const changePersona = (id: string) => {
    if (id === personaId) return;
    setPersonaId(id);
    if (messages.length > 0) newChat(); // 会話は性格ごとなので、新しい会話にする
  };

  const openConversation = async (id: string) => {
    stopGenerating();
    setSidebarOpen(false);
    try {
      const c = await api.conversation(id);
      setPersonaId(c.persona_id);
      setConversationId(c.id);
      setMessages(c.messages.map(({ role, content }) => ({ role, content })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "会話を開けませんでした");
    }
  };

  const deleteConversation = async (id: string) => {
    await api.deleteConversation(id).catch(() => {});
    if (id === conversationId) newChat();
    refreshConversations();
  };

  // ---- 音声会話モード ----
  const openVoiceMode = () => {
    setVoiceMode(true);
    recognition.start();
  };
  const closeVoiceMode = () => {
    setVoiceMode(false);
    recognition.cancel();
    speaker.stop();
  };
  const onOrbClick = () => {
    if (speaker.speaking) speaker.stop(); // 割り込み
    if (!recognition.listening && !streaming) recognition.start();
  };
  const voiceState: VoiceState = recognition.listening
    ? "listening"
    : speaker.speaking
      ? "speaking"
      : streaming
        ? "thinking"
        : "idle";

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        personas={personas}
        activeId={conversationId}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={deleteConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="メニュー"
          >
            <Menu />
          </Button>
          <PersonaPicker personas={personas} value={personaId} onChange={changePersona} />
          <div className="ml-auto flex items-center">
            <KnowledgeDialog persona={persona} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (autoSpeak) speaker.stop();
                setAutoSpeak(!autoSpeak);
              }}
              aria-label={autoSpeak ? "読み上げをオフ" : "読み上げをオン"}
              title={autoSpeak ? "返答の読み上げ：オン" : "返答の読み上げ：オフ"}
            >
              {autoSpeak ? <Volume2 /> : <VolumeX className="text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={newChat} aria-label="新しい会話">
              <SquarePen />
            </Button>
          </div>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-10 text-center">
            <PersonaAvatar persona={persona} className="size-14 text-xl" />
            <h1 className="text-2xl font-medium">{persona ? `${persona.name}と話そう` : "読み込み中…"}</h1>
            <p className="text-sm text-muted-foreground">{persona?.tagline}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <MessageList messages={messages} persona={persona} streaming={streaming} />
          </div>
        )}

        {error && (
          <p className="mx-auto mb-2 w-full max-w-3xl px-6 text-sm text-destructive">{error}</p>
        )}
        {recognition.error && !voiceMode && (
          <p className="mx-auto mb-2 w-full max-w-3xl px-6 text-sm text-destructive">{recognition.error}</p>
        )}

        <Composer
          value={recognition.listening && !voiceMode ? recognition.interim || input : input}
          onChange={setInput}
          onSend={() => send(input)}
          onStop={stopGenerating}
          onVoiceMode={openVoiceMode}
          onMic={() => (recognition.listening ? recognition.stop() : recognition.start())}
          streaming={streaming}
          listening={recognition.listening && !voiceMode}
          micSupported={recognition.supported}
          placeholder={persona ? `${persona.name}にメッセージ` : "メッセージ"}
        />
      </main>

      {voiceMode && (
        <VoiceOverlay
          persona={persona}
          state={voiceState}
          transcript={recognition.interim}
          error={recognition.error ?? error}
          onOrbClick={onOrbClick}
          onClose={closeVoiceMode}
        />
      )}
    </div>
  );
}
