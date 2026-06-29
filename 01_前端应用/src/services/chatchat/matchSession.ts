/** 刷新换批：最多 5 次不重复，单批最低匹配度 60% */
export const MAX_REFRESH_ROUNDS = 5;
export const MIN_MATCH_PERCENT = 60;
export const MATCH_BATCH_SIZE = 3;

export interface MatchRefreshSession {
  /** 会话标识（查询文案 / 问卷答案 key） */
  sessionKey: string;
  /** 已展示过的语料 id */
  shownIds: number[];
  /** 已展示过的文案正文（兜底去重） */
  shownTexts?: string[];
  /** 问卷/懒人卡：首次匹配时锁定的候选池（按匹配度排序的 id 列表） */
  lockedPoolIds?: number[];
  /** 已完成刷新次数（不含首次展示） */
  refreshCount: number;
  /** 首次匹配的最高原始分，用作刷新绝对门槛，防止漂移到无关条目 */
  baselineScore?: number;
}

export function createMatchRefreshSession(sessionKey: string): MatchRefreshSession {
  return { sessionKey, shownIds: [], shownTexts: [], refreshCount: 0 };
}

export function loadMatchRefreshSession(storageKey: string, sessionKey: string): MatchRefreshSession {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return createMatchRefreshSession(sessionKey);
    const parsed = JSON.parse(raw) as MatchRefreshSession;
    if (parsed.sessionKey !== sessionKey) return createMatchRefreshSession(sessionKey);
    return {
      sessionKey,
      shownIds: Array.isArray(parsed.shownIds) ? parsed.shownIds : [],
      shownTexts: Array.isArray(parsed.shownTexts) ? parsed.shownTexts : [],
      lockedPoolIds: Array.isArray(parsed.lockedPoolIds) ? parsed.lockedPoolIds : undefined,
      refreshCount: typeof parsed.refreshCount === "number" ? parsed.refreshCount : 0,
      baselineScore: typeof parsed.baselineScore === "number" ? parsed.baselineScore : undefined,
    };
  } catch {
    return createMatchRefreshSession(sessionKey);
  }
}

export function saveMatchRefreshSession(storageKey: string, session: MatchRefreshSession) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

export function getRefreshRemaining(session: MatchRefreshSession): number {
  return Math.max(0, MAX_REFRESH_ROUNDS - session.refreshCount);
}

/** 记录本批结果；若已达刷新上限则重置计数并开启新一轮（保留已展示记录以防重复） */
export function commitMatchBatch(
  session: MatchRefreshSession,
  newIds: number[],
  isRefresh: boolean,
  topScore?: number,
  newTexts: string[] = [],
): MatchRefreshSession {
  const shownIds = [...new Set([...session.shownIds, ...newIds])];
  const shownTexts = [
    ...new Set([...(session.shownTexts ?? []), ...newTexts.map((t) => t.trim()).filter(Boolean)]),
  ];

  if (isRefresh && session.refreshCount >= MAX_REFRESH_ROUNDS) {
    return {
      sessionKey: session.sessionKey,
      shownIds,
      shownTexts,
      lockedPoolIds: session.lockedPoolIds,
      refreshCount: 0,
      baselineScore: session.baselineScore ?? topScore,
    };
  }

  return {
    sessionKey: session.sessionKey,
    shownIds,
    shownTexts,
    lockedPoolIds: session.lockedPoolIds,
    refreshCount: isRefresh ? session.refreshCount + 1 : 0,
    baselineScore: session.baselineScore ?? topScore,
  };
}

/** 仅重置换批次数，保留已展示 id/文案，用于「重新开始换批」 */
export function resetMatchRefreshRound(session: MatchRefreshSession): MatchRefreshSession {
  return {
    ...session,
    refreshCount: 0,
  };
}
