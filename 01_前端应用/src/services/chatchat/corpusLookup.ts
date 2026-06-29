import { getCorpus, isCorpusReady } from "./corpus";
import { formatTagLabels } from "./labels";
import type { CorpusCopy } from "./types";

function normalizeText(text: string): string {
  return text.replace(/\n/g, " ").trim();
}

export function findCopyByText(text: string): CorpusCopy | undefined {
  if (!isCorpusReady()) return undefined;
  const normalized = normalizeText(text);
  if (!normalized) return undefined;

  const corpus = getCorpus();
  const exact = corpus.find((copy) => normalizeText(copy.text) === normalized);
  if (exact) return exact;

  return corpus.find((copy) => {
    const copyText = normalizeText(copy.text);
    return copyText.includes(normalized) || normalized.includes(copyText);
  });
}

export function getCopyTagLabel(text: string): string {
  const copy = findCopyByText(text);
  return copy ? formatTagLabels(copy.tags) : "";
}

export function resolveTagLabel(text: string, stored?: string): string {
  return stored || getCopyTagLabel(text) || "";
}
