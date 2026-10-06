"""LLM に渡すメッセージを組み立てる（このアプリの心臓部）。

  ① 性格プロンプト
  ② RAG で見つけた資料
  ③ 会話履歴
  ④ 今回のユーザー発言
を毎回1つにまとめて渡す。LLM 自体は何も覚えていない。
"""
from .personas import Persona

COMMON_RULES = """
# 共通ルール
- 音声で読み上げられることがあるので、記号や箇条書きは控えめにし、話し言葉で答える。
- 返答は基本的に3〜5文程度。長い説明を求められたときだけ長くする。
- 下の「参考資料」は知識として使うだけ。資料の口調はまねせず、必ず自分のキャラの口調で話す。
- 資料に書いていないことを、資料に書いてあるかのように言わない。
""".strip()


def format_context(docs: list[str]) -> str:
    if not docs:
        return ""
    body = "\n\n".join(f"[資料{i + 1}]\n{d}" for i, d in enumerate(docs))
    return f"# 参考資料（質問に関係しそうなものを検索して見つけた）\n{body}"


def build_messages(
    persona: Persona,
    rag_docs: list[str],
    history: list[dict],
    user_message: str,
) -> list[dict]:
    system_parts = [persona.system_prompt.strip(), COMMON_RULES]
    context = format_context(rag_docs)
    if context:
        system_parts.append(context)

    messages = [{"role": "system", "content": "\n\n".join(system_parts)}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": user_message})
    return messages
