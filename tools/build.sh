#!/usr/bin/env bash
# BP/ と RP/ から many_tnt_addon.mcaddon を作り直す。
# 検査とテストを通ったときだけ書き出す。
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="many_tnt_addon.mcaddon"

echo "▶ パックの整合性チェック"
node tools/validate.mjs

echo "▶ 回帰テスト"
node --import ./tools/register-mock.mjs tools/test.mjs

echo "▶ $OUT を作成"
rm -f "$OUT"
# .mcaddon は BP/ と RP/ をそのまま入れた zip
zip -r -q -X "$OUT" BP RP -x '*.DS_Store'
echo "✅ $OUT ($(du -h "$OUT" | cut -f1))"
