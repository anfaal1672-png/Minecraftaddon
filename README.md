# いろんなTNT追加アドオン (many_tnt_addon)

Minecraft 統合版 (Bedrock) 向けのアドオン。**120種類**のユニークなTNTと、
ゲーム内のTNT図鑑・設定画面・遠隔起爆装置を追加します。

対応バージョン: Minecraft 1.21.90 以降 (`@minecraft/server` 2.7.0 / `@minecraft/server-ui` 2.1.0)

## 導入方法

`many_tnt_addon.mcaddon` を Minecraft で開くと、ビヘイビアーパックとリソースパックの
両方が導入されます。ワールドには**両方のパックを適用してください**
(片方だけだと表示か挙動のどちらかが欠けます)。

## 遊び方

- **着火**: 火打石で右クリック / 隣が炎・溶岩 / レッドストーン通電 /
  燃えている矢が当たる / 近くの爆発に巻き込まれる
- **入手**: クリエイティブのカテゴリ別タブ、または作業台でクラフト
  (材料は順不同。作り方は図鑑で確認できます)
- **TNT図鑑**: 図鑑アイテムを持って使うか `/scriptevent manytnt:menu`。
  カテゴリ → 一覧 → 詳細とたどると、威力・地形への影響・導火線の長さ・
  レシピまで全部載っています
- **遠隔起爆装置**: 手に持って使うと、視線の先 64 ブロック以内のTNTに火を点けます

### カテゴリ

| | 数 | 内容 | 例 |
| --- | --- | --- | --- |
| 基本 | 4 | 素直に爆発するだけ | メガ・ミニ・ロケット・ガチャ |
| 核兵器 | 6 | 人が作った最大火力 | 核・超核・水素爆弾・ツァーリボンバ・反物質・終焉 |
| 属性 | 15 | 火・水・氷・雷といった自然の力 | 火炎・氷結・雷・溶岩・津波・酸・蒸気・砂嵐 |
| 移動 | 13 | 引き寄せ・打ち上げ・転移 | 重力・反重力・テレポート・ブラックホール・エレベーター |
| 生物 | 10 | モブを呼び出す | 召喚・雪だるま・ハチ・ネコ・村人・ゴーレム |
| 地形 | 14 | 壊すより整える | 草原・砂漠・豊作・製錬・森・洞窟・湖・ネザー化 |
| 便利 | 14 | 回復・収集・照明 | 回復・お宝・経験値・補給・松明・ビーコン・測量 |
| 演出 | 11 | 見て楽しむ | 紙吹雪・虹・ディスコ・花火・隕石・オーロラ |
| **建築** | 10 | **掘る・均す・建てる** | トンネル・整地・防壁・塔・架橋・避難所・採掘場 |
| **兵器** | 10 | **炸裂の仕方が違う** | クラスター・焼夷弾・地雷・ミサイル・EMP・貫通爆弾 |
| **宇宙** | 8 | **宇宙が起こす最大** | 超新星・中性子星・ワームホール・銀河・ビッグバン |
| 災厄 | 5 | 常軌を逸したもの | 特異点・時間停止・地殻貫通・崩落・増殖 |

### 変わった動きをするもの

- **地雷TNT** は自分では爆発しません。置いてから2秒で起動し、
  半径2.5に生き物が入ると初めて着火します（落ちているアイテムには反応しません）
- **ミサイルTNT / 彗星TNT** は弧を描いて飛び、離れた場所に着弾します
- **建築カテゴリ**は爆発を一切起こしません。トンネルを掘る、地面を均す、
  壁や塔や橋を建てる、といった「作る」ためのTNTです
- **ビッグバンTNT** はすべてを消したあと、その跡地に草原・湖・林・動物を作り直します

### コマンド

| コマンド | 内容 |
| --- | --- |
| `/scriptevent manytnt:menu` | 図鑑・記録・設定の画面を開く |
| `/scriptevent manytnt:list` | 全種類をカテゴリごとにチャットへ出す |
| `/scriptevent manytnt:stats` | 累計爆発数・使った種類・よく使う上位5種 |
| `/scriptevent manytnt:mute` | 爆発時のチャット演出のON/OFF |
| `/scriptevent manytnt:set <項目> <値>` | 設定を変える (項目は下の表) |
| `/scriptevent manytnt:reset` | 設定を初期値に戻す |
| `/scriptevent manytnt:debug` | 起爆中の数・処理待ち・握り潰した例外を出す |

### 設定

ワールドごとに保存されます。画面 (`manytnt:menu` → 設定) からも変えられます。

| 項目 | 既定 | 内容 |
| --- | --- | --- |
| `announce` | ON | 爆発したときの案内文をチャットに出す |
| `chain` | ON | 近くのTNTを巻き込んで着火する |
| `terrain` | ON | 切るとブロックを一切壊さなくなる |
| `warning` | ON | 大型TNTの導火線中に警報を鳴らす |
| `scale` | 1.0 | 核系の破壊半径をまとめて増減する (0.25〜2.0) |

ワールドのゲームルール `tntExplodes` `mobGriefing` `doFireTick` も見ます。
それらを切っているワールドでは、このアドオンも地形を壊しません。

## リポジトリの構成

```
data/                     TNTの定義。ここが唯一の情報源
  index.mjs               全部をつないで検証する入口
  schema.mjs              1件ぶんの書式と、その決まりごと
  categories.mjs          カテゴリの一覧
  tnt/<カテゴリ>.mjs       定義そのもの (12ファイル)

BP/                       ビヘイビアーパック
  scripts/
    main.js               入口。登録するだけ
    core/                 一覧・設定・着火・導火線・爆発・連鎖・記録・画面
    lib/                  座標・ブロック・エンティティ・演出の道具
    effects/              種類ごとの特殊効果 (カテゴリごとに1ファイル)
    data/                 生成物: 実行時に読む表
  entities/primed_tnt.json  生成物: 起爆中のTNT
  blocks/ recipes/ loot_tables/ items/ texts/   生成物

RP/                       リソースパック
  textures/blocks/        生成物: ブロックのテクスチャ
  textures/entity/tnt/    生成物: 起爆中のTNTのテクスチャ
  entity/ models/ render_controllers/           生成物: 起爆中の見た目

tools/                    開発用のツール
  build.mjs  check.mjs  test.mjs  pack.mjs  bench.mjs  all.mjs
  gen/                    生成器
  lib/                    PNG・紋章・バニラ読み込み・ファイル入出力
  test/                   代役の @minecraft/server とテスト一式

many_tnt_addon.mcaddon    BP/ と RP/ から作られる配布ファイル
```

### 単一の情報源

TNT1種類の情報は `data/tnt/<カテゴリ>.mjs` の1件にまとまっています。
名前・説明・威力・効果・色・紋章・レシピ・導火線をそこに書けば、あとは生成されます。

```
data/tnt/*.mjs
      │
      └─ node tools/build.mjs
            BP/blocks/<id>.json              ブロック定義
            BP/recipes/<id>.json             レシピ
            BP/loot_tables/blocks/<id>.json  ドロップ
            BP/items/*.json                  道具
            BP/texts/*.lang, RP/texts/*.lang 表示名
            BP/entities/primed_tnt.json      起爆中のTNT (導火線の長さも)
            BP/scripts/data/*.js             スクリプトが読む表
            BP/scripts/effects/index.js      効果の名前→実体
            RP/blocks.json                   ブロックの音
            RP/textures/*.json               テクスチャの登録
            RP/textures/blocks/*.png         ブロックのテクスチャ
            RP/textures/entity/tnt/*.png     起爆中のテクスチャ
            RP/entity/ models/ render_controllers/
```

手で書くのは `data/`、効果の中身 (`BP/scripts/effects/`)、
紋章の絵柄 (`tools/lib/emblems.mjs`) だけ。
生成し忘れも書き間違いも `node tools/check.mjs` が見つけます。

## 開発

```sh
node tools/all.mjs      # 生成 → 検査 → テスト → .mcaddon まで通す

node tools/build.mjs    # 生成だけ (--skip-textures でテクスチャを飛ばせる)
node tools/check.mjs    # 検査だけ
node --import ./tools/test/mock/loader.mjs tools/test.mjs    # テストだけ
node --import ./tools/test/mock/loader.mjs tools/bench.mjs   # 掘削の規模を測る
node tools/pack.mjs     # .mcaddon だけ
```

Node.js 22 以降が必要です。
**`.mcaddon` を直接編集せず、必ず `node tools/pack.mjs` で作り直してください。**

### 確かめていること

ゲームを起動せずに、次の4段構えで確かめています。

1. **定義の検査** (`data/schema.mjs`)
   書式・色の形式・威力の範囲・材料の実在・IDの重複などを弾きます。
2. **APIの実在検査** (`tools/check-api.mjs`)
   Mojang が公開している API の一覧
   ([bedrock-samples](https://github.com/Mojang/bedrock-samples) の
   `metadata/script_modules`) と突き合わせて、
   **存在しないメソッド・イベント・プロパティを使っていないか**を調べます。
   統合版のスクリプトは存在しないものを呼んでも例外になるだけなので、
   try で包んであると「静かに何も起きない」という一番たちの悪い壊れ方をします。
   実際にこの検査で「天候を変えるのは `World` ではなく `Dimension` のほう」
   という誤りが見つかっています。一覧が手元に無ければこの検査だけ飛ばします。
3. **効果音とパーティクルの実在検査** (`tools/check-assets.mjs`)
   バニラのリソースパックの定義と突き合わせます。名前を1文字間違えても
   Minecraft は黙って何も鳴らさない・何も出さないので、目で見て気づくのは困難です。
   この検査で「導火線の軌跡・毒の霧・水泡のパーティクルが3種類とも存在しない名前で、
   一度も表示されていなかった」ことが分かりました。
4. **回帰テスト** (`tools/test/`)
   `@minecraft/server` を代役に差し替えて、着火から爆発、地形の書き換えまでを
   実際に流します。72種類の効果すべてを一度は動かし、
   「例外を握り潰していないか」「爆発したのに何も起きていないか」まで見ます。

### TNTを追加するには

1. `data/tnt/<カテゴリ>.mjs` に1件足す
2. 効果が新しいなら `BP/scripts/effects/<カテゴリ>.js` に `～Effect` 関数を書く
3. 紋章が新しいなら `tools/lib/emblems.mjs` に 10行×14列で描く
4. `node tools/all.mjs`

### 地形を作る道具

建築カテゴリのTNTは `BP/scripts/lib/terrain.js` の形づくりを組み合わせただけです。
新しい建築TNTを足したいときは、この道具を呼ぶ効果を1つ書けば済みます。

| 関数 | 作るもの |
| --- | --- |
| `carveSphere` | 球状にくり抜く（核系のクレーター） |
| `carveShaft` / `carveBox` | 縦穴 / 角のそろった直方体 |
| `carveTunnels` | 四方へ伸びるトンネル |
| `flattenArea` | 指定の高さで平らにする（上を削り、下を埋める） |
| `buildWall` / `buildShelter` | 狭間つきの壁 / 中が空洞の小屋 |
| `buildBridges` / `raiseScaffold` | 四方への橋 / 登れる柱 |
| `spiralStairs` | 螺旋階段（上へ建てる・下へ掘るの両方） |
| `fillBasin` | 椀形の窪みを掘って液体で満たす |
| `crumbleTerrain` | 支えを抜いて崩落させる |
| `scanDisk` / `scanSphere` | 範囲を1マスずつ見て回る（判定は呼ぶ側が書く） |

### 重い処理の捌き方

地形をくり抜く処理は、まともに書くと数百万ブロックに触ることになります。
1tickで全部やればゲームが固まり、TNTごとに勝手なタイマーを回せば
同時に何発も爆発したときに負荷が足し算で膨れ上がります。

そこで**重い処理はすべてジェネレータとして `core/jobs.js` に出す**形にしています。

- 実行はエンジン任せ (`system.runJob`)。端末の性能に応じて自動で分割される
- 同時に走るジョブ数に上限がある。10発同時に爆発しても負荷は増えない
- 待ちが溢れたら優先度の低いものから捨てる

さらに、縦に連続した範囲は `fillBlocks` に1回で渡しています。

| | 半径 | 直径 | 破壊ブロック | API呼び出し |
| --- | --- | --- | --- | --- |
| 核TNT | 24 | 48 | 約 56,000 | 1,563 |
| 超核TNT | 36 | 72 | 約 188,000 | 3,518 |
| 水素爆弾 | 50 | 100 | 約 502,000 | 6,809 |
| ツァーリボンバ | 66 | 132 | 約 1,149,000 | 11,837 |
| 反物質爆弾 | 80 | 160 | 約 2,039,000 | 17,338 |

1マスずつ書き換えていた頃に比べて、呼び出し回数は 36〜118 分の1です
(`node --import ./tools/test/mock/loader.mjs tools/bench.mjs` で測れます)。

### 核系TNTの破壊範囲

`createExplosion` では範囲を広げられません (Minecraft の仕様で、威力を上げても
地面の耐爆性で光線が止まってしまう) 。そのため核系は、爆心地を中心とした球を
直接くり抜くことで規模を出しています。上にも下にも同じだけ広がります。
終焉TNTは半径56、特異点TNTは半径26です。読み込まれていないチャンクは掘られません。

### 起爆中のTNTの見た目について

火を点けたあと飛んでいるTNTは、バニラの `minecraft:tnt` ではなく
自前の `manytnt:primed_tnt` を使っています。バニラのTNTエンティティは
見た目がエンジン側で固定されていて、どのTNTに火を点けても
普通のTNTに見えてしまうためです。

バニラのTNTエンティティの中身は `minecraft:explode` / `physics` /
`collision_box` / `pushable` という普通のコンポーネントだけなので、
同じ構成で作れば挙動はそのままに見た目だけ差し替えられます。
重力・爆風で吹き飛ぶ・ピストンで押される、といった仕様はバニラと同じで、
連鎖着火で導火線が短くなる仕様も同じ `component_group` で再現しています。

導火線の長さは種類ごとに違います (ミニは2.5秒、反物質は8秒)。
使われている長さぶんの `component_group` が自動で作られ、
着火時にイベントで切り替えます。核系と災厄系は燃えている間に警報が鳴り、
残り1秒で画面が揺れます。

### テクスチャの作り

**バニラのTNTのテクスチャそのものを土台にしています。**
`tools/gen/textures.mjs` がバニラの `tnt_side.png` / `tnt_top.png` /
`tnt_bottom.png` を読み込み、使われている13色を「役割」に分けて、
そのTNTの色に差し替えます。側面の "TNT" の文字は紋章に置き換えます。
紋章は120種類を見分けられるよう帯 (5〜10行) を越えて本体の上まで使い、
はみ出した部分には自動で1ドットの縁取りが付きます。

縞の周期・帯のムラ・上面の煤の散り方といった細部は実物そのままなので、
バニラのTNTと並べても違和感が出ません
(上面と底面は実物と1ドットも違わない並びになり、側面も紋章部分を除いて一致します)。

種類ごとに変えるのは**地の色ひとつと紋章 (10行×14列) だけ**。
残りの12色は地の色から自動で作られます。

> 土台にするテクスチャは Mojang の配布物
> ([Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)) で、
> `(c) Mojang AB. All rights reserved.` / Minecraft EULA の対象です。
> **このリポジトリには含めていない**ので、テクスチャを生成し直すときは
> 手元に clone しておいてください。
>
> ```sh
> git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples
> ```
>
> 別の場所に置いてある場合は `VANILLA_RP=/path/to/resource_pack/textures/blocks`
> で指定できます (APIの一覧は `VANILLA_METADATA`)。
> 生成済みのテクスチャは `RP/textures/blocks/` にコミット済みなので、
> 色や紋章を変えないのであれば clone は不要です。
