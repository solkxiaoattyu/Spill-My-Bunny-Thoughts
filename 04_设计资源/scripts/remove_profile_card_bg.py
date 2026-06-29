from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "04_设计资源" / "源文件" / "profile-cards"
OUTPUT_DIR = ROOT / "04_设计资源" / "public静态资源" / "profile-cards"
PUBLIC_DIR = ROOT / "01_前端应用" / "public" / "profile-cards"

NAMES = ["match.png", "draw.png", "favorites.png", "browse.png", "copied.png"]

THEME_COLORS = [
    (238, 243, 248),
    (243, 239, 248),
    (250, 240, 245),
    (240, 246, 250),
    (249, 246, 241),
    (255, 255, 255),
]


def color_distance(c1, c2):
    return sum((int(a) - int(b)) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5


def sample_corners(img):
    w, h = img.size
    pts = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    return [img.getpixel(p)[:3] for p in pts]


def remove_background(path: Path, tolerance: float = 34.0):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    seeds = set(sample_corners(img))
    seeds.update(THEME_COLORS)

    visited = bytearray(w * h)
    q = deque()

    def idx(x, y):
        return y * w + x

    def matches_bg(r, g, b):
        return any(color_distance((r, g, b), sc) <= tolerance for sc in seeds)

    for x in range(w):
        for y in (0, h - 1):
            if matches_bg(*pixels[x, y][:3]):
                i = idx(x, y)
                if not visited[i]:
                    visited[i] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if matches_bg(*pixels[x, y][:3]):
                i = idx(x, y)
                if not visited[i]:
                    visited[i] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = idx(nx, ny)
                if not visited[i] and matches_bg(*pixels[nx, ny][:3]):
                    visited[i] = 1
                    q.append((nx, ny))

    bbox = img.getbbox()
    if bbox:
        pad = max(8, int(min(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.06))
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(w, bbox[2] + pad)
        bottom = min(h, bbox[3] + pad)
        img = img.crop((left, top, right, bottom))

    return img


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    for name in NAMES:
        source = SOURCE_DIR / name
        if not source.exists():
            print(f"skip missing source: {source}")
            continue

        processed = remove_background(source)
        out_path = OUTPUT_DIR / name
        public_path = PUBLIC_DIR / name
        processed.save(out_path, optimize=True)
        processed.save(public_path, optimize=True)
        print(f"processed {name}: {processed.size}")
