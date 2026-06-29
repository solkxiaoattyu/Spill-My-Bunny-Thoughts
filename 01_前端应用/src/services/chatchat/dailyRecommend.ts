import { getCorpus } from "./corpus";
import { formatTagLabels } from "./labels";
import { pickRandomCopies } from "./match";
import { getRecentShownIds, getTodayPicks, saveTodayPicks } from "./corpusStorage";
import type { CorpusCopy } from "./types";

export const RANDOM_PICK_SESSION_KEY = "yourword-random-pick-session";

export interface DailyRecommendItem {
  id: string;
  displayName: string;
  text: string;
  postedAt: Date;
}

function copyToDailyItem(copy: CorpusCopy, index: number): DailyRecommendItem {
  const now = new Date();
  const postedAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9 + index * 2,
    18 + index * 11,
  );
  return {
    id: String(copy.id),
    displayName: formatTagLabels(copy.tags),
    text: copy.text,
    postedAt,
  };
}

function pickRandomDaily(exclude: Set<number>): CorpusCopy[] {
  const corpus = getCorpus();
  const pool = corpus.filter((c) => !exclude.has(c.id));
  return pickRandomCopies(pool, 3);
}

export function getDailyRecommendItems(): DailyRecommendItem[] {
  const corpus = getCorpus();
  if (!corpus.length) return [];

  const picks = getTodayPicks();
  let ids: number[];

  if (picks) {
    ids = picks.ids;
  } else {
    ids = pickRandomDaily(getRecentShownIds(7)).map((c) => c.id);
    saveTodayPicks(ids);
  }

  const copies = ids
    .map((id) => corpus.find((c) => c.id === id))
    .filter((c): c is CorpusCopy => Boolean(c));

  if (copies.length < 3) {
    const fallback = pickRandomDaily(new Set(copies.map((c) => c.id)));
    while (copies.length < 3 && fallback.length) {
      const next = fallback.shift();
      if (next && !copies.some((c) => c.id === next.id)) copies.push(next);
    }
    saveTodayPicks(copies.map((c) => c.id));
  }

  return copies.slice(0, 3).map(copyToDailyItem);
}

export function pickRandomDrawItemsByIds(excludeIds: number[] = [], count = 3): DailyRecommendItem[] {
  const corpus = getCorpus();
  if (!corpus.length) return [];

  const picked = pickRandomCopies(corpus, count, excludeIds);
  return picked.map(copyToDailyItem);
}

export function pickRandomDrawItems(excludeTexts: string[] = []): DailyRecommendItem[] {
  const corpus = getCorpus();
  if (!corpus.length) return [];

  const excludeIds = corpus.filter((c) => excludeTexts.includes(c.text)).map((c) => c.id);
  return pickRandomDrawItemsByIds(excludeIds);
}
