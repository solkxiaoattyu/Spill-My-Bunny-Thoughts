#!/usr/bin/env python3
"""Build offline sparse TF-IDF vectors for corpus semantic reranking."""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "02_语料与数据" / "corpus" / "tagged_corpus.json"
OUTPUT_PATH = ROOT / "02_语料与数据" / "corpus" / "corpus_vectors.json"

VOCAB_SIZE = 2048
# v2.0 语料重建后旧 QC 失败 id 已失效，统一清空
FAILED_IDS: set[int] = set()

TAG_LABELS: dict[str, str] = {
    "mood_happy": "开心",
    "mood_peaceful": "淡淡",
    "mood_healing": "治愈",
    "mood_romantic": "浪漫",
    "mood_literary": "文艺",
    "mood_humor": "搞怪",
    "mood_emo": "emo",
    "mood_reflective": "感慨",
    "mood_energetic": "元气",
    "mood_mysterious": "酷感",
    "mood_cool": "酷",
    "mood_cool_pose": "装酷",
    "mood_nostalgia": "怀旧",
    "mood_philosophy": "哲思",
    "scene_daily": "日常",
    "scene_travel": "旅行",
    "scene_food": "美食",
    "scene_selfie": "自拍",
    "scene_pet": "宠物",
    "scene_work": "工作",
    "scene_study": "学习",
    "scene_social": "聚会",
    "scene_home": "居家",
    "scene_nature": "自然",
    "scene_night": "夜晚",
    "scene_music": "音乐",
    "scene_holiday": "节日",
    "scene_universal": "氛围",
    "scene_rainy": "雨天",
    "scene_season_spring": "春天",
    "scene_season_autumn_winter": "秋冬",
    "scene_season_winter": "冬天",
    "style_minimal": "短句",
    "style_essay": "长文",
    "style_emoji_heavy": "emoji",
    "style_cn_en_mix": "中英",
    "style_pure_cn": "纯中文",
    "style_symbol_deco": "符号",
    "style_quote": "金句",
    "style_colloquial": "口语",
    "style_abstract": "抽象",
    "style_poetic": "诗意",
    "purpose_share_life": "晒生活",
    "purpose_show_mood": "表达心情",
    "purpose_heal_self": "自我治愈",
    "purpose_subtle_love": "暗戳表白",
    "purpose_cool_pose": "装酷",
    "purpose_humble_brag": "小得意",
    "purpose_complain": "吐槽",
    "purpose_record": "仪式感",
    "purpose_interact": "互动",
    "theme_happiness": "快乐",
    "theme_love": "爱情",
    "theme_friendship": "友情",
    "theme_family": "亲情",
    "theme_freedom": "自由",
    "theme_growth": "成长",
    "theme_season_spring": "春天",
    "theme_season_autumn_winter": "秋冬",
    "theme_rainy": "雨天",
    "theme_sunny": "晴天",
    "theme_night_mood": "夜色",
    "theme_foodie": "美食",
    "theme_pet": "宠物",
    "theme_work_life": "职场",
    "theme_travel_wander": "旅行",
    "theme_self_love": "自爱",
    "theme_nostalgia": "怀旧",
    "theme_philosophy": "哲思",
    "theme_music": "音乐",
    "theme_nature": "自然",
    "theme_romantic": "浪漫",
}


def as_list(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return [str(value)]


def clean_text(text: str) -> str:
    return re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9]", "", text or "")


def char_bigrams(text: str) -> list[str]:
    clean = clean_text(text)
    return [clean[i : i + 2] for i in range(len(clean) - 1)] if len(clean) >= 2 else []


def extract_terms(text: str, tags: dict) -> Counter[str]:
    terms: Counter[str] = Counter()

    for bg, count in Counter(char_bigrams(text)).items():
        terms[f"bg:{bg}"] += count

    for kw in as_list(tags.get("keywords")):
        if len(kw) >= 1:
            terms[f"kw:{kw}"] += 4
            for bg in char_bigrams(kw):
                terms[f"bg:{bg}"] += 2

    for dim in ("mood", "scene", "style", "purpose", "theme"):
        for tag_id in as_list(tags.get(dim)):
            terms[f"tag:{tag_id}"] += 3
            label = TAG_LABELS.get(tag_id)
            if label:
                terms[f"lbl:{label}"] += 3
                for bg in char_bigrams(label):
                    terms[f"bg:{bg}"] += 1

    return terms


def normalize_sparse(counter: Counter[str], vocab: dict[str, int], idf: list[float]) -> list[list[float]]:
    items: list[tuple[int, float]] = []
    for term, tf in counter.items():
        idx = vocab.get(term)
        if idx is None:
            continue
        weight = (1.0 + math.log(tf)) * idf[idx]
        if weight > 0:
            items.append((idx, weight))

    if not items:
        return []

    norm = math.sqrt(sum(w * w for _, w in items))
    if norm <= 0:
        return []
    return [[idx, round(w / norm, 6)] for idx, w in items]


def main() -> None:
    raw = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    corpus = [
        c
        for c in raw
        if c.get("qc_passed") is not False
        and c["id"] not in FAILED_IDS
        and (c.get("tags") or {}).get("content_rating") != "rating_mild_slang"
    ]

    doc_terms: list[tuple[int, Counter[str]]] = []
    df: Counter[str] = Counter()
    for copy in corpus:
        terms = extract_terms(copy.get("text", ""), copy.get("tags") or {})
        doc_terms.append((copy["id"], terms))
        for term in terms:
            df[term] += 1

    n_docs = len(corpus)
    ranked = sorted(df.items(), key=lambda x: (-x[1], x[0]))
    vocab_terms = [t for t, _ in ranked[:VOCAB_SIZE]]
    vocab = {term: i for i, term in enumerate(vocab_terms)}
    idf = [math.log((1.0 + n_docs) / (1.0 + df[t])) + 1.0 for t in vocab_terms]

    entries: dict[str, list[list[float]]] = {}
    for copy_id, terms in doc_terms:
        vec = normalize_sparse(terms, vocab, idf)
        if vec:
            entries[str(copy_id)] = vec

    payload = {
        "version": 1,
        "vocabSize": len(vocab_terms),
        "vocab": vocab_terms,
        "idf": [round(x, 6) for x in idf],
        "docCount": n_docs,
        "entries": entries,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"  docs: {n_docs}, vocab: {len(vocab_terms)}, vectors: {len(entries)}")


if __name__ == "__main__":
    main()
