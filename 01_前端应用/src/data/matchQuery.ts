import { resolveTagLabel } from "../services/chatchat/corpusLookup";
import { parseUserIntent, parseUserIntentLocal } from "../services/chatchat/ai";
import { getCorpus } from "../services/chatchat/corpus";
import { loadCorpusIndex } from "../services/chatchat/corpusIndex";
import {
  rankMatchesByEmbedding,
  rankMatchesTwoStage,
} from "../services/chatchat/match";
import { selectRefreshBatch } from "../services/chatchat/matchSelect";
import {
  commitMatchBatch,
  getRefreshRemaining,
  loadMatchRefreshSession,
  MATCH_BATCH_SIZE,
  MIN_MATCH_PERCENT,
  saveMatchRefreshSession,
} from "../services/chatchat/matchSession";
import { isAiConfigured, loadAiConfig, resolveApiConfig } from "./aiConfig";

export interface MatchedCopy {
  id: string;
  text: string;
  matchPercent?: number;
}

export interface MatchQueryResult {
  results: MatchedCopy[];
  refreshRemaining: number;
  mode: "ai" | "embedding";
  /** AI 不可用时降级本地匹配时的提示（非错误） */
  notice?: string;
}

export const CUSTOM_QUERY_KEY = "custom-match-query";
export const CUSTOM_MATCH_STORAGE_KEY = "custom-match-results";
export const QUERY_MATCH_SESSION_KEY = "yourword-query-match-session";
export const FAVORITE_COPIES_KEY = "favorite-copies";

export interface FavoriteCopy {
  text: string;
  savedAt: string;
}

function parseFavoriteEntries(stored: string | null): FavoriteCopy[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as (string | FavoriteCopy)[];
    return parsed.map((item) =>
      typeof item === "string"
        ? { text: item, savedAt: new Date().toISOString().slice(0, 10) }
        : item,
    );
  } catch {
    return [];
  }
}

function persistFavoriteEntries(entries: FavoriteCopy[]) {
  localStorage.setItem(FAVORITE_COPIES_KEY, JSON.stringify(entries));
}

function toMatchedCopy(copy: { id: number; text: string; matchPercent?: number }): MatchedCopy {
  return {
    id: String(copy.id),
    text: copy.text,
    matchPercent: copy.matchPercent,
  };
}

const AI_BUSY_NOTICE = "AI 服务繁忙，已切换为本地智能匹配";

async function rankForQuery(
  query: string,
  excludeIds: number[],
): Promise<{ ranked: ReturnType<typeof rankMatchesTwoStage>; mode: "ai" | "embedding"; notice?: string }> {
  const corpus = getCorpus();
  const index = await loadCorpusIndex();
  const localFilters = parseUserIntentLocal(query);

  if (isAiConfigured()) {
    try {
      const filters = await parseUserIntent(query, resolveApiConfig(loadAiConfig()));
      return { ranked: rankMatchesTwoStage(corpus, filters, query, excludeIds), mode: "ai" };
    } catch (error) {
      console.warn("[match] AI intent parse failed, falling back to local matching", error);
      return {
        ranked: rankMatchesTwoStage(corpus, localFilters, query, excludeIds),
        mode: "embedding",
        notice: AI_BUSY_NOTICE,
      };
    }
  }

  return {
    ranked: rankMatchesByEmbedding(corpus, query, index, excludeIds, localFilters.avoid),
    mode: "embedding",
  };
}

async function runQueryMatch(query: string, isRefresh: boolean): Promise<MatchQueryResult> {
  const corpus = getCorpus();
  if (!corpus.length) return { results: [], refreshRemaining: 0, mode: "embedding" };

  const trimmed = query.trim();
  if (!trimmed) return { results: [], refreshRemaining: 0, mode: "embedding" };

  let session = loadMatchRefreshSession(QUERY_MATCH_SESSION_KEY, trimmed);

  if (isRefresh && session.refreshCount >= 5) {
    session = { sessionKey: trimmed, shownIds: [], refreshCount: 0, baselineScore: undefined };
  }

  const { ranked, mode, notice } = await rankForQuery(trimmed, session.shownIds);
  const batch = selectRefreshBatch(
    ranked,
    MATCH_BATCH_SIZE,
    session.shownIds,
    MIN_MATCH_PERCENT,
    session.baselineScore,
  );
  const results = batch.map((copy) => toMatchedCopy(copy));

  const newIds = batch.map((c) => c.id);
  const topScore = batch[0]?.matchScore ?? ranked[0]?.matchScore;
  session = commitMatchBatch(session, newIds, isRefresh, topScore);
  saveMatchRefreshSession(QUERY_MATCH_SESSION_KEY, session);

  return {
    results,
    refreshRemaining: getRefreshRemaining(session),
    mode,
    ...(notice ? { notice } : {}),
  };
}

export async function matchQuotesByQuery(query: string): Promise<MatchQueryResult> {
  return runQueryMatch(query, false);
}

export async function refreshMatchByQuery(query: string): Promise<MatchQueryResult> {
  return runQueryMatch(query, true);
}

/** @deprecated 使用 refreshMatchByQuery 返回的 refreshRemaining */
export function getQueryRefreshRemaining(query: string): number {
  const session = loadMatchRefreshSession(QUERY_MATCH_SESSION_KEY, query.trim());
  return getRefreshRemaining(session);
}

export function loadFavoriteEntries(): FavoriteCopy[] {
  return parseFavoriteEntries(localStorage.getItem(FAVORITE_COPIES_KEY));
}

export function loadFavoriteCopies(): string[] {
  return loadFavoriteEntries().map((item) => item.text);
}

export function toggleFavoriteCopy(text: string): boolean {
  const favorites = loadFavoriteEntries();
  const exists = favorites.some((item) => item.text === text);
  const next = exists
    ? favorites.filter((item) => item.text !== text)
    : [...favorites, { text, savedAt: new Date().toISOString().slice(0, 10) }];
  persistFavoriteEntries(next);
  return !exists;
}

export function isFavoriteCopy(text: string): boolean {
  return loadFavoriteEntries().some((item) => item.text === text);
}

export const COPIED_COPIES_KEY = "copied-copies";
export const COPY_SUCCESS_EVENT = "yourword-copy-success";
export const REDUCE_RECOMMEND_EVENT = "yourword-reduce-recommend";
const COPIED_COPIES_LIMIT = 50;

export interface CopiedCopy {
  text: string;
  copiedAt: string;
}

function parseCopiedEntries(stored: string | null): CopiedCopy[] {
  if (!stored) return [];
  try {
    return JSON.parse(stored) as CopiedCopy[];
  } catch {
    return [];
  }
}

export function loadCopiedEntries(): CopiedCopy[] {
  return parseCopiedEntries(localStorage.getItem(COPIED_COPIES_KEY));
}

export function recordCopiedCopy(text: string) {
  const normalized = text.replace(/\n/g, " ").trim();
  if (!normalized) return;

  const entries = loadCopiedEntries().filter((item) => item.text !== normalized);
  const next = [
    { text: normalized, copiedAt: new Date().toISOString().slice(0, 10) },
    ...entries,
  ].slice(0, COPIED_COPIES_LIMIT);

  localStorage.setItem(COPIED_COPIES_KEY, JSON.stringify(next));
}

export async function copyTextToClipboard(text: string) {
  const normalized = text.replace(/\n/g, " ").trim();
  await navigator.clipboard.writeText(normalized);
  recordCopiedCopy(normalized);
  window.dispatchEvent(new CustomEvent(COPY_SUCCESS_EVENT));
}

export function notifyReduceRecommend() {
  window.dispatchEvent(new CustomEvent(REDUCE_RECOMMEND_EVENT));
}

export const BROWSE_HISTORY_KEY = "browse-history";
const BROWSE_HISTORY_LIMIT = 50;

export interface BrowseHistoryEntry {
  text: string;
  viewedAt: string;
  tagLabel?: string;
  copyId?: string;
}

export interface BrowseHistoryMeta {
  tagLabel?: string;
  copyId?: string | number;
}

export function loadBrowseHistory(): BrowseHistoryEntry[] {
  const stored = localStorage.getItem(BROWSE_HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as BrowseHistoryEntry[];
  } catch {
    return [];
  }
}

export function recordBrowseHistory(text: string, meta?: BrowseHistoryMeta) {
  const normalized = text.replace(/\n/g, " ").trim();
  if (!normalized) return;

  const tagLabel = resolveTagLabel(normalized, meta?.tagLabel);
  const copyId = meta?.copyId != null ? String(meta.copyId) : undefined;

  const entries = loadBrowseHistory().filter((item) => item.text !== normalized);
  const next = [
    {
      text: normalized,
      viewedAt: new Date().toISOString().slice(0, 10),
      ...(tagLabel ? { tagLabel } : {}),
      ...(copyId ? { copyId } : {}),
    },
    ...entries,
  ].slice(0, BROWSE_HISTORY_LIMIT);

  localStorage.setItem(BROWSE_HISTORY_KEY, JSON.stringify(next));
}

export function clearFavoriteEntries() {
  localStorage.removeItem(FAVORITE_COPIES_KEY);
}

export function clearCopiedEntries() {
  localStorage.removeItem(COPIED_COPIES_KEY);
}

export function clearBrowseHistory() {
  localStorage.removeItem(BROWSE_HISTORY_KEY);
}