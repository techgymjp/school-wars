(() => {
'use strict';

// ---------- 定数 ----------
const W = 960, H = 540;
const FLOOR_TOP = 176, FLOOR_BOT = 480;
const Y_MIN = 198, Y_MAX = 466;     // 足元の y の範囲
const REACH = 62;                    // 壁からこの距離以内で窓に木刀が届く
const COURSE = 14000;                // ゴールまでの距離 (px) = 140m
const UNIT = 130;                    // 窓1枚ぶんの間隔
const V_CRUISE = 280, V_MAX = 680, V_MIN = 90;
const PAR_TIME = 90;                 // タイムボーナスの基準秒
const POSTERS = ['廊下を走るな','暴力追放','整理整頓','信は力なり','遅刻厳禁','挨拶運動','廊下を走るな'];
const ROOM_COUNT = 11;                // 教室の札の数（名前は js/i18n.js の rooms）
const t = I18N.t;
const STORE_KEY = 'rokabakuso.best.v1';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR;

const root = document.documentElement;
// Android アプリ（Capacitor）で動いているか
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = name => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
if (NATIVE) root.classList.add('native');
const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (COARSE) root.classList.add('coarse');
root.classList.add('in-menu');

// ---------- スマホの向き ----------
const mqPortrait = window.matchMedia ? matchMedia('(orientation: portrait)') : null;
let allowPortrait = false;
function syncOrient() {
  // アプリは横画面に固定しているので、案内は Web 版だけ
  const block = !NATIVE && COARSE && !!mqPortrait && mqPortrait.matches && !allowPortrait;
  root.classList.toggle('portrait-block', block);
  if (block) for (const k in keys) keys[k] = false;
}
function isBlocked() { return root.classList.contains('portrait-block'); }
// 全画面にできる端末（主に Android）では全画面＋横向き固定を試す。できなければ何もしない
function goLandscape() {
  if (!COARSE || NATIVE) return;
  try {
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
    if (!document.fullscreenElement && root.requestFullscreen) {
      const p = root.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.then) p.then(lock).catch(() => {});
    } else lock();
  } catch (e) {}
}

// ---------- 乱数 ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const pick = a => a[(Math.random() * a.length) | 0];

// ---------- 状態 ----------
let state = 'title';   // title / countdown / play / crash / continue / goal / result
let wins = [], doors = [], ents = [], parts = [], pops = [];
let bike, camX = 0, runT = 0, countdown = 0, shake = 0, clock = 0;
let glass = 0, glassScore = 0, combo = 0, maxCombo = 0, lastBreak = -9, teacherHits = 0;
let crashT = 0, finishT = 0, resultShown = false, hornCD = 0, resultReadyAt = 0;
let paused = false, continued = false, contT = 0, gameOvers = 0;
const keys = { up: false, down: false, accel: false, brake: false, swing: false, horn: false };
if (mqPortrait) {
  if (mqPortrait.addEventListener) mqPortrait.addEventListener('change', syncOrient);
  else if (mqPortrait.addListener) mqPortrait.addListener(syncOrient);
}
addEventListener('resize', syncOrient);
document.getElementById('portraitOk').addEventListener('click', () => { allowPortrait = true; syncOrient(); });
document.getElementById('landBtn').addEventListener('click', goLandscape);
syncOrient();

function newBike() {
  return { x: 160, y: 330, v: 0, vy: 0, stun: 0, inv: 0, swingT: 0, swingCD: 0, swingSide: 0, wheel: 0, rot: 0, flap: 0 };
}

function buildCourse(withPeople) {
  const R = mulberry32(19841006); // 毎回同じコースで競えるよう固定シード
  wins = []; doors = []; ents = [];
  let slot = 0, room = 0;
  for (let x = 420; x < COURSE - 160; x += UNIT, slot++) {
    if (slot % 9 === 4) {
      doors.push({ x, room: Math.min(room, ROOM_COUNT - 1), poster: POSTERS[room % POSTERS.length] });
      room++;
    } else {
      wins.push({ side: 0, x, w: 108, broken: false, shards: null, crack: R() });
    }
    wins.push({ side: 1, x: x + 45, w: 108, broken: false, shards: null, crack: R() });
  }
  if (!withPeople) return;
  let x = 1050;
  while (x < COURSE - 380) {
    const prog = x / COURSE;
    const staff = x > COURSE * 0.82;          // 職員室の前は先生だらけ
    const pTeacher = staff ? 0.55 : 0.18 + prog * 0.2;
    const r = R();
    if (r < 0.13 + prog * 0.07) {
      // 立ち話のグループ
      const n = R() < 0.4 ? 3 : 2;
      const gy = Y_MIN + 20 + R() * (Y_MAX - Y_MIN - 40);
      for (let i = 0; i < n; i++) {
        ents.push(makeStudent(x + i * 24, clamp(gy + (i % 2 ? 16 : -8), Y_MIN, Y_MAX), 'stand', R));
      }
      x += 30;
    } else if (r < 0.13 + pTeacher) {
      ents.push(makeTeacher(x, Y_MIN + R() * (Y_MAX - Y_MIN), R));
    } else {
      const mode = R() < 0.55 ? 'cross' : (R() < 0.6 ? 'walk' : 'stand');
      ents.push(makeStudent(x, Y_MIN + R() * (Y_MAX - Y_MIN), mode, R));
    }
    x += 200 - prog * 60 + R() * 190;
  }
}
function makeStudent(x, y, mode, R) {
  return {
    type: 's', x, y, mode, g: R() < 0.5 ? 1 : 0,
    vy: (R() < 0.5 ? -1 : 1) * (35 + R() * 25), vx: mode === 'walk' ? -(30 + R() * 25) : 0,
    phase: R() * 6, dir: R() < 0.7 ? -1 : 1, panic: 0, scared: false, down: false, downT: 0, bubble: null
  };
}
function makeTeacher(x, y, R) {
  return { type: 't', x, y, phase: R() * 6, dir: -1, alert: false, down: false, downT: 0, vx: 0, spin: 0, bubble: null };
}

// ---------- 音 ----------
let AC = null, master = null, eng = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('rokabakuso.mute') === '1'; } catch (e) {}
const muteBtn = document.getElementById('mute');
function syncMute() { muteBtn.textContent = t(muted ? 'sound.off' : 'sound.on'); if (master) master.gain.value = muted ? 0 : 0.55; }
syncMute();
function toggleMute() { muted = !muted; try { localStorage.setItem('rokabakuso.mute', muted ? '1' : '0'); } catch (e) {} syncMute(); }
muteBtn.addEventListener('click', e => { toggleMute(); e.currentTarget.blur(); });

// 広告の表示中やアプリが裏に回ったときに音を止める（js/ads.js からも使う）
window.Sfx = {
  suspend() { try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {} },
  resume() { try { if (AC && AC.state === 'suspended' && !document.hidden) AC.resume(); } catch (e) {} },
};
function silenceEngine() {
  if (!eng) return;
  const t = AC.currentTime;
  eng.g.gain.cancelScheduledValues(t);
  eng.g.gain.setValueAtTime(0, t);
}
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  master = AC.createGain(); master.connect(AC.destination);
  syncMute();
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1180;
  f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 4;
  g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
  o1.start(); o2.start();
  eng = { o1, o2, f, g };
}
function setEngine(v, on) {
  if (!eng) return;
  const t = AC.currentTime;
  const fr = 34 + v * 0.105 + (on ? Math.sin(clock * 40) * 1.5 : 0);
  eng.o1.frequency.setTargetAtTime(fr, t, 0.04);
  eng.o2.frequency.setTargetAtTime(fr, t, 0.04);
  eng.f.frequency.setTargetAtTime(300 + v * 2.2, t, 0.05);
  eng.g.gain.setTargetAtTime(on ? 0.075 : 0, t, on ? 0.05 : 0.2);
}
function noise(dur, type, freq, vol, q) {
  if (!AC || muted) return;
  const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rnd(0.8, 1.2);
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, rnd(0, 0.5)); s.stop(t + dur + 0.05);
}
function tone(type, f0, f1, dur, vol, delay) {
  if (!AC || muted) return;
  const t = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  glass() { noise(0.4, 'highpass', 2600, 0.5); noise(0.15, 'bandpass', 1400, 0.3, 2); for (let i = 0; i < 4; i++) tone('sine', rnd(3200, 6500), rnd(3000, 6000), 0.22, 0.05, rnd(0.02, 0.2)); },
  swing() { noise(0.12, 'bandpass', 900, 0.12, 1.5); },
  thud() { tone('sine', 140, 45, 0.25, 0.5); noise(0.2, 'lowpass', 500, 0.35); },
  crash() { tone('sine', 120, 30, 0.6, 0.6); noise(0.7, 'lowpass', 900, 0.6); noise(0.5, 'highpass', 2000, 0.25); },
  whistle() {
    if (!AC || muted) return;
    const t = AC.currentTime, o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain();
    o.frequency.value = 2900; l.frequency.value = 28; lg.gain.value = 140;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.setValueAtTime(0.08, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + 0.45); l.stop(t + 0.45);
  },
  horn() { // ミュージックホーン
    if (!AC || muted) return;
    // エアホーンらしい割れた金属音：のこぎり波を歪ませ、ラッパの共鳴帯域を持ち上げる
    const t0 = AC.currentTime + 0.02;
    const shaper = AC.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 3.2); }
    shaper.curve = curve;
    const body = AC.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 1500; body.Q.value = 1.2; body.gain.value = 9;
    const hi = AC.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 4200;
    const lo = AC.createBiquadFilter(); lo.type = 'highpass'; lo.frequency.value = 280;
    const out = AC.createGain(); out.gain.value = 0.16;
    shaper.connect(body); body.connect(hi); hi.connect(lo); lo.connect(out); out.connect(master);
    // チャルメラ「ドレミー レド、ドレミレドレー」。[周波数, 拍数]、周波数 0 は休符
    const C5 = 523.25, D5 = 587.33, E5 = 659.25;
    const seq = [[C5, 1], [D5, 1], [E5, 2], [D5, 1], [C5, 2], [0, 1], [C5, 1], [D5, 1], [E5, 1], [D5, 1], [C5, 1], [D5, 4]];
    const beat = 0.17;
    let at = 0;
    seq.forEach(([f, n], i) => {
      const t = t0 + at * beat;
      at += n;
      if (!f) return;
      const dur = n * beat + (i === seq.length - 1 ? 0.1 : 0.03);
      const g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.018);
      g.gain.setValueAtTime(0.5, t + dur - 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(shaper);
      // 空気圧で少し低く鳴り出してから音程に乗る＋2本のラッパのうなり
      [-9, 9].forEach(cents => {
        const o = AC.createOscillator();
        o.type = 'sawtooth';
        o.detune.value = cents;
        o.frequency.setValueAtTime(f * 0.95, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
        o.connect(g); o.start(t); o.stop(t + dur + 0.02);
      });
      const sq = AC.createOscillator(), sg = AC.createGain();
      sq.type = 'square'; sq.frequency.value = f / 2; sg.gain.value = 0.25;
      sq.connect(sg); sg.connect(g); sq.start(t); sq.stop(t + dur + 0.02);
    });
  },
  beep(hi) { tone('square', hi ? 1320 : 660, hi ? 1320 : 660, hi ? 0.4 : 0.15, 0.08); },
  fanfare() { [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, i === 3 ? 0.5 : 0.12, 0.07, i * 0.12)); },
};

// ---------- 入力 ----------
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowRight: 'accel', KeyD: 'accel', ArrowLeft: 'brake', KeyA: 'brake',
  Space: 'swing', KeyZ: 'swing', KeyJ: 'swing', KeyX: 'horn', KeyK: 'horn'
};
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k && state !== 'title' && state !== 'result') e.preventDefault();
  if (e.code === 'KeyM') { toggleMute(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && canPause()) { e.preventDefault(); setPaused(!paused); return; }
  if (paused) { if (k || e.code === 'Enter') { e.preventDefault(); setPaused(false); } return; }
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); startGame(); return; }
  if (state === 'result' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat && performance.now() > resultReadyAt && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); retry(); return; }
  if (state === 'result' && e.code === 'Escape') { toTitle(); return; }
  if (k) keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const on = e => {
    e.preventDefault();
    if (paused) { setPaused(false); return; }
    keys[k] = true; b.classList.add('on');
    if (state === 'title') startGame();
  };
  const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

// ---------- 画面遷移 ----------
const elTitle = document.getElementById('title'), elResult = document.getElementById('result');
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('againBtn').addEventListener('click', retry);
document.getElementById('backBtn').addEventListener('click', toTitle);

// 「もう一回」：Android アプリでは 2 回に 1 回、始める前に全画面広告を出す
let retryBusy = false;
async function retry() {
  if (retryBusy) return;
  gameOvers++;
  if (Ads.available && gameOvers % 2 === 0) {
    retryBusy = true;
    await Ads.showInterstitial();
    retryBusy = false;
  }
  startGame();
}

// ---------- 一時停止 ----------
function canPause() { return state === 'countdown' || state === 'play' || state === 'crash' || state === 'goal'; }
function setPaused(v) {
  if (v && !canPause()) return;
  paused = v;
  for (const k in keys) keys[k] = false;
  document.querySelectorAll('#touch button.on').forEach(b => b.classList.remove('on'));
  if (v) silenceEngine();
  last = performance.now();
}
cv.addEventListener('pointerdown', () => { if (paused) setPaused(false); });
// アプリが裏に回ったら一時停止して音を止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { setPaused(true); window.Sfx.suspend(); }
  else window.Sfx.resume();
});
// Android の戻るボタン：プレイ中は一時停止の切り替え、タイトル・結果画面ではアプリを閉じる
if (plugin('App')) {
  plugin('App').addListener('backButton', () => {
    if (state === 'title' || state === 'result') plugin('App').exitApp();
    else if (state === 'continue') giveUp();
    else setPaused(!paused);
  });
}

// ---------- リワード広告で続行 ----------
// 生徒を轢いてアウトになったとき、Android アプリでは広告を見て 1 回だけ続行できる
const elCont = document.getElementById('continue');
const contWatch = document.getElementById('contWatch'), contNote = document.getElementById('contNote');
let contBusy = false;
function canContinue() { return !continued && Ads.available; }
function showContinue() {
  state = 'continue'; contT = 10; contBusy = false;
  contWatch.disabled = false;
  contWatch.textContent = t('cont.watch');
  contNote.textContent = '';
  document.getElementById('contCount').textContent = '10';
  elCont.hidden = false;
  root.classList.add('in-menu');
  setTimeout(() => { if (state === 'continue') contWatch.focus({ preventScroll: true }); }, 50);
}
function giveUp() {
  if (state !== 'continue') return;
  elCont.hidden = true;
  showResult(false);
}
document.getElementById('contGiveUp').addEventListener('click', giveUp);
contWatch.addEventListener('click', async () => {
  if (state !== 'continue' || contBusy) return;
  contBusy = true;
  contWatch.disabled = true;
  contWatch.textContent = t('cont.loading');
  const result = await Ads.showRewarded();
  if (state !== 'continue') return;
  if (result === 'unavailable') {
    contNote.textContent = t('cont.fail');
    setTimeout(giveUp, 2200);
    return;
  }
  if (result !== 'rewarded') { giveUp(); return; }
  elCont.hidden = true;
  root.classList.remove('in-menu');
  continued = true;
  // 起き上がって再出発。少しのあいだは誰にもぶつからない
  bike.rot = 0; bike.v = 160; bike.stun = 0; bike.inv = 2;
  state = 'play';
  popup(bike.x + 40, bike.y - 120, t('cont.restart'), '#f2c14e', 26, 1.2);
  last = performance.now();
});
function startGame() {
  if (isBlocked()) return;
  initAudio();
  goLandscape();
  root.classList.remove('in-menu');
  buildCourse(true);
  bike = newBike();
  parts = []; pops = [];
  camX = 0; runT = 0; countdown = 3.2; shake = 0;
  glass = 0; glassScore = 0; combo = 0; maxCombo = 0; lastBreak = -9; teacherHits = 0;
  crashT = 0; finishT = 0; resultShown = false; hornCD = 0;
  paused = false; continued = false;
  elCont.hidden = true;
  state = 'countdown';
  elTitle.hidden = true; elResult.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  lastBeep = 4;
}
function toTitle() {
  state = 'title';
  paused = false;
  root.classList.add('in-menu');
  elResult.hidden = true; elTitle.hidden = false;
  renderBoard(document.getElementById('boardTitle'), -1);
  startDemo();
  document.getElementById('startBtn').focus({ preventScroll: true });
}
function startDemo() {
  buildCourse(false);
  bike = newBike(); bike.x = 300; bike.v = 320; bike.y = Y_MIN + 10;
  parts = []; pops = [];
}

// ---------- 記録 ----------
function loadBest() { try { const a = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveBest(a) { try { localStorage.setItem(STORE_KEY, JSON.stringify(a)); } catch (e) {} }
function renderBoard(el, newIdx) {
  const a = loadBest();
  let h = `<h2>${t('board.title')}</h2>`;
  if (!a.length) h += `<p class="empty">${t('board.empty')}</p>`;
  else {
    h += '<ol>';
    a.forEach((r, i) => {
      h += `<li class="${i === newIdx ? 'new' : ''}"><span>${i + 1}.</span><span>${rankOf(r.score)}</span><span>${t('board.score', { n: r.score.toLocaleString() })}</span>` +
        `<span class="sub">${t('board.sub', { t: r.time.toFixed(2), n: r.glass })}</span></li>`;
    });
    h += '</ol>';
  }
  el.innerHTML = h;
}
function rankOf(score) {
  if (score >= 40000) return t('rank.4');
  if (score >= 30000) return t('rank.3');
  if (score >= 21000) return t('rank.2');
  if (score >= 12000) return t('rank.1');
  return t('rank.0');
}
function showResult(goal) {
  resultShown = true;
  state = 'result';
  const timeBonus = goal ? Math.max(0, Math.round((PAR_TIME - runT) * 300)) : 0;
  const total = goal ? glassScore + timeBonus : 0;
  const head = document.getElementById('resHead');
  head.textContent = t(goal ? 'res.goal' : 'res.out');
  head.className = 'result-head ' + (goal ? 'goal' : 'out');
  document.getElementById('resEyebrow').textContent = t(goal ? 'res.goalEyebrow' : 'res.outEyebrow');
  document.getElementById('resNote').textContent = goal
    ? t('res.goalNote', { t: runT.toFixed(2) })
    : t('res.outNote');
  const total2 = wins.length;
  const rows = [
    [t('st.time'), goal ? t('st.timeV', { t: runT.toFixed(2) }) : '—'],
    [t('st.glass'), t('st.glassV', { n: glass, all: total2 })],
    [t('st.combo'), t('st.comboV', { n: maxCombo })],
    [t('st.teacher'), t('st.teacherV', { n: teacherHits })],
    [t('st.glassScore'), t('st.pts', { n: glassScore.toLocaleString() })],
    [t('st.bonus'), goal ? t('st.pts', { n: timeBonus.toLocaleString() }) : '—'],
  ];
  document.getElementById('resStats').innerHTML = rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') +
    `<dt class="total">${t('st.total')}</dt><dd class="total">${goal ? t('st.pts', { n: total.toLocaleString() }) : t('st.dq')}</dd>`;
  const rankEl = document.getElementById('resRank');
  let newIdx = -1;
  if (goal) {
    const rank = rankOf(total);
    rankEl.innerHTML = `<small>${t('res.rankLabel')}</small>${rank}`;
    const a = loadBest();
    const rec = { score: total, time: runT, glass, rank, at: Date.now() };
    a.push(rec);
    a.sort((p, q) => q.score - p.score);
    a.length = Math.min(a.length, 5);
    newIdx = a.indexOf(rec);
    saveBest(a);
  } else {
    rankEl.innerHTML = `<small>${t('res.rankLabel')}</small>${t('rank.out')}`;
  }
  renderBoard(document.getElementById('boardResult'), newIdx);
  setShare(goal
    ? t('share.goal', { t: runT.toFixed(2), n: glass, score: total.toLocaleString(), rank: rankOf(total) })
    : t('share.out', { n: glass, rank: t('rank.out') }));
  elResult.hidden = false;
  root.classList.add('in-menu');
  resultReadyAt = performance.now() + 700;
  setTimeout(() => { if (state === 'result') document.getElementById('againBtn').focus({ preventScroll: true }); }, 50);
}

// ---------- シェア ----------
// シェアに付けるURL。<meta name="share-url"> があればそれを使い、なければ公開中のページのURL
function shareUrl() {
  const m = document.querySelector('meta[name="share-url"]');
  if (m && m.content) return m.content;
  return /^https?:$/.test(location.protocol) ? location.href.split('#')[0] : '';
}
let shareText = '';
const shareCopy = document.getElementById('shareCopy'), shareNative = document.getElementById('shareNative');
function setShare(text) {
  const url = shareUrl();
  const tag = t('share.tag');
  shareText = [text, tag, url].filter(Boolean).join(' ');
  const xq = new URLSearchParams({ text: `${text}\n${tag}` });
  if (url) xq.set('url', url);
  document.getElementById('shareX').href = 'https://twitter.com/intent/tweet?' + xq.toString();
  document.getElementById('shareLine').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(shareText);
  shareCopy.textContent = t('share.copy');
  shareNative.hidden = !(plugin('Share') || (COARSE && navigator.share));
}
shareCopy.addEventListener('click', () => {
  const done = () => { shareCopy.textContent = t('share.copied'); };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = shareText; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    shareCopy.textContent = t(ok ? 'share.copied' : 'share.copyFail');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareText).then(done, fallback);
    else fallback();
  } catch (e) { fallback(); }
});
shareNative.addEventListener('click', async () => {
  // アプリでは Android の共有メニュー（LINE・X など）を出す
  const nativeShare = plugin('Share');
  try {
    if (nativeShare) await nativeShare.share({ title: t('share.title'), text: shareText, dialogTitle: t('share.dialog') });
    else await navigator.share({ text: shareText });
  } catch (e) { /* キャンセル */ }
});
// アプリでは共有メニューから送れるので、X と LINE のボタンは「シェア」1 つにまとめる
if (NATIVE) {
  document.getElementById('shareX').hidden = true;
  document.getElementById('shareLine').hidden = true;
}
// 「その他」/「シェア」ボタンの文字は言語に合わせて付け替える
function labelShareNative() { shareNative.textContent = t(NATIVE ? 'share.native' : 'share.more'); }
labelShareNative();

// ---------- 言語 ----------
I18N.apply();
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => I18N.setLang(b.dataset.lang)));
I18N.onChange(() => {
  syncMute();
  labelShareNative();
  renderBoard(document.getElementById('boardTitle'), -1);
});

// ---------- アプリ版の表示 ----------
// どのビルドが入っているか分かるよう、アプリ版はタイトル画面にバージョンとプライバシーポリシーを出す
if (NATIVE) {
  document.getElementById('legal').hidden = false;
  if (window.APP_VERSION && window.APP_VERSION !== 'dev') document.getElementById('buildInfo').textContent = window.APP_VERSION;
}
// EU など同意が必要な地域では、タイトル画面から広告の同意内容を変更できるようにする
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) document.getElementById('adPrivacy').hidden = false; });
document.getElementById('adPrivacyLink').addEventListener('click', e => { e.preventDefault(); Ads.showPrivacyOptions(); });

// ---------- ゲーム処理 ----------
let lastBeep = 4;
function popup(x, y, text, color, size, life) {
  pops.push({ x, y, text, color: color || '#fff', size: size || 22, life: life || 0.9, max: life || 0.9 });
}
function genShards() {
  const s = [];
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (const c of corners) {
    if (Math.random() < 0.25) continue;
    const ax = c[0] ? 1 - rnd(0.15, 0.45) : rnd(0.15, 0.45);
    const by = c[1] ? 1 - rnd(0.2, 0.6) : rnd(0.2, 0.6);
    s.push([[c[0], c[1]], [ax, c[1]], [c[0] ? 1 - rnd(0.05, 0.25) : rnd(0.05, 0.25), c[1] ? 1 - rnd(0.1, 0.3) : rnd(0.1, 0.3)], [c[0], by]]);
  }
  // 上辺・下辺に刺さった破片
  for (let i = 0; i < 2; i++) {
    const cx = rnd(0.3, 0.7), top = i === 0;
    s.push([[cx - 0.12, top ? 0 : 1], [cx + rnd(-0.05, 0.05), top ? rnd(0.2, 0.4) : 1 - rnd(0.2, 0.4)], [cx + 0.1, top ? 0 : 1]]);
  }
  return s;
}
function winRect(w) {
  return w.side === 0 ? { y: 40, h: 94 } : { y: 494, h: 46 };
}
function breakWin(w, demo) {
  w.broken = true; w.shards = genShards();
  const r = winRect(w);
  for (let i = 0; i < 16; i++) {
    const far = w.side === 0;
    parts.push({
      k: 'shard', x: w.x + rnd(0, w.w), y: r.y + rnd(0, r.h),
      vx: bike.v * rnd(0.1, 0.5) + rnd(-90, 90), vy: far ? rnd(-160, 40) : rnd(-380, -160),
      rot: rnd(0, 6), vr: rnd(-12, 12), size: rnd(4, 11), life: rnd(1.6, 3.2),
      floor: far ? FLOOR_TOP + rnd(4, 34) : 600
    });
  }
  if (demo) return;
  glass++;
  combo = (runT - lastBreak < 1.2) ? combo + 1 : 1;
  lastBreak = runT;
  if (combo > maxCombo) maxCombo = combo;
  const pts = 100 + Math.min(combo - 1, 20) * 10;
  glassScore += pts;
  const py = w.side === 0 ? 70 : 470;
  popup(w.x + w.w / 2, py, pick(I18N.list('smash')), '#bfe9f5', 24, 0.7);
  popup(w.x + w.w / 2, py + 26, '+' + pts, '#f2c14e', 18, 0.7);
  shake = Math.max(shake, 3);
  sfx.glass();
}
function tryBreak(demo) {
  const nearFar = bike.y < Y_MIN + REACH, nearNear = bike.y > Y_MAX - REACH;
  if (!nearFar && !nearNear) return;
  const a = bike.x - 34, b = bike.x + 84;
  for (const w of wins) {
    if (w.broken || w.x > b || w.x + w.w < a) continue;
    if ((w.side === 0 && nearFar) || (w.side === 1 && nearNear)) breakWin(w, demo);
  }
}
function startSwing() {
  bike.swingT = 0.2; bike.swingCD = 0.3;
  bike.swingSide = bike.y < Y_MIN + REACH ? -1 : bike.y > Y_MAX - REACH ? 1 : 0;
  if (state === 'play') sfx.swing();
}

function hitTeacher(e) {
  e.down = true; e.downT = 0; e.vx = Math.max(160, bike.v * 0.7); e.bubble = { text: t('say.oof'), t: 0.9 };
  bike.v *= 0.3; bike.stun = 0.9;
  teacherHits++; combo = 0;
  shake = 12;
  popup(bike.x + 20, bike.y - 110, t('pop.slow'), '#f2c14e', 22, 1.1);
  sfx.thud();
}
function hitStudent(e) {
  e.down = true; e.downT = 0; e.vx = bike.v * 0.35; e.bubble = { text: t('say.whoa'), t: 1.2 };
  state = 'crash'; crashT = 0;
  shake = 18;
  sfx.crash();
}

function update(dt) {
  clock += dt;
  if (state === 'title') { updateDemo(dt); updateFX(dt); return; }
  if (state === 'countdown') {
    countdown -= dt;
    const n = Math.ceil(countdown - 0.2);
    if (n < lastBeep && n >= 1) { lastBeep = n; sfx.beep(false); }
    if (countdown <= 0.2) { state = 'play'; sfx.beep(true); popup(bike.x + 260, 300, '', '#fff', 1, 0.1); }
    bike.wheel += dt * 4;
    setEngine(120 + Math.max(0, Math.sin(clock * 6)) * 300, true);
  } else if (state === 'play') {
    runT += dt;
    updateBike(dt);
    collide();
    if (bike.x >= COURSE) { state = 'goal'; finishT = 0; sfx.fanfare(); }
    setEngine(bike.v, true);
  } else if (state === 'crash') {
    crashT += dt;
    bike.v = Math.max(0, bike.v - 520 * dt);
    bike.x += bike.v * dt;
    bike.rot = Math.min(1.45, bike.rot + dt * 6);
    setEngine(0, false);
    if (crashT > 1.5 && !resultShown) {
      if (canContinue()) showContinue();
      else showResult(false);
    }
  } else if (state === 'continue') {
    contT -= dt;
    document.getElementById('contCount').textContent = String(Math.max(0, Math.ceil(contT)));
    if (contT <= 0 && !contBusy) giveUp();
  } else if (state === 'goal') {
    finishT += dt;
    bike.v = Math.max(0, bike.v - 700 * dt);
    bike.x += bike.v * dt;
    bike.wheel += bike.v * dt / 13;
    setEngine(bike.v, true);
    if (finishT > 1.4 && !resultShown) { setEngine(0, false); showResult(true); }
  } else if (state === 'result') {
    setEngine(0, false);
  }
  updateEnts(dt);
  updateFX(dt);
  camX = Math.max(0, bike.x - 230);
}

function updateBike(dt) {
  const b = bike;
  if (keys.accel) b.v += 520 * dt;
  else if (keys.brake) b.v -= 760 * dt;
  else if (b.v < V_CRUISE) b.v += 300 * dt;
  else b.v -= 160 * dt;
  if (b.stun > 0) { b.stun -= dt; b.v = Math.min(b.v, 150); }
  if (b.inv > 0) b.inv -= dt;
  b.v = clamp(b.v, keys.brake ? V_MIN : (b.stun > 0 ? 40 : V_MIN), V_MAX);
  const target = ((keys.down ? 1 : 0) - (keys.up ? 1 : 0)) * 330;
  b.vy += (target - b.vy) * Math.min(1, dt * 12);
  b.y += b.vy * dt;
  if (b.y < Y_MIN || b.y > Y_MAX) {
    b.y = clamp(b.y, Y_MIN, Y_MAX);
    if (Math.abs(b.vy) > 60 && b.v > 200) {
      b.v -= 120 * dt;
      if (Math.random() < 0.6) parts.push({ k: 'spark', x: b.x + rnd(-30, 30), y: b.y - rnd(10, 40), vx: -b.v * 0.3 + rnd(-50, 50), vy: rnd(-200, -40), life: 0.3, size: 2 });
    }
    b.vy = 0;
  }
  b.x += b.v * dt;
  b.wheel += b.v * dt / 13;
  b.swingCD -= dt;
  if (b.swingT > 0) { b.swingT -= dt; tryBreak(false); }
  if (keys.swing && b.swingCD <= 0) startSwing();
  hornCD -= dt;
  if (keys.horn && hornCD <= 0) honk();
}
function honk() {
  hornCD = 3.5;
  sfx.horn();
  popup(bike.x - 30, bike.y - 130, t('pop.horn'), '#e0333d', 22, 1.1);
  for (const e of ents) {
    const ahead = e.x - bike.x;
    if (e.type !== 's' || e.down || e.scared || ahead < 0 || ahead > 650) continue;
    scare(e, 0.75);
  }
}
function scare(e, dur) {
  e.panic = dur; e.scared = true;
  e.fleeDir = e.y >= bike.y ? 1 : -1;
  if ((e.fleeDir > 0 && e.y > Y_MAX - 30) || (e.fleeDir < 0 && e.y < Y_MIN + 30)) e.fleeDir *= -1;
  e.bubble = { text: pick(I18N.list('say.scream')), t: 0.9 };
}
function collide() {
  if (bike.inv > 0) return;
  for (const e of ents) {
    if (e.down) continue;
    const dx = e.x - bike.x;
    if (dx < -30 || dx > 44 || Math.abs(e.y - bike.y) > 17) continue;
    if (e.type === 's') { hitStudent(e); return; }
    hitTeacher(e);
  }
}
function updateEnts(dt) {
  for (const e of ents) {
    if (e.x < camX - 300 || e.x > camX + W + 260) continue;
    if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
    if (e.down) {
      e.downT += dt; e.x += e.vx * dt; e.vx *= Math.max(0, 1 - dt * 3.5);
      continue;
    }
    const ahead = e.x - bike.x;
    const live = state === 'play';
    if (e.type === 's') {
      if (live && !e.scared && ahead > 0 && ahead < 230 && Math.abs(e.y - bike.y) < 70) scare(e, 0.55);
      if (e.panic > 0) {
        e.panic -= dt; e.phase += dt * 14;
        e.y += e.fleeDir * 125 * dt;
      } else if (e.scared) {
        e.phase += dt * 3;
      } else if (e.mode === 'cross') {
        e.phase += dt * 8; e.y += e.vy * dt;
        if (e.y < Y_MIN || e.y > Y_MAX) e.vy *= -1;
      } else if (e.mode === 'walk') {
        e.phase += dt * 8; e.x += e.vx * dt;
      } else e.phase += dt;
    } else {
      e.phase += dt * 6;
      if (live && ahead > 0 && ahead < 520) {
        if (!e.alert) { e.alert = true; e.bubble = { text: t('say.hey'), t: 1.2 }; sfx.whistle(); }
        const dy = bike.y - e.y;
        e.y += clamp(dy, -95 * dt, 95 * dt);
        e.x -= 25 * dt;
      }
    }
    e.y = clamp(e.y, Y_MIN, Y_MAX);
  }
}
function updateDemo(dt) {
  const b = bike;
  b.v = 330;
  const cyc = Math.floor(clock / 4.5) % 2;
  const ty = cyc ? Y_MAX - 12 : Y_MIN + 12;
  b.vy = clamp((ty - b.y) * 3, -260, 260);
  b.y = clamp(b.y + b.vy * dt, Y_MIN, Y_MAX);
  b.x += b.v * dt; b.wheel += b.v * dt / 13;
  b.swingCD -= dt;
  if (b.swingT > 0) { b.swingT -= dt; tryBreak(true); }
  if (b.swingCD <= 0 && (b.y < Y_MIN + REACH || b.y > Y_MAX - REACH)) startSwing();
  if (b.x > COURSE - 800) startDemo();
  camX = Math.max(0, b.x - 230);
}
function updateFX(dt) {
  shake = Math.max(0, shake - dt * 40);
  for (const p of parts) {
    p.life -= dt;
    if (p.k === 'shard') {
      if (p.y < p.floor) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      else { p.y = p.floor; p.vx *= 0.85; p.x += p.vx * dt; p.vr = 0; }
    } else { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  parts = parts.filter(p => p.life > 0 && p.x > camX - 200);
  if (parts.length > 700) parts.splice(0, parts.length - 700);
  for (const p of pops) { p.life -= dt; p.y -= 40 * dt; }
  pops = pops.filter(p => p.life > 0);
}

// ---------- 描画 ----------
const C = {
  ceil: '#cfc6ad', wall: '#e2d8bd', wallShade: '#cdbf9f', wains: '#5d6b4f', wainsTop: '#46523b',
  frame: '#7a4f2c', frameHi: '#9a6a3f', glass: 'rgba(170,220,235,0.55)', room: '#2c3241', sky: '#87b9d6',
  floorA: '#9b6b40', floorB: '#8e6039', seam: '#6f4a2a', door: '#86603b', nearWall: '#d6ccb0'
};
const FONT_DOT = '"DotGothic16", "MS Gothic", monospace';
const FONT_DISP = '"Dela Gothic One", "Hiragino Kaku Gothic StdN", sans-serif';

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawFarWall();
  drawFloor();
  drawFinish();
  // 奥から順に描く
  const list = [];
  for (const e of ents) if (e.x > camX - 120 && e.x < camX + W + 120) list.push(e);
  list.push(bike);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) {
    if (o === bike) drawBike(o);
    else if (o.type === 's') drawStudent(o);
    else drawTeacher(o);
  }
  for (const o of list) if (o !== bike && o.bubble) drawBubble(o);
  drawParts();
  drawNearWall();
  drawPops();
  ctx.restore();
  if (state !== 'title') drawHUD();
  if (state === 'countdown') drawCountdown();
  if (state === 'crash' && crashT > 0.25) bigText(t('big.out'), '#e0333d', '#000', Math.min(1, (crashT - 0.25) * 4));
  if (state === 'goal') bigText(t('big.goal'), '#f2c14e', '#e0333d', Math.min(1, finishT * 4));
  if (paused) drawPause();
}
function drawPause() {
  ctx.fillStyle = 'rgba(10,10,16,.6)'; ctx.fillRect(0, 0, W, H);
  bigText(t('big.pause'), '#f1eadb', '#e0333d', 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `20px ${FONT_DOT}`; ctx.fillStyle = '#f1eadb';
  ctx.fillText(t(NATIVE || COARSE ? 'pause.tc' : 'pause.kb'), W / 2, H / 2 + 80);
}

function drawFarWall() {
  // 天井
  ctx.fillStyle = C.ceil; ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 22, W, 3);
  // 壁
  ctx.fillStyle = C.wall; ctx.fillRect(0, 25, W, 120);
  // 蛍光灯
  for (let x = Math.floor(camX / 260) * 260 - 260; x < camX + W + 260; x += 260) {
    const X = x - camX + 60;
    ctx.fillStyle = '#f7f7ef'; ctx.fillRect(X, 4, 120, 7);
    ctx.fillStyle = 'rgba(255,255,230,.25)'; ctx.fillRect(X - 10, 11, 140, 6);
  }
  // 腰壁
  ctx.fillStyle = C.wainsTop; ctx.fillRect(0, 140, W, 6);
  ctx.fillStyle = C.wains; ctx.fillRect(0, 146, W, FLOOR_TOP - 146);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let x = Math.floor(camX / 65) * 65; x < camX + W + 65; x += 65) ctx.fillRect(x - camX, 146, 2, FLOOR_TOP - 146);
  // 窓
  for (const w of wins) {
    if (w.side !== 0) continue;
    const X = w.x - camX;
    if (X > W + 10 || X + w.w < -10) continue;
    drawWindow(X, 40, w.w, 94, w, C.room, true);
  }
  // 教室の扉と札
  for (const d of doors) {
    const X = d.x - camX;
    if (X > W + 10 || X + 130 < -10) continue;
    ctx.fillStyle = C.door; ctx.fillRect(X + 4, 36, 70, FLOOR_TOP - 36);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(X + 4, 36, 70, 4); ctx.fillRect(X + 37, 36, 3, FLOOR_TOP - 36);
    ctx.fillStyle = 'rgba(170,220,235,0.6)'; ctx.fillRect(X + 12, 52, 20, 34); ctx.fillRect(X + 46, 52, 20, 34);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(X + 30, 112, 3, 12);
    // 札
    ctx.fillStyle = '#f6f3ea'; ctx.fillRect(X + 2, 24, 74, 14);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(X + 2.5, 24.5, 73, 13);
    ctx.fillStyle = '#1a1a1a'; ctx.font = `bold 11px ${FONT_DOT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(I18N.list('rooms')[d.room], X + 39, 31.5);
    // 縦書きの貼り紙
    ctx.fillStyle = '#fbfaf3'; ctx.fillRect(X + 86, 44, 30, 92);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(X + 86, 134, 30, 2);
    ctx.fillStyle = d.poster === '信は力なり' ? '#b3202a' : '#1a1a1a';
    ctx.font = `13px ${FONT_DISP}`;
    const chars = [...d.poster];
    const step = Math.min(15, 84 / chars.length);
    chars.forEach((c, i) => ctx.fillText(c, X + 101, 52 + i * step + step / 2 - 4));
  }
}

function drawWindow(X, Y, w, h, win, behind, far) {
  // 外枠
  ctx.fillStyle = C.frame; ctx.fillRect(X - 5, Y - 5, w + 10, h + 10);
  ctx.fillStyle = C.frameHi; ctx.fillRect(X - 5, Y - 5, w + 10, 3);
  // 奥の景色
  ctx.fillStyle = behind; ctx.fillRect(X, Y, w, h);
  if (far) { // 教室の机と黒板
    ctx.fillStyle = '#1f3a2e'; ctx.fillRect(X + 6, Y + 14, w - 12, 26);
    ctx.fillStyle = '#3b2c22';
    for (let i = 0; i < 3; i++) { ctx.fillRect(X + 8 + i * 34, Y + h - 28, 24, 5); ctx.fillRect(X + 10 + i * 34, Y + h - 23, 3, 23); ctx.fillRect(X + 27 + i * 34, Y + h - 23, 3, 23); }
  } else { // 校庭と空
    ctx.fillStyle = '#c9a66b'; ctx.fillRect(X, Y + h * 0.6, w, h * 0.4);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(X + ((win.x * 0.37) % w), Y + h * 0.6, 2, h * 0.4);
  }
  if (!win.broken) {
    ctx.fillStyle = C.glass; ctx.fillRect(X, Y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.moveTo(X + w * 0.15, Y); ctx.lineTo(X + w * 0.32, Y); ctx.lineTo(X + w * 0.12, Y + h); ctx.lineTo(X - 0 + w * 0.0, Y + h * 0.95);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(X + w * 0.42 + h * 0, Y, 6, h);
    // 引き違い窓の中桟
    ctx.fillStyle = C.frame; ctx.fillRect(X + w / 2 - 2, Y, 4, h);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X, Y, w, h);
    ctx.fillStyle = 'rgba(190,232,245,.85)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1;
    for (const s of win.shards) {
      ctx.beginPath();
      s.forEach((p, i) => { const px = X + p[0] * w, py = Y + p[1] * h; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = C.frame; ctx.fillRect(X + w / 2 - 2, Y, 4, h);
  }
}

function drawFloor() {
  const rows = 12;
  let y = FLOOR_TOP;
  for (let i = 0; i < rows; i++) {
    const hgt = 16 + i * 1.6;
    ctx.fillStyle = i % 2 ? C.floorA : C.floorB;
    ctx.fillRect(0, y, W, hgt + 1);
    ctx.fillStyle = C.seam;
    ctx.fillRect(0, y, W, 1);
    const len = 180, off = (i * 67) % len;
    for (let x = Math.floor((camX + off) / len) * len - off; x < camX + W + len; x += len) ctx.fillRect(x - camX, y, 2, hgt);
    y += hgt;
    if (y > FLOOR_BOT) break;
  }
  ctx.fillStyle = C.floorA; if (y < FLOOR_BOT) ctx.fillRect(0, y, W, FLOOR_BOT - y);
  // 奥の壁の影
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, FLOOR_TOP, W, 6);
  // 木刀が届く範囲（うっすら）
  if (state !== 'title') {
    ctx.fillStyle = 'rgba(160,215,235,.07)';
    ctx.fillRect(0, FLOOR_TOP, W, (Y_MIN + REACH) - FLOOR_TOP);
    ctx.fillRect(0, Y_MAX - REACH, W, FLOOR_BOT - (Y_MAX - REACH));
  }
}

function drawFinish() {
  const X = COURSE - camX;
  if (X < -60 || X > W + 260) return;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 2; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#111' : '#f4f4f4';
    ctx.fillRect(X + c * 14, FLOOR_TOP + r * ((FLOOR_BOT - FLOOR_TOP) / 16), 14, (FLOOR_BOT - FLOOR_TOP) / 16 + 1);
  }
  // 吊り下げ幕
  ctx.fillStyle = '#b3202a'; ctx.fillRect(X - 60, 26, 148, 40);
  ctx.fillStyle = '#fff'; ctx.font = `24px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t('sign.goal'), X + 14, 47);
  // 廊下の突き当たり
  const E = COURSE + 420 - camX;
  if (E < W) {
    ctx.fillStyle = '#bfb397'; ctx.fillRect(E, 0, W - E + 10, FLOOR_BOT);
    ctx.fillStyle = '#2f9e5a'; ctx.fillRect(E + 30, 40, 80, 30);
    ctx.fillStyle = '#fff'; ctx.font = `15px ${FONT_DOT}`; ctx.fillText(t('sign.exit'), E + 70, 56);
  }
}

function drawNearWall() {
  ctx.fillStyle = '#4a3a28'; ctx.fillRect(0, FLOOR_BOT, W, 4);
  ctx.fillStyle = C.nearWall; ctx.fillRect(0, FLOOR_BOT + 4, W, H - FLOOR_BOT - 4);
  ctx.fillStyle = '#e9e1c9'; ctx.fillRect(0, FLOOR_BOT + 4, W, 3);
  for (const w of wins) {
    if (w.side !== 1) continue;
    const X = w.x - camX;
    if (X > W + 10 || X + w.w < -10) continue;
    drawWindow(X, 494, w.w, 50, w, C.sky, false);
  }
}

function shadow(s) {
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
}
function depthScale(y) { return 0.82 + (y - Y_MIN) / (Y_MAX - Y_MIN) * 0.3; }

function drawStudent(e) {
  const s = depthScale(e.y);
  ctx.save();
  ctx.translate(e.x - camX, e.y);
  shadow(s);
  ctx.scale(s, s);
  if (e.down) {
    // 尻もちをついて目を回す
    ctx.rotate(e.downT < 0.3 ? -e.downT * 4 : -1.2);
  }
  ctx.scale(e.dir, 1);
  const moving = !e.down && (e.panic > 0 || (!e.scared && (e.mode === 'cross' || e.mode === 'walk')));
  const ph = moving ? Math.sin(e.phase) * 5 : 0;
  const shiver = e.scared && !e.down ? Math.sin(clock * 50) * 0.8 : 0;
  ctx.translate(shiver, 0);
  const female = e.g === 1;
  // 脚
  if (female) {
    ctx.fillStyle = '#f0c9a4'; ctx.fillRect(-6 + ph * 0.5, -21, 5, 18); ctx.fillRect(1 - ph * 0.5, -21, 5, 18);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(-6 + ph * 0.5, -10, 5, 8); ctx.fillRect(1 - ph * 0.5, -10, 5, 8);
  } else {
    ctx.fillStyle = '#16171f'; ctx.fillRect(-7 + ph * 0.5, -24, 6, 22); ctx.fillRect(1 - ph * 0.5, -24, 6, 22);
  }
  ctx.fillStyle = '#2a1b12'; ctx.fillRect(-9 + ph * 0.5, -3, 8, 3); ctx.fillRect(-1 - ph * 0.5, -3, 8, 3);
  // 胴
  if (female) {
    ctx.fillStyle = '#1d2546';
    ctx.beginPath(); ctx.moveTo(-12, -19); ctx.lineTo(12, -19); ctx.lineTo(8, -31); ctx.lineTo(-8, -31); ctx.closePath(); ctx.fill();
    ctx.fillRect(-9, -48, 18, 18);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-9, -48, 18, 3); ctx.fillRect(4, -48, 5, 10);
    ctx.fillStyle = '#d0262f';
    ctx.beginPath(); ctx.moveTo(-6, -44); ctx.lineTo(0, -44); ctx.lineTo(-3, -36); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#16171f'; ctx.fillRect(-10, -50, 20, 28);
    ctx.fillStyle = '#d8b24a';
    for (let i = 0; i < 4; i++) ctx.fillRect(-8, -46 + i * 6, 2, 2);
  }
  // 腕
  const armCol = female ? '#1d2546' : '#16171f';
  ctx.strokeStyle = armCol; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  if (e.panic > 0 || e.scared) {
    ctx.moveTo(-6, -46); ctx.lineTo(-12, -62); ctx.moveTo(5, -46); ctx.lineTo(11, -63);
  } else {
    ctx.moveTo(-2, -46); ctx.lineTo(-4 - ph, -28); ctx.moveTo(2, -46); ctx.lineTo(4 + ph, -28);
  }
  ctx.stroke();
  // 頭
  ctx.fillStyle = '#f0c9a4'; ctx.beginPath(); ctx.arc(0, -58, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#121212';
  if (female) {
    ctx.beginPath(); ctx.arc(0, -60, 8.5, Math.PI * 1.0, Math.PI * 2); ctx.fill();
    ctx.fillRect(2, -62, 7, 14);
  } else {
    ctx.beginPath(); ctx.arc(0, -60, 8.3, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillRect(-8, -62, 16, 3);
  }
  // 顔（左向きが正面）
  ctx.fillStyle = '#111';
  if (e.down) {
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('@', -4, -57);
  } else {
    ctx.fillRect(-5, -58, 2, 2);
    if (e.panic > 0 || e.scared) { ctx.beginPath(); ctx.arc(-4, -53, 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  if (e.down) stars(e.x - camX, e.y - 66 * s);
}

function drawTeacher(e) {
  const s = depthScale(e.y);
  ctx.save();
  ctx.translate(e.x - camX, e.y);
  shadow(s);
  ctx.scale(s, s);
  if (e.down) ctx.rotate(Math.min(1.5, e.downT * 7));
  const walk = e.alert && !e.down ? Math.sin(e.phase) * 4 : 0;
  // ジャージのズボン
  ctx.fillStyle = '#b8202e'; ctx.fillRect(-8 + walk * 0.5, -30, 7, 28); ctx.fillRect(1 - walk * 0.5, -30, 7, 28);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-8 + walk * 0.5, -30, 2, 28); ctx.fillRect(6 - walk * 0.5, -30, 2, 28);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-10 + walk * 0.5, -3, 9, 3); ctx.fillRect(0 - walk * 0.5, -3, 9, 3);
  // 上着
  ctx.fillStyle = '#c8283a'; ctx.fillRect(-12, -60, 24, 32);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-1, -60, 2, 32);
  // 腕（通せんぼ）
  ctx.strokeStyle = '#c8283a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  if (e.alert && !e.down) { ctx.moveTo(-8, -55); ctx.lineTo(-26, -58); ctx.moveTo(8, -55); ctx.lineTo(24, -62); }
  else { ctx.moveTo(-9, -56); ctx.lineTo(-12, -34); ctx.moveTo(9, -56); ctx.lineTo(12, -34); }
  ctx.stroke();
  ctx.fillStyle = '#e6b48c';
  if (e.alert && !e.down) { ctx.beginPath(); ctx.arc(-28, -58, 4, 0, 7); ctx.arc(26, -63, 4, 0, 7); ctx.fill(); }
  // 頭
  ctx.fillStyle = '#e6b48c'; ctx.beginPath(); ctx.arc(0, -70, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, -72, 9.2, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  ctx.fillStyle = '#111';
  if (e.down) { ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×', -4, -70); }
  else { ctx.fillRect(-6, -72, 3, 2); ctx.fillRect(-7, -75, 5, 1.5); }
  // 笛
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -64); ctx.lineTo(2, -50); ctx.stroke();
  ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-11, -66, 5, 3);
  ctx.restore();
  if (e.down) stars(e.x - camX + Math.min(60, e.downT * 200) * 0, e.y - 30 * s);
}

function stars(x, y) {
  ctx.fillStyle = '#f2c14e'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const a = clock * 5 + i * 2.1;
    ctx.fillText('★', x + Math.cos(a) * 14, y + Math.sin(a) * 4);
  }
}

function drawBike(b) {
  const s = depthScale(b.y);
  ctx.save();
  if (b.inv > 0 && Math.floor(clock * 12) % 2) ctx.globalAlpha = 0.35; // 再出発直後の無敵中は点滅
  ctx.translate(b.x - camX, b.y);
  shadow(s * 2.2);
  ctx.scale(s, s);
  if (b.rot) { ctx.translate(0, -6); ctx.rotate(b.rot); }
  const flap = Math.sin(clock * 22) * 3;
  // 旗
  ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-34, -58); ctx.lineTo(-44, -118); ctx.stroke();
  ctx.fillStyle = '#5b1f7a';
  ctx.beginPath(); ctx.moveTo(-44, -118); ctx.lineTo(-82, -116 + flap); ctx.lineTo(-80, -94 + flap); ctx.lineTo(-42, -98); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.font = `9px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('爆走', -62, -106 + flap / 2);
  // 竹槍マフラー
  ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 4; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-64, -46); ctx.moveTo(-12, -18); ctx.lineTo(-58, -58); ctx.stroke();
  ctx.fillStyle = '#e0333d'; ctx.beginPath(); ctx.ellipse(-64, -46, 2.5, 3.5, -0.6, 0, 7); ctx.ellipse(-58, -58, 2.5, 3.5, -0.8, 0, 7); ctx.fill();
  // 車輪
  wheel(-28, -13, b.wheel); wheel(32, -13, b.wheel);
  // フレーム・エンジン
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(-14, -28, 30, 14);
  ctx.fillStyle = '#8c8f98'; for (let i = 0; i < 4; i++) ctx.fillRect(-10 + i * 7, -26, 4, 10);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-28, -13); ctx.lineTo(-6, -24); ctx.moveTo(32, -13); ctx.lineTo(22, -44); ctx.stroke();
  // タンク
  ctx.fillStyle = '#6b2a8c'; ctx.beginPath(); ctx.ellipse(8, -34, 15, 8, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(-4, -36, 22, 2);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(2, -40, 10, 2);
  // 三段シート
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.moveTo(-6, -32); ctx.lineTo(-22, -32); ctx.lineTo(-24, -42); ctx.lineTo(-30, -42); ctx.lineTo(-32, -52); ctx.lineTo(-37, -60); ctx.lineTo(-40, -58); ctx.lineTo(-36, -30); ctx.lineTo(-6, -26);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.stroke();
  // ライト
  ctx.fillStyle = '#e8e2b0'; ctx.beginPath(); ctx.arc(30, -46, 4, 0, 7); ctx.fill();
  // 絞りハンドル
  ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22, -44); ctx.lineTo(16, -56); ctx.lineTo(24, -58); ctx.stroke();
  // ライダー：脚
  ctx.strokeStyle = '#f1eadb'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -40); ctx.lineTo(6, -38); ctx.lineTo(8, -20); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.fillRect(4, -22, 10, 5);
  // 特攻服の裾（はためく）
  ctx.fillStyle = '#e9e2d2';
  ctx.beginPath();
  ctx.moveTo(-6, -66); ctx.lineTo(-16, -40); ctx.lineTo(-44 + flap, -36 - flap); ctx.lineTo(-40 + flap * 0.5, -46); ctx.lineTo(-18, -64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(-36 + flap * 0.5, -42 - flap * 0.4, 12, 1.5); ctx.fillRect(-30, -50, 9, 1.5);
  // 胴
  ctx.fillStyle = '#f1eadb';
  ctx.beginPath(); ctx.moveTo(-14, -42); ctx.lineTo(-2, -42); ctx.lineTo(2, -70); ctx.lineTo(-12, -72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0333d'; ctx.fillRect(-12, -46, 13, 4); // サラシの赤
  // ハンドルを握る腕
  ctx.strokeStyle = '#f1eadb'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-2, -66); ctx.lineTo(10, -58); ctx.lineTo(20, -56); ctx.stroke();
  // 頭・リーゼント・ハチマキ
  ctx.fillStyle = '#e6b48c'; ctx.beginPath(); ctx.arc(-4, -79, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.ellipse(2, -88, 12, 5.5, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-7, -82, 7, Math.PI * 0.6, Math.PI * 1.7); ctx.fill();
  ctx.fillStyle = '#e0333d'; ctx.fillRect(-12, -84, 16, 3);
  ctx.beginPath(); ctx.moveTo(-12, -84); ctx.lineTo(-26, -86 + flap); ctx.lineTo(-24, -80 + flap); ctx.lineTo(-12, -81); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillRect(0, -80, 3, 2);
  // 木刀
  let ang;
  if (b.swingT > 0) {
    const k = 1 - b.swingT / 0.2;
    if (b.swingSide < 0) ang = lerp(0.5, -2.1, k);
    else if (b.swingSide > 0) ang = lerp(-1.4, 1.3, k);
    else ang = lerp(-1.8, 0.8, k);
  } else ang = -2.35;
  ctx.save();
  ctx.translate(-6, -66);
  ctx.rotate(ang);
  ctx.strokeStyle = '#f1eadb'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 0); ctx.stroke();
  ctx.strokeStyle = '#c79f63'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(60, 0); ctx.stroke();
  ctx.strokeStyle = '#3a2615'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(22, 0); ctx.stroke();
  if (b.swingT > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, 56, -0.35, 0.05); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}
function wheel(x, y, rot) {
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a8acb5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 4; ctx.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); }
  ctx.stroke();
}

function drawBubble(e) {
  const s = depthScale(e.y);
  const X = e.x - camX, Y = e.y - (e.type === 't' ? 92 : 80) * s;
  ctx.font = `14px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(e.bubble.text).width + 14;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X - w / 2, Y - 13, w, 24, 8) : ctx.rect(X - w / 2, Y - 13, w, 24); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X - 4, Y + 10); ctx.lineTo(X, Y + 18); ctx.lineTo(X + 5, Y + 10); ctx.fill();
  ctx.fillStyle = e.type === 't' ? '#b3202a' : '#1d2546';
  ctx.fillText(e.bubble.text, X, Y);
}

function drawParts() {
  for (const p of parts) {
    const X = p.x - camX;
    if (X < -20 || X > W + 20) continue;
    if (p.k === 'shard') {
      ctx.save(); ctx.translate(X, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = 'rgba(200,238,250,.9)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.6, p.size * 0.5); ctx.lineTo(-p.size * 0.5, p.size * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffb347'; ctx.fillRect(X, p.y, 3, 2);
    }
  }
  ctx.globalAlpha = 1;
}
function drawPops() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pops) {
    if (!p.text) continue;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
    ctx.font = `${p.size}px ${FONT_DISP}`;
    ctx.lineWidth = 4; ctx.strokeStyle = '#111';
    ctx.strokeText(p.text, p.x - camX, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x - camX, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  // 左上
  ctx.fillStyle = 'rgba(12,12,18,.78)'; ctx.fillRect(10, 8, 330, 54);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a9a294'; ctx.font = `12px ${FONT_DOT}`;
  ctx.fillText(t('hud.time'), 20, 26); ctx.fillText(t('hud.glass'), 130, 26); ctx.fillText(t('hud.score'), 236, 26);
  ctx.fillStyle = '#f1eadb'; ctx.font = `22px ${FONT_DOT}`;
  ctx.fillText(runT.toFixed(2), 20, 52);
  ctx.fillStyle = '#9fd3e3'; ctx.fillText(`${glass}`, 130, 52);
  const gw = ctx.measureText(String(glass)).width;
  ctx.fillStyle = '#6d7f88'; ctx.font = `13px ${FONT_DOT}`; ctx.fillText(`/${wins.length}`, 130 + gw + 3, 52);
  ctx.fillStyle = '#f2c14e'; ctx.font = `22px ${FONT_DOT}`; ctx.fillText(glassScore.toLocaleString(), 236, 52);
  // 右上：進み具合
  const px = W - 300, pw = 280;
  ctx.fillStyle = 'rgba(12,12,18,.78)'; ctx.fillRect(px - 10, 8, pw + 20, 54);
  ctx.fillStyle = '#a9a294'; ctx.font = `12px ${FONT_DOT}`; ctx.textAlign = 'left';
  ctx.fillText(t('hud.floor'), px, 26);
  ctx.textAlign = 'right'; ctx.fillText(t('hud.left', { m: Math.max(0, (COURSE - bike.x) / 100).toFixed(0) }), px + pw, 26);
  ctx.fillStyle = '#34354a'; ctx.fillRect(px, 40, pw, 6);
  const staffX = px + pw * (doors.length ? doors[doors.length - 1].x / COURSE : 0.9);
  ctx.fillStyle = '#c8283a'; ctx.fillRect(staffX - 1, 36, 3, 14);
  ctx.fillStyle = '#9fd3e3'; ctx.fillRect(px, 40, pw * clamp(bike.x / COURSE, 0, 1), 6);
  ctx.fillStyle = '#f1eadb'; ctx.beginPath(); ctx.arc(px + pw * clamp(bike.x / COURSE, 0, 1), 43, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#a9a294'; ctx.font = `10px ${FONT_DOT}`; ctx.textAlign = 'center';
  const staffW = ctx.measureText(t('hud.staff')).width;
  ctx.fillText(t('hud.staff'), Math.min(staffX, px + pw + 4 - staffW / 2), 60);
  // 左下：速度計
  ctx.fillStyle = 'rgba(12,12,18,.8)'; ctx.fillRect(10, H - 46, 250, 38);
  const kmh = Math.round(bike.v * 0.12);
  ctx.textAlign = 'left'; ctx.fillStyle = '#f1eadb'; ctx.font = `22px ${FONT_DOT}`;
  ctx.fillText(String(kmh).padStart(3, ' '), 20, H - 18);
  ctx.fillStyle = '#a9a294'; ctx.font = `11px ${FONT_DOT}`; ctx.fillText('km/h', 62, H - 18);
  const sw = 140, sv = bike.v / V_MAX;
  ctx.fillStyle = '#34354a'; ctx.fillRect(104, H - 32, sw, 10);
  ctx.fillStyle = bike.stun > 0 ? '#f2c14e' : (sv > 0.85 ? '#e0333d' : '#9fd3e3');
  ctx.fillRect(104, H - 32, sw * sv, 10);
  if (bike.stun > 0) { ctx.fillStyle = '#f2c14e'; ctx.font = `10px ${FONT_DOT}`; ctx.fillText(t('hud.slow'), 104, H - 36); }
  // パラリラの溜まり具合
  const hk = clamp(1 - hornCD / 3.5, 0, 1);
  ctx.fillStyle = 'rgba(12,12,18,.8)'; ctx.fillRect(268, H - 46, 92, 38);
  ctx.fillStyle = hk >= 1 ? '#e0333d' : '#5a5b70'; ctx.font = `12px ${FONT_DOT}`; ctx.fillText(t('hud.horn'), 278, H - 30);
  ctx.fillStyle = '#34354a'; ctx.fillRect(278, H - 22, 72, 5);
  ctx.fillStyle = hk >= 1 ? '#e0333d' : '#8a8ba0'; ctx.fillRect(278, H - 22, 72 * hk, 5);
  // コンボ
  if (combo >= 2 && runT - lastBreak < 1.2 && state === 'play') {
    const a = clamp((1.2 - (runT - lastBreak)) * 2, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.font = `34px ${FONT_DISP}`; ctx.lineWidth = 6; ctx.strokeStyle = '#111';
    const ct = t('hud.combo', { n: combo });
    ctx.strokeText(ct, W / 2, 100); ctx.fillStyle = '#f2c14e'; ctx.fillText(ct, W / 2, 100);
    ctx.globalAlpha = 1;
  }
}
function drawCountdown() {
  const n = Math.ceil(countdown - 0.2);
  bigText(n >= 1 ? String(n) : '', '#f1eadb', '#e0333d', 1);
  if (countdown > 2.6) {
    ctx.textAlign = 'center'; ctx.font = `18px ${FONT_DOT}`; ctx.fillStyle = '#f1eadb';
    ctx.lineWidth = 4; ctx.strokeStyle = '#111';
    const hint = t(NATIVE || COARSE ? 'hint.tc' : 'hint.kb');
    ctx.strokeText(hint, W / 2, 360); ctx.fillText(hint, W / 2, 360);
  }
}
function bigText(t, fill, edge, a) {
  if (!t) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(96 + (1 - a) * 60)}px ${FONT_DISP}`;
  ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeText(t, W / 2 + 6, H / 2 + 6);
  ctx.fillStyle = edge; ctx.fillText(t, W / 2 + 5, H / 2 + 5);
  ctx.fillStyle = fill; ctx.fillText(t, W / 2, H / 2);
  ctx.restore();
}

// ---------- ループ ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!isBlocked() && !paused) update(dt);
  render();
  requestAnimationFrame(frame);
}
renderBoard(document.getElementById('boardTitle'), -1);
startDemo();
requestAnimationFrame(frame);
// テスト用の小さな窓口
window.__roka = { get state() { return state; }, get glass() { return glass; }, get bike() { return bike; }, get ents() { return ents; }, keys };
})();
