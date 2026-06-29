import { formatQuizAnswerLabels } from "./quiz";
import { resolveTagLabel } from "../services/chatchat/corpusLookup";

export const MATCH_HISTORY_KEY = "match-history";
const MATCH_HISTORY_LIMIT = 30;

export type MatchHistoryType = "quiz" | "query";

export interface MatchHistoryQuoteItem {
  text: string;
  matchPercent?: number;
  tagLabel?: string;
}

export interface MatchHistoryEntry {
  id: string;
  type: MatchHistoryType;
  label: string;
  quotes: MatchHistoryQuoteItem[];
  matchedAt: string;
}

function normalizeQuoteItem(input: string | MatchHistoryQuoteItem): MatchHistoryQuoteItem {
  if (typeof input === "string") {
    const text = input.replace(/\n/g, " ").trim();
    return { text, tagLabel: resolveTagLabel(text) };
  }
  const text = input.text.replace(/\n/g, " ").trim();
  return {
    text,
    matchPercent: input.matchPercent,
    tagLabel: resolveTagLabel(text, input.tagLabel),
  };
}

export function loadMatchHistory(): MatchHistoryEntry[] {
  const stored = localStorage.getItem(MATCH_HISTORY_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Array<
      Omit<MatchHistoryEntry, "quotes"> & { quotes: (string | MatchHistoryQuoteItem)[] }
    >;
    return parsed.map((entry) => ({
      ...entry,
      quotes: entry.quotes.map(normalizeQuoteItem).filter((item) => item.text),
    }));
  } catch {
    return [];
  }
}

function persistMatchHistory(entries: MatchHistoryEntry[]) {
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(entries));
}

export function recordMatchHistory(input: {
  type: MatchHistoryType;
  label: string;
  quotes: (string | MatchHistoryQuoteItem)[];
}) {
  const normalized = input.quotes.map(normalizeQuoteItem).filter((item) => item.text);
  if (normalized.length === 0) return;

  const entry: MatchHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    label: input.label.trim() || (input.type === "quiz" ? "快速匹配" : "自定义匹配"),
    quotes: normalized,
    matchedAt: new Date().toISOString().slice(0, 10),
  };

  const next = [entry, ...loadMatchHistory()].slice(0, MATCH_HISTORY_LIMIT);
  persistMatchHistory(next);
}

export function clearMatchHistory() {
  localStorage.removeItem(MATCH_HISTORY_KEY);
}

export function formatQuizMatchLabel(answers: string[]): string {
  return formatQuizAnswerLabels(answers) || "快速匹配";
}
