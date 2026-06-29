import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HistoryQuoteCard from "../components/HistoryQuoteCard";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import MomentsPreviewModal from "../components/MomentsPreviewModal";
import {
  isFavoriteCopy,
  loadBrowseHistory,
  type BrowseHistoryEntry,
} from "../data/matchQuery";

function viewerDisplayName() {
  return getViewerDisplayName();
}

export default function BrowseHistory() {
  const navigate = useNavigate();
  const displayName = viewerDisplayName();
  const [history, setHistory] = useState(() => loadBrowseHistory());
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(loadBrowseHistory().map((item) => [item.text, isFavoriteCopy(item.text)])),
  );

  const refresh = useCallback(() => {
    const entries = loadBrowseHistory();
    setHistory(entries);
    setFavoriteMap(Object.fromEntries(entries.map((item) => [item.text, isFavoriteCopy(item.text)])));
  }, []);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const handleFavoriteChange = () => {
    setFavoriteMap((prev) => {
      const next = { ...prev };
      for (const item of history) {
        next[item.text] = isFavoriteCopy(item.text);
      }
      return next;
    });
  };

  const goToRecommend = () => {
    navigate("/home", { state: { focusRecommend: true } });
  };

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
          <h1 className="text-sm font-medium text-[#111]">浏览历史</h1>
        </div>
        {history.length > 0 && (
          <span className="history-page-count">{history.length} 条</span>
        )}
      </header>

      <div className="history-page-body">
        {history.length === 0 ? (
          <div className="profile-empty-inline">
            <p>还没有浏览过文案</p>
            <button type="button" onClick={goToRecommend} className="profile-favorite-empty-link">
              去看看今日推荐
            </button>
          </div>
        ) : (
          <div className="history-page-list">
            {history.map((item: BrowseHistoryEntry) => (
              <HistoryQuoteCard
                key={item.text}
                text={item.text}
                tagLabel={item.tagLabel}
                meta={item.viewedAt}
                initialLiked={favoriteMap[item.text] ?? false}
                onPreview={() => setPreviewText(item.text)}
                onFavoriteChange={handleFavoriteChange}
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
