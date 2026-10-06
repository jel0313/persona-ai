"""VOICEVOX（無料の日本語音声合成）で文章を音声(wav)にする。

VOICEVOX は2段階:
  1. /audio_query  … 文章から「読み方・アクセント」の設計図を作る
  2. /synthesis    … 設計図から実際の音声を作る
"""
import httpx

from .config import settings


class TTSError(RuntimeError):
    pass


async def synthesize(text: str, speaker: int, speed: float = 1.1) -> bytes:
    try:
        async with httpx.AsyncClient(base_url=settings.voicevox_url, timeout=60.0) as client:
            q = await client.post("/audio_query", params={"text": text, "speaker": speaker})
            q.raise_for_status()
            query = q.json()
            query["speedScale"] = speed
            s = await client.post("/synthesis", params={"speaker": speaker}, json=query)
            s.raise_for_status()
            return s.content
    except httpx.ConnectError as e:
        raise TTSError("VOICEVOX に接続できません。VOICEVOX アプリ（またはエンジン）を起動してください。") from e
    except httpx.HTTPStatusError as e:
        raise TTSError(f"VOICEVOX エラー: {e.response.status_code}") from e


async def list_speakers() -> list[dict]:
    async with httpx.AsyncClient(base_url=settings.voicevox_url, timeout=5.0) as client:
        res = await client.get("/speakers")
        res.raise_for_status()
        return [
            {"name": sp["name"], "styles": [{"id": st["id"], "name": st["name"]} for st in sp["styles"]]}
            for sp in res.json()
        ]
