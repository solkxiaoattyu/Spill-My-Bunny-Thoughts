import { useEffect } from "react";
import { IS_TEST_BUILD } from "../data/appVersion";
import CopyTagBadge from "./CopyTagBadge";
import QuoteActionBar from "./QuoteActionBar";
import { formatMomentsDisplayText } from "../data/quotes";
import { useCopyMeta } from "../hooks/useCopyMeta";
import { useQuoteActions } from "../hooks/useQuoteActions";
import QuoteTranslation from "./QuoteTranslation";

export interface HistoryQuoteCardProps {
  text: string;
  tagLabel?: string;
  matchPercent?: number;
  meta?: React.ReactNode;
  initialLiked?: boolean;
  onPreview: () => void;
  onFavoriteChange?: () => void;
}

export default function HistoryQuoteCard({
  text,
  tagLabel: tagLabelProp,
  matchPercent,
  meta,
  initialLiked,
  onPreview,
  onFavoriteChange,
}: HistoryQuoteCardProps) {
  const { tagLabel } = useCopyMeta(text, tagLabelProp);
  const { liked, disliked, copied, removed, handleLike, handleDislike, handleCopy, setLiked } =
    useQuoteActions(text, { initialLiked });

  useEffect(() => {
    if (initialLiked !== undefined) {
      setLiked(initialLiked);
    }
  }, [initialLiked, setLiked]);

  if (removed) return null;

  const handleLikeClick = () => {
    handleLike();
    onFavoriteChange?.();
  };

  return (
    <article className="profile-favorite-card paper-card">
      <CopyTagBadge tagLabel={tagLabel} matchPercent={matchPercent} className="mb-2" />
      <button
        type="button"
        onClick={onPreview}
        className="profile-favorite-card-text profile-favorite-card-text--preview moments-quote-text"
        aria-label="朋友圈预览"
      >
        {formatMomentsDisplayText(text)}
      </button>
      <QuoteTranslation text={text} className="px-0.5" />
      <div className="profile-favorite-card-meta">
        {meta ?? <span aria-hidden />}
        <QuoteActionBar
          liked={liked}
          disliked={disliked}
          copied={copied}
          onLike={handleLikeClick}
          onDislike={handleDislike}
          onPreview={onPreview}
          onCopy={handleCopy}
          dislikeLabel={IS_TEST_BUILD ? "不开心，从语料库移除" : "一般"}
        />
      </div>
    </article>
  );
}
