import type { CorpusCopy, MatchedCorpusCopy } from "./types";
import { MATCH_BATCH_SIZE, MIN_MATCH_PERCENT } from "./matchSession";

/**
 * 从已排序的匹配列表中选取下一批。
 *
 * 刷新漂移修复：
 * - 不再用「当前池最高分 × 相对阈值」作为门槛，否则当候选减少时无关条目也会被拉到合格线。
 * - 当传入 baseline 时（即非首次匹配），用 baseline 的绝对阈值过滤；不达标就返回空，让刷新自然停止。
 * - 首次匹配（无 baseline）则保留原有相对阈值，用于建立 baseline。
 */
export function selectRefreshBatch(
  ranked: MatchedCorpusCopy[],
  count = MATCH_BATCH_SIZE,
  excludeIds: number[] = [],
  minPercent = MIN_MATCH_PERCENT,
  baselineScore?: number,
): MatchedCorpusCopy[] {
  const exclude = new Set(excludeIds);
  const pool = ranked.filter((item) => !exclude.has(item.id));
  if (!pool.length) return [];

  const topScore = pool[0]?.matchScore ?? 0;
  let eligible: MatchedCorpusCopy[];

  if (baselineScore && baselineScore > 0) {
    // 刷新：用绝对门槛锁死，低于首批 60% 的不再入选，宁可没货也不漂移
    const absMin = baselineScore * (minPercent / 100);
    eligible = pool.filter((item) => (item.matchScore ?? 0) >= absMin);
    if (eligible.length < count) return [];
  } else {
    // 首次匹配：相对阈值 + 兜底取前若干
    const minScore = topScore * (minPercent / 100);
    eligible = pool.filter((item) => (item.matchScore ?? 0) >= minScore);
    if (eligible.length < count) {
      eligible = pool.slice(0, Math.max(count * 4, 24));
    }
  }

  const picked = eligible.slice(0, count);
  const batchTop = picked[0]?.matchScore ?? topScore;

  return picked.map((item) => ({
    ...item,
    matchPercent:
      batchTop > 0 ? Math.round(((item.matchScore ?? 0) / batchTop) * 100) : 0,
  }));
}

/**
 * 从已锁定的问卷候选池中「抽签」式抽取下一批：
 * 按匹配度做加权随机采样（高分更易抽中，但低分也有机会），排除已展示，绝不重复。
 * 相比确定性 slice，避免每次都从最高分往下拿导致首批总是同样几条。
 */
export function selectFromLockedPool(
  ranked: MatchedCorpusCopy[],
  count = MATCH_BATCH_SIZE,
  excludeIds: number[] = [],
  excludeTexts: string[] = [],
): MatchedCorpusCopy[] {
  const excludeIdSet = new Set(excludeIds);
  const excludeTextSet = new Set(excludeTexts.map((t) => t.trim()).filter(Boolean));
  const pool = ranked.filter(
    (item) => !excludeIdSet.has(item.id) && !excludeTextSet.has(item.text.trim()),
  );
  if (!pool.length) return [];

  const picked: MatchedCorpusCopy[] = [];
  const used = new Set<number>();
  // 取前若干作为抽签窗口：池大时窗口更大，保证相关性的同时增加随机性
  const window = Math.min(pool.length, Math.max(count * 6, 24));

  while (picked.length < count && used.size < window) {
    const remain = pool.slice(0, window).filter((x) => !used.has(x.id));
    if (!remain.length) break;
    const weights = remain.map((x) => Math.max(x.matchScore ?? 0.05, 0.05));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = remain[0];
    for (let i = 0; i < remain.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosen = remain[i];
        break;
      }
    }
    used.add(chosen.id);
    picked.push(chosen);
  }

  const batchTop = picked[0]?.matchScore ?? 0;
  return picked.map((item) => ({
    ...item,
    matchPercent:
      batchTop > 0 ? Math.round(((item.matchScore ?? 0) / batchTop) * 100) : 100,
  }));
}

export function finalizeRanked(
  reranked: {
    copy: CorpusCopy;
    tagScore: number;
    semanticScore: number;
    finalScore: number;
  }[],
  poolLimit: number,
): MatchedCorpusCopy[] {
  reranked.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.semanticScore !== a.semanticScore) return b.semanticScore - a.semanticScore;
    return b.tagScore - a.tagScore;
  });

  const top = reranked[0]?.finalScore || 1;
  return reranked.slice(0, poolLimit).map((x) => ({
    ...x.copy,
    matchScore: x.finalScore,
    matchPercent: top > 0 ? Math.round((x.finalScore / top) * 100) : 0,
    tagPercent: Math.round(x.tagScore * 100),
    semanticPercent: Math.round(x.semanticScore * 100),
    tagScore: x.tagScore,
    semanticScore: x.semanticScore,
  }));
}
