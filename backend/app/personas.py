"""性格（ペルソナ）の定義を personas.json から読み込む。"""
import json
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path

from .config import settings


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    tagline: str          # 画面に出す一言紹介
    system_prompt: str    # LLMに渡す性格の指示文
    voicevox_speaker: int  # VOICEVOX の話者ID（声）
    color: str            # 画面のアクセント色

    def public(self) -> dict:
        """フロントエンドに返す情報（指示文は含めない）。"""
        d = asdict(self)
        d.pop("system_prompt")
        return d


def load_personas(path: Path | None = None) -> dict[str, Persona]:
    data = json.loads((path or settings.personas_file).read_text(encoding="utf-8"))
    personas = {p["id"]: Persona(**p) for p in data}
    if not personas:
        raise ValueError("personas.json に性格が1つもありません")
    return personas


@lru_cache
def get_personas() -> dict[str, Persona]:
    return load_personas()


def get_persona(persona_id: str) -> Persona | None:
    return get_personas().get(persona_id)
