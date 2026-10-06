"""会話履歴を SQLite に保存する。

テーブル
  conversations: 会話スレッド（どの性格と話したか）
  messages:      各発言（user / assistant）
"""
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: Path | str = settings.db_path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # :memory: でも同じ接続を使い回せるように1本だけ持つ
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SCHEMA)

    @contextmanager
    def _tx(self):
        try:
            yield self._conn
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

    # --- 会話 ---
    def create_conversation(self, persona_id: str, title: str) -> str:
        cid = uuid.uuid4().hex
        now = _now()
        with self._tx() as c:
            c.execute(
                "INSERT INTO conversations VALUES (?, ?, ?, ?, ?)",
                (cid, persona_id, title[:40] or "新しい会話", now, now),
            )
        return cid

    def get_conversation(self, cid: str) -> dict | None:
        row = self._conn.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        return dict(row) if row else None

    def list_conversations(self, limit: int = 50) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def delete_conversation(self, cid: str) -> bool:
        with self._tx() as c:
            cur = c.execute("DELETE FROM conversations WHERE id = ?", (cid,))
        return cur.rowcount > 0

    # --- 発言 ---
    def add_message(self, cid: str, role: str, content: str) -> None:
        now = _now()
        with self._tx() as c:
            c.execute(
                "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (cid, role, content, now),
            )
            c.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, cid))

    def get_messages(self, cid: str, limit: int | None = None) -> list[dict]:
        """古い順で返す。limit 指定時は「最新 limit 件」を古い順で返す。"""
        if limit is None:
            rows = self._conn.execute(
                "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
                (cid,),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM (SELECT id, role, content, created_at FROM messages "
                "WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id",
                (cid, limit),
            ).fetchall()
        return [{"role": r["role"], "content": r["content"], "created_at": r["created_at"]} for r in rows]
