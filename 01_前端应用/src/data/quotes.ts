export interface Quote {
  id: string;
  text: string;
  tag: string;
  mood: string;
  index: string;
  likes: number;
  category: string;
  author?: string;
  source?: string;
}

export const FEATURED_QUOTE = {
  text: "我不会永远这样沉在河底的，雨季终将过去。",
  author: "三毛",
  source: "《雨季不再来》",
};

export const QUOTES: Quote[] = [
  {
    id: "1",
    text: "生活明朗，万物可爱",
    tag: "生活",
    mood: "治愈",
    index: "01",
    likes: 2341,
    category: "生活",
    author: "佚名",
  },
  {
    id: "2",
    text: "慢慢来，一切都来得及\n温柔的时光总会到来",
    tag: "温柔",
    mood: "情绪",
    index: "02",
    likes: 1829,
    category: "治愈",
    author: "佚名",
  },
  {
    id: "3",
    text: "今天的月色真美\n风也温柔",
    tag: "自然",
    mood: "浪漫",
    index: "03",
    likes: 3142,
    category: "浪漫",
    author: "夏目漱石",
  },
  {
    id: "4",
    text: "把温柔藏在心里",
    tag: "生活",
    mood: "治愈",
    index: "04",
    likes: 987,
    category: "生活",
  },
  {
    id: "5",
    text: "愿你眼里有光，心中有爱",
    tag: "祝福",
    mood: "治愈",
    index: "05",
    likes: 1567,
    category: "治愈",
  },
  {
    id: "6",
    text: "人间值得，未来可期",
    tag: "励志",
    mood: "情绪",
    index: "06",
    likes: 2103,
    category: "文艺",
  },
  {
    id: "7",
    text: "星河滚烫，你是人间理想",
    tag: "浪漫",
    mood: "浪漫",
    index: "07",
    likes: 2890,
    category: "浪漫",
  },
  {
    id: "8",
    text: "岁月不居，时节如流",
    tag: "文艺",
    mood: "情绪",
    index: "08",
    likes: 1345,
    category: "文艺",
    author: "孔融",
  },
  {
    id: "9",
    text: "春风十里，不如有你",
    tag: "浪漫",
    mood: "浪漫",
    index: "09",
    likes: 2678,
    category: "浪漫",
  },
  {
    id: "10",
    text: "平凡的日子里，也要闪闪发光",
    tag: "生活",
    mood: "治愈",
    index: "10",
    likes: 1923,
    category: "生活",
  },
];

export const RANDOM_POOL = [
  "保持热爱，奔赴山海，期待下一次相遇",
  "愿所有美好，都恰逢其时",
  "慢慢来，一切都来得及",
  "生活明朗，万物可爱",
  "今天的月色真美，风也温柔",
  "把温柔藏在心里",
  "愿你眼里有光，心中有爱",
  "人间值得，未来可期",
  "星河滚烫，你是人间理想",
  "春风十里，不如有你",
  "慢品人间烟火色，闲观万事岁月长",
  "岁月不居，时节如流",
  "平凡的日子里，也要闪闪发光",
  "雨，是一生遗漏的思念",
  "我不会永远这样沉在河底的，雨季终将过去",
];

export const CATEGORIES = ["全部", "治愈", "文艺", "浪漫", "生活"] as const;

export function shufflePick<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function formatMomentsTime(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${y}年${m}月${d}日${h}:${min}`;
}

const KAOMOJI_SYMBOL_RE =
  /[ᗜ𖥦ω∀･ﾟ°▀▔▁╰╯づง´`・~～^_=;]|T_T|\^_\^|>_<|owo|uwu/i;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function hasKaomojiOrEmoji(text: string): boolean {
  if (EMOJI_RE.test(text)) return true;
  if (KAOMOJI_SYMBOL_RE.test(text)) return true;
  if (/[(（][^)\u4e00-\u9fa5）)]{2,}[)）]/.test(text)) return true;
  return false;
}

/** 颜文字 / emoji 片段内不断行 */
function protectKaomojiRuns(text: string): string {
  return text
    .replace(
      /([^\u4e00-\u9fa5\n，。！？；、 \t]+(?:[ \t]+[^\u4e00-\u9fa5\n，。！？；、 \t]+)+)/g,
      (run) => run.replace(/[ \t]+/g, "\u00A0"),
    )
    .replace(
      /([\u4e00-\u9fa5])([ \t]*)([^\u4e00-\u9fa5\n，。！？；、 \t]{1,6})/g,
      (match, cjk, _space, tail: string) => {
        if (/^[a-zA-Z0-9]$/.test(tail)) return match;
        if (/^[,.!?…:：]$/.test(tail)) return match;
        return `${cjk}\u2060${tail}`;
      },
    );
}

/** 空格分隔的短句（如歌词语感），按段换行；连续长段、颜文字文案不拆 */
function breakSpacePhrases(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.includes(" ")) return trimmed;
  if (trimmed.length > 32) return trimmed;
  if (/[，,]/.test(trimmed)) return trimmed;
  if (hasKaomojiOrEmoji(trimmed)) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return trimmed;
  if (parts.some((part) => part.length > 8)) return trimmed;
  if (parts.some((part) => hasKaomojiOrEmoji(part))) return trimmed;

  const phraseLike = parts.every((part) => {
    const cjkCount = (part.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    return cjkCount >= Math.max(1, part.length - 1);
  });
  if (!phraseLike) return trimmed;

  return parts.join("\n");
}

function applySentenceBreaks(text: string): string {
  const enderCount = (text.match(/[。！？；…]/g) ?? []).length;

  // 单句 / 逗号并列 / 长段仅句末标点：保持连续，不刻意断行
  if (
    enderCount <= 1 &&
    (text.length > 48 || text.includes(",") || text.includes("，"))
  ) {
    return text;
  }

  return text
    .replace(/([。！？；…])(?=[^\s\n])/g, "$1\n")
    .replace(/([!?])(?=[\u4e00-\u9fa5「『])/g, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** 朋友圈展示排版：句末标点断行，空格短句分段，无断句的长段保持连续自动折行 */
export function formatMomentsDisplayText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  let formatted: string;

  if (normalized.includes("\n")) {
    formatted = normalized
      .split("\n")
      .map((line) => breakSpacePhrases(line.trim()))
      .filter(Boolean)
      .join("\n");
  } else {
    const withSentenceBreaks = applySentenceBreaks(normalized);
    formatted = withSentenceBreaks
      .split("\n")
      .map((line) => breakSpacePhrases(line))
      .filter(Boolean)
      .join("\n");
  }

  return protectKaomojiRuns(formatted);
}

export function quotePostedAt(id: string): Date {
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const now = new Date();
  const daysAgo = seed % 14;
  const hour = 8 + (seed % 12);
  const minute = (seed * 7) % 60;
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    hour,
    minute,
  );
}

export interface DailyRecommendItem {
  id: string;
  displayName: string;
  text: string;
  postedAt: Date;
}

export function getDailyRecommendations(): DailyRecommendItem[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 18);

  return [
    {
      id: "featured",
      displayName: FEATURED_QUOTE.author,
      text: FEATURED_QUOTE.text,
      postedAt: today,
    },
    {
      id: "3",
      displayName: QUOTES[2].author ?? QUOTES[2].tag,
      text: QUOTES[2].text,
      postedAt: new Date(today.getTime() - 3600000 * 2),
    },
    {
      id: "7",
      displayName: QUOTES[6].author ?? QUOTES[6].tag,
      text: QUOTES[6].text,
      postedAt: new Date(today.getTime() - 3600000 * 5),
    },
  ];
}
