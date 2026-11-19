// 3面図（平面図・正面図・右側面図）を SVG 文字列で作る。寸法は mm。
// 配置は第三角法：平面図を正面図の上、右側面図を正面図の右に置く。
// 部材は木の断面の大きさどおりに、箱を投影した形で描く。
//
// 座標の向き（wood-core.js と同じ）
//   x: 間口方向。前から見ると x=0 が右、x=W が左
//   y: 高さ
//   z: 奥行き方向。z=0 が前面
import { memberCorners } from './wood-core.js';

const COLORS = {
  post: '#a5703f', beam: '#8f5c2e', tiebeam: '#8f5c2e', ridge: '#8f5c2e', king: '#a5703f',
  rafter: '#c08850', purlin: '#d9b07a', tie: '#7d8a4a', knee: '#c2410c', brace: '#c2410c', wall: '#cdb48a', stud: '#cdb48a',
};
const LEGEND = [['post', '柱'], ['beam', '桁・陸梁・棟木'], ['rafter', '垂木'], ['purlin', '母屋'], ['brace', '筋交い・方杖'], ['wall', '壁の枠']];
const WALL_FILL = { ply: '#d9b77e', sheet: '#9fd0f0', board: '#c9965f' };
const WALL_NAME = { ply: '構造用合板', sheet: '波板', board: '杉板' };
const SHEET_W = 1188, SHEET_H = 840; // A3 横の比率
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mm = (m) => Math.round(m * 1000).toLocaleString('ja-JP');
const f1 = (v) => Math.round(v * 10) / 10;

// 2Dの凸包（単調連鎖法）
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

export function drawSheet(r, meta = {}) {
  const { W, D, H1, H2, Hr, mono, oe, os, base = 'slab', embed = 0, holeD = 0.3 } = r.dims;
  const below = base === 'slab' ? 0.1 : base === 'pincoro' ? 0.2 : base === 'footing' ? embed + 0.05 : 0.6; // 地面より下に描く深さ
  const maxY = Math.max(...r.slopes.flatMap((s) => s.pts.map((q) => q[1])), H1, H2, mono ? 0 : Hr);
  const Wt = W + 2 * os, Dt = D + 2 * oe, Ht = maxY + 0.15;
  const M = 78, GAP = 120, TITLE = 64, LABEL = 34; // LABEL: 正面図の下の寸法と図名の分
  const s = Math.min((SHEET_W - 2 * M - GAP) / (Wt + Dt), (SHEET_H - TITLE - 2 * M - GAP - LABEL) / (Dt + Ht + below));
  const usedW = (Wt + Dt) * s + GAP, usedH = (Dt + Ht + below) * s + GAP;
  const x0 = (SHEET_W - usedW) / 2, y0 = (SHEET_H - TITLE - LABEL - usedH) / 2;

  const frontLeft = x0, sideLeft = x0 + Wt * s + GAP;
  const topTop = y0, groundY = y0 + Dt * s + GAP + Ht * s;
  const PF = (p) => [frontLeft + (W + os - p[0]) * s, groundY - p[1] * s];          // 正面図
  const PS = (p) => [sideLeft + (p[2] + oe) * s, groundY - p[1] * s];               // 右側面図（前が左）
  const PT = (p) => [frontLeft + (W + os - p[0]) * s, topTop + (D + oe - p[2]) * s]; // 平面図（前が下）

  const out = [];
  const line = (a, b, c, w = 1, extra = '') => out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`);
  const poly = (pts, attrs) => out.push(`<polygon points="${pts.map((q) => q.map(f1).join(',')).join(' ')}" ${attrs}/>`);
  const text = (x, y, t, o = {}) => out.push(`<text x="${f1(x)}" y="${f1(y)}" font-size="${o.size || 11}" text-anchor="${o.anchor || 'middle'}"${o.rot ? ` transform="rotate(${o.rot} ${f1(x)} ${f1(y)})"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''} fill="${o.fill || '#1f2328'}">${esc(t)}</text>`);

  const dimH = (x1, x2, y, label, refY) => {
    if (Math.abs(x2 - x1) < 2) return;
    const [a, b] = x1 < x2 ? [x1, x2] : [x2, x1];
    if (refY != null) { const d = y > refY ? 1 : -1; line([a, refY + 3 * d], [a, y + 4 * d], '#555', 0.6); line([b, refY + 3 * d], [b, y + 4 * d], '#555', 0.6); }
    line([a, y], [b, y], '#555', 0.8);
    line([a - 3, y + 3], [a + 3, y - 3], '#555', 1); line([b - 3, y + 3], [b + 3, y - 3], '#555', 1);
    text((a + b) / 2, y - 4, label, { size: 10.5 });
  };
  const dimV = (y1, y2, x, label, refX) => {
    if (Math.abs(y2 - y1) < 2) return;
    const [a, b] = y1 < y2 ? [y1, y2] : [y2, y1];
    if (refX != null) { const d = x > refX ? 1 : -1; line([refX + 3 * d, a], [x + 4 * d, a], '#555', 0.6); line([refX + 3 * d, b], [x + 4 * d, b], '#555', 0.6); }
    line([x, a], [x, b], '#555', 0.8);
    line([x - 3, a + 3], [x + 3, a - 3], '#555', 1); line([x - 3, b + 3], [x + 3, b - 3], '#555', 1);
    text(x - 5, (a + b) / 2, label, { size: 10.5, rot: -90 });
  };

  const drawMembers = (P, order) => {
    const list = [...r.members].sort((m1, m2) => order(m1) - order(m2));
    for (const m of list) {
      const h = hull(memberCorners(m).map(P));
      poly(h, `fill="${COLORS[m.kind] || '#999'}" fill-opacity="0.85" stroke="#4a3520" stroke-width="0.5" stroke-linejoin="round"`);
    }
  };
  const roofPoly = (P, dashed) => {
    for (const sl of r.slopes) poly(sl.pts.map(P), `fill="#9fd0f0" fill-opacity="0.16" stroke="#5c8fb3" stroke-width="0.9"${dashed ? ' stroke-dasharray="5 3"' : ''}`);
  };
  const wallPolys = (P, faces) => {
    for (const w of r.walls) {
      if (faces && !faces.includes(w.face)) continue;
      const pts = w.pts.map(P);
      poly(pts, `fill="${WALL_FILL[w.mat]}" fill-opacity="0.22" stroke="${WALL_FILL[w.mat]}" stroke-width="1.2"`);
    }
  };
  const posts = r.members.filter((m) => m.kind === 'post');
  const foundation = (P, u1, u2) => {
    const a = P(u1), b = P(u2);
    const xL = Math.min(a[0], b[0]), xR = Math.max(a[0], b[0]);
    if (base === 'slab') {
      out.push(`<rect x="${f1(xL)}" y="${f1(groundY)}" width="${f1(xR - xL)}" height="${f1(0.1 * s)}" fill="#e2ded7" stroke="#9a948a" stroke-width="0.8"/>`);
      return;
    }
    const gy = groundY + (base === 'pincoro' ? 0.1 : 0.05) * s;
    line([xL - 10, gy], [xR + 10, gy], '#8a7a62', 1);
    for (let x = xL - 6; x < xR + 6; x += 9) line([x, gy], [x - 5, gy + 5], '#b3a68f', 0.6);
    for (const pm of posts) {
      const c = P([pm.a[0], 0, pm.a[2]]);
      if (base === 'pincoro') out.push(`<rect x="${f1(c[0] - 0.1 * s)}" y="${f1(groundY)}" width="${f1(0.2 * s)}" height="${f1(0.2 * s)}" fill="#e2ded7" stroke="#9a948a" stroke-width="0.8"/>`);
      if (base === 'footing') out.push(`<rect x="${f1(c[0] - holeD / 2 * s)}" y="${f1(groundY)}" width="${f1(holeD * s)}" height="${f1((embed + 0.05) * s)}" fill="#e2ded7" stroke="#9a948a" stroke-width="0.8"/>`);
      if (base === 'spike') { poly([[c[0] - 0.045 * s, groundY], [c[0] + 0.045 * s, groundY], [c[0], groundY + 0.6 * s]], 'fill="#6b7280" fill-opacity="0.6" stroke="#4b5563" stroke-width="0.6"'); }
    }
  };

  const uniq = (arr) => [...new Set(arr.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const xsPost = uniq(posts.map((m) => m.a[0]));
  const zsPost = uniq(posts.map((m) => m.a[2]));
  const rafterXs = uniq(r.members.filter((m) => m.kind === 'rafter').map((m) => m.a[0]));

  // ---------- 正面図 ----------
  foundation(PF, [W + 0.2, 0, 0], [-0.2, 0, 0]);
  wallPolys(PF, ['B']);
  if (r.roof) roofPoly(PF, false);
  drawMembers(PF, (m) => -m.a[2] - m.b[2]);
  wallPolys(PF, ['F']);
  {
    const yb = groundY + below * s;
    const xsDraw = xsPost.map((x) => PF([x, 0, 0])[0]);
    if (xsPost.length > 2) for (let i = 0; i < xsDraw.length - 1; i++) dimH(xsDraw[i], xsDraw[i + 1], yb + 22, mm(xsPost[i + 1] - xsPost[i]), yb);
    dimH(xsDraw[0], xsDraw[xsDraw.length - 1], yb + (xsPost.length > 2 ? 46 : 22), mm(W) + '（柱の芯々）', yb);
    const left = PF([W + os, 0, 0])[0], right = PF([-os, 0, 0])[0];
    dimV(groundY, groundY - H1 * s, left - 24, (mono ? '前 ' : '軒 ') + mm(H1), PF([W, 0, 0])[0]);
    if (base === 'footing' && embed > 0) dimV(groundY, groundY + (embed + 0.05) * s, left - 50, '基礎 ' + mm(embed + 0.05), PF([W, 0, 0])[0]);
    if (mono && Math.abs(H2 - H1) > 0.001) dimV(groundY, groundY - H2 * s, right + 34, '後 ' + mm(H2), PF([0, 0, 0])[0]);
    if (!mono) dimV(groundY, groundY - Hr * s, right + 34, '棟 ' + mm(Hr), PF([0, 0, 0])[0]);
    text((left + right) / 2, yb + (xsPost.length > 2 ? 78 : 54), '正面図（前から見た図）', { size: 13, weight: 700 });
  }

  // ---------- 右側面図 ----------
  foundation(PS, [-0.2, 0, -0.2], [0, 0, D + 0.2]);
  wallPolys(PS, ['R']);
  if (r.roof) roofPoly(PS, false);
  drawMembers(PS, (m) => -(m.a[0] + m.b[0]));
  wallPolys(PS, ['L']);
  {
    const yb = groundY + below * s;
    const zsDraw = zsPost.map((z) => PS([0, 0, z])[0]);
    if (zsPost.length > 2) for (let i = 0; i < zsDraw.length - 1; i++) dimH(zsDraw[i], zsDraw[i + 1], yb + 22, mm(zsPost[i + 1] - zsPost[i]), yb);
    dimH(zsDraw[0], zsDraw[zsDraw.length - 1], yb + (zsPost.length > 2 ? 46 : 22), mm(D) + '（柱の芯々）', yb);
    if (oe > 0) {
      const yTop = groundY - maxY * s - 26;
      const zA = PS([0, 0, -oe])[0], z0 = PS([0, 0, 0])[0], zD = PS([0, 0, D])[0], zB = PS([0, 0, D + oe])[0];
      dimH(zA, z0, yTop, mm(oe)); dimH(z0, zD, yTop, mm(D)); dimH(zD, zB, yTop, mm(oe));
      text((zA + zB) / 2, yTop - 18, '軒の出を含む屋根の奥行き（水平） ' + mm(Dt), { size: 10, fill: '#555' });
    }
    const left = PS([0, 0, -oe])[0], right = PS([0, 0, D + oe])[0];
    dimV(groundY, groundY - H1 * s, left - 24, (mono ? '前 ' : '軒 ') + mm(H1), PS([0, 0, 0])[0]);
    if (mono) dimV(groundY, groundY - H2 * s, right + 34, '後 ' + mm(H2), PS([0, 0, D])[0]);
    else dimV(groundY, groundY - Hr * s, right + 34, '棟 ' + mm(Hr), PS([0, 0, D / 2])[0]);
    text(left + 10, groundY + below * s + 14, '← 前', { size: 10, anchor: 'start', fill: '#777' });
    text(right - 10, groundY + below * s + 14, '後 →', { size: 10, anchor: 'end', fill: '#777' });
    text((left + right) / 2, yb + (zsPost.length > 2 ? 78 : 54), '右側面図（右から見た図）', { size: 13, weight: 700 });
  }

  // ---------- 平面図 ----------
  {
    const a = PT([W + 0.2, 0, D + 0.2]), b = PT([-0.2, 0, -0.2]);
    if (base === 'slab') out.push(`<rect x="${f1(a[0])}" y="${f1(a[1])}" width="${f1(b[0] - a[0])}" height="${f1(b[1] - a[1])}" fill="#efece6" stroke="#b8b1a6" stroke-width="0.8"/>`);
    for (const pm of posts) {
      const c = PT(pm.a);
      if (base === 'pincoro') out.push(`<rect x="${f1(c[0] - 0.1 * s)}" y="${f1(c[1] - 0.1 * s)}" width="${f1(0.2 * s)}" height="${f1(0.2 * s)}" fill="#e2ded7" stroke="#9a948a" stroke-width="0.8"/>`);
      if (base === 'footing') out.push(`<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(holeD / 2 * s)}" fill="#e2ded7" stroke="#9a948a" stroke-width="0.8"/>`);
    }
  }
  drawMembers(PT, (m) => (m.a[1] + m.b[1]));
  for (const w of r.walls) { const pts = w.pts.map(PT); line(pts[0], pts[1], WALL_FILL[w.mat], 3); }
  if (r.roof) roofPoly(PT, true);
  {
    const left = PT([W + os, 0, 0])[0], right = PT([-os, 0, 0])[0];
    const top = PT([0, 0, D + oe])[1], bottom = PT([0, 0, -oe])[1];
    dimH(left, right, top - 46, '屋根の幅 ' + mm(Wt), top);
    dimH(PT([W, 0, 0])[0], PT([0, 0, 0])[0], top - 22, mm(W), top);
    if (rafterXs.length > 2) {
      const rx = rafterXs.map((x) => PT([x, 0, 0])[0]);
      for (let i = 0; i < rx.length - 1; i++) dimH(rx[i], rx[i + 1], bottom + 18, mm(rafterXs[i + 1] - rafterXs[i]), bottom);
      text((left + right) / 2, bottom + 34, '↑ 垂木の間隔（芯々）', { size: 9.5, fill: '#777' });
    }
    dimV(top, bottom, left - 46, '屋根の奥行 ' + mm(Dt), left);
    dimV(PT([0, 0, D])[1], PT([0, 0, 0])[1], left - 22, mm(D), left);
    text(right + 8, bottom - 4, '前', { size: 10, anchor: 'start', fill: '#777' });
    text(right + 8, top + 10, '後', { size: 10, anchor: 'start', fill: '#777' });
    text((left + right) / 2, bottom + (rafterXs.length > 2 ? 54 : 30), '平面図（上から見た図）', { size: 13, weight: 700 });
  }

  // ---------- 右上の空きに材料の一覧 ----------
  {
    const bx = sideLeft, by = topTop, bw = Math.min(SHEET_W - 40 - bx, 340);
    const lineH = 16, maxLines = Math.floor((Dt * s - 40) / lineH);
    const unitOf = (it) => (it.spec === 'm' ? 'm' : it.group === '木材' ? '本' : /波板（|合板|杉板/.test(it.name) ? '枚' : /塗料/.test(it.name) ? '缶' : /コーチ|ボルト|タイ|金物|ベース|束石|アンカー|波板ビス/.test(it.name) ? '個' : /コンクリ|砕石/.test(it.name) ? '袋' : '箱');
    const rows = r.items.map((it) => [`${it.name}${it.spec && it.spec !== 'm' ? ' ' + it.spec.replace(/（約.*）/, '') : ''}`, `${it.qty.toLocaleString('ja-JP')}${unitOf(it)}`]);
    if (bw > 180 && maxLines >= 4) {
      const shown = rows.slice(0, maxLines - 1);
      const h = 34 + (shown.length + 1) * lineH;
      out.push(`<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(h)}" fill="#faf9f7" stroke="#d6d1c8" rx="6"/>`);
      text(bx + 12, by + 20, '材料の一覧', { size: 12, anchor: 'start', weight: 700 });
      shown.forEach(([n, q], i) => {
        const y = by + 40 + i * lineH;
        text(bx + 12, y, n.length > 30 ? n.slice(0, 29) + '…' : n, { size: 10, anchor: 'start' });
        text(bx + bw - 12, y, q, { size: 10, anchor: 'end' });
      });
      if (rows.length > shown.length) text(bx + 12, by + 40 + shown.length * lineH, `ほか ${rows.length - shown.length} 品目`, { size: 10, anchor: 'start', fill: '#777' });
      const yT = by + h - 8;
      text(bx + 12, yT, '概算の材料費', { size: 11, anchor: 'start', weight: 700 });
      text(bx + bw - 12, yT, '¥' + Math.round(r.total).toLocaleString('ja-JP'), { size: 11, anchor: 'end', weight: 700, fill: '#9a3412' });
    }
  }

  // ---------- 表題欄と凡例 ----------
  const ty = SHEET_H - TITLE;
  out.push(`<line x1="20" y1="${ty}" x2="${SHEET_W - 20}" y2="${ty}" stroke="#1f2328" stroke-width="1"/>`);
  text(28, ty + 26, meta.name || '木の屋根（2x4材）', { size: 16, anchor: 'start', weight: 700 });
  const typeName = mono ? '片流れ' : '切妻';
  const baseName = { slab: '土間コンクリートに固定', pincoro: '羽子板付き束石', footing: '穴を掘ってコンクリート', spike: '打ち込み式ポストベース' }[base] || '';
  const wallTxt = r.walls.length ? `　壁：${r.walls.map((w) => w.name.replace('面', '') + (w.kind === 'koshi' ? '（腰）' : '')).join('・')}（${WALL_NAME[r.walls[0].mat]}）` : '';
  text(28, ty + 46, `${typeName}　間口 ${mm(W)} × 奥行 ${mm(D)}　柱 4x4・桁 ${r.dims.beamSize}${r.dims.ply === 2 ? '×2' : ''}・垂木 ${r.dims.rafterSize}　基礎：${baseName}${wallTxt}　／　単位：mm`, { size: 10.5, anchor: 'start', fill: '#444' });
  const printScale = (pw, ph) => { const w = Math.min(pw - 18, (ph - 18) * (SHEET_W / SHEET_H)); return Math.round(1000 / (s * (w / SHEET_W)) / 5) * 5; };
  text(SHEET_W - 28, ty + 26, `${meta.date || ''}`, { size: 11, anchor: 'end', fill: '#444' });
  text(SHEET_W - 28, ty + 46, `印刷したときの縮尺：A4横で約1/${printScale(297, 210)}、A3横で約1/${printScale(420, 297)}`, { size: 9.5, anchor: 'end', fill: '#777' });
  let lx = 520;
  for (const [k, t] of LEGEND) {
    out.push(`<rect x="${lx}" y="${ty + 17}" width="16" height="9" fill="${COLORS[k]}" stroke="#4a3520" stroke-width="0.5"/>`);
    text(lx + 20, ty + 26, t, { size: 10.5, anchor: 'start' });
    lx += 28 + t.length * 11;
  }
  if (r.roof) {
    out.push(`<rect x="${lx}" y="${ty + 16}" width="18" height="11" fill="#9fd0f0" fill-opacity="0.35" stroke="#5c8fb3" stroke-width="0.9"/>`);
    text(lx + 22, ty + 26, '波板', { size: 10.5, anchor: 'start' });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}" height="${SHEET_H}" font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">`
    + `<rect width="${SHEET_W}" height="${SHEET_H}" fill="#fff"/>`
    + `<rect x="10" y="10" width="${SHEET_W - 20}" height="${SHEET_H - 20}" fill="none" stroke="#1f2328" stroke-width="1.2"/>`
    + out.join('') + '</svg>';
}
