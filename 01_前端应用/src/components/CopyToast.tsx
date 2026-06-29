import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COPY_SUCCESS_EVENT, REDUCE_RECOMMEND_EVENT } from "../data/matchQuery";
import { CORPUS_COPY_REMOVED_EVENT, type CorpusCopyRemovedDetail } from "../services/chatchat/corpusRemoval";

const TOAST_MESSAGES: Record<string, string> = {
  [COPY_SUCCESS_EVENT]: "复制成功",
  [REDUCE_RECOMMEND_EVENT]: "减少类似的推荐",
};

export default function CopyToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      let text = TOAST_MESSAGES[event.type];
      if (event.type === CORPUS_COPY_REMOVED_EVENT) {
        const detail = (event as CustomEvent<CorpusCopyRemovedDetail>).detail;
        text = detail?.persisted ? "已从语料库永久移除" : "已从当前列表移除";
      }
      if (!text) return;

      setMessage(text);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setMessage(null), 1800);
    };

    window.addEventListener(COPY_SUCCESS_EVENT, show);
    window.addEventListener(REDUCE_RECOMMEND_EVENT, show);
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, show);
    return () => {
      window.removeEventListener(COPY_SUCCESS_EVENT, show);
      window.removeEventListener(REDUCE_RECOMMEND_EVENT, show);
      window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, show);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!message) return null;

  return createPortal(
    <div className="copy-toast" role="status" aria-live="polite">
      {message}
    </div>,
    document.body,
  );
}
