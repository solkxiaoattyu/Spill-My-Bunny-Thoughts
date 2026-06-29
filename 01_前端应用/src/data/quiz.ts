import { QUIZ_STEPS } from "../services/chatchat/labels";
import {
  getRelationStep,
  QUIZ_RELATION_ANSWER_INDEX,
  type QuizPresetCard,
} from "../services/chatchat/quizConfig";
import { getCorpus } from "../services/chatchat/corpus";
import { loadCorpusIndex } from "../services/chatchat/corpusIndex";
import { buildQuizLockedPool, materializeQuizLockedPool, mergeQuizAnswers } from "../services/chatchat/match";
import { selectFromLockedPool } from "../services/chatchat/matchSelect";
import {
  commitMatchBatch,
  createMatchRefreshSession,
  getRefreshRemaining,
  loadMatchRefreshSession,
  MATCH_BATCH_SIZE,
  resetMatchRefreshRound,
  saveMatchRefreshSession,
} from "../services/chatchat/matchSession";
import type { MatchFilters, QuizSelection } from "../services/chatchat/types";

export type { QuizPresetCard };
export { QUIZ_PRESET_CARDS } from "../services/chatchat/quizConfig";

export interface QuizOption {
  key: string;
  label: string;
  tags?: Record<string, string[]>;
}

export interface QuizQuestion {
  stepId: string;
  question: string;
  category: string;
  categoryHint: string;
  options: QuizOption[];
  optional?: boolean;
  answerIndex: number;
}

export interface MatchedQuote {
  id: string;
  text: string;
  matchPercent?: number;
}

export interface QuizMatchResult {
  results: MatchedQuote[];
  refreshRemaining: number;
}

const CATEGORY_MAP: Record<string, { category: string; hint: string }> = {
  purpose: { category: "用途", hint: "WHY" },
  scene: { category: "场景", hint: "SCENE" },
  mood: { category: "情绪", hint: "MOOD" },
  style: { category: "风格", hint: "STYLE" },
  relation: { category: "对象", hint: "RELATION" },
};

export const QUIZ_BASE_COUNT = QUIZ_STEPS.length;
export const QUIZ_ANSWER_SLOTS = QUIZ_BASE_COUNT + 1;
export const QUIZ_REQUIRED_COUNT = QUIZ_BASE_COUNT;

export const QUIZ_QUESTIONS: QuizQuestion[] = QUIZ_STEPS.map((step, index) => {
  const meta = CATEGORY_MAP[step.id] ?? { category: step.id, hint: step.id.toUpperCase() };
  return {
    stepId: step.id,
    question: step.title,
    category: meta.category,
    categoryHint: meta.hint,
    optional: !step.required,
    answerIndex: index,
    options: step.options.map((opt, optIndex) => ({
      key: `${step.id}-${optIndex}`,
      label: opt.label,
      tags: opt.tags,
    })),
  };
});

export const QUIZ_STORAGE_KEY = "quiz-matched-results";
export const QUIZ_ANSWERS_KEY = "quiz-answers";
export const QUIZ_REFRESH_REMAINING_KEY = "quiz-refresh-remaining";
export const QUIZ_MATCH_SESSION_KEY = "yourword-quiz-match-session";

/** @deprecated 兼容旧引用 */
export const QUIZ_QUESTION_COUNT = QUIZ_ANSWER_SLOTS;

function buildRelationQuestion(purposeKey: string): QuizQuestion | null {
  const step = getRelationStep(purposeKey);
  if (!step) return null;
  const meta = CATEGORY_MAP.relation;
  return {
    stepId: "relation",
    question: step.title,
    category: meta.category,
    categoryHint: meta.hint,
    optional: !step.required,
    answerIndex: QUIZ_RELATION_ANSWER_INDEX,
    options: step.options.map((opt, optIndex) => ({
      key: `relation-${optIndex}`,
      label: opt.label,
      tags: opt.tags,
    })),
  };
}

export function getActiveRelationQuestion(answers: string[]): QuizQuestion | null {
  const purposeKey = answers[0];
  if (!purposeKey) return null;
  return buildRelationQuestion(purposeKey);
}

interface QuizMatchContext {
  selections: QuizSelection[];
  labels: string[];
  filters: MatchFilters;
}

function answersSessionKey(answers: string[]): string {
  return answers.filter(Boolean).join("|");
}

function resolveOptionLabel(answerIndex: number, key: string, answers: string[]): string {
  if (answerIndex === QUIZ_RELATION_ANSWER_INDEX) {
    const rq = getActiveRelationQuestion(answers);
    return rq?.options.find((o) => o.key === key)?.label ?? key;
  }
  return QUIZ_QUESTIONS[answerIndex]?.options.find((o) => o.key === key)?.label ?? key;
}

function answersToContext(answers: string[]): QuizMatchContext {
  const selections: QuizSelection[] = [];
  const labels: string[] = [];

  for (let i = 0; i < QUIZ_BASE_COUNT; i++) {
    const key = answers[i];
    if (!key) continue;
    const option = QUIZ_QUESTIONS[i]?.options.find((opt) => opt.key === key);
    if (option?.tags) {
      selections.push({ tags: option.tags });
      labels.push(option.label);
    }
  }

  const relationKey = answers[QUIZ_RELATION_ANSWER_INDEX];
  if (relationKey) {
    const rq = getActiveRelationQuestion(answers);
    const option = rq?.options.find((opt) => opt.key === relationKey);
    if (option?.tags) {
      selections.push({ tags: option.tags });
      labels.push(option.label);
    }
  }

  return {
    selections,
    labels,
    filters: mergeQuizAnswers(selections),
  };
}

async function matchFromQuiz(
  answers: string[],
  isRefresh: boolean,
  restartRound = false,
): Promise<QuizMatchResult> {
  const corpus = getCorpus();
  if (!corpus.length) return { results: [], refreshRemaining: 0 };

  const sessionKey = answersSessionKey(answers);
  let session = loadMatchRefreshSession(QUIZ_MATCH_SESSION_KEY, sessionKey);

  if (!isRefresh && !restartRound) {
    session = createMatchRefreshSession(sessionKey);
  } else if (restartRound) {
    session = resetMatchRefreshRound(session);
  } else if (isRefresh && session.refreshCount >= 5) {
    session = resetMatchRefreshRound(session);
  }

  const index = await loadCorpusIndex();
  const { filters, labels } = answersToContext(answers);
  const shownTextSet = new Set(session.shownTexts ?? []);

  let lockedPoolIds = session.lockedPoolIds;
  if (!lockedPoolIds?.length || (!isRefresh && !restartRound)) {
    const lockedPool = buildQuizLockedPool(corpus, filters, labels, index);
    lockedPoolIds = lockedPool.map((item) => item.id);
    session = { ...session, lockedPoolIds };
  }

  const ranked = materializeQuizLockedPool(corpus, lockedPoolIds, filters, labels, index);
  const batch = selectFromLockedPool(
    ranked,
    MATCH_BATCH_SIZE,
    session.shownIds,
    [...shownTextSet],
  );

  const results = batch.map((copy) => ({
    id: String(copy.id),
    text: copy.text,
    matchPercent: copy.matchPercent,
  }));

  const topScore = batch[0]?.matchScore ?? ranked[0]?.matchScore;
  session = commitMatchBatch(
    session,
    batch.map((c) => c.id),
    isRefresh && !restartRound,
    topScore,
    batch.map((c) => c.text),
  );
  session.lockedPoolIds = lockedPoolIds;
  saveMatchRefreshSession(QUIZ_MATCH_SESSION_KEY, session);

  return {
    results,
    refreshRemaining: getRefreshRemaining(session),
  };
}

export async function getMatchedQuotes(answers: string[]): Promise<QuizMatchResult> {
  return matchFromQuiz(answers, false);
}

export async function refreshMatchedQuotes(answers: string[]): Promise<QuizMatchResult> {
  return matchFromQuiz(answers, true);
}

/** 重新开始换批：保留已展示记录，仅重置轮次计数 */
export async function restartMatchedQuotes(answers: string[]): Promise<QuizMatchResult> {
  return matchFromQuiz(answers, true, true);
}

export function formatQuizAnswerLabels(answers: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < QUIZ_BASE_COUNT; i++) {
    const key = answers[i];
    if (!key) continue;
    parts.push(resolveOptionLabel(i, key, answers));
  }
  const relationKey = answers[QUIZ_RELATION_ANSWER_INDEX];
  if (relationKey) {
    parts.push(resolveOptionLabel(QUIZ_RELATION_ANSWER_INDEX, relationKey, answers));
  }
  return parts.join(" · ");
}

export function createEmptyQuizAnswers(): string[] {
  return Array.from({ length: QUIZ_ANSWER_SLOTS }, () => "");
}

export function answersFromPreset(preset: QuizPresetCard): string[] {
  const answers = createEmptyQuizAnswers();
  for (const [stepId, key] of Object.entries(preset.answers)) {
    if (stepId === "relation") {
      answers[QUIZ_RELATION_ANSWER_INDEX] = key;
      continue;
    }
    const q = QUIZ_QUESTIONS.find((item) => item.stepId === stepId);
    if (q) answers[q.answerIndex] = key;
  }
  return answers;
}

export function isQuizReadyToSubmit(answers: string[]): boolean {
  return answers.slice(0, QUIZ_REQUIRED_COUNT).every(Boolean);
}

export function getQuizProgress(answers: string[]): number {
  const requiredDone = answers.slice(0, QUIZ_REQUIRED_COUNT).filter(Boolean).length;
  const relationDone = answers[QUIZ_RELATION_ANSWER_INDEX] ? 1 : 0;
  const totalSteps = QUIZ_REQUIRED_COUNT + (getActiveRelationQuestion(answers) ? 1 : 0);
  return ((requiredDone + relationDone) / Math.max(totalSteps, 1)) * 100;
}

export function getQuizCompletedSteps(answers: string[]): number {
  let done = answers.slice(0, QUIZ_REQUIRED_COUNT).filter(Boolean).length;
  if (answers[QUIZ_RELATION_ANSWER_INDEX]) done += 1;
  return done;
}

/** 切换用途时清空关系补充题 */
export function clearRelationAnswer(answers: string[]): string[] {
  const next = [...answers];
  next[QUIZ_RELATION_ANSWER_INDEX] = "";
  return next;
}
