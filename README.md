# いろんなTNT追加アドオン (many_tnt_addon)

Minecraft 統合版 (Bedrock) 向けのアドオン。72種類のユニークなTNTと、遠隔で着火できるリモート起爆装置を追加します。

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
data/tnt-defs.mjs         TNTの一覧。ここが唯一の情報源
BP/                       ビヘイビアーパック
  scripts/
    main.js               入口。各機能を登録するだけ
    core/                 一覧・着火・爆発・統計・コマンド
    effects/              種類ごとの特殊効果
    util/                 エンティティ・ブロック・演出の小物
    data/tnt-table.js     生成物: 実行時に読む設定表
  blocks/ recipes/ loot_tables/ texts/   生成物
  entities/primed_tnt.json               起爆中のTNT
RP/                       リソースパック
  textures/blocks/        生成物: ブロックのテクスチャ
  textures/entity/tnt/    生成物: 起爆中のTNTのテクスチャ
  entity/ models/ render_controllers/    起爆中のTNTの見た目
tools/                    開発用のツール
many_tnt_addon.mcaddon    BP/ と RP/ から作られる配布ファイル
```

### 単一の情報源

TNT1種類の情報は `data/tnt-defs.mjs` の1件にまとまっている。
名前・威力・効果・色・紋章・レシピをそこに書けば、あとは生成される。

```
data/tnt-defs.mjs
      │
      ├─ node tools/build-assets.mjs
      │     BP/blocks/<id>.json           ブロック定義
      │     BP/recipes/<id>.json          レシピ
      │     BP/loot_tables/blocks/<id>.json ドロップ
      │     BP/texts/*.lang, RP/texts/*.lang 表示名
      │     RP/blocks.json                 ブロックの音
      │     RP/textures/terrain_texture.json テクスチャの登録
      │     BP/scripts/data/tnt-table.js   スクリプトが読む表
      │     BP/scripts/effects/index.js    効果の名前→実体
      │
      └─ node tools/generate-textures.mjs
            RP/textures/blocks/*.png       ブロックのテクスチャ
            RP/textures/entity/tnt/*.png   起爆中のテクスチャ
            RP/entity/primed_tnt.entity.json
            RP/render_controllers/primed_tnt.render_controllers.json
```

手で書くのは `data/tnt-defs.mjs` と、効果の中身 (`BP/scripts/effects/`)、
紋章の絵柄 (`tools/lib/emblems.mjs`) だけ。生成し忘れは
`node tools/validate.mjs` が検出する。

### 核系TNTの破壊範囲

核系は `createExplosion` では範囲を広げられない (Minecraft の仕様で、威力を
上げても地面の耐爆性で光線が止まってしまう) ため、爆心地を中心とした球を
直接くり抜くことで規模を出している。上にも下にも同じだけ広がる。

| | 球の半径 | 直径 | 石で埋まっている場合の破壊数 |
| --- | --- | --- | --- |
| 核TNT | 24 | 48 | 約 56,000 |
| 超核TNT | 36 | 72 | 約 190,000 |
| 水素爆弾 | 50 | 100 | 約 500,000 |
| ツァーリボンバ | 66 | 132 | 約 1,150,000 |
| 反物質爆弾 | 80 | 160 | 約 2,050,000 |
| 終焉TNT | 56 | 112 | 約 700,000 |

1tick あたりの「触るマス数」と「置き換えるブロック数」の両方に上限があるので、
規模が大きくても瞬間的な負荷は一定に保たれる (`tools/lib` ではなく
`BP/scripts/util/blocks.js` の `blastBudget`)。そのぶん最大級のものは
掘り終わるまでに十数秒かかる。読み込まれていないチャンクは掘られない。

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

### TNTを追加するには

1. `data/tnt-defs.mjs` に1件足す（名前・威力・効果名・色・紋章・レシピ）
2. 効果が新しいなら `BP/scripts/effects/` のどれかに `～Effect` 関数を書く
3. 紋章が新しいなら `tools/lib/emblems.mjs` に 10行×14列で描く
4. `node tools/build-assets.mjs && node tools/generate-textures.mjs`
5. `./tools/build.sh`

### テクスチャの作り

**バニラのTNTのテクスチャそのものを土台にしている。**
`tools/generate-textures.mjs` がバニラの `tnt_side.png` / `tnt_top.png` /
`tnt_bottom.png` を読み込み、使われている13色を「役割」に分けて、
そのTNTの色に差し替える。側面の "TNT" の文字を紋章に置き換える。紋章は72種類を見分けられるよう
帯（5〜10行）を越えて本体の上まで使い、はみ出した部分には自動で
1ドットの縁取りが付く。

縞の周期・帯のムラ・上面の煤の散り方といった細部は実物そのままなので、
バニラのTNTと並べても違和感が出ない（上面と底面は実物と1ドットも違わない
並びになり、側面も紋章部分を除いて完全に一致する）。

種類ごとに変えるのは**地の色ひとつと紋章（10行×14列）だけ**。
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
