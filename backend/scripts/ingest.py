"""knowledge/<性格ID>/ フォルダの .md / .txt を RAG に取り込む。

使い方（backend フォルダで）:
    python -m scripts.ingest            # 全員分
    python -m scripts.ingest senpai     # 特定の性格だけ
"""
import sys

from app import llm
from app.config import settings
from app.personas import get_personas
from app.rag import RagStore


def main(only: list[str]) -> None:
    personas = get_personas()
    store = RagStore(embedder=llm.embed_sync)
    targets = only or sorted(p.name for p in settings.knowledge_dir.iterdir() if p.is_dir())

    for persona_id in targets:
        if persona_id not in personas:
            print(f"! '{persona_id}' は personas.json に無いのでスキップ")
            continue
        folder = settings.knowledge_dir / persona_id
        files = sorted([*folder.glob("*.md"), *folder.glob("*.txt")]) if folder.exists() else []
        for f in files:
            n = store.add_document(persona_id, f.name, f.read_text(encoding="utf-8"))
            print(f"✓ {persona_id}/{f.name}: {n} チャンク")
    print("完了しました")


if __name__ == "__main__":
    main(sys.argv[1:])
