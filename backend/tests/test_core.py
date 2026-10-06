"""FastAPI や Ollama が無くても動く、中核ロジックのテスト。

実行: python -m unittest discover tests
"""
import unittest

from app.db import Database
from app.personas import load_personas
from app.prompt import build_messages
from app.rag import RagStore, chunk_text


class PersonaTest(unittest.TestCase):
    def test_ten_personas(self):
        personas = load_personas()
        self.assertEqual(len(personas), 10)
        for p in personas.values():
            self.assertTrue(p.system_prompt)
            self.assertNotIn("system_prompt", p.public())


class DatabaseTest(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")

    def test_history_returns_latest_in_order(self):
        cid = self.db.create_conversation("senpai", "こんにちは")
        for i in range(5):
            self.db.add_message(cid, "user", f"u{i}")
            self.db.add_message(cid, "assistant", f"a{i}")
        last = self.db.get_messages(cid, limit=3)
        self.assertEqual([m["content"] for m in last], ["a3", "u4", "a4"])
        self.assertEqual(len(self.db.get_messages(cid)), 10)

    def test_delete_cascades(self):
        cid = self.db.create_conversation("senpai", "x")
        self.db.add_message(cid, "user", "hi")
        self.assertTrue(self.db.delete_conversation(cid))
        self.assertEqual(self.db.get_messages(cid), [])
        self.assertEqual(self.db.list_conversations(), [])


class PromptTest(unittest.TestCase):
    def test_order_and_context(self):
        p = load_personas()["senpai"]
        history = [{"role": "user", "content": "前の質問"}, {"role": "assistant", "content": "前の答え"}]
        msgs = build_messages(p, ["たこ焼きが好き"], history, "好物は？")
        self.assertEqual(msgs[0]["role"], "system")
        self.assertIn(p.system_prompt, msgs[0]["content"])
        self.assertIn("たこ焼きが好き", msgs[0]["content"])
        self.assertEqual([m["role"] for m in msgs[1:]], ["user", "assistant", "user"])
        self.assertEqual(msgs[-1]["content"], "好物は？")

    def test_no_context_section_without_docs(self):
        p = load_personas()["zunda"]
        msgs = build_messages(p, [], [], "やあ")
        self.assertNotIn("参考資料（", msgs[0]["content"])


class ChunkTest(unittest.TestCase):
    def test_respects_max_length(self):
        text = "。".join(["これはテストの文です"] * 200) + "。"
        chunks = chunk_text(text, max_chars=100, overlap=20)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= 100 for c in chunks))

    def test_short_paragraphs_are_merged(self):
        chunks = chunk_text("段落A\n\n段落B\n\n段落C", max_chars=400)
        self.assertEqual(len(chunks), 1)

    def test_empty(self):
        self.assertEqual(chunk_text("   \n\n "), [])


# ---- Chroma の代わりに使う小さな偽物（性格での絞り込みを確かめる） ----
class FakeCollection:
    def __init__(self):
        self.rows = []

    def count(self):
        return len(self.rows)

    def _match(self, meta, where):
        if "$and" in where:
            return all(self._match(meta, w) for w in where["$and"])
        return all(meta.get(k) == v for k, v in where.items())

    def add(self, ids, documents, embeddings, metadatas):
        self.rows += list(zip(ids, documents, embeddings, metadatas))

    def delete(self, where):
        self.rows = [r for r in self.rows if not self._match(r[3], where)]

    def get(self, where, include):
        return {"metadatas": [r[3] for r in self.rows if self._match(r[3], where)]}

    def query(self, query_embeddings, n_results, where):
        q = query_embeddings[0]
        hits = [r for r in self.rows if self._match(r[3], where)]
        dist = lambda e: sum((a - b) ** 2 for a, b in zip(e, q)) ** 0.5
        hits.sort(key=lambda r: dist(r[2]))
        hits = hits[:n_results]
        return {"documents": [[r[1] for r in hits]], "distances": [[dist(r[2]) for r in hits]]}


class FakeClient:
    def __init__(self):
        self.col = FakeCollection()

    def get_or_create_collection(self, *args, **kwargs):
        return self.col


def fake_embed(texts):
    # 「たこ焼き」を含むかどうかだけで決まる、ごく単純なベクトル
    return [[1.0, 0.0] if "たこ焼き" in t else [0.0, 1.0] for t in texts]


class RagTest(unittest.TestCase):
    def setUp(self):
        self.store = RagStore(embedder=fake_embed, client=FakeClient())
        self.store.add_document("senpai", "a.md", "好物はたこ焼き。")
        self.store.add_document("butler", "b.md", "紅茶にこだわる。たこ焼きは食べない。")

    def test_search_is_filtered_by_persona(self):
        docs = self.store.search("butler", "たこ焼き好き？", k=5)
        self.assertEqual(len(docs), 1)
        self.assertIn("紅茶", docs[0])

    def test_readd_overwrites(self):
        self.store.add_document("senpai", "a.md", "好物はたこ焼き。")
        self.assertEqual(self.store.list_sources("senpai"), ["a.md"])
        self.assertEqual(self.store.col.count(), 2)


if __name__ == "__main__":
    unittest.main()
