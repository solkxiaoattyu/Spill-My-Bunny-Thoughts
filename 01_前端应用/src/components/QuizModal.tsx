import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, X } from "lucide-react";
import { useCorpus } from "../context/CorpusContext";
import {
  answersFromPreset,
  clearRelationAnswer,
  createEmptyQuizAnswers,
  getActiveRelationQuestion,
  getMatchedQuotes,
  getQuizCompletedSteps,
  getQuizProgress,
  isQuizReadyToSubmit,
  QUIZ_ANSWERS_KEY,
  QUIZ_BASE_COUNT,
  QUIZ_PRESET_CARDS,
  QUIZ_QUESTIONS,
  QUIZ_REFRESH_REMAINING_KEY,
  QUIZ_STORAGE_KEY,
} from "../data/quiz";
import { formatQuizMatchLabel, recordMatchHistory } from "../data/matchHistory";

interface QuizModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function SketchPurpose() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <rect x="11" y="8" width="18" height="24" rx="2" className="sketch-stroke" strokeWidth="1.8" fill="none" />
      <path className="sketch-stroke" d="M15 14 H25 M15 19 H23 M15 24 H21" strokeWidth="1.6" />
      <circle cx="27" cy="11" r="1.5" className="fill-brand-pink" />
    </svg>
  );
}

function SketchScene() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <path className="sketch-stroke" d="M8 28 L16 18 L22 24 L32 12" strokeWidth="1.8" />
      <circle cx="28" cy="11" r="3" className="sketch-stroke" strokeWidth="1.6" fill="none" />
      <path className="sketch-stroke" d="M8 30 H32" strokeWidth="1.6" />
      <circle cx="12" cy="14" r="1.5" className="fill-brand-pink" />
    </svg>
  );
}

function SketchMood() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <circle cx="20" cy="20" r="11" className="sketch-stroke" strokeWidth="1.8" fill="none" />
      <path className="sketch-stroke" d="M14 18 Q16 22 18 18 M22 18 Q24 22 26 18" strokeWidth="1.6" />
      <path className="sketch-stroke" d="M15 26 Q20 29 25 26" strokeWidth="1.6" />
      <circle cx="28" cy="12" r="1.5" className="fill-brand" />
    </svg>
  );
}

function SketchStyle() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <path
        className="sketch-stroke"
        d="M10 28 C14 18 18 14 26 12 M26 12 L30 8 M26 12 L32 16"
        strokeWidth="1.8"
      />
      <path className="sketch-stroke" d="M8 32 L18 30" strokeWidth="1.6" />
      <circle cx="30" cy="9" r="1.5" className="fill-brand" />
    </svg>
  );
}

function SketchLength() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <path className="sketch-stroke" d="M10 14 H30 M10 20 H26 M10 26 H22" strokeWidth="1.8" />
      <circle cx="32" cy="26" r="1.5" className="fill-brand-pink" />
    </svg>
  );
}

function SketchRelation() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-[#111]" aria-hidden>
      <circle cx="14" cy="20" r="5" className="sketch-stroke" strokeWidth="1.6" fill="none" />
      <circle cx="26" cy="20" r="5" className="sketch-stroke" strokeWidth="1.6" fill="none" />
      <path className="sketch-stroke" d="M19 20 Q20 16 21 20" strokeWidth="1.6" />
    </svg>
  );
}

const STEP_SKETCHES: Record<string, typeof SketchPurpose> = {
  purpose: SketchPurpose,
  scene: SketchScene,
  mood: SketchMood,
  style: SketchStyle,
  length: SketchLength,
  relation: SketchRelation,
};

export default function QuizModal({ open, onClose, onComplete }: QuizModalProps) {
  const navigate = useNavigate();
  const { status: corpusStatus } = useCorpus();
  const [answers, setAnswers] = useState(createEmptyQuizAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const relationQuestion = useMemo(() => getActiveRelationQuestion(answers), [answers]);

  const progressSteps = useMemo(() => {
    const steps = QUIZ_QUESTIONS.map((q) => ({
      id: q.stepId,
      done: Boolean(answers[q.answerIndex]),
      optional: false,
    }));
    if (relationQuestion) {
      steps.push({
        id: "relation",
        done: Boolean(answers[relationQuestion.answerIndex]),
        optional: true,
      });
    }
    return steps;
  }, [answers, relationQuestion]);

  useEffect(() => {
    if (!open) return;
    setAnswers(createEmptyQuizAnswers());
    setSubmitting(false);
    setSubmitError(null);
    setActivePresetId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = isQuizReadyToSubmit(answers);
  const progress = getQuizProgress(answers);
  const completedSteps = getQuizCompletedSteps(answers);
  const totalSteps = QUIZ_BASE_COUNT + (relationQuestion ? 1 : 0);

  const selectOption = (answerIndex: number, key: string) => {
    setActivePresetId(null);
    setAnswers((prev) => {
      let next = [...prev];
      next[answerIndex] = key;
      if (answerIndex === 0) {
        next = clearRelationAnswer(next);
      }
      return next;
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = QUIZ_PRESET_CARDS.find((item) => item.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setAnswers(answersFromPreset(preset));
    setSubmitError(null);
  };

  const skipRelation = () => {
    setAnswers((prev) => {
      const next = [...prev];
      if (relationQuestion) next[relationQuestion.answerIndex] = "";
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting || corpusStatus !== "ready") return;
    setSubmitting(true);
    setSubmitError(null);
    localStorage.setItem(QUIZ_ANSWERS_KEY, JSON.stringify(answers));
    try {
      const { results, refreshRemaining } = await getMatchedQuotes(answers);
      if (!results.length) {
        setSubmitError("未找到匹配文案，请调整选项后重试");
        setSubmitting(false);
        return;
      }
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(results));
      localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, String(refreshRemaining));
      recordMatchHistory({
        type: "quiz",
        label: formatQuizMatchLabel(answers),
        quotes: results.map((item) => ({
          text: item.text,
          matchPercent: item.matchPercent,
        })),
      });
      onComplete();
    } catch {
      setSubmitError("匹配失败，请稍后重试");
      setSubmitting(false);
    }
  };

  const renderQuestionSection = (question: (typeof QUIZ_QUESTIONS)[number]) => {
    const Sketch = STEP_SKETCHES[question.stepId] ?? SketchStyle;
    return (
      <section key={question.stepId} className="quiz-sheet-section">
        <div className="quiz-sheet-section-label">
          <span className="quiz-sheet-section-icon" aria-hidden>
            <Sketch />
          </span>
          <div>
            <p className="quiz-sheet-section-name">{question.category}</p>
            <p className="quiz-sheet-section-hint">{question.categoryHint}</p>
          </div>
        </div>

        <div className="quiz-sheet-section-content">
          <p className="quiz-sheet-question">{question.question}</p>
          <div className="quiz-tag-group">
            {question.options.map((opt) => {
              const active = answers[question.answerIndex] === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectOption(question.answerIndex, opt.key)}
                  className={`quiz-tag ${active ? "quiz-tag--active" : ""}`}
                >
                  {active && (
                    <Sparkles
                      size={11}
                      strokeWidth={2.2}
                      className="quiz-tag-spark"
                      aria-hidden
                    />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderRelationSection = () => {
    if (!relationQuestion) return null;
    const Sketch = STEP_SKETCHES.relation;
    const relationAnswerIndex = relationQuestion.answerIndex;
    const skippedOptional = canSubmit && !answers[relationAnswerIndex];

    return (
      <section key="relation" className="quiz-sheet-section quiz-sheet-section--relation">
        <div className="quiz-sheet-section-label">
          <span className="quiz-sheet-section-icon" aria-hidden>
            <Sketch />
          </span>
          <div>
            <p className="quiz-sheet-section-name">
              {relationQuestion.category}
              <span className="quiz-sheet-optional">可选</span>
            </p>
            <p className="quiz-sheet-section-hint">{relationQuestion.categoryHint}</p>
          </div>
        </div>

        <div className="quiz-sheet-section-content">
          <div className="quiz-sheet-question-row">
            <p className="quiz-sheet-question">{relationQuestion.question}</p>
            <button type="button" onClick={skipRelation} className="quiz-sheet-skip">
              跳过
            </button>
          </div>
          <div className="quiz-tag-group">
            {relationQuestion.options.map((opt) => {
              const active = answers[relationAnswerIndex] === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectOption(relationAnswerIndex, opt.key)}
                  className={`quiz-tag ${active ? "quiz-tag--active" : ""}`}
                >
                  {active && (
                    <Sparkles
                      size={11}
                      strokeWidth={2.2}
                      className="quiz-tag-spark"
                      aria-hidden
                    />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
          {skippedOptional && (
            <p className="quiz-sheet-relation-hint">已跳过，将按不限定对象匹配</p>
          )}
        </div>
      </section>
    );
  };

  return createPortal(
    <div className="quiz-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="quiz-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="文案偏好问卷"
      >
        <div className="quiz-sheet-handle" aria-hidden />

        <div className="quiz-sheet-header">
          <button
            type="button"
            onClick={onClose}
            className="quiz-sheet-close"
            aria-label="关闭"
          >
            <X size={18} strokeWidth={2} />
          </button>

          <div className="quiz-sheet-progress-track" aria-hidden>
            <div className="quiz-sheet-progress-fill" style={{ width: `${progress}%` }} />
            {progressSteps.map((step, index) => (
              <span
                key={step.id}
                className={`quiz-sheet-progress-node ${step.done ? "is-done" : ""} ${
                  step.optional && canSubmit && !step.done ? "is-skipped" : ""
                }`}
                style={{ left: `${((index + 1) / progressSteps.length) * 100}%` }}
              >
                {step.done ? <Check size={10} strokeWidth={3} /> : null}
              </span>
            ))}
          </div>

          <div className="quiz-sheet-title-row">
            <h2 className="quiz-sheet-title">帮我找一条合适的文案</h2>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/match-history");
              }}
              className="quiz-sheet-history-link"
            >
              匹配历史
            </button>
          </div>
          <p className="quiz-sheet-subtitle">
            {corpusStatus === "loading"
              ? "语料加载中…"
              : corpusStatus === "error"
                ? "语料不可用，暂无法匹配"
                : `5 步快速筛选 · 已完成 ${completedSteps}/${totalSteps}`}
          </p>
        </div>

        <div className="quiz-sheet-body hide-scrollbar">
          <section className="quiz-preset-section">
            <p className="quiz-preset-heading">懒人入口 · 点一下就能填好</p>
            <div className="quiz-preset-grid">
              {QUIZ_PRESET_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => applyPreset(card.id)}
                  className={`quiz-preset-card ${activePresetId === card.id ? "is-active" : ""}`}
                >
                  <span className="quiz-preset-card-label">{card.label}</span>
                  <span className="quiz-preset-card-sub">{card.subtitle}</span>
                </button>
              ))}
            </div>
          </section>

          {QUIZ_QUESTIONS.map((question) => renderQuestionSection(question))}
          {renderRelationSection()}
        </div>

        <div className="quiz-sheet-footer">
          {submitError && (
            <p className="mb-2 text-center text-[12px] text-[#E74C3C]">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || corpusStatus !== "ready"}
            className="quiz-sheet-submit"
          >
            {submitting ? "匹配中…" : "匹配文案"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
