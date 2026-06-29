import { CN_TO_TAG } from './labels.js';
import { parseAiIntent, extractMatchKeywords, buildSemanticTerms } from './match.js';

const SYSTEM_PROMPT = `你是朋友圈文案检索助手。用户描述想发的朋友圈情境，你只输出 JSON 检索条件，禁止生成任何文案。

规则：
1. mood/scene/style/purpose 各选 1~2 个最贴切的 tag_id
2. keywords 提取 3~5 个能在文案库检索的中文实体词
3. semantic_keywords 再补充 3~5 个同义/近义/联想词（如用户说加班→["打工","深夜","职场","疲惫"]）
4. 不要输出「朋友圈」「文案」等泛词
4. avoid 填写应排除的标签（如用户说不想浪漫则 avoid mood_romantic）

tag_id 枚举：
mood: mood_happy, mood_peaceful, mood_healing, mood_romantic, mood_literary, mood_humor, mood_emo, mood_reflective, mood_energetic, mood_mysterious
scene: scene_daily, scene_travel, scene_food, scene_selfie, scene_pet, scene_work, scene_study, scene_social, scene_home, scene_nature, scene_night, scene_music, scene_holiday, scene_universal
style: style_minimal, style_essay, style_emoji_heavy, style_cn_en_mix, style_pure_cn, style_symbol_deco, style_quote, style_colloquial, style_abstract, style_poetic
purpose: purpose_share_life, purpose_show_mood, purpose_heal_self, purpose_subtle_love, purpose_cool_pose, purpose_humble_brag, purpose_complain
theme: theme_happiness, theme_love, theme_friendship, theme_work_life, theme_travel_wander, theme_self_love, theme_philosophy
length: length_ultra_short, length_short, length_medium, length_long

输出纯 JSON（无 markdown）：
{"mood":["mood_xxx"],"scene":["scene_xxx"],"style":["style_xxx"],"purpose":["purpose_xxx"],"theme":["theme_xxx"],"keywords":["词1","词2"],"semantic_keywords":["同义词1","联想词2"],"avoid":[]}`;

function normalizeTags(arr) {
  if (!arr?.length) return [];
  return arr.map((t) => {
    if (typeof t === 'string' && t.includes('_')) return t;
    return CN_TO_TAG[t] || t;
  }).filter((t) => typeof t === 'string' && t.includes('_'));
}

export async function testApiConnection(config) {
  const { apiKey, baseUrl, model } = config;
  if (!apiKey) throw new Error('请先填写 API Key');
  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: '回复 ok' }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err.slice(0, 120)}`);
  }
  return true;
}

export async function parseUserIntent(userText, config) {
  const { apiKey, baseUrl, model } = config;
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key');

  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `用户想发朋友圈，他说：「${userText}」\n请分析并输出 JSON。` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 未返回有效 JSON');

  const raw = JSON.parse(jsonMatch[0]);
  raw.mood = normalizeTags(raw.mood);
  raw.scene = normalizeTags(raw.scene);
  raw.style = normalizeTags(raw.style);
  raw.purpose = normalizeTags(raw.purpose);
  raw.length = normalizeTags(raw.length);
  raw.theme = normalizeTags(raw.theme);
  raw.avoid = normalizeTags(raw.avoid);
  if (!raw.keywords?.length) {
    raw.keywords = extractMatchKeywords(userText);
  }
  if (!raw.semantic_keywords?.length) {
    const all = buildSemanticTerms(userText, raw);
    raw.semantic_keywords = all.filter((k) => !(raw.keywords || []).includes(k)).slice(0, 6);
  }

  return parseAiIntent(raw);
}

/** 无 API 时的增强本地解析 */
export function parseUserIntentLocal(userText) {
  const filters = {
    mood: [], scene: [], style: [], purpose: [], length: [], theme: [],
    keywords: [], avoid: [],
  };
  const rules = [
    [/加班|上班|工作|打工|职场|项目|上线|早八/, {
      scene: ['scene_work'], mood: ['mood_peaceful', 'mood_emo'],
      theme: ['theme_work_life'], purpose: ['purpose_complain', 'purpose_humble_brag'],
    }],
    [/旅行|出游|度假|海边|目的地|在路上/, {
      scene: ['scene_travel'], theme: ['theme_travel_wander'],
    }],
    [/美食|好吃|咖啡|奶茶|探店|餐厅|吃喝/, {
      scene: ['scene_food'], theme: ['theme_foodie'],
    }],
    [/猫|狗|宠物|毛孩子/, { scene: ['scene_pet'], theme: ['theme_pet'] }],
    [/朋友|聚会|姐妹|兄弟|闺蜜|局/, {
      scene: ['scene_social'], theme: ['theme_friendship'],
    }],
    [/累|疲惫|烦|内耗|emo|丧|不想/, {
      mood: ['mood_emo', 'mood_peaceful'], purpose: ['purpose_show_mood'],
    }],
    [/开心|快乐|幸福|治愈|温暖/, {
      mood: ['mood_happy', 'mood_healing'], theme: ['theme_happiness'],
    }],
    [/浪漫|喜欢|想你|爱你|心动|暧昧/, {
      mood: ['mood_romantic'], theme: ['theme_love'],
    }],
    [/分手|不想恋爱/, { avoid: ['mood_romantic', 'theme_love'] }],
    [/低调|淡淡|平静|安静/, {
      mood: ['mood_peaceful'], style: ['style_minimal'], length: ['length_short'],
    }],
    [/庆祝|成功|上线|完成|终于/, {
      mood: ['mood_happy'], purpose: ['purpose_humble_brag'],
    }],
    [/搞怪|抽象|幽默|段子/, { mood: ['mood_humor'], style: ['style_abstract'] }],
    [/文艺|诗意|深沉|哲学/, { mood: ['mood_literary'], style: ['style_poetic', 'style_quote'] }],
    [/春天|夏天|阳光|晴天|好天气/, {
      scene: ['scene_nature'], theme: ['theme_season_spring', 'theme_sunny'],
    }],
    [/雨|阴天|潮湿/, { theme: ['theme_rainy'] }],
    [/毕业|校园|青春|学习/, { scene: ['scene_study'], theme: ['theme_nostalgia'] }],
    [/自拍|好看|颜值|照片/, { scene: ['scene_selfie'] }],
    [/短句|一句话|简洁/, { style: ['style_minimal'], length: ['length_ultra_short', 'length_short'] }],
    [/长一点|展开|多说/, { style: ['style_essay'], length: ['length_medium', 'length_long'] }],
  ];

  for (const [re, patch] of rules) {
    if (re.test(userText)) {
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'avoid') {
          filters.avoid = [...new Set([...filters.avoid, ...v])];
        } else {
          filters[k] = [...new Set([...(filters[k] || []), ...v])];
        }
      }
    }
  }

  filters.keywords = extractMatchKeywords(userText);
  filters.semantic_keywords = buildSemanticTerms(userText, filters)
    .filter((k) => !filters.keywords.includes(k))
    .slice(0, 8);

  // 若规则完全没命中，给默认氛围型
  if (!filters.mood.length && !filters.scene.length) {
    filters.mood = ['mood_peaceful', 'mood_healing'];
    filters.scene = ['scene_universal', 'scene_daily'];
  }

  return filters;
}
