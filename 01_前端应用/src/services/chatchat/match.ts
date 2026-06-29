import type { CorpusCopy, MatchFilters, MatchedCorpusCopy, QuizSelection, ScoredCopy } from "./types";
import type { CorpusIndex } from "./corpusIndex";
import {
  buildQueryVector,
  buildQueryVectorFromText,
  scoreVectorSimilarity,
} from "./corpusIndex";
import { finalizeRanked, selectRefreshBatch } from "./matchSelect";
import { MATCH_BATCH_SIZE } from "./matchSession";

const WEIGHTS: Record<string, number> = {
  mood: 3,
  scene: 2,
  style: 2,
  purpose: 1.5,
  theme: 1,
  relation: 1,
};

/** 词汇匹配 vs 全文相似 — 7:3 */
const VOCAB_WEIGHT = 0.7;
const FULLTEXT_WEIGHT = 0.3;

const CN_NEGATION = new Set(["不", "没", "非", "无", "未", "别", "莫", "勿"]);

const RELAX_ORDER = ["purpose", "style", "scene"] as const;

/** 问卷/懒人入口：情绪、用途、对象不可放宽，避免刷新时漂移到无关主题 */
const QUIZ_STRICT_DIMS = ["mood", "purpose", "relation"] as const;

/** 懒人卡/问卷：用户选中的每个维度都必须命中，组合锁定后只在池内换批 */
const QUIZ_LOCK_DIMS = ["mood", "purpose", "relation", "scene", "style", "theme"] as const;

export function meetsQuizRequiredTags(
  copy: CorpusCopy,
  filters: Partial<MatchFilters>,
): boolean {
  for (const dim of QUIZ_STRICT_DIMS) {
    const required = filters[dim as keyof MatchFilters];
    if (!required?.length) continue;
    const copyTags = getCopyTags(copy, dim);
    if (!required.some((tag) => copyTags.includes(tag))) return false;
  }
  return true;
}

export function meetsQuizCombinationTags(
  copy: CorpusCopy,
  filters: Partial<MatchFilters>,
): boolean {
  for (const dim of QUIZ_LOCK_DIMS) {
    const required = filters[dim as keyof MatchFilters];
    if (!required?.length) continue;
    const copyTags = getCopyTags(copy, dim);
    if (!required.some((tag) => copyTags.includes(tag))) return false;
  }
  return true;
}

function searchCopiesForQuiz(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  { limit = 100, excludeIds = [] }: { limit?: number; excludeIds?: number[] } = {},
): ScoredCopy[] {
  const exclude = new Set(excludeIds);
  const avoid = filters.avoid || [];
  const avoids = (c: CorpusCopy) => !exclude.has(c.id) && !hasAvoidedTag(c, avoid);
  let working: Partial<MatchFilters> = { ...filters };
  let candidates: ScoredCopy[] = [];

  for (let i = 0; i <= RELAX_ORDER.length; i++) {
    candidates = corpus
      .filter(avoids)
      .filter((c) => meetsQuizRequiredTags(c, working))
      .map((c) => ({ copy: c, score: scoreCopy(c, working) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length >= limit) break;

    if (i < RELAX_ORDER.length) {
      const dim = RELAX_ORDER[i];
      working = { ...working, [dim]: [] };
    }
  }

  return candidates.slice(0, Math.max(limit, 20));
}

const SEMANTIC_SYNONYMS: Record<string, string[]> = {
  加班: ["打工", "上班", "职场", "工作", "累", "深夜"],
  工作: ["加班", "打工", "上班", "职场", "项目"],
  上线: ["成功", "完成", "项目", "庆祝"],
  庆祝: ["开心", "快乐", "成功", "幸福"],
  低调: ["淡淡", "平静", "安静", "顺顺"],
  累: ["疲惫", "困", "加班", "内耗", "烦"],
  开心: ["快乐", "幸福", "治愈", "好天气"],
  幸福: ["快乐", "开心", "治愈", "小确幸"],
  治愈: ["温暖", "幸福", "平静", "温柔"],
  旅行: ["出发", "风景", "海边", "在路上", "度假"],
  美食: ["好吃", "咖啡", "奶茶", "探店"],
  朋友: ["聚会", "姐妹", "兄弟", "闺蜜"],
  春天: ["花开", "绿意", "好天气", "阳光"],
  雨天: ["雨", "阴天", "潮湿"],
  浪漫: ["心动", "喜欢", "爱", "你"],
  emo: ["丧", "内耗", "烦", "累", "难过", "深夜"],
  怀旧: ["回忆", "从前", "青春", "怀念", "曾经"],
  哲思: ["人生", "意义", "思考", "哲学", "沉淀"],
  发疯: ["抽象", "搞笑", "段子", "疯", "离谱"],
  宠物: ["猫", "狗", "毛孩子"],
  毕业: ["青春", "校园", "回忆"],
};

const STOP_WORDS = new Set([
  "我想",
  "今天",
  "明天",
  "一个",
  "一下",
  "已经",
  "但是",
  "可以",
  "就是",
  "然后",
  "因为",
  "所以",
  "如果",
  "怎么",
  "什么",
  "这个",
  "那个",
  "没有",
  "不是",
  "还是",
  "比较",
  "感觉",
  "想要",
  "希望",
  "有点",
  "真的",
  "自己",
  "我们",
  "他们",
  "朋友圈",
  "文案",
  "发一条",
  "帮我",
  "匹配",
]);

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAlphabeticTerm(term: string): boolean {
  return /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(term);
}

/** 精确词匹配：避免 unhappy→happy、不开心→开心 等子串误命中 */
export function containsExactTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const trimmed = term.trim();
  if (!trimmed) return false;

  if (isAlphabeticTerm(trimmed)) {
    const re = new RegExp(`(?<![a-zA-Z])${escapeRegExp(trimmed)}(?![a-zA-Z])`, "i");
    return re.test(text);
  }

  let idx = text.indexOf(trimmed);
  while (idx !== -1) {
    const prev = idx > 0 ? text[idx - 1] : "";
    if (!CN_NEGATION.has(prev)) return true;
    idx = text.indexOf(trimmed, idx + 1);
  }
  return false;
}

function matchesCorpusKeyword(term: string, corpusKw: string): boolean {
  return term === corpusKw;
}

function textHasNegatedPositive(userText: string, positiveTerm: string): boolean {
  if (isAlphabeticTerm(positiveTerm)) {
    const re = new RegExp(
      `(?<![a-zA-Z])(?:un|in|im|dis|non|mis|de)${escapeRegExp(positiveTerm)}(?![a-zA-Z])`,
      "i",
    );
    return re.test(userText);
  }

  let idx = userText.indexOf(positiveTerm);
  while (idx !== -1) {
    const prev = idx > 0 ? userText[idx - 1] : "";
    if (CN_NEGATION.has(prev)) return true;
    idx = userText.indexOf(positiveTerm, idx + 1);
  }
  return false;
}

function scoreVocabTermHit(text: string, copyKws: string[], term: string): number {
  if (containsExactTerm(text, term)) return 1;
  if (copyKws.some((k) => matchesCorpusKeyword(term, k))) return 0.9;
  return 0;
}

function getCopyTags(copy: CorpusCopy, dim: string): string[] {
  if (dim === "relation") {
    const rel = copy.tags?.relation;
    return rel ? [rel] : [];
  }
  const tags = copy.tags?.[dim as keyof typeof copy.tags];
  return asArray(tags as string | string[] | undefined);
}

/** avoid 硬过滤：命中任一 avoid 标签的文案直接排除，不再仅作软扣分 */
function hasAvoidedTag(copy: CorpusCopy, avoid: string[]): boolean {
  if (!avoid?.length) return false;
  for (const tag of avoid) {
    for (const dim of ["mood", "scene", "style", "purpose", "theme"]) {
      if (getCopyTags(copy, dim).includes(tag)) return true;
    }
  }
  return false;
}

export function scoreCopy(copy: CorpusCopy, filters: Partial<MatchFilters>): number {
  let earned = 0;
  let max = 0;

  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    const userTags = filters[dim as keyof MatchFilters];
    if (!userTags?.length) continue;
    max += userTags.length * weight;
    const copyTags = getCopyTags(copy, dim);
    const hits = userTags.filter((t) => copyTags.includes(t));
    earned += hits.length * weight;
  }

  const kws = filters.keywords || [];
  if (kws.length) {
    max += kws.length * 2;
    const text = copy.text || "";
    const copyKws = copy.tags?.keywords || [];
    for (const kw of kws) {
      if (
        containsExactTerm(text, kw) ||
        copyKws.some((k) => matchesCorpusKeyword(kw, k))
      ) {
        earned += 2;
      }
    }
  }

  const avoid = filters.avoid || [];
  for (const tag of avoid) {
    for (const dim of ["mood", "scene", "style", "purpose", "theme"]) {
      if (getCopyTags(copy, dim).includes(tag)) earned -= 3;
    }
  }

  return max > 0 ? earned / max : 0;
}

export function mergeQuizAnswers(selections: (QuizSelection | null | undefined)[]): MatchFilters {
  const filters: MatchFilters = {
    mood: [],
    scene: [],
    style: [],
    purpose: [],
    theme: [],
    relation: [],
    keywords: [],
    semantic_keywords: [],
    avoid: [],
  };

  for (const sel of selections) {
    if (!sel?.tags) continue;
    for (const [dim, tags] of Object.entries(sel.tags)) {
      const key = dim as keyof MatchFilters;
      if (key === "relation" && Array.isArray(tags)) {
        filters.relation = [...new Set([...filters.relation, ...tags])];
      } else if (Array.isArray(filters[key])) {
        filters[key] = [...new Set([...(filters[key] as string[]), ...tags])] as never;
      }
    }
  }
  return filters;
}

export function searchCopies(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  { limit = 5, excludeIds = [] }: { limit?: number; excludeIds?: number[] } = {},
): ScoredCopy[] {
  const exclude = new Set(excludeIds);
  const avoid = filters.avoid || [];
  const avoids = (c: CorpusCopy) => !exclude.has(c.id) && !hasAvoidedTag(c, avoid);
  let working: Partial<MatchFilters> = { ...filters };
  let candidates: ScoredCopy[] = [];

  for (let i = 0; i <= RELAX_ORDER.length; i++) {
    candidates = corpus
      .filter(avoids)
      .map((c) => ({ copy: c, score: scoreCopy(c, working) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length >= limit) break;

    if (i < RELAX_ORDER.length) {
      const dim = RELAX_ORDER[i];
      working = { ...working, [dim]: [] };
    } else {
      // 仍不够时给 avoid-free 候选兜底加分，但绝不把命中 avoid 的反义文案拉进来
      candidates = corpus
        .filter(avoids)
        .map((c) => ({ copy: c, score: scoreCopy(c, filters) || 0.01 }))
        .sort((a, b) => b.score - a.score);
    }
  }

  return candidates.slice(0, Math.max(limit, 20));
}

export function drawMany(
  scoredList: ScoredCopy[],
  count = 3,
  topN = 30,
): MatchedCorpusCopy[] {
  const results: MatchedCorpusCopy[] = [];
  const used = new Set<number>();
  const pool = scoredList.slice(0, topN);
  if (!pool.length) return results;

  while (results.length < count && used.size < pool.length) {
    const remain = pool.filter((x) => !used.has(x.copy.id));
    if (!remain.length) break;
    const weights = remain.map((x) => Math.max(x.score, 0.05));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let picked = remain[0];
    for (let i = 0; i < remain.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        picked = remain[i];
        break;
      }
    }
    used.add(picked.copy.id);
    results.push({
      ...picked.copy,
      matchScore: picked.score,
      matchPercent: Math.round(Math.min(picked.score, 1) * 100),
    });
  }
  return results;
}

export function buildSemanticTerms(userText: string, filters: Partial<MatchFilters> = {}): string[] {
  const terms = new Set<string>();
  for (const kw of [...(filters.keywords || []), ...(filters.semantic_keywords || [])]) {
    if (kw && kw.length >= 2) terms.add(kw);
  }
  for (const kw of extractMatchKeywords(userText)) terms.add(kw);

  const expanded = new Set(terms);
  for (const t of terms) {
    if (textHasNegatedPositive(userText, t)) continue;
    for (const syn of SEMANTIC_SYNONYMS[t] || []) expanded.add(syn);
  }
  return [...expanded].slice(0, 20);
}

function getCharBigrams(text: string): Set<string> {
  const clean = (text || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

export function computeSemanticScore(copy: CorpusCopy, userText: string, terms: string[]): number {
  if (!copy?.text) return 0;
  const text = copy.text;
  const copyKws = copy.tags?.keywords || [];

  let termHits = 0;
  for (const t of terms) {
    termHits += scoreVocabTermHit(text, copyKws, t);
  }
  const vocabScore = terms.length ? Math.min(termHits / terms.length, 1) : 0;

  const bigramScore = jaccardSimilarity(getCharBigrams(userText), getCharBigrams(text));

  const phrases = (userText.match(/[\u4e00-\u9fa5]{3,8}/g) || []).filter((p) => !STOP_WORDS.has(p));
  let phraseHits = 0;
  for (const p of phrases.slice(0, 10)) {
    if (containsExactTerm(text, p)) phraseHits++;
  }
  const phraseScore = phrases.length ? phraseHits / Math.min(phrases.length, 6) : 0;

  const fullTextScore = Math.min(bigramScore * 0.55 + phraseScore * 0.45, 1);

  return Math.min(vocabScore * VOCAB_WEIGHT + fullTextScore * FULLTEXT_WEIGHT, 1);
}

export function extractMatchKeywords(userText: string): string[] {
  const kws = new Set<string>();
  const rules: [RegExp, string[]][] = [
    [/加班|打工人|上班|职场|项目|上线|工作/, ["加班", "工作", "打工人", "上线", "项目"]],
    [/旅行|出游|度假|海边|风景/, ["旅行", "风景", "海边", "出发"]],
    [/美食|好吃|咖啡|奶茶|探店|餐厅/, ["美食", "咖啡", "奶茶", "好吃"]],
    [/猫|狗|宠物|毛孩子/, ["猫", "狗", "宠物"]],
    [/朋友|聚会|姐妹|兄弟|闺蜜/, ["朋友", "聚会", "姐妹"]],
    [/累|疲惫|烦|内耗|emo|丧/, ["累", "疲惫", "emo", "内耗"]],
    [
      /不开心|不快乐|不幸福|难过|伤心|沮丧|失落|郁闷|unhappy|unhappiness|sadness|depressed|miserable/i,
      ["不开心", "难过", "伤心", "emo", "丧", "内耗"],
    ],
    [/(?<![不没非无未别])开心|(?<![不没非无未别])快乐|(?<![不没非无未])幸福|治愈/, ["幸福", "快乐", "开心", "治愈"]],
    [/\bhappy\b|\bhappiness\b|\bjoyful\b|\bcheerful\b/i, ["开心", "快乐", "幸福"]],
    [/浪漫|喜欢|爱你|心动|想你/, ["浪漫", "心动", "喜欢"]],
    [/春天|夏天|秋天|冬天|阳光|雨天/, ["春天", "夏天", "阳光", "雨天"]],
    [/毕业|校园|学习|考试/, ["毕业", "校园", "青春"]],
    [/庆祝|成功|低调|小得意/, ["庆祝", "成功", "低调"]],
  ];
  for (const [re, words] of rules) {
    if (re.test(userText)) words.forEach((w) => kws.add(w));
  }
  const phrases = userText.split(/[，。！？、；\s]+/).filter((p) => p.length >= 2 && p.length <= 12);
  for (const p of phrases) {
    if (!STOP_WORDS.has(p)) kws.add(p);
  }
  return [...kws].slice(0, 8);
}

const RANK_POOL = 120;

/** 无 API：全库离线 embedding 语义排序 */
export function rankMatchesByEmbedding(
  corpus: CorpusCopy[],
  userText: string,
  index: CorpusIndex,
  excludeIds: number[] = [],
  avoid: string[] = [],
): MatchedCorpusCopy[] {
  const exclude = new Set(excludeIds);
  const avoidFn = (c: CorpusCopy) => !exclude.has(c.id) && !hasAvoidedTag(c, avoid);
  const queryVec = buildQueryVectorFromText(userText, index);
  if (!queryVec.size) return [];

  const scored = corpus
    .filter(avoidFn)
    .map((copy) => ({
      copy,
      tagScore: 0,
      semanticScore: scoreVectorSimilarity(index, copy.id, queryVec),
      finalScore: scoreVectorSimilarity(index, copy.id, queryVec),
    }))
    .filter((x) => x.finalScore > 0.01)
    .sort((a, b) => b.finalScore - a.finalScore);

  return finalizeRanked(scored, RANK_POOL);
}

export function rankMatchesTwoStage(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  userText: string,
  excludeIds: number[] = [],
): MatchedCorpusCopy[] {
  const TAG_POOL = 100;
  const MIN_TAG = 0.12;
  const avoid = filters.avoid || [];

  let tagCandidates = searchCopies(corpus, filters, { limit: TAG_POOL, excludeIds }).filter(
    (x) => x.score >= MIN_TAG,
  );

  if (tagCandidates.length < 20) {
    tagCandidates = searchCopies(corpus, filters, { limit: TAG_POOL, excludeIds });
  }
  if (tagCandidates.length < 10) {
    tagCandidates = corpus
      .filter((c) => !excludeIds.includes(c.id) && !hasAvoidedTag(c, avoid))
      .map((c) => ({ copy: c, score: scoreCopy(c, filters) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TAG_POOL);
  }

  const terms = buildSemanticTerms(userText, filters);

  const reranked = tagCandidates.map(({ copy, score: tagScore }) => {
    const semanticScore = computeSemanticScore(copy, userText, terms);
    const finalScore = tagScore * 0.3 + semanticScore * 0.7;
    return { copy, tagScore, semanticScore, finalScore };
  });

  return finalizeRanked(reranked, RANK_POOL);
}

export function topMatchesTwoStage(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  userText: string,
  limit = 5,
  excludeIds: number[] = [],
): MatchedCorpusCopy[] {
  const ranked = rankMatchesTwoStage(corpus, filters, userText, excludeIds);
  return selectRefreshBatch(ranked, limit, excludeIds);
}

export function rankMatchesQuizTwoStage(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  optionLabels: string[],
  index: CorpusIndex,
  excludeIds: number[] = [],
): MatchedCorpusCopy[] {
  const TAG_POOL = 100;
  const MIN_TAG = 0.08;

  let tagCandidates = searchCopiesForQuiz(corpus, filters, {
    limit: TAG_POOL,
    excludeIds,
  }).filter((x) => x.score >= MIN_TAG);

  if (tagCandidates.length < 10) {
    tagCandidates = searchCopiesForQuiz(corpus, filters, { limit: TAG_POOL, excludeIds });
  }

  const queryVec = buildQueryVector(filters, optionLabels, index);

  const reranked = tagCandidates.map(({ copy, score: tagScore }) => {
    const vectorScore = scoreVectorSimilarity(index, copy.id, queryVec);
    const finalScore = tagScore * 0.45 + vectorScore * 0.55;
    return { copy, tagScore, semanticScore: vectorScore, finalScore };
  });

  return finalizeRanked(reranked, RANK_POOL);
}

/** 严格组合池的最小条数：首批 3 + 5 批刷新 × 3 = 18，低于此值无法反复抽取 */
const QUIZ_LOCK_MIN_POOL = 18;
/** 锁定池上限：放宽补充后最多保留这么多条，保证覆盖广度又避免引入过多无关文案 */
const QUIZ_LOCK_MAX_POOL = 120;

/**
 * 问卷/懒人卡：优先严格锁定用户选中的全组合，构建完整候选池。
 * 但窄组合（如 preset-love「暧昧但不明说」严格全锁后只剩 1 条）会无法换批，
 * 因此当严格池条数不足以支撑反复抽取时，退回到 searchCopiesForQuiz 的放宽匹配
 * ——只锁 mood/purpose/relation 等核心维度，其余按 RELAX_ORDER 逐步放宽。
 * 两条路径都基于同一份已过滤的 corpus，不会把已剔除的文案带回来。
 *
 * 覆盖广度：严格池 >= 18 时仍补入放宽匹配的额外条目（去重），让刷新有更多可换文案，
 * 既保住「严格优先」的相关性，又避免窄组合下反复抽到同样几条。
 */
export function buildQuizLockedPool(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  optionLabels: string[],
  index: CorpusIndex,
): MatchedCorpusCopy[] {
  const avoid = filters.avoid || [];
  const strictCopies = corpus.filter(
    (c) => meetsQuizCombinationTags(c, filters) && !hasAvoidedTag(c, avoid),
  );

  let pool: CorpusCopy[];
  let poolLimit: number;

  if (strictCopies.length >= QUIZ_LOCK_MIN_POOL) {
    // 严格池够用：补入放宽匹配的额外条目，扩大可抽取覆盖
    const strictIds = new Set(strictCopies.map((c) => c.id));
    const relaxed = searchCopiesForQuiz(corpus, filters, { limit: QUIZ_LOCK_MAX_POOL })
      .map((x) => x.copy)
      .filter((c) => !strictIds.has(c.id) && !hasAvoidedTag(c, avoid));
    pool = [...strictCopies, ...relaxed].slice(0, QUIZ_LOCK_MAX_POOL);
    poolLimit = pool.length;
  } else {
    const relaxed = searchCopiesForQuiz(corpus, filters, { limit: QUIZ_LOCK_MAX_POOL });
    if (!relaxed.length && !strictCopies.length) return [];
    const relaxedIds = new Set(relaxed.map((x) => x.copy.id));
    const strictExtra = strictCopies.filter((c) => !relaxedIds.has(c.id));
    pool = [...relaxed.map((x) => x.copy), ...strictExtra].slice(0, QUIZ_LOCK_MAX_POOL);
    poolLimit = Math.max(pool.length, 1);
  }

  const queryVec = buildQueryVector(filters, optionLabels, index);
  const reranked = pool.map((copy) => {
    const tagScore = scoreCopy(copy, filters);
    const vectorScore = scoreVectorSimilarity(index, copy.id, queryVec);
    const finalScore = tagScore * 0.45 + vectorScore * 0.55;
    return { copy, tagScore, semanticScore: vectorScore, finalScore };
  });

  return finalizeRanked(reranked, poolLimit);
}

/** 按锁定顺序还原候选池条目（刷新时不再重新放宽筛选） */
export function materializeQuizLockedPool(
  corpus: CorpusCopy[],
  lockedPoolIds: number[],
  filters: Partial<MatchFilters>,
  optionLabels: string[],
  index: CorpusIndex,
): MatchedCorpusCopy[] {
  if (!lockedPoolIds.length) return [];

  const byId = new Map(corpus.map((c) => [c.id, c]));
  const queryVec = buildQueryVector(filters, optionLabels, index);
  const topScore = 1;

  return lockedPoolIds
    .map((id) => byId.get(id))
    .filter((copy): copy is CorpusCopy => !!copy)
    .map((copy) => {
      const tagScore = scoreCopy(copy, filters);
      const vectorScore = scoreVectorSimilarity(index, copy.id, queryVec);
      const finalScore = tagScore * 0.45 + vectorScore * 0.55;
      return {
        ...copy,
        matchScore: finalScore,
        matchPercent: topScore > 0 ? Math.round((finalScore / topScore) * 100) : 0,
        tagPercent: Math.round(tagScore * 100),
        semanticPercent: Math.round(vectorScore * 100),
        tagScore,
        semanticScore: vectorScore,
      };
    });
}

/** 快速匹配：标签筛候选池 → 离线向量语义重排 → 刷新换批 */
export function topMatchesQuizTwoStage(
  corpus: CorpusCopy[],
  filters: Partial<MatchFilters>,
  optionLabels: string[],
  index: CorpusIndex,
  limit = MATCH_BATCH_SIZE,
  excludeIds: number[] = [],
): MatchedCorpusCopy[] {
  const ranked = rankMatchesQuizTwoStage(corpus, filters, optionLabels, index, excludeIds);
  return selectRefreshBatch(ranked, limit, excludeIds);
}

export function parseAiIntent(raw: Record<string, unknown>): MatchFilters {
  const filters: MatchFilters = {
    mood: [],
    scene: [],
    style: [],
    purpose: [],
    theme: [],
    relation: [],
    keywords: [],
    semantic_keywords: [],
    avoid: [],
  };

  const assign = (dim: keyof MatchFilters, vals: unknown) => {
    if (!vals) return;
    const arr = asArray(vals as string | string[]);
    filters[dim] = [...new Set([...(filters[dim] as string[]), ...arr])] as never;
  };

  assign("mood", raw.mood);
  assign("scene", raw.scene);
  assign("style", raw.style);
  assign("purpose", raw.purpose);
  assign("theme", raw.theme);
  assign("relation", raw.relation);
  assign("keywords", raw.keywords);
  assign("semantic_keywords", raw.semantic_keywords);
  assign("avoid", raw.avoid);

  return filters;
}

export function pickRandomCopies(
  corpus: CorpusCopy[],
  count = 3,
  excludeIds: number[] = [],
): CorpusCopy[] {
  const exclude = new Set(excludeIds);
  const pool = corpus.filter((c) => !exclude.has(c.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
