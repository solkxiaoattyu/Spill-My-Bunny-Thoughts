import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HistoryQuoteCard from "../components/HistoryQuoteCard";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import MomentsPreviewModal from "../components/MomentsPreviewModal";
import {
  loadFavoriteEntries,
  type FavoriteCopy,
} from "../data/matchQuery";

function viewerDisplayName() {
  return getViewerDisplayName();
}

export default function Favorites() {
  const navigate = useNavigate();
  const displayName = viewerDisplayName();
  const [favorites, setFavorites] = useState(() => loadFavoriteEntries());
  const [previewText, setPreviewText] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setFavorites(loadFavoriteEntries());
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
          <h1 className="text-sm font-medium text-[#111]">我的收藏</h1>
        </div>
        {favorites.length > 0 && (
          <span className="history-page-count">{favorites.length} 条</span>
        )}
      </header>

      <div className="history-page-body">
        {favorites.length === 0 ? (
          <div className="profile-empty-inline">
            <p>还没有收藏过文案</p>
            <button type="button" onClick={goToRecommend} className="profile-favorite-empty-link">
              去看看今日推荐
            </button>
          </div>
        ) : (
          <div className="history-page-list">
            {favorites.map((item: FavoriteCopy) => (
              <HistoryQuoteCard
                key={item.text}
                text={item.text}
                meta={item.savedAt}
                initialLiked
                onPreview={() => setPreviewText(item.text)}
                onFavoriteChange={refresh}
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
