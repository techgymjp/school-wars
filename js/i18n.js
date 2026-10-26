// 表示言語（日本語 / 英語）。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えも可能
const I18N = (() => {
  const dict = {
    ja: {
      'doc.title': '廊下爆走伝',
      'title.eyebrow': '昭和59年 ・ 某県立高校 ・ 三階廊下',
      'title.name': '廊下爆走伝',
      'title.tagline': 'ガラスを割れ。生徒は轢くな。',
      'title.lead': '放課後の廊下を族車で駆け抜けて、窓ガラスを木刀で割りまくれ。',
      'title.start': 'エンジン始動',
      'title.howto': '遊び方',
      'title.best': '自己ベスト {n}点（{rank}）',
      'tile.glass': 'ガラスを割る', 'tile.glassD': '壁ぎわで木刀を振る',
      'tile.teacher': '先生は減速', 'tile.teacherD': 'ぶつかると遅くなる',
      'tile.student': '生徒はアウト', 'tile.studentD': '絶対に轢かない',
      'howto.title': '遊び方', 'howto.back': 'もどる',
      'h.goal.t': '140m の廊下を走り抜ける',
      'h.goal.d': 'バイクは何もしなくても前に進みます。ゴールまで早く着くほど、タイムボーナスが増えます。',
      'h.glass.t': '壁ぎわで木刀を振ってガラスを割る',
      'h.glass.d': '床がうっすら青くなっている帯（奥の壁ぎわ・手前の壁ぎわ）にいるときだけ、木刀が窓に届きます。1枚 +100点。続けて割るとコンボで最大 +300点。',
      'h.teacher.t': '先生にぶつかると減速',
      'h.teacher.d': '赤いジャージの先生は、通せんぼしに寄ってきます。ぶつかるとスピードが大きく落ち、コンボも途切れます。',
      'h.student.t': '生徒を轢いたら一発アウト',
      'h.student.d': '学生服やセーラー服の生徒は、絶対に轢かないこと。アウトになると失格で、記録は残りません。',
      'h.horn.t': 'パラリラで道をあける',
      'h.horn.d': 'ホーンを鳴らすと、前にいる生徒が悲鳴を上げて逃げ出し、廊下からいなくなります。奥の壁ぎわに逃げた生徒は教室へ、手前に逃げた生徒は廊下の外へ。3.5秒ごとに使えます。',
      'h.ctl.t': '操作',
      'c.move': '廊下の奥へ／手前へ', 'c.accel': 'アクセル', 'c.brake': 'ブレーキ',
      'c.swing': '木刀を振る（押しっぱなしで連続）', 'c.horn': 'パラリラ（生徒が逃げ出す）', 'c.pause': '一時停止', 'c.sound': '音のオンオフ',
      'h.score.t': 'スコアと称号',
      'h.score.d': '合計 ＝ ガラス得点 ＋ タイムボーナス。合計に応じて称号が付きます。',
      'h.rankFrom': '{n}点〜',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adSettings': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'sound.on': '音：ON', 'sound.off': '音：OFF',
      'aria.game': 'ゲーム画面：学校の廊下',
      'tb.up': '奥へ', 'tb.down': '手前へ', 'tb.horn': 'パラリラ', 'tb.brake': 'ブレーキ', 'tb.accel': 'ダッシュ', 'tb.swing': '棍棒',
      'rot.title': 'スマホを横にしてください',
      'rot.lead': '廊下爆走伝は横画面で遊ぶゲームです。画面の向きのロックを外して、横向きにしてください。',
      'rot.full': '全画面で横にする', 'rot.stay': '縦のまま遊ぶ',
      'foot': 'ドラマ「スクール☆ウォーズ」の名場面をモチーフにしたファンメイドのゲームです。現実の廊下では走らないでください。',
      'cont.eyebrow': '生徒を轢いてしまった',
      'cont.lead': '広告を見ると、その場から1回だけ走り直せます。',
      'cont.watch': '広告を見て続行', 'cont.giveUp': 'あきらめる',
      'cont.loading': '広告を読み込み中…', 'cont.fail': '広告を読み込めませんでした',
      'cont.restart': '再出発！',
      'res.again': 'もう一回', 'res.back': 'タイトルへ', 'res.stats': '成績',
      'res.goal': 'ゴール！', 'res.out': 'アウト！',
      'res.goalEyebrow': '三階廊下 走破', 'res.outEyebrow': '生徒を轢いてしまった',
      'res.goalNote': '廊下 140m を {t} 秒で駆け抜けた。',
      'res.outNote': '生徒だけは轢いてはいけない。失格なので記録は残らない。',
      'res.rankLabel': '称号',
      'st.time': 'タイム', 'st.timeV': '{t} 秒',
      'st.glass': '割ったガラス', 'st.glassV': '{n} ／ {all} 枚',
      'st.combo': '最大コンボ', 'st.comboV': '{n} 連続',
      'st.teacher': '先生にぶつかった', 'st.teacherV': '{n} 回',
      'st.glassScore': 'ガラス得点', 'st.bonus': 'タイムボーナス', 'st.pts': '{n} 点',
      'st.total': '合計', 'st.dq': '失格',
      'board.title': '番付（この端末）',
      'board.empty': 'まだ記録がありません。ゴールまで走り切ると記録されます。',
      'board.score': '{n}点', 'board.sub': '{t}秒 ／ ガラス{n}枚',
      'rank.0': 'パシリ', 'rank.1': '下っ端', 'rank.2': '特攻隊長', 'rank.3': '親衛隊長', 'rank.4': '伝説の総長',
      'rank.out': '無期停学',
      'share.label': '結果をシェア', 'share.x': '𝕏 でポスト', 'share.line': 'LINE で送る',
      'share.copy': '結果をコピー', 'share.copied': 'コピーしました', 'share.copyFail': 'コピーできませんでした',
      'share.more': 'その他', 'share.native': 'シェア', 'share.dialog': '結果をシェア',
      'share.title': '廊下爆走伝', 'share.tag': '#廊下爆走伝',
      'share.goal': '【廊下爆走伝】三階廊下を{t}秒で走破！ガラス{n}枚、合計{score}点で称号「{rank}」',
      'share.out': '【廊下爆走伝】ガラスを{n}枚割ったのに、生徒を轢いて失格……称号「{rank}」',
      'hud.time': 'タイム', 'hud.glass': 'ガラス', 'hud.score': '得点',
      'hud.floor': '三階廊下', 'hud.left': '残り {m}m', 'hud.staff': '職員室',
      'hud.slow': '減速中', 'hud.horn': 'パラリラ', 'hud.combo': '{n} コンボ',
      'hint.kb': '壁ぎわで Space ／ 生徒はよけろ', 'hint.tc': '壁ぎわで「棍棒」／ 生徒はよけろ',
      'big.out': 'アウト！', 'big.goal': 'ゴール！', 'big.pause': '一時停止',
      'pause.kb': 'Esc か P で再開', 'pause.tc': '画面をタップで再開',
      'pop.slow': 'スピードダウン', 'pop.horn': 'パラリラ〜♪',
      'smash': 'ガシャーン!|パリーン!|バリバリッ!|ガチャン!|パリン!',
      'say.scream': 'キャー!|ひぃっ!', 'say.oof': 'ぐはっ!', 'say.whoa': 'うわっ!', 'say.hey': 'コラーッ!',
      'rooms': '1年1組|1年2組|1年3組|2年1組|2年2組|2年3組|3年1組|3年2組|3年3組|生徒指導室|職員室',
      'sign.goal': 'ゴール', 'sign.exit': '非常口',
    },
    en: {
      'doc.title': 'Hallway Rampage - 廊下爆走伝',
      'title.eyebrow': '1984 ・ Public high school ・ 3F hallway',
      'title.name': 'Hallway Rampage',
      'title.tagline': "Smash the glass. Don't hit the students.",
      'title.lead': 'Ride a gang bike down the school hallway after class and smash every window with a wooden sword.',
      'title.start': 'Start engine',
      'title.howto': 'How to play',
      'title.best': 'Your best: {n} pts ({rank})',
      'tile.glass': 'Smash glass', 'tile.glassD': 'Swing near a wall',
      'tile.teacher': 'Teachers slow you', 'tile.teacherD': 'Hitting one costs speed',
      'tile.student': 'Students: OUT', 'tile.studentD': 'Never hit one',
      'howto.title': 'How to play', 'howto.back': 'Back',
      'h.goal.t': 'Race down a 140 m hallway',
      'h.goal.d': 'The bike moves forward on its own. The sooner you reach the goal, the bigger your time bonus.',
      'h.glass.t': 'Swing near a wall to smash windows',
      'h.glass.d': 'Your sword only reaches the windows while you ride in the faint blue band along the far or near wall. +100 per window, up to +300 with combos.',
      'h.teacher.t': 'Teachers slow you down',
      'h.teacher.d': 'Teachers in red tracksuits move in to block you. Hitting one cuts your speed and breaks your combo.',
      'h.student.t': "Hit a student and you're out",
      'h.student.d': "Never hit students in school uniforms. If you do, you're disqualified and the run isn't recorded.",
      'h.horn.t': 'Honk to clear the way',
      'h.horn.d': 'Honk and the students ahead scream and run off the hallway: into a classroom on the far side, or out past the near wall. You can use it every 3.5 seconds.',
      'h.ctl.t': 'Controls',
      'c.move': 'Move to the far / near wall', 'c.accel': 'Accelerate', 'c.brake': 'Brake',
      'c.swing': 'Swing the sword (hold to keep swinging)', 'c.horn': 'Horn (students run away)', 'c.pause': 'Pause', 'c.sound': 'Sound on/off',
      'h.score.t': 'Score and ranks',
      'h.score.d': 'Total = glass points + time bonus. Your total earns you a rank.',
      'h.rankFrom': '{n}+ pts',
      'legal.privacy': 'Privacy policy',
      'legal.adSettings': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'sound.on': 'Sound: ON', 'sound.off': 'Sound: OFF',
      'aria.game': 'Game screen: a school hallway',
      'tb.up': 'Far wall', 'tb.down': 'Near wall', 'tb.horn': 'HORN', 'tb.brake': 'BRAKE', 'tb.accel': 'DASH', 'tb.swing': 'SWING',
      'rot.title': 'Turn your phone sideways',
      'rot.lead': 'Hallway Rampage is played in landscape. Turn off rotation lock and turn your phone sideways.',
      'rot.full': 'Go full screen', 'rot.stay': 'Play in portrait',
      'foot': 'A fan-made game inspired by a famous scene from the Japanese TV drama "School Wars". Please don\'t run in real hallways.',
      'cont.eyebrow': 'You hit a student',
      'cont.lead': 'Watch an ad to get back on the bike once, right where you crashed.',
      'cont.watch': 'Watch ad to continue', 'cont.giveUp': 'Give up',
      'cont.loading': 'Loading ad…', 'cont.fail': "Couldn't load the ad",
      'cont.restart': 'Back on the bike!',
      'res.again': 'Play again', 'res.back': 'Title', 'res.stats': 'Results',
      'res.goal': 'GOAL!', 'res.out': 'OUT!',
      'res.goalEyebrow': '3rd-floor hallway cleared', 'res.outEyebrow': 'You hit a student',
      'res.goalNote': 'You tore through the 140 m hallway in {t} seconds.',
      'res.outNote': "Never hit a student. You're disqualified, so this run isn't recorded.",
      'res.rankLabel': 'Rank',
      'st.time': 'Time', 'st.timeV': '{t} s',
      'st.glass': 'Windows broken', 'st.glassV': '{n} / {all}',
      'st.combo': 'Best combo', 'st.comboV': '{n} in a row',
      'st.teacher': 'Teachers hit', 'st.teacherV': '{n}',
      'st.glassScore': 'Glass points', 'st.bonus': 'Time bonus', 'st.pts': '{n} pts',
      'st.total': 'Total', 'st.dq': 'Disqualified',
      'board.title': 'Best runs (this device)',
      'board.empty': 'No records yet. Make it to the goal to get on the board.',
      'board.score': '{n} pts', 'board.sub': '{t} s / {n} windows',
      'rank.0': 'Errand Boy', 'rank.1': 'Underling', 'rank.2': 'Raid Captain', 'rank.3': 'Guard Captain', 'rank.4': 'Legendary Boss',
      'rank.out': 'Suspended Indefinitely',
      'share.label': 'Share your result', 'share.x': 'Post on 𝕏', 'share.line': 'Send on LINE',
      'share.copy': 'Copy result', 'share.copied': 'Copied', 'share.copyFail': "Couldn't copy",
      'share.more': 'More', 'share.native': 'Share', 'share.dialog': 'Share your result',
      'share.title': 'Hallway Rampage', 'share.tag': '#廊下爆走伝',
      'share.goal': '[Hallway Rampage] Cleared the 3rd-floor hallway in {t}s! {n} windows, {score} pts. Rank: {rank}',
      'share.out': "[Hallway Rampage] Broke {n} windows, then hit a student and got disqualified… Rank: {rank}",
      'hud.time': 'TIME', 'hud.glass': 'GLASS', 'hud.score': 'SCORE',
      'hud.floor': '3F HALLWAY', 'hud.left': '{m}m to go', 'hud.staff': 'Staff room',
      'hud.slow': 'SLOWED', 'hud.horn': 'HORN', 'hud.combo': '{n} COMBO',
      'hint.kb': 'Space near a wall / dodge the students', 'hint.tc': 'SWING near a wall / dodge the students',
      'big.out': 'OUT!', 'big.goal': 'GOAL!', 'big.pause': 'PAUSED',
      'pause.kb': 'Press Esc or P to resume', 'pause.tc': 'Tap the screen to resume',
      'pop.slow': 'SLOW DOWN', 'pop.horn': 'Honk honk♪',
      'smash': 'CRASH!|SMASH!|SHATTER!|CLANG!|TINKLE!',
      'say.scream': 'Eek!|Yikes!', 'say.oof': 'Oof!', 'say.whoa': 'Whoa!', 'say.hey': 'HEY!',
      'rooms': 'Class 1-1|Class 1-2|Class 1-3|Class 2-1|Class 2-2|Class 2-3|Class 3-1|Class 3-2|Class 3-3|Guidance|Staff room',
      'sign.goal': 'GOAL', 'sign.exit': 'EXIT',
    },
  };

  const STORE_KEY = 'rokabakuso.lang';
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存不可 */ }
  const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  let lang = dict[saved] ? saved : (/^ja\b/i.test(deviceLang) ? 'ja' : 'en');
  const listeners = [];

  // t('res.goalNote', { t: '32.15' }) → '廊下 140m を 32.15 秒で駆け抜けた。'
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.ja[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }
  // 「|」で区切った候補の一覧
  function list(key) { return t(key).split('|'); }

  // data-i18n（文字）/ data-i18n-html（タグを含む）/ data-i18n-href（リンク先）/ data-i18n-aria（読み上げ名）の付いた要素を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach(el => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === lang)));
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存不可 */ }
    apply();
    listeners.forEach(f => f(l));
  }

  return {
    t, list, apply, setLang,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
  };
})();
