import { IS_TEST_BUILD } from "../../data/appVersion";
import { refreshCorpusAfterRemoval, removeCopyFromCache } from "./corpus";
import { findCopyByText } from "./corpusLookup";
import { addTestRemovedId, getTestRemovedIds, syncTestRemovedIds } from "./corpusTestIds";

export { TEST_REMOVED_IDS_KEY, getTestRemovedIds, getTestRemovedCount } from "./corpusTestIds";

export const CORPUS_COPY_REMOVED_EVENT = "yourword-corpus-copy-removed";

export interface CorpusCopyRemovedDetail {
  id: number;
  text: string;
  persisted?: boolean;
}

async function persistRemovalToServer(id: number): Promise<boolean> {
  try {
    const res = await fetch("/api/test/corpus/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return false;
    const payload = (await res.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

function emitRemoved(id: number, text: string, persisted: boolean) {
  window.dispatchEvent(
    new CustomEvent<CorpusCopyRemovedDetail>(CORPUS_COPY_REMOVED_EVENT, {
      detail: { id, text, persisted },
    }),
  );
}

/** 测试版：点「不开心」后永久剔除语料（写回源 JSON + manifest，并更新本地缓存） */
export async function removeCorpusCopyByText(text: string): Promise<boolean> {
  if (!IS_TEST_BUILD) return false;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return false;

  const copy = findCopyByText(normalized);
  if (!copy) return false;

  return removeCorpusCopyById(copy.id, normalized);
}

export async function removeCorpusCopyById(id: number, text?: string): Promise<boolean> {
  if (!IS_TEST_BUILD) return false;

  addTestRemovedId(id);
  removeCopyFromCache(id);

  const persisted = await persistRemovalToServer(id);
  if (persisted) {
    await refreshCorpusAfterRemoval(id);
    syncTestRemovedIds([id]);
  }

  emitRemoved(id, text ?? "", persisted);
  return true;
}

export function isCopyTestRemoved(id: number): boolean {
  return getTestRemovedIds().has(id);
}
