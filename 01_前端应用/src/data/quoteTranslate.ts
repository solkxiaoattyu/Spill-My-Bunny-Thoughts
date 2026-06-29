import { isAiConfigured, resolveApiConfig } from "./aiConfig";
import { translateQuoteSemantically } from "../services/chatchat/ai";

const CACHE_PREFIX = "yourword-quote-zh:";

type ForeignSegment = {
  text: string;
  lang: string;
};

const FOREIGN_PATTERNS: Array<{ regex: RegExp; lang?: string }> = [
  { regex: /[\uac00-\ud7af][\uac00-\ud7af\s.,!?…;:()"'-]*/g, lang: "ko" },
  { regex: /[\u3040-\u309f\u30a0-\u30ff][\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\s.,!?…;:()"'-]*/g, lang: "ja" },
  { regex: /[\u0400-\u04ff][\u0400-\u04ff\s.,!?…;:()"'-]*/g, lang: "ru" },
  { regex: /[\u0600-\u06ff][\u0600-\u06ff\s.,!?…;:()"'-]*/g, lang: "ar" },
  { regex: /[\u0e00-\u0e7f][\u0e00-\u0e7f\s.,!?…;:()"'-]*/g, lang: "th" },
  { regex: /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’\-.,!?…;:()"«»\s]*/g },
];

function countChars(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function detectLangCode(text: string): string {
  const hangul = countChars(text, /[\uac00-\ud7af]/g);
  const kana = countChars(text, /[\u3040-\u309f\u30a0-\u30ff]/g);
  const cyrillic = countChars(text, /[\u0400-\u04ff]/g);
  const arabic = countChars(text, /[\u0600-\u06ff]/g);
  const thai = countChars(text, /[\u0e00-\u0e7f]/g);
  const latin = countChars(text, /[A-Za-zÀ-ÿ]/g);

  if (hangul >= kana && hangul >= latin && hangul > 0) return "ko";
  if (kana > hangul && kana >= latin && kana > 0) return "ja";
  if (cyrillic > latin && cyrillic > 0) return "ru";
  if (arabic > 0) return "ar";
  if (thai > 0) return "th";
  if (/[àâäéèêëïîôùûüçœæ]/i.test(text) && latin > 0) return "fr";
  if (/[äöüß]/i.test(text) && latin > 0) return "de";
  if (/[ñ¿¡]/i.test(text) && latin > 0) return "es";
  return "en";
}

function isMeaningfulForeign(part: string): boolean {
  const letters = part.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  if (/^[\u4e00-\u9fff]+$/u.test(letters)) return false;
  return true;
}

function extractForeignSegments(text: string): ForeignSegment[] {
  const results: ForeignSegment[] = [];
  const seen = new Set<string>();

  for (const { regex, lang } of FOREIGN_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const part = match[0].trim();
      if (!part || seen.has(part) || !isMeaningfulForeign(part)) continue;
      seen.add(part);
      results.push({ text: part, lang: lang ?? detectLangCode(part) });
    }
  }

  return results;
}

/** 文案中是否含中文以外的外语片段 */
export function hasForeignContent(text: string): boolean {
  return extractForeignSegments(text).length > 0;
}

/** @deprecated 使用 hasForeignContent */
export function hasEnglishContent(text: string): boolean {
  return hasForeignContent(text);
}

function readCache(cacheKey: string): string | null {
  try {
    return sessionStorage.getItem(`${CACHE_PREFIX}${cacheKey}`);
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, translation: string) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, translation);
  } catch {
    /* quota / private mode */
  }
}

async function requestTranslation(source: string, lang: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=${lang}|zh-CN`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("翻译服务暂不可用");

  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };

  const translated = data.responseData?.translatedText?.trim();
  if (!translated || data.responseStatus === 429) {
    throw new Error("翻译请求过于频繁，请稍后再试");
  }
  return translated;
}

async function translateWithMachine(text: string): Promise<string> {
  const segments = extractForeignSegments(text);
  if (!segments.length) throw new Error("没有可翻译的外文内容");

  const byLang = new Map<string, Set<string>>();
  for (const segment of segments) {
    const bucket = byLang.get(segment.lang) ?? new Set<string>();
    bucket.add(segment.text);
    byLang.set(segment.lang, bucket);
  }

  const translations: string[] = [];
  for (const [lang, parts] of byLang) {
    const source = [...parts].join("\n");
    const cacheKey = `mt:${lang}:${source}`;
    const cached = readCache(cacheKey);
    if (cached) {
      translations.push(cached);
      continue;
    }
    const translated = await requestTranslation(source, lang);
    writeCache(cacheKey, translated);
    translations.push(translated);
  }

  return translations.join("\n");
}

async function translateWithAi(text: string): Promise<string> {
  const cacheKey = `ai:${text}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const translated = await translateQuoteSemantically(text, resolveApiConfig());
  writeCache(cacheKey, translated);
  return translated;
}

/** 将文案译为中文：优先 AI 语义理解，未配置 API 时回退机器翻译 */
export async function translateQuoteToChinese(text: string): Promise<string> {
  if (!hasForeignContent(text)) throw new Error("没有可翻译的外文内容");

  if (isAiConfigured()) {
    try {
      return await translateWithAi(text);
    } catch {
      /* AI 失败时回退机器翻译 */
    }
  }

  return translateWithMachine(text);
}

/** 当前是否会走 AI 语义翻译 */
export function usesSemanticTranslation(): boolean {
  return isAiConfigured();
}
