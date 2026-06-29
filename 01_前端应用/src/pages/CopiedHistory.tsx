import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HistoryQuoteCard from "../components/HistoryQuoteCard";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import MomentsPreviewModal from "../components/MomentsPreviewModal";
import {
  loadCopiedEntries,
  type CopiedCopy,
} from "../data/matchQuery";

function viewerDisplayName() {
  return getViewerDisplayName();
}

export default function CopiedHistory() {
  const navigate = useNavigate();
  const displayName = viewerDisplayName();
  const [copied, setCopied] = useState(() => loadCopiedEntries());
  const [previewText, setPreviewText] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setCopied(loadCopiedEntries());
  }, []);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const goToRecommend = () => navigate("/home");

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
          <h1 className="text-sm font-medium text-[#111]">复制记录</h1>
        </div>
        {copied.length > 0 && (
          <span className="history-page-count">{copied.length} 条</span>
        )}
      </header>

      <div className="history-page-body">
        {copied.length === 0 ? (
          <div className="profile-empty-inline">
            <p>还没有复制过文案</p>
            <button type="button" onClick={goToRecommend} className="profile-favorite-empty-link">
              去看看今日推荐
            </button>
          </div>
        ) : (
          <div className="history-page-list">
            {copied.map((item: CopiedCopy) => (
              <HistoryQuoteCard
                key={`${item.text}-${item.copiedAt}`}
                text={item.text}
                meta={item.copiedAt}
                onPreview={() => setPreviewText(item.text)}
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
