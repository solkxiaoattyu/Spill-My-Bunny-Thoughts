import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HistoryQuoteCard from "../components/HistoryQuoteCard";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import MomentsPreviewModal from "../components/MomentsPreviewModal";
import {
  loadRandomPickHistory,
  type RandomPickHistoryEntry,
} from "../data/randomPickHistory";

function viewerDisplayName() {
  return getViewerDisplayName();
}

function DrawHistoryGroup({
  entry,
  onPreview,
}: {
  entry: RandomPickHistoryEntry;
  onPreview: (text: string) => void;
}) {
  return (
    <section className="history-session-group">
      <div className="match-history-group-head match-history-group-head--compact">
        <p className="match-history-group-label">随机抽取</p>
        <span className="match-history-group-date">{entry.drawnAt}</span>
      </div>

      <div className="history-page-list">
        {entry.quotes.map((text) => (
          <HistoryQuoteCard
            key={text}
            text={text}
            onPreview={() => onPreview(text)}
          />
        ))}
      </div>
    </section>
  );
}

export default function DrawHistory() {
  const navigate = useNavigate();
  const displayName = viewerDisplayName();
  const [history, setHistory] = useState(() => loadRandomPickHistory());
  const [previewText, setPreviewText] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setHistory(loadRandomPickHistory());
  }, []);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const goToRandom = () => navigate("/home");

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
          <div className="history-page-title-row">
            <h1 className="text-sm font-medium text-[#111]">抽取历史</h1>
            <span className="history-page-subtitle">一次抽取 3 条</span>
          </div>
        </div>
        {history.length > 0 && (
          <span className="history-page-count">{history.length} 次</span>
        )}
      </header>

      <div className="history-page-body">
        {history.length === 0 ? (
          <div className="profile-empty-inline">
            <p>还没有抽取记录</p>
            <button type="button" onClick={goToRandom} className="profile-favorite-empty-link">
              去随机抽取
            </button>
          </div>
        ) : (
          <div className="match-history-list">
            {history.map((entry) => (
              <DrawHistoryGroup
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
