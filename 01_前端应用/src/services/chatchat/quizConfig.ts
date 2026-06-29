import type { QuizStep } from "./types";

/** 主流程 5 步：用途 → 场景 → 情绪 → 风格 → 长度 */
export const QUIZ_STEPS: QuizStep[] = [
  {
    id: "purpose",
    title: "你想用这条文案干嘛？",
    required: true,
    options: [
      { label: "发一条心情", tags: { purpose: ["purpose_show_mood"] } },
      {
        label: "记录今天",
        tags: { purpose: ["purpose_share_life", "purpose_record"] },
      },
      { label: "治愈一下自己", tags: { purpose: ["purpose_heal_self"] } },
      {
        label: "想发得酷一点",
        tags: { purpose: ["purpose_cool_pose", "purpose_humble_brag"] },
      },
      { label: "暗戳戳表达喜欢", tags: { purpose: ["purpose_subtle_love"] } },
      { label: "吐槽一下 / 发疯一下", tags: { purpose: ["purpose_complain"] } },
      { label: "想让朋友来互动", tags: { purpose: ["purpose_interact"] } },
    ],
  },
  {
    id: "scene",
    title: "你这张图是什么场景？",
    required: true,
    options: [
      {
        label: "随手日常",
        tags: { scene: ["scene_daily", "scene_universal"] },
      },
      {
        label: "出门旅行",
        tags: { scene: ["scene_travel", "scene_nature"], theme: ["theme_travel_wander"] },
      },
      { label: "吃饭喝咖啡", tags: { scene: ["scene_food"], theme: ["theme_foodie"] } },
      { label: "自拍 / 状态照", tags: { scene: ["scene_selfie"] } },
      {
        label: "朋友聚会",
        tags: { scene: ["scene_social"], theme: ["theme_friendship"] },
      },
      {
        label: "一个人待着",
        tags: { scene: ["scene_home"], theme: ["theme_self_love"] },
      },
      {
        label: "工作学习",
        tags: { scene: ["scene_work", "scene_study"], theme: ["theme_work_life"] },
      },
      {
        label: "夜晚 / 下雨 / 季节感",
        tags: {
          scene: [
            "scene_night",
            "scene_rainy",
            "scene_season_spring",
            "scene_season_autumn_winter",
            "scene_season_winter",
          ],
          theme: ["theme_night_mood"],
        },
      },
      { label: "宠物", tags: { scene: ["scene_pet"], theme: ["theme_pet"] } },
      { label: "音乐 / 演出", tags: { scene: ["scene_music"] } },
    ],
  },
  {
    id: "mood",
    title: "你想要什么情绪？",
    required: true,
    options: [
      {
        label: "开心元气",
        tags: { mood: ["mood_happy", "mood_energetic"], theme: ["theme_happiness"] },
      },
      {
        label: "温柔治愈",
        tags: { mood: ["mood_healing", "mood_peaceful"] },
      },
      { label: "有点 emo", tags: { mood: ["mood_emo"] } },
      {
        label: "反思人生",
        tags: { mood: ["mood_reflective"], theme: ["theme_philosophy"] },
      },
      { label: "幽默搞笑", tags: { mood: ["mood_humor"] } },
      {
        label: "浪漫心动",
        tags: { mood: ["mood_romantic"], theme: ["theme_love"] },
      },
      {
        label: "文艺氛围感",
        tags: { mood: ["mood_literary", "mood_mysterious"] },
      },
      { label: "酷酷的", tags: { mood: ["mood_mysterious"] } },
    ],
  },
  {
    id: "style",
    title: "你想要哪种文案风格？",
    required: true,
    options: [
      {
        label: "极简一句话",
        tags: { style: ["style_minimal"] },
      },
      { label: "金句感", tags: { style: ["style_quote"] } },
      { label: "像朋友说话", tags: { style: ["style_colloquial"] } },
      { label: "诗意一点", tags: { style: ["style_poetic"] } },
      { label: "小作文", tags: { style: ["style_essay"] } },
      { label: "发疯文学 / 抽象一点", tags: { style: ["style_abstract"] } },
      {
        label: "带 emoji / 符号装饰",
        tags: { style: ["style_emoji_heavy", "style_symbol_deco"] },
      },
      { label: "中英混排", tags: { style: ["style_cn_en_mix"] } },
    ],
  },
];

/** 关系补充题：根据第一步用途动态出现 */
export const QUIZ_RELATION_STEPS: Record<string, QuizStep> = {
  "purpose-2": {
    id: "relation",
    title: "这条文案写给谁？",
    required: false,
    skipLabel: "跳过",
    showWhenPurposeKey: "purpose-2",
    options: [
      { label: "写给自己", tags: { relation: ["relation_solo"] } },
      { label: "不限定对象", tags: { relation: ["relation_none"] } },
    ],
  },
  "purpose-4": {
    id: "relation",
    title: "这条文案写给谁？",
    required: false,
    skipLabel: "跳过",
    showWhenPurposeKey: "purpose-4",
    options: [
      { label: "写给暧昧对象", tags: { relation: ["relation_crush"] } },
      { label: "写给恋人", tags: { relation: ["relation_couple"] } },
      { label: "不想太明显", tags: { relation: ["relation_none"] } },
    ],
  },
};

export interface QuizPresetCard {
  id: string;
  label: string;
  subtitle: string;
  /** 答案 key：purpose / scene / mood / style / relation(可选) */
  answers: Record<string, string>;
}

/** 懒人推荐入口 — 一键填好筛选条件 */
export const QUIZ_PRESET_CARDS: QuizPresetCard[] = [
  {
    id: "preset-daily",
    label: "今日朋友圈随手发",
    subtitle: "记生活 · 日常 · 一句话",
    answers: {
      purpose: "purpose-1",
      scene: "scene-0",
      mood: "mood-0",
      style: "style-0",
    },
  },
  {
    id: "preset-heal",
    label: "温柔治愈一下",
    subtitle: "治愈自己 · 诗意 · 短句",
    answers: {
      purpose: "purpose-2",
      scene: "scene-0",
      mood: "mood-1",
      style: "style-3",
      relation: "relation-1",
    },
  },
  {
    id: "preset-plog",
    label: "适合 plog 的文案",
    subtitle: "记生活 · emoji 装饰 · 极短",
    answers: {
      purpose: "purpose-1",
      scene: "scene-0",
      mood: "mood-0",
      style: "style-6",
    },
  },
  {
    id: "preset-love",
    label: "暧昧但不明说",
    subtitle: "暗戳戳 · 浪漫 · 口语",
    answers: {
      purpose: "purpose-4",
      scene: "scene-0",
      mood: "mood-5",
      style: "style-2",
      relation: "relation-0",
    },
  },
  {
    id: "preset-crazy",
    label: "有点发疯但好笑",
    subtitle: "吐槽 · 幽默 · 抽象",
    answers: {
      purpose: "purpose-5",
      scene: "scene-0",
      mood: "mood-4",
      style: "style-5",
    },
  },
  {
    id: "preset-selfie",
    label: "适合自拍状态照",
    subtitle: "酷一点 · 自拍 · 极简",
    answers: {
      purpose: "purpose-3",
      scene: "scene-3",
      mood: "mood-7",
      style: "style-0",
    },
  },
  {
    id: "preset-travel",
    label: "旅行路上发什么",
    subtitle: "记生活 · 旅行 · 诗意",
    answers: {
      purpose: "purpose-1",
      scene: "scene-1",
      mood: "mood-6",
      style: "style-3",
    },
  },
  {
    id: "preset-emo",
    label: "今天有点 emo",
    subtitle: "发心情 · 反思 · 金句",
    answers: {
      purpose: "purpose-0",
      scene: "scene-0",
      mood: "mood-2",
      style: "style-1",
    },
  },
];

export const QUIZ_STEP_ORDER = ["purpose", "scene", "mood", "style"] as const;
export const QUIZ_RELATION_ANSWER_INDEX = 4;

export function getPurposeAnswerKey(answers: string[]): string {
  return answers[0] || "";
}

export function getRelationStep(purposeKey: string): QuizStep | null {
  return QUIZ_RELATION_STEPS[purposeKey] ?? null;
}

export function shouldShowRelationStep(purposeKey: string): boolean {
  return purposeKey in QUIZ_RELATION_STEPS;
}
