import { TAG_LABELS } from "./labels";
import type { MatchFilters } from "./types";
import { asset } from "../../utils/asset";
import { fetchJsonWithRetry } from "../../utils/fetchJson";

export const CORPUS_VECTORS_URL = asset("/corpus/corpus_vectors.json");

export type SparseVector = Map<number, number>;

export interface CorpusIndex {
  version: number;
  vocabSize: number;
  vocab: string[];
  termIndex: Map<string, number>;
  idf: number[];
  entries: Map<number, SparseVector>;
}

let indexCache: CorpusIndex | null = null;
let indexPromise: Promise<CorpusIndex> | null = null;

function asArray(val: string | string[] | undefined | null): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function cleanText(text: string): string {
  return (text || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
}

function charBigrams(text: string): string[] {
  const clean = cleanText(text);
  if (clean.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
}

function addTermWeights(weights: Map<string, number>, term: string, amount: number) {
  if (!term) return;
  weights.set(term, (weights.get(term) || 0) + amount);
}

function extractQueryTermWeights(filters: Partial<MatchFilters>, optionLabels: string[]): Map<string, number> {
  const weights = new Map<string, number>();

  for (const label of optionLabels) {
    if (!label) continue;
    addTermWeights(weights, `lbl:${label}`, 4);
    for (const bg of charBigrams(label)) addTermWeights(weights, `bg:${bg}`, 2);
    for (const part of label.split(/[/\s·、]+/).filter(Boolean)) {
      addTermWeights(weights, `lbl:${part}`, 3);
      for (const bg of charBigrams(part)) addTermWeights(weights, `bg:${bg}`, 1);
    }
  }

  for (const kw of [...(filters.keywords || []), ...(filters.semantic_keywords || [])]) {
    addTermWeights(weights, `kw:${kw}`, 4);
    for (const bg of charBigrams(kw)) addTermWeights(weights, `bg:${bg}`, 2);
  }

  for (const dim of ["mood", "scene", "style", "purpose", "theme"] as const) {
    for (const tagId of asArray(filters[dim] as string | string[] | undefined)) {
      addTermWeights(weights, `tag:${tagId}`, 4);
      const label = TAG_LABELS[tagId];
      if (label) {
        addTermWeights(weights, `lbl:${label}`, 4);
        for (const bg of charBigrams(label)) addTermWeights(weights, `bg:${bg}`, 1);
      }
    }
  }

  return weights;
}

function normalizeToSparse(weights: Map<string, number>, index: CorpusIndex): SparseVector {
  const items: [number, number][] = [];
  for (const [term, tf] of weights) {
    const idx = index.termIndex.get(term);
    if (idx === undefined) continue;
    const weight = (1 + Math.log(tf)) * index.idf[idx];
    if (weight > 0) items.push([idx, weight]);
  }
  if (!items.length) return new Map();

  const norm = Math.sqrt(items.reduce((sum, [, w]) => sum + w * w, 0));
  if (norm <= 0) return new Map();

  const vec: SparseVector = new Map();
  for (const [idx, w] of items) vec.set(idx, w / norm);
  return vec;
}

export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [idx, w] of small) {
    const other = large.get(idx);
    if (other !== undefined) dot += w * other;
  }
  return dot;
}

export function buildQueryVectorFromText(userText: string, index: CorpusIndex): SparseVector {
  const weights = new Map<string, number>();
  const trimmed = userText.trim();
  if (!trimmed) return new Map();

  for (const bg of charBigrams(trimmed)) addTermWeights(weights, `bg:${bg}`, 1);

  for (const phrase of trimmed.split(/[，。！？、；\s]+/).filter((p) => p.length >= 2 && p.length <= 24)) {
    addTermWeights(weights, `kw:${phrase}`, 4);
    for (const bg of charBigrams(phrase)) addTermWeights(weights, `bg:${bg}`, 2);
  }

  return normalizeToSparse(weights, index);
}

export function buildQueryVector(
  filters: Partial<MatchFilters>,
  optionLabels: string[],
  index: CorpusIndex,
): SparseVector {
  return normalizeToSparse(extractQueryTermWeights(filters, optionLabels), index);
}

export function getDocumentVector(index: CorpusIndex, id: number): SparseVector | undefined {
  return index.entries.get(id);
}

export async function loadCorpusIndex(): Promise<CorpusIndex> {
  if (indexCache) return indexCache;
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    try {
      const raw = await fetchJsonWithRetry<{
        version: number;
        vocabSize: number;
        vocab: string[];
        idf: number[];
        entries: Record<string, [number, number][]>;
      }>(CORPUS_VECTORS_URL, "语料向量索引加载失败");

      const termIndex = new Map<string, number>();
      raw.vocab.forEach((term, i) => termIndex.set(term, i));

      const entries = new Map<number, SparseVector>();
      for (const [idStr, pairs] of Object.entries(raw.entries)) {
        const vec: SparseVector = new Map();
        for (const [idx, w] of pairs) vec.set(idx, w);
        entries.set(Number(idStr), vec);
      }

      indexCache = {
        version: raw.version,
        vocabSize: raw.vocabSize,
        vocab: raw.vocab,
        termIndex,
        idf: raw.idf,
        entries,
      };
      return indexCache;
    } catch (err) {
      indexPromise = null;
      throw err;
    }
  })();

  return indexPromise;
}

export function isCorpusIndexReady(): boolean {
  return indexCache !== null;
}

export function scoreVectorSimilarity(
  index: CorpusIndex,
  copyId: number,
  queryVec: SparseVector,
): number {
  const docVec = index.entries.get(copyId);
  if (!docVec) return 0;
  return cosineSimilarity(queryVec, docVec);
}
