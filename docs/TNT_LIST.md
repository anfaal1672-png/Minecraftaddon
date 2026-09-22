# TNT一覧

> このファイルは `tools/generate.mjs` が `tools/defs/tnt.json` から生成します。直接編集しないでください。

全 77 種類。レシピはすべて作業台での「形不問」です。🆕 は v31 で追加された種類、☢ は核系 (設定で禁止できます) です。

## 爆破 (Blast)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| メガTNT<br>Mega TNT | 14 | TNT4個分の大爆発を起こす。 | TNT + TNT + TNT + TNT |
| ミニTNT<br>Mini TNT | 2 | 小さな爆発。細かい採掘や演出に。 | TNT + 糸 |
| 分裂TNT 🆕<br>Cluster TNT | 3 | 爆発すると小さなTNT6個に分裂して飛び散る。 | ミニTNT + ミニTNT + ミニTNT + 火薬 |
| 地雷TNT 🆕<br>Landmine TNT | 4 | 上に乗ると起爆する。設置した本人としゃがんでいるプレイヤーは起爆しない。 | TNT + 石の感圧板 |
| 時限TNT 🆕<br>Time Bomb TNT | 8 | 着火から30秒後に爆発する。残り時間が近くのプレイヤーに表示される。 | TNT + 時計 + レッドストーンダスト |
| 誘導TNT 🆕<br>Homing TNT | 4 | 導火線が燃えている間、一番近い敵対モブへ飛んでいく。 | TNT + コンパス |

## 核・超兵器 (Nuclear)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 核TNT ☢<br>Nuke TNT | 20 | きのこ雲・放射能・クレーターを残す核爆発。 | メガTNT + グロウストーン |
| 超核TNT ☢<br>Ultra Nuke TNT | 35 | 核TNTを超える規模の核爆発。 | 核TNT + ブレイズパウダー + ブレイズパウダー |
| 水素爆弾 ☢<br>Hydrogen Bomb | 50 | 大地を消し飛ばす水素爆弾。 | 超核TNT + ダイヤモンド + ダイヤモンド |
| ツァーリボンバ ☢<br>Tsar Bomba | 65 | 史上最大の核爆弾を再現した超巨大爆発。 | 水素爆弾 + ネザライトインゴット |
| 反物質爆弾 ☢<br>Antimatter Bomb | 80 | 対消滅による、このアドオン最大の破壊。 | ツァーリボンバ + ネザライトインゴット + ネザースター + アメジストの欠片 |
| 終焉TNT ☢<br>Armageddon TNT | 40 | 核爆発に加えて、ランダムな効果が4〜5個連続で発動する。 | ツァーリボンバ + 水素爆弾 + 超核TNT + 核TNT + ネザースター |

## 属性 (Elemental)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 氷結TNT<br>Ice TNT | - | 周囲の水を凍らせ、雪を積もらせ、敵を鈍足にする。 | TNT + 雪玉 + 雪玉 |
| 毒TNT<br>Poison TNT | 3 | 周囲に5秒間、毒の霧を広げる。 | TNT + クモの目 |
| 火炎TNT<br>Fire TNT | 6 | 爆発と同時に周囲を炎上させる。 | TNT + ブレイズパウダー |
| 雷TNT<br>Thunder TNT | 4 | 周囲に雷を6回落とす。 | TNT + 避雷針 |
| 溶岩TNT<br>Lava TNT | 8 | 爆心地に溶岩を撒き散らす。 | TNT + マグマブロック |
| 水TNT<br>Water TNT | - | 水を撒いて火を消し、周囲を押し流す。 | TNT + プリズマリンの欠片 |
| 暗闇TNT<br>Darkness TNT | 2 | 周囲を盲目と吐き気にする。 | TNT + イカスミ |
| 混乱TNT<br>Confusion TNT | 2 | 強い吐き気と鈍足で周囲を混乱させる。 | TNT + 発酵したクモの目 |
| 隕石雨TNT<br>Meteor TNT | 4 | 空から隕石が6発降り注ぐ。 | TNT + ファイヤーチャージ |
| 呪いTNT<br>Curse TNT | 2 | 弱体化・鈍足・空腹・暗闇の呪いをかける。 | TNT + ソウルサンド + ソウルサンド |
| 津波TNT<br>Tsunami TNT | 2 | 一時的な大波で周囲を押し流す。 | TNT + 海洋の心 |
| 嵐TNT<br>Storm TNT | 3 | 天候を雷雨にし、雷を落とす。 | TNT + トライデント |
| 氷河期TNT<br>Ice Age TNT | - | 広範囲を凍らせ、雪で覆う氷河期。 | TNT + 青氷 + 青氷 |
| 焦土TNT<br>Scorched TNT | 4 | 周囲の草地を焦げた土とネザーラックに変える。 | TNT + ネザーラック + ブレイズパウダー |

## 物理・移動 (Physics)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 重力TNT<br>Gravity TNT | 3 | 導火線が燃えている間、周囲を吸い込み、最後に吹き飛ばす。 | TNT + 黒曜石 + 黒曜石 |
| テレポートTNT<br>Teleport TNT | 4 | 周囲の生き物を安全な場所へランダムにテレポートさせる。 | TNT + エンダーパール |
| 磁力TNT<br>Magnet TNT | 2 | 導火線が燃えている間、アイテムと経験値を吸い寄せる。 | TNT + 鉄インゴット + 鉄インゴット |
| 反重力TNT<br>Anti-Gravity TNT | 3 | 周囲を空中へ打ち上げ、浮遊させる。 | TNT + ファントムの皮膜 |
| 地震TNT<br>Earthquake TNT | 6 | 地面を崩し、周囲を揺さぶる。 | TNT + 丸石 + 丸石 + 丸石 + 丸石 |
| バウンドTNT<br>Bouncy TNT | - | 周囲を跳ね上げ、ジャンプ力を上げる。 | TNT + スライムボール |
| 入れ替えTNT<br>Swap TNT | 3 | 一番近い2体の位置を入れ替える。 | TNT + エンダーアイ |
| ブラックホールTNT<br>Black Hole TNT | - | 数秒間すべてを吸い込み、中心を消し去ってから弾ける。 | TNT + 泣く黒曜石 + 泣く黒曜石 |
| アロー乱射TNT<br>Arrow Barrage TNT | 3 | 全方向に矢を16本放つ。 | TNT + 矢 + 矢 |
| ロケットTNT<br>Rocket TNT | 6 | 着火すると空高く打ち上がってから爆発する。 | TNT + ロケット花火 + 羽根 |
| エンダーマンTNT<br>Enderman TNT | 2 | プレイヤーを近くへワープさせ、エンダーマンを呼ぶ。 | TNT + エンダーパール + エンダーパール |
| 縦穴TNT<br>Shaft TNT | - | 真下へ最大40ブロックの縦穴を掘る。 | TNT + 鉄のツルハシ |
| ビームTNT<br>Beam TNT | 3 | 四方向に破壊光線を放つ。 | TNT + ネザースター |
| 真空TNT<br>Vacuum TNT | - | 周囲の水と溶岩を吸い取る。 | TNT + スポンジ + スポンジ |
| エンドTNT<br>Chorus TNT | 2 | 周囲をランダムにワープさせ、コーラスフルーツを落とす。 | TNT + コーラスフルーツ + 焼いたコーラスフルーツ |
| 時間停止TNT 🆕<br>Time Stop TNT | - | 周囲のモブを8秒間完全に停止させる。 | TNT + 時計 + 氷塊 |

## 生き物 (Creatures)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 召喚TNT<br>Summon TNT | 3 | ゾンビ・スケルトン・クモを召喚する。 | TNT + 腐った肉 + 骨 |
| UFO襲来TNT<br>UFO TNT | 2 | 光の柱で周囲を空へ持ち上げる。 | TNT + エメラルド |
| 雪だるまTNT<br>Snow Golem TNT | - | スノーゴーレムを呼び、雪を積もらせる。 | TNT + くり抜かれたカボチャ + 雪玉 |
| ハチTNT<br>Bee TNT | 2 | ハチの群れを放つ。 | TNT + ハニカム + ポピー |
| スライムTNT<br>Slime TNT | - | スライムを呼び、周囲を跳ね上げる。 | TNT + スライムボール + スライムボール |
| 動物TNT<br>Animal TNT | - | ニワトリ・ウシ・ブタ・ヒツジを呼ぶ。 | TNT + 小麦 + リンゴ |

## 地形・資源 (World & Resources)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 蜘蛛の巣TNT<br>Web TNT | 2 | 周囲にクモの巣を張る。 | TNT + 糸 + 糸 + 糸 |
| お宝TNT<br>Treasure TNT | 3 | 鉱物の欠片や金属を撒き散らす。まれに宝石も出る。 | TNT + 金インゴット |
| 草原TNT<br>Grass TNT | - | 周囲に草花を咲かせる。 | TNT + 小麦の種 + 骨粉 |
| 砂漠TNT<br>Desert TNT | 2 | 周囲の草地を砂漠に変え、サボテンを生やす。 | TNT + 砂 + 砂 |
| 製錬TNT<br>Smelter TNT | - | 周囲の鉱石を製錬済みのインゴットにする。 | TNT + かまど |
| 豊作TNT<br>Harvest TNT | - | 周囲の作物を一瞬で成長させる。 | TNT + 骨粉 + 骨粉 |
| 経験値TNT<br>XP TNT | - | 経験値オーブを噴き出す。 | TNT + エンチャントの瓶 + エンチャントの瓶 |
| 運試しTNT<br>Fortune TNT | 2 | 大当たりなら宝石、はずれなら呪い。 | TNT + ウサギの足 |
| 建材TNT<br>Builder TNT | - | 足元の建材を上位の建材に変える。 | TNT + レンガ + レンガ |
| ハチミツTNT<br>Honey TNT | - | 周囲をハチミツブロックで埋める。 | TNT + ハチミツ入りの瓶 + ハチミツ入りの瓶 |
| 満腹TNT<br>Feast TNT | - | 満腹度を回復し、食べ物を撒く。 | TNT + パン + ステーキ |
| サボテンTNT<br>Cactus TNT | 1 | 砂の上にサボテンを生やす。 | TNT + サボテン + サボテン |
| 黒曜石TNT<br>Obsidian TNT | - | 周囲の溶岩を黒曜石に変える。 | TNT + 溶岩入りバケツ + 水入りバケツ |
| 発光TNT<br>Glow TNT | - | 周囲にグロウストーンを設置する。 | TNT + グロウストーン + 輝くイカスミ |
| 採掘TNT 🆕<br>Mining TNT | - | 周囲の鉱石だけを掘り出してドロップさせる。 | TNT + 金のツルハシ |
| 防壁TNT 🆕<br>Wall TNT | - | 周囲に石レンガの円形の壁を建てる。 | TNT + 石レンガ + 石レンガ |
| 植林TNT 🆕<br>Forest TNT | - | 周囲の草地に苗木を植える。 | TNT + オークの苗木 + オークの苗木 |
| 橋TNT 🆕<br>Bridge TNT | - | 着火した人が向いている方向に、長さ24の橋を架ける。 | TNT + オークの板材 + オークの板材 + オークの板材 |
| 収穫祭TNT 🆕<br>Reaper TNT | - | 周囲の実った作物を収穫して、種を植え直す。 | TNT + 鉄のクワ |

## お楽しみ (Fun)

| TNT | 威力 | 効果 | レシピ |
|---|---|---|---|
| 回復TNT<br>Heal TNT | - | 周囲を回復し、衝撃吸収を与える。 | TNT + きらめくスイカの薄切り |
| 紙吹雪TNT<br>Confetti TNT | - | 紙吹雪と共にスピードとジャンプ力を与える。 | TNT + 紙 + 紙 + 紙 |
| 虹TNT<br>Rainbow TNT | 6 | いろいろなTNTの効果からランダムに1つ発動する。 | TNT + アメジストの欠片 |
| ディスコTNT<br>Disco TNT | - | 床を一時的にカラフルに光らせる。 | TNT + レッドストーンランプ |
| 花火大乱舞TNT<br>Fireworks TNT | - | 花火を14発打ち上げる。 | TNT + ロケット花火 |
| 音楽TNT<br>Music TNT | - | 短いメロディーを奏でる。 | TNT + 音符ブロック |
| 時間TNT<br>Day-Night TNT | 2 | 昼と夜を切り替える。 | TNT + 時計 |
| 透明TNT<br>Invisibility TNT | - | 周囲を透明にする。 | TNT + ガラス + 発酵したクモの目 |
| スピードTNT<br>Speed TNT | - | 周囲に強力なスピード効果を与える。 | TNT + 砂糖 + 砂糖 |
| ガチャTNT<br>Gacha TNT | 2 | 着火した瞬間、ランダムな別のTNTに変わる。 | TNT + エメラルド + ウサギの足 |

## アイテム

| アイテム | レシピ |
|---|---|
| リモート起爆装置<br>Remote Detonator | レッドストーンダスト + レッドストーンダスト + 鉄インゴット + レッドストーントーチ |
| TNT図鑑<br>TNT Guide | 本 + 火薬 |
