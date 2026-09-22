# マスタープロンプト: 「いろんなTNT追加アドオン」超進化 & 超バグ修正

> このドキュメントは、AI エンジニア（または人間の開発者）がこのリポジトリで作業するときの**唯一の作業指示書**です。
> 上から順に読み、フェーズ順に実行してください。行番号は現行 `many_tnt_addon.mcaddon` 内の `BP/scripts/main.js`（2486行）を指します。

---

## 0. 役割とゴール

あなたは **Minecraft 統合版（Bedrock）アドオンのシニアエンジニア**です。Script API（`@minecraft/server` 2.x）、ブロック/アイテム JSON、リソースパックに精通しています。

**ゴール**
1. 既存 67 種の TNT と起爆装置を、**クラッシュ・ハング・データ破壊ゼロ**で動く状態にする（超バグ修正）。
2. 保守しやすい構造に作り替え、遊びの幅を大きく広げる（超進化）。
3. 既存ワールドとの互換性を壊さない（識別子・UUID を維持）。

**成功の定義**: 後述「9. 完了条件」をすべて満たし、`.mcaddon` をビルドしてリポジトリに PR として提出すること。

---

## 1. 現状の把握（前提知識）

| 項目 | 現状 |
|---|---|
| 配布形態 | `many_tnt_addon.mcaddon`（ZIP）1 ファイルのみ。ソースはリポジトリに展開されていない |
| BP | `blocks/` 67、`items/detonator.json`、`loot_tables/blocks/` 67、`recipes/` 68、`scripts/main.js`、`texts/`（en_US / ja_JP） |
| RP | `blocks.json`、`textures/blocks/`（各 TNT の top/side + `tnt_bottom`）、`terrain_texture.json`、`item_texture.json`、`texts/` |
| マニフェスト | バージョン 30.0.0、`min_engine_version` [1,21,90]、依存 `@minecraft/server` **2.7.0** |
| 仕組み | カスタムブロック `manytnt:*_tnt` → 着火時にブロックを消し、**タグ付きバニラ `minecraft:tnt` エンティティ**を召喚 → `world.beforeEvents.explosion` で爆発をキャンセルし、`TNT_TABLE` の設定で `createExplosion` + 特殊効果を実行 |
| 着火経路 | 火打石（`playerInteractWithBlock`）、隣接する炎/溶岩・レッドストーン（`onTick` 10tick ポーリング）、燃えた矢、起爆装置（視線 64 ブロック）、他の爆発による連鎖 |
| 付帯機能 | `/scriptevent manytnt:mute` `manytnt:help` `manytnt:stats`、実績・統計（dynamic property） |

**API の事実（`@minecraft/server@2.7.0` の型定義で確認済み）**
- `Entity.applyKnockback(horizontalForce: VectorXZ, verticalStrength: number)`（1.x の 4 引数形式ではない）
- `Dimension.setWeather(weatherType: WeatherType, duration?)`（`world.setWeather` は存在しない）
- 利用可能: `Dimension.isChunkLoaded`、`Dimension.fillBlocks`、`Dimension.getTopmostBlock`、`system.runJob`、`EntityQueryOptions.excludeGameModes`、`BlockStates.get(name).validValues`
- ブロックのカスタムコンポーネントで `onRedstoneUpdate`（`minecraft:redstone_consumer` が必要）と `onStepOn` / `onStepOff` が使える
- API 2.7.0 は **1.26.2x 系エンジン**向けの版（npm の rc タグ `2.7.0-rc.1.26.30-preview.*` で確認）

---

## 2. 絶対ルール（違反したら差し戻し）

1. **互換性**: 既存ブロック/アイテムの識別子（`manytnt:*`）とマニフェストの UUID は変更しない。パックのバージョンは上げる（→ 31.0.0）。
2. **安定API のみ**: `@minecraft/server` / `@minecraft/server-ui` の安定版だけを使う。beta API と実験的トグルは使わない。
3. **ハングさせない**: 1 tick あたりのブロック操作は **4096 回以下**。重い処理はすべて `system.runJob`（ジェネレーター）で分割する。`createExplosion` の威力は 100 以下にクランプし、**1 tick に 1 発まで**に抑える。
4. **例外を漏らさない**: すべてのイベントハンドラーと効果関数は、外側で try/catch する。ただし `catch (err) {}` で黙って握りつぶすのは禁止。`DEBUG` フラグで `console.warn` を出す共通ロガーを通す。
5. **ワールドを壊さない**: 岩盤・バリア・ポータル・コマンドブロック・ストラクチャーブロック・ジグソーは、どの効果でも破壊しない。コンテナ（チェスト等）を消すときは**中身をドロップ**する。
6. **データの正本は 1 つ**: TNT の定義は 1 か所に集約し、ブロック JSON・ルートテーブル・レシピ・言語ファイル・テクスチャ定義は**生成物**にする。
7. **既存のスタイルを守る**: 日本語コメント、`NS` 定数、`dimension, center` の引数順など、周囲のコードに合わせる。
8. **推測で API を書かない**: 使うシグネチャは、`node_modules/@minecraft/server/index.d.ts` で必ず確認する。

---

## 3. フェーズ 0: ソース化とビルド・検証基盤

1. `.mcaddon` を展開し、次の構成でリポジトリに置く。
   ```
   packs/BP/...   packs/RP/...
   tools/defs/tnt.json        ← TNT 定義の正本（識別子・日英名・色・威力・レシピ・説明文）
   tools/generate.mjs         ← 正本から blocks/loot/recipes/lang/terrain_texture/blocks.json を生成
   tools/validate.mjs         ← 検証（下記）
   tools/build.mjs            ← dist/many_tnt_addon.mcaddon を作る（BP/ RP/ を ZIP、store でも deflate でも可）
   test/                      ← @minecraft/server のモックを使ったユニットテスト
   package.json               ← 型定義用に @minecraft/server@2.7.0 / @minecraft/server-ui を devDependencies に入れる
   ```
2. `validate.mjs` では次を検査する。
   - すべての JSON がパースできる
   - 各 TNT について、ブロック・ルートテーブル・レシピ・日英の言語キー・top/side テクスチャ・`terrain_texture` のエントリ・`TNT_TABLE` のエントリが**すべて揃っている**
   - レシピの材料 ID が `minecraft:` の実在アイテム（`@minecraft/vanilla-data` の `MinecraftItemTypes` と照合）か、`manytnt:` の既存 ID である
   - マニフェストの `min_engine_version` と Script API のバージョンが矛盾しない
   - `node --check` で全スクリプトの構文が通る
3. ルート直下の `many_tnt_addon.mcaddon` は、ビルドした最新版で更新する（配布物として残す）。

---

## 4. フェーズ 1: 超バグ修正（優先度順）

各項目で「原因 → 修正 → 検証」を行い、コミットメッセージにバグ ID を入れること。

### 🔴 致命的

| ID | 場所 | 症状 | 修正方針 |
|---|---|---|---|
| **B01** | manifest | `min_engine_version` 1.21.90 に対して API 2.7.0（1.26.2x 系向け）を要求している。古いバージョンではスクリプトが丸ごと読み込まれず、**どの TNT も爆発しない** | `min_engine_version` を API に合わせて引き上げる（例 [1,26,20]）。BP と RP の相互 `dependencies` も追加する |
| **B02** | 422-445, 534-590, 635-657 | **TNT の増殖**。`igniteTnt` がブロックの存在を確認せずにエンティティを召喚する。さらに `litSet` は同期的に add → delete されるので意味がない。自前の `createExplosion` も source なしの爆発として `beforeEvents.explosion` に届き、`chainReactionCheck` が二重に走る。結果、1 ブロックの核TNTから核が複数発生する | 着火を「予約済みの位置の集合」で管理する。召喚の直前にブロックが同じ typeId であることを確認し、なければ中止する。自前の爆発は連鎖スキャン対象から外す（フラグまたは位置の照合）。 |
| **B03** | 911, 1335, 1441, 1496, 2006 | `applyKnockback({x,z}, strength)` が 2.x の引数形式と合っていない。水平方向の力は常に 1 で、strength（最大 3.8）が**垂直方向**に入るため、プレイヤーが空高く打ち上げられて落下死する | `applyKnockback({ x: nx * h, z: nz * h }, v)` に直し、水平と垂直を別々に設計する。共通ヘルパー `knockbackFrom(center, ent, h, v)` にまとめる |
| **B04** | 2088 | `world.setWeather` は存在しないので、嵐TNTの天候が変わらない | `dimension.setWeather(WeatherType.Thunder, 6000)` を使う |

### 🟠 重大

| ID | 場所 | 症状 | 修正方針 |
|---|---|---|---|
| B05 | 453 付近 | ガチャTNT: `center` を宣言する前に参照して ReferenceError になり、当選音が鳴らない | `center` の宣言を先頭に移す |
| B06 | 490 付近 | 連鎖着火したガチャTNTが、当選した種類ではなく**ガチャ自身の設定**（威力2・効果なし）で爆発する | `finishExplosion` に `effectiveTypeId/effectiveCfg` を渡す |
| B07 | 124-128 | 「全種類制覇」実績が事実上解除できない（ガチャTNT自身がほぼ記録されない） | 着火時の元の種類も「使用済み」として記録する。または分母からガチャを除く |
| B08 | 2053-2073 | 豊作TNT: ネザーウォートの状態名は `age`、ビートルートの最大値は 3 ではない。どちらも成長しない | 固定値をやめ、`withState` を大きい値から試して最大値を動的に決める（`BlockStates.get(...).validValues` も利用） |
| B09 | 1679-1735 | ディスコTNT: 元に戻すとき typeId しか復元しないので、階段の向きなどのブロック状態と**チェストの中身が消える**。途中でワールドを閉じるとコンクリートのまま残る | 元に戻すデータを `BlockPermutation` で保持する。対象はコンテナ以外のフルブロックに限る。未復元のデータは dynamic property に保存し、ワールド読み込み時に復元する |
| B10 | 2009-2020 | 津波TNT: 100 tick 後に範囲内の水を**元からあった水も含めて**すべて消す | 自分が置いた座標だけを記録して消す |
| B11 | 1507, 1662, 2254 | 地震・ブラックホール・縦穴がエンドポータル枠やコマンドブロックなども壊す。コンテナの中身も消える | `INDESTRUCTIBLE_BLOCKS` と共通の `safeBreak(block)`（コンテナの中身をドロップ）を全効果で使う |
| B12 | 1340-1348, 2117-2135, 2423-2442 | テレポート・エンダーマン・エンドTNT のテレポート先が壁の中、溶岩、奈落になりうる | `findSafeLanding(dimension, x, z, yHint)` を作る（足元が固体で、頭上 2 マスが空いていて、溶岩でない場所を探す）。見つからなければテレポートしない |
| B13 | 1868, 2479 | 虹TNT・終焉TNT が `iceEffect` のような**内部の関数名**をチャットに出す | 定義ファイルの表示名を言語キー経由で表示する |
| B14 | 全ブロック JSON | `menu_category.group: "manytnt:tnt_group"` を定義する `item_catalog` がない（コンテンツログの警告、クリエイティブタブの配置崩れ） | `BP/item_catalog/crafting_item_catalog.json` でグループとアイコンを定義する（形式は公式ドキュメントで確認） |
| B15 | 各ブロック `minecraft:flammable` | `destroy_chance_modifier: 100` のため、10 tick のポーリングより先に炎がブロックを燃やして**TNT が消える**ことがある | `destroy_chance_modifier: 0` にして、着火検知に任せる |
| B16 | 568-590 | バニラの爆発による連鎖の中心が `getImpactedBlocks()[0]`（任意の 1 ブロック）で、半径は固定 4 | 巻き込まれたブロックの重心と範囲から中心と半径を決める |

### 🟡 中〜軽微

| ID | 症状 | 修正方針 |
|---|---|---|
| B17 | 連鎖の上限（120/2秒）を超えた着火が**消える**ので、TNT が爆発しないまま残る | 捨てずにキューへ積み、レート制限しながら順に処理する |
| B18 | 巨大クレーター（反物質は半径 175）が未ロードのチャンクで 1 ブロックごとに例外を投げ、重くなる。しかも中途半端に欠ける | `isChunkLoaded` で事前にスキップし、`runJob` で分割する。球状の破壊は `fillBlocks`（行ごとの BlockVolume + excludeTypes）で高速化する |
| B19 | `nearbyEntities` がスペクテイターやアイテムにも効果をかける。`includePlayers` 引数も使われていない | `excludeGameModes: [Spectator]` を指定し、効果の種類ごとにフィルターを明示する |
| B20 | `irradiateEntities` が防具立て・額縁・アイテムにもダメージ処理を試みる | `minecraft:health` コンポーネントを持つエンティティだけを対象にする |
| B21 | 統計を爆発のたびに JSON で書き込んでいる | 変更フラグを立てて 100 tick ごとにまとめて保存する |
| B22 | マニフェストと言語ファイルの説明文（「33種類」など）が実際の数と合わない | 生成時に種類数を自動で埋め込む |
| B23 | `mob_spell_particle` を色情報なしで出しているので、色が出ない可能性がある | `MolangVariableMap.setColorRGB` で色を付ける（型定義で確認してから） |
| B24 | 未使用の `DEBUG` と `includePlayers`、重複した JSDoc ブロック（916-994 付近） | 整理する |

### ⚖️ バランス（ゲームを壊すレベルの抜け道）

| ID | 問題 | 方針（デフォルト案） |
|---|---|---|
| B25 | お宝TNT（TNT + 金インゴット 1 個）から平均でダイヤ約 4 個などが出る。**無限ダイヤ製造機** | 出る量を材料の価値より少なくする（例: 鉄・金・ラピス中心で、ダイヤは低確率） |
| B26 | 運試しTNT（TNT + ウサギの足）で、当たると**ネザライトの欠片が約 5 個** | ネザライトは極低確率にし、期待値を材料より下げる |
| B27 | ガチャTNT（TNT + エメラルド + ウサギの足）から**反物質爆弾**（本来はネザースター等が必要）が出る | 重み付き抽選にして、核系以上は除外または極低確率にする（設定で変更可能にする） |
| B28 | 虹TNT（TNT + アメジスト）の抽選プールに**核TNTの効果**（クレーター半径 18）が入っている | プールから外す |

---

## 5. フェーズ 2: アーキテクチャ刷新

`main.js`（2486 行）を ES モジュールに分割する。Bedrock はスクリプト間の相対 import に対応している。
```
scripts/
  main.js                 ← エントリー（登録だけを行う）
  config/tnt_table.js     ← 生成された定義 + 効果関数の対応表
  core/ignition.js        ← 着火の予約・重複防止・キュー（B02, B17）
  core/explosion.js       ← beforeEvents.explosion の横取り、finishExplosion、連鎖
  core/scheduler.js       ← runJob ベースの予算付きタスク実行（1 tick 4096 操作まで）
  core/safety.js          ← INDESTRUCTIBLE、safeBreak、findSafeLanding、isChunkLoaded ラッパー
  effects/*.js            ← 効果を系統ごとに分ける（nuclear / elemental / mobs / terrain / fun / utility）
  systems/stats.js        ← 実績・統計（プレイヤー別を含む）
  systems/settings.js     ← ワールド設定（dynamic property）
  systems/i18n.js         ← rawtext と translate を組み立てるヘルパー
  ui/*.js                 ← server-ui のフォーム
  util/*.js               ← ベクトル計算・乱数・ロガー
```
- **レッドストーンの検知**: `minecraft:redstone_consumer` と `onRedstoneUpdate` に切り替える。炎の検知のためのポーリングは残すが、間隔と負荷を見直す。
- **導火線の表示**: 召喚した TNT エンティティの `nameTag` に TNT 名（言語キー）を表示し、何の TNT が燃えているか一目で分かるようにする。

---

## 6. フェーズ 3: 超進化（新機能）

### Must（必須）
1. **完全な多言語化**: チャットやアクションバーのメッセージをすべて言語キーにし、`{ rawtext: [{ translate, with }] }` で送る。日本語と英語の両方を用意する。
2. **設定メニュー**（`@minecraft/server-ui`、オペレーター限定）: 開き方は `/scriptevent manytnt:settings` または起爆装置をしゃがみながら長押し。項目は次のとおり。
   - 地形破壊 ON/OFF（安全モード: 爆発演出と効果のみにする）
   - 威力倍率（0.25〜2.0）
   - 核系 TNT の許可（OFF の場合は着火しても不発にし、メッセージを出す）
   - 連鎖の上限
   - チャット演出の ON/OFF
   - ガチャの排出テーブル（通常 / 核なし）
3. **TNT 図鑑**（新アイテム `manytnt:tnt_guide`）: 使うと ActionForm で系統別の一覧を開く。各 TNT の説明・レシピ・自分の使用回数・未使用なら「？？？」を表示する。

### Should（推奨）
4. **起爆装置 v2**: しゃがみながら TNT を使うと登録または解除する（最大 16 個、プレイヤーごとに保存）。通常の使用で**一斉起爆**する（最大 64 ブロック以内、ディメンション一致が条件）。登録数はアクションバーに表示する。登録がなければ従来どおり視線の先を起爆する。
5. **実績の拡張**: プレイヤー別の統計と、新しい実績（連鎖 50 発、10 秒以内に 10 種類、全系統制覇など）を追加する。`/scriptevent manytnt:stats` はプレイヤー別の結果を表示する。
6. **新 TNT を 8〜12 種追加**（同じ規約で定義、テクスチャは既存と同じ画風で生成する）。候補:
   - 分裂TNT（空中で小TNT 6 個に分裂する）
   - 地雷TNT（`onStepOn` で起爆。自分で置いた地雷は踏んでも起爆しない）
   - 時限TNT（着火から 30 秒後。残り時間を表示する）
   - 誘導TNT（最寄りの敵対モブへ飛んでいく）
   - 採掘TNT（範囲内の鉱石だけを掘ってドロップする）
   - 防壁TNT（周囲に石レンガの壁を建てる）
   - 時間停止TNT（周囲のモブを数秒間停止させる）
   - 植林TNT（周囲に苗木を植え、骨粉を与える）
   - 橋TNT（向いている方向に橋を架ける）
   - 花火ショーTNT（色付き花火を ItemStack から打ち上げる）
   - 反転TNT（周囲の重力効果を反転させる）
   - 収穫祭TNT（作物を自動で回収する）
   各 TNT の日英名、説明、レシピ（既存の段階とバランスに沿ったもの）を定義ファイルに書く。

### Could（余力があれば）
7. ディスペンサーからの発射に対応できるか調査し、可能なら実装する（`playerInteractWithBlock` 以外のフックがあるか確認）。
8. 核系の演出を強化する: 爆心地の閃光で画面をフェードさせる（`camera fade`）、衝撃波のリングを遅れて到達させる。

---

## 7. フェーズ 4: 性能予算

| 項目 | 上限 |
|---|---|
| 1 tick あたりのブロックの読み書き | 4096 |
| 1 tick あたりの `createExplosion` | 1 発（威力 100 以下） |
| 1 tick あたりのパーティクル | 400 |
| 同時に実行中の runJob | 8（超えたらキューで待たせる） |
| 反物質の爆発 1 回の総処理時間 | 30 秒以内で完了し、その間 TPS が大きく下がらないこと |

---

## 8. 検証（ゲーム外で必ず行うこと）

1. `node tools/validate.mjs` が警告ゼロで通る。
2. `node --check` と、(可能なら) ESLint が通る。
3. `test/` のユニットテスト（`@minecraft/server` のモックで実行）が通る。最低限、次を確認する。
   - 同じ位置に 3 回連鎖着火しても、TNT エンティティは 1 体しか出ない（B02）
   - ガチャの連鎖着火で当選した種類の効果が出る（B06）
   - `knockbackFrom` の水平・垂直の値が期待どおり（B03）
   - `findSafeLanding` が壁の中・溶岩・奈落を返さない（B12）
   - スケジューラーが 1 tick の予算を守る
4. `tools/build.mjs` で `.mcaddon` を作り、ZIP の中身が `BP/` `RP/` の 2 つのパックになっていることを確認する。
5. ゲーム内で手動確認する手順を `TEST_PLAN.md` に書く（着火経路 6 種、代表的な TNT、設定、図鑑、起爆装置 v2、マルチプレイ）。

---

## 9. 完了条件（Definition of Done）

- [ ] B01〜B28 がすべて「修正済み」または「修正しない理由を記載済み」になっている
- [ ] フェーズ 2 の構成になっていて、`main.js` は登録処理だけになっている
- [ ] Must の機能がすべて動作し、Should の機能もできる範囲で実装されている
- [ ] 検証 1〜4 がすべて成功している
- [ ] `CHANGELOG.md`（日本語、v31.0.0）、`README.md`（導入方法、TNT 一覧、設定、コマンド）、`TEST_PLAN.md` がある
- [ ] マニフェストのバージョンが 31.0.0 で、UUID は変わっていない
- [ ] フェーズごとに小さく意味のあるコミットに分け、PR にまとめている

---

## 10. 作業の進め方

- 各フェーズの開始時に TODO を作り、完了したら更新する。
- 仕様に迷ったら、「バニラ TNT と同じ挙動」「ワールドを壊さない」「重くしない」の順で優先する。
- 各フェーズの最後に、変更点・残った課題・ゲーム内で要確認の点を**日本語で短く**報告する。

## 11. 未決事項（ユーザー確認待ち。回答がなければデフォルト案で進める）

1. バランス調整（B25〜B28）をどこまで弱くするか → **デフォルト: 期待値を材料より下げる**
2. 新 TNT の数 → **デフォルト: 10 種**
3. 安全モード（地形破壊 OFF）の初期値 → **デフォルト: OFF（従来どおり破壊する）**
4. 最低対応バージョン → **デフォルト: API 2.7.0 に合わせて 1.26.20 以上**
