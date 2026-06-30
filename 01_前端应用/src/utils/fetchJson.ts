/** 带重试的 JSON fetch，适用于 GitHub Pages 等偶发网络抖动 */
export async function fetchJsonWithRetry<T>(
  url: string,
  label: string,
  retries = 3,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        lastError = new Error(`${label} (HTTP ${res.status})`);
      } else {
        return (await res.json()) as T;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error(`${label} 加载失败`);
}
