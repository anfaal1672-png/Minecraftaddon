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
BP/                       ビヘイビアーパック
  scripts/main.js         TNTの挙動と特殊効果の本体
  blocks/ recipes/ ...    ブロック定義・レシピ・ドロップ表
  entities/primed_tnt.json  起爆中(導火線が燃えている状態)のTNT
RP/                       リソースパック
  textures/blocks/        ブロックのテクスチャ
  textures/entity/tnt/    起爆中のTNTのテクスチャ
  entity/ models/ render_controllers/   起爆中のTNTの見た目の定義
tools/                    開発用のツール
many_tnt_addon.mcaddon    BP/ と RP/ から作られる配布ファイル
```

### 起爆中のTNTの見た目について

火を点けたあと飛んでいるTNTは、バニラの `minecraft:tnt` ではなく
自前の `manytnt:primed_tnt` を使っている。バニラのTNTエンティティは
見た目がエンジン側で固定されていて、どのTNTに火を点けても普通のTNTに
見えてしまうため。

バニラのTNTエンティティの中身は `minecraft:explode` / `physics` /
`collision_box` / `pushable` という普通のコンポーネントだけなので、
同じ構成で作れば挙動はそのままに見た目だけ差し替えられる。
導火線4秒・重力・爆風で吹き飛ぶ・ピストンで押される、といった仕様は
すべてバニラと同じ設定にしてあり、連鎖着火で導火線が短くなる仕様も
バニラと同じ `component_group` をイベントで足して再現している。

どのTNTの姿にするかは、エンティティプロパティ `manytnt:kind` に入れた
「`TNT_TABLE` の何番目か」でレンダーコントローラが選ぶ。
その一覧は `tools/generate-textures.mjs` が `main.js` の並び順から
書き出すので、手で並べ替える必要はない（ずれていれば
`node tools/validate.mjs` が検出する）。

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

**バニラのTNTのテクスチャそのものを土台にしている。**
`tools/generate-textures.mjs` がバニラの `tnt_side.png` / `tnt_top.png` /
`tnt_bottom.png` を読み込み、使われている13色を「役割」に分けて、
そのTNTの色に差し替える。側面の帯の "TNT" の文字だけを紋章に置き換える。

縞の周期・帯のムラ・上面の煤の散り方といった細部は実物そのままなので、
バニラのTNTと並べても違和感が出ない（上面と底面は実物と1ドットも違わない
並びになり、側面も紋章部分を除いて完全に一致する）。

種類ごとに変えるのは**地の色ひとつと、帯に描く紋章（4行×12列）だけ**。
残りの12色は地の色から自動で作られる。

> 土台にするテクスチャは Mojang の配布物
> （[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)）で、
> `(c) Mojang AB. All rights reserved.` / Minecraft EULA の対象。
> **このリポジトリには含めていない**ので、テクスチャを生成し直すときは
> 手元に clone しておくこと。
>
> ```sh
> git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples
> ```
>
> 別の場所に置いてある場合は `VANILLA_RP=/path/to/resource_pack/textures/blocks`
> で指定できる。生成済みのテクスチャは `RP/textures/blocks/` にコミット済みなので、
> 色や紋章を変えないのであれば clone は不要。
