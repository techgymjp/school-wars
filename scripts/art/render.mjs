// アイコンと起動画面の元画像（assets/*.png）を描き出す。使い方: node scripts/art/render.mjs assets scripts/art/art.html（playwright が必要）
// そのあと npx @capacitor/assets generate --android で Android 用の画像を作る
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + path.resolve(process.argv[3]));
await p.evaluate(async () => { await document.fonts.load('80px "Dela Gothic One"', '廊下爆走伝'); });
console.log('font ok', await p.evaluate(() => document.fonts.check('80px "Dela Gothic One"', '廊下爆走伝')));
for (const k of ['icon-only', 'icon-foreground', 'icon-background', 'splash', 'splash-dark']) {
  const data = await p.evaluate(k => { draw(k); return document.getElementById('c').toDataURL('image/png'); }, k);
  fs.writeFileSync(`${out}/${k}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
await b.close();
