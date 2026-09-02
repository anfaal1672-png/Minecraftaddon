/**
 * TNTの帯に描く紋章。すべて 4行 × 12列。
 *   "."  帯の地の色 (描かない)
 *   "X"  主色 (ink)
 *   "o"  明色 (inkLight)
 *   "#"  暗色 (inkDark)
 *
 * バニラのTNTと同じく帯は 4ドットしかないので、塗りつぶすと
 * ただの塊にしか見えなくなる。輪郭と余白で形を出すこと。
 */
export const EMBLEMS = {
  // ── 基本 ──────────────────────────────────────────────
  tnt: [
    "XXX.X..X.XXX",
    ".X..XX.X..X.",
    ".X..X.XX..X.",
    ".X..X..X..X.",
  ],
  dynamite: [
    ".......ooX..",
    "....XXXX....",
    "....XooX....",
    "....XXXX....",
  ],

  // ── 核・破滅系 ────────────────────────────────────────
  radiation: [
    "....XXXX....",
    "..X..XX..X..",
    ".XXX.XX.XXX.",
    "XXXX....XXXX",
  ],
  mushroom: [
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
    "....XXXX....",
    "...XXXXXX...",
  ],
  mushroom_ring: [
    "o.XXXXXXXX.o",
    "o.XXXXXXXX.o",
    "o...XXXX...o",
    "...XXXXXX...",
  ],
  bomb: [
    ".........oX.",
    "..XXXX..oX..",
    ".XXXXXX.X...",
    "..XXXX......",
  ],
  atom: [
    ".XXXXXXXXXX.",
    "X....XX....X",
    "X....XX....X",
    ".XXXXXXXXXX.",
  ],
  skull: [
    "..XXXXXXXX..",
    "..X..XX..X..",
    "..XXXXXXXX..",
    "...X.XX.X...",
  ],
  bigskull: [
    ".XXXXXXXXXX.",
    ".X.oo..oo.X.",
    ".XXXXXXXXXX.",
    "..X.X..X.X..",
  ],

  // ── 温度・天候 ────────────────────────────────────────
  flame: [
    ".....XX.....",
    "....XXXX....",
    "...XXooXX...",
    "...XXXXXX...",
  ],
  lava: [
    "...o....o...",
    "..XXX..XXX..",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
  ],
  snowflake: [
    "..X..XX..X..",
    "XXX.XXXX.XXX",
    "XXX.XXXX.XXX",
    "..X..XX..X..",
  ],
  glacier: [
    "...XX.......",
    "..XXXX..XX..",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
  ],
  droplet: [
    ".....XX.....",
    "....XXXX....",
    "...XXooXX...",
    "....XXXX....",
  ],
  wave: [
    "......XXX...",
    "....XXXXXX..",
    "..XX....XXX.",
    "XXXXXXXXXXXX",
  ],
  bolt: [
    "......XXX...",
    "....XXXX....",
    "...XXXXX....",
    "..XXX.......",
  ],
  cloud: [
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "..o..o..o...",
  ],
  sun: [
    "..X.XXXX.X..",
    "...XXXXXX...",
    "X..XXXXXX..X",
    "..X.XXXX.X..",
  ],
  moon: [
    "..XXXX....o.",
    ".XXXX.......",
    ".XXXX....o..",
    "..XXXX......",
  ],
  daynight: [
    ".XXXXX..oooo",
    "XXXXXXX.oo..",
    "XXXXXXX.oo..",
    ".XXXXX..oooo",
  ],

  // ── 力・移動 ──────────────────────────────────────────
  arrow_down: [
    ".....XX.....",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
  ],
  arrow_up: [
    "....XXXX....",
    "...XXXXXX...",
    "..XXXXXXXX..",
    ".....XX.....",
  ],
  rocket: [
    ".....XX.....",
    "....XooX....",
    "..XXXXXXXX..",
    "...o.oo.o...",
  ],
  speed: [
    "..XX...XX...",
    ".XXX..XXX...",
    ".XXX..XXX...",
    "..XX...XX...",
  ],
  bounce: [
    "....XXXX....",
    "...XXXXXX...",
    "....XXXX....",
    "oooooooooooo",
  ],
  slime_face: [
    ".XXXXXXXXXX.",
    ".XX..XX..XX.",
    ".XXXXXXXXXX.",
    ".XX.XXXX.XX.",
  ],
  magnet: [
    ".XXXXXXXXXX.",
    "XXXX....XXXX",
    "XXX......XXX",
    "ooo......ooo",
  ],
  question: [
    ".XXX....XXX.",
    "...X......X.",
    "..XX.....XX.",
    "..X.......X.",
  ],
  void: [
    "...oooooo...",
    "..oo....oo..",
    "..oo....oo..",
    "...oooooo...",
  ],
  suction: [
    "XX........XX",
    ".XXX....XXX.",
    ".XXX....XXX.",
    "XX........XX",
  ],
  portal: [
    "..XXXXXXXX..",
    ".XXoo..ooXX.",
    ".XXoo..ooXX.",
    "..XXXXXXXX..",
  ],
  island: [
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
  ],
  swap: [
    "..X.........",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    ".........X..",
  ],
  beam: [
    "XXXXXXXXXXXX",
    "..XXXXXXXX..",
    "..XXXXXXXX..",
    "XXXXXXXXXXXX",
  ],

  // ── 生き物 ────────────────────────────────────────────
  heart: [
    "...XX..XX...",
    "..XXXXXXXX..",
    "...XXXXXX...",
    ".....XX.....",
  ],
  creeper: [
    "..XXXXXXXX..",
    "..X..XX..X..",
    "..XXX..XXX..",
    "..XX.XX.XX..",
  ],
  bee: [
    ".oo......oo.",
    "...XXXXXX...",
    "...X.XX.X...",
    "...XXXXXX...",
  ],
  drip: [
    "XXXXXXXXXXXX",
    ".X...XX...X.",
    "..X..XX..X..",
    "..o...o..o..",
  ],
  paw: [
    ".XX..XX..XX.",
    "............",
    "...XXXXXX...",
    "..XXXXXXXX..",
  ],
  snowman: [
    "....XXXX....",
    "...X#XX#X...",
    "..XXXXXXXX..",
    ".XX.XXXX.XX.",
  ],
  ghost: [
    "..XXXXXXXX..",
    "..X.XX.X.X..",
    "..X......X..",
    "..X.X.X.XX..",
  ],
  ufo: [
    "....XXXX....",
    ".XXXXXXXXXX.",
    "XXoXoXoXoXXX",
    "..o..o..o...",
  ],
  web: [
    "X..XXXXXX..X",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "X..XXXXXX..X",
  ],
  flask: [
    ".....XX.....",
    "....XXXX....",
    "..XXooooXX..",
    "...XXXXXX...",
  ],
  eye: [
    "..XXXXXXXX..",
    ".XXoo##ooXX.",
    ".XXoo##ooXX.",
    "..XXXXXXXX..",
  ],

  // ── 自然・地形 ────────────────────────────────────────
  grass: [
    "..X...X...X.",
    ".XXX.XXX.XXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
  ],
  cactus: [
    "XX...XX...XX",
    "XX...XX...XX",
    "XXXXXXXXXXXX",
    ".....XX.....",
  ],
  dune: [
    "...XXX......",
    "..XXXXX..XXX",
    ".XXXXXXXXXXX",
    "XXXXXXXXXXXX",
  ],
  crack: [
    "....X..XX...",
    "...XX...X...",
    "..XX....XX..",
    "..X......X..",
  ],
  meteor: [
    "o...........",
    ".oo...XXXX..",
    "..oooXXXXXX.",
    "....XXXXXX..",
  ],
  hole: [
    "..XXXXXXXX..",
    ".X########X.",
    ".X########X.",
    "..XXXXXXXX..",
  ],
  crystal: [
    ".....XX.....",
    "...XXooXX...",
    "..XXXooXXX..",
    "...XXXXXX...",
  ],

  // ── 道具・その他 ──────────────────────────────────────
  gem: [
    "...XXXXXX...",
    "..XXoooXXX..",
    "...XXoXXX...",
    "....XXXX....",
  ],
  clover: [
    "..XX..XX....",
    ".XXXXXXXX.o.",
    "..XXXXXX.o..",
    "....XX..o...",
  ],
  star: [
    ".....XX.....",
    "XXXXXXXXXXXX",
    "..XXXXXXXX..",
    ".XXX....XXX.",
  ],
  firework: [
    "..o..X..o...",
    "X..X.X.X..X.",
    "..XXXXXXX...",
    "....XXX.....",
  ],
  confetti: [
    ".X...o....X.",
    "...o...XX...",
    "X...oo...o..",
    "..oX...X..XX",
  ],
  note: [
    "....X....X..",
    "....X....X..",
    "..XXX..XXX..",
    "..XXX..XXX..",
  ],
  disco: [
    "..XXXXXXXX..",
    ".XoXoXoXoXX.",
    ".XoXoXoXoXX.",
    "..XXXXXXXX..",
  ],
  brick: [
    "XXXXX.XXXXXX",
    "XXXXX.XXXXXX",
    "XX.XXXXXX.XX",
    "XX.XXXXXX.XX",
  ],
  furnace: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X..oooooo..X",
    "XXXXXXXXXXXX",
  ],
  wheat: [
    "..X..XX..X..",
    ".XXX.XX.XXX.",
    "..X.XXXX.X..",
    ".XXX.XX.XXX.",
  ],
  cutlery: [
    ".X.X.X..XX..",
    ".XXXXX..XX..",
    "..XXX...XX..",
    "..XXX...XX..",
  ],
  orb: [
    "o..XXXXXX..o",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "o..XXXXXX..o",
  ],
  arrows: [
    "........X...",
    "XXXXXXXXXXX.",
    "XXXXXXXXXXX.",
    "........X...",
  ],
};

/** 全紋章が 4行 × 12列であることを確認する */
export function assertEmblems() {
  const bad = [];
  for (const [name, rows] of Object.entries(EMBLEMS)) {
    if (rows.length !== 4) bad.push(`${name}: ${rows.length}行 (4行であるべき)`);
    rows.forEach((r, i) => {
      if (r.length !== 12) bad.push(`${name} の ${i}行目: ${r.length}文字 (12文字であるべき)`);
      if (/[^.Xo#]/.test(r)) bad.push(`${name} の ${i}行目に未知の文字: ${r}`);
    });
  }
  return bad;
}
