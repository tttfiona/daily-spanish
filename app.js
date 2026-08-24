/* 每日西语 PWA — 逻辑 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const INTERVALS = [1, 3, 7, 15, 30];
const LS_KEY = 'daily-esp-progress-v1';

const state = { lessons: [], progress: load() };

function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e){ return {}; } }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state.progress)); }

/* ---- 日期工具 ---- */
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayStr(){ return ymd(new Date()); }
function addDays(s, n){ const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function parseDate(s){ return new Date(s + 'T00:00:00'); }
function fmt(s){ const d = parseDate(s); const w = '日一二三四五六'[d.getDay()]; return `${d.getMonth()+1}月${d.getDate()}日 · 周${w}`; }

/* ---- TTS 朗读 ---- */
function speak(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES'; u.rate = 0.9;
  speechSynthesis.speak(u);
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

/* ---- 视图 ---- */
function renderToday(){
  const today = state.lessons.find(l => l.date === todayStr());
  const latest = state.lessons.slice().sort((a,b) => b.date.localeCompare(a.date))[0];
  if(today){ renderLesson(today.date); return; }
  const last = state.lessons.filter(l => l.date < todayStr()).sort((a,b) => b.date.localeCompare(a.date))[0];
  const upcoming = state.lessons.filter(l => l.date > todayStr()).sort((a,b) => a.date.localeCompare(b.date));
  $('#view').innerHTML = `
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

function renderLessons(){
  const list = state.lessons.slice().sort((a,b) => b.date.localeCompare(a.date));
  $('#view').innerHTML = `
    <div class="section"><div class="h2">📚 全部课程</div>
    ${list.map(l => `
      <div class="row ${isDone(l.date) ? 'done' : ''}" data-open="${l.date}">
        <div>
          <div class="row-title">${fmt(l.date)} · ${esc(l.tema)}</div>
          <div class="muted">${l.vocab.length} 词 ${l.ref ? '· 📌 专题' : ''}${isDone(l.date) ? '· ✅ 已打卡' : ''}</div>
        </div>
        <span class="chev">›</span>
      </div>`).join('') || '<p class="muted">还没有课程。</p>'}
    </div>`;
}

function renderReview(){
  const due = [];
  for(const l of state.lessons){
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
  const fromList = todayStr() !== date;
  $('#view').innerHTML = `
    ${fromList ? `<button class="back" data-tab="lessons">‹ 课程</button>` : ''}
    <div class="lesson-head">
      <h2>🇪🇸 ${esc(l.tema)}</h2>
      <div class="meta"><span class="badge">${esc(l.nivel || 'A1')}</span><span class="muted">${fmt(l.date)}</span></div>
      ${isDone(date) ? '<div class="done-badge">✅ 已完成</div>' : ''}
    </div>

    <section class="section">
      <div class="h2">🆕 生词 · ${l.vocab.length}</div>
      ${l.tip ? `<blockquote class="tip">💡 ${esc(l.tip)}</blockquote>` : ''}
      ${l.vocab.map(v => `
        <div class="card"><div class="card-inner">
          <div class="card-face front"><button class="spk" data-es="${esc(v.w)}">🔊</button><span class="w">${esc(v.w)}</span><span class="hint">点卡片看释义</span></div>
          <div class="card-face back"><span class="m">${esc(v.m)}</span>${v.ph ? `<span class="ph">🔤 ${esc(v.ph)}</span>` : ''}${v.e ? `<span class="e">${esc(v.e)}</span>` : ''}${v.n ? `<span class="n">${esc(v.n)}</span>` : ''}</div>
        </div></div>`).join('')}
    </section>

    ${l.grammar ? `<section class="section"><div class="h2">🧩 语法一点通</div><div class="grammar">${l.grammar}</div></section>` : ''}

    ${l.speaking.length ? `<section class="section"><div class="h2">🗣 开口 ${l.speaking.length} 句</div>
      ${l.speaking.map(s => `
        <div class="sentence">
          <button class="speak" data-es="${esc(s.es)}">🔊</button>
          <div><div class="es">${esc(s.es)}</div><div class="zh">${esc(s.zh)}</div></div>
        </div>`).join('')}
    </section>` : ''}

    ${l.review.length ? `<section class="section"><div class="h2">🔁 复习</div>
      ${l.review.map(r => `
        <label class="check"><input type="checkbox" data-date="${date}" data-word="${esc(r.w)}" ${isReviewed(date, r.w) ? 'checked' : ''}><span><b>${esc(r.w)}</b> — ${esc(r.m)}</span></label>`).join('')}
    </section>` : ''}

    ${l.ref
      ? '<div class="done-badge">📌 专题课 · 不参与打卡</div>'
      : `<button class="cta" data-checkin="${date}">${isDone(date) ? '已完成 ✅' : '今日打卡'}</button>`}
  `;
  $$('.card').forEach(c => c.addEventListener('click', () => c.classList.toggle('flipped')));
  $$('.spk').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); speak(b.dataset.es); }));
  $$('.speak').forEach(b => b.addEventListener('click', () => speak(b.dataset.es)));
  $$('input[type=checkbox][data-date]').forEach(c => c.addEventListener('change', () => toggleReview(c.dataset.date, c.dataset.word)));
  const cta = $('[data-checkin]');
  if(cta) cta.addEventListener('click', () => checkin(cta.dataset.checkin));
  renderStreak();
}

/* ---- 导航 ---- */
function switchTab(tab){
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if(tab === 'today') renderToday();
  else if(tab === 'lessons') renderLessons();
  else if(tab === 'review') renderReview();
  window.scrollTo(0, 0);
}

function bindGlobal(){
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if(open){ renderLesson(open.dataset.open); window.scrollTo(0, 0); }
  });
  document.addEventListener('click', e => {
    const back = e.target.closest('.back[data-tab]');
    if(back) switchTab(back.dataset.tab);
  });
}

/* ---- 启动 ---- */
(async function init(){
  try{
    const res = await fetch('lessons.json?t=' + Date.now());
    state.lessons = (await res.json()).lessons || [];
  }catch(e){
    $('#view').innerHTML = '<div class="empty"><div class="empty-emoji">😵</div><p>课程数据加载失败</p><p class="muted">先跑 export.py 生成 lessons.json</p></div>';
  }
  bindGlobal();
  switchTab('today');
})();
