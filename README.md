# 廊下爆走伝

ドラマ「スクール☆ウォーズ」で暴走族がバイクで校舎の廊下を走り回り、窓ガラスを割りまくる名場面をモチーフにしたブラウザゲームです。

`index.html` をブラウザで開くだけで遊べます（ビルド不要・外部ライブラリなし）。Android アプリ版もあります（下記）。

タイトル画面には大事なルールを 3 つだけ載せ、詳しい説明は「遊び方」ページ（絵つき）にまとめています。

## ルール

- 1周は5面：**1階・昇降口 → 2階・特別教室棟 → 三階廊下 → 体育館への渡り廊下 → 屋上**。3周・全15面を走り切れば全面制覇です。
- 壁ぎわのレーン（床がうっすら青い帯）を走ると、木刀を自動で振って窓ガラスを割ります。1枚 +100点（2階の特別教室の窓は +200点）。続けて割るとコンボで最大3倍。1階では下駄箱も壊せます。
- **先生**にぶつかるとスピードが大きく落ちます。理科の先生（白衣）、体育教師（青ジャージ。追い越しても追ってくる）など、面ごとに先生が違います。
- **生徒**を轢いたらその場でゲームオーバー。それまでに走り切った面の点数が記録になります。
- **パラリラ**を鳴らすと、前にいる生徒が逃げ出して廊下からいなくなります。逃がした生徒1人につき +50点。
- **屋上**はガラスがなく、熱血ラグビー部監督が何度も立ちはだかります。振り切るたびに +1000点。
- 2周目からは**他校の暴走族**（木刀ではじき返すと +300点、ぶつかると減速）と**ワックスがけの床**（すべる）が加わります。3周目からはさらに**昼休みの人混み**と**停電**（ライトの先しか見えない）が加わり、各面のゴール前で**ボス教師**が「おまえらー！」と立ちはだかります（振り切ると +1000点、ゴールまでに2回まで先回りしてくる）。
- 面ごとに「ガラス得点＋ボーナス＋タイムボーナス」が入り、全部の面の合計で称号が決まります。記録の上位5件はブラウザに保存されます。

## 操作

| キー | 動作 |
| --- | --- |
| ↑ / ↓（W / S） | 廊下の奥へ／手前へ |
| → / Space（D） | ダッシュ（離すと自然に減速） |
| X（K） | パラリラ（ミュージックホーンでチャルメラ。前方の生徒が逃げ出す。3.5秒ごと） |
| M | 音のオンオフ |
| Esc / P | 一時停止・再開 |

木刀は、壁ぎわのレーンに入ったときと、暴走族が目の前に来たときに自動で振ります。

スマートフォンは横向きで遊ぶのがおすすめです。左に「パラリラ」と大きな「ダッシュ」、右に ▲▼ のボタンが並びます（指を離さずにボタンからボタンへ滑らせても切り替わります）。縦向きのときは横にするよう案内が出ます（「縦のまま遊ぶ」も選べます）。

## 言語

日本語と英語に対応しています。端末の言語が日本語なら日本語、それ以外は英語で表示し、タイトル画面の「日本語 / English」で切り替えられます（選んだ言語はブラウザに保存されます）。文言は `js/i18n.js` にまとめています。英語名は「Hallway Rampage」です。Android アプリの名前も、端末の言語に合わせて「廊下爆走伝」「Hallway Rampage」になります。

## 遊び方のコツ

- 生徒が多いところでは、早めに「パラリラ」を鳴らして壁ぎわのレーンをあけましょう。
- 三階廊下の突き当たり手前の「職員室」付近は先生だらけ。
- ダッシュしたままだと先生をよけにくくなります。混んできたら指を離して減速。

## 結果のシェア

結果画面から X（旧Twitter）へのポスト、LINE で送る、結果のコピーができます（スマホでは「その他」から端末の共有メニューも使えます）。

シェア文に付くURLは `index.html` の `<head>` にある次の行で決まります（現在は紹介記事のページ）。変えたいときはここを書き換えてください。

```html
<meta name="share-url" content="https://techgym.jp/column/claude-code-game-school-wars/">
```

## Web 版の公開（Vercel）

`vercel.json` で、Vercel が `npm run build` を実行して `www/` を公開するよう設定しています（Android アプリに同梱するのと同じファイルです）。

## Android 版（Google Play 配布用）

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリ内に同梱しているため、ネットにつながっていなくても遊べます（オフラインのときは文字が端末の標準フォントで表示されます）。

- 横画面固定・全画面表示（ステータスバー／ナビゲーションバーを隠す）
- プレイ中は画面が暗くならない
- Android の戻るボタンで一時停止（タイトル・結果画面ではアプリを終了）
- 別のアプリに切り替えると自動で一時停止し、音も止まる
- 結果画面の「シェア」は Android の共有メニューから LINE や X などを選べる
- タイトル画面にバージョン（`v1.0.0 (build 12)` など）とプライバシーポリシーへのリンクを表示

アプリ ID（パッケージ名）は `jp.techgym.schoolwars` です（Google Play に一度公開すると変更できません）。

### 広告（Google AdMob）

Android アプリでのみ広告を表示します（Web 版には広告は出ません）。

| 広告 | タイミング |
| --- | --- |
| インタースティシャル（全画面） | 毎回：「エンジン始動」でプレイを始める前、結果画面の「もう一回」の前、「タイトルへ」でタイトルに戻る前 |
| リワード | 生徒を轢いてアウトになったとき「広告を見て続行」を選ぶと、その場から走り直せる（1 ゲーム 1 回まで、10 秒で自動的に結果画面へ） |

- EU・英国など同意が必要な地域では、初回起動時に Google の同意確認画面が出ます。その地域では、タイトル画面の「広告の設定」から同意内容をいつでも変更できます。
- AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id` にあります。
- 広告ユニット ID（インタースティシャル・リワード）は `js/ads.js` の `UNITS.production` にあります。
- 動作確認用 APK（Release の `school-wars.apk`）は常に **Google のテスト広告** を表示します。自分でタップしても問題ありません。
- Google Play 用の .aab をビルドするときだけ、CI が `ADMOB_MODE=production` で本番の広告に切り替えます（`scripts/build-web.js` が `js/ads-config.js` を書き換えます）。
- 本番の広告を自分でタップするとアカウント停止の対象になるので注意してください。

### ビルド方法

**GitHub Actions（自動）**: Web 版や `android/` を変更して push すると、`.github/workflows/android.yml` が動作確認用の APK を作ります。
既定ブランチのビルドは GitHub の Release（`android-latest`）に自動で載るので、Android 端末で次の URL を開くだけで最新版をダウンロードできます。

https://github.com/techgymjp/school-wars/releases/latest/download/school-wars.apk

リリース画面（https://github.com/techgymjp/school-wars/releases/tag/android-latest ）は次の QR コードからも開けます。

<img src="docs/apk-qr.png" alt="APK のリリース画面を開く QR コード" width="180">

ダウンロードした `school-wars.apk` を開き、「提供元不明のアプリ」のインストールを許可するとインストールできます。
動作確認用の署名鍵（`android/app/debug.keystore`）はリポジトリで固定しているので、新しいビルドもアンインストールせずに上書きインストールできます。
（Release に載る APK はデバッグ版です。Google Play には下の手順で作る署名済み .aab を使います）

**手元の PC（Android Studio）**:

```bash
npm ci
npm run android:sync   # Web ファイルを www/ にまとめて Android プロジェクトへコピー
npm run android:open   # Android Studio で開く
```

アイコンと起動画面は `assets/` の元画像から作っています。元画像は `scripts/art/` で描いています。作り直すときは次のとおりです。

```bash
node scripts/art/render.mjs assets scripts/art/art.html   # playwright が必要
npx @capacitor/assets generate --android --iconBackgroundColor '#0f1016' --iconBackgroundColorDark '#0f1016' --splashBackgroundColor '#0f1016' --splashBackgroundColorDark '#0f1016'
```

### Google Play へ公開する手順

1. GitHub のリポジトリの Settings → Secrets and variables → Actions に、アップロード鍵の情報を 4 つ登録する（鍵は他のアプリと同じものでよい）
   | 名前 | 内容 |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | `base64 -i upload.jks \| tr -d '\n' \| pbcopy` でコピーした文字列 |
   | `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | 鍵のパスワード |
2. Actions の「Android build」を実行すると、署名済みの `school-wars-release-aab`（.aab）ができる
3. [Google Play Console](https://play.google.com/console) でアプリを作成し、.aab をアップロードする
   （ストア掲載情報・スクリーンショット・プライバシーポリシー・コンテンツのレーティングなどの入力が必要です。
   広告を入れているので「広告を含む」の申告と、データセーフティでの広告 ID の申告も必要です）

バージョン番号（versionCode）は Actions の実行回数が自動で使われます。表示用のバージョン名は `package.json` の `version` です。

## ライセンス

All rights reserved. 著作権はテックジム株式会社に帰属します。無断での複製・改変・再配布、Web サイトやアプリとしての公開を禁止します。ただし、テックジムの受講生が学習目的で複製・改変することは許可します（商用利用は不可。詳しくは `LICENSE`）。

## ファイル構成

```
index.html        画面の骨組み
css/style.css     見た目（スマホの横画面・縦画面の切り替えを含む）
js/main.js        ゲーム本体（描画・操作・効果音・シェア）
js/i18n.js        表示言語（日本語 / 英語）の文言
js/ads.js         Google AdMob 広告（Android アプリのみ）
js/ads-config.js  広告のモード（ビルド時に生成）
js/build-info.js  アプリのバージョン表示（ビルド時に生成）
assets/           アイコンと起動画面の元画像
android/          Android アプリのプロジェクト（Capacitor）
scripts/          Android に同梱する Web ファイルを www/ にまとめるスクリプトと、アイコンの元画像を描くスクリプト
```
