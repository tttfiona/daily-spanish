/* 每日西语 PWA — 逻辑 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const INTERVALS = [1, 3, 7, 15, 30];
const LS_KEY = 'daily-esp-progress-v1';

const state = { lessons: [], refs: [], progress: load() };
let _wordIndex = null;   // 全量词索引(LightPeek 用)
let currentLesson = null; // 当前打开的课程(全部朗读用)

/* ---- 每天时间档位(与 export.py PACES 对齐)---- */
const PACES = [
  { min: 5,  label: '5分' },
  { min: 10, label: '10分' },
  { min: 15, label: '15分' },
  { min: 20, label: '20分' },
];
function currentPace(){
  const p = parseInt(state.progress.pace, 10);
  return PACES.some(x => x.min === p) ? p : 10;
}
function setPace(min){
  state.progress.pace = min;
  save();
  const list = state.lessonsByPace && state.lessonsByPace[String(min)];
  if(list) state.lessons = list;
  _wordIndex = null;   // 词表变了,LightPeek 索引重建
}
function paceBarHTML(){
  const cur = currentPace();
  return `<div class="pace"><span class="pace-l">⏱ 每天</span>` +
    PACES.map(p => `<button class="pace-btn${p.min === cur ? ' on' : ''}" data-pace="${p.min}">${p.label}</button>`).join('') +
    `<span class="pace-t">共 ${state.lessons.length} 课</span></div>`;
}

function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e){ return {}; } }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state.progress)); }

/* ---- 日期工具 ---- */
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayStr(){ return ymd(new Date()); }
function addDays(s, n){ const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function parseDate(s){ return new Date(s + 'T00:00:00'); }
function fmt(s){ const d = parseDate(s); const w = '日一二三四五六'[d.getDay()]; return `${d.getMonth()+1}月${d.getDate()}日 · 周${w}`; }

/* ---- TTS 朗读 ---- */
function pickVoice(){
  const vs = speechSynthesis.getVoices();
  return vs.find(x => (x.lang||'').toLowerCase().startsWith('es')) || null;
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  const v = pickVoice(); if(v) u.voice = v;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}
function speakAll(texts){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  for(const t of texts){
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'es-ES'; u.rate = 0.85;
    const v = pickVoice(); if(v) u.voice = v;
    speechSynthesis.speak(u);
  }
}
if('speechSynthesis' in window){
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

/* ---- 进度 ---- */
function lessonProgress(date){ return (state.progress.lessons && state.progress.lessons[date]) || {}; }
function isDone(date){ return !!lessonProgress(date).done; }
function isReviewed(date, w){ const r = lessonProgress(date).reviewed; return !!(r && r[w]); }
function toggleReview(date, w){
  state.progress.lessons = state.progress.lessons || {};
  state.progress.lessons[date] = state.progress.lessons[date] || {};
  state.progress.lessons[date].reviewed = state.progress.lessons[date].reviewed || {};
  if(state.progress.lessons[date].reviewed[w]) delete state.progress.lessons[date].reviewed[w];
  else state.progress.lessons[date].reviewed[w] = true;
  save(); renderLesson(date);
}
function checkin(date){
  state.progress.lessons = state.progress.lessons || {};
  state.progress.lessons[date] = state.progress.lessons[date] || {};
  state.progress.lessons[date].done = !state.progress.lessons[date].done;
  save(); renderLesson(date); renderStreak();
}
function overallProgress(){
  const daily = state.lessons.filter(l => !l.ref);
  const done = daily.filter(l => isDone(l.date)).length;
  const total = daily.length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}
function nextUpcoming(){
  const t = todayStr();
  return state.lessons.filter(l => !l.ref && l.date > t).sort((a,b) => a.date.localeCompare(b.date))[0] || null;
}

/* ---- 间隔复习 ---- */
function wordKey(l, v){ return `${l.date}|${v.w}`; }
function dueDateFor(l, v){
  const done = (state.progress.words && state.progress.words[wordKey(l, v)]) || [];
  for(const r of INTERVALS){
    const d = addDays(l.date, r);
    const passed = done.some(x => x >= d);
    if(!passed) return d;
  }
  return null;
}
function reviewWord(l, v){
  const k = wordKey(l, v);
  state.progress.words = state.progress.words || {};
  state.progress.words[k] = state.progress.words[k] || [];
  state.progress.words[k].push(todayStr());
  save(); renderReview();
}

/* ---- 连续打卡 ---- */
function streak(){
  let n = 0, d = todayStr();
  if(!isDone(d)) d = addDays(d, -1);
  while(isDone(d)){ n++; d = addDays(d, -1); }
  return n;
}
function renderStreak(){ const el = $('#streak'); if(el) el.textContent = '🔥 ' + streak(); }

/* ---- 转义 ---- */
function esc(s){ return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ---- LightPeek:单词可点 ---- */
function wordify(es){
  return esc(es).replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/g, '<span class="wrd" data-w="$1">$1</span>');
}
function buildWordIndex(){
  const idx = {};
  for(const l of state.lessons){
    for(const v of l.vocab){
      const toks = (v.w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-zñ]+/g) || [];
      for(const t of toks){ if(t && !(t in idx)) idx[t] = v; }
    }
  }
  return idx;
}
function wordIndex(){ if(!_wordIndex) _wordIndex = buildWordIndex(); return _wordIndex; }
function findWord(w){ return wordIndex()[ (w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zñ]/g,'') ] || null; }

function openWordPopup(word){
  const v = findWord(word);
  if(!v) return;
  $('#pw-w').textContent = v.w;
  $('#pw-m').textContent = v.m;
  const ph = $('#pw-ph');
  if(v.ph){ ph.textContent = '🔤 谐音: ' + v.ph; ph.style.display = 'inline-block'; }
  else ph.style.display = 'none';
  $('#pw-e').innerHTML = (v.e ? `<div class="pw-e-line">${esc(v.e)}</div>` : '') + (v.n ? `<div class="pw-n">${esc(v.n)}</div>` : '');
  $('#wordpopup').hidden = false;
}

/* ---- 跟读打分(Web Speech API)---- */
function normToks(s){ return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-zñ]+/g) || []; }
function score(target, said){
  const t = normToks(target), s = normToks(said);
  if(!t.length) return 0;
  let hit = 0;
  for(const tw of t){ if(s.includes(tw)) hit++; }
  return Math.round(hit / t.length * 100);
}
function startFollow(es, btn){
  const row = btn.parentElement;
  const status = row.querySelector('.follow-status');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ if(status) status.textContent = '⚠️ 此浏览器不支持跟读(建议 Chrome / 安卓)'; return; }
  const rec = new SR();
  rec.lang = 'es-ES';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let said = '';
  btn.textContent = '⏹ 收听中…';
  if(status) status.textContent = '🎙 请读出这句话';
  rec.onresult = e => {
    said = '';
    for(let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript + ' ';
    if(status) status.textContent = '🧠 听到: ' + esc(said.trim()).slice(0, 60);
  };
  rec.onend = () => {
    btn.textContent = '🎙 跟读打分';
    if(said.trim()) showScore(es, said, status);
    else if(status) status.textContent = '😅 没听清,再试一次';
  };
  rec.onerror = () => {
    btn.textContent = '🎙 跟读打分';
    if(status) status.textContent = '⚠️ 麦克风不可用或已拒绝';
  };
  try { rec.start(); } catch(e){ if(status) status.textContent = '⚠️ 无法启动录音'; }
}
function showScore(es, said, status){
  const s = score(es, said);
  const msg = s >= 80 ? '👏 很棒' : s >= 50 ? '👍 不错,再顺一遍' : '💪 再听一遍原声吧';
  if(status) status.innerHTML = `你读: <i>${esc(said.trim())}</i><br><b class="score s${Math.min(5, Math.floor(s/20))}">${s} 分</b> ${msg}`;
}

/* ---- 今日页顶部统计条 + 明日预告 ---- */
function statsHTML(){
  const p = overallProgress();
  return `
    <div class="stats">
      <div class="stat"><div class="stat-n">🔥 ${streak()}</div><div class="stat-l">连续天数</div></div>
      <div class="stat"><div class="stat-n">${p.pct}%</div><div class="stat-l">课程进度</div></div>
      <div class="stat"><div class="stat-n">${p.done}/${p.total}</div><div class="stat-l">已打卡</div></div>
    </div>
    <div class="progress"><i style="width:${p.pct}%"></i></div>`;
}
function tomorrowCardHTML(){
  const next = nextUpcoming();
  if(!next) return '';
  return `
    <div class="tomorrow" data-open="${next.date}">
      <div class="t-l">${next.date === addDays(todayStr(), 1) ? '📅 明天学什么' : '⏭ 下一课'}</div>
      <div class="t-t">${esc(next.tema)}</div>
      <div class="t-words">${next.vocab.slice(0, 5).map(v => `<span>${esc(v.w)}</span>`).join('')}</div>
      <button class="t-cta">打开课程 →</button>
    </div>`;
}
/* 生词卡翻转:原地翻面,翻后高度自适应内容(例句不裁切) */
function flipRow(row){
  row.classList.toggle('flipped');
  const back = row.querySelector('.vface.back');
  if(row.classList.contains('flipped')){
    back.style.position = 'static';
    const h = Math.max(60, back.offsetHeight + 2);
    back.style.position = '';
    row.style.height = h + 'px';
  } else {
    row.style.height = '';
  }
}

/* ---- 视图 ---- */
function renderToday(){
  const daily = l => !l.ref;
  const today = state.lessons.find(l => daily(l) && l.date === todayStr());
  if(today){ renderLesson(today.date); return; }
  const last = state.lessons.filter(l => daily(l) && l.date < todayStr()).sort((a,b) => b.date.localeCompare(a.date))[0];
  const upcoming = state.lessons.filter(l => daily(l) && l.date > todayStr()).sort((a,b) => a.date.localeCompare(b.date));
  $('#view').innerHTML = paceBarHTML() + statsHTML() + `
    <div class="empty">
      <div class="empty-emoji">🌅</div>
      <p>今天还没有课</p>
      <p class="muted">回 Obsidian 说「今日西语」生成</p>
      ${last ? `<button class="btn" data-open="${last.date}">看最近一课 · ${fmt(last.date)} ${esc(last.tema)}</button>` : ''}
    </div>
    ${upcoming.length ? `<div class="section"><div class="h2">📅 下一课</div>` +
      upcoming.map(l => `<div class="row" data-open="${l.date}"><div><div class="row-title">${fmt(l.date)} · ${esc(l.tema)}</div><div class="muted">${l.vocab.length} 词</div></div><span class="chev">›</span></div>`).join('') + `</div>` : ''}
  `;
  renderStreak();
}

/* 「每日课程」tab:仅日常打卡课(进度条 + 全部日期列表) */
function renderDaily(){
  const dailyL = state.lessons.filter(l => !l.ref).sort((a,b) => b.date.localeCompare(a.date));
  const p = overallProgress();
  const row = l => `
    <div class="row ${isDone(l.date) ? 'done' : ''}" data-open="${l.date}">
      <div>
        <div class="row-title">${fmt(l.date)} · ${esc(l.tema)}</div>
        <div class="muted">${l.vocab.length} 词${isDone(l.date) ? ' · ✅ 已打卡' : ''}</div>
      </div>
      <span class="chev">›</span>
    </div>`;
  $('#view').innerHTML = `
    <div class="section">
      <div class="h2">📊 课程进度 · ${p.done}/${p.total}</div>
      <div class="progress"><i style="width:${p.pct}%"></i></div>
    </div>
    ${dailyL.length ? `<div class="section"><div class="h2">📅 每日课程 · ${dailyL.length} 课</div>${dailyL.map(row).join('')}</div>` : '<p class="muted">还没有每日课程。</p>'}
  `;
}

/* 「专题学习」tab:仅深度指南/参考文档长文 */
function renderRefs(){
  const refs = state.refs || [];
  $('#view').innerHTML = `
    <div class="section"><div class="h2">📚 专题学习 · ${refs.length} 篇</div>
      ${refs.length ? refs.map(r => `
        <div class="row" data-openref="${r.id}">
          <div><div class="row-title">${esc(r.title)}</div><div class="muted">深度指南 · 点击阅读</div></div>
          <span class="chev">›</span>
        </div>`).join('') : '<p class="muted">还没有专题内容。</p>'}
    </div>`;
}

function senHTML(s){
  return `
    <div class="sentence">
      <button class="speak" data-es="${esc(s.es)}">🔊</button>
      <div class="sen-body">
        <div class="es">${wordify(s.es)}</div>
        <div class="zh">${esc(s.zh)}</div>
        <div class="follow-row">
          <button class="follow" data-follow="${esc(s.es)}">🎙 跟读打分</button>
          <span class="follow-status"></span>
        </div>
      </div>
    </div>`;
}

function renderReview(){
  const due = [];
  for(const l of state.lessons){
    if(l.ref) continue;
    for(const v of l.vocab){
      if(dueDateFor(l, v) === todayStr()) due.push({ l, v });
    }
  }
  $('#view').innerHTML = `
    <div class="section"><div class="h2">🔁 今天到期 · ${due.length}</div>
    ${due.length ? due.map(({l, v}) => `
      <div class="card small"><div class="card-inner">
        <div class="card-face front"><button class="spk" data-es="${esc(v.w)}">🔊</button><span class="w">${esc(v.w)}</span><span class="hint">点一下看释义</span></div>
        <div class="card-face back"><span class="m">${esc(v.m)}</span>${v.ph ? `<span class="ph">🔤 ${esc(v.ph)}</span>` : ''}${v.e ? `<span class="e">${esc(v.e)}</span>` : ''}</div>
      </div></div>
      <div class="review-actions">
        <button class="btn small" data-review="${esc(wordKey(l, v))}">记住了 ✅</button>
      </div>`).join('')
    : `<div class="empty"><div class="empty-emoji">🎉</div><p>今天没有到期的复习</p></div>`}
    </div>`;
  $$('.card').forEach(c => c.addEventListener('click', () => c.classList.toggle('flipped')));
  $$('.spk').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); speak(b.dataset.es); }));
  $$('[data-review]').forEach(b => b.addEventListener('click', () => {
    const [date, w] = b.dataset.review.split('|');
    const l = state.lessons.find(x => x.date === date);
    const v = l && l.vocab.find(x => x.w === w);
    if(l && v) reviewWord(l, v);
  }));
}

function renderLesson(date){
  const l = state.lessons.find(x => x.date === date);
  if(!l) return;
  currentLesson = l;
  const fromList = todayStr() !== date;
  const isToday = todayStr() === date;
  $('#view').innerHTML = (isToday ? paceBarHTML() + statsHTML() : '') + `
    ${fromList ? `<button class="back" data-tab="daily">‹ 每日课程</button>` : ''}
    <div class="lesson-head">
      <h2>🇪🇸 ${esc(l.tema)}</h2>
      <div class="meta"><span class="badge">${esc(l.nivel || 'A1')}</span><span class="muted">${l.ref ? '📌 专题' : fmt(l.date)}</span></div>
      ${isDone(date) ? '<div class="done-badge">✅ 已完成</div>' : ''}
    </div>

    <section class="section">
      <div class="h2">🆕 生词 · ${l.vocab.length} ${l.vocab.length ? '<button class="mini" data-readall="vocab">🔊 全部朗读</button>' : ''}</div>
      ${l.vocab.length ? '<div class="v-hint">👆 左点发音 · 右点翻转看例句</div>' : ''}
      ${l.tip ? `<blockquote class="tip">💡 ${esc(l.tip)}</blockquote>` : ''}
      ${l.vocab.map(v => `
        <div class="vrow">
          <div class="vrow-inner">
            <div class="vface front">
              <div class="v-left" data-es="${esc(v.w)}">
                <span class="v-ico">🔊</span>
                <span class="v-w">${esc(v.w)}</span>
              </div>
              <div class="v-right" data-flip>
                <span class="v-m">${esc(v.m)}</span>
                <span class="v-chev">›</span>
              </div>
            </div>
            <div class="vface back" data-flip>
              ${v.e ? `<div class="v-bk"><span class="v-bk-l">💬</span><span>${esc(v.e)}</span></div>` : ''}
              ${v.ph ? `<div class="v-bk"><span class="v-bk-l">🔤</span><span>${esc(v.ph)}</span></div>` : ''}
              ${v.n ? `<div class="v-bk"><span class="v-bk-l">📌</span><span>${esc(v.n)}</span></div>` : ''}
              <div class="v-back-hint">‹ 点卡片翻回</div>
            </div>
          </div>
        </div>`).join('')}
    </section>

    ${l.grammar ? `<section class="section"><div class="h2">🧩 语法一点通</div><div class="grammar">${l.grammar}</div></section>` : ''}

    ${l.speaking.length ? `<section class="section"><div class="h2">🗣 开口 ${l.speaking.length} 句 ${l.speaking.length ? '<button class="mini" data-readall="speak">🔊 全部朗读</button>' : ''}</div>
      ${l.speaking.map(senHTML).join('')}
    </section>` : ''}

    ${l.review.length ? `<section class="section"><div class="h2">🔁 复习</div>
      ${l.review.map(r => `
        <label class="check"><input type="checkbox" data-date="${date}" data-word="${esc(r.w)}" ${isReviewed(date, r.w) ? 'checked' : ''}><span><b>${esc(r.w)}</b> — ${esc(r.m)}</span></label>`).join('')}
    </section>` : ''}

    ${l.ref
      ? '<div class="done-badge">📌 专题课 · 不参与打卡</div>'
      : `<button class="cta${isDone(date) ? ' done' : ''}" data-checkin="${date}">${isDone(date) ? '已完成 ✅' : '今日打卡'}</button>`}
  ` + (isToday ? tomorrowCardHTML() : '');
  $$('.spk').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); speak(b.dataset.es); }));
  $$('input[type=checkbox][data-date]').forEach(c => c.addEventListener('change', () => toggleReview(c.dataset.date, c.dataset.word)));
  const cta = $('[data-checkin]');
  if(cta) cta.addEventListener('click', () => checkin(cta.dataset.checkin));
  renderStreak();
}

function renderRef(id){
  const r = (state.refs || []).find(x => x.id === id);
  if(!r) return;
  $('#view').innerHTML = `
    <button class="back" data-tab="refs">‹ 专题学习</button>
    <div class="article-head"><h2>${esc(r.title)}</h2><div class="muted">完整导入 · ${fmt(r.date)}</div></div>
    <div class="article">${r.html}</div>
  `;
  window.scrollTo(0, 0);
}

/* ---- 导航 ---- */
function switchTab(tab){
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if(tab === 'today') renderToday();
  else if(tab === 'daily') renderDaily();
  else if(tab === 'refs') renderRefs();
  else if(tab === 'review') renderReview();
  window.scrollTo(0, 0);
}

function bindGlobal(){
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  // 每天时间档位:切换 → 换成对应整套排课(lessons_by_pace)并回到今日页
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pace]');
    if(!b) return;
    const min = parseInt(b.dataset.pace, 10);
    if(min === currentPace()) return;
    setPace(min);
    switchTab('today');
    window.scrollTo(0, 0);
  });
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if(open){ renderLesson(open.dataset.open); window.scrollTo(0, 0); }
  });
  document.addEventListener('click', e => {
    const ref = e.target.closest('[data-openref]');
    if(ref){ renderRef(ref.dataset.openref); window.scrollTo(0, 0); }
  });
  document.addEventListener('click', e => {
    const back = e.target.closest('.back[data-tab]');
    if(back) switchTab(back.dataset.tab);
  });
  // 发音:点任何带 data-es 的元素朗读(生词左点 / 开口句🔊 / 复习卡🔊)
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-es]');
    if(s){ e.stopPropagation(); speak(s.dataset.es); }
  });
  // 生词卡翻转:点右侧 / 背面翻面(原地看例句,高度自适应)
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-flip]');
    if(f){ const card = f.closest('.vrow'); if(card) flipRow(card); }
  });
  // LightPeek:点单词弹词卡(开口句词)
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-w]');
    if(w){ e.stopPropagation(); openWordPopup(w.dataset.w); }
  });
  // 跟读打分
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-follow]');
    if(f){ e.stopPropagation(); startFollow(f.dataset.follow, f); }
  });
  // 全部朗读
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-readall]');
    if(!r || !currentLesson) return;
    const texts = r.dataset.readall === 'speak'
      ? currentLesson.speaking.map(s => s.es)
      : currentLesson.vocab.map(v => v.w);
    speakAll(texts);
  });
  // 词卡弹层
  document.addEventListener('click', e => {
    if(e.target.closest('[data-close]')) $('#wordpopup').hidden = true;
  });
}

/* ---- 启动 ---- */
(async function init(){
  try{
    const res = await fetch('lessons.json?t=' + Date.now());
    const data = await res.json();
    state.lessons = data.lessons || [];
    state.lessonsByPace = data.lessons_by_pace || {};
    state.refs = data.refs || [];
    const pl = state.lessonsByPace[String(currentPace())];
    if(pl) state.lessons = pl;   // 按上次选的每天时间档位载入对应排课
  }catch(e){
    $('#view').innerHTML = '<div class="empty"><div class="empty-emoji">😵</div><p>课程数据加载失败</p><p class="muted">先跑 export.py 生成 lessons.json</p></div>';
  }
  // 词卡弹层
  const popup = document.createElement('div');
  popup.id = 'wordpopup';
  popup.className = 'popup';
  popup.hidden = true;
  popup.innerHTML = `
    <div class="popup-mask" data-close></div>
    <div class="popup-sheet">
      <button class="popup-close" data-close>✕</button>
      <div class="pw-head"><button class="spk" id="pw-spk">🔊</button><span class="pw-w" id="pw-w"></span></div>
      <div class="pw-m" id="pw-m"></div>
      <div id="pw-ph" class="pw-ph" style="display:none"></div>
      <div class="pw-e" id="pw-e"></div>
    </div>`;
  document.body.appendChild(popup);
  $('#pw-spk').addEventListener('click', () => { const w = $('#pw-w').textContent; if(w) speak(w); });

  bindGlobal();
  switchTab('today');
})();
