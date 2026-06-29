import { Check, Copy, Eye, Meh, Star } from "lucide-react";

const ICON_SIZE = 15;
const ICON_STROKE = 1.8;

export interface QuoteActionBarProps {
  liked?: boolean;
  disliked?: boolean;
  copied?: boolean;
  onLike: () => void;
  onDislike: () => void;
  onPreview: () => void;
  onCopy: () => void;
  className?: string;
  /** 测试版可将「一般」改为「不开心」等文案 */
  dislikeLabel?: string;
}

export default function QuoteActionBar({
  liked = false,
  disliked = false,
  copied = false,
  onLike,
  onDislike,
  onPreview,
  onCopy,
  className = "",
  dislikeLabel = "一般",
}: QuoteActionBarProps) {
  return (
    <div className={`quote-action-bar ${className}`.trim()}>
      <button
        type="button"
        onClick={onLike}
        className={`quote-action-btn ${liked ? "is-favorited" : ""}`}
        aria-label={liked ? "取消收藏" : "收藏"}
      >
        <Star size={ICON_SIZE} strokeWidth={ICON_STROKE} fill={liked ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={onDislike}
        className={`quote-action-btn ${disliked ? "is-disliked" : ""}`}
        aria-label={disliked ? "已标记不开心" : dislikeLabel}
      >
        <Meh size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="quote-action-btn"
        aria-label="预览"
      >
        <Eye size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </button>
      <button
        type="button"
        onClick={onCopy}
        className={`quote-action-btn ${copied ? "is-copied" : ""}`}
        aria-label={copied ? "已复制" : "复制"}
      >
        {copied ? (
          <Check size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
        ) : (
          <Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
        )}
      </button>
    </div>
  );
}
