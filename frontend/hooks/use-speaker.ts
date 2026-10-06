"use client";

/**
 * 文字 → 音声の再生係。
 * 返答がストリーミングで届くので、文が1つ完成するたびに VOICEVOX へ送り、
 * 順番どおりに再生する（全部届くのを待たないので、すぐ話し始められる）。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

/** 読み上げに向かない記号を取り除く */
export function cleanForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "（コードは画面を見てね）")
    .replace(/[`*#>_~|]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** バッファから「完成した文」を取り出す。残りは次回に持ち越す */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /[^。！？!?\n]+[。！？!?\n]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const s = m[0].trim();
    if (s) sentences.push(s);
    last = re.lastIndex;
  }
  return { sentences, rest: buffer.slice(last) };
}

export function useSpeaker(onIdle?: () => void) {
  const [speaking, setSpeaking] = useState(false);
  const queue = useRef<Promise<Blob | null>[]>([]);
  const playing = useRef(false);
  const ended = useRef(true); // 返答の最後の文まで受け取ったか
  const audio = useRef<HTMLAudioElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const generation = useRef(0); // stop() のたびに増やし、古い再生処理を無効にする

  const playNext = useCallback(async () => {
    if (playing.current) return;
    const next = queue.current.shift();
    if (!next) {
      if (ended.current) {
        setSpeaking(false);
        onIdleRef.current?.();
      }
      return;
    }
    const gen = generation.current;
    playing.current = true;
    setSpeaking(true);
    const blob = await next;
    if (gen !== generation.current) return;
    if (blob) {
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      audio.current = el;
      await new Promise<void>((resolve) => {
        el.onended = el.onerror = el.onpause = () => resolve();
        el.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      if (gen !== generation.current) return;
    }
    playing.current = false;
    void playNext();
  }, []);

  /** 返答の読み上げを開始する準備 */
  const begin = useCallback(() => {
    abort.current = new AbortController();
    ended.current = false;
  }, []);

  /** 1文を読み上げ待ちの列に追加（音声の作成はすぐ始める） */
  const enqueue = useCallback(
    (personaId: string, text: string) => {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      const signal = abort.current?.signal;
      queue.current.push(api.tts(personaId, clean, signal).catch(() => null));
      void playNext();
    },
    [playNext],
  );

  /** 返答がすべて届いたことを知らせる */
  const finish = useCallback(() => {
    ended.current = true;
    void playNext();
  }, [playNext]);

  /** 読み上げを途中で止める */
  const stop = useCallback(() => {
    generation.current += 1;
    abort.current?.abort();
    queue.current = [];
    audio.current?.pause();
    audio.current = null;
    playing.current = false;
    ended.current = true;
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  return { speaking, begin, enqueue, finish, stop };
}
