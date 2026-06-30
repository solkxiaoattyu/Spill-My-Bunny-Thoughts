import { asset } from "../../utils/asset";

export const TEST_REMOVED_IDS_KEY = "yourword-test-removed-corpus-ids";
export const TEST_REMOVED_IDS_MANIFEST_URL = asset("/corpus/test_removed_ids.json");

export function getTestRemovedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(TEST_REMOVED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addTestRemovedId(id: number) {
  const ids = getTestRemovedIds();
  ids.add(id);
  localStorage.setItem(TEST_REMOVED_IDS_KEY, JSON.stringify([...ids]));
}

export function syncTestRemovedIds(ids: number[]) {
  const merged = new Set([...getTestRemovedIds(), ...ids]);
  localStorage.setItem(TEST_REMOVED_IDS_KEY, JSON.stringify([...merged]));
}

export async function loadPersistedRemovedIds(): Promise<Set<number>> {
  try {
    const res = await fetch(TEST_REMOVED_IDS_MANIFEST_URL);
    if (!res.ok) return new Set();
    const parsed = JSON.parse(await res.text()) as number[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function mergeRemovedIds(...sources: Set<number>[]): Set<number> {
  const merged = new Set<number>();
  for (const source of sources) {
    for (const id of source) merged.add(id);
  }
  return merged;
}

export function getTestRemovedCount(): number {
  return getTestRemovedIds().size;
}
