import { QUIZ_STEPS, formatTagLabels } from './labels.js';

import { mergeQuizAnswers, searchCopies, drawMany, topMatchesTwoStage } from './match.js';

import {

  getTodayKey, getTodayPicks, saveTodayPicks, getRecentShownIds,

  getFavorites, isFavorite, toggleFavorite, getApiConfig, saveApiConfig,

  isOnboarded, setOnboarded, getCopyHistory, addCopyHistory,

} from './storage.js';

import { parseUserIntent, parseUserIntentLocal, testApiConnection } from './ai.js';



const FAILED_IDS = new Set([

  35, 696, 846, 1018, 1167, 1202, 1554, 1562, 1623, 2072, 2142, 2268, 2319,

  2346, 2362, 2394, 2430, 2875, 3025, 3152, 3153, 3179, 3187, 3209, 3227,

  3229, 3234, 3242, 3244, 3310,

]);



const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];



let corpus = [];

let quizStep = 0;

let quizSelections = [];

let quizPhase = 'steps'; // steps | gacha | result



// ── 初始化 ──────────────────────────────────────────

async function init() {

  try {

    const res = await fetch('../tagging/output/tagged_corpus.json');

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();

    corpus = raw.filter(

      (c) => c.qc_passed !== false && !FAILED_IDS.has(c.id) && c.tags?.content_rating !== 'rating_mild_slang',

    );

    document.getElementById('loading').classList.add('hidden');



    if (isOnboarded()) {

      showApp();

    } else {

      document.getElementById('btn-start').onclick = () => {

        setOnboarded();

        showApp();

      };

    }



    renderDaily();

    initQuiz();

    initAiSettings();

    bindTabs();

    bindProfileTabs();

    bindQuickEntry();

    bindModal();

    updateFavBadge();

  } catch (e) {

    document.getElementById('loading').innerHTML =

      `<p style="padding:20px;text-align:center;color:#E74C3C">语料加载失败：${e.message}<br><br>请用本地服务器打开（见 web/README.txt）</p>`;

  }

}



function showApp() {

  document.getElementById('screen-welcome').classList.add('hidden');

  document.getElementById('app-shell').classList.remove('hidden');

}



function switchTab(tab) {

  document.querySelectorAll('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));

  const panel = document.getElementById(`panel-${tab}`);

  document.getElementById('page-title').textContent = panel.dataset.title;

  document.getElementById('page-subtitle').textContent = panel.dataset.sub;

  if (tab === 'home') renderDaily();

  if (tab === 'profile') renderProfile('fav');

  if (tab === 'quiz' && quizPhase === 'steps') initQuiz();

  if (tab === 'ai') updateApiStatus();

}



function bindTabs() {

  document.querySelectorAll('.tab-item').forEach((btn) => {

    btn.addEventListener('click', () => switchTab(btn.dataset.tab));

  });

}



function bindQuickEntry() {

  document.querySelectorAll('.entry-card').forEach((btn) => {

    btn.addEventListener('click', () => {

      initQuiz();

      switchTab(btn.dataset.goto);

    });

  });

}



function bindProfileTabs() {

  document.querySelectorAll('.profile-tab').forEach((btn) => {

    btn.addEventListener('click', () => {

      document.querySelectorAll('.profile-tab').forEach((b) => b.classList.toggle('active', b === btn));

      renderProfile(btn.dataset.ptab);

    });

  });

}



function bindModal() {

  document.getElementById('modal-back').onclick = () => {

    document.getElementById('modal-confirm').classList.add('hidden');

  };

  document.getElementById('modal-ok').onclick = () => {

    document.getElementById('modal-confirm').classList.add('hidden');

    renderQuizGacha();

  };

}



function showToast(msg) {

  const t = document.getElementById('toast');

  t.textContent = msg;

  t.classList.add('show');

  setTimeout(() => t.classList.remove('show'), 2000);

}



function copyText(text, copy) {

  navigator.clipboard?.writeText(text).then(

    () => {

      if (copy) addCopyHistory(copy);

      showToast('已复制，去发朋友圈吧 ✦');

    },

    () => showToast('复制失败，请手动复制'),

  );

}



function updateFavBadge() {

  const n = getFavorites().length;

  document.getElementById('fav-badge').textContent = n;

  document.getElementById('tab-profile').classList.toggle('has-badge', n > 0);

}



// ── 功能1：每日三条 ──────────────────────────────────

function pickRandomDaily(exclude) {

  const pool = corpus.filter((c) => !exclude.has(c.id));

  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

}



function renderDaily() {

  const dateEl = document.getElementById('daily-date');

  const listEl = document.getElementById('daily-list');

  const today = getTodayKey();

  const [y, m, d] = today.split('-');

  dateEl.textContent = `${+m}月${+d}日`;



  let picks = getTodayPicks();

  let ids;

  if (picks) {

    ids = picks.ids;

  } else {

    ids = pickRandomDaily(getRecentShownIds(7)).map((c) => c.id);

    saveTodayPicks(ids);

  }



  const copies = ids.map((id) => corpus.find((c) => c.id === id)).filter(Boolean);

  listEl.innerHTML = copies.map((c) => renderCard(c)).join('');

  bindCardActions(listEl);

}



// ── 功能2：微定制（答题 → 确认 → 扭蛋 → 三条结果）────

function initQuiz() {

  quizStep = 0;

  quizSelections = [];

  quizPhase = 'steps';

  renderQuizStep();

}



function renderQuizStep() {

  const container = document.getElementById('quiz-container');

  if (quizStep >= QUIZ_STEPS.length) {

    document.getElementById('modal-confirm').classList.remove('hidden');

    quizStep = QUIZ_STEPS.length - 1;

    return;

  }



  const step = QUIZ_STEPS[quizStep];

  const total = QUIZ_STEPS.length;

  const dots = QUIZ_STEPS.map((_, i) => {

    let cls = 'quiz-dot';

    if (i < quizStep) cls += ' done';

    if (i === quizStep) cls += ' current';

    return `<div class="${cls}"></div>`;

  }).join('');



  container.innerHTML = `

    <p class="quiz-step-label">答题匹配</p>

    <p class="quiz-progress-text">${quizStep + 1} / ${total}</p>

    <div class="quiz-progress">${dots}</div>

    <div class="quiz-title">${step.title}</div>

    <div class="quiz-options" id="quiz-options">

      ${step.options.map((o, i) =>

    `<button class="quiz-option${quizSelections[quizStep] === o ? ' selected' : ''}" data-idx="${i}" data-letter="${LETTERS[i]}">${o.label}</button>`,

  ).join('')}

    </div>

    ${step.required === false ? `<button class="btn btn-outline quiz-skip" id="quiz-skip">${step.skipLabel || '跳过'}</button>` : ''}

    <div class="quiz-nav">

      ${quizStep > 0 ? '<button class="btn btn-outline" id="quiz-prev">上一题</button>' : '<span style="flex:1"></span>'}

      <button class="btn btn-primary" id="quiz-next" style="flex:1">${quizStep === total - 1 ? '确认提交' : '下一题'}</button>

    </div>

  `;



  container.querySelectorAll('.quiz-option').forEach((btn) => {

    btn.addEventListener('click', () => {

      container.querySelectorAll('.quiz-option').forEach((b) => b.classList.remove('selected'));

      btn.classList.add('selected');

      quizSelections[quizStep] = step.options[+btn.dataset.idx];

    });

  });



  document.getElementById('quiz-prev')?.addEventListener('click', () => {

    if (quizStep > 0) { quizStep--; renderQuizStep(); }

  });



  document.getElementById('quiz-next').addEventListener('click', () => {

    if (!quizSelections[quizStep] && step.required !== false) {

      showToast('请先选择一个选项');

      return;

    }

    if (!quizSelections[quizStep] && step.required === false) quizSelections[quizStep] = null;

    quizStep++;

    renderQuizStep();

  });



  document.getElementById('quiz-skip')?.addEventListener('click', () => {

    quizSelections[quizStep] = null;

    quizStep++;

    renderQuizStep();

  });

}



function renderQuizGacha() {

  quizPhase = 'gacha';

  const container = document.getElementById('quiz-container');

  container.innerHTML = `

    <div class="gacha-page">

      <div class="gacha-machine" id="gacha-ball">🎁</div>

      <p class="gacha-title">随机抽取</p>

      <p class="gacha-desc">根据你的偏好精心挑选</p>

      <button class="btn btn-primary btn-lg" id="gacha-start">开始抽取</button>

    </div>

  `;

  document.getElementById('gacha-start').onclick = () => {

    const ball = document.getElementById('gacha-ball');

    ball.classList.add('shake');

    document.getElementById('gacha-start').disabled = true;

    setTimeout(() => renderQuizResult(), 1200);

  };

}



function renderQuizResult() {

  quizPhase = 'result';

  const container = document.getElementById('quiz-container');

  const filters = mergeQuizAnswers(quizSelections.filter(Boolean));

  const scored = searchCopies(corpus, filters, { limit: 50 });

  const results = drawMany(scored, 3);



  if (!results.length) {

    container.innerHTML = `

      <div class="empty-state"><p>没有匹配的文案</p>

      <button class="btn btn-primary" id="quiz-restart" style="margin-top:16px">重新匹配</button></div>`;

    document.getElementById('quiz-restart').onclick = initQuiz;

    return;

  }



  container.innerHTML = `

    <div class="quiz-result-header">

      <h3>为你匹配的文案</h3>

      <p>根据你的偏好精心挑选</p>

    </div>

    <div class="quiz-result-list">

      ${results.map((c) => renderCard(c, true)).join('')}

    </div>

    <div style="padding:0 16px 16px;display:flex;gap:8px">

      <button class="btn btn-ghost" id="quiz-redraw" style="flex:1">重新抽取</button>

      <button class="btn btn-outline" id="quiz-restart" style="flex:1">重新匹配</button>

    </div>

  `;

  bindCardActions(container);

  document.getElementById('quiz-redraw').onclick = renderQuizGacha;

  document.getElementById('quiz-restart').onclick = initQuiz;

}



// ── 功能3：AI 定制 ───────────────────────────────────

function updateApiStatus() {

  const cfg = getApiConfig();

  const el = document.getElementById('api-status');

  const text = document.getElementById('api-status-text');

  if (!el || !text) return;

  if (cfg.apiKey) {

    el.className = 'api-status api-status-ok';

    text.textContent = `API 已配置 · ${cfg.model}`;

  } else {

    el.className = 'api-status api-status-warn';

    text.textContent = '未配置 API · 当前为本地简易匹配，准确度较低';

  }

}



function initAiSettings() {

  const cfg = getApiConfig();

  document.getElementById('api-key').value = cfg.apiKey;

  document.getElementById('api-base').value = cfg.baseUrl;

  document.getElementById('api-model').value = cfg.model;

  updateApiStatus();



  document.getElementById('api-status-config')?.addEventListener('click', () => {

    document.getElementById('ai-settings').open = true;

    document.getElementById('api-key').focus();

  });



  document.getElementById('save-api').onclick = () => {

    saveApiConfig({

      apiKey: document.getElementById('api-key').value.trim(),

      baseUrl: document.getElementById('api-base').value.trim(),

      model: document.getElementById('api-model').value.trim(),

    });

    updateApiStatus();

    showToast('API 设置已保存');

  };



  document.getElementById('test-api').onclick = async () => {

    const btn = document.getElementById('test-api');

    btn.disabled = true;

    btn.textContent = '测试中…';

    try {

      saveApiConfig({

        apiKey: document.getElementById('api-key').value.trim(),

        baseUrl: document.getElementById('api-base').value.trim(),

        model: document.getElementById('api-model').value.trim(),

      });

      await testApiConnection(getApiConfig());

      updateApiStatus();

      showToast('API 连接成功 ✓');

    } catch (e) {

      showToast(`连接失败：${e.message.slice(0, 40)}`);

    } finally {

      btn.disabled = false;

      btn.textContent = '测试连接';

    }

  };

  document.getElementById('ai-submit').onclick = runAiMatch;

}



async function runAiMatch() {

  const text = document.getElementById('ai-input').value.trim();

  if (!text) { showToast('请先描述你的想法'); return; }



  const cfg = getApiConfig();

  if (!cfg.apiKey) {

    showToast('建议先配置 DeepSeek API，匹配会更准');

  }



  const btn = document.getElementById('ai-submit');

  const resultsEl = document.getElementById('ai-results');

  const intentEl = document.getElementById('ai-intent');

  const resultHead = document.getElementById('ai-result-head');

  btn.disabled = true;

  btn.textContent = '匹配中…';

  resultsEl.innerHTML = '';

  intentEl.classList.remove('show');

  resultHead.style.display = 'none';



  try {

    let filters;

    let source = 'DeepSeek AI';



    if (cfg.apiKey) {

      try {

        filters = await parseUserIntent(text, cfg);

      } catch (e) {

        showToast(`API 调用失败：${e.message.slice(0, 30)}`);

        filters = parseUserIntentLocal(text);

        source = '本地规则（API 失败）';

      }

    } else {

      filters = parseUserIntentLocal(text);

      source = '本地规则（未配置 API）';

    }



    intentEl.innerHTML = `<strong>${source}</strong> · 两阶段：标签过滤 → 语义重排<br>标签: ${(filters.mood || []).join(', ') || '—'} / ${(filters.scene || []).join(', ') || '—'}<br>关键词: ${(filters.keywords || []).join('、') || '—'}<br>语义扩展: ${(filters.semantic_keywords || []).join('、') || '—'}`;

    intentEl.classList.add('show');



    const matches = topMatchesTwoStage(corpus, filters, text, 5);

    if (!matches.length) {

      resultsEl.innerHTML = '<div class="empty-state"><p>暂无匹配，试试换个描述</p></div>';

    } else {

      resultHead.style.display = 'flex';

      resultsEl.innerHTML = matches.map((c) => renderCard(c, true)).join('');

      bindCardActions(resultsEl);

      requestAnimationFrame(() => {

        resultHead.scrollIntoView({ behavior: 'smooth', block: 'start' });

      });

    }

  } finally {

    btn.disabled = false;

    btn.textContent = '发送';

  }

}



// ── 我的：收藏 + 复制记录 ────────────────────────────

function renderProfile(which) {

  const favEl = document.getElementById('profile-fav');

  const copyEl = document.getElementById('profile-copy');

  favEl.classList.toggle('hidden', which !== 'fav');

  copyEl.classList.toggle('hidden', which !== 'copy');



  if (which === 'fav') {

    const list = getFavorites();

    favEl.innerHTML = list.length

      ? list.map((f) => renderCard(f)).join('')

      : '<div class="empty-state"><div class="icon">♡</div><p>还没有收藏<br>遇到喜欢的句子点收藏吧</p></div>';

    bindCardActions(favEl);

  } else {

    const list = getCopyHistory();

    copyEl.innerHTML = list.length

      ? list.map((f) => renderCard(f)).join('')

      : '<div class="empty-state"><div class="icon">📋</div><p>还没有复制记录</p></div>';

    bindCardActions(copyEl);

  }

}



// ── 卡片组件 ─────────────────────────────────────────

function renderCard(copy, showMatch = false) {

  const fav = isFavorite(copy.id);

  const label = formatTagLabels(copy.tags || {});

  const matchHtml = showMatch && copy.matchPercent != null

    ? `<div class="match-badge">综合 ${copy.matchPercent}% · 标签 ${copy.tagPercent ?? '—'}% · 语义 ${copy.semanticPercent ?? '—'}%</div>` : '';



  return `

    <article class="copy-card" data-id="${copy.id}">

      <span class="tags">${label}</span>

      <p class="text">${escapeHtml(copy.text)}</p>

      ${matchHtml}

      <div class="card-actions">

        <button class="btn btn-primary btn-copy">复制</button>

        <button class="btn btn-ghost btn-fav ${fav ? 'active' : ''}">${fav ? '已收藏' : '收藏'}</button>

      </div>

    </article>

  `;

}



function escapeHtml(s) {

  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

}



function bindCardActions(root) {

  root.querySelectorAll('.copy-card').forEach((card) => {

    const id = +card.dataset.id;

    const copy = corpus.find((c) => c.id === id)

      || getFavorites().find((f) => f.id === id)

      || getCopyHistory().find((f) => f.id === id);

    if (!copy) return;



    card.querySelector('.btn-copy')?.addEventListener('click', () => copyText(copy.text, copy));

    card.querySelector('.btn-fav')?.addEventListener('click', (e) => {

      toggleFavorite(copy);

      const btn = e.target;

      const nowFav = isFavorite(copy.id);

      btn.textContent = nowFav ? '已收藏' : '收藏';

      btn.classList.toggle('active', nowFav);

      updateFavBadge();

      showToast(nowFav ? '已收藏' : '已取消收藏');

    });

  });

}



init();


