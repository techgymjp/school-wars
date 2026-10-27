# App Store Connect 登録情報（廊下爆走伝 / Hallway Rampage）

App Store Connect に貼り付けて使います。文字数はすべて上限内に収めてあります。
主言語を「日本語」にし、右上の言語メニューから「英語（米国）」を追加して英語の欄を埋めてください。
ビルドのアップロードと審査用の録画は `docs/IOS_BUILD.md` を見てください。

---

## 1. 新規アプリの作成（「アプリ」→「＋」→「新規 App」）

| 項目 | 入力内容 |
| --- | --- |
| プラットフォーム | iOS |
| 名前 | `廊下爆走伝` |
| プライマリ言語 | 日本語 |
| バンドル ID | `jp.techgym.schoolwars`（一覧に出ないときは、先に Apple Developer の「Identifiers」で登録する。Capabilities は追加不要） |
| SKU | `schoolwars`（自分用の管理番号。何でもよい） |
| ユーザアクセス | アクセス制限なし |

---

## 2. App 情報（「一般」→「App 情報」）

| 項目 | 日本語 | 英語（米国） |
| --- | --- | --- |
| 名前（30 文字） | `廊下爆走伝` | `Hallway Rampage` |
| サブタイトル（30 文字） | `窓ガラスを割れ。生徒は轢くな。` | `Smash glass. Spare students.` |

| 項目 | 入力内容 |
| --- | --- |
| カテゴリ | プライマリ：**ゲーム**（サブカテゴリ：アクション、レース）／セカンダリ：なし |
| コンテンツ配信権 | 「第三者のコンテンツを含まない」（絵・音・プログラムはすべて自作） |
| 年齢制限 | 下の「年齢制限の回答」 |
| プライバシーポリシー URL | 日本語 `https://techgym.jp/privacy-policy/`（英語の欄も同じでよい） |

### 年齢制限の回答

- **アニメまたはファンタジーの暴力：まれ／軽度**（バイクで先生や暴走族にぶつかると、倒れて目を回す。流血なし）
- そのほか（リアルな暴力、性的表現、ギャンブル、薬物・アルコール・たばこ、ホラー、下品なユーモア など）：**なし**
- ユーザー生成コンテンツ・チャット・Web 閲覧：**なし**
- 広告：**あり**（AdMob）
- 見込み：9+ 前後。「12+」などになっても問題ありません

---

## 3. 価格および配信状況

- 価格：**無料**
- 配信国：すべての国（初回は日本とアメリカだけにしてもよい）

---

## 4. App のプライバシー

アプリ自体は個人情報を集めません。Google AdMob が集めるデータを申告します（必ず AdMob ヘルプ「Apple の App Store のデータ開示要件への準備」で最終確認）。

| データの種類 | 用途 | ユーザーに関連付け | トラッキング |
| --- | --- | --- | --- |
| ID → デバイス ID | サードパーティ広告、アナリティクス | しない | **する** |
| 使用状況データ → 広告データ | サードパーティ広告、アナリティクス | しない | **する** |
| 使用状況データ → 製品の操作 | アナリティクス | しない | しない |
| 診断 → クラッシュデータ、パフォーマンスデータ、その他の診断データ | アナリティクス | しない | しない |
| 位置情報 → おおよその場所 | サードパーティ広告、アナリティクス | しない | しない |

「トラッキングする」があるので、起動時に App Tracking Transparency の確認画面を出しています（実装済み）。

---

## 5. バージョン情報（「配信」→「iOS App 1.0」）

### 画像

| 欄 | ファイル |
| --- | --- |
| iPhone「6.3 インチ ディスプレイ」（2622 × 1206） | 日本語：`6.3inch/ja-1-lockers.png` 〜 `ja-4-boss.png`／英語：`6.3inch/en-1-…` 〜 `en-4-…` |
| ヘッダと検索結果（ある場合） | `appstore-header-3840x1646.png`、`appstore-search-3840x2560.png` |

6.9 インチの欄は空のままで構いません（6.3 インチの画像が縮小して使われます）。iPad 版は出さないので、iPad の欄も不要です。

### プロモーション用テキスト（170 文字）

日本語：

```
族車で昭和の高校の廊下を爆走！壁ぎわを走れば木刀が自動で窓ガラスを叩き割る。パラリラで生徒を逃がし、他校の暴走族とボス教師を振り切って、5つの面×3周を駆け抜けろ。
```

英語：

```
Rampage through a 1980s high school on a gang bike! Your sword smashes windows by itself. Honk to clear students, knock back rival gangs and beat 5 stages × 3 laps.
```

### キーワード（100 文字・カンマ区切り・スペースなし）

アプリ名・サブタイトルにある言葉は自動で検索対象になるので、ここには入れていません。

日本語：

```
暴走族,バイク,学校,ガラス,窓,ヤンキー,昭和,不良,ツッパリ,木刀,レース,アクション,パラリラ,ホーン,高校,番長,スコア,カジュアル,レトロ,スクール
```

英語：

```
gang,biker,motorcycle,school,glass,smash,window,racing,arcade,retro,delinquent,bike,horn,japan,score
```

### 概要（説明文）

日本語：

```
放課後の廊下を、族車で駆け抜けろ。

三段シートに竹槍マフラーの族車にまたがり、昭和の高校の廊下を爆走！
壁ぎわを走れば木刀が勝手に飛び出し、窓ガラスを片っ端から叩き割る。
ただし、生徒だけは絶対に轢いてはいけない。

■ 5つの面を3周
・1階・昇降口：下駄箱も壊せる。生徒がいっぱい
・2階・特別教室棟：特別教室の窓は2倍の点。白衣の理科の先生が待ち構える
・三階廊下：職員室の前は先生だらけ
・体育館への渡り廊下：足の速い体育教師が、追い越しても追ってくる
・屋上：熱血ラグビー部監督を振り切ってゴールへ

■ 周を重ねるほど、学校は荒れていく
・2周目：他校の暴走族が突っ込んでくる！木刀ではじき返せ。床はワックスでツルツル
・3周目：昼休みの人混み、停電、そしてゴール前には「おまえらー！」と叫ぶボス教師

■ かんたん操作
・▲▼で廊下の奥と手前を行き来するだけ。木刀は壁ぎわで自動で振る
・ダッシュで加速、離せば自然に減速
・パラリラ（ミュージックホーン）を鳴らすと、生徒が悲鳴を上げて逃げ出す

■ 点数と称号
・ガラスを続けて割るとコンボで最大3倍
・逃がした生徒、はじき返した暴走族、振り切ったボスにもボーナス
・タイムが早いほどボーナスが増える
・合計点で「パシリ」から「伝説の総長」までの称号
・結果を友だちにシェア

■ その他
・オフラインでも遊べる（広告・シェアは通信が必要）
・日本語・英語対応

ガラスを割れ。生徒は轢くな。さあ、エンジン始動だ。
```

英語：

```
Tear down the school hallway on a gang bike.

Hop on a chopped-up gang bike with a triple-step seat and bamboo-spear exhausts, and rampage through a 1980s Japanese high school. Ride along a wall and your wooden sword swings by itself, smashing every window in reach. Just one rule: never, ever hit a student.

■ FIVE STAGES, THREE LAPS
• 1F Entrance: shoe lockers break too. Packed with students
• 2F Special classrooms: special-room windows score double. Watch out for the science teacher in a lab coat
• 3F Hallway: teachers crowd around the staff room
• Walkway to the gym: the PE teacher is fast and chases you even after you pass
• Rooftop: shake off the hot-blooded rugby coach and reach the goal

■ THE SCHOOL GETS WILDER EVERY LAP
• Lap 2: a rival gang charges at you (knock them back with your sword) and the floors are freshly waxed
• Lap 3: lunch-break crowds, blackouts, and a boss teacher who blocks every goal

■ EASY TO PLAY
• Just move between the far and near walls with ▲▼. Your sword swings automatically near a wall
• Hold DASH to speed up; let go to slow down
• Honk your musical horn and the students scream and run out of your way

■ SCORES AND RANKS
• Smash windows in a row for combos up to triple points
• Bonuses for students you clear, rivals you knock back and bosses you shake off
• The faster you finish, the bigger the time bonus
• Ranks from Errand Boy to Legendary Boss
• Share your results with friends

■ FEATURES
• Plays offline (ads and sharing need a connection)
• English and Japanese

Smash the glass. Don't hit the students. Start your engine!
```

### そのほか

| 項目 | 入力内容 |
| --- | --- |
| サポート URL | `https://techgym.jp/` |
| マーケティング URL（任意） | `https://techgym.jp/column/claude-code-game-school-wars/` |
| バージョン | `1.0.0` |
| 著作権 | `2026 TECH GYM K.K.` |
| ビルド | TestFlight で確認したビルドを選ぶ |
| リリース方法 | 「このバージョンを手動でリリースする」がおすすめ（審査通過後、AdMob の準備を確認してから公開できる） |

---

## 6. App Review に関する情報

| 項目 | 入力内容 |
| --- | --- |
| サインインが必要 | チェックしない（ログイン不要） |
| 連絡先 | 氏名・電話番号・メールアドレス |
| 添付ファイル | 実機（iPhone）での操作の録画（`docs/IOS_BUILD.md` の 6 章） |

メモ（英語で書いておくと確実）：

```
No login is required. The app shows ads with Google AdMob (interstitial, rewarded and banner). On first launch it asks for consent where required (Google UMP) and then shows the App Tracking Transparency prompt. Rewarded ads are optional: after hitting a student, the player can watch an ad to continue once. All graphics and sounds are original. A screen recording on a physical iPhone is attached.
```

---

## 気をつけたこと

- ドラマ「スクール☆ウォーズ」の名前は掲載文・キーワードに入れていません。他社の作品名や商標をメタデータに使うと、App Store 審査ガイドライン 2.3.7（メタデータ）や 5.2（知的財産）で却下されるおそれがあるためです。
- ドラマ名はゲーム画面の下の一文にだけ入っていて、スマホ・タブレット（タッチ操作）では表示されないので、審査用の録画やスクリーンショットにも映りません。
