// 2x4材で作る木の屋根 設計ツール — 計算ロジック
// 座標系: x = 間口(幅)方向, y = 高さ, z = 奥行き方向（z=0 が前面）。単位は m。
// 高さはすべて「基礎の上（柱の足元）」からの高さ。
//
// 部材は中心線（a→b）と断面（t × d）、t の向き（wdir）で持つ。
//   t … 薄い方の寸法（2x材なら38mm）。wdir の向きに測る
//   d … もう一方の寸法（2x4なら89mm）。長さ方向と wdir の両方に直角な向き

// 木材の定尺（フィート → m）。ホームセンターの表記に合わせる
export const FT = { 6: 1.82, 8: 2.438, 10: 3.048, 12: 3.658, 14: 4.267, 16: 4.877 };
export const SIZES = {
  '2x4': { t: 0.038, d: 0.089, ft: [6, 8, 10, 12, 14, 16] },
  '2x6': { t: 0.038, d: 0.140, ft: [6, 8, 10, 12, 14, 16] },
  '2x8': { t: 0.038, d: 0.184, ft: [6, 8, 10, 12, 14, 16] },
  '2x10': { t: 0.038, d: 0.235, ft: [6, 8, 10, 12, 14, 16] },
  '4x4': { t: 0.089, d: 0.089, ft: [6, 8, 10, 12] },
};
export const SIZE_ORDER = ['4x4', '2x10', '2x8', '2x6', '2x4'];
export const lumberKey = (size, ft) => 'l' + size.replace('x', '') + '_' + ft; // 例: l24_8
export const SHEETS = [
  { shaku: 6, len: 1.82 }, { shaku: 7, len: 2.12 }, { shaku: 8, len: 2.42 },
  { shaku: 9, len: 2.73 }, { shaku: 10, len: 3.03 }, { shaku: 12, len: 3.64 },
];
export const sheetKey = (shaku) => 'sp' + shaku;
export const FACE_KEYS = ['F', 'B', 'L', 'R'];

// 木材の単価の目安（円・税込、SPF無処理、2026年ごろのホームセンター）
const LUMBER_PRICE = {
  '2x4': [600, 850, 1150, 1450, 1800, 2200],
  '2x6': [1000, 1400, 1800, 2300, 2900, 3500],
  '2x8': [1500, 2000, 2600, 3200, 4000, 4800],
  '2x10': [2200, 2900, 3700, 4500, 5500, 6500],
  '4x4': [2000, 2700, 3500, 4300],
};
const lumberDefaults = Object.fromEntries(Object.entries(SIZES).flatMap(([s, v]) => v.ft.map((f, i) => [lumberKey(s, f), LUMBER_PRICE[s][i]])));

export const DEFAULTS = {
  W: 3.0, D: 2.5, roofType: 'mono', H1: 2.6, H2: 2.3, Hr: 3.1,
  nx: 3, ny: 2, rs: 0.6,
  rafterSize: '2x6', beamSize: '2x8', beamPly: 2,
  oe: 0.3, os: 0.15, ps: 0.6, roofing: true,
  // 補強（面ごと）：none=なし / knee=方杖 / brace=筋交い（片） / x=たすき
  bF: 'knee', bB: 'brace', bL: 'brace', bR: 'brace',
  bFlo: 0.15, bBlo: 0.15, bLlo: 0.15, bRlo: 0.15, // 筋交いの下端の高さ
  bFhi: 0, bBhi: 0, bLhi: 0, bRhi: 0,             // 筋交いの上端の高さ（0 = 桁・垂木の下まで）
  kneeL: 0.6,                                      // 方杖の長さ（柱・桁に沿った寸法）
  tF: 0, tB: 0, tL: 0, tR: 0,                      // 胴つなぎの高さ（0 = なし）
  // 壁（面ごと）：none=なし / full=上まで / koshi=腰壁
  wF: 'none', wB: 'none', wL: 'none', wR: 'none',
  wMat: 'ply', wH: 1.0, studPitch: 0.455, railPitch: 0.5,
  base: 'slab', embed: 0.45, holeD: 0.3, // 基礎：slab=土間 / pincoro=束石 / footing=穴を掘ってコンクリート / spike=打ち込み
  anchorsPerBase: 2, margin: 0.02,
  treated: false, paint: true, coats: 2,
  // 単価（円・税込の目安）
  ...lumberDefaults,
  treatedRate: 1.6,
  sp6: 1500, sp7: 1750, sp8: 2000, sp9: 2250, sp10: 2500, sp12: 3000,
  cSheetScrew: 20, hookPitch: 0.25, sheetWork: 0.58, cRidge: 900,
  cBolt: 300, cTie: 150, cScrewBox: 800, cThinBox: 600,
  cPostBase: 1600, cAnchor: 150, cPincoro: 1500, cCoach: 60, cGravel: 350, cConcrete: 750, cEmbedBase: 1800, cSpike: 2500,
  cPly: 1900, cBoard: 450,
  cPaint35: 8000, cPaint07: 2300,
};

const lin = (a, b, n) => (n < 2 ? [a] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const dist = (a, b) => Math.hypot(...sub(a, b));
const X = [1, 0, 0], UP = [0, 1, 0], Z = [0, 0, 1];

// 部材の向き（3D と図面の両方で使う）。c=中心, u=長さ方向, v=t の方向, w=d の方向
export function memberFrame(m) {
  const u = norm(sub(m.b, m.a));
  let v = sub(m.wdir, mul(u, dot(m.wdir, u)));
  if (Math.hypot(...v) < 1e-6) v = Math.abs(u[1]) < 0.9 ? UP : X;
  v = norm(v);
  const w = cross(u, v);
  return { c: mul(addv(m.a, m.b), 0.5), u, v, w, len: m.len, t: m.t, d: m.d };
}
export function memberCorners(m) {
  const f = memberFrame(m), out = [];
  for (const su of [-1, 1]) for (const sv of [-1, 1]) for (const sw of [-1, 1]) {
    out.push(addv(addv(addv(f.c, mul(f.u, su * f.len / 2)), mul(f.v, sv * f.t / 2)), mul(f.w, sw * f.d / 2)));
  }
  return out;
}

export function sheetPlan(slen) {
  const maxL = SHEETS[SHEETS.length - 1].len;
  const need = slen + 0.05;
  if (need <= maxL) return { sheet: SHEETS.find((s) => s.len >= need), n: 1 };
  let n = 2;
  while ((need + 0.2 * (n - 1)) / n > maxL) n++;
  const each = (need + 0.2 * (n - 1)) / n;
  return { sheet: SHEETS.find((s) => s.len >= each), n };
}

// 木取り：必要な長さの切れ端を、なるべく無駄なく定尺に割り付ける
export function packBoards(pieces, fts) {
  const stocks = fts.map((ft) => ({ ft, len: FT[ft] }));
  const items = [...pieces].sort((a, b) => b.need - a.need);
  const boards = [];
  while (items.length) {
    let best = null;
    for (const st of stocks) {
      if (st.len < items[0].need - 1e-9) continue;
      let rem = st.len; const take = [];
      for (let i = 0; i < items.length; i++) if (items[i].need <= rem + 1e-9) { take.push(i); rem -= items[i].need; }
      const score = (st.len - rem) / st.len;
      if (!best || score > best.score + 1e-6) best = { st, take, score, rem };
    }
    if (!best) { const st = stocks[stocks.length - 1]; best = { st, take: [0], rem: 0 }; } // 念のため
    const cuts = best.take.map((i) => items[i]);
    for (let j = best.take.length - 1; j >= 0; j--) items.splice(best.take[j], 1);
    boards.push({ ft: best.st.ft, len: best.st.len, cuts, rem: Math.max(0, best.rem) });
  }
  return boards;
}

const polyArea = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

export function compute(input) {
  const p = { ...DEFAULTS, ...input };
  const num = (k) => Number(p[k]);
  const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';
  const W = num('W'), D = num('D');
  const nx = Math.max(2, Math.round(num('nx'))), ny = Math.max(2, Math.round(num('ny')));
  const mono = p.roofType === 'mono';
  const H1 = num('H1'), H2 = mono ? num('H2') : num('H1'), Hr = num('Hr');
  const oe = num('oe'), os = num('os'), ps = Math.max(0.2, num('ps')), rs = Math.max(0.2, num('rs'));
  const margin = Math.max(0, num('margin'));
  const rafterSize = ['2x4', '2x6', '2x8'].includes(p.rafterSize) ? p.rafterSize : '2x6';
  const beamSize = ['2x6', '2x8', '2x10'].includes(p.beamSize) ? p.beamSize : '2x8';
  const ridgeSize = { '2x4': '2x6', '2x6': '2x8', '2x8': '2x10' }[rafterSize];
  const ply = num('beamPly') >= 2 ? 2 : 1;
  const T = 0.038, PW = 0.0445; // 2x材の厚さ、4x4の半分
  const rd = SIZES[rafterSize].d, bd = SIZES[beamSize].d;
  const base = ['slab', 'pincoro', 'footing', 'spike'].includes(p.base) ? p.base : 'slab';
  const embed = base === 'footing' ? Math.max(0, num('embed')) : 0;
  const holeD = num('holeD');
  const y0 = base === 'slab' ? 0 : 0.1; // 壁の下端（土間以外は地面から少し上げる）

  const xs = lin(0, W, nx), zs = lin(0, D, ny);
  const nr = Math.max(2, Math.ceil(W / rs - 1e-9) + 1);
  const xr = lin(0, W, nr);

  const members = [];
  const add = (kind, name, size, a, b, wdir, face) => {
    const len = dist(a, b);
    if (len < 0.05) return null;
    const m = { kind, name, size, a, b, wdir, len, t: SIZES[size].t, d: SIZES[size].d, face };
    members.push(m); return m;
  };
  const warnings = [];
  const hw = { bolt: 0, tie: 0, screw: 0, thin: 0, sheetScrew: 0 };

  if (!mono && Hr <= H1 + 0.05) {
    warnings.push({ level: 'error', text: '[[棟]]の高さが、[[軒]]の高さと同じか、それより低くなっています。これでは三角の屋根になりません。「棟の高さ」を「軒の高さ」より大きい数字にしてください。' });
  }

  // 屋根の傾き。yb(z) = 垂木の下面の高さ、nrm(z) = 屋根面に直角な上向き
  const half = D / 2;
  const s = mono ? (H2 - H1) / D : (Hr - H1) / half;
  const yb = (z) => (mono ? H1 + s * z : z <= half ? H1 + s * z : H1 + s * (D - z));
  const nrm = (z) => (mono || z <= half ? norm([0, 1, -s]) : norm([0, 1, s]));
  const onRoof = (x, z, off) => addv([x, yb(z), z], mul(nrm(z), off));
  const slopeRatio = Math.abs(s);

  // 柱（外周）
  const posts = [];
  xs.forEach((x) => { posts.push([x, 0]); posts.push([x, D]); });
  zs.slice(1, -1).forEach((z) => { posts.push([0, z]); posts.push([W, z]); });
  const postTop = (z) => (mono ? yb(z) : H1);
  posts.forEach(([x, z]) => add('post', '柱', '4x4', [x, 0, z], [x, postTop(z), z], X));

  // 桁（前・後）。2枚のときは柱を両側から挟む
  const beamZ = (z0, out) => (ply === 2 ? [z0 - (PW + T / 2), z0 + (PW + T / 2)] : [z0 + out * (PW + T / 2)]);
  beamZ(0, -1).forEach((z) => add('beam', '桁', beamSize, [-PW, H1 - bd / 2, z], [W + PW, H1 - bd / 2, z], Z));
  beamZ(D, 1).forEach((z) => add('beam', '桁', beamSize, [-PW, H2 - bd / 2, z], [W + PW, H2 - bd / 2, z], Z));
  hw.bolt += 2 * 2 * nx; // 前後の柱 × ボルト2本

  const slopes = [];
  let purlinCount = 0;
  if (mono) {
    xr.forEach((x) => add('rafter', '垂木', rafterSize, onRoof(x, -oe, rd / 2), onRoof(x, D + oe, rd / 2), X));
    hw.tie += 2 * nr + 2 * (ny - 2); // 垂木と桁、側面の中間の柱と垂木
    const slen = (D + 2 * oe) * Math.sqrt(1 + s * s);
    const n = Math.max(2, Math.ceil((slen - 0.1) / ps) + 1);
    lin(-oe + 0.045, D + oe - 0.045, n).forEach((z) => add('purlin', '母屋（横桟）', '2x4', onRoof(-os, z, rd + T / 2), onRoof(W + os, z, rd + T / 2), nrm(z)));
    purlinCount = n;
    const o = rd + T;
    slopes.push({ slen, pts: [onRoof(-os, -oe, o), onRoof(W + os, -oe, o), onRoof(W + os, D + oe, o), onRoof(-os, D + oe, o)] });
  } else {
    const k = Math.sqrt(1 + s * s);
    const ridgeD = SIZES[ridgeSize].d;
    const ridgeY = Hr + rd * k - ridgeD / 2; // 棟木の上端を垂木の上端にそろえる
    xr.forEach((x) => {
      add('rafter', '垂木', rafterSize, onRoof(x, -oe, rd / 2), onRoof(x, half - T / 2, rd / 2), X);
      add('rafter', '垂木', rafterSize, onRoof(x, D + oe, rd / 2), onRoof(x, half + T / 2, rd / 2), X);
    });
    add('ridge', '棟木', ridgeSize, [-T / 2, ridgeY, half], [W + T / 2, ridgeY, half], Z);
    xs.forEach((x) => {
      const xo = x + (x < W / 2 - 1e-9 ? 1 : -1) * T; // 垂木の横に添える
      add('tiebeam', '陸梁', rafterSize, [xo, H1 + rd / 2, -PW], [xo, H1 + rd / 2, D + PW], X);
      const yTop = ridgeY - ridgeD / 2, yBot = H1 + rd;
      if (yTop - yBot > 0.1) { add('king', '束', '2x4', [xo, yBot, half], [xo, yTop, half], X); hw.screw += 8; }
    });
    hw.tie += 2 * nr + 2 * nx + 2 * (ny - 2); // 垂木と桁、陸梁と桁、側面の中間の柱と陸梁
    hw.screw += 2 * nr * 3 + nx * 8;            // 垂木と棟木、陸梁と垂木
    const slen = (half + oe) * k;
    const n = Math.max(2, Math.ceil((slen - 0.15) / ps) + 1);
    const zf = lin(-oe + 0.045, half - 0.1, n);
    zf.forEach((z) => add('purlin', '母屋（横桟）', '2x4', onRoof(-os, z, rd + T / 2), onRoof(W + os, z, rd + T / 2), nrm(z)));
    zf.forEach((z) => add('purlin', '母屋（横桟）', '2x4', onRoof(-os, D - z, rd + T / 2), onRoof(W + os, D - z, rd + T / 2), nrm(D - z)));
    purlinCount = 2 * n;
    const o = rd + T;
    const apex = onRoof(0, half, o)[1];
    slopes.push({ slen, pts: [onRoof(-os, -oe, o), onRoof(W + os, -oe, o), [W + os, apex, half], [-os, apex, half]] });
    slopes.push({ slen, pts: [[-os, apex, half], [W + os, apex, half], onRoof(W + os, D + oe, o), onRoof(-os, D + oe, o)] });
  }
  hw.screw += purlinCount * nr * 2; // 母屋と垂木

  // 面ごとの定義（前面 z=0 / 後面 z=D / 右面 x=0 / 左面 x=W）。前に立って見たときの左右
  // at(t, y, o): 面に沿った位置 t・高さ y・外側へのずれ o の点
  // top(t): 補強や壁を付けられる上限（桁の下・垂木の下・陸梁の下）
  const FACES = {
    F: { name: '前面', pts: xs, at: (t, y, o = 0) => [t, y, -o], n: [0, 0, -1], along: X, top: () => H1 - bd },
    B: { name: '後面', pts: xs, at: (t, y, o = 0) => [t, y, D + o], n: [0, 0, 1], along: X, top: () => H2 - bd },
    L: { name: '右面', pts: zs, at: (t, y, o = 0) => [-o, y, t], n: [-1, 0, 0], along: Z, top: (t) => (mono ? yb(t) : H1) },
    R: { name: '左面', pts: zs, at: (t, y, o = 0) => [W + o, y, t], n: [1, 0, 0], along: Z, top: (t) => (mono ? yb(t) : H1) },
  };

  // 壁
  const wMat = ['ply', 'sheet', 'board'].includes(p.wMat) ? p.wMat : 'ply';
  const wH = num('wH'), studPitch = Math.max(0.2, num('studPitch')), railPitch = Math.max(0.2, num('railPitch'));
  const walls = [];
  const wallKind = {};
  for (const [k, f] of Object.entries(FACES)) {
    let w = p['w' + k];
    if (!['full', 'koshi'].includes(w)) continue;
    const minTop = Math.min(...f.pts.map((t) => f.top(t)));
    if (w === 'koshi' && y0 + wH > minTop - 0.1) {
      warnings.push({ level: 'warn', text: `${f.name}の[[腰壁]]の高さ（${wH}m）が、上の[[桁]]や[[垂木]]とほぼ同じ高さです。この面は「上まで」の壁として計算しています。` });
      w = 'full';
    }
    if (w === 'koshi' && wH < 0.3) { warnings.push({ level: 'warn', text: `${f.name}の[[腰壁]]が低すぎる（${wH}m）ので、入れていません。30cm以上にしてください。` }); continue; }
    wallKind[k] = w;
    const full = w === 'full';
    const wallTop = (t) => (full ? f.top(t) : y0 + wH);
    const gableEnd = full && !mono && (k === 'L' || k === 'R');
    let railCount = 0;
    const oRail = PW - T / 2; // 胴縁は柱の外側の面にそろえる
    for (let i = 0; i < f.pts.length - 1; i++) {
      const a0 = f.pts[i] + PW, a1 = f.pts[i + 1] - PW;
      if (a1 - a0 < 0.1) continue;
      const top0 = wallTop(a0), top1 = wallTop(a1);
      if (wMat === 'ply') {
        add('wall', '下枠', '2x4', f.at(a0, y0 + T / 2), f.at(a1, y0 + T / 2), UP, k);
        add('wall', '上枠', '2x4', f.at(a0, top0 - T / 2), f.at(a1, top1 - T / 2), UP, k);
        hw.screw += 8;
        const n = Math.max(0, Math.ceil((a1 - a0) / studPitch - 1e-9) - 1);
        for (let j = 1; j <= n; j++) {
          const t = a0 + ((a1 - a0) * j) / (n + 1);
          if (add('stud', '間柱', '2x4', f.at(t, y0 + T), f.at(t, wallTop(t) - T), f.along, k)) hw.screw += 4;
        }
      } else {
        const lowTop = Math.min(top0, top1);
        const n = Math.max(2, Math.ceil((lowTop - y0 - 0.089) / railPitch - 1e-9) + 1);
        const ys = lin(y0 + 0.0445, lowTop - 0.0445, n);
        ys.forEach((y, j) => {
          const last = j === ys.length - 1;
          const m = add('wall', '胴縁', '2x4', f.at(a0, last ? top0 - 0.0445 : y, oRail), f.at(a1, last ? top1 - 0.0445 : y, oRail), f.n, k);
          if (m) { hw.screw += 4; railCount++; }
        });
        if (a1 - a0 > 2.0) warnings.push({ level: 'warn', text: `${f.name}の壁は柱と柱の間が${(a1 - a0 + 2 * PW).toFixed(2)}mあり、[[胴縁]]がたわみやすくなります。柱の本数を増やしてください。` });
      }
    }
    if (gableEnd) {
      const yT = H1 + rd; // 陸梁の上から
      if (wMat === 'ply') {
        const n = Math.max(0, Math.ceil(D / studPitch - 1e-9) - 1);
        for (let j = 1; j <= n; j++) {
          const t = (D * j) / (n + 1);
          if (yb(t) - yT > 0.15 && add('stud', '間柱', '2x4', f.at(t, yT), f.at(t, yb(t)), f.along, k)) hw.screw += 4;
        }
      } else {
        for (let y = yT + 0.0445; y < Hr - 0.15; y += railPitch) {
          const z1 = (y - H1) / s, z2 = D - z1;
          if (z2 - z1 > 0.3 && add('wall', '胴縁', '2x4', f.at(z1 + 0.05, y, oRail), f.at(z2 - 0.05, y, oRail), f.n, k)) { hw.screw += 4; railCount++; }
        }
      }
    }
    // 壁の面（外側に張る）
    const tA = f.pts[0] - PW, tB = f.pts[f.pts.length - 1] + PW;
    let poly;
    if (!full) poly = [[tA, y0], [tB, y0], [tB, y0 + wH], [tA, y0 + wH]];
    else if (gableEnd) poly = [[tA, y0], [tB, y0], [tB, H1], [half, Hr], [tA, H1]];
    else poly = [[tA, y0], [tB, y0], [tB, f.top(f.pts[f.pts.length - 1])], [tA, f.top(f.pts[0])]];
    const area = polyArea(poly);
    const width = tB - tA, hmax = Math.max(...poly.map((q) => q[1])) - y0;
    walls.push({ face: k, name: f.name, kind: w, mat: wMat, area, width, hmax, railCount, poly, pts: poly.map(([t, y]) => f.at(t, y, PW + 0.008)) });
  }

  // 胴つなぎ（面ごと。柱の外側に横に渡す）
  for (const [k, f] of Object.entries(FACES)) {
    const h = num('t' + k);
    if (!(h > 0)) continue;
    if (wallKind[k] === 'full') { warnings.push({ level: 'info', text: `${f.name}は壁があるので、[[胴つなぎ]]は入れていません（壁の枠が同じ役目をします）。` }); continue; }
    if (wallKind[k] === 'koshi' && h <= y0 + wH + 0.05) { warnings.push({ level: 'info', text: `${f.name}の[[胴つなぎ]]は[[腰壁]]の高さより下なので、入れていません（腰壁の枠が同じ役目をします）。` }); continue; }
    const minTop = Math.min(...f.pts.map((t) => f.top(t)));
    if (h >= minTop - 0.15) {
      warnings.push({ level: 'warn', text: `${f.name}の[[胴つなぎ]]の高さ（${h}m）が、[[桁]]や[[垂木]]の下とほぼ同じか、それより上になっています。そこには取り付けられないので、この面の胴つなぎは入れていません。15cm以上低い高さにしてください。` });
      continue;
    }
    add('tie', '胴つなぎ', '2x4', f.at(f.pts[0] - PW, h, PW + T / 2), f.at(f.pts[f.pts.length - 1] + PW, h, PW + T / 2), f.n, k);
    hw.screw += 2 * f.pts.length;
  }

  // 補強（方杖・筋交い）
  const MIN_RISE = 0.4;
  let strongFaces = 0, anyFaces = 0, lowestKnee = Infinity;
  for (const [k, f] of Object.entries(FACES)) {
    const style = p['b' + k];
    const plyWall = wallKind[k] === 'full' && wMat === 'ply';
    if (plyWall) strongFaces++;
    if (!['knee', 'brace', 'x'].includes(style)) { if (plyWall) anyFaces++; continue; }
    let placed = 0, skipped = 0;
    if (style === 'knee') {
      const kl = Math.max(0.2, num('kneeL'));
      for (let i = 0; i < f.pts.length - 1; i++) {
        const t0 = f.pts[i], t1 = f.pts[i + 1];
        const leg = Math.min(kl, (t1 - t0) / 2 - PW - 0.05);
        if (leg < 0.2) { skipped++; continue; }
        for (const [tp, dir] of [[t0, 1], [t1, -1]]) {
          const lowT = tp + dir * PW, upT = tp + dir * (PW + leg);
          const yLow = f.top(lowT) - leg;
          if (add('knee', '方杖', '2x4', f.at(lowT, yLow), f.at(upT, f.top(upT)), f.n, k)) { hw.screw += 8; placed++; }
          if (k === 'F') lowestKnee = Math.min(lowestKnee, yLow);
        }
      }
      if (skipped) warnings.push({ level: 'warn', text: `${f.name}は柱と柱の間がせまく、[[方杖]]を入れられない区間がありました。` });
      if (placed || plyWall) anyFaces++; // 方杖は弱めなので strongFaces には数えない
    } else {
      const X2 = style === 'x';
      const o = -(PW + T / 2); // 柱の内側に張る
      const lo = Math.max(0.05, num('b' + k + 'lo'));
      const hiIn = num('b' + k + 'hi');
      const hiAt = (t) => (hiIn > 0 ? Math.min(hiIn, f.top(t) - 0.05) : f.top(t) - 0.05);
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [a, b] = i % 2 === 0 ? [f.pts[i], f.pts[i + 1]] : [f.pts[i + 1], f.pts[i]];
        for (const [u, v] of X2 ? [[a, b], [b, a]] : [[a, b]]) {
          const yv = hiAt(v);
          if (yv - lo < MIN_RISE) { skipped++; continue; }
          if (add('brace', '筋交い', '2x4', f.at(u, lo, o), f.at(v, yv, o), f.n, k)) { hw.screw += 8; placed++; }
        }
      }
      if (skipped) warnings.push({ level: 'warn', text: `${f.name}の[[筋交い]]は、下端と上端の高さの差が${MIN_RISE * 100}cmより小さい区間があるため、その区間には入れていません。「筋交いの下端」を下げるか、「筋交いの上端」を上げてください。` });
      if (placed || plyWall) anyFaces++;
      if (placed && !plyWall) strongFaces++;
      if (placed && lo > 1.0) {
        const tieH = num('t' + k);
        if (!(tieH > 0 && Math.abs(tieH - lo) <= 0.3)) warnings.push({ level: 'info', text: `${f.name}の[[筋交い]]が柱の途中（高さ${lo}m）から出ています。途中から出すと、揺れたときにその高さで柱が曲がりやすくなります。同じ高さに[[胴つなぎ]]を入れると、力を隣の柱に逃がせます。` });
      }
    }
  }

  // ---------- 木取り（定尺への割り付け） ----------
  let joints = 0;
  const piecesBySize = {};
  members.forEach((m, i) => {
    m.id = i;
    const st = SIZES[m.size];
    const maxL = FT[st.ft[st.ft.length - 1]];
    const need = m.len + margin;
    const n = need <= maxL + 1e-9 ? 1 : Math.ceil(need / (maxL - margin));
    m.split = n;
    joints += n - 1;
    (piecesBySize[m.size] ||= []);
    for (let j = 0; j < n; j++) piecesBySize[m.size].push({ name: m.name + (n > 1 ? `（${n}分割）` : ''), len: m.len / n, need: m.len / n + margin, mid: i });
  });
  const boards = {};
  const purchase = []; // {size, ft, qty}
  for (const size of SIZE_ORDER) {
    if (!piecesBySize[size]) continue;
    boards[size] = packBoards(piecesBySize[size], SIZES[size].ft);
    const cnt = new Map();
    boards[size].forEach((b) => cnt.set(b.ft, (cnt.get(b.ft) || 0) + 1));
    [...cnt.entries()].sort((a, b) => a[0] - b[0]).forEach(([ft, qty]) => purchase.push({ size, ft, qty }));
  }

  // 部材リスト（同じ名前・寸法・長さでまとめる）
  const groups = new Map();
  members.forEach((m) => {
    const key = m.name + '|' + m.size + '|' + m.len.toFixed(3);
    m.key = key;
    if (!groups.has(key)) groups.set(key, { key, name: m.name, kind: m.kind, size: m.size, len: m.len, split: m.split, count: 0 });
    groups.get(key).count++;
  });
  const order = ['post', 'beam', 'tiebeam', 'king', 'ridge', 'rafter', 'purlin', 'tie', 'knee', 'brace', 'wall', 'stud'];
  const memberTable = [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.len - a.len);

  // ---------- 屋根材 ----------
  const roofWidth = W + 2 * os;
  let roof = null;
  if (truthy(p.roofing)) {
    const across = Math.ceil(roofWidth / num('sheetWork'));
    const sheets = new Map();
    slopes.forEach((sl) => {
      const plan = sheetPlan(sl.slen);
      sheets.set(plan.sheet.shaku, (sheets.get(plan.sheet.shaku) || 0) + across * plan.n);
    });
    const screws = purlinCount * (Math.ceil(roofWidth / num('hookPitch')) + 1);
    hw.sheetScrew += screws;
    roof = { across, sheets, screws, ridgeCap: mono ? 0 : roofWidth };
  }

  // ---------- 壁材 ----------
  let plySheets = 0, boardsCount = 0;
  const wallSheets = new Map();
  for (const w of walls) {
    if (w.mat === 'ply') {
      const n = Math.ceil((w.area / (0.91 * 1.82)) * 1.1);
      plySheets += n; hw.thin += n * 30;
    } else if (w.mat === 'sheet') {
      const across = Math.ceil(w.width / num('sheetWork'));
      const plan = sheetPlan(w.hmax);
      wallSheets.set(plan.sheet.shaku, (wallSheets.get(plan.sheet.shaku) || 0) + across * plan.n);
      hw.sheetScrew += w.railCount * (Math.ceil(w.width / num('hookPitch')) + 1);
    } else {
      const across = Math.ceil(w.width / 0.18), rows = Math.ceil(w.hmax / 1.82 - 1e-9);
      boardsCount += across * rows;
      hw.thin += across * Math.max(2, w.railCount) * 2;
    }
  }

  // ---------- 購入リストと費用 ----------
  const items = [];
  const treated = truthy(p.treated);
  const rate = treated ? num('treatedRate') : 1;
  for (const { size, ft, qty } of purchase) {
    items.push({ group: '木材', name: `${size}材${treated ? '（防腐処理）' : '（SPF）'}`, term: size === '4x4' ? '4x4材' : '2x4材', spec: `${ft}フィート（${Math.round(FT[ft] * 1000)}mm）`, qty, unit: Math.round((num(lumberKey(size, ft)) * rate) / 10) * 10, size, ft });
  }
  const postCount = posts.length;
  items.push({ group: '金物', name: '六角ボルト・ナット・座金', term: 'ボルト', spec: ply === 2 ? 'M12×200' : 'M12×150', qty: hw.bolt, unit: num('cBolt') });
  items.push({ group: '金物', name: 'ハリケーンタイ（垂木止め金物）', term: 'ハリケーンタイ', spec: 'ビス付き', qty: hw.tie, unit: num('cTie') });
  const screwBoxes = Math.ceil((hw.screw * 1.15) / 100);
  items.push({ group: '金物', name: 'コーススレッド', term: 'コーススレッド', spec: `90mm・100本入（約${hw.screw}本使用）`, qty: screwBoxes, unit: num('cScrewBox') });
  if (hw.thin) items.push({ group: '金物', name: 'ビス（板・合板留め）', term: 'コーススレッド', spec: `35〜41mm・100本入（約${hw.thin}本使用）`, qty: Math.ceil((hw.thin * 1.15) / 100), unit: num('cThinBox') });
  if (base === 'slab') {
    items.push({ group: '基礎', name: '柱脚金物（ベースプレート付き）', term: '柱脚金物', spec: '90角用', qty: postCount, unit: num('cPostBase') });
    items.push({ group: '基礎', name: 'あと施工アンカー', term: 'あと施工アンカー', spec: 'M10程度', qty: postCount * num('anchorsPerBase'), unit: num('cAnchor') });
  } else if (base === 'pincoro') {
    items.push({ group: '基礎', name: '羽子板付き束石', term: '羽子板付き束石', spec: '20cm角前後', qty: postCount, unit: num('cPincoro') });
    items.push({ group: '基礎', name: 'コーチボルト（羽子板の固定）', term: 'ボルト', spec: 'M10×75', qty: postCount * 2, unit: num('cCoach') });
    items.push({ group: '基礎', name: '砕石', term: '砕石', spec: '20kg袋', qty: Math.ceil(postCount / 2), unit: num('cGravel') });
  } else if (base === 'footing') {
    const holeVol = Math.PI * (holeD / 2) ** 2 * embed;
    items.push({ group: '基礎', name: '埋め込み式の柱脚金物', term: '柱脚金物', spec: '90角用', qty: postCount, unit: num('cEmbedBase') });
    items.push({ group: '基礎', name: 'ドライコンクリート', term: 'ドライコンクリート', spec: '25kg袋', qty: Math.ceil((postCount * holeVol) / 0.011), unit: num('cConcrete') });
    items.push({ group: '基礎', name: '砕石', term: '砕石', spec: '20kg袋', qty: Math.ceil(postCount / 2), unit: num('cGravel') });
  } else {
    items.push({ group: '基礎', name: '打ち込み式ポストベース', term: '打ち込み式ポストベース', spec: '90角用', qty: postCount, unit: num('cSpike') });
  }
  if (roof) {
    [...roof.sheets.entries()].sort((a, b) => a[0] - b[0]).forEach(([shaku, n]) => items.push({ group: '屋根', name: '波板（ポリカ等）', term: '波板', spec: `${shaku}尺`, qty: n, unit: num(sheetKey(shaku)) }));
    if (roof.ridgeCap) items.push({ group: '屋根', name: '棟包み', term: '棟包み', spec: 'm', qty: Math.ceil(roof.ridgeCap * 10) / 10, unit: num('cRidge') });
  }
  if (walls.length) {
    if (plySheets) items.push({ group: '壁', name: '構造用合板', term: '構造用合板', spec: '9mm 910×1820', qty: plySheets, unit: num('cPly') });
    [...wallSheets.entries()].sort((a, b) => a[0] - b[0]).forEach(([shaku, n]) => items.push({ group: '壁', name: '波板（壁用）', term: '波板', spec: `${shaku}尺`, qty: n, unit: num(sheetKey(shaku)) }));
    if (boardsCount) items.push({ group: '壁', name: '杉板（縦張り）', term: '杉板', spec: '12×180×1820', qty: boardsCount, unit: num('cBoard') });
  }
  if (hw.sheetScrew) items.push({ group: roof ? '屋根' : '壁', name: '波板ビス（木下地用・傘付き）', term: '波板ビス', spec: '', qty: hw.sheetScrew, unit: num('cSheetScrew') });

  // 塗装（木材の表面積から）
  const surface = members.reduce((a, m) => a + 2 * (m.t + m.d) * m.len, 0) + walls.filter((w) => w.mat !== 'sheet').reduce((a, w) => a + w.area, 0);
  let paint = null;
  if (truthy(p.paint)) {
    const liters = (surface * Math.max(1, num('coats'))) / 7; // 1Lで約7㎡（1回塗り）
    let big = Math.floor(liters / 3.5), rest = liters - big * 3.5, small = 0;
    if (rest > 1.4) big++; else if (rest > 0) small = Math.ceil(rest / 0.7);
    paint = { liters, big, small };
    if (big) items.push({ group: '塗装', name: '木材保護塗料', term: '木材保護塗料', spec: '3.5L', qty: big, unit: num('cPaint35') });
    if (small) items.push({ group: '塗装', name: '木材保護塗料', term: '木材保護塗料', spec: '0.7L', qty: small, unit: num('cPaint07') });
  }

  // 並び順：グループ順
  const gOrder = ['木材', '金物', '基礎', '屋根', '壁', '塗装'];
  items.sort((a, b) => gOrder.indexOf(a.group) - gOrder.indexOf(b.group));
  items.forEach((it) => (it.subtotal = Math.round(it.qty * it.unit)));
  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const lumberCount = purchase.reduce((a, x) => a + x.qty, 0);
  const lumberLength = purchase.reduce((a, x) => a + FT[x.ft] * x.qty, 0);
  const volume = members.reduce((a, m) => a + m.t * m.d * m.len, 0);
  const weight = volume * 450; // SPF 約450kg/m³

  // ---------- 注意 ----------
  if (slopeRatio < 0.1 - 1e-9 && (mono || Hr > H1 + 0.05)) {
    const needCm = Math.ceil((mono ? D : half) * 0.1 * 100);
    warnings.push({ level: 'warn', text: `屋根の[[勾配]]が約${(slopeRatio * 10).toFixed(1)}/10です。1/10より緩いと雨水がうまく流れず、[[波板]]の重なりから雨が漏れやすくなります。${mono ? '前と後ろ' : '棟と軒'}の高さの差を${needCm}cm以上にしてください。` });
  }
  if (rs > 0.91 + 1e-9) warnings.push({ level: 'warn', text: `[[垂木]]の間隔が${rs}mあります。[[母屋（横桟）]]は2x4材を垂木の上に渡すので、間隔が広いとたわみやすくなります。90cm以下（できれば45〜60cm）にしてください。` });
  const rafterSpan = mono ? D : half;
  const RAFTER_SPAN = { '2x4': 1.8, '2x6': 2.7, '2x8': 3.6 };
  const allowR = RAFTER_SPAN[rafterSize] * Math.sqrt(0.6 / Math.max(rs, 0.3));
  if (rafterSpan > allowR + 1e-9) warnings.push({ level: 'warn', text: `[[垂木]]（${rafterSize}）が支えなしで渡る長さが${rafterSpan.toFixed(2)}mあります。${rafterSize}・間隔${rs}mだと、目安は${allowR.toFixed(1)}mくらいまでです。垂木を太くする（${rafterSize === '2x8' ? '奥行きを短くする' : '2x' + (Number(rafterSize[2]) + 2) + 'にする'}）か、間隔をせまくしてください。` });
  const BEAM_SPAN = { '2x6': 1.8, '2x8': 2.4, '2x10': 3.0 };
  const trib = (mono ? D / 2 : half / 2) + oe; // 桁1本が受け持つ屋根の奥行き
  const allowB = BEAM_SPAN[beamSize] * (ply === 2 ? 1 : 0.75) * Math.sqrt(1.5 / Math.max(1.5, trib));
  const bay = W / (nx - 1);
  if (bay > allowB + 1e-9) warnings.push({ level: 'warn', text: `柱と柱の間が${bay.toFixed(2)}mあります。[[桁]]（${beamSize}${ply === 2 ? '×2枚' : '×1枚'}）だと、目安は${allowB.toFixed(1)}mくらいまでで、それより長いと真ん中が下にたわみやすくなります。「間口方向の柱の本数」を増やすか、桁を太くしてください。` });
  if (D / (ny - 1) > 3.0 + 1e-9) warnings.push({ level: 'info', text: `左右の列で、柱と柱の間が${(D / (ny - 1)).toFixed(2)}mあります。壁や筋交いを付けるなら、3m以下にすると組みやすくなります。` });
  if (ps > 0.9) warnings.push({ level: 'warn', text: '[[母屋（横桟）]]の間隔が90cmを超えています。[[波板]]を留める場所が少ないと、強い風で波板がバタついて割れたり飛ばされたりしやすくなります。60〜90cmにしてください。' });
  if (oe > 0.6) warnings.push({ level: 'warn', text: `[[軒の出]]が${oe}mあります。60cmを超えると、風で屋根があおられやすくなります。` });
  const maxPost = Math.max(...members.filter((m) => m.kind === 'post').map((m) => m.len));
  if (maxPost + margin > FT[12] + 1e-9) warnings.push({ level: 'error', text: `柱の長さが${maxPost.toFixed(2)}mになります。[[4x4材]]は12フィート（3.65m）までしか売っていないことが多く、柱は継げません。高さを下げてください。` });
  const longOver = members.some((m) => m.split > 1 && m.kind !== 'post');
  if (longOver) warnings.push({ level: 'info', text: `16フィート（4.88m）より長い部材があるので、2本以上に分けて継ぐ計算にしています（継ぎ目${joints}か所）。[[桁]]は柱の上で継ぎ、2枚重ねなら継ぎ目の位置をずらしてください。` });
  if (anyFaces < 3) warnings.push({ level: 'warn', text: `[[筋交い]]・[[方杖]]・合板の壁のどれも入っていない面があります（入っているのは${anyFaces}面）。柱と梁を四角に組んだだけだと、横から押されたときに平行四辺形のように傾いてしまいます。少なくとも3面には入れてください。` });
  else if (strongFaces < 2) warnings.push({ level: 'info', text: '[[方杖]]は手軽ですが、揺れを止める力は[[筋交い]]や[[構造用合板]]の壁より弱めです。少なくとも2面は筋交いか合板の壁にすると安心です。' });
  if (lowestKnee < 1.8) warnings.push({ level: 'info', text: `前面の[[方杖]]の下の端が地面から${lowestKnee.toFixed(2)}mの高さにあります。出入りするときに頭をぶつけないか確かめてください。` });
  if (walls.length === 4 && walls.every((w) => w.kind === 'full')) warnings.push({ level: 'info', text: '4面とも壁でふさいでいるので、このままでは出入りできません。出入りする面は壁なしにするか、扉を付ける部分の枠を別に考えてください。' });
  if (!treated && !truthy(p.paint)) warnings.push({ level: 'warn', text: '[[SPF]]は雨に弱く、塗装しないと数年で腐りやすくなります。「塗装する」を入れるか、[[防腐処理材]]にしてください。' });
  else if (!treated) warnings.push({ level: 'info', text: '[[SPF]]は外で使うと腐りやすい木です。[[木材保護塗料]]を、組み立てる前に切り口まで塗っておくと長持ちします。地面に近い柱の足元だけでも[[防腐処理材]]にすると安心です。' });
  if (W * D > 10 + 1e-9) warnings.push({ level: 'info', text: `床面積が約${(W * D).toFixed(1)}㎡あります。屋根と柱があるものは、小さくても法律上「建物」として扱われます。10㎡を超えると、原則として[[建築確認]]の申請が必要になります。作る前に、市区町村の建築指導課などに相談してください。` });
  else warnings.push({ level: 'info', text: `床面積は約${(W * D).toFixed(1)}㎡です。10㎡以下で、防火地域・準防火地域でなければ、[[建築確認]]の申請はいらないことが多いです。念のため、市区町村の建築指導課などで確認してください。` });
  warnings.push({ level: 'info', text: 'このツールは、部材の本数と費用の目安を出すためのものです。強度の計算はしていません。部材の太さの目安も、軽い波板の屋根で雪の少ない地域を考えた大まかなものです。雪がよく積もる地域や、台風・強風が多い場所では、工務店などに相談してください。' });
  if (Math.max(H1, H2, mono ? 0 : Hr) > 3.2) warnings.push({ level: 'warn', text: '高さが3.2mを超えています。背が高いほど風を受けたときに大きく揺れます。[[筋交い]]を多めに入れ、[[胴つなぎ]]も入れてください。' });
  if (base === 'pincoro') warnings.push({ level: 'warn', text: '[[羽子板付き束石]]は地面に置いてあるだけなので、強い風が屋根の下に吹き込むと、屋根ごと持ち上げられたり、ずれたりすることがあります。束石を半分以上地面に埋め、壁を付けるなら風が抜ける面を残してください。台風が多い地域では「穴を掘ってコンクリート」の方が安心です。' });
  else if (base === 'footing') {
    warnings.push({ level: 'info', text: `深さ${Math.round(embed * 100)}cm・直径${Math.round(holeD * 100)}cmの穴を掘ってコンクリートを流し、上に[[柱脚金物]]を埋め込みます。木の柱は地面に埋めず、コンクリートより上に立てます（埋めると腐ります）。` });
    if (embed < 0.3) warnings.push({ level: 'warn', text: `基礎の深さが${Math.round(embed * 100)}cmしかありません。30cm以上（できれば45cm以上）にしてください。` });
  } else if (base === 'spike') warnings.push({ level: 'warn', text: '[[打ち込み式ポストベース]]は手軽ですが、やわらかい地面では傾きやすく、屋根の付いたものには力不足のことがあります。[[胴つなぎ]]を低い位置に入れて柱の足元どうしをつなぎ、台風が多い地域では「穴を掘ってコンクリート」も検討してください。' });

  return {
    params: p, members, memberTable, items, total, boards, purchase, hw, joints, postCount, lumberCount, lumberLength, weight, paint, surface,
    roof, slopes, walls, warnings, slopeRatio, nr,
    dims: { W, D, H1, H2, Hr, mono, oe, os, base, embed, holeD, y0, rd, bd, rafterSize, beamSize, ply },
  };
}
