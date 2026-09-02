# いろんなTNT追加アドオン (many_tnt_addon)

Minecraft 統合版 (Bedrock) 向けのアドオン。67種類のユニークなTNTと、遠隔で着火できるリモート起爆装置を追加します。

対応バージョン: Minecraft 1.21.90 以降 (`@minecraft/server` 2.7.0)

## 導入方法

`many_tnt_addon.mcaddon` を Minecraft で開くと、ビヘイビアーパックとリソースパックの両方が導入されます。
ワールドには**両方のパックを適用してください** (片方だけだと表示または挙動が欠けます)。

## 遊び方

- **着火**: 火打石で右クリック / 隣が炎・溶岩 / レッドストーン通電 / 燃えている矢が当たる / 近くの爆発に巻き込まれる
- **リモート起爆装置**: 手に持って使うと、視線の先 64 ブロック以内のTNTを遠隔で着火します
- **入手**: クリエイティブの「いろんなTNT」タブ、または作業台でクラフト

### コマンド

| コマンド | 内容 |
| --- | --- |
| `/scriptevent manytnt:help` | TNT一覧と操作方法を表示 |
| `/scriptevent manytnt:stats` | 累計爆発数・使用した種類・よく使う上位5種を表示 |
| `/scriptevent manytnt:mute` | 爆発時のチャット演出のON/OFF |

## リポジトリの構成

```
BP/                  ビヘイビアーパック (ブロック定義・レシピ・ドロップ表・スクリプト)
  scripts/main.js    TNTの挙動と特殊効果の本体
RP/                  リソースパック (テクスチャ・表示名)
tools/               開発用のツール
many_tnt_addon.mcaddon   BP/ と RP/ から作られる配布ファイル
```

## 開発

`BP/` と `RP/` が編集対象で、`many_tnt_addon.mcaddon` はそこから生成される成果物です。
**`.mcaddon` を直接編集せず、必ずビルドで作り直してください。**

```sh
# 整合性チェック (TNT追加時のファイル付け忘れを検出)
node tools/validate.mjs

# 回帰テスト (ゲームを起動せずに main.js の挙動を検証)
node --import ./tools/register-mock.mjs tools/test.mjs

# テクスチャを作り直す (色や紋章を変えたとき)
node tools/generate-textures.mjs

# 検査とテストを通した上で .mcaddon を作り直す
./tools/build.sh
```

Node.js 22 以降が必要です。テストは `tools/mock-minecraft-server.mjs` で `@minecraft/server` を
差し替えることで、Minecraft を起動せずに爆発イベントを流し込んで挙動を確認します。

### TNTを追加するときに必要なファイル

`node tools/validate.mjs` が付け忘れを検出してくれます。

1. `BP/scripts/main.js` の `TNT_TABLE` に設定を追加 (必要なら効果関数も)
2. `BP/blocks/<名前>.json` — ブロック定義
3. `BP/recipes/<名前>.json` — クラフトレシピ
4. `BP/loot_tables/blocks/<名前>.json` — 破壊時のドロップ
5. `tools/lib/palettes.mjs` に色と紋章を1行追加し、`node tools/generate-textures.mjs` を実行
   （テクスチャPNGは手描きせず、ここから生成する。紋章の絵柄は `tools/lib/emblems.mjs`）
6. `RP/textures/terrain_texture.json` と `RP/blocks.json` — テクスチャの登録
7. `BP/texts/*.lang` と `RP/texts/*.lang` — 表示名 (BPとRPで同じ内容にする)

### テクスチャの作り

作りは Mojang が公開しているバニラのリソースパック
（[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples) の
`resource_pack/textures/blocks/tnt_side.png` ほか）を読んで合わせてある。

- **側面**: 本体は4列周期の縦縞（`明・明・暗・最暗`）。行によって縞全体が1段ずれ、
  0行目は1段明るく、11行目と15行目は1段暗い。帯は 5〜10行の6ドットで、
  上下に暗い区切り線は入らない。文字が乗るのは帯の内側 6〜9行だけで、
  5行目は文字の無い白、10行目はひとつ沈んだ白。
- **上面**: 4×4タイル `地明明地 / 明灰灰暗 / 明灰灰最暗 / 暗暗最暗最暗`。
  中央に導火線の差し込み口が黒い塊として入り、まわりに煤が散る。
- **底面**: 4×4タイル `暗地地暗 / 地灰灰最暗 / 地灰灰最暗 / 最暗×4`。

種類ごとに変えるのは本体の色と、帯に描く紋章（4行×12列）だけ。

> Mojang のテクスチャは `(c) Mojang AB. All rights reserved.` で
> Minecraft EULA の対象のため、**このリポジトリには一切含めていない**。
> 参照したのは構造（縞の周期・帯の位置・タイルの並び）だけで、
> 色と絵柄は `tools/` の生成器で作っている。構造を確認し直したいときは
> 上記リポジトリを別途 clone すること。
