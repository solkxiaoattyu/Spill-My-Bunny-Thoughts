import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import AppAvatar from "./AppAvatar";
import { formatMomentsDisplayText } from "../data/quotes";
import { MOMENTS_PREVIEW_PHOTOS } from "../data/momentsPreviewPhotos";
import { copyTextToClipboard } from "../data/matchQuery";
import QuoteTranslation from "./QuoteTranslation";

interface MomentsPreviewModalProps {
  open: boolean;
  onClose: () => void;
  text: string;
  displayName: string;
}

function FriendsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#b2b2b2]" aria-hidden>
      <circle cx="5.5" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M2 13c0-2 1.6-3.5 3.5-3.5S9 11 9 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="11" cy="6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d="M9 13c0-1.5 1.2-2.8 2.8-2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#b2b2b2]" aria-hidden>
      <path
        d="M4 5h8M6 5V4h4v1M6 7v4M8 7v4M10 7v4M5 5l.5 7h5l.5-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotMenuButton() {
  return (
    <div className="moments-preview-dots" aria-hidden>
      <span />
      <span />
    </div>
  );
}

export default function MomentsPreviewModal({
  open,
  onClose,
  text,
  displayName,
}: MomentsPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    await copyTextToClipboard(text);
    onClose();
  };

  return createPortal(
    <div className="moments-preview-float-wrap" onClick={onClose} role="presentation">
      <div className="moments-preview-shell" onClick={(event) => event.stopPropagation()}>
        <div
          className="moments-preview-float hide-scrollbar"
          role="dialog"
          aria-modal="true"
          aria-label="朋友圈预览"
        >
          <article className="moments-preview-feed">
            <AppAvatar size="sm" radius="sm" className="moments-preview-feed-avatar" />

            <div className="moments-preview-feed-body">
              <p className="moments-preview-feed-name">{displayName}</p>
              <p className="moments-preview-feed-text">{formatMomentsDisplayText(text)}</p>
              <QuoteTranslation text={text} />

              <div className="moments-preview-photos" aria-hidden>
                {MOMENTS_PREVIEW_PHOTOS.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" decoding="async" />
                ))}
              </div>

              <div className="moments-preview-feed-meta">
                <div className="moments-preview-feed-meta-left">
                  <span>1分钟前</span>
                  <FriendsIcon />
                  <TrashIcon />
                </div>
                <DotMenuButton />
              </div>

              <div className="moments-preview-like">
                <Star
                  className="moments-preview-like-star"
                  size={14}
                  strokeWidth={1.8}
                  fill="currentColor"
                  aria-hidden
                />
                <span className="moments-preview-like-names">你</span>
              </div>
            </div>
          </article>

          <div className="moments-preview-float-actions">
            <button type="button" onClick={onClose} className="moments-preview-float-link">
              关闭
            </button>
            <span className="text-[#e5e5e5]">|</span>
            <button type="button" onClick={handleCopy} className="moments-preview-float-link">
              复制
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
