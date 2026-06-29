import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HistoryQuoteCard from "../components/HistoryQuoteCard";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import MomentsPreviewModal from "../components/MomentsPreviewModal";
import {
  loadMatchHistory,
  type MatchHistoryEntry,
} from "../data/matchHistory";

function viewerDisplayName() {
  return getViewerDisplayName();
}

function MatchHistoryGroup({
  entry,
  onPreview,
}: {
  entry: MatchHistoryEntry;
  onPreview: (text: string) => void;
}) {
  return (
    <section className="history-session-group">
      <div className="match-history-group-head">
        <div className="min-w-0">
          <p className="match-history-group-label">
            {entry.type === "quiz" ? "快速匹配" : "需求匹配"}
          </p>
          <h2 className="match-history-group-title">{entry.label}</h2>
        </div>
        <span className="match-history-group-date">{entry.matchedAt}</span>
      </div>

      <div className="history-page-list">
        {entry.quotes.map((quote) => (
          <HistoryQuoteCard
            key={quote.text}
            text={quote.text}
            tagLabel={quote.tagLabel}
            matchPercent={quote.matchPercent}
            onPreview={() => onPreview(quote.text)}
          />
        ))}
      </div>
    </section>
  );
}

export default function MatchHistory() {
  const navigate = useNavigate();
  const displayName = viewerDisplayName();
  const [history, setHistory] = useState(() => loadMatchHistory());
  const [previewText, setPreviewText] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setHistory(loadMatchHistory());
  }, []);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const goToQuiz = () => navigate("/quiz");

  return (
    <PageShell bare>
      <header className="history-page-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="history-page-back"
          aria-label="返回"
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
        <div className="history-page-heading">
          <p className="text-[10px] tracking-[0.2em] text-ink-light/70">记录</p>
          <h1 className="text-sm font-medium text-[#111]">匹配历史</h1>
        </div>
        {history.length > 0 && (
          <span className="history-page-count">{history.length} 次</span>
        )}
      </header>

      <div className="history-page-body">
        {history.length === 0 ? (
          <div className="profile-empty-inline">
            <p>还没有匹配过文案</p>
            <button type="button" onClick={goToQuiz} className="profile-favorite-empty-link">
              去快速匹配
            </button>
          </div>
        ) : (
          <div className="match-history-list">
            {history.map((entry) => (
              <MatchHistoryGroup
                key={entry.id}
                entry={entry}
                onPreview={setPreviewText}
              />
            ))}
          </div>
        )}
      </div>

      <MomentsPreviewModal
        open={previewText !== null}
        onClose={() => setPreviewText(null)}
        text={previewText ?? ""}
        displayName={displayName}
      />
    </PageShell>
  );
}
