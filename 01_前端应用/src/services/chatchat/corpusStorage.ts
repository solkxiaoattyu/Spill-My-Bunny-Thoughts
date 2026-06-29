const DAILY_HISTORY_KEY = "yw-daily-history";

interface DailyPickRecord {
  date: string;
  ids: number[];
}

export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDailyHistory(): DailyPickRecord[] {
  try {
    return JSON.parse(localStorage.getItem(DAILY_HISTORY_KEY) || "[]") as DailyPickRecord[];
  } catch {
    return [];
  }
}

export function getTodayPicks(): DailyPickRecord | null {
  const today = getTodayKey();
  return getDailyHistory().find((h) => h.date === today) || null;
}

export function saveTodayPicks(ids: number[]) {
  const today = getTodayKey();
  let hist = getDailyHistory().filter((h) => h.date !== today);
  hist.unshift({ date: today, ids });
  hist = hist.slice(0, 30);
  localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(hist));
}

/** 近 N 天已推送的 copy id */
export function getRecentShownIds(days = 7): Set<number> {
  const hist = getDailyHistory();
  const ids = new Set<number>();
  for (const h of hist) {
    const t = new Date(h.date).getTime();
    if (t >= Date.now() - days * 24 * 60 * 60 * 1000 - 86400000) {
      h.ids.forEach((id) => ids.add(id));
    }
  }
  return ids;
}
