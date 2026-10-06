"""Ollama（ローカルで動く無料LLM）との通信。

- chat_stream: 返答を少しずつ（ストリーミングで）受け取る
- embed:       文章を数値ベクトルに変換する（RAG の検索用）
"""
import json
from collections.abc import AsyncIterator

import httpx

from .config import settings

TIMEOUT = httpx.Timeout(300.0, connect=5.0)


class LLMError(RuntimeError):
    pass


async def chat_stream(messages: list[dict]) -> AsyncIterator[str]:
    payload = {
        "model": settings.chat_model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.8},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", f"{settings.ollama_url}/api/chat", json=payload) as res:
                if res.status_code != 200:
                    body = (await res.aread()).decode(errors="ignore")
                    raise LLMError(f"Ollama エラー {res.status_code}: {body[:200]}")
                async for line in res.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    if "error" in data:
                        raise LLMError(data["error"])
                    chunk = data.get("message", {}).get("content", "")
                    if chunk:
                        yield chunk
                    if data.get("done"):
                        break
    except httpx.ConnectError as e:
        raise LLMError("Ollama に接続できません。`ollama serve` が起動しているか確認してください。") from e


def embed_sync(texts: list[str]) -> list[list[float]]:
    """埋め込みは取り込みスクリプトからも使うので同期版。"""
    try:
        res = httpx.post(
            f"{settings.ollama_url}/api/embed",
            json={"model": settings.embed_model, "input": texts},
            timeout=TIMEOUT,
        )
    except httpx.ConnectError as e:
        raise LLMError("Ollama に接続できません。`ollama serve` が起動しているか確認してください。") from e
    if res.status_code != 200:
        raise LLMError(f"埋め込みエラー {res.status_code}: {res.text[:200]}")
    return res.json()["embeddings"]


async def is_available() -> dict:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{settings.ollama_url}/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            return {
                "ok": True,
                "chat_model_ready": any(m.startswith(settings.chat_model) for m in models),
                "embed_model_ready": any(m.startswith(settings.embed_model) for m in models),
            }
    except Exception:
        return {"ok": False, "chat_model_ready": False, "embed_model_ready": False}
