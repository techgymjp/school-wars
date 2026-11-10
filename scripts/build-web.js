// アプリ（Android / iOS）に同梱する Web ファイル、または Web 版として公開するファイルを www/ にまとめる
//   npm run build      … Web 版（Vercel で公開する）
//   npm run build:app  … アプリ用（APP_BUILD=1）。Web 版だけの部分を取り除く
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const app = process.env.APP_BUILD === '1';
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'css', 'js']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

// アプリ用のビルドでは、Web 版だけの部分（他のストアへのリンク、テスト用の窓口、ドラマ名の入った一文など）を取り除く。
// アプリの中で「隠す」のではなく、最初から入れない（App Store の審査で隠し機能と見なされないように）。
// 目印：HTML は <!-- web-only --> … <!-- /web-only -->、JS は // web-only:start … // web-only:end、CSS は /* web-only:start */ … /* web-only:end */
const MARKS = [
  /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
  /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[^\n]*\n?/g,
  /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
];
// アプリに残っていたらビルドを止める言葉
const FORBIDDEN = ['web-only', 'play.google.com', 'apps.apple.com', '__roka', 'スクール☆ウォーズ', 'School Wars'];
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}
if (app) {
  for (const f of files(out).filter(f => /\.(html|js|css)$/.test(f))) {
    let s = fs.readFileSync(f, 'utf8');
    for (const re of MARKS) s = s.replace(re, '');
    fs.writeFileSync(f, s);
    const hit = FORBIDDEN.find(w => s.includes(w));
    if (hit) {
      console.error(`アプリ用のビルドに Web 版だけの部分が残っています：${path.relative(out, f)} に「${hit}」`);
      process.exit(1);
    }
  }
}

// ストア用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built ${app ? 'app' : 'web'} assets into www/ (ads: ${mode}, version: ${version})`);
