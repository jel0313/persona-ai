"""FastAPI サーバー。画面（Next.js）と LLM・DB・RAG・音声合成をつなぐ。

起動: uvicorn app.main:app --reload --port 8000
"""
import asyncio
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from . import llm, tts
from .config import settings
from .db import Database
from .personas import get_persona, get_personas
from .prompt import build_messages
from .rag import RagStore

app = FastAPI(title="Persona AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)

db = Database()


@lru_cache
def get_rag() -> RagStore:
    return RagStore(embedder=llm.embed_sync)


def _require_persona(persona_id: str):
    persona = get_persona(persona_id)
    if persona is None:
        raise HTTPException(404, f"性格 '{persona_id}' が見つかりません")
    return persona


# ---------- 状態確認 ----------
@app.get("/api/health")
async def health():
    return {"ollama": await llm.is_available(), "chat_model": settings.chat_model}


# ---------- 性格 ----------
@app.get("/api/personas")
def list_personas():
    return [p.public() for p in get_personas().values()]


# ---------- 会話 ----------
class ChatRequest(BaseModel):
    persona_id: str
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    use_rag: bool = True


@app.post("/api/chat")
async def chat(req: ChatRequest):
    persona = _require_persona(req.persona_id)

    # 会話スレッドを用意（無ければ新規作成）
    cid = req.conversation_id
    if cid is None or db.get_conversation(cid) is None:
        cid = db.create_conversation(persona.id, req.message.strip())
    history = db.get_messages(cid, limit=settings.history_limit)

    # ② RAG：この性格の資料だけを検索
    docs: list[str] = []
    if req.use_rag:
        try:
            # 埋め込み計算は同期処理なので別スレッドで実行（サーバーを止めない）
            docs = await asyncio.to_thread(get_rag().search, persona.id, req.message)
        except Exception as e:  # RAG が使えなくても会話は続ける
            print(f"[RAG] 検索をスキップしました: {e}")

    messages = build_messages(persona, docs, history, req.message)
    db.add_message(cid, "user", req.message)

    async def generate():
        reply = ""
        try:
            async for chunk in llm.chat_stream(messages):
                reply += chunk
                yield chunk
        except llm.LLMError as e:
            msg = f"\n[エラー] {e}"
            reply += msg
            yield msg
        finally:
            if reply.strip():
                db.add_message(cid, "assistant", reply)

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Conversation-Id": cid, "Cache-Control": "no-cache"},
    )


@app.get("/api/conversations")
def conversations():
    return db.list_conversations()


@app.get("/api/conversations/{cid}")
def conversation_detail(cid: str):
    conv = db.get_conversation(cid)
    if conv is None:
        raise HTTPException(404, "会話が見つかりません")
    return {**conv, "messages": db.get_messages(cid)}


@app.delete("/api/conversations/{cid}")
def delete_conversation(cid: str):
    if not db.delete_conversation(cid):
        raise HTTPException(404, "会話が見つかりません")
    return {"ok": True}


# ---------- RAG の資料 ----------
class KnowledgeRequest(BaseModel):
    persona_id: str
    source: str = Field(min_length=1, max_length=200)  # 資料の名前
    text: str = Field(min_length=1)


@app.post("/api/knowledge")
def add_knowledge(req: KnowledgeRequest):
    _require_persona(req.persona_id)
    try:
        n = get_rag().add_document(req.persona_id, req.source, req.text)
    except llm.LLMError as e:
        raise HTTPException(503, str(e))
    return {"chunks": n}


@app.get("/api/knowledge/{persona_id}")
def list_knowledge(persona_id: str):
    _require_persona(persona_id)
    return {"sources": get_rag().list_sources(persona_id)}


# ---------- 音声合成 ----------
class TTSRequest(BaseModel):
    persona_id: str
    text: str = Field(min_length=1, max_length=1000)


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    persona = _require_persona(req.persona_id)
    try:
        audio = await tts.synthesize(req.text, persona.voicevox_speaker)
    except tts.TTSError as e:
        raise HTTPException(503, str(e))
    return Response(content=audio, media_type="audio/wav")


@app.get("/api/voices")
async def voices():
    try:
        return await tts.list_speakers()
    except Exception:
        raise HTTPException(503, "VOICEVOX に接続できません")
