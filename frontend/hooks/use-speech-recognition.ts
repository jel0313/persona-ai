"use client";

/**
 * 音声 → 文字（ブラウザ標準の Web Speech API。無料・インストール不要）
 * Chrome / Edge / Safari で動作。Firefox は未対応。
 */
import { useCallback, useEffect, useRef, useState } from "react";

// TypeScript に型が入っていないので、使う分だけ定義する
type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState(""); // 話している途中の文字
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => setSupported(getCtor() !== null), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("このブラウザは音声入力に対応していません（Chrome をお使いください）");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.continuous = false; // 話し終わると自動で止まる
    rec.interimResults = true;
    finalRef.current = "";

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else text += r[0].transcript;
      }
      setInterim(finalRef.current + text);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error === "not-allowed" ? "マイクの使用が許可されていません" : `音声認識エラー: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (text) onFinalRef.current(text);
    };

    setError(null);
    setListening(true);
    recRef.current = rec;
    rec.start();
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);
  /** 結果を捨てて止める */
  const cancel = useCallback(() => {
    finalRef.current = "";
    recRef.current?.abort();
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, cancel };
}
