import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCorpusCount, loadCorpus } from "../services/chatchat/corpus";
import { loadCorpusIndex } from "../services/chatchat/corpusIndex";
import { CORPUS_COPY_REMOVED_EVENT } from "../services/chatchat/corpusRemoval";

type CorpusStatus = "loading" | "ready" | "error";

interface CorpusContextValue {
  status: CorpusStatus;
  error: string | null;
  count: number;
}

const CorpusContext = createContext<CorpusContextValue>({
  status: "loading",
  error: null,
  count: 0,
});

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CorpusStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    Promise.all([loadCorpus(), loadCorpusIndex()])
      .then(([corpus]) => {
        setCount(corpus.length);
        setStatus("ready");
      })
      .catch((err: Error) => {
        setError(err.message || "语料加载失败");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    const refreshCount = () => setCount(getCorpusCount());
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, refreshCount);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, refreshCount);
  }, []);

  return (
    <CorpusContext.Provider value={{ status, error, count: count || getCorpusCount() }}>
      {children}
    </CorpusContext.Provider>
  );
}

export function useCorpus() {
  return useContext(CorpusContext);
}
