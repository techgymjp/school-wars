(() => {
'use strict';

// ---------- 定数 ----------
const W = 960, H = 540;
const FLOOR_TOP = 176, FLOOR_BOT = 480;
const Y_MIN = 198, Y_MAX = 466;     // 足元の y の範囲
const REACH = 62;                    // 壁からこの距離以内で窓に木刀が届く
const UNIT = 130;                    // 窓1枚ぶんの間隔
const V_CRUISE = 280, V_MAX = 680, V_MIN = 90;
const POSTERS = ['廊下を走るな','暴力追放','整理整頓','信は力なり','遅刻厳禁','挨拶運動','廊下を走るな'];
const t = I18N.t;
const STORE_KEY = 'rokabakuso.best.v2';

// ---------- 面 ----------
// 1 周は 1階・昇降口 → 2階・特別教室棟 → 三階廊下 → 体育館への渡り廊下 → 屋上 の 5 面。3 周で全 15 面。
// len はゴールまでの距離（100px = 1m）、far は奥の壁に並ぶもの、rooms は教室の札（js/i18n.js）、
// students / teachers は出てくる人数の倍率、teacher は先生の種類、farPts は奥の壁を 1 つ壊したときの基本点
const STAGES = [
  { id: 'f1', len: 9000, theme: 'school', far: 'locker', rooms: 'rooms.f1', students: 1.5, teachers: 0.7, teacher: 'normal', farPts: 100 },
  { id: 'f2', len: 11000, theme: 'school', far: 'glass', rooms: 'rooms.f2', students: 0.9, teachers: 1.15, teacher: 'science', farPts: 200 },
  { id: 'f3', len: 14000, theme: 'school', far: 'glass', rooms: 'rooms', students: 1, teachers: 1, teacher: 'normal', farPts: 100, staffRoom: true },
  { id: 'gym', len: 11000, theme: 'gym', far: 'glass', rooms: null, students: 0.7, teachers: 1.1, teacher: 'pe', farPts: 100 },
  { id: 'roof', len: 8000, theme: 'roof', far: 'none', rooms: null, students: 0, teachers: 0, teacher: 'normal', farPts: 0, boss: true },
];
const LAPS = 3;
const FLEE_PTS = 50;     // パラリラで生徒を 1 人逃がすごとの点
const RIVAL_PTS = 300;   // 他校の暴走族を木刀ではじき返したときの点
const PASS_PTS = 1000;   // 屋上でラグビー部監督を振り切ったときの点
let lap = 1, stageIdx = 2, stage = STAGES[2], course = STAGES[2].len;
// 2 周目からは他校の暴走族とワックスの床、3 周目からは昼休みの人混み・停電・各面のゴール前のボス教師が加わる
const hasRivals = () => lap >= 2 && !stage.boss;
const isWaxed = () => lap >= 2;
const isLunch = () => lap >= 3;
const isNight = () => lap >= 3;
const hasGoalBoss = () => lap >= 3 && !stage.boss;
function hazards() {
  return [hasRivals() && 'hz.rival', isWaxed() && 'hz.wax', isLunch() && !stage.boss && 'hz.lunch', isNight() && 'hz.night', hasGoalBoss() && 'hz.boss'].filter(Boolean);
}

const cv = document.getElementById('game');
let ctx = cv.getContext('2d');   // 遊び方ページの挿絵を描くときだけ一時的に差し替える
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
// bonusPts：その面のボーナス（逃がした生徒・暴走族・監督）。run〜：ここまでに走り切った面の合計
let bonusPts = 0, fled = 0, runScore = 0, runTime = 0, runGlass = 0, runFled = 0;
let crashT = 0, finishT = 0, resultShown = false, hornCD = 0, resultReadyAt = 0;
let paused = false, continued = false, contT = 0;
const keys = { up: false, down: false, accel: false, horn: false };
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
  const st = stage;
  const R = mulberry32(19841006 + stageIdx * 101 + lap * 7); // 同じ面・同じ周なら毎回同じ配置
  wins = []; doors = []; ents = [];
  if (st.far !== 'none') {
    const roomCount = st.rooms ? I18N.list(st.rooms).length : 0;
    let slot = 0, room = 0;
    for (let x = 420; x < course - 160; x += UNIT, slot++) {
      if (st.rooms && slot % 9 === 4) {
        doors.push({ x, room: Math.min(room, roomCount - 1), poster: POSTERS[room % POSTERS.length] });
        room++;
      } else {
        wins.push({ side: 0, x, w: 108, kind: st.far, broken: false, shards: null, crack: R() });
      }
      wins.push({ side: 1, x: x + 45, w: 108, kind: 'glass', broken: false, shards: null, crack: R() });
    }
  }
  if (!withPeople) return;
  if (st.boss) { ents.push(makeBoss(1500)); return; }
  const sMul = st.students * (isLunch() ? 1.7 : 1);
  const gap = 0.6 + 0.4 * sMul;              // 人が多い面ほど間隔を詰める
  let x = 1050;
  while (x < course - 380) {
    const prog = x / course;
    const staff = st.staffRoom && x > course * 0.82;   // 職員室の前は先生だらけ
    const pTeacher = clamp((staff ? 0.55 : 0.18 + prog * 0.2) * st.teachers / gap, 0, 0.75);
    const pGroup = (0.13 + prog * 0.07) * Math.min(1.6, sMul);
    const r = R();
    if (r < pTeacher) {
      ents.push(makeTeacher(x, Y_MIN + R() * (Y_MAX - Y_MIN), R, st.teacher));
    } else if (r < pTeacher + pGroup) {
      // 立ち話のグループ
      const n = R() < 0.4 ? 3 : 2;
      const gy = Y_MIN + 20 + R() * (Y_MAX - Y_MIN - 40);
      for (let i = 0; i < n; i++) {
        ents.push(makeStudent(x + i * 24, clamp(gy + (i % 2 ? 16 : -8), Y_MIN, Y_MAX), 'stand', R));
      }
      x += 30;
    } else {
      const mode = R() < 0.55 ? 'cross' : (R() < 0.6 ? 'walk' : 'stand');
      ents.push(makeStudent(x, Y_MIN + R() * (Y_MAX - Y_MIN), mode, R));
    }
    x += (200 - prog * 60 + R() * 190) / gap;
  }
  if (hasRivals()) {
    for (let rx = 2600; rx < course - 900; rx += 1700 + R() * 900) ents.push(makeRival(rx, Y_MIN + R() * (Y_MAX - Y_MIN)));
  }
  // 3 周目：ゴールの手前でボス教師が待ち構える
  if (hasGoalBoss()) ents.push(makeBoss(course - 1300, 'chief'));
}
function makeStudent(x, y, mode, R) {
  return {
    type: 's', x, y, mode, g: R() < 0.5 ? 1 : 0,
    vy: (R() < 0.5 ? -1 : 1) * (35 + R() * 25), vx: mode === 'walk' ? -(30 + R() * 25) : 0,
    phase: R() * 6, dir: R() < 0.7 ? -1 : 1, panic: 0, scared: false, down: false, downT: 0, bubble: null
  };
}
function makeTeacher(x, y, R, kind) {
  return { type: 't', kind: kind || 'normal', x, y, phase: R() * 6, dir: -1, alert: false, down: false, downT: 0, vx: 0, spin: 0, bubble: null, chaseT: 0 };
}
// 他校の暴走族：前から逆走してくる。木刀ではじき返せる
function makeRival(x, y) {
  return Object.assign(newBike(), { type: 'r', rival: true, x, y, v: 230, down: false, fade: 1, bubble: null, said: false });
}
// ボス：屋上の熱血ラグビー部監督（coach）は振り切っても先回りしてまた立ちはだかる。
// 3 周目の各面のゴール前にいるボス教師（chief）は、ゴールまでに 2 回まで先回りする
function makeBoss(x, kind) {
  return { type: 'b', kind: kind || 'coach', x, y: (Y_MIN + Y_MAX) / 2, phase: 0, dir: -1, alert: true, down: false, downT: 0, away: 0, blocks: 0, bubble: null };
}
const bossLine = e => (e.kind === 'chief' ? t('say.boss') : pick(I18N.list('say.coach')));

// ---------- 音 ----------
let AC = null, master = null, eng = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('rokabakuso.mute') === '1'; } catch (e) {}
const muteBtn = document.getElementById('mute');
function syncMute() { muteBtn.textContent = t(muted ? 'sound.off' : 'sound.on'); if (master) master.gain.value = muted ? 0 : 0.55; }
syncMute();
function toggleMute() { muted = !muted; try { localStorage.setItem('rokabakuso.mute', muted ? '1' : '0'); } catch (e) {} syncMute(); }
muteBtn.addEventListener('click', e => { toggleMute(); e.currentTarget.blur(); });
// 画面に触れたら、止まっている音を鳴らせる状態に戻す（広告のあとなどに止まったままにならないように）
const unlockAudio = () => {
  if (AC && AC.state === 'suspended' && !document.hidden && !Ads.showing) AC.resume().catch(() => {});
};
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

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
  clang() { tone('square', 220, 70, 0.18, 0.12); noise(0.25, 'lowpass', 1200, 0.45); },
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
  ArrowRight: 'accel', KeyD: 'accel', Space: 'accel',
  KeyX: 'horn', KeyK: 'horn'
};
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k && state !== 'title' && state !== 'result') e.preventDefault();
  if (e.code === 'KeyM') { toggleMute(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && canPause()) { e.preventDefault(); setPaused(!paused); return; }
  if (paused) { if (k || e.code === 'Enter') { e.preventDefault(); setPaused(false); } return; }
  if (howtoOpen()) { if (e.code === 'Escape') { e.preventDefault(); closeHowto(); } return; }
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); playWithAd(); return; }
  if (state === 'result' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat && performance.now() > resultReadyAt && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); playWithAd(); return; }
  if (state === 'result' && e.code === 'Escape') { toTitle(); return; }
  if (state === 'clear' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat && performance.now() > clearReadyAt && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); nextStage(); return; }
  if (k) keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// タッチ操作：指を離さずにボタンからボタンへ滑らせても切り替わるよう、指ごとに今どのボタンの上にあるかを見る
const touchBtns = [...document.querySelectorAll('#touch button')];
const fingers = new Map();   // pointerId → 押しているボタンのキー（ボタンの外なら null）
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const b = el && el.closest ? el.closest('#touch button') : null;
  return b ? b.dataset.k : null;
}
function syncTouch() {
  const held = new Set(fingers.values());
  touchBtns.forEach(b => {
    const on = held.has(b.dataset.k);
    keys[b.dataset.k] = on;
    b.classList.toggle('on', on);
  });
}
touchBtns.forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (paused) { setPaused(false); return; }
    if (b.hasPointerCapture && b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
    fingers.set(e.pointerId, b.dataset.k);
    syncTouch();
    if (state === 'title') startGame();
  });
  b.addEventListener('contextmenu', e => e.preventDefault());
});
addEventListener('pointermove', e => {
  if (!fingers.has(e.pointerId)) return;
  const k = keyAt(e.clientX, e.clientY);
  if (k !== fingers.get(e.pointerId)) { fingers.set(e.pointerId, k); syncTouch(); }
});
const liftFinger = e => { if (fingers.delete(e.pointerId)) syncTouch(); };
addEventListener('pointerup', liftFinger);
addEventListener('pointercancel', liftFinger);

// ---------- 画面遷移 ----------
const elTitle = document.getElementById('title'), elResult = document.getElementById('result');
const elHowto = document.getElementById('howto');
document.getElementById('howtoBtn').addEventListener('click', openHowto);
document.getElementById('howtoBack').addEventListener('click', closeHowto);
document.getElementById('howtoStart').addEventListener('click', () => playWithAd());

// ---------- 遊び方ページ ----------
function howtoOpen() { return !elHowto.hidden; }
function openHowto() {
  elTitle.hidden = true; elHowto.hidden = false;
  elHowto.scrollTop = 0;
  paintSprites();
  document.getElementById('howtoBack').focus({ preventScroll: true });
}
function closeHowto() {
  elHowto.hidden = true; elTitle.hidden = false;
  document.getElementById('howtoBtn').focus({ preventScroll: true });
}
// 称号の一覧（合計点の下限つき）
const RANK_FROM = [0, 40000, 100000, 180000, 280000];
function renderRanks() {
  document.getElementById('rankList').innerHTML = RANK_FROM.map((n, i) =>
    `<li><span>${t('rank.' + i)}</span><span>${t('h.rankFrom', { n: n.toLocaleString() })}</span></li>`).reverse().join('');
}
// タイトル画面の自己ベスト（記録がなければ出さない）
function renderBest() {
  const a = loadBest(), el = document.getElementById('bestLine');
  el.hidden = !a.length;
  if (a.length) el.textContent = t('title.best', { n: a[0].score.toLocaleString(), rank: rankOf(a[0].score) });
}

// 挿絵：ゲームと同じ描画処理で、小さなキャンバスに人物やバイクを描く
function paintSprites() {
  document.querySelectorAll('canvas.sprite').forEach(c => {
    const w = +c.getAttribute('width'), h = +c.getAttribute('height');
    if (!c.dataset.w) { c.dataset.w = w; c.dataset.h = h; c.style.width = w + 'px'; c.style.height = h + 'px'; c.width = w * DPR; c.height = h * DPR; }
    const cw = +c.dataset.w, ch = +c.dataset.h;
    const sctx = c.getContext('2d');
    const savedCtx = ctx, savedCam = camX;
    ctx = sctx; camX = 0;
    // place(s, wx, wy, cx, cy)：世界座標 (wx, wy) をキャンバスの (cx, cy) に、倍率 s で置く
    const place = (sc, wx, wy, cx, cy) => ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (cx - sc * wx), DPR * (cy - sc * wy));
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      SPRITES[c.dataset.sprite](place, cw, ch);
    } finally {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx = savedCtx; camX = savedCam;
    }
  });
}
const demoStudent = (x, g, extra) => Object.assign({ type: 's', x, y: Y_MAX, mode: 'stand', g, dir: -1, phase: 1, panic: 0, scared: false, down: false, downT: 0, bubble: null }, extra);
const demoTeacher = x => ({ type: 't', x, y: Y_MAX, dir: -1, phase: 1, alert: true, down: false, downT: 0, bubble: { text: t('say.hey'), t: 1 } });
const demoBike = (x, extra) => Object.assign(newBike(), { x, y: Y_MAX, wheel: 0.4 }, extra);
const SPRITES = {
  glass(place, w, h) {
    place(1, 0, 0, 0, 0);
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, w, h);
    drawWindow(10, 14, 44, 58, { broken: false, x: 0 }, C.room, true);
    drawWindow(66, 14, 44, 58, { broken: true, x: 0, shards: genShards() }, C.room, true);
  },
  teacher(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    const e = demoTeacher(0);
    place(h < 90 ? 0.68 : 0.75, 0, Y_MAX, w / 2, h - 4); drawTeacher(e); drawBubble(e);
  },
  student(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    const a = demoStudent(0, 1), b = demoStudent(30, 0);
    place(0.9, 15, Y_MAX, w / 2, h - 6); drawStudent(a); drawStudent(b);
  },
  bike(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    place(0.62, 0, Y_MAX, w / 2 + 6, h - 6); drawBike(demoBike(0));
  },
  reach(place, w, h) {
    // 奥の壁の窓と、床の青い帯（木刀が届く範囲）
    place(1, 0, 0, 0, 0);
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, w, 40);
    drawWindow(8, 6, 40, 28, { broken: true, x: 0, shards: genShards() }, C.room, true);
    drawWindow(60, 6, 40, 28, { broken: false, x: 0 }, C.room, true);
    drawWindow(112, 6, 40, 28, { broken: false, x: 0 }, C.room, true);
    ctx.fillStyle = C.wains; ctx.fillRect(0, 40, w, 6);
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 46, w, h - 46);
    ctx.fillStyle = 'rgba(160,215,235,.28)'; ctx.fillRect(0, 46, w, 22);
    place(0.42, 0, Y_MAX, 46, 68); drawBike(demoBike(0, { swingT: 0.08, swingSide: -1 }));
  },
  rival(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    const r = Object.assign(makeRival(0, Y_MAX), { wheel: 0.4, bubble: { text: t('say.rival'), t: 1 } });
    place(h < 90 ? 0.5 : 0.56, 0, Y_MAX, w / 2, h - 4); drawBike(r); drawBubble(r);
  },
  chief(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    const e = Object.assign(makeBoss(0, 'chief'), { y: Y_MAX, bubble: { text: t('say.boss'), t: 1 } });
    place(h < 90 ? 0.5 : 0.56, 0, Y_MAX, w / 2 - 4, h - 4); drawTeacher(e); drawBubble(e);
  },
  horn(place, w, h) {
    ctx.fillStyle = C.floorB; ctx.fillRect(0, 0, w * DPR, h * DPR);
    const s1 = demoStudent(150, 1, { panic: 0.5, scared: true, bubble: { text: I18N.list('say.scream')[0], t: 1 } });
    place(0.5, 0, Y_MAX, 44, h - 6); drawBike(demoBike(0));
    drawStudent(s1); drawBubble(s1);
  },
};
document.getElementById('startBtn').addEventListener('click', playWithAd);
document.getElementById('againBtn').addEventListener('click', playWithAd);
document.getElementById('backBtn').addEventListener('click', () => afterAd(toTitle));

// Android アプリでは、プレイを始める前・タイトルに戻る前・もう一回の前に、毎回全画面広告を出す
let adBusy = false;
async function afterAd(next) {
  if (adBusy) return;
  // 音はタップした瞬間に用意しておく（広告が閉じたあとに用意すると、Android では音が出ないままになる）
  initAudio();
  if (Ads.available) {
    adBusy = true;
    try { await Ads.showInterstitial(); } finally { adBusy = false; }
  }
  next();
}
function playWithAd() { if (!isBlocked()) afterAd(startGame); }

// ---------- 一時停止 ----------
function canPause() { return state === 'countdown' || state === 'play' || state === 'crash' || state === 'goal'; }
function setPaused(v) {
  if (v && !canPause()) return;
  paused = v;
  for (const k in keys) keys[k] = false;
  fingers.clear();
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
    if (howtoOpen()) closeHowto();
    else if (state === 'title' || state === 'result') plugin('App').exitApp();
    else if (state === 'continue') giveUp();
    else if (state === 'clear') nextStage();
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
  showResult('out');
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
// 新しく走り始める（1 周目・第 1 面から）
function startGame() {
  if (isBlocked()) return;
  initAudio();
  goLandscape();
  lap = 1; stageIdx = 0;
  runScore = 0; runTime = 0; runGlass = 0; runFled = 0;
  maxCombo = 0; teacherHits = 0; continued = false;
  startStage();
}
// いまの面（lap, stageIdx）を最初から始める
function startStage() {
  root.classList.remove('in-menu');
  stage = STAGES[stageIdx]; course = stage.len;
  buildCourse(true);
  bike = newBike();
  parts = []; pops = [];
  camX = 0; runT = 0; countdown = 3.2; shake = 0;
  glass = 0; glassScore = 0; bonusPts = 0; fled = 0; combo = 0; lastBreak = -9;
  crashT = 0; finishT = 0; resultShown = false; hornCD = 0;
  paused = false;
  elCont.hidden = true; elClear.hidden = true;
  state = 'countdown';
  elTitle.hidden = true; elResult.hidden = true; elHowto.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  lastBeep = 4;
}

// ---------- 面クリア ----------
const elClear = document.getElementById('clear');
document.getElementById('nextBtn').addEventListener('click', nextStage);
let clearReadyAt = 0;
const parTime = () => course / 155;          // タイムボーナスの基準秒（14000px なら 90 秒）
function stageLabel(l, i) { return t('reach.at', { lap: l, name: t('stage.' + STAGES[i].id) }); }
function showClear() {
  resultShown = true;
  const timeBonus = Math.max(0, Math.round((parTime() - runT) * 300));
  const pts = glassScore + bonusPts + timeBonus;
  runScore += pts; runTime += runT; runGlass += glass; runFled += fled;
  if (lap === LAPS && stageIdx === STAGES.length - 1) { showResult('all'); return; }
  state = 'clear';
  document.getElementById('clearEyebrow').textContent = t('clear.eyebrow', { lap, n: stageIdx + 1, name: t('stage.' + stage.id) });
  const rows = [
    [t('st.time'), t('st.timeV', { t: runT.toFixed(2) })],
    [t('st.glassScore'), t('st.pts', { n: glassScore.toLocaleString() })],
    [t('st.bonusPts'), t('st.pts', { n: bonusPts.toLocaleString() })],
    [t('st.bonus'), t('st.pts', { n: timeBonus.toLocaleString() })],
  ];
  document.getElementById('clearStats').innerHTML = rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') +
    `<dt class="total">${t('st.runTotal')}</dt><dd class="total">${t('st.pts', { n: runScore.toLocaleString() })}</dd>`;
  // 次の面の予告（周が変わるときは新しく加わる仕掛けも）
  const nl = stageIdx === STAGES.length - 1 ? lap + 1 : lap, ni = (stageIdx + 1) % STAGES.length;
  let next = t('clear.nextIs', { name: stageLabel(nl, ni) });
  if (nl !== lap) next += '\n' + t('clear.lapUp', { n: nl }) + '\n' + t(nl === 2 ? 'clear.lap2' : 'clear.lap3');
  document.getElementById('clearNext').textContent = next;
  elClear.hidden = false;
  root.classList.add('in-menu');
  clearReadyAt = performance.now() + 700;
  setTimeout(() => { if (state === 'clear') document.getElementById('nextBtn').focus({ preventScroll: true }); }, 50);
}
function nextStage() {
  if (state !== 'clear') return;
  stageIdx++;
  if (stageIdx >= STAGES.length) { stageIdx = 0; lap++; }
  startStage();
}
function toTitle() {
  state = 'title';
  paused = false;
  root.classList.add('in-menu');
  elResult.hidden = true; elTitle.hidden = false;
  renderBest();
  startDemo();
  document.getElementById('startBtn').focus({ preventScroll: true });
}
function startDemo() {
  lap = 1; stageIdx = 2; stage = STAGES[2]; course = stage.len;
  buildCourse(false);
  bike = newBike(); bike.x = 300; bike.v = 320; bike.y = Y_MAX - 12;
  parts = []; pops = [];
}

// ---------- 記録 ----------
function loadBest() { try { const a = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveBest(a) { try { localStorage.setItem(STORE_KEY, JSON.stringify(a)); } catch (e) {} }
// 記録の「どこまで行ったか」。all なら全面制覇、それ以外はアウトになった面
function reachText(r) { return r.all ? t('reach.all') : stageLabel(r.lap, r.stage); }
function renderBoard(el, newIdx) {
  const a = loadBest();
  let h = `<h2>${t('board.title')}</h2>`;
  if (!a.length) h += `<p class="empty">${t('board.empty')}</p>`;
  else {
    h += '<ol>';
    a.forEach((r, i) => {
      h += `<li class="${i === newIdx ? 'new' : ''}"><span>${i + 1}.</span><span>${rankOf(r.score)}</span><span>${t('board.score', { n: r.score.toLocaleString() })}</span>` +
        `<span class="sub">${t('board.sub', { reach: reachText(r), n: r.glass })}</span></li>`;
    });
    h += '</ol>';
  }
  el.innerHTML = h;
}
function rankOf(score) {
  let i = 0;
  while (i + 1 < RANK_FROM.length && score >= RANK_FROM[i + 1]) i++;
  return t('rank.' + i);
}
// kind：'all'（全面制覇）/ 'out'（生徒を轢いた）。アウトの面の点数は入らず、走り切った面までの合計が記録になる
function showResult(kind) {
  resultShown = true;
  state = 'result';
  const all = kind === 'all';
  const total = runScore;
  const head = document.getElementById('resHead');
  head.textContent = t(all ? 'res.allclear' : 'res.out');
  head.className = 'result-head ' + (all ? 'goal' : 'out');
  const rec = { score: total, lap, stage: stageIdx, all, glass: runGlass, at: Date.now() };
  document.getElementById('resEyebrow').textContent = all ? t('res.allEyebrow') : t('res.outEyebrow');
  document.getElementById('resNote').textContent = all ? t('res.allNote', { t: runTime.toFixed(1) }) : t('res.outNote', { reach: reachText(rec) });
  const rows = [
    [t('st.reach'), reachText(rec)],
    [t('st.runTime'), t('st.timeV', { t: runTime.toFixed(1) })],
    [t('st.glass'), t('st.glassN', { n: runGlass })],
    [t('st.fled'), t('st.fledV', { n: runFled })],
    [t('st.combo'), t('st.comboV', { n: maxCombo })],
    [t('st.teacher'), t('st.teacherV', { n: teacherHits })],
  ];
  document.getElementById('resStats').innerHTML = rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') +
    `<dt class="total">${t('st.total')}</dt><dd class="total">${t('st.pts', { n: total.toLocaleString() })}</dd>`;
  const rank = rankOf(total);
  document.getElementById('resRank').innerHTML = `<small>${t('res.rankLabel')}</small>${rank}`;
  let newIdx = -1;
  if (total > 0) {
    const a = loadBest();
    a.push(rec);
    a.sort((p, q) => q.score - p.score);
    a.length = Math.min(a.length, 5);
    newIdx = a.indexOf(rec);
    saveBest(a);
  }
  renderBoard(document.getElementById('boardResult'), newIdx);
  setShare(all
    ? t('share.goal', { score: total.toLocaleString(), rank })
    : t('share.out', { reach: reachText(rec), score: total.toLocaleString(), rank }));
  elResult.hidden = false; elClear.hidden = true;
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
  renderBest();
  renderRanks();
  paintSprites();
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
  const locker = w.kind === 'locker';
  for (let i = 0; i < 16; i++) {
    const far = w.side === 0;
    parts.push({
      k: 'shard', color: locker ? pick(['#8a6a43', '#6e5233', '#2a2a2a', '#f1eadb']) : null, x: w.x + rnd(0, w.w), y: r.y + rnd(0, r.h),
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
  // 基本点（2階の特別教室の窓は高い）＋コンボで 1 枚ごとに 10% ずつ上乗せ（最大 3 倍）
  const base = w.side === 0 ? stage.farPts : 100;
  const pts = Math.round(base * (1 + Math.min(combo - 1, 20) * 0.1));
  glassScore += pts;
  const py = w.side === 0 ? 70 : 470;
  popup(w.x + w.w / 2, py, pick(I18N.list(locker ? 'smash.locker' : 'smash')), locker ? '#f2c14e' : '#bfe9f5', 24, 0.7);
  popup(w.x + w.w / 2, py + 26, '+' + pts, '#f2c14e', 18, 0.7);
  shake = Math.max(shake, 3);
  if (locker) sfx.clang(); else sfx.glass();
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
// 他校の暴走族：木刀で振り抜けばはじき飛ばせる。そのままぶつかると大きく減速
function knockRival(e) {
  e.down = true; e.vx = 420; e.vyy = rnd(-120, 120); e.bubble = { text: t('say.rivalOut'), t: 0.8 };
  bonusPts += RIVAL_PTS;
  popup(e.x, e.y - 120, t('pop.rival', { n: RIVAL_PTS }), '#f2c14e', 22, 1);
  shake = Math.max(shake, 8);
  sfx.thud();
}
function rammed(e) {
  e.down = true; e.vx = 160; e.vyy = rnd(-80, 80);
  bike.v *= 0.25; bike.stun = 1; combo = 0;
  shake = 14;
  popup(bike.x + 20, bike.y - 110, t('pop.rammed'), '#e0333d', 22, 1.1);
  sfx.crash();
}
// 屋上の監督にタックルされると大きく減速。監督はいったん引いて先回りする
function tackled(e) {
  e.away = 1; e.bubble = null;
  bike.v *= 0.2; bike.stun = 1.2; combo = 0; teacherHits++;
  shake = 14;
  popup(bike.x + 20, bike.y - 110, t('pop.tackle'), '#e0333d', 24, 1.1);
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
    if (bike.x >= course) { state = 'goal'; finishT = 0; sfx.fanfare(); }
    setEngine(bike.v, true);
  } else if (state === 'crash') {
    crashT += dt;
    bike.v = Math.max(0, bike.v - 520 * dt);
    bike.x += bike.v * dt;
    bike.rot = Math.min(1.45, bike.rot + dt * 6);
    setEngine(0, false);
    if (crashT > 1.5 && !resultShown) {
      if (canContinue()) showContinue();
      else showResult('out');
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
    if (finishT > 1.4 && !resultShown) { setEngine(0, false); showClear(); }
  } else if (state === 'result' || state === 'clear') {
    setEngine(0, false);
  }
  updateEnts(dt);
  updateFX(dt);
  camX = Math.max(0, bike.x - 230);
}

function updateBike(dt) {
  const b = bike;
  // ダッシュを押すと加速、離すと巡航速度まで自然に減速する
  if (keys.accel) b.v += 520 * dt;
  else if (b.v < V_CRUISE + (isWaxed() ? 60 : 0)) b.v += 300 * dt;
  else b.v -= 160 * dt;
  if (b.stun > 0) { b.stun -= dt; b.v = Math.min(b.v, 150); }
  if (b.inv > 0) b.inv -= dt;
  b.v = clamp(b.v, b.stun > 0 ? 40 : V_MIN, V_MAX + (isWaxed() ? 60 : 0));
  const target = ((keys.down ? 1 : 0) - (keys.up ? 1 : 0)) * 330;
  // ワックスがけの床では横の動きが鈍く、止まりにくい
  b.vy += (target - b.vy) * Math.min(1, dt * (isWaxed() ? 2.6 : 12));
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
  if (b.swingT > 0) {
    b.swingT -= dt; tryBreak(false);
    for (const e of ents) {
      if (e.type !== 'r' || e.down) continue;
      const dx = e.x - b.x;
      if (dx > -20 && dx < 110 && Math.abs(e.y - b.y) < 36) knockRival(e);
    }
  }
  // 木刀は自動：ガラス（下駄箱）のある壁ぎわのレーンにいるときと、暴走族が目の前に来たときに振る
  const inLane = stage.far !== 'none' && (b.y < Y_MIN + REACH || b.y > Y_MAX - REACH);
  const rivalNear = ents.some(e => e.type === 'r' && !e.down && e.x - b.x > -20 && e.x - b.x < 150 && Math.abs(e.y - b.y) < 40);
  if ((inLane || rivalNear) && b.swingCD <= 0) startSwing();
  hornCD -= dt;
  if (keys.horn && hornCD <= 0) honk();
}
function honk() {
  hornCD = 3.5;
  sfx.horn();
  popup(bike.x - 30, bike.y - 130, t('pop.horn'), '#e0333d', 22, 1.1);
  // 前にいる生徒は悲鳴を上げて逃げ出し、廊下からいなくなる（立ちすくんでいた生徒も逃げる）
  for (const e of ents) {
    const ahead = e.x - bike.x;
    if (e.type !== 's' || e.down || e.flee || ahead < -20 || ahead > 700) continue;
    runAway(e);
    e.hornFled = true;
  }
}
// 近いほうの壁へ走って逃げる。奥の壁なら教室に駆け込み、手前なら廊下の外へ出ていく
function runAway(e) {
  e.flee = true; e.fade = 1; e.panic = 0; e.scared = true;
  const toFar = e.y < bike.y || (e.y === bike.y && e.y < (Y_MIN + Y_MAX) / 2);
  e.fleeDir = toFar ? -1 : 1;
  e.dir = 1;
  e.bubble = { text: pick(I18N.list('say.scream')), t: 1 };
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
    if (e.down || e.gone || e.away > 0 || e.fade < 0.6) continue;
    const dx = e.x - bike.x;
    if (e.type === 'r') {
      if (dx > -40 && dx < 60 && Math.abs(e.y - bike.y) < 22) { if (bike.swingT > 0) knockRival(e); else rammed(e); }
      continue;
    }
    const reach = e.type === 'b' ? 24 : 17;
    if (dx < -30 || dx > 44 || Math.abs(e.y - bike.y) > reach) continue;
    if (e.type === 's') { hitStudent(e); return; }
    if (e.type === 'b') { tackled(e); continue; }
    hitTeacher(e);
  }
}
function updateEnts(dt) {
  for (const e of ents) {
    if (e.gone) continue;
    if (e.type === 'b') { updateBoss(e, dt); continue; }
    if (e.x < camX - 300 || e.x > camX + W + 260) continue;
    if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
    if (e.type === 'r') { updateRival(e, dt); continue; }
    if (e.down) {
      e.downT += dt; e.x += e.vx * dt; e.vx *= Math.max(0, 1 - dt * 3.5);
      continue;
    }
    const ahead = e.x - bike.x;
    const live = state === 'play';
    if (e.type === 's') {
      if (live && !e.scared && ahead > 0 && ahead < 230 && Math.abs(e.y - bike.y) < 70) scare(e, 0.55);
      if (e.flee) {
        e.phase += dt * 18; e.x += 30 * dt;
        e.y += e.fleeDir * 240 * dt;
        if (e.fleeDir < 0 && e.y <= Y_MIN) { e.y = Y_MIN; e.fade -= dt * 3; }   // 教室に駆け込んで見えなくなる
        if ((e.fleeDir > 0 && e.y > Y_MAX + 70) || e.fade <= 0) {               // 手前の壁の向こうへ／教室の中へ
          e.gone = true;
          // パラリラで逃がした生徒は 1 人ごとにボーナス
          if (e.hornFled && state === 'play') {
            bonusPts += FLEE_PTS; fled++;
            popup(e.x, Math.min(e.y, Y_MAX) - 70, t('pop.flee', { n: FLEE_PTS }), '#9fd3e3', 16, 0.8);
          }
        }
        continue;
      } else if (e.panic > 0) {
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
      // 先生の種類で動きが違う。体育教師は速く、追い越されても後ろから追いかけてくる
      const sp = (e.kind === 'pe' ? 170 : e.kind === 'science' ? 80 : 95) * (1 + 0.15 * (lap - 1));
      if (live && ahead > 0 && ahead < 520) {
        if (!e.alert) { e.alert = true; e.bubble = { text: t(e.kind === 'science' ? 'say.science' : e.kind === 'pe' ? 'say.pe' : 'say.hey'), t: 1.2 }; sfx.whistle(); }
        const dy = bike.y - e.y;
        e.y += clamp(dy, -sp * dt, sp * dt);
        e.x -= 25 * dt;
      } else if (live && e.kind === 'pe' && e.alert && ahead <= 0 && ahead > -500 && e.chaseT < 2.5) {
        e.chaseT += dt;
        e.x += 330 * dt;
        e.y += clamp(bike.y - e.y, -sp * dt, sp * dt);
      }
    }
    e.y = clamp(e.y, Y_MIN, Y_MAX);
  }
}
function updateRival(e, dt) {
  if (e.down) {
    e.x += e.vx * dt; e.y += e.vyy * dt; e.rot += dt * 9; e.fade -= dt * 1.4;
    if (e.fade <= 0) e.gone = true;
    return;
  }
  if (state !== 'play') return;
  const ahead = e.x - bike.x;
  if (ahead < W) {
    e.x -= e.v * dt; e.wheel -= e.v * dt / 13;
    e.y = clamp(e.y + clamp(bike.y - e.y, -55 * dt, 55 * dt), Y_MIN, Y_MAX);
    if (!e.said && ahead < 520) { e.said = true; e.bubble = { text: t('say.rival'), t: 1.2 }; }
  }
  if (ahead < -400) e.gone = true;
}
function updateBoss(e, dt) {
  if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
  if (state !== 'play') return;
  if (e.away > 0) {
    e.away -= dt;
    if (e.away <= 0) {
      const again = e.kind === 'chief' ? e.blocks < 2 && bike.x < course - 450 : bike.x < course - 900;
      if (again) {
        // 先回りして、また前に立ちはだかる
        e.blocks++;
        e.x = Math.min(bike.x + (e.kind === 'chief' ? 560 : 640), course - 160); e.y = rnd(Y_MIN + 20, Y_MAX - 20);
        e.bubble = { text: bossLine(e), t: 1.3 };
        sfx.whistle();
      } else e.gone = true;
    }
    return;
  }
  if (e.x - bike.x > W) return;   // ゴール前のボスは、近づくまで待っている
  e.phase += dt * 10;
  const sp = 120 + 45 * lap;
  e.y = clamp(e.y + clamp(bike.y - e.y, -sp * dt, sp * dt), Y_MIN, Y_MAX);
  e.x -= 70 * dt;
  if (!e.bubble && !e.spoke) { e.spoke = true; e.bubble = { text: bossLine(e), t: 1.3 }; sfx.whistle(); }
  // 振り切った
  if (e.x < bike.x - 50) {
    bonusPts += PASS_PTS;
    popup(bike.x + 40, bike.y - 120, t('pop.pass', { n: PASS_PTS }), '#f2c14e', 24, 1.1);
    e.away = 0.9; e.spoke = false;
  }
}
function updateDemo(dt) {
  const b = bike;
  b.v = 330;
  const ty = Y_MAX - 12;   // タイトル画面では、見出しに隠れない手前の壁ぎわを走る
  b.vy = clamp((ty - b.y) * 3, -260, 260);
  b.y = clamp(b.y + b.vy * dt, Y_MIN, Y_MAX);
  b.x += b.v * dt; b.wheel += b.v * dt / 13;
  b.swingCD -= dt;
  if (b.swingT > 0) { b.swingT -= dt; tryBreak(true); }
  if (b.swingCD <= 0 && (b.y < Y_MIN + REACH || b.y > Y_MAX - REACH)) startSwing();
  if (b.x > course - 800) startDemo();
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
  for (const e of ents) if (!e.gone && !(e.away > 0) && e.x > camX - 120 && e.x < camX + W + 120) list.push(e);
  list.push(bike);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) {
    if (o === bike || o.type === 'r') drawBike(o);
    else if (o.type === 's') drawStudent(o);
    else drawTeacher(o);
  }
  for (const o of list) if (o !== bike && o.bubble) drawBubble(o);
  drawParts();
  drawNearWall();
  if (isNight() && state !== 'title') drawNight();
  drawPops();
  ctx.restore();
  if (state !== 'title') drawHUD();
  if (state === 'countdown') drawCountdown();
  if (state === 'crash' && crashT > 0.25) bigText(t('big.out'), '#e0333d', '#000', Math.min(1, (crashT - 0.25) * 4));
  if (state === 'goal') bigText(t('big.goal'), '#f2c14e', '#e0333d', Math.min(1, finishT * 4));
  if (paused) drawPause();
}
// 停電：バイクのライトが照らす前方だけ見える
function drawNight() {
  const bx = bike.x - camX + 150, by = bike.y - 50;
  const g = ctx.createRadialGradient(bx, by, 40, bx, by, 430);
  g.addColorStop(0, 'rgba(4,4,14,0)');
  g.addColorStop(0.45, 'rgba(4,4,14,.45)');
  g.addColorStop(1, 'rgba(4,4,14,.9)');
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
}
function drawPause() {
  ctx.fillStyle = 'rgba(10,10,16,.6)'; ctx.fillRect(0, 0, W, H);
  bigText(t('big.pause'), '#f1eadb', '#e0333d', 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `20px ${FONT_DOT}`; ctx.fillStyle = '#f1eadb';
  ctx.fillText(t(NATIVE || COARSE ? 'pause.tc' : 'pause.kb'), W / 2, H / 2 + 80);
}

function drawFarWall() {
  if (stage.theme === 'roof') { drawRoofFar(); return; }
  const gym = stage.theme === 'gym';
  // 天井
  ctx.fillStyle = gym ? '#4f5b55' : C.ceil; ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 22, W, 3);
  // 壁（渡り廊下はコンクリート）
  ctx.fillStyle = gym ? '#b9b6aa' : C.wall; ctx.fillRect(0, 25, W, 120);
  // 蛍光灯
  for (let x = Math.floor(camX / 260) * 260 - 260; x < camX + W + 260; x += 260) {
    const X = x - camX + 60;
    ctx.fillStyle = '#f7f7ef'; ctx.fillRect(X, 4, 120, 7);
    ctx.fillStyle = 'rgba(255,255,230,.25)'; ctx.fillRect(X - 10, 11, 140, 6);
  }
  // 腰壁
  ctx.fillStyle = gym ? '#8f8c82' : C.wainsTop; ctx.fillRect(0, 140, W, 6);
  ctx.fillStyle = gym ? '#a19e93' : C.wains; ctx.fillRect(0, 146, W, FLOOR_TOP - 146);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let x = Math.floor(camX / 65) * 65; x < camX + W + 65; x += 65) ctx.fillRect(x - camX, 146, 2, FLOOR_TOP - 146);
  // 窓
  for (const w of wins) {
    if (w.side !== 0) continue;
    const X = w.x - camX;
    if (X > W + 10 || X + w.w < -10) continue;
    if (w.kind === 'locker') drawLocker(X, 30, w.w, FLOOR_TOP - 32, w);
    else if (gym) drawWindow(X, 40, w.w, 94, w, C.sky, false);
    else drawWindow(X, 40, w.w, 94, w, C.room, true);
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
    ctx.fillText(I18N.list(stage.rooms)[d.room], X + 39, 31.5);
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

// 1階の下駄箱。壊すと扉が外れて中が見える
function drawLocker(X, Y, w, h, item) {
  ctx.fillStyle = '#6e5233'; ctx.fillRect(X - 4, Y, w + 8, h);
  const cols = 4, rows = 5, cw = w / cols, ch = (h - 8) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = X + c * cw + 2, y = Y + 4 + r * ch + 2;
    if (item.broken && (r * 7 + c * 3 + Math.floor(item.crack * 10)) % 3) {
      ctx.fillStyle = '#2a2018'; ctx.fillRect(x, y, cw - 4, ch - 4);
      ctx.fillStyle = (r + c) % 2 ? '#f1eadb' : '#3a3f5a'; ctx.fillRect(x + 4, y + ch - 12, cw - 12, 6); // 上履き
    } else {
      ctx.fillStyle = '#a98656'; ctx.fillRect(x, y, cw - 4, ch - 4);
      ctx.fillStyle = '#5d4329'; ctx.fillRect(x + cw / 2 - 5, y + ch / 2 - 3, 6, 3);
    }
  }
}
// 屋上：空と街並み、奥はフェンス
function drawRoofFar() {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
  g.addColorStop(0, isNight() ? '#0b1026' : '#6fa9d6'); g.addColorStop(1, isNight() ? '#1b2340' : '#cfe4f2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR_TOP);
  // 遠くの街並み（ゆっくり流れる）
  ctx.fillStyle = isNight() ? '#141a30' : '#9fb3c4';
  for (let i = -1; i < 12; i++) {
    const bx = i * 110 - ((camX * 0.2) % 110), bh = 30 + ((i * 37 + Math.floor(camX * 0.2 / 110) * 37) % 50 + 50) % 50;
    ctx.fillRect(bx, FLOOR_TOP - 20 - bh, 90, bh + 20);
  }
  // フェンス
  ctx.strokeStyle = 'rgba(70,80,90,.55)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -((camX) % 14) - 14; x < W + 14; x += 14) { ctx.moveTo(x, 70); ctx.lineTo(x + 50, FLOOR_TOP); ctx.moveTo(x + 50, 70); ctx.lineTo(x, FLOOR_TOP); }
  ctx.stroke();
  ctx.fillStyle = '#6b737b';
  for (let x = -((camX) % 200); x < W; x += 200) ctx.fillRect(x, 64, 5, FLOOR_TOP - 64);
  ctx.fillRect(0, 64, W, 4);
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
  const fl = stage.theme === 'school' ? [C.floorA, C.floorB, C.seam] : stage.theme === 'gym' ? ['#a3a197', '#99978d', '#7f7d74'] : ['#b9b7ae', '#b0aea5', '#8f8d85'];
  for (let i = 0; i < rows; i++) {
    const hgt = 16 + i * 1.6;
    ctx.fillStyle = i % 2 ? fl[0] : fl[1];
    ctx.fillRect(0, y, W, hgt + 1);
    ctx.fillStyle = fl[2];
    ctx.fillRect(0, y, W, 1);
    const len = 180, off = (i * 67) % len;
    for (let x = Math.floor((camX + off) / len) * len - off; x < camX + W + len; x += len) ctx.fillRect(x - camX, y, 2, hgt);
    y += hgt;
    if (y > FLOOR_BOT) break;
  }
  ctx.fillStyle = fl[0]; if (y < FLOOR_BOT) ctx.fillRect(0, y, W, FLOOR_BOT - y);
  // ワックスがけの床はつやつや
  if (isWaxed() && state !== 'title') {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = -((camX * 1.0) % 240) - 240; x < W + 240; x += 240) {
      ctx.beginPath(); ctx.moveTo(x, FLOOR_BOT); ctx.lineTo(x + 60, FLOOR_TOP); ctx.lineTo(x + 100, FLOOR_TOP); ctx.lineTo(x + 40, FLOOR_BOT); ctx.closePath(); ctx.fill();
    }
  }
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
  const X = course - camX;
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
  const E = course + 420 - camX;
  if (E < W && stage.theme !== 'roof') {
    ctx.fillStyle = '#bfb397'; ctx.fillRect(E, 0, W - E + 10, FLOOR_BOT);
    ctx.fillStyle = '#2f9e5a'; ctx.fillRect(E + 30, 40, 80, 30);
    ctx.fillStyle = '#fff'; ctx.font = `15px ${FONT_DOT}`; ctx.fillText(t('sign.exit'), E + 70, 56);
  }
}

function drawNearWall() {
  if (stage.theme === 'roof') {
    // 屋上の手すり
    ctx.fillStyle = '#7d7b73'; ctx.fillRect(0, FLOOR_BOT, W, H - FLOOR_BOT);
    ctx.fillStyle = '#9a988f'; ctx.fillRect(0, FLOOR_BOT, W, 6);
    ctx.fillStyle = '#5c646b';
    for (let x = -(camX % 60); x < W; x += 60) ctx.fillRect(x, FLOOR_BOT + 10, 4, H - FLOOR_BOT);
    return;
  }
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
  if (e.fade < 1) ctx.globalAlpha = Math.max(0, e.fade);
  const moving = !e.down && (e.flee || e.panic > 0 || (!e.scared && (e.mode === 'cross' || e.mode === 'walk')));
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

// 先生の服：生活指導（赤ジャージ）／理科（白衣）／体育（青ジャージ）／ラグビー部監督（屋上のボス）
const TEACHER_LOOK = {
  normal: { pants: '#b8202e', stripe: '#f4f4f4', top: '#c8283a' },
  science: { pants: '#555a63', stripe: '#555a63', top: '#f1f1ec', coat: true },
  pe: { pants: '#1f4aa8', stripe: '#f4f4f4', top: '#2a5bc8', band: true },
  coach: { pants: '#f1f1ec', stripe: '#1d2b5a', top: '#1d2b5a', hoops: true },
  chief: { pants: '#2a2a30', stripe: '#2a2a30', top: '#2a2a30', tie: true, shinai: true },
};
function drawTeacher(e) {
  const look = TEACHER_LOOK[e.kind] || TEACHER_LOOK.normal;
  const s = depthScale(e.y) * (e.type === 'b' ? 1.3 : 1);
  ctx.save();
  ctx.translate(e.x - camX, e.y);
  shadow(s);
  ctx.scale(s, s);
  if (e.down) ctx.rotate(Math.min(1.5, e.downT * 7));
  const walk = e.alert && !e.down ? Math.sin(e.phase) * 4 : 0;
  // ジャージのズボン
  ctx.fillStyle = look.pants; ctx.fillRect(-8 + walk * 0.5, -30, 7, 28); ctx.fillRect(1 - walk * 0.5, -30, 7, 28);
  ctx.fillStyle = look.stripe; ctx.fillRect(-8 + walk * 0.5, -30, 2, 28); ctx.fillRect(6 - walk * 0.5, -30, 2, 28);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-10 + walk * 0.5, -3, 9, 3); ctx.fillRect(0 - walk * 0.5, -3, 9, 3);
  // 上着（白衣は長め、ラグビーのジャージは横じま）
  ctx.fillStyle = look.top; ctx.fillRect(-12, -60, 24, look.coat ? 44 : 32);
  if (look.hoops) { ctx.fillStyle = '#c8283a'; for (let i = 0; i < 3; i++) ctx.fillRect(-12, -56 + i * 10, 24, 4); }
  else if (look.coat) { ctx.fillStyle = '#c9c9c4'; ctx.fillRect(-1, -60, 2, 44); ctx.fillRect(-7, -48, 3, 3); ctx.fillRect(-7, -38, 3, 3); }
  else { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-1, -60, 2, 32); }
  // 腕（通せんぼ）
  ctx.strokeStyle = look.top; ctx.lineWidth = 6; ctx.lineCap = 'round';
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
  if (look.coat && !e.down) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(-8, -73.5, 5, 4); }   // 眼鏡
  if (look.band) { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-9, -76, 18, 3); }                                  // 鉢巻き
  if (look.tie) { ctx.fillStyle = '#f1f1ec'; ctx.fillRect(-3, -60, 6, 8); ctx.fillStyle = '#b3202a'; ctx.fillRect(-1.5, -58, 3, 14); }   // ワイシャツとネクタイ
  if (look.shinai && !e.down) {   // 竹刀を振り上げる
    ctx.strokeStyle = '#d8c48a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(26, -63); ctx.lineTo(44, -110); ctx.stroke();
  }
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
  if (b.rival && b.fade < 1) ctx.globalAlpha = Math.max(0, b.fade);
  // 他校の暴走族は左向きで、黒い特攻服に緑のタンク
  const look = b.rival ? { coat: '#2b2b30', coat2: '#202024', tank: '#1f7a3a', flag: '#1f7a3a', mark: '連合' } : { coat: '#f1eadb', coat2: '#e9e2d2', tank: '#6b2a8c', flag: '#5b1f7a', mark: '爆走' };
  ctx.translate(b.x - camX, b.y);
  shadow(s * 2.2);
  ctx.scale(s, s);
  if (b.rival) ctx.scale(-1, 1);
  if (b.rot) { ctx.translate(0, -6); ctx.rotate(b.rot); }
  const flap = Math.sin(clock * 22) * 3;
  // 旗
  ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-34, -58); ctx.lineTo(-44, -118); ctx.stroke();
  ctx.fillStyle = look.flag;
  ctx.beginPath(); ctx.moveTo(-44, -118); ctx.lineTo(-82, -116 + flap); ctx.lineTo(-80, -94 + flap); ctx.lineTo(-42, -98); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.font = `9px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(look.mark, -62, -106 + flap / 2);
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
  ctx.fillStyle = look.tank; ctx.beginPath(); ctx.ellipse(8, -34, 15, 8, -0.1, 0, Math.PI * 2); ctx.fill();
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
  ctx.strokeStyle = look.coat; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -40); ctx.lineTo(6, -38); ctx.lineTo(8, -20); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.fillRect(4, -22, 10, 5);
  // 特攻服の裾（はためく）
  ctx.fillStyle = look.coat2;
  ctx.beginPath();
  ctx.moveTo(-6, -66); ctx.lineTo(-16, -40); ctx.lineTo(-44 + flap, -36 - flap); ctx.lineTo(-40 + flap * 0.5, -46); ctx.lineTo(-18, -64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(-36 + flap * 0.5, -42 - flap * 0.4, 12, 1.5); ctx.fillRect(-30, -50, 9, 1.5);
  // 胴
  ctx.fillStyle = look.coat;
  ctx.beginPath(); ctx.moveTo(-14, -42); ctx.lineTo(-2, -42); ctx.lineTo(2, -70); ctx.lineTo(-12, -72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0333d'; ctx.fillRect(-12, -46, 13, 4); // サラシの赤
  // ハンドルを握る腕
  ctx.strokeStyle = look.coat; ctx.lineWidth = 5;
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
  const X = e.x - camX, Y = e.y - (e.type === 'b' ? 124 : e.type === 'r' ? 130 : e.type === 't' ? 92 : 80) * s;
  ctx.font = `14px ${FONT_DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(e.bubble.text).width + 14;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X - w / 2, Y - 13, w, 24, 8) : ctx.rect(X - w / 2, Y - 13, w, 24); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X - 4, Y + 10); ctx.lineTo(X, Y + 18); ctx.lineTo(X + 5, Y + 10); ctx.fill();
  ctx.fillStyle = e.type === 's' ? '#1d2546' : '#b3202a';
  ctx.fillText(e.bubble.text, X, Y);
}

function drawParts() {
  for (const p of parts) {
    const X = p.x - camX;
    if (X < -20 || X > W + 20) continue;
    if (p.k === 'shard') {
      ctx.save(); ctx.translate(X, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color || 'rgba(200,238,250,.9)'; ctx.strokeStyle = p.color ? 'rgba(0,0,0,.4)' : '#fff'; ctx.lineWidth = 0.8;
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
  ctx.fillStyle = '#f2c14e'; ctx.font = `22px ${FONT_DOT}`; ctx.fillText((runScore + glassScore + bonusPts).toLocaleString(), 236, 52);
  // 右上：進み具合
  const px = W - 300, pw = 280;
  ctx.fillStyle = 'rgba(12,12,18,.78)'; ctx.fillRect(px - 10, 8, pw + 20, 54);
  ctx.fillStyle = '#a9a294'; ctx.font = `12px ${FONT_DOT}`; ctx.textAlign = 'left';
  ctx.fillText(stageLabel(lap, stageIdx), px, 26);
  ctx.textAlign = 'right'; ctx.fillText(t('hud.left', { m: Math.max(0, (course - bike.x) / 100).toFixed(0) }), px + pw, 26);
  ctx.fillStyle = '#34354a'; ctx.fillRect(px, 40, pw, 6);
  const staffX = px + pw * (doors.length ? doors[doors.length - 1].x / course : 0.9);
  if (stage.staffRoom) { ctx.fillStyle = '#c8283a'; ctx.fillRect(staffX - 1, 36, 3, 14); }
  ctx.fillStyle = '#9fd3e3'; ctx.fillRect(px, 40, pw * clamp(bike.x / course, 0, 1), 6);
  ctx.fillStyle = '#f1eadb'; ctx.beginPath(); ctx.arc(px + pw * clamp(bike.x / course, 0, 1), 43, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#a9a294'; ctx.font = `10px ${FONT_DOT}`; ctx.textAlign = 'center';
  const staffW = ctx.measureText(t('hud.staff')).width;
  if (stage.staffRoom) ctx.fillText(t('hud.staff'), Math.min(staffX, px + pw + 4 - staffW / 2), 60);
  // 速度計とパラリラ。タッチ操作では左下に ▲▼ が重なるので下の中央に出す
  ctx.save();
  if (root.classList.contains('coarse')) ctx.translate((W - 350) / 2 - 10, 0);
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
  ctx.restore();
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
  // 面の紹介
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,16,.6)'; ctx.fillRect(0, 74, W, 112);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `17px ${FONT_DOT}`; ctx.fillStyle = '#f2c14e';
  ctx.fillText(`${t('lap', { n: lap })}　${t('stageNo', { n: stageIdx + 1 })}`, W / 2, 98);
  ctx.font = `36px ${FONT_DISP}`; ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.fillStyle = '#f1eadb';
  const name = t('stage.' + stage.id);
  ctx.strokeText(name, W / 2, 136); ctx.fillText(name, W / 2, 136);
  ctx.font = `17px ${FONT_DOT}`; ctx.fillStyle = '#9fd3e3';
  ctx.fillText(t('intro.' + stage.id), W / 2, 170);
  ctx.restore();
  bigText(n >= 1 ? String(n) : '', '#f1eadb', '#e0333d', 1);
  // この周から加わる仕掛け。最初の面では操作のヒント
  const lines = hazards().map(k => t(k));
  if (!lines.length && lap === 1 && stageIdx === 0) lines.push(t(NATIVE || COARSE ? 'hint.tc' : 'hint.kb'));
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `18px ${FONT_DOT}`; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
  lines.forEach((l, i) => { ctx.fillStyle = hazards().length ? '#ffb3b8' : '#f1eadb'; ctx.strokeText(l, W / 2, 372 + i * 26); ctx.fillText(l, W / 2, 372 + i * 26); });
  ctx.restore();
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
renderBest();
renderRanks();
paintSprites();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintSprites);
startDemo();
requestAnimationFrame(frame);
// テスト用の小さな窓口
window.__roka = { get state() { return state; }, get glass() { return glass; }, get bike() { return bike; }, get ents() { return ents; }, get course() { return course; }, get lap() { return lap; }, get stageIdx() { return stageIdx; }, keys };
})();
