/** 标签中文名 + 微定制选择题配置 */
export const TAG_LABELS = {
  mood_happy: '开心', mood_peaceful: '淡淡', mood_healing: '治愈',
  mood_romantic: '浪漫', mood_literary: '文艺', mood_humor: '搞怪',
  mood_emo: 'emo', mood_reflective: '感慨', mood_energetic: '元气',
  mood_mysterious: '酷感',
  scene_daily: '日常', scene_travel: '旅行', scene_food: '美食',
  scene_selfie: '自拍', scene_pet: '宠物', scene_work: '工作',
  scene_study: '学习', scene_social: '聚会', scene_home: '居家',
  scene_nature: '自然', scene_night: '夜晚', scene_music: '音乐',
  scene_holiday: '节日', scene_universal: '氛围',
  style_minimal: '短句', style_essay: '长文', style_emoji_heavy: 'emoji',
  style_cn_en_mix: '中英', style_pure_cn: '纯中文', style_symbol_deco: '符号',
  style_quote: '金句', style_colloquial: '口语', style_abstract: '抽象',
  style_poetic: '诗意',
  purpose_share_life: '晒生活', purpose_show_mood: '表达心情',
  purpose_heal_self: '自我治愈', purpose_subtle_love: '暗戳表白',
  purpose_cool_pose: '装酷', purpose_humble_brag: '小得意',
  purpose_complain: '吐槽', purpose_record: '仪式感', purpose_interact: '互动',
};

/** 微定制 4 道选择题 */
export const QUIZ_STEPS = [
  {
    id: 'mood',
    title: '你现在什么心情？',
    required: true,
    options: [
      { label: '开心 / 元气', tags: { mood: ['mood_happy', 'mood_energetic'] } },
      { label: '淡淡 / 平静', tags: { mood: ['mood_peaceful'] } },
      { label: '治愈 / 温暖', tags: { mood: ['mood_healing'] } },
      { label: '浪漫 / 心动', tags: { mood: ['mood_romantic'] } },
      { label: '文艺 / 有深度', tags: { mood: ['mood_literary', 'mood_reflective'] } },
      { label: '搞怪 / 抽象', tags: { mood: ['mood_humor'] } },
      { label: 'emo / 微丧', tags: { mood: ['mood_emo'] } },
      { label: '酷酷的 / 话少', tags: { mood: ['mood_mysterious'] } },
    ],
  },
  {
    id: 'scene',
    title: '这条朋友圈大概和什么有关？',
    required: true,
    options: [
      { label: '日常随手发', tags: { scene: ['scene_daily', 'scene_universal'] } },
      { label: '旅行 / 出游', tags: { scene: ['scene_travel'] } },
      { label: '美食 / 探店', tags: { scene: ['scene_food'] } },
      { label: '自拍 / 晒颜值', tags: { scene: ['scene_selfie'] } },
      { label: '宠物', tags: { scene: ['scene_pet'] } },
      { label: '工作 / 学习', tags: { scene: ['scene_work', 'scene_study'] } },
      { label: '朋友聚会', tags: { scene: ['scene_social'] } },
      { label: '居家 / 家人', tags: { scene: ['scene_home'] } },
      { label: '好天气 / 自然风光', tags: { scene: ['scene_nature'] } },
    ],
  },
  {
    id: 'style',
    title: '你想要什么「味儿」？',
    required: true,
    options: [
      { label: '短句就好', tags: { style: ['style_minimal'], length: ['length_ultra_short', 'length_short'] } },
      { label: '可以长一点', tags: { style: ['style_essay'], length: ['length_medium', 'length_long'] } },
      { label: 'emoji 多一点', tags: { style: ['style_emoji_heavy'] } },
      { label: '中英混搭', tags: { style: ['style_cn_en_mix'] } },
      { label: '干净纯中文', tags: { style: ['style_pure_cn'] } },
      { label: '金句 / 引语感', tags: { style: ['style_quote'] } },
      { label: '抽象 / 脑洞', tags: { style: ['style_abstract'] } },
    ],
  },
  {
    id: 'purpose',
    title: '想传达什么感觉？',
    required: false,
    skipLabel: '跳过',
    options: [
      { label: '就是分享生活', tags: { purpose: ['purpose_share_life'] } },
      { label: '表达心情', tags: { purpose: ['purpose_show_mood'] } },
      { label: '治愈一下自己', tags: { purpose: ['purpose_heal_self'] } },
      { label: '暗戳戳说点什么', tags: { purpose: ['purpose_subtle_love'] } },
      { label: '酷一点', tags: { purpose: ['purpose_cool_pose'] } },
      { label: '小得意一下', tags: { purpose: ['purpose_humble_brag'] } },
      { label: '吐槽一下', tags: { purpose: ['purpose_complain'] } },
    ],
  },
];

/** AI 意图解析用：中文 → tag_id 映射 */
export const CN_TO_TAG = {
  开心: 'mood_happy', 元气: 'mood_energetic', 快乐: 'mood_happy',
  淡淡: 'mood_peaceful', 平静: 'mood_peaceful',
  治愈: 'mood_healing', 温暖: 'mood_healing',
  浪漫: 'mood_romantic', 心动: 'mood_romantic',
  文艺: 'mood_literary', 诗意: 'mood_literary', 感慨: 'mood_reflective',
  搞怪: 'mood_humor', 幽默: 'mood_humor', 抽象: 'mood_humor',
  emo: 'mood_emo', 丧: 'mood_emo',
  酷: 'mood_mysterious', 疏离: 'mood_mysterious',
  日常: 'scene_daily', 氛围: 'scene_universal', 通用: 'scene_universal',
  旅行: 'scene_travel', 出游: 'scene_travel',
  美食: 'scene_food', 探店: 'scene_food',
  自拍: 'scene_selfie', 颜值: 'scene_selfie',
  宠物: 'scene_pet', 猫: 'scene_pet', 狗: 'scene_pet',
  工作: 'scene_work', 职场: 'scene_work', 加班: 'scene_work',
  学习: 'scene_study', 校园: 'scene_study',
  聚会: 'scene_social', 朋友: 'scene_social',
  居家: 'scene_home', 家人: 'scene_home',
  自然: 'scene_nature', 春天: 'scene_nature', 夏天: 'scene_nature',
  短句: 'style_minimal', 极简: 'style_minimal',
  长文: 'style_essay', 长一点: 'style_essay',
  emoji: 'style_emoji_heavy',
  中英: 'style_cn_en_mix', 英文: 'style_cn_en_mix',
  纯中文: 'style_pure_cn',
  金句: 'style_quote', 引语: 'style_quote',
  分手: 'theme_love', 爱情: 'theme_love',
};

export function formatTagLabels(tags) {
  const parts = [];
  const mood = tags.mood?.[0];
  const scene = tags.scene?.[0];
  if (mood && TAG_LABELS[mood]) parts.push(TAG_LABELS[mood]);
  if (scene && TAG_LABELS[scene]) parts.push(TAG_LABELS[scene]);
  return parts.join(' · ') || '氛围';
}
