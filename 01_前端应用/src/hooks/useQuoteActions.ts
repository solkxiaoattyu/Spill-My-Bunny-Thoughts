import { useCallback, useState } from "react";
import { IS_TEST_BUILD } from "../data/appVersion";
import {
  copyTextToClipboard,
  isFavoriteCopy,
  notifyReduceRecommend,
  toggleFavoriteCopy,
} from "../data/matchQuery";
import { removeCorpusCopyByText } from "../services/chatchat/corpusRemoval";

interface UseQuoteActionsOptions {
  initialLiked?: boolean;
}

export function useQuoteActions(text: string, options: UseQuoteActionsOptions = {}) {
  const [liked, setLiked] = useState(
    () => options.initialLiked ?? isFavoriteCopy(text),
  );
  const [disliked, setDisliked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removed, setRemoved] = useState(false);

  const handleLike = useCallback(() => {
    const next = toggleFavoriteCopy(text);
    setLiked(next);
    if (next) setDisliked(false);
  }, [text]);

  const handleDislike = useCallback(() => {
    setDisliked((prev) => {
      const next = !prev;
      if (next) {
        if (isFavoriteCopy(text)) toggleFavoriteCopy(text);
        setLiked(false);
        if (IS_TEST_BUILD) {
          void removeCorpusCopyByText(text).then((ok) => {
            if (ok) setRemoved(true);
          });
        } else {
          notifyReduceRecommend();
        }
      }
      return next;
    });
  }, [text]);

  const handleCopy = useCallback(async () => {
    await copyTextToClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return {
    liked,
    disliked,
    copied,
    removed,
    handleLike,
    handleDislike,
    handleCopy,
    setLiked,
  };
}
