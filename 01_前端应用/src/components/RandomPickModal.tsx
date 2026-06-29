import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import GiftBoxShake from "./GiftBoxShake";
import MatchCopyCard from "./MatchCopyCard";
import { useCorpus } from "../context/CorpusContext";
import { recordRandomPickHistory } from "../data/randomPickHistory";
import {
  pickRandomDrawItemsByIds,
  RANDOM_PICK_SESSION_KEY,
} from "../services/chatchat/dailyRecommend";
import {
  commitMatchBatch,
  getRefreshRemaining,
  loadMatchRefreshSession,
  saveMatchRefreshSession,
} from "../services/chatchat/matchSession";
import {
  CORPUS_COPY_REMOVED_EVENT,
  type CorpusCopyRemovedDetail,
} from "../services/chatchat/corpusRemoval";

interface RandomPickModalProps {
  open: boolean;
  onClose: () => void;
}

interface DrawnQuote {
  id: string;
  text: string;
  displayName: string;
}

const REDRAW_MS = 650;
const RANDOM_SESSION_KEY = "random";

function createDrawn(item: { id: string; text: string; displayName: string }, index: number): DrawnQuote {
  return { id: `${item.id}-${index}`, text: item.text, displayName: item.displayName };
}

function pickBatch(excludeIds: number[]) {
  return pickRandomDrawItemsByIds(excludeIds).map((item, index) => createDrawn(item, index));
}

export default function RandomPickModal({ open, onClose }: RandomPickModalProps) {
  const { status } = useCorpus();
  const [phase, setPhase] = useState<"shake" | "results">("shake");
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState<DrawnQuote[]>([]);
  const [refreshRemaining, setRefreshRemaining] = useState(5);
  const [listKey, setListKey] = useState(0);
  const pendingQuotes = useRef<DrawnQuote[]>([]);

  const finishShake = useCallback(() => {
    setPhase("results");
    recordRandomPickHistory(pendingQuotes.current.map((item) => item.text));
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase("shake");
      setDrawing(false);
      return;
    }
    if (status !== "ready") return;

    const session = loadMatchRefreshSession(RANDOM_PICK_SESSION_KEY, RANDOM_SESSION_KEY);
    const initial = pickBatch(session.shownIds);
    pendingQuotes.current = initial;
    setDrawing(false);
    setDrawn(initial);
    setRefreshRemaining(getRefreshRemaining(session));
    setListKey((key) => key + 1);
    setPhase("shake");

    const newIds = initial.map((item) => Number(item.id.split("-")[0]));
    const nextSession = commitMatchBatch(session, newIds, false);
    saveMatchRefreshSession(RANDOM_PICK_SESSION_KEY, nextSession);
    setRefreshRemaining(getRefreshRemaining(nextSession));
  }, [open, status]);

  useEffect(() => {
    if (!open || phase !== "results") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, phase, onClose]);

  useEffect(() => {
    const onRemoved = (event: Event) => {
      const detail = (event as CustomEvent<CorpusCopyRemovedDetail>).detail;
      if (!detail?.text) return;
      setDrawn((prev) => prev.filter((q) => q.text !== detail.text));
    };
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
  }, []);

  const redraw = useCallback(() => {
    setDrawing(true);
    window.setTimeout(() => {
      let session = loadMatchRefreshSession(RANDOM_PICK_SESSION_KEY, RANDOM_SESSION_KEY);
      if (session.refreshCount >= 5) {
        session = { sessionKey: RANDOM_SESSION_KEY, shownIds: [], refreshCount: 0 };
      }

      const next = pickBatch(session.shownIds);
      const newIds = next.map((item) => Number(item.id.split("-")[0]));
      session = commitMatchBatch(session, newIds, true);
      saveMatchRefreshSession(RANDOM_PICK_SESSION_KEY, session);

      setDrawn(next);
      setRefreshRemaining(getRefreshRemaining(session));
      setListKey((key) => key + 1);
      recordRandomPickHistory(next.map((item) => item.text));
      setDrawing(false);
    }, REDRAW_MS);
  }, []);

  if (!open) return null;

  if (status === "loading") {
    return createPortal(
      <div className="gift-shake-overlay" onClick={onClose} role="presentation">
        <p className="text-center text-white text-[14px] py-20">正在加载语料库…</p>
      </div>,
      document.body,
    );
  }

  if (status === "error") {
    return createPortal(
      <div className="gift-shake-overlay" onClick={onClose} role="presentation">
        <p className="text-center text-white text-[14px] py-20">语料加载失败，无法抽取</p>
      </div>,
      document.body,
    );
  }

  if (phase === "shake") {
    return createPortal(
      <div className="gift-shake-overlay" onClick={onClose} role="presentation">
        <div onClick={(event) => event.stopPropagation()}>
          <GiftBoxShake label="正在抽取…" onComplete={finishShake} />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="quiz-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="quiz-sheet quiz-results-sheet random-pick-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="随机抽取"
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

          <h2 className="quiz-sheet-title">为你抽到了这三句</h2>
          <p className="quiz-sheet-subtitle">从 4700+ 条真实语料中随机挑选</p>
          <p className="mt-1 text-[11px] text-ink-light">
            {refreshRemaining > 0
              ? `还可再抽 ${refreshRemaining} 批（每批 3 条不重复）`
              : "已抽满 5 批，再次点击将重新开始"}
          </p>
        </div>

        <div className="quiz-sheet-body hide-scrollbar">
          <div
            className={`quiz-results-shuffle-bar ${drawing ? "is-active" : ""}`}
            aria-hidden={!drawing}
          >
            <div className="quiz-results-shuffle-bar-fill" />
          </div>

          <div className={`quiz-results-list ${drawing ? "is-shuffling" : ""}`}>
            {drawn.map((quote, index) => (
              <div key={`${listKey}-${quote.text}`} className="quiz-result-item">
                <MatchCopyCard
                  text={quote.text}
                  tagLabel={quote.displayName}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="quiz-sheet-footer">
          <button
            type="button"
            onClick={redraw}
            disabled={drawing}
            className="quiz-sheet-submit"
          >
            {drawing ? "抽取中…" : refreshRemaining > 0 ? "再抽一批" : "重新开始抽"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
