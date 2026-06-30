const BASE = import.meta.env.BASE_URL || "/";

/**
 * 把 public/ 下的绝对资源路径解析为 base 感知路径，
 * 部署到 GitHub Pages 子路径（如 /Spill-My-Bunny-Thoughts/）时也能正确加载。
 * 例：asset("/icon/select.png?v=3") → "/Spill-My-Bunny-Thoughts/icon/select.png?v=3"
 */
export function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, "")}`;
}
