"""RAG（検索して資料をプロンプトに差し込む仕組み）。

ベクトルDB には Chroma を使い、各資料に persona メタデータを付けて保存する。
検索時は where={"persona": id} で「その性格の資料だけ」に絞り込む。
"""
import hashlib
import re
from collections.abc import Callable

from .config import settings

Embedder = Callable[[list[str]], list[list[float]]]


def chunk_text(text: str, max_chars: int = 400, overlap: int = 80) -> list[str]:
    """長い文章を検索しやすい長さに切る。段落→文の順で区切りを優先する。"""
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    if not text:
        return []

    # まず段落、長すぎる段落は「。」などの文末で分ける
    pieces: list[str] = []
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if len(para) <= max_chars:
            pieces.append(para)
            continue
        for sent in re.split(r"(?<=[。！？!?])", para):
            sent = sent.strip()
            while len(sent) > max_chars:  # 句点が無い極端に長い文
                pieces.append(sent[:max_chars])
                sent = sent[max_chars - overlap:]
            if sent:
                pieces.append(sent)

    # 小さい断片は max_chars を超えない範囲でまとめる
    chunks: list[str] = []
    buf = ""
    for p in pieces:
        if buf and len(buf) + 1 + len(p) > max_chars:
            chunks.append(buf)
            tail = buf[-overlap:] if overlap else ""
            buf = (tail + "\n" + p) if tail and len(tail) + 1 + len(p) <= max_chars else p
        else:
            buf = f"{buf}\n{p}" if buf else p
    if buf:
        chunks.append(buf)
    return chunks


def _chunk_id(persona_id: str, source: str, i: int) -> str:
    h = hashlib.sha1(f"{persona_id}:{source}".encode()).hexdigest()[:12]
    return f"{persona_id}-{h}-{i}"


class RagStore:
    COLLECTION = "knowledge"

    def __init__(self, embedder: Embedder, client=None):
        if client is None:
            import chromadb  # 重いので必要になったときだけ読み込む

            settings.chroma_dir.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=str(settings.chroma_dir))
        self.embed = embedder
        # 埋め込みは自前（Ollama）で計算するので embedding_function は使わない
        self.col = client.get_or_create_collection(
            self.COLLECTION, metadata={"hnsw:space": "cosine"}, embedding_function=None
        )

    def add_document(self, persona_id: str, source: str, text: str) -> int:
        """資料を取り込む。同じ source を再度入れると上書きになる。"""
        self.delete_source(persona_id, source)
        chunks = chunk_text(text)
        if not chunks:
            return 0
        self.col.add(
            ids=[_chunk_id(persona_id, source, i) for i in range(len(chunks))],
            documents=chunks,
            embeddings=self.embed(chunks),
            metadatas=[{"persona": persona_id, "source": source} for _ in chunks],
        )
        return len(chunks)

    def delete_source(self, persona_id: str, source: str) -> None:
        self.col.delete(where={"$and": [{"persona": persona_id}, {"source": source}]})

    def search(self, persona_id: str, query: str, k: int = settings.rag_top_k,
               max_distance: float = 0.6) -> list[str]:
        """その性格の資料だけから、質問に近いものを k 件返す。"""
        if self.col.count() == 0:
            return []
        res = self.col.query(
            query_embeddings=self.embed([query]),
            n_results=k,
            where={"persona": persona_id},
        )
        docs = res.get("documents", [[]])[0]
        dists = res.get("distances", [[]])[0] or [0.0] * len(docs)
        # 遠すぎる（関係なさそうな）資料は渡さない
        return [d for d, dist in zip(docs, dists) if dist <= max_distance]

    def list_sources(self, persona_id: str) -> list[str]:
        got = self.col.get(where={"persona": persona_id}, include=["metadatas"])
        return sorted({m["source"] for m in got.get("metadatas", [])})
