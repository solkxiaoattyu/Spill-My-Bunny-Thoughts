#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
朋友圈文案批量 AI 打标脚本

用法:
  pip install -r tagging/requirements.txt
  set OPENAI_API_KEY=your_key
  set OPENAI_BASE_URL=https://api.deepseek.com   # 可选，OpenAI 兼容接口
  set MODEL_NAME=deepseek-chat                   # 可选

  python tagging/batch_tag.py
  python tagging/batch_tag.py --start-id 1 --end-id 100
  python tagging/batch_tag.py --batch-size 50 --dry-run
  python tagging/batch_tag.py --resume

环境变量:
  OPENAI_API_KEY    必填
  OPENAI_BASE_URL   可选，默认 https://api.openai.com/v1
  MODEL_NAME        可选，默认 gpt-4o-mini
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore

# ── 路径 ──────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config" / "tags_enum.json"
SYSTEM_PROMPT_PATH = ROOT / "prompts" / "system_prompt.txt"
USER_PROMPT_PATH = ROOT / "prompts" / "user_prompt_template.txt"
DEFAULT_INPUT = ROOT.parent / "03_朋友圈文案清洗结果.csv"
DEFAULT_OUTPUT_DIR = ROOT / "output"

# ── 自动检测 format / length 的正则 ───────────────────
EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F02F"
    "]+",
    flags=re.UNICODE,
)
ENGLISH_RE = re.compile(r"[A-Za-z]{2,}")
QUOTE_RE = re.compile(r'[「」『』"""\u201c\u201d\u2018\u2019]')
LOCATION_RE = re.compile(r"📍|→|宿\)|目的地|山水|出游|旅行|假期")
MUSIC_RE = re.compile(r"音乐[:：]|♫|🎵|\|\s*[\u4e00-\u9fff\w]+\s*$|歌手")
LIST_RE = re.compile(r"[①②③④⑤⑥⑦⑧⑨⑩]|\b[1-9]\.\s")
PHOTO_DUMP_RE = re.compile(r"plog|photo\s*dump|碎片|PhOtos|日记", re.I)
MILD_SLANG_RE = re.compile(r"妈的|卧槽|靠|他妈|草(?![莓茸茸])")
ADULT_HINT_RE = re.compile(r"偷偷相爱|暧昧|心动|喜欢你|爱你")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def visible_length(text: str) -> int:
    """可见字符数（去掉首尾空白，保留 emoji 和标点）"""
    return len(text.strip())


def auto_length_tag(text: str, rules: dict) -> str:
    n = visible_length(text)
    for tag, (lo, hi) in rules.items():
        if lo <= n <= hi:
            return tag
    return "length_long"


def auto_format_tags(text: str) -> list[str]:
    tags: list[str] = []
    if EMOJI_RE.search(text):
        tags.append("format_has_emoji")
    if ENGLISH_RE.search(text):
        tags.append("format_has_english")
    if QUOTE_RE.search(text):
        tags.append("format_has_quotes")
    if LOCATION_RE.search(text):
        tags.append("format_has_location")
    if MUSIC_RE.search(text):
        tags.append("format_has_music_ref")
    if LIST_RE.search(text):
        tags.append("format_list_style")
    if PHOTO_DUMP_RE.search(text):
        tags.append("format_photo_dump")
    return tags


def auto_content_rating(text: str, llm_rating: str) -> str:
    if ADULT_HINT_RE.search(text):
        return "rating_adult_hint"
    if MILD_SLANG_RE.search(text):
        return "rating_mild_slang"
    return llm_rating if llm_rating in ("rating_clean", "rating_mild_slang", "rating_adult_hint") else "rating_clean"


def tone_level_to_tag(level: int) -> str:
    mapping = {
        1: "tone_1_whisper",
        2: "tone_2_soft",
        3: "tone_3_normal",
        4: "tone_4_vivid",
        5: "tone_5_intense",
    }
    return mapping.get(level, "tone_3_normal")


def read_corpus(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        col = reader.fieldnames[0] if reader.fieldnames else "朋友圈文案"
        for i, row in enumerate(reader, start=1):
            text = (row.get(col) or "").strip()
            if text:
                rows.append({"id": i, "text": text})
    return rows


@dataclass
class QCResult:
    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class TagValidator:
    def __init__(self, enum_config: dict):
        self.config = enum_config
        self.dims = enum_config["dimensions"]
        self.exclusions = enum_config.get("mutual_exclusion", {})
        self.length_rules = enum_config["length_rules"]

    def validate_item(self, item: dict, source_text: str) -> QCResult:
        result = QCResult(passed=True)
        tags = item.get("tags", item)

        def err(msg: str):
            result.passed = False
            result.errors.append(msg)

        def warn(msg: str):
            result.warnings.append(msg)

        # 必填维度
        for dim in ("mood", "scene", "style", "purpose", "relation"):
            val = tags.get(dim)
            if val is None or val == "" or val == []:
                err(f"id={item['id']}: 缺少必填维度 {dim}")

        # 枚举合法性 + 数量上限
        for dim, spec in self.dims.items():
            if dim in ("length", "format"):
                continue
            allowed = set(spec["values"])
            max_count = spec["max_count"]
            raw = tags.get(dim)
            if raw is None:
                continue
            if dim == "relation" or dim == "content_rating":
                values = [raw] if isinstance(raw, str) else list(raw)
            elif dim == "tone_level":
                if isinstance(raw, int):
                    if raw not in range(1, 6):
                        err(f"id={item['id']}: tone_level 必须是 1~5")
                    continue
                values = [raw]
            else:
                values = raw if isinstance(raw, list) else [raw]

            for v in values:
                if v not in allowed:
                    err(f"id={item['id']}: 非法标签 {dim}={v}")
            if len(values) > max_count:
                err(f"id={item['id']}: {dim} 超过上限 {max_count}")

        # 互斥
        for dim, pairs in self.exclusions.items():
            vals = tags.get(dim, [])
            if not isinstance(vals, list):
                vals = [vals]
            val_set = set(vals)
            for a, b in pairs:
                if a in val_set and b in val_set:
                    err(f"id={item['id']}: 互斥冲突 {a} + {b}")

        # keywords
        kws = tags.get("keywords", [])
        if not isinstance(kws, list):
            err(f"id={item['id']}: keywords 必须是数组")
        elif len(kws) > 5:
            warn(f"id={item['id']}: keywords 超过 5 个，已截断")
        for kw in kws:
            if not isinstance(kw, str) or len(kw) > 20:
                warn(f"id={item['id']}: 关键词异常: {kw!r}")

        # 长度校验（系统计算 vs 文案实际）
        expected_len = auto_length_tag(source_text, self.length_rules)
        actual_len = tags.get("length")
        if actual_len and actual_len != expected_len:
            warn(f"id={item['id']}: length 不一致，系统={expected_len} 标注={actual_len}")

        # 质检清单（warnings）
        mood = tags.get("mood", [])
        scene = tags.get("scene", [])
        style = tags.get("style", [])
        if isinstance(mood, list) and len(mood) == 0:
            err(f"id={item['id']}: mood 不能为空")
        if isinstance(scene, list) and "scene_universal" in scene and len(scene) > 1:
            warn(f"id={item['id']}: scene_universal 建议单独使用")
        if isinstance(style, list) and "style_emoji_heavy" in style:
            if not EMOJI_RE.search(source_text):
                warn(f"id={item['id']}: 标了 style_emoji_heavy 但文本无明显 emoji")
        if isinstance(style, list) and "style_cn_en_mix" in style:
            if not ENGLISH_RE.search(source_text):
                warn(f"id={item['id']}: 标了 style_cn_en_mix 但文本无英文")

        theme = tags.get("theme", [])
        if isinstance(theme, list) and len(theme) > 3:
            err(f"id={item['id']}: theme 超过 3 个")

        return result


def merge_auto_tags(llm_item: dict, text: str, enum_config: dict) -> dict:
    """合并 LLM 标签 + 系统自动标签"""
    tone = llm_item.get("tone_level", 3)
    if isinstance(tone, str) and tone.startswith("tone_"):
        tone_tag = tone
        tone_num = int(tone.split("_")[1])
    else:
        tone_num = int(tone) if tone else 3
        tone_tag = tone_level_to_tag(tone_num)

    llm_rating = llm_item.get("content_rating", "rating_clean")
    auto_format = auto_format_tags(text)
    auto_length = auto_length_tag(text, enum_config["length_rules"])

    style = llm_item.get("style", [])
    if isinstance(style, str):
        style = [style]

    return {
        "id": llm_item["id"],
        "text": text,
        "tags": {
            "mood": _as_list(llm_item.get("mood")),
            "scene": _as_list(llm_item.get("scene")),
            "style": _as_list(style),
            "purpose": _as_list(llm_item.get("purpose"))[:1],
            "theme": _as_list(llm_item.get("theme"))[:3],
            "relation": llm_item.get("relation", "relation_none"),
            "length": auto_length,
            "tone_level": tone_num,
            "tone_level_tag": tone_tag,
            "format": auto_format,
            "content_rating": auto_content_rating(text, llm_rating),
            "keywords": _as_list(llm_item.get("keywords"))[:5],
        },
        "tag_version": enum_config.get("version", "v1.0"),
    }


def _as_list(val: Any) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]


def extract_json_array(text: str) -> list:
    text = text.strip()
    # 去掉 markdown 代码块
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # 尝试直接解析
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "items" in data:
            return data["items"]
    except json.JSONDecodeError:
        pass
    # 提取第一个 [...] 
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        return json.loads(match.group())
    raise ValueError(f"无法解析 JSON 数组: {text[:200]}...")


def call_llm(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
) -> str:
    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"} if _supports_json_mode(model) else None,
    )
    return response.choices[0].message.content or ""


def _supports_json_mode(model: str) -> bool:
    """部分模型支持 response_format=json_object；DeepSeek 等可能不支持数组，靠 prompt 约束"""
    return False  # 统一靠 prompt 输出数组，兼容性更好


def build_user_prompt(template: str, batch: list[dict]) -> str:
    items = [{"id": r["id"], "text": r["text"]} for r in batch]
    return template.format(
        count=len(batch),
        items_json=json.dumps(items, ensure_ascii=False, indent=2),
    )


def save_results(results: list[dict], output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "tagged_corpus.json"
    csv_path = output_dir / "tagged_corpus.csv"
    qc_path = output_dir / "qc_report.json"

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    fieldnames = [
        "id", "text", "mood", "scene", "style", "purpose", "theme",
        "relation", "length", "tone_level", "format", "content_rating",
        "keywords", "tag_version", "qc_passed", "qc_errors", "qc_warnings",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            t = r["tags"]
            writer.writerow({
                "id": r["id"],
                "text": r["text"],
                "mood": "|".join(t["mood"]),
                "scene": "|".join(t["scene"]),
                "style": "|".join(t["style"]),
                "purpose": "|".join(t["purpose"]),
                "theme": "|".join(t["theme"]),
                "relation": t["relation"],
                "length": t["length"],
                "tone_level": t["tone_level"],
                "format": "|".join(t["format"]),
                "content_rating": t["content_rating"],
                "keywords": "|".join(t["keywords"]),
                "tag_version": r.get("tag_version", ""),
                "qc_passed": r.get("qc_passed", ""),
                "qc_errors": "|".join(r.get("qc_errors", [])),
                "qc_warnings": "|".join(r.get("qc_warnings", [])),
            })

    qc_summary = {
        "total": len(results),
        "passed": sum(1 for r in results if r.get("qc_passed")),
        "failed": sum(1 for r in results if not r.get("qc_passed")),
        "warning_count": sum(len(r.get("qc_warnings", [])) for r in results),
        "failed_ids": [r["id"] for r in results if not r.get("qc_passed")],
    }
    with qc_path.open("w", encoding="utf-8") as f:
        json.dump(qc_summary, f, ensure_ascii=False, indent=2)

    return json_path, csv_path, qc_path


def load_existing_results(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    data = load_json(path)
    return {item["id"]: item for item in data}


def run_batch(
    batch: list[dict],
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_template: str,
    validator: TagValidator,
    enum_config: dict,
    max_retries: int = 3,
) -> list[dict]:
    user_prompt = build_user_prompt(user_template, batch)
    id_to_text = {r["id"]: r["text"] for r in batch}
    expected_ids = [r["id"] for r in batch]

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            raw = call_llm(client, model, system_prompt, user_prompt)
            llm_items = extract_json_array(raw)
            returned_ids = [item.get("id") for item in llm_items]
            if sorted(returned_ids) != sorted(expected_ids):
                raise ValueError(
                    f"返回 id 不匹配: 期望 {expected_ids}, 得到 {returned_ids}"
                )

            results = []
            for llm_item in llm_items:
                item_id = llm_item["id"]
                text = id_to_text[item_id]
                merged = merge_auto_tags(llm_item, text, enum_config)
                qc = validator.validate_item(merged, text)
                merged["qc_passed"] = qc.passed
                merged["qc_errors"] = qc.errors
                merged["qc_warnings"] = qc.warnings
                results.append(merged)
            return results
        except Exception as e:
            last_error = e
            print(f"  ⚠ 批次重试 {attempt}/{max_retries}: {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"批次打标失败: {last_error}")


def print_qc_checklist():
    print("\n═══ 质检清单 ═══")
    checklist = [
        "[必填] mood / scene / style / purpose / relation 均已填写",
        "[必填] 所有 tag_id 均在枚举表内",
        "[互斥] mood: humor↔emo, happy↔emo, peaceful↔energetic, mysterious↔happy",
        "[互斥] scene: universal 不与 travel/food/work/study/social/holiday 共存",
        "[互斥] style: minimal↔essay, pure_cn↔cn_en_mix",
        "[数量] mood≤2, scene≤2, style≤2, purpose=1, theme≤3, keywords≤5",
        "[自动] length / format 由系统根据文本计算",
        "[自动] content_rating 含粗口/暧昧词时系统会升级",
        "[警告] emoji/英文/引号 标签与文本特征不一致",
        "[警告] scene_universal 与其他具体场景共存",
    ]
    for line in checklist:
        print(f"  {line}")
    print()


def main():
    parser = argparse.ArgumentParser(description="朋友圈文案批量 AI 打标")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="输入 CSV")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--start-id", type=int, default=None)
    parser.add_argument("--end-id", type=int, default=None)
    parser.add_argument("--resume", action="store_true", help="跳过已打标 id")
    parser.add_argument("--revalidate", action="store_true", help="仅对已有 JSON 重新质检，不调 API")
    parser.add_argument("--dry-run", action="store_true", help="只预览批次，不调 API")
    parser.add_argument("--delay", type=float, default=1.0, help="批次间延迟秒数")
    parser.add_argument("--model", default=os.getenv("MODEL_NAME", "gpt-4o-mini"))
    parser.add_argument("--max-retries", type=int, default=3)
    args = parser.parse_args()

    print_qc_checklist()

    enum_config = load_json(CONFIG_PATH)
    system_prompt = load_text(SYSTEM_PROMPT_PATH)
    user_template = load_text(USER_PROMPT_PATH)
    validator = TagValidator(enum_config)

    corpus = read_corpus(args.input)
    if args.start_id:
        corpus = [r for r in corpus if r["id"] >= args.start_id]
    if args.end_id:
        corpus = [r for r in corpus if r["id"] <= args.end_id]

    print(f"语料共 {len(corpus)} 条，批次大小 {args.batch_size}")

    output_json = args.output_dir / "tagged_corpus.json"
    existing = load_existing_results(output_json) if args.resume else {}
    if existing:
        print(f"续跑模式：已有 {len(existing)} 条结果")

    if args.revalidate:
        output_json = args.output_dir / "tagged_corpus.json"
        if not output_json.exists():
            print(f"错误: 找不到 {output_json}", file=sys.stderr)
            sys.exit(1)
        items = load_json(output_json)
        id_to_text = {r["id"]: r["text"] for r in read_corpus(args.input)}
        for item in items:
            text = item.get("text") or id_to_text.get(item["id"], "")
            qc = validator.validate_item(item, text)
            item["qc_passed"] = qc.passed
            item["qc_errors"] = qc.errors
            item["qc_warnings"] = qc.warnings
        json_path, csv_path, qc_path = save_results(items, args.output_dir)
        passed = sum(1 for r in items if r.get("qc_passed"))
        print(f"重新质检完成: {passed}/{len(items)} 通过")
        print(f"  JSON: {json_path}\n  CSV: {csv_path}\n  QC: {qc_path}")
        return

    if args.dry_run:
        pending = [r for r in corpus if r["id"] not in existing]
        batches = [
            pending[i : i + args.batch_size]
            for i in range(0, len(pending), args.batch_size)
        ]
        print(f"将分 {len(batches)} 批处理，待打标 {len(pending)} 条")
        for i, batch in enumerate(batches, 1):
            ids = [r["id"] for r in batch]
            print(f"  批次 {i}: id {ids[0]}~{ids[-1]} ({len(batch)} 条)")
        return

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("错误: 请设置环境变量 OPENAI_API_KEY", file=sys.stderr)
        sys.exit(1)
    if OpenAI is None:
        print("错误: 请先 pip install openai", file=sys.stderr)
        sys.exit(1)

    base_url = os.getenv("OPENAI_BASE_URL")
    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)

    all_results: dict[int, dict] = dict(existing)
    pending = [r for r in corpus if r["id"] not in all_results]
    batches = [
        pending[i : i + args.batch_size]
        for i in range(0, len(pending), args.batch_size)
    ]

    print(f"开始打标: {len(pending)} 条待处理, {len(batches)} 批, model={args.model}")

    for i, batch in enumerate(batches, 1):
        ids = [r["id"] for r in batch]
        print(f"\n[{i}/{len(batches)}] 打标 id {ids[0]}~{ids[-1]} ...")
        try:
            batch_results = run_batch(
                batch, client, args.model, system_prompt, user_template,
                validator, enum_config, args.max_retries,
            )
            for item in batch_results:
                all_results[item["id"]] = item
                status = "✓" if item["qc_passed"] else "✗"
                print(f"  {status} id={item['id']} mood={item['tags']['mood']}")
                if item["qc_errors"]:
                    for e in item["qc_errors"]:
                        print(f"      ERROR: {e}")

            # 每批保存，防止中断丢失
            save_results(
                sorted(all_results.values(), key=lambda x: x["id"]),
                args.output_dir,
            )
        except Exception as e:
            print(f"  批次失败: {e}")
            fail_log = args.output_dir / "failed_batches.jsonl"
            args.output_dir.mkdir(parents=True, exist_ok=True)
            with fail_log.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"batch_ids": ids, "error": str(e)}, ensure_ascii=False) + "\n")

        if i < len(batches):
            time.sleep(args.delay)

    final = sorted(all_results.values(), key=lambda x: x["id"])
    json_path, csv_path, qc_path = save_results(final, args.output_dir)
    passed = sum(1 for r in final if r.get("qc_passed"))
    print(f"\n完成! 共 {len(final)} 条, 质检通过 {passed}, 失败 {len(final) - passed}")
    print(f"  JSON: {json_path}")
    print(f"  CSV:  {csv_path}")
    print(f"  QC:   {qc_path}")


if __name__ == "__main__":
    main()
