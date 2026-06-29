"""
语料清洗工具 — 规则扫描 + AI 二次复核。

用法：
  python scripts/corpus_cleanup.py                    # 仅规则扫描
  python scripts/corpus_cleanup.py --ai               # 规则扫描 + AI 复核
  python scripts/corpus_cleanup.py --apply            # 应用清单中 action=delete 的样本

环境变量：
  DEEPSEEK_API_KEY   AI 复核用（从环境变量读取，不在代码中硬编码）

清单文件：02_语料与数据/corpus/cleanup_candidates.json
每条记录：
  { id, text, reason, reason_label, ai_verdict, ai_note, action }
- reason        规则命中类别
- ai_verdict    AI 判断：keep / delete / edit
- ai_note       AI 给的理由
- action        最终建议（ai 复核后=ai_verdict，未复核=delete）
action 可手动改为 "delete" / "keep" / "edit"，edit 时需填 new_text
"""
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
import urllib.error
from pathlib import Path

CORPUS_DIR = Path(__file__).resolve().parents[1] / "02_语料与数据" / "corpus"
import os as _os

_env_corpus = _os.environ.get("CORPUS_DIR")
if _env_corpus and Path(_env_corpus).exists():
    CORPUS_DIR = Path(_env_corpus)
CORPUS_JSON = CORPUS_DIR / "tagged_corpus.json"
CANDIDATES_JSON = CORPUS_DIR / "cleanup_candidates.json"

DEEPSEEK_API_KEY = _os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"

# ---- 规则定义 ----------------------------------------------------------

# 标题/元描述：明显在介绍这是一条文案集合，而非文案本身
TITLE_PATTERNS = [
    re.compile(r"朋友圈文案"),
    re.compile(r"朋友圈的文案"),
    re.compile(r"文案[|｜]"),
    re.compile(r"文案[合集集短句]"),
    re.compile(r"短句(合集|精选|大全)"),
    re.compile(r"适合.{0,8}这样发"),
    re.compile(r"适合.{0,12}的文案"),
    re.compile(r"挑一(句|条)去?发"),
    re.compile(r"收藏.{0,4}文案"),
    re.compile(r"发朋友圈的.{0,4}(句子|文案|话)"),
    re.compile(r"关于.{0,10}的文案"),
    re.compile(r"^“.+文案”$"),
    re.compile(r"自由小幸福短句"),
    re.compile(r"可爱の古文符号"),
    re.compile(r"抽象朋友圈"),
    re.compile(r"有淡淡疯感的"),
]

# 水印/搬运声明
WATERMARK_PATTERNS = [
    re.compile(r"勿二?删二?改"),
    re.compile(r"勿搬运"),
    re.compile(r"禁止搬运"),
    re.compile(r"搬运自"),
    re.compile(r"转载自"),
    re.compile(r"收藏自"),
    re.compile(r"出处"),
    re.compile(r"侵权[联必]系"),
    re.compile(r"侵删"),
    re.compile(r"封面搬运"),
    re.compile(r"自用[喔哦]?[|｜]?"),
    re.compile(r"可以自用"),
]

# 互动/导流
PROMO_PATTERNS = [
    re.compile(r"求[转赞评关留]"),
    re.compile(r"转赞评"),
    re.compile(r"点赞.{0,3}评论"),
    re.compile(r"关注[我公众号]"),
    re.compile(r"长按(录制|保存|识别)"),
    re.compile(r"扫码"),
    re.compile(r"加微信"),
    re.compile(r"公众号"),
    re.compile(r"私信[我领发]"),
    re.compile(r"评论区(见|告诉|留言)"),
    re.compile(r"留言区"),
    re.compile(r"看到这篇笔记"),
    re.compile(r"说明你已经在"),
    re.compile(r"点赞过百"),
    re.compile(r"转发过百"),
]

# 品牌/带货/产品介绍
AD_PATTERNS = [
    re.compile(r"索尼\d+W像素"),
    re.compile(r"旗舰画质"),
    re.compile(r"\d+W像素"),
    re.compile(r"解放双手"),
    re.compile(r"第一视角拍照"),
    re.compile(r"MUJI"),
    re.compile(r"小红书[商旗]"),
    re.compile(r"可复美"),
    re.compile(r"胶原棒"),
    re.compile(r"入手了.{0,6}\d\.\d"),
    re.compile(r"趁热入手"),
]

# 极短且仅有符号/无字面含义（保留 emoji 装饰风，不删除）
SYMBOL_ONLY = re.compile(r"^[\s\W_]+$", re.UNICODE)

# 明显自指/对话式开头
SELF_REF = [
    re.compile(r"^我(去|存了|也有|平时|最近)"),
    re.compile(r"^没想到吧[，,]熊今天更"),
    re.compile(r"^平常也喜欢码字"),
    re.compile(r"^会一直更新"),
    re.compile(r"^除入住楼禁评"),
]

REASON_GROUPS = [
    ("title", "标题/集合描述", TITLE_PATTERNS),
    ("watermark", "水印/搬运声明", WATERMARK_PATTERNS),
    ("promo", "互动/导流引导", PROMO_PATTERNS),
    ("ad", "品牌/带货/产品介绍", AD_PATTERNS),
    ("self_ref", "自指/对话式开头", SELF_REF),
]


def classify(text: str) -> str | None:
    if not text:
        return None
    s = text.strip()
    if SYMBOL_ONLY.match(s):
        return None  # 保留纯符号装饰风
    for reason, _, patterns in REASON_GROUPS:
        for p in patterns:
            if p.search(s):
                return reason
    return None


REASON_LABEL = {
    "title": "标题/集合描述",
    "watermark": "水印/搬运声明",
    "promo": "互动/导流引导",
    "ad": "品牌/带货/产品介绍",
    "self_ref": "自指/对话式开头",
}


# ---- AI 二次复核 -------------------------------------------------------

AI_SYSTEM_PROMPT = (
    "你是语料清洗助手。给你若干候选条目（每条带 id 和 text），"
    "判断每条是【适合直接作为朋友圈文案本身】还是【不适合】。\n"
    "不适合的情形：标题/集合描述、水印搬运声明、互动导流、带货广告、自指对话开头、无关元描述。\n"
    "输出纯 JSON 数组，每项形如 {\"id\":数字,\"verdict\":\"keep\"|\"delete\"|\"edit\",\"note\":\"不超过20字\"}。\n"
    "不要输出任何其他文字。"
)


def _ai_batch(items: list[dict]) -> dict[int, dict]:
    """复核一批条目，返回 {id: {verdict, note}}。失败时返回空 dict。"""
    if not items:
        return {}
    payload = json.dumps(
        [
            {"id": it["id"], "text": it["text"][:60]}
            for it in items
        ],
        ensure_ascii=False,
    )
    body = json.dumps(
        {
            "model": DEEPSEEK_MODEL,
            "temperature": 0,
            "max_tokens": 800,
            "messages": [
                {"role": "system", "content": AI_SYSTEM_PROMPT},
                {"role": "user", "content": payload},
            ],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"[AI] 请求失败：{e}")
        return {}

    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    match = re.search(r"\[[\s\S]*\]", content)
    if not match:
        print(f"[AI] 未识别 JSON：{content[:120]}")
        return {}
    try:
        verdicts = json.loads(match.group(0))
    except json.JSONDecodeError:
        print(f"[AI] JSON 解析失败：{content[:120]}")
        return {}

    out: dict[int, dict] = {}
    for v in verdicts:
        try:
            vid = int(v.get("id"))
        except (TypeError, ValueError):
            continue
        verdict = str(v.get("verdict", "")).strip().lower()
        if verdict not in {"keep", "delete", "edit"}:
            verdict = "keep"
        out[vid] = {"verdict": verdict, "note": str(v.get("note", ""))[:40]}
    return out


def ai_review(candidates: list[dict], batch_size: int = 20) -> list[dict]:
    """对候选清单做 AI 复核，原地补 ai_verdict / ai_note / action。"""
    if not candidates:
        return candidates
    total = len(candidates)
    done = 0
    for start in range(0, total, batch_size):
        batch = candidates[start : start + batch_size]
        verdicts = _ai_batch(batch)
        for it in batch:
            v = verdicts.get(it["id"])
            if v:
                it["ai_verdict"] = v["verdict"]
                it["ai_note"] = v["note"]
                it["action"] = v["verdict"]  # AI 复核后以其判断为最终建议
            else:
                it["ai_verdict"] = "unknown"
                it["ai_note"] = "AI 未返回，沿用规则判断"
                # action 保持规则默认 delete
        done += len(batch)
        print(f"[AI] 已复核 {done}/{total}")
    return candidates


def scan() -> list[dict]:
    with CORPUS_JSON.open("r", encoding="utf-8") as f:
        corpus = json.load(f)
    candidates: list[dict] = []
    for item in corpus:
        text = (item.get("text") or "").strip()
        reason = classify(text)
        if reason:
            candidates.append(
                {
                    "id": item["id"],
                    "text": text,
                    "reason": reason,
                    "reason_label": REASON_LABEL[reason],
                    "action": "delete",  # 默认建议删除，可手动改 keep
                }
            )
    return candidates


def apply() -> tuple[int, int]:
    if not CANDIDATES_JSON.exists():
        raise SystemExit("未找到 cleanup_candidates.json，请先运行扫描")
    with CANDIDATES_JSON.open("r", encoding="utf-8") as f:
        candidates = json.load(f)
    with CORPUS_JSON.open("r", encoding="utf-8") as f:
        corpus = json.load(f)

    by_id = {c["id"]: c for c in candidates}
    delete_ids = {c["id"] for c in candidates if c.get("action") == "delete"}
    edit_map = {c["id"]: c.get("new_text", "") for c in candidates if c.get("action") == "edit"}

    new_corpus: list[dict] = []
    deleted = 0
    edited = 0
    for item in corpus:
        cid = item["id"]
        if cid in delete_ids:
            deleted += 1
            continue
        if cid in edit_map:
            new_text = (edit_map[cid] or "").strip()
            if new_text:
                item["text"] = new_text
                edited += 1
        new_corpus.append(item)

    with CORPUS_JSON.open("w", encoding="utf-8") as f:
        json.dump(new_corpus, f, ensure_ascii=False, indent=2)

    # 同步更新 csv（若存在）
    csv_path = CORPUS_DIR / "tagged_corpus.csv"
    if csv_path.exists():
        import csv

        with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "text", "tags"])
            for item in new_corpus:
                writer.writerow([item["id"], item["text"], json.dumps(item.get("tags", {}), ensure_ascii=False)])

    return deleted, edited


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="应用清单中的删除/编辑")
    parser.add_argument("--ai", action="store_true", help="规则扫描后接 AI 二次复核")
    args = parser.parse_args()

    if args.apply:
        deleted, edited = apply()
        print(f"已应用：删除 {deleted} 条，编辑 {edited} 条")
        print("请重新运行 npm run build:index 重建向量索引")
        return

    candidates = scan()
    if args.ai:
        print(f"开始 AI 复核 {len(candidates)} 条候选...")
        candidates = ai_review(candidates)
    CANDIDATES_JSON.write_text(
        json.dumps(candidates, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # 摘要
    from collections import Counter

    counter = Counter(c["reason"] for c in candidates)
    print(f"扫描完成：共 {len(candidates)} 条可疑样本")
    for reason, count in counter.most_common():
        print(f"  {REASON_LABEL[reason]:<20} {count}")
    if args.ai:
        ai_counter = Counter(c.get("ai_verdict", "unknown") for c in candidates)
        print("AI 复核结果：")
        for v, cnt in ai_counter.most_common():
            print(f"  {v:<10} {cnt}")
    print(f"清单已写入：{CANDIDATES_JSON}")
    print("请在清单中把 action 改为 keep 保留，或保留 delete 删除，或改为 edit 并填 new_text")
    print("确认后运行：python scripts/corpus_cleanup.py --apply")


if __name__ == "__main__":
    main()
