const KEYS = {
  favorites: 'cc_favorites',
  copies: 'cc_copy_history',
  dailyHistory: 'cc_daily_history',
  apiKey: 'cc_api_key',
  apiBase: 'cc_api_base',
  apiModel: 'cc_api_model',
  onboarded: 'cc_onboarded',
};

export function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.favorites) || '[]');
  } catch {
    return [];
  }
}

export function isFavorite(id) {
  return getFavorites().some((f) => f.id === id);
}

export function toggleFavorite(copy) {
  let list = getFavorites();
  const idx = list.findIndex((f) => f.id === copy.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({
      id: copy.id,
      text: copy.text,
      tags: copy.tags,
      savedAt: Date.now(),
    });
  }
  localStorage.setItem(KEYS.favorites, JSON.stringify(list));
  return list;
}

/** daily_history: [{ date, ids: [1,2,3] }, ...] */
export function getDailyHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.dailyHistory) || '[]');
  } catch {
    return [];
  }
}

export function getTodayPicks() {
  const today = getTodayKey();
  const hist = getDailyHistory();
  return hist.find((h) => h.date === today) || null;
}

export function saveTodayPicks(ids) {
  const today = getTodayKey();
  let hist = getDailyHistory().filter((h) => h.date !== today);
  hist.unshift({ date: today, ids });
  // 只保留 30 天
  hist = hist.slice(0, 30);
  localStorage.setItem(KEYS.dailyHistory, JSON.stringify(hist));
}

/** 近 7 天已推送的 copy id */
export function getRecentShownIds(days = 7) {
  const hist = getDailyHistory();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const ids = new Set();
  for (const h of hist) {
    const t = new Date(h.date).getTime();
    if (t >= cutoff - 86400000) {
      h.ids.forEach((id) => ids.add(id));
    }
  }
  return ids;
}

export function getApiConfig() {
  return {
    apiKey: localStorage.getItem(KEYS.apiKey) || '',
    baseUrl: localStorage.getItem(KEYS.apiBase) || 'https://api.deepseek.com',
    model: localStorage.getItem(KEYS.apiModel) || 'deepseek-chat',
  };
}

export function saveApiConfig({ apiKey, baseUrl, model }) {
  if (apiKey !== undefined) localStorage.setItem(KEYS.apiKey, apiKey);
  if (baseUrl !== undefined) localStorage.setItem(KEYS.apiBase, baseUrl);
  if (model !== undefined) localStorage.setItem(KEYS.apiModel, model);
}

export function isOnboarded() {
  return localStorage.getItem(KEYS.onboarded) === '1';
}

export function setOnboarded() {
  localStorage.setItem(KEYS.onboarded, '1');
}

export function getCopyHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.copies) || '[]');
  } catch {
    return [];
  }
}

export function addCopyHistory(copy) {
  let list = getCopyHistory().filter((c) => c.id !== copy.id);
  list.unshift({ id: copy.id, text: copy.text, tags: copy.tags, copiedAt: Date.now() });
  list = list.slice(0, 50);
  localStorage.setItem(KEYS.copies, JSON.stringify(list));
  return list;
}
