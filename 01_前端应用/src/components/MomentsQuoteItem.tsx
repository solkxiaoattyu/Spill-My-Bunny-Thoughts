import { memo, useState } from "react";
import AppAvatar from "./AppAvatar";
import MomentsPreviewModal from "./MomentsPreviewModal";
import QuoteActionBar from "./QuoteActionBar";
import { IS_TEST_BUILD } from "../data/appVersion";
import { getViewerDisplayName } from "../data/brand";
import { recordBrowseHistory } from "../data/matchQuery";
import { formatMomentsDisplayText, formatMomentsTime } from "../data/quotes";
import { useQuoteActions } from "../hooks/useQuoteActions";
import QuoteTranslation from "./QuoteTranslation";

export interface MomentsQuoteItemProps {
  id?: string;
  displayName: string;
  text: string;
  timestamp?: Date | string;
  defaultLiked?: boolean;
  card?: boolean;
  stackFooter?: boolean;
  className?: string;
}

function MomentsQuoteItem({
  displayName,
  text,
  timestamp,
  defaultLiked = false,
  card = true,
  stackFooter = false,
  className = "",
}: MomentsQuoteItemProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { liked, disliked, copied, removed, handleLike, handleDislike, handleCopy } = useQuoteActions(text, {
    initialLiked: defaultLiked,
  });

  if (removed) return null;

  const timeLabel =
    typeof timestamp === "string"
      ? timestamp
      : formatMomentsTime(timestamp ?? new Date());

  const displayText = formatMomentsDisplayText(text);

  const handlePreview = () => {
    recordBrowseHistory(text);
    setPreviewOpen(true);
  };

  const content = (
    <article className="flex gap-3">
      <AppAvatar size="sm" radius="sm" />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-link">
          {displayName}
        </p>
        <div className="moments-quote-body mt-2.5">
          <p
            className="moments-quote-text cursor-pointer transition-opacity active:opacity-75"
            onClick={handlePreview}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handlePreview();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="朋友圈预览"
          >
            {displayText}
          </p>
          <QuoteTranslation text={text} />
        </div>

        <div
          className={`flex items-center justify-between gap-3${
            stackFooter ? " stack-card-footer" : " mt-2.5"
          }`}
        >
          <time className="shrink-0 text-[11px] text-ink-light" dateTime={timeLabel}>
            {timeLabel}
          </time>

          <QuoteActionBar
            liked={liked}
            disliked={disliked}
            copied={copied}
            onLike={handleLike}
            onDislike={handleDislike}
            onPreview={handlePreview}
            onCopy={handleCopy}
            dislikeLabel={IS_TEST_BUILD ? "不开心，从语料库移除" : "一般"}
          />
        </div>
      </div>
    </article>
  );

  if (!card) {
    return (
      <>
        <div className={`py-4 ${className}`}>{content}</div>
        <MomentsPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          text={text}
          displayName={getViewerDisplayName()}
        />
      </>
    );
  }

  return (
    <>
      <div className={`paper-card rounded-[20px] px-4 py-4 ${className}`}>{content}</div>
      <MomentsPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        text={text}
        displayName={getViewerDisplayName()}
      />
    </>
  );
}

export default memo(MomentsQuoteItem);
