"""Copy 01_前端应用/dist into 06_构建产物_dist for handoff packaging."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "01_前端应用" / "dist"
DST = ROOT / "06_构建产物_dist"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing build output: {SRC}\nRun: cd 01_前端应用 && npm run build")

    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    print(f"copied {SRC} -> {DST}")


if __name__ == "__main__":
    main()
