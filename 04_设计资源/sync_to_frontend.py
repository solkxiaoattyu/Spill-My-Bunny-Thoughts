"""Sync design assets from 04_设计资源 into 01_前端应用/public.

Usage (from repo root or this directory):
    python sync_to_frontend.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = Path(__file__).resolve().parent
PUBLIC = ROOT / "01_前端应用" / "public"

STATIC_ROOT_FILES = (
    "avatar.png",
    "gift-box-closed.png",
    "gift-box-open.png",
    "hero-cover.jpg",
    "hero-cover.png",
    "welcome-splash.png",
    "_redirects",
)

SYNC_DIRS = (
    ("public静态资源/moments-preview", "moments-preview"),
    ("public静态资源/profile-cards", "profile-cards"),
    ("icon", "icon"),
)


def copy_tree(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            copy_tree(item, target)
        else:
            shutil.copy2(item, target)


def main() -> None:
    static_dir = DESIGN / "public静态资源"
    for name in STATIC_ROOT_FILES:
        src = static_dir / name
        if src.exists():
            shutil.copy2(src, PUBLIC / name)
            print(f"synced public静态资源/{name} -> public/{name}")

    for src_rel, dst_rel in SYNC_DIRS:
        src = DESIGN / src_rel
        if not src.exists():
            continue
        copy_tree(src, PUBLIC / dst_rel)
        print(f"synced {src_rel} -> public/{dst_rel}")

    print("done")


if __name__ == "__main__":
    main()
