import { useState } from "react";
import {
  hasForeignContent,
  translateQuoteToChinese,
  usesSemanticTranslation,
} from "../data/quoteTranslate";

interface QuoteTranslationProps {
  text: string;
  className?: string;
}

export default function QuoteTranslation({ text, className = "" }: QuoteTranslationProps) {
  const [open, setOpen] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasForeignContent(text)) return null;

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    if (translation) return;

    setLoading(true);
    setError(null);
    try {
      const result = await translateQuoteToChinese(text);
      setTranslation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "翻译失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`quote-translate-block ${className}`.trim()}>
      <button
        type="button"
        className="quote-translate-btn"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={open ? "收起翻译" : "查看中文翻译"}
      >
        {open ? "收起译意" : usesSemanticTranslation() ? "译意" : "翻译"}
      </button>
      {open ? (
        <p className="quote-translation-text" aria-live="polite">
          {loading
            ? usesSemanticTranslation()
              ? "理解译意中…"
              : "翻译中…"
            : error ?? translation ?? "暂无翻译结果"}
        </p>
      ) : null}
    </div>
  );
}
