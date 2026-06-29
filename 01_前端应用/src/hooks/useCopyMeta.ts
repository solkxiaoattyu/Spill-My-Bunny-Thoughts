import { useMemo } from "react";
import { useCorpus } from "../context/CorpusContext";
import { getCopyTagLabel, resolveTagLabel } from "../services/chatchat/corpusLookup";

export function useCopyMeta(text: string, storedTagLabel?: string) {
  const { status } = useCorpus();

  return useMemo(() => {
    if (status !== "ready") {
      return { tagLabel: storedTagLabel ?? "", ready: false };
    }
    return {
      tagLabel: resolveTagLabel(text, storedTagLabel),
      ready: true,
    };
  }, [text, storedTagLabel, status]);
}

export function useCopyTagLabel(text: string) {
  const { status } = useCorpus();
  return useMemo(() => (status === "ready" ? getCopyTagLabel(text) : ""), [text, status]);
}
