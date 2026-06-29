/** 标签过滤 + 打分 + 抽签 */

const WEIGHTS = { mood: 3, scene: 2, style: 2, purpose: 1.5, length: 0.5, theme: 1 };

function asArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getCopyTags(copy, dim) {
  const t = copy.tags?.[dim];
  return asArray(t);
}

/** 计算单条文案匹配分 */
export function scoreCopy(copy, filters) {
  let earned = 0;
  let max = 0;

  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    const userTags = filters[dim];
    if (!userTags?.length) continue;
    max += userTags.length * weight;
    const copyTags = getCopyTags(copy, dim);
    const hits = userTags.filter((t) => copyTags.includes(t));
    earned += hits.length * weight;
  }

  // 关键词：文案正文或 keywords 字段命中
  const kws = filters.keywords || [];
  if (kws.length) {
    max += kws.length * 2;
    const text = copy.text || '';
    const copyKws = copy.tags?.keywords || [];
    for (const kw of kws) {
      if (text.includes(kw) || copyKws.some((k) => k.includes(kw) || kw.includes(k))) {
        earned += 2;
      }
    }
  }

  // avoid 扣分
  const avoid = filters.avoid || [];
  for (const tag of avoid) {
    for (const dim of ['mood', 'scene', 'style', 'purpose', 'theme']) {
      if (getCopyTags(copy, dim).includes(tag)) earned -= 3;
    }
  }

  return max > 0 ? earned / max : 0;
}

/** 合并选择题答案为 filters */
export function mergeQuizAnswers(selections) {
  const filters = { mood: [], scene: [], style: [], purpose: [], length: [] };
  for (const sel of selections) {
    if (!sel?.tags) continue;
    for (const [dim, tags] of Object.entries(sel.tags)) {
      filters[dim] = [...new Set([...(filters[dim] || []), ...tags])];
    }
  }
  return filters;
}

const RELAX_ORDER = ['purpose', 'length', 'style', 'scene'];

/** 过滤候选并打分，支持逐步放宽 */
export function searchCopies(corpus, filters, { limit = 5, excludeIds = [] } = {}) {
  const exclude = new Set(excludeIds);
  let working = { ...filters };
  let candidates = [];

  for (let i = 0; i <= RELAX_ORDER.length; i++) {
    candidates = corpus
      .filter((c) => !exclude.has(c.id))
      .map((c) => ({ copy: c, score: scoreCopy(c, working) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length >= limit) break;

    // 放宽：去掉一个维度
    if (i < RELAX_ORDER.length) {
      const dim = RELAX_ORDER[i];
      working = { ...working, [dim]: [] };
    } else {
      // 全库随机有分
      candidates = corpus
        .filter((c) => !exclude.has(c.id))
        .map((c) => ({ copy: c, score: scoreCopy(c, filters) || 0.01 }))
        .sort((a, b) => b.score - a.score);
    }
  }

  return candidates.slice(0, Math.max(limit, 20));
}

/** 从 top-N 加权随机抽 1 条 */
export function drawOne(scoredList, topN = 20) {
  const pool = scoredList.slice(0, topN);
  if (!pool.length) return null;
  const weights = pool.map((x) => Math.max(x.score, 0.05));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return { ...pool[i].copy, matchScore: pool[i].score };
  }
  return { ...pool[0].copy, matchScore: pool[0].score };
}

/** 从 top-N 中抽取多条（不重复） */
export function drawMany(scoredList, count = 3, topN = 30) {
  const results = [];
  const used = new Set();
  const pool = scoredList.slice(0, topN);
  if (!pool.length) return results;

  while (results.length < count && used.size < pool.length) {
    const remain = pool.filter((x) => !used.has(x.copy.id));
    if (!remain.length) break;
    const weights = remain.map((x) => Math.max(x.score, 0.05));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let picked = remain[0];
    for (let i = 0; i < remain.length; i++) {
      r -= weights[i];
      if (r <= 0) { picked = remain[i]; break; }
    }
    used.add(picked.copy.id);
    results.push({
      ...picked.copy,
      matchScore: picked.score,
      matchPercent: Math.round(Math.min(picked.score, 1) * 100),
    });
  }
  return results;
}

/** 语义同义词扩展（本地，零 token） */
const SEMANTIC_SYNONYMS = {
  加班: ['打工', '上班', '职场', '工作', '累', '深夜'],
  工作: ['加班', '打工', '上班', '职场', '项目'],
  上线: ['成功', '完成', '项目', '庆祝'],
  庆祝: ['开心', '快乐', '成功', '幸福'],
  低调: ['淡淡', '平静', '安静', '顺顺'],
  累: ['疲惫', '困', '加班', '内耗', '烦'],
  开心: ['快乐', '幸福', '治愈', '好天气'],
  幸福: ['快乐', '开心', '治愈', '小确幸'],
  治愈: ['温暖', '幸福', '平静', '温柔'],
  旅行: ['出发', '风景', '海边', '在路上', '度假'],
  美食: ['好吃', '咖啡', '奶茶', '探店'],
  朋友: ['聚会', '姐妹', '兄弟', '闺蜜'],
  春天: ['花开', '绿意', '好天气', '阳光'],
  雨天: ['雨', '阴天', '潮湿'],
  浪漫: ['心动', '喜欢', '爱', '你'],
  emo: ['丧', '内耗', '烦', '累', '淡淡'],
  宠物: ['猫', '狗', '毛孩子'],
  毕业: ['青春', '校园', '回忆'],
};

/** 构建语义检索词表 */
export function buildSemanticTerms(userText, filters = {}) {
  const terms = new Set();
  for (const kw of [...(filters.keywords || []), ...(filters.semantic_keywords || [])]) {
    if (kw && kw.length >= 2) terms.add(kw);
  }
  for (const kw of extractMatchKeywords(userText)) terms.add(kw);

  const expanded = new Set(terms);
  for (const t of terms) {
    for (const syn of SEMANTIC_SYNONYMS[t] || []) expanded.add(syn);
  }
  return [...expanded].slice(0, 20);
}

function getCharBigrams(text) {
  const clean = (text || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 阶段 B：在标签候选集内做语义打分（0~1）
 * - 检索词命中正文 / 语料 keywords
 * - 字符 bigram 重叠（近似语义相近）
 * - 用户输入短语片段命中
 */
export function computeSemanticScore(copy, userText, terms) {
  if (!copy?.text) return 0;
  const text = copy.text;
  const copyKws = copy.tags?.keywords || [];

  let termHits = 0;
  for (const t of terms) {
    if (text.includes(t)) termHits += 1;
    else if (copyKws.some((k) => k.includes(t) || t.includes(k))) termHits += 0.8;
  }
  const termScore = terms.length ? Math.min(termHits / terms.length, 1) : 0;

  const bigramScore = jaccardSimilarity(getCharBigrams(userText), getCharBigrams(text));

  const phrases = (userText.match(/[\u4e00-\u9fa5]{3,8}/g) || [])
    .filter((p) => !STOP_WORDS.has(p));
  let phraseHits = 0;
  for (const p of phrases.slice(0, 10)) {
    if (text.includes(p)) phraseHits++;
  }
  const phraseScore = phrases.length ? phraseHits / Math.min(phrases.length, 6) : 0;

  // 用户描述与文案情绪/主题标签的语义关联（弱信号）
  let vibeScore = 0;
  const vibeWords = userText.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const tagText = [
    ...(copy.tags?.mood || []),
    ...(copy.tags?.theme || []),
    ...(copy.tags?.scene || []),
  ].join(' ');
  for (const w of vibeWords.slice(0, 8)) {
    if (tagText.includes(w.replace('mood_', '').replace('theme_', ''))) vibeScore += 0.1;
  }
  vibeScore = Math.min(vibeScore, 0.3);

  return Math.min(
    termScore * 0.5 + bigramScore * 0.25 + phraseScore * 0.2 + vibeScore * 0.05,
    1,
  );
}

/** 用户输入与文案正文的文本相似度（0~1）— 兼容旧接口 */
export function scoreTextSimilarity(copy, userText) {
  const terms = buildSemanticTerms(userText, {});
  return computeSemanticScore(copy, userText, terms);
}

const STOP_WORDS = new Set([
  '我想', '今天', '明天', '一个', '一下', '已经', '但是', '可以', '就是',
  '然后', '因为', '所以', '如果', '怎么', '什么', '这个', '那个', '没有',
  '不是', '还是', '比较', '感觉', '想要', '希望', '有点', '真的', '自己',
  '我们', '他们', '朋友圈', '文案', '发一条', '帮我', '匹配',
]);

/** 从用户输入提取有意义的检索词 */
export function extractMatchKeywords(userText) {
  const kws = new Set();
  const rules = [
    [/加班|打工人|上班|职场|项目|上线|工作/, ['加班', '工作', '打工人', '上线', '项目']],
    [/旅行|出游|度假|海边|风景/, ['旅行', '风景', '海边', '出发']],
    [/美食|好吃|咖啡|奶茶|探店|餐厅/, ['美食', '咖啡', '奶茶', '好吃']],
    [/猫|狗|宠物|毛孩子/, ['猫', '狗', '宠物']],
    [/朋友|聚会|姐妹|兄弟|闺蜜/, ['朋友', '聚会', '姐妹']],
    [/累|疲惫|烦|内耗|emo|丧/, ['累', '疲惫', 'emo', '内耗']],
    [/开心|快乐|幸福|治愈/, ['幸福', '快乐', '开心', '治愈']],
    [/浪漫|喜欢|爱你|心动|想你/, ['浪漫', '心动', '喜欢']],
    [/春天|夏天|秋天|冬天|阳光|雨天/, ['春天', '夏天', '阳光', '雨天']],
    [/毕业|校园|学习|考试/, ['毕业', '校园', '青春']],
    [/庆祝|成功|低调|小得意/, ['庆祝', '成功', '低调']],
  ];
  for (const [re, words] of rules) {
    if (re.test(userText)) words.forEach((w) => kws.add(w));
  }
  const phrases = userText.split(/[，。！？、；\s]+/).filter((p) => p.length >= 2 && p.length <= 12);
  for (const p of phrases) {
    if (!STOP_WORDS.has(p)) kws.add(p);
  }
  return [...kws].slice(0, 8);
}

/** AI 定制：两阶段匹配 — ① 标签过滤候选  ② 候选集内语义重排 */
export function topMatchesTwoStage(corpus, filters, userText, limit = 5, excludeIds = []) {
  const TAG_POOL = 100;
  const MIN_TAG = 0.12;

  // ── 阶段 A：标签匹配，收窄候选池 ──
  let tagCandidates = searchCopies(corpus, filters, { limit: TAG_POOL, excludeIds })
    .filter((x) => x.score >= MIN_TAG);

  if (tagCandidates.length < 20) {
    tagCandidates = searchCopies(corpus, filters, { limit: TAG_POOL, excludeIds });
  }
  if (tagCandidates.length < 10) {
    tagCandidates = corpus
      .filter((c) => !excludeIds.includes(c.id))
      .map((c) => ({ copy: c, score: scoreCopy(c, filters) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TAG_POOL);
  }

  const terms = buildSemanticTerms(userText, filters);

  // ── 阶段 B：仅在标签候选池内做语义搜索重排 ──
  const reranked = tagCandidates.map(({ copy, score: tagScore }) => {
    const semanticScore = computeSemanticScore(copy, userText, terms);
    // 必须先过标签门槛，语义决定最终顺序
    const finalScore = tagScore * 0.3 + semanticScore * 0.7;
    return { copy, tagScore, semanticScore, finalScore };
  });

  reranked.sort((a, b) => b.finalScore - a.finalScore);
  const top = reranked[0]?.finalScore || 1;

  return reranked.slice(0, limit).map((x) => ({
    ...x.copy,
    matchScore: x.finalScore,
    matchPercent: top > 0 ? Math.round((x.finalScore / top) * 100) : 0,
    tagPercent: Math.round(x.tagScore * 100),
    semanticPercent: Math.round(x.semanticScore * 100),
    tagScore: x.tagScore,
    semanticScore: x.semanticScore,
  }));
}

/** @deprecated 使用 topMatchesTwoStage */
export function topMatchesHybrid(corpus, filters, userText, limit = 5, excludeIds = []) {
  return topMatchesTwoStage(corpus, filters, userText, limit, excludeIds);
}

/** 返回 top N 条（仅标签） */
export function topMatches(corpus, filters, limit = 5, excludeIds = []) {
  const scored = searchCopies(corpus, filters, { limit: 50, excludeIds });
  return scored.slice(0, limit).map((x) => ({
    ...x.copy,
    matchScore: x.score,
    matchPercent: Math.round(Math.min(x.score, 1) * 100),
  }));
}

/** 解析 AI 返回的 JSON 为 filters */
export function parseAiIntent(raw) {
  const filters = {
    mood: [], scene: [], style: [], purpose: [], length: [], theme: [],
    keywords: [], semantic_keywords: [], avoid: [],
  };

  const assign = (dim, vals) => {
    if (!vals) return;
    const arr = asArray(vals);
    filters[dim] = [...new Set([...(filters[dim] || []), ...arr])];
  };

  assign('mood', raw.mood);
  assign('scene', raw.scene);
  assign('style', raw.style);
  assign('purpose', raw.purpose);
  assign('length', raw.length);
  assign('theme', raw.theme);
  assign('keywords', raw.keywords);
  assign('semantic_keywords', raw.semantic_keywords);
  assign('avoid', raw.avoid);

  return filters;
}
