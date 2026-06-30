import type { CorpusCopy } from "./types";
import {
  getTestRemovedIds,
  loadPersistedRemovedIds,
  mergeRemovedIds,
} from "./corpusTestIds";
import { asset } from "../../utils/asset";
import { fetchJsonWithRetry } from "../../utils/fetchJson";

/** QC 失败 id — v2.0 语料重建后已清空，旧 id 不再适用 */const FAILED_IDS = new Set<number>([]);

export const CORPUS_URL = asset("/corpus/tagged_corpus.json");

let corpusCache: CorpusCopy[] = [];
let loadPromise: Promise<CorpusCopy[]> | null = null;
let persistedRemovedIds: Set<number> = new Set();

function filterCorpus(raw: CorpusCopy[]): CorpusCopy[] {
  const removedIds = mergeRemovedIds(persistedRemovedIds, getTestRemovedIds());
  return raw.filter(
    (c) =>
      c.qc_passed !== false &&
      !FAILED_IDS.has(c.id) &&
      !removedIds.has(c.id),
  );
}

/** 测试版：从内存语料中移除一条（不重新 fetch） */
export function removeCopyFromCache(id: number): boolean {
  if (!corpusCache.length) return false;
  const next = corpusCache.filter((c) => c.id !== id);
  if (next.length === corpusCache.length) return false;
  corpusCache = next;
  return true;
}

export async function loadCorpus(): Promise<CorpusCopy[]> {
  if (corpusCache.length) return corpusCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      persistedRemovedIds = await loadPersistedRemovedIds();
      const raw = await fetchJsonWithRetry<CorpusCopy[]>(CORPUS_URL, "语料加载失败");
      corpusCache = filterCorpus(raw);
      if (!corpusCache.length) {
        throw new Error("语料为空，请检查网络后刷新重试");
      }
      return corpusCache;
    } catch (err) {
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

export function getCorpus(): CorpusCopy[] {
  return corpusCache;
}

export function isCorpusReady(): boolean {
  return corpusCache.length > 0;
}

export function getCorpusCount(): number {
  return corpusCache.length;
}

/** 永久剔除后刷新 manifest 与内存缓存 */
export async function refreshCorpusAfterRemoval(id: number): Promise<void> {
  persistedRemovedIds.add(id);
  removeCopyFromCache(id);
  loadPromise = null;
}
