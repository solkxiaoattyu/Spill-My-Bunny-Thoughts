import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCorpusCount, loadCorpus } from "../services/chatchat/corpus";
import { loadCorpusIndex } from "../services/chatchat/corpusIndex";
import { CORPUS_COPY_REMOVED_EVENT } from "../services/chatchat/corpusRemoval";

type CorpusStatus = "loading" | "ready" | "error";

interface CorpusContextValue {
  status: CorpusStatus;
  error: string | null;
  count: number;
  /** 向量索引是否已就绪（失败不阻塞主语料，仅降级语义匹配） */
  indexReady: boolean;
}

const CorpusContext = createContext<CorpusContextValue>({
  status: "loading",
  error: null,
  count: 0,
  indexReady: false,
});

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CorpusStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [indexReady, setIndexReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadCorpus()
      .then((corpus) => {
        if (cancelled) return;
        setCount(corpus.length);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "语料加载失败");
        setStatus("error");
      });

    loadCorpusIndex()
      .then(() => {
        if (!cancelled) setIndexReady(true);
      })
      .catch((err: Error) => {
        console.warn("[Corpus] 向量索引加载失败，将使用标签匹配:", err.message);
        if (!cancelled) setIndexReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshCount = () => setCount(getCorpusCount());
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, refreshCount);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, refreshCount);
  }, []);

  return (
    <CorpusContext.Provider
      value={{ status, error, count: count || getCorpusCount(), indexReady }}
    >
      {children}
    </CorpusContext.Provider>
  );
}

export function useCorpus() {
  return useContext(CorpusContext);
}
