import { CN_TO_TAG } from "./labels";
import {
  buildSemanticTerms,
  extractMatchKeywords,
  parseAiIntent,
} from "./match";
import type { MatchFilters } from "./types";

const SYSTEM_PROMPT = `你是朋友圈文案检索助手，擅长理解抽象、搞笑、发疯、谐音、网络梗等表达。把用户描述转成 JSON 检索条件，禁止生成文案。

规则：
1. mood/scene/style/purpose/theme 用给出的 tag_id，每维 1~2 个；按用户「整体氛围」选，不要只看字面词
2. keywords: 3~5 个中文实体词
3. semantic_keywords: 3~5 个同义/联想/情绪词（如「emo」→ 丧/内耗/疲惫/深夜）
4. avoid: 必须列出与用户意图相反的 tag_id（这是硬排除，命中即不出现）。例：
   - 想 emo/丧/不开心 → avoid mood_happy, mood_energetic, theme_happiness, theme_sunny
   - 想开心/治愈 → avoid mood_emo
   - 想独处/一个人 → avoid scene_social, theme_friendship
   - 分手/不想恋爱 → avoid mood_romantic, theme_love
5. 抽象/发疯/搞笑类：purpose 用 purpose_complain，mood 用 mood_humor，style 用 style_abstract；「发疯」也归 mood_humor + style_abstract
6. 「装酷/拽/疏离」→ mood_mysterious 或 mood_cool_pose；「怀旧/回忆」→ mood_nostalgia；「哲思/人生」→ mood_philosophy 或 mood_reflective
7. 不输出「朋友圈/文案」等泛词

tag_id 枚举：
mood: mood_happy, mood_peaceful, mood_healing, mood_romantic, mood_literary, mood_humor, mood_emo, mood_reflective, mood_energetic, mood_mysterious, mood_cool, mood_cool_pose, mood_nostalgia, mood_philosophy
scene: scene_daily, scene_travel, scene_food, scene_selfie, scene_pet, scene_work, scene_study, scene_social, scene_home, scene_nature, scene_night, scene_music, scene_holiday, scene_universal, scene_rainy, scene_season_spring, scene_season_autumn_winter, scene_season_winter
style: style_minimal, style_essay, style_emoji_heavy, style_cn_en_mix, style_pure_cn, style_symbol_deco, style_quote, style_colloquial, style_abstract, style_poetic
purpose: purpose_share_life, purpose_show_mood, purpose_heal_self, purpose_subtle_love, purpose_cool_pose, purpose_humble_brag, purpose_complain, purpose_record, purpose_interact
theme: theme_happiness, theme_love, theme_friendship, theme_family, theme_freedom, theme_growth, theme_season_spring, theme_season_autumn_winter, theme_rainy, theme_sunny, theme_night_mood, theme_foodie, theme_pet, theme_work_life, theme_travel_wander, theme_self_love, theme_nostalgia, theme_philosophy, theme_music, theme_nature, theme_romantic

只输出 JSON：{"mood":[],"scene":[],"style":[],"purpose":[],"theme":[],"keywords":[],"semantic_keywords":[],"avoid":[]}`;

export interface ApiRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** 兼容 baseUrl 带或不带 /v1，避免拼成 .../v1/v1/chat/completions 导致 404 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "/v1/chat/completions";
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function normalizeTags(arr: unknown): string[] {
  if (!Array.isArray(arr) || !arr.length) return [];
  return arr
    .map((t) => {
      if (typeof t === "string" && t.includes("_")) return t;
      if (typeof t === "string") return CN_TO_TAG[t] || t;
      return "";
    })
    .filter((t): t is string => typeof t === "string" && t.includes("_"));
}

export async function testApiConnection(config: ApiRuntimeConfig): Promise<boolean> {
  const { apiKey, baseUrl, model } = config;
  if (!apiKey) throw new Error("请先填写 API Key");
  const url = buildChatCompletionsUrl(baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "回复 ok" }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err.slice(0, 120)}`);
  }
  return true;
}

const QUOTE_TRANSLATE_PROMPT = `你是朋友圈文案的语义理解助手。用户会给你一条社交网络文案，可能中英日韩混排、带 emoji、歌词或名言引用。

请理解全文的语气、情境与意图，用自然流畅的中文帮读者弄懂「这句话想表达什么」。

输出要求：
1. 只输出中文正文，1～4 句，像朋友解释一样口语化，避免词典式直译
2. 外文按语境意译，保留治愈/文艺/搞怪/emo/浪漫等原帖情绪
3. 原文已有清晰中文的部分不必复读；中英对照可合并成一条完整理解
4. emoji 可保留不译；人名、品牌等专有名词可音译或保留
5. 禁止输出「翻译如下」「原文意思是」等前缀，禁止 markdown、编号列表或引号包裹`;

export async function translateQuoteSemantically(
  quoteText: string,
  config: ApiRuntimeConfig,
): Promise<string> {
  const { apiKey, baseUrl, model } = config;
  if (!apiKey) throw new Error("请先在设置中填写 API Key");

  const url = buildChatCompletionsUrl(baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 320,
      messages: [
        { role: "system", content: QUOTE_TRANSLATE_PROMPT },
        { role: "user", content: quoteText },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI 未返回有效译文");

  return content.replace(/^["「『]|["」』]$/g, "").trim();
}

export async function parseUserIntent(
  userText: string,
  config: ApiRuntimeConfig,
): Promise<MatchFilters> {
  const { apiKey, baseUrl, model } = config;
  if (!apiKey) throw new Error("请先在设置中填写 API Key");

  const url = buildChatCompletionsUrl(baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 320,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 未返回有效 JSON");

  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  raw.mood = normalizeTags(raw.mood);
  raw.scene = normalizeTags(raw.scene);
  raw.style = normalizeTags(raw.style);
  raw.purpose = normalizeTags(raw.purpose);
  raw.theme = normalizeTags(raw.theme);
  raw.avoid = normalizeTags(raw.avoid);
  if (!Array.isArray(raw.keywords) || !(raw.keywords as string[]).length) {
    raw.keywords = extractMatchKeywords(userText);
  }
  if (!Array.isArray(raw.semantic_keywords) || !(raw.semantic_keywords as string[]).length) {
    const all = buildSemanticTerms(userText, parseAiIntent(raw));
    raw.semantic_keywords = all
      .filter((k) => !(raw.keywords as string[]).includes(k))
      .slice(0, 6);
  }

  return parseAiIntent(raw);
}

/** 无 API 时的增强本地解析 */
export function parseUserIntentLocal(userText: string): MatchFilters {
  const filters: MatchFilters = {
    mood: [],
    scene: [],
    style: [],
    purpose: [],
    theme: [],
    relation: [],
    keywords: [],
    semantic_keywords: [],
    avoid: [],
  };

  const rules: [RegExp, Partial<MatchFilters>][] = [
    [
      /加班|上班|工作|打工|职场|项目|上线|早八/,
      {
        scene: ["scene_work"],
        mood: ["mood_peaceful", "mood_emo"],
        theme: ["theme_work_life"],
        purpose: ["purpose_complain", "purpose_humble_brag"],
      },
    ],
    [/旅行|出游|度假|海边|目的地|在路上/, { scene: ["scene_travel"], theme: ["theme_travel_wander"] }],
    [/美食|好吃|咖啡|奶茶|探店|餐厅|吃喝/, { scene: ["scene_food"], theme: ["theme_foodie"] }],
    [/猫|狗|宠物|毛孩子/, { scene: ["scene_pet"], theme: ["theme_pet"] }],
    [/朋友|聚会|姐妹|兄弟|闺蜜|局/, { scene: ["scene_social"], theme: ["theme_friendship"] }],
    [/累|疲惫|烦|内耗|emo|丧|不想动|没劲/, { mood: ["mood_emo", "mood_peaceful"], purpose: ["purpose_show_mood", "purpose_complain"], avoid: ["mood_happy", "mood_energetic", "theme_happiness", "theme_sunny"] }],
    [
      /不开心|不快乐|不幸福|难过|伤心|沮丧|失落|郁闷|unhappy|unhappiness|sadness|depressed|miserable/i,
      {
        mood: ["mood_emo", "mood_peaceful"],
        purpose: ["purpose_show_mood"],
        avoid: ["mood_happy", "mood_energetic", "theme_happiness", "theme_sunny"],
      },
    ],
    [/(?<![不没非无未别])开心|(?<![不没非无未别])快乐|(?<![不没非无未])幸福|治愈|温暖/, { mood: ["mood_happy", "mood_healing"], theme: ["theme_happiness"], avoid: ["mood_emo"] }],
    [/浪漫|喜欢|想你|爱你|心动|暧昧/, { mood: ["mood_romantic"], theme: ["theme_love"] }],
    [/分手|不想恋爱/, { avoid: ["mood_romantic", "theme_love"] }],
    [/低调|淡淡|平静|安静/, { mood: ["mood_peaceful"], style: ["style_minimal"] }],
    [/庆祝|成功|上线|完成|终于/, { mood: ["mood_happy"], purpose: ["purpose_humble_brag"] }],
    [/搞怪|抽象|幽默|段子|发疯|疯一下/, { mood: ["mood_humor"], style: ["style_abstract"], purpose: ["purpose_complain"] }],
    [/文艺|诗意|深沉|哲学/, { mood: ["mood_literary"], style: ["style_poetic", "style_quote"] }],
    [/装酷|拽|疏离|酷酷/, { mood: ["mood_mysterious", "mood_cool_pose"] }],
    [/怀旧|回忆|从前/, { mood: ["mood_nostalgia"] }],
    [/春天|夏天|阳光|晴天|好天气/, { scene: ["scene_nature"], theme: ["theme_season_spring", "theme_sunny"] }],
    [/雨|阴天|潮湿/, { scene: ["scene_rainy"], theme: ["theme_rainy"] }],
    [/毕业|校园|青春|学习/, { scene: ["scene_study"], theme: ["theme_nostalgia"] }],
    [/自拍|好看|颜值|照片/, { scene: ["scene_selfie"] }],
    [/短句|一句话|简洁/, { style: ["style_minimal"] }],
    [/长一点|展开|多说/, { style: ["style_essay"] }],
  ];

  for (const [re, patch] of rules) {
    if (re.test(userText)) {
      for (const [k, v] of Object.entries(patch)) {
        const key = k as keyof MatchFilters;
        if (key === "avoid") {
          filters.avoid = [...new Set([...filters.avoid, ...(v as string[])])];
        } else if (Array.isArray(v)) {
          filters[key] = [...new Set([...(filters[key] as string[]), ...v])] as never;
        }
      }
    }
  }

  filters.keywords = extractMatchKeywords(userText);
  filters.semantic_keywords = buildSemanticTerms(userText, filters)
    .filter((k) => !filters.keywords.includes(k))
    .slice(0, 8);

  if (!filters.mood.length && !filters.scene.length) {
    filters.mood = ["mood_peaceful", "mood_healing"];
    filters.scene = ["scene_universal", "scene_daily"];
  }

  return filters;
}
