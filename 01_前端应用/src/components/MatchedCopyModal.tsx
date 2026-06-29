import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import MatchCopyCard from "./MatchCopyCard";
import type { MatchedCopy } from "../data/matchQuery";
import {
  CORPUS_COPY_REMOVED_EVENT,
  type CorpusCopyRemovedDetail,
} from "../services/chatchat/corpusRemoval";

interface MatchedCopyModalProps {
  open: boolean;
  onClose: () => void;
  quotes: MatchedCopy[];
  subtitle?: string;
  loading?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshDisabled?: boolean;
  refreshHint?: string;
  showHistoryLink?: boolean;
}

export default function MatchedCopyModal({
  open,
  onClose,
  quotes,
  subtitle = "根据你的偏好精心挑选 3 条",
  loading = false,
  onRefresh,
  refreshLabel = "重新匹配",
  refreshDisabled = false,
  refreshHint,
  showHistoryLink = true,
}: MatchedCopyModalProps) {
  const navigate = useNavigate();
  const [listKey, setListKey] = useState(0);
  const [visibleQuotes, setVisibleQuotes] = useState(quotes);

  useEffect(() => {
    setVisibleQuotes(quotes);
  }, [quotes]);

  useEffect(() => {
    if (!open) return;
    setListKey((key) => key + 1);
  }, [open, visibleQuotes]);

  useEffect(() => {
    const onRemoved = (event: Event) => {
      const detail = (event as CustomEvent<CorpusCopyRemovedDetail>).detail;
      if (!detail?.text) return;
      setVisibleQuotes((prev) => prev.filter((q) => q.text !== detail.text));
    };
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="quiz-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="quiz-sheet quiz-results-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="匹配结果"
      >
        <div className="quiz-sheet-handle" aria-hidden />

        <div className="quiz-sheet-header quiz-results-sheet-header">
          <button
            type="button"
            onClick={onClose}
            className="quiz-sheet-close"
            aria-label="关闭"
          >
            <X size={18} strokeWidth={2} />
          </button>

          <div className="quiz-sheet-title-row">
            <h2 className="quiz-sheet-title">为你匹配的文案</h2>
            {showHistoryLink && (
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
            )}
          </div>
          <p className="quiz-sheet-subtitle">{subtitle}</p>
          {refreshHint && onRefresh && (
            <p className="mt-1 text-[11px] text-ink-light">{refreshHint}</p>
          )}
        </div>

        <div className="quiz-sheet-body hide-scrollbar">
          <div
            className={`quiz-results-shuffle-bar ${loading ? "is-active" : ""}`}
            aria-hidden={!loading}
          >
            <div className="quiz-results-shuffle-bar-fill" />
          </div>

          <div className={`quiz-results-list ${loading ? "is-shuffling" : ""}`}>
            {visibleQuotes.map((quote, index) => (
              <div key={`${listKey}-${quote.id}`} className="quiz-result-item">
                <MatchCopyCard
                  text={quote.text}
                  matchPercent={quote.matchPercent}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>

        {onRefresh && (
          <div className="quiz-sheet-footer">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || refreshDisabled}
              className="quiz-sheet-submit"
            >
              {loading ? "匹配中…" : refreshLabel}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
