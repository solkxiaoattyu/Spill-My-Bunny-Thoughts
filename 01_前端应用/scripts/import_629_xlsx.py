#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从【629待清洗】朋友圈文案爬取系统 xlsx 导入语料：
1. 按编号/换行把合集帖「切条」成单条文案
2. 复用 corpus_cleanup 规则标记 delete/keep
3. 去重（库内已有 + 本批重复）
4. 输出待打标 CSV 与审核 JSON

用法（在 01_前端应用 目录）：
  python scripts/import_629_xlsx.py
  python scripts/import_629_xlsx.py --xlsx "../【629待清洗】朋友圈文案爬取系统_数据表_表格.xlsx"
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    raise SystemExit("请先安装: pip install openpyxl")

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = APP_ROOT.parent

sys.path.insert(0, str(SCRIPT_DIR))
import corpus_cleanup  # noqa: E402

DEFAULT_XLSX = PROJECT_ROOT / "【629待清洗】朋友圈文案爬取系统_数据表_表格.xlsx"
CORPUS_JSON = PROJECT_ROOT / "02_语料与数据" / "corpus" / "tagged_corpus.json"
OUT_DIR = PROJECT_ROOT / "02_语料与数据" / "corpus" / "629_import"

NUM_SPLIT = re.compile(r"(?m)^\s*\d+[\.\、．]\s*")
HASHTAG_LINE = re.compile(r"^#\S")
MOSTLY_HASHTAGS = re.compile(r"^(\s*#\S+\s*)+$")
MIN_LEN = 4
MAX_LEN = 280

# xlsx 爬取常见「合集标题/自存说明」，非文案本身
XHS_TITLE_HINTS = [
    re.compile(r"^#这是我最喜欢的"),
    re.compile(r"^自存.+文案"),
    re.compile(r"^一些.+文案$"),
    re.compile(r"^.*文案bot.*#", re.I),
    re.compile(r"^#.*#.*#.*$"),  # 纯 tag 串（至少 3 个 #）
]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\r\n", "\n")).strip()


def split_post(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return []

    if NUM_SPLIT.search(raw):
        parts = NUM_SPLIT.split(raw)
    else:
        parts = raw.split("\n")

    out: list[str] = []
    for part in parts:
        piece = part.strip()
        if not piece:
            continue
        # 去掉段末 plog 标签块（保留正文）
        piece = re.sub(r"\n\s*#\S.*$", "", piece, flags=re.DOTALL).strip()
        piece = re.sub(r"\s+#\S+(?:\s+#\S+)*\s*$", "", piece).strip()
        if piece:
            out.append(piece)
    return out


def xhs_extra_reason(text: str) -> str | None:
    s = text.strip()
    if MOSTLY_HASHTAGS.match(s):
        return "xhs_hashtag_only"
    if HASHTAG_LINE.match(s) and s.count("#") >= 2 and len(re.sub(r"#\S+", "", s).strip()) < 6:
        return "xhs_hashtag_only"
    for p in XHS_TITLE_HINTS:
        if p.search(s):
            return "xhs_title"
    return None


def load_existing_texts() -> set[str]:
    if not CORPUS_JSON.exists():
        return set()
    data = json.loads(CORPUS_JSON.read_text(encoding="utf-8"))
    return {normalize_text(item.get("text", "")) for item in data if item.get("text")}


def load_xlsx(path: Path) -> list[str]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows: list[str] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if not row or row[0] is None:
            continue
        text = str(row[0]).strip()
        if not text:
            continue
        if i == 0 and text in ("笔记详情", "帖子内容", "内容"):
            continue
        rows.append(text)
    wb.close()
    return rows


def process_xlsx(xlsx_path: Path) -> dict:
    posts = load_xlsx(xlsx_path)
    existing = load_existing_texts()
    seen_batch: set[str] = set()

    records: list[dict] = []
    for post_idx, post in enumerate(posts, start=1):
        for piece in split_post(post):
            norm = normalize_text(piece)
            if len(norm) < MIN_LEN or len(norm) > MAX_LEN:
                records.append(
                    {
                        "source_post": post_idx,
                        "text": piece,
                        "action": "delete",
                        "reason": "length",
                        "reason_label": "过短或过长",
                    }
                )
                continue

            extra = xhs_extra_reason(piece)
            rule = corpus_cleanup.classify(piece)
            reason = extra or rule

            if norm in existing:
                action, label = "delete", "库内已存在"
            elif norm in seen_batch:
                action, label = "delete", "本批重复"
            elif reason:
                action = "delete"
                label = corpus_cleanup.REASON_LABEL.get(reason, reason)
            else:
                action = "keep"
                label = "通过"
                seen_batch.add(norm)

            records.append(
                {
                    "source_post": post_idx,
                    "text": piece,
                    "action": action,
                    "reason": reason or ("duplicate" if label in ("库内已存在", "本批重复") else ""),
                    "reason_label": label,
                }
            )

    keep = [r for r in records if r["action"] == "keep"]
    delete = [r for r in records if r["action"] == "delete"]

    return {
        "meta": {
            "source_xlsx": str(xlsx_path.name),
            "posts": len(posts),
            "pieces_total": len(records),
            "keep": len(keep),
            "delete": len(delete),
        },
        "keep": keep,
        "delete": delete,
        "all": records,
    }


def write_outputs(result: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "629_split_review.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (out_dir / "629_rejected.json").write_text(
        json.dumps(result["delete"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 与 03_朋友圈文案清洗结果.csv 同格式：单列「朋友圈文案」
    ready_csv = out_dir / "629_ready_for_tagging.csv"
    with ready_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(["朋友圈文案"])
        for row in result["keep"]:
            writer.writerow([row["text"]])

    summary = out_dir / "629_import_summary.txt"
    m = result["meta"]
    lines = [
        "629 xlsx 语料导入摘要",
        "=" * 40,
        f"源文件: {m['source_xlsx']}",
        f"原始帖子数: {m['posts']}",
        f"切条后总条数: {m['pieces_total']}",
        f"保留(待打标): {m['keep']}",
        f"剔除: {m['delete']}",
        "",
        "输出文件:",
        f"  {ready_csv.name}  → 交给 batch_tag.py 打标",
        f"  629_split_review.json  → 全量审核",
        f"  629_rejected.json  → 被剔除条目及原因",
        "",
        "下一步:",
        "  1. 人工抽查 629_ready_for_tagging.csv",
        "  2. cd 03_数据打标后端 && python batch_tag.py --input ../02_语料与数据/corpus/629_import/629_ready_for_tagging.csv",
        "  3. 合并进 tagged_corpus.json 后 npm run build:index",
    ]
    summary.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="629 xlsx 语料切条与清洗")
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=DEFAULT_XLSX,
        help="xlsx 路径",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT_DIR,
        help="输出目录",
    )
    args = parser.parse_args()

    if not args.xlsx.exists():
        raise SystemExit(f"找不到 xlsx: {args.xlsx}")

    result = process_xlsx(args.xlsx)
    write_outputs(result, args.out)

    m = result["meta"]
    print(f"帖子 {m['posts']} 篇 → 切条 {m['pieces_total']} 条")
    print(f"保留 {m['keep']} 条 | 剔除 {m['delete']} 条")
    print(f"输出目录: {args.out}")


if __name__ == "__main__":
    main()
