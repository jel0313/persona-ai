"""アプリ全体の設定。.env ファイルや環境変数から読み込む。"""
import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:  # python-dotenv が無くても動くようにしておく
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass


def _path(value: str) -> Path:
    p = Path(value)
    return p if p.is_absolute() else BASE_DIR / p


@dataclass(frozen=True)
class Settings:
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    chat_model: str = os.getenv("CHAT_MODEL", "gemma3:4b")
    embed_model: str = os.getenv("EMBED_MODEL", "bge-m3")
    voicevox_url: str = os.getenv("VOICEVOX_URL", "http://localhost:50021")
    db_path: Path = _path(os.getenv("DB_PATH", "data/app.db"))
    chroma_dir: Path = _path(os.getenv("CHROMA_DIR", "data/chroma"))
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    history_limit: int = int(os.getenv("HISTORY_LIMIT", "20"))
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "3"))
    personas_file: Path = BASE_DIR / "personas.json"
    knowledge_dir: Path = BASE_DIR / "knowledge"


settings = Settings()
