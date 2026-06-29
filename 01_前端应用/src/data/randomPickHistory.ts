export const RANDOM_PICK_HISTORY_KEY = "random-pick-history";
const RANDOM_PICK_HISTORY_LIMIT = 30;

export interface RandomPickHistoryEntry {
  id: string;
  quotes: string[];
  drawnAt: string;
}

export function loadRandomPickHistory(): RandomPickHistoryEntry[] {
  const stored = localStorage.getItem(RANDOM_PICK_HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as RandomPickHistoryEntry[];
  } catch {
    return [];
  }
}

function persistRandomPickHistory(entries: RandomPickHistoryEntry[]) {
  localStorage.setItem(RANDOM_PICK_HISTORY_KEY, JSON.stringify(entries));
}

export function recordRandomPickHistory(quotes: string[]) {
  const normalized = quotes.map((text) => text.replace(/\n/g, " ").trim()).filter(Boolean);
  if (normalized.length === 0) return;

  const entry: RandomPickHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quotes: normalized,
    drawnAt: new Date().toISOString().slice(0, 10),
  };

  const next = [entry, ...loadRandomPickHistory()].slice(0, RANDOM_PICK_HISTORY_LIMIT);
  persistRandomPickHistory(next);
}

export function clearRandomPickHistory() {
  localStorage.removeItem(RANDOM_PICK_HISTORY_KEY);
}
