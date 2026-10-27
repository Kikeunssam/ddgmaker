// 단청·자개 문양을 코드로 직접 그린다 (그림 파일 없음, 크게 찍어도 깨지지 않는다).
// 문양마다 draw(g)는 가운데가 (0,0), 반지름 1인 판에 그린다.
// 단청: 먹선·백선을 두르고 바깥(짙은 빛)에서 안쪽(옅은 빛)으로 '휘'를 넣은 뒤, 한지에 스민 듯 결을 입힌다.
// 자개: 조각 모양을 흰색으로 그리고(틈은 지운다) 무지갯빛 조개 결을 입힌다.
// 링크에는 문양을 목록의 순서 번호로 담으므로, 순서를 바꾸지 말고 새 문양은 끝에만 붙인다.
(() => {
'use strict';
const TAU = Math.PI * 2;

// ---------- 단청 빛깔 (바깥 → 안쪽) ----------
const C = {
  ink: "#2b2622", white: "#f6f1e4",
  green: ["#1d5a3d", "#2f8660", "#6aae86", "#b8dbbf"],
  blue: ["#1d3767", "#335f9f", "#6c93c9", "#bccfe8"],
  red: ["#76281e", "#b43f2c", "#d9785c", "#f1bea6"],
  pink: ["#8e3446", "#c9667a", "#e8a0ab", "#f7d9dc"],
  yellow: ["#9b6a1a", "#d29d34", "#ecc86f", "#f8e8b8"],
  orange: ["#93401a", "#d0662f", "#eb9d66", "#f8d4b2"],
  teal: ["#1b5554", "#2e8582", "#6db5b0", "#bfe0dc"],
};

// 모양(Path2D)을 먹선 → 백선 → 휘(바깥에서 안쪽으로 줄여 가며) 순서로 칠한다.
// ax·ay: 휘를 줄일 때 기준점, lw: 먹선 굵기
function banded(g, path, cols, ax = 0, ay = 0, lw = 0.03, steps = [1, 0.74, 0.5, 0.28]){
  g.lineJoin = "round"; g.lineCap = "round";
  g.strokeStyle = C.ink; g.lineWidth = lw * 2.2; g.stroke(path);
  g.strokeStyle = C.white; g.lineWidth = lw * 1.1; g.stroke(path);
  steps.forEach((k, i) => {
    if (!cols[i]) return;
    g.save(); g.translate(ax, ay); g.scale(k, k); g.translate(-ax, -ay);
    g.fillStyle = cols[i]; g.fill(path);
    g.restore();
  });
}
// 굵은 선(덩굴·구름 고리 등)을 휘 넣어 긋는다
function bandedStroke(g, path, cols, w){
  g.lineJoin = "round"; g.lineCap = "round";
  const ws = [w + 0.05, w + 0.022, w, w * 0.62, w * 0.28];
  const cs = [C.ink, C.white, cols[0], cols[1], cols[2]];
  ws.forEach((lw, i) => { g.strokeStyle = cs[i]; g.lineWidth = lw; g.stroke(path); });
}
const path = (f) => { const p = new Path2D(); f(p); return p; };
// 꽃잎: (0,0)에서 위쪽(-y)으로 len, 폭 w. tip 0이면 둥글고 1이면 뾰족
function petal(len, w, tip = 0.6){
  return path((p) => {
    p.moveTo(0, 0);
    p.bezierCurveTo(w * 0.9, -len * 0.12, w * 1.05, -len * (0.62 - tip * 0.1), 0, -len);
    p.bezierCurveTo(-w * 1.05, -len * (0.62 - tip * 0.1), -w * 0.9, -len * 0.12, 0, 0);
    p.closePath();
  });
}
// 둥근 꽃잎 (끝이 넓고 둥글다)
function roundPetal(len, w){
  return path((p) => {
    p.moveTo(0, 0);
    p.bezierCurveTo(w * 0.5, -len * 0.1, w * 1.15, -len * 0.55, w * 0.75, -len * 0.88);
    p.bezierCurveTo(w * 0.45, -len * 1.08, -w * 0.45, -len * 1.08, -w * 0.75, -len * 0.88);
    p.bezierCurveTo(-w * 1.15, -len * 0.55, -w * 0.5, -len * 0.1, 0, 0);
    p.closePath();
  });
}
const circle = (x, y, r) => path((p) => p.arc(x, y, r, 0, TAU));
function ring(g, n, f){ for (let i = 0; i < n; i++){ g.save(); g.rotate(TAU * i / n); f(i); g.restore(); } }
function polygon(n, r, rot = 0){
  return path((p) => { for (let i = 0; i < n; i++){ const a = rot + TAU * i / n; i ? p.lineTo(r * Math.cos(a), r * Math.sin(a)) : p.moveTo(r * Math.cos(a), r * Math.sin(a)); } p.closePath(); });
}
function star(n, r1, r2, rot = -Math.PI / 2){
  return path((p) => { for (let i = 0; i < n * 2; i++){ const a = rot + Math.PI * i / n, r = i % 2 ? r2 : r1; i ? p.lineTo(r * Math.cos(a), r * Math.sin(a)) : p.moveTo(r * Math.cos(a), r * Math.sin(a)); } p.closePath(); });
}
// 소용돌이 (가운데 cx,cy에서 바깥으로 turns 바퀴)
function spiral(p, cx, cy, r0, r1, a0, turns, dir = 1, move = true){
  const n = Math.ceil(turns * 48);
  for (let i = 0; i <= n; i++){
    const t = i / n, a = a0 + dir * turns * TAU * t, r = r0 + (r1 - r0) * t;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0 && move) p.moveTo(x, y); else p.lineTo(x, y);
  }
}
function dot(g, x, y, r, col){ g.fillStyle = C.ink; g.beginPath(); g.arc(x, y, r + 0.018, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

// ---------- 단청 문양 ----------
const DC = [
  { name: "연꽃", draw(g){
    ring(g, 8, () => banded(g, petal(0.97, 0.34, 0.8), C.pink, 0, -0.5));
    g.rotate(TAU / 16);
    ring(g, 8, () => banded(g, petal(0.7, 0.26, 0.8), C.red, 0, -0.38));
    banded(g, circle(0, 0, 0.28), C.yellow);
    ring(g, 7, () => dot(g, 0, -0.15, 0.04, C.green[1]));
    dot(g, 0, 0, 0.04, C.green[1]);
  } },
  { name: "주화", draw(g){
    ring(g, 5, () => banded(g, roundPetal(0.95, 0.42), C.red, 0, -0.55));
    banded(g, circle(0, 0, 0.32), C.yellow);
    banded(g, circle(0, 0, 0.14), C.green, 0, 0, 0.025, [1, 0.6]);
  } },
  { name: "녹화", draw(g){
    g.rotate(TAU / 12);
    ring(g, 6, () => banded(g, petal(0.62, 0.22, 0.9), C.blue, 0, -0.35));
    g.rotate(-TAU / 12);
    ring(g, 6, () => banded(g, petal(0.98, 0.3, 1), C.green, 0, -0.55));
    banded(g, circle(0, 0, 0.24), C.orange);
    dot(g, 0, 0, 0.07, C.yellow[2]);
  } },
  { name: "국화", draw(g){
    ring(g, 16, () => banded(g, petal(0.97, 0.13, 0.4), C.orange, 0, -0.6, 0.022, [1, 0.7, 0.42]));
    g.rotate(TAU / 32);
    ring(g, 16, () => banded(g, petal(0.66, 0.1, 0.4), C.yellow, 0, -0.42, 0.02, [1, 0.66, 0.36]));
    banded(g, circle(0, 0, 0.22), C.red);
  } },
  { name: "팔엽 별꽃", draw(g){
    banded(g, star(8, 0.98, 0.52), C.blue);
    g.rotate(TAU / 16);
    banded(g, star(8, 0.6, 0.32), C.green);
    banded(g, circle(0, 0, 0.2), C.red);
    dot(g, 0, 0, 0.06, C.yellow[2]);
  } },
  { name: "여의두", draw(g){
    const p = path((p) => {
      p.moveTo(0, 0.92);
      p.bezierCurveTo(-0.35, 0.58, -0.98, 0.48, -0.84, 0.04);
      p.bezierCurveTo(-0.74, -0.34, -0.36, -0.36, -0.28, -0.14);
      p.bezierCurveTo(-0.5, -0.56, -0.22, -0.96, 0, -0.92);
      p.bezierCurveTo(0.22, -0.96, 0.5, -0.56, 0.28, -0.14);
      p.bezierCurveTo(0.36, -0.36, 0.74, -0.34, 0.84, 0.04);
      p.bezierCurveTo(0.98, 0.48, 0.35, 0.58, 0, 0.92);
      p.closePath();
    });
    banded(g, p, C.blue, 0, 0.05);
    const s = path((p) => { spiral(p, 0, -0.42, 0.02, 0.2, 0, 1.4); });
    bandedStroke(g, s, C.red, 0.06);
    for (const d of [-1, 1]){ const t = path((p) => spiral(p, d * 0.56, 0.02, 0.02, 0.13, 0, 1.2, d)); bandedStroke(g, t, C.red, 0.045); }
  } },
  { name: "구름", draw(g){
    const body = path((p) => {
      p.moveTo(-0.92, 0.28);
      p.bezierCurveTo(-1.0, -0.1, -0.68, -0.32, -0.46, -0.16);
      p.bezierCurveTo(-0.44, -0.58, 0.02, -0.66, 0.12, -0.3);
      p.bezierCurveTo(0.3, -0.6, 0.8, -0.5, 0.72, -0.1);
      p.bezierCurveTo(1.0, -0.06, 1.02, 0.34, 0.72, 0.36);
      p.lineTo(-0.92, 0.28);
      p.closePath();
    });
    banded(g, body, C.teal, -0.05, 0.05, 0.03, [1, 0.8, 0.6, 0.4]);
    for (const [x, y, r, d] of [[-0.6, 0.04, 0.17, 1], [-0.12, -0.18, 0.2, -1], [0.42, -0.06, 0.18, 1]]){
      bandedStroke(g, path((p) => spiral(p, x, y, 0.01, r, 0, 1.6, d)), C.blue, 0.05);
    }
    bandedStroke(g, path((p) => { p.moveTo(-0.5, 0.42); p.bezierCurveTo(-0.2, 0.75, 0.4, 0.55, 0.85, 0.78); }), C.teal, 0.07);
  } },
  { name: "삼태극", draw(g){
    banded(g, circle(0, 0, 0.97), [C.green[0], C.green[1]], 0, 0, 0.03, [1, 0.93]);
    const R = 0.82, cols = ["#b43f2c", "#2f5c9c", "#d4a032"];
    for (let k = 0; k < 3; k++){
      const a0 = -Math.PI / 2 + TAU * k / 3, a1 = a0 + TAU / 3;
      const p = new Path2D();
      p.moveTo(R * Math.cos(a0), R * Math.sin(a0));
      p.arc(0, 0, R, a0, a1);
      p.arc(R / 2 * Math.cos(a1), R / 2 * Math.sin(a1), R / 2, a1, a1 + Math.PI, false);
      p.arc(R / 2 * Math.cos(a0), R / 2 * Math.sin(a0), R / 2, a0 + Math.PI, a0, true);
      p.closePath();
      g.fillStyle = cols[k]; g.fill(p);
    }
    g.strokeStyle = C.ink; g.lineWidth = 0.035; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  } },
  { name: "보상화", draw(g){
    ring(g, 12, () => { g.save(); g.translate(0, -0.56); banded(g, roundPetal(0.4, 0.17), C.blue, 0, -0.2, 0.022, [1, 0.7, 0.42]); g.restore(); });
    banded(g, circle(0, 0, 0.58), C.green, 0, 0, 0.03, [1, 0.86]);
    g.rotate(TAU / 12);
    ring(g, 6, () => banded(g, roundPetal(0.5, 0.2), C.red, 0, -0.28, 0.022));
    banded(g, circle(0, 0, 0.15), C.yellow);
  } },
  { name: "소란 꽃판", draw(g){
    const sq = (r) => path((p) => p.rect(-r, -r, r * 2, r * 2));
    banded(g, sq(0.95), [C.red[1], C.red[2]], 0, 0, 0.03, [1, 0.92]);
    banded(g, sq(0.78), [C.green[2], C.green[3]], 0, 0, 0.025, [1, 0.9]);
    g.rotate(Math.PI / 4);
    ring(g, 4, () => banded(g, roundPetal(0.66, 0.3), C.blue, 0, -0.36));
    g.rotate(Math.PI / 4);
    ring(g, 4, () => banded(g, petal(0.5, 0.16, 1), C.orange, 0, -0.28, 0.022, [1, 0.66, 0.34]));
    banded(g, circle(0, 0, 0.17), C.yellow);
    for (const [x, y] of [[-0.66, -0.66], [0.66, -0.66], [0.66, 0.66], [-0.66, 0.66]]) dot(g, x, y, 0.06, C.red[1]);
  } },
  { name: "거북등", draw(g){
    banded(g, polygon(6, 0.98), C.blue, 0, 0, 0.03, [1, 0.88]);
    banded(g, polygon(6, 0.76), [C.yellow[2], C.yellow[3]], 0, 0, 0.025, [1, 0.9]);
    ring(g, 6, () => banded(g, roundPetal(0.5, 0.2), C.red, 0, -0.28, 0.02));
    banded(g, circle(0, 0, 0.16), C.green);
  } },
  { name: "덩굴", draw(g){
    const stem = path((p) => {
      p.moveTo(-0.95, 0.5);
      p.bezierCurveTo(-0.6, 0.85, -0.2, 0.3, 0, 0);
      p.bezierCurveTo(0.2, -0.3, 0.55, -0.7, 0.9, -0.45);
    });
    const curl1 = path((p) => { p.moveTo(-0.2, 0.32); p.bezierCurveTo(-0.45, 0.1, -0.5, -0.25, -0.3, -0.38); spiral(p, -0.38, -0.22, 0.17, 0.02, -1.0, 1.2, -1, false); });
    const curl2 = path((p) => { p.moveTo(0.3, -0.38); p.bezierCurveTo(0.55, -0.1, 0.62, 0.25, 0.42, 0.42); spiral(p, 0.5, 0.25, 0.18, 0.02, 2.0, 1.2, 1, false); });
    for (const [x, y, a] of [[-0.62, 0.62, 2.4], [-0.1, 0.06, -0.9], [0.62, -0.62, 0.6], [0.08, -0.14, 2.2]]){
      g.save(); g.translate(x, y); g.rotate(a); banded(g, petal(0.36, 0.13, 1), C.green, 0, -0.18, 0.02, [1, 0.66, 0.34]); g.restore();
    }
    bandedStroke(g, stem, C.green, 0.07);
    bandedStroke(g, curl1, C.teal, 0.055);
    bandedStroke(g, curl2, C.teal, 0.055);
    for (const [x, y] of [[-0.95, 0.5], [0.9, -0.45]]){ g.save(); g.translate(x, y); ring(g, 5, () => banded(g, roundPetal(0.17, 0.08), C.red, 0, -0.1, 0.014, [1, 0.6])); dot(g, 0, 0, 0.04, C.yellow[1]); g.restore(); }
  } },
  { name: "석류", draw(g){
    for (const [a, d] of [[-0.9, -1], [0.9, 1]]){
      g.save(); g.translate(0.18 * d, 0.62); g.rotate(a + Math.PI); banded(g, petal(0.5, 0.17, 1), C.green, 0, -0.25, 0.022, [1, 0.7, 0.42]); g.restore();
    }
    const fruit = path((p) => { p.moveTo(0, -0.5); p.bezierCurveTo(0.55, -0.62, 0.86, -0.1, 0.72, 0.28); p.bezierCurveTo(0.6, 0.64, 0.2, 0.74, 0, 0.72); p.bezierCurveTo(-0.2, 0.74, -0.6, 0.64, -0.72, 0.28); p.bezierCurveTo(-0.86, -0.1, -0.55, -0.62, 0, -0.5); p.closePath(); });
    banded(g, fruit, C.red, 0, 0.1);
    for (let i = 0; i < 5; i++){ g.save(); g.translate(0, -0.52); g.rotate((i - 2) * 0.38); banded(g, petal(0.36, 0.11, 1), C.orange, 0, -0.18, 0.02, [1, 0.62, 0.3]); g.restore(); }
    const seeds = path((p) => p.ellipse(0, 0.12, 0.36, 0.3, 0, 0, TAU));
    banded(g, seeds, [C.yellow[2], C.yellow[3]], 0, 0.12, 0.022, [1, 0.8]);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r % 2); i++) dot(g, (i - (3 - (r % 2)) / 2) * 0.15, -0.04 + r * 0.15, 0.045, C.red[1]);
  } },
  { name: "머리초 띠", draw(g){
    const band = (y0, h, col) => { g.fillStyle = col; g.fillRect(-1, y0, 2, h); };
    band(-0.42, 0.84, C.ink);
    band(-0.4, 0.06, C.white); band(-0.34, 0.08, C.red[1]); band(-0.26, 0.52, C.green[1]);
    band(0.26, 0.08, C.red[1]); band(0.34, 0.06, C.white);
    for (let i = 0; i < 4; i++){
      g.save(); g.translate(-0.75 + i * 0.5, 0);
      ring(g, 6, () => banded(g, roundPetal(0.2, 0.09), [C.yellow[1], C.yellow[2], C.yellow[3]], 0, -0.1, 0.012, [1, 0.6, 0.3]));
      dot(g, 0, 0, 0.045, C.red[1]);
      g.restore();
    }
  } },
];

// ---------- 자개 조각 ----------
// 흰색으로 조각을 칠하고(fill), 조각 사이 틈은 지운다(gap). 칠할 때 g는 그대로 쓴다.
const fill = (g, p) => { g.globalCompositeOperation = "source-over"; g.fillStyle = "#fff"; g.fill(p); };
const gap = (g, p, w = 0.02) => { g.globalCompositeOperation = "destination-out"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = w; g.strokeStyle = "#000"; g.stroke(p); g.globalCompositeOperation = "source-over"; };
const hole = (g, p) => { g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.fill(p); g.globalCompositeOperation = "source-over"; };
const line = (pts) => path((p) => pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))));
// 굵기가 변하는 줄기 (가지·목 등)
function taper(g, pts, w0, w1){
  for (let i = 0; i < pts.length - 1; i++){
    const t = i / (pts.length - 1);
    g.lineCap = "round"; g.lineWidth = w0 + (w1 - w0) * t; g.strokeStyle = "#fff";
    g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke();
  }
}
function bez(p0, p1, p2, p3, n = 24){
  const out = [];
  for (let i = 0; i <= n; i++){
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
function flower5(g, x, y, r, rot = 0){
  g.save(); g.translate(x, y); g.rotate(rot);
  for (let i = 0; i < 5; i++){ g.save(); g.rotate(TAU * i / 5); const p = circle(0, -r * 0.55, r * 0.5); fill(g, p); gap(g, p, r * 0.12); g.restore(); }
  hole(g, circle(0, 0, r * 0.18));
  g.restore();
}

// 자개는 연주할 때 조각이 살아 움직인다: draw(g, t)의 t는 초 단위 시계.
// head: 문양이 바라보는 쪽(라디안). '날아가기' 움직임은 이쪽으로 날아간다.
const sway = (t, f, a, ph = 0) => Math.sin(t * f + ph) * a;
function about(g, x, y, a, f){ g.save(); g.translate(x, y); g.rotate(a); g.translate(-x, -y); f(); g.restore(); }

const JG = [
  { name: "학", head: 0, draw(g, t){
    const f = Math.sin(t * 4.2);   // 날갯짓
    g.translate(-0.02, 0.18 - f * 0.035);
    g.rotate(-0.08);
    const feathers = (x, y, a0, a1, n, l0, l1, w, da, k) => {
      for (let i = 0; i < n; i++){
        const u = i / (n - 1), a = a0 + (a1 - a0) * u + da * (0.6 + 0.4 * u), l = (l0 + (l1 - l0) * u) * k;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        const p = petal(l, w, 0.9); fill(g, p); gap(g, p, 0.018);
        g.restore();
      }
    };
    feathers(0.08, -0.02, -1.3, -0.6, 7, 0.5, 0.9, 0.1, f * 0.55, 0.9 + 0.1 * f);
    g.save(); g.translate(-0.3, 0.14);
    for (const a of [2.7, 2.85, 3.0]){ g.save(); g.rotate(a + Math.PI / 2 + sway(t, 3, 0.05)); const p = petal(0.3, 0.06, 1); fill(g, p); gap(g, p, 0.014); g.restore(); }
    g.restore();
    g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.lineCap = "round";
    for (const dy of [0, 0.05]){ g.beginPath(); g.moveTo(-0.12, 0.2 + dy); g.lineTo(-0.8, 0.42 + dy + sway(t, 4.2, 0.02)); g.stroke(); }
    const body = path((p) => p.ellipse(0.0, 0.1, 0.32, 0.13, -0.12, 0, TAU));
    fill(g, body); gap(g, body, 0.022);
    const hy = sway(t, 4.2, 0.03, 1);
    taper(g, bez([0.24, 0.04], [0.48, -0.04], [0.6, -0.02 + hy], [0.78, -0.16 + hy]), 0.08, 0.05);
    fill(g, circle(0.8, -0.18 + hy, 0.06));
    g.lineWidth = 0.028; g.strokeStyle = "#fff"; g.beginPath(); g.moveTo(0.85, -0.18 + hy); g.lineTo(1.0, -0.13 + hy); g.stroke();
    hole(g, circle(0.815, -0.2 + hy, 0.014));
    feathers(-0.02, 0.0, -1.5, -2.6, 9, 0.6, 1.12, 0.11, -f * 0.6, 0.88 + 0.12 * f);
  } },
  { name: "나비", head: -Math.PI / 2, draw(g, t){
    const k = 0.25 + 0.75 * Math.abs(Math.cos(t * 6));   // 날개를 접었다 폈다
    g.translate(0, sway(t, 12, 0.025));
    g.save(); g.scale(k, 1);
    for (const d of [-1, 1]){
      const up = path((p) => { p.moveTo(0.04 * d, -0.05); p.bezierCurveTo(0.3 * d, -0.9, 1.0 * d, -0.95, 0.92 * d, -0.45); p.bezierCurveTo(0.88 * d, -0.15, 0.4 * d, 0.0, 0.04 * d, 0.0); p.closePath(); });
      const lo = path((p) => { p.moveTo(0.04 * d, 0.02); p.bezierCurveTo(0.5 * d, 0.0, 0.8 * d, 0.3, 0.6 * d, 0.62); p.bezierCurveTo(0.42 * d, 0.9, 0.12 * d, 0.6, 0.04 * d, 0.1); p.closePath(); });
      fill(g, up); fill(g, lo); gap(g, up, 0.025); gap(g, lo, 0.025);
      for (const [x, y] of [[0.5, -0.62], [0.72, -0.4], [0.35, -0.3]]) gap(g, line([[0.06 * d, -0.04], [x * d, y]]), 0.014);
      for (const [x, y] of [[0.5, 0.38], [0.3, 0.55]]) gap(g, line([[0.06 * d, 0.04], [x * d, y]]), 0.014);
      hole(g, circle(0.62 * d, -0.55, 0.08));
    }
    g.restore();
    for (const d of [-1, 1]){
      const wv = sway(t, 5, 0.04, d);
      g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -0.2); g.quadraticCurveTo(0.08 * d, -0.55, 0.22 * d + wv, -0.7); g.stroke();
      fill(g, circle(0.23 * d + wv, -0.71, 0.035));
    }
    fill(g, path((p) => p.ellipse(0, 0.02, 0.05, 0.3, 0, 0, TAU)));
  } },
  { name: "모란", head: 0, draw(g, t){
    for (const [x, y, a, d] of [[-0.55, 0.6, -2.3, 1], [0.55, 0.6, 2.3, -1]]){
      g.save(); g.translate(x, y); g.rotate(a + sway(t, 1.6, 0.1, d));
      const leaf = path((p) => { p.moveTo(0, 0.35); p.bezierCurveTo(0.28, 0.1, 0.22, -0.25, 0, -0.35); p.bezierCurveTo(-0.22, -0.25, -0.28, 0.1, 0, 0.35); });
      fill(g, leaf); gap(g, line([[0, 0.3], [0, -0.3]]), 0.018); g.restore();
    }
    const wavy = (r, n, amp, rot) => path((p) => { for (let i = 0; i <= 200; i++){ const a = TAU * i / 200, rr = r * (1 + amp * Math.abs(Math.sin((a - rot) * n / 2))); i ? p.lineTo(rr * Math.cos(a), rr * Math.sin(a) - 0.05) : p.moveTo(rr * Math.cos(a), rr * Math.sin(a) - 0.05); } p.closePath(); });
    const br = 1 + 0.04 * Math.sin(t * 1.6);
    [[0.7, 6, 0.15], [0.5, 5, -0.22], [0.32, 5, 0.35]].forEach(([r, n, sp]) => {
      r *= br; const rot = t * sp;
      const p = wavy(r, n, 0.16, rot); fill(g, p); gap(g, p, 0.026);
      for (let i = 0; i < n; i++){ const a = rot + TAU * i / n; gap(g, line([[r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a) - 0.05], [r * 1.05 * Math.cos(a), r * 1.05 * Math.sin(a) - 0.05]]), 0.018); }
    });
    for (let i = 0; i < 7; i++){ const a = TAU * i / 7 + t * 0.5; hole(g, circle(0.1 * Math.cos(a), 0.1 * Math.sin(a) - 0.05, 0.025)); }
  } },
  { name: "매화 가지", head: 0, draw(g, t){
    about(g, -0.95, 0.75, sway(t, 1.1, 0.03), () => {
      taper(g, bez([-0.95, 0.75], [-0.5, 0.5], [-0.1, 0.4], [0.3, -0.05]), 0.11, 0.05);
      taper(g, bez([0.3, -0.05], [0.5, -0.3], [0.7, -0.45], [0.95, -0.55]), 0.05, 0.02);
      taper(g, bez([-0.4, 0.5], [-0.35, 0.1], [-0.15, -0.2], [-0.2, -0.55]), 0.06, 0.02);
      taper(g, bez([0.05, 0.25], [0.2, 0.4], [0.45, 0.4], [0.6, 0.5]), 0.04, 0.015);
      [[0.3, -0.08, 0.17, 0.2], [-0.2, -0.56, 0.15, 0.6], [0.7, -0.45, 0.13, 1.1], [-0.4, 0.4, 0.15, 0.9], [0.6, 0.5, 0.12, 0.3], [-0.3, -0.12, 0.1, 0.5]].forEach(([x, y, r, a], i) => {
        flower5(g, x, y, r * (1 + 0.12 * Math.sin(t * 2.2 + i * 1.3)), a + t * (i % 2 ? 0.4 : -0.4));
      });
      for (const [x, y] of [[0.95, -0.55], [0.1, -0.35], [-0.75, 0.55]]) fill(g, circle(x, y, 0.045));
    });
  } },
  { name: "대나무", head: 0, draw(g, t){
    for (const [x0, x1, w, ph] of [[-0.25, -0.15, 0.13, 0], [0.2, 0.32, 0.1, 1.3]]){
      const s = sway(t, 1.3, 0.05, ph);
      const pts = bez([x0, 0.98], [x0 + 0.02, 0.3], [x1 + s * 0.5, -0.3], [x1 + s, -0.98], 6);
      for (let i = 0; i < pts.length - 1; i++){
        g.lineCap = "butt"; g.lineWidth = w; g.strokeStyle = "#fff";
        g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke();
        if (i) gap(g, line([[pts[i][0] - w * 0.6, pts[i][1]], [pts[i][0] + w * 0.6, pts[i][1]]]), 0.022);
      }
    }
    const leaf = (x, y, a, l) => { g.save(); g.translate(x, y); g.rotate(a); const p = path((p) => { p.moveTo(0, 0); p.bezierCurveTo(l * 0.15, -l * 0.1, l * 0.75, -l * 0.07, l, 0); p.bezierCurveTo(l * 0.75, l * 0.04, l * 0.15, l * 0.08, 0, 0); }); fill(g, p); gap(g, line([[l * 0.05, 0], [l * 0.85, -0.004]]), 0.01); g.restore(); };
    [[-0.18, -0.35, -0.5, 0.55], [-0.18, -0.35, -0.95, 0.45], [-0.18, -0.35, 3.3, 0.5], [0.3, 0.1, 0.4, 0.5], [0.3, 0.1, -0.1, 0.55], [0.3, 0.1, 2.8, 0.45], [-0.22, 0.45, 2.9, 0.5], [-0.22, 0.45, 3.4, 0.42]]
      .forEach(([x, y, a, l], i) => leaf(x, y, a + sway(t, 1.8, 0.16, i * 0.8), l));
  } },
  { name: "구름", head: 0, draw(g, t){
    g.translate(sway(t, 0.7, 0.05), sway(t, 0.9, 0.025, 1));
    const body = path((p) => {
      p.moveTo(-0.95, 0.25); p.bezierCurveTo(-1.0, -0.1, -0.65, -0.3, -0.45, -0.15);
      p.bezierCurveTo(-0.42, -0.6, 0.05, -0.65, 0.12, -0.28); p.bezierCurveTo(0.32, -0.6, 0.82, -0.48, 0.72, -0.08);
      p.bezierCurveTo(1.0, -0.04, 1.0, 0.34, 0.7, 0.34); p.closePath();
    });
    fill(g, body);
    for (const [x, y, r, d] of [[-0.62, 0.04, 0.18, 1], [-0.12, -0.18, 0.22, -1], [0.42, -0.04, 0.2, 1]]) gap(g, path((p) => spiral(p, x, y, 0.01, r, t * 1.5 * d, 1.6, d)), 0.03);
    gap(g, body, 0.03);
    const w = sway(t, 2, 0.08);
    taper(g, bez([-0.6, 0.4], [-0.2, 0.75 + w], [0.4, 0.55 - w], [0.95, 0.8 + w * 0.5]), 0.09, 0.02);
  } },
  { name: "국화", head: 0, draw(g, t){
    const petals = (n, len, w, off) => { g.save(); g.rotate(off); ring(g, n, () => { const p = petal(len, w, 0.3); fill(g, p); gap(g, p, 0.016); }); g.restore(); };
    const br = 1 + 0.05 * Math.sin(t * 2);
    petals(22, 0.98 * br, 0.1, t * 0.25); petals(16, 0.72 * br, 0.1, 0.1 - t * 0.35); petals(11, 0.46, 0.1, 0.2 + t * 0.5);
    fill(g, circle(0, 0, 0.16)); gap(g, circle(0, 0, 0.16), 0.02);
    for (let i = 0; i < 6; i++){ const a = TAU * i / 6 - t; hole(g, circle(0.08 * Math.cos(a), 0.08 * Math.sin(a), 0.018)); }
  } },
  { name: "연꽃", head: -Math.PI / 2, draw(g, t){
    taper(g, bez([0, 0.98], [0.02, 0.7], [-0.02, 0.4], [0, 0.18]), 0.05, 0.04);
    g.save(); g.translate(0.48, 0.62 + sway(t, 1.4, 0.02)); g.rotate(sway(t, 1.4, 0.05)); g.scale(1, 0.42);
    const pad = circle(0, 0, 0.42); fill(g, pad);
    for (let i = 0; i < 9; i++){ const a = TAU * i / 9; gap(g, line([[0, 0], [0.42 * Math.cos(a), 0.42 * Math.sin(a)]]), 0.03); }
    g.restore();
    taper(g, bez([0.02, 0.8], [0.2, 0.75], [0.3, 0.7], [0.45, 0.64]), 0.035, 0.03);
    const sp = 1 + 0.18 * Math.sin(t * 1.3);   // 꽃잎이 벌어졌다 오므렸다
    g.save(); g.translate(0, 0.2);
    for (const [a, l, w] of [[-1.15, 0.62, 0.2], [1.15, 0.62, 0.2], [-0.6, 0.78, 0.22], [0.6, 0.78, 0.22], [0, 0.9, 0.24]]){
      g.save(); g.rotate(a * sp); const p = petal(l, w, 1); fill(g, p); gap(g, p, 0.024); gap(g, line([[0, -0.08], [0, -l * 0.8]]), 0.012); g.restore();
    }
    g.restore();
  } },
  { name: "물고기", head: Math.PI, draw(g, t){
    g.rotate(sway(t, 3.5, 0.06));
    about(g, 0.44, 0, sway(t, 7, 0.42), () => {
      const tail = path((p) => { p.moveTo(0.44, 0.0); p.lineTo(0.95, -0.38); p.quadraticCurveTo(0.8, 0.0, 0.95, 0.38); p.closePath(); });
      fill(g, tail); gap(g, tail, 0.02);
      for (let i = 0; i < 5; i++) gap(g, line([[0.55, 0], [0.92, (i - 2) * 0.15]]), 0.012);
    });
    const fin1 = path((p) => { p.moveTo(-0.3, -0.32); p.quadraticCurveTo(-0.05, -0.6 + sway(t, 5, 0.06), 0.15, -0.34); p.closePath(); });
    const fin2 = path((p) => { p.moveTo(-0.2, 0.3); p.quadraticCurveTo(0.0, 0.5 + sway(t, 5, 0.06, 1), 0.15, 0.3); p.closePath(); });
    for (const p of [fin1, fin2]){ fill(g, p); gap(g, p, 0.02); }
    const body = path((p) => { p.moveTo(-0.9, 0.0); p.bezierCurveTo(-0.6, -0.5, 0.2, -0.48, 0.5, -0.02); p.bezierCurveTo(0.2, 0.42, -0.6, 0.45, -0.9, 0.0); p.closePath(); });
    fill(g, body); gap(g, body, 0.022);
    gap(g, path((p) => p.arc(-0.55, 0.0, 0.26, -1.0, 1.0)), 0.02);
    for (let c = 0; c < 4; c++) for (let r = -1; r <= 1; r++){
      const x = -0.3 + c * 0.17, y = r * 0.15 + (c % 2) * 0.075;
      if (Math.abs(y) > 0.3 - c * 0.02) continue;
      gap(g, path((p) => p.arc(x, y, 0.09, -1.3, 1.3)), 0.012);
    }
    hole(g, circle(-0.7, -0.06, 0.045));
  } },
  { name: "거북", head: 0, draw(g, t){
    g.scale(1.3, 1.3); g.rotate(sway(t, 1.5, 0.06));
    const row = Math.sin(t * 3);   // 앞발·뒷발로 헤엄친다
    const flipper = (x, y, a, l, w) => { g.save(); g.translate(x, y); g.rotate(a); const p = petal(l, w, 0.7); fill(g, p); gap(g, p, 0.018); g.restore(); };
    for (const d of [-1, 1]){   // 꽃잎 모양 발을 바라보는 방향(라디안)으로 돌려 붙인다
      flipper(0.2, 0.26 * d, d * (0.6 + row * 0.45) + Math.PI / 2, 0.48, 0.14);
      flipper(-0.28, 0.24 * d, d * (2.3 - row * 0.35) + Math.PI / 2, 0.3, 0.1);
    }
    fill(g, path((p) => { p.moveTo(-0.44, 0); p.lineTo(-0.62, sway(t, 3, 0.05)); p.lineTo(-0.44, 0.06); p.closePath(); }));
    const hy = sway(t, 1.5, 0.04, 2);
    taper(g, [[0.38, 0], [0.56, hy]], 0.12, 0.1);
    fill(g, path((p) => p.ellipse(0.64, hy, 0.12, 0.09, 0, 0, TAU)));
    hole(g, circle(0.7, hy - 0.04, 0.016)); hole(g, circle(0.7, hy + 0.04, 0.016));
    const shell = path((p) => p.ellipse(0, 0, 0.44, 0.34, 0, 0, TAU));
    fill(g, shell); gap(g, shell, 0.024);
    g.save(); g.beginPath(); g.ellipse(0, 0, 0.44, 0.34, 0, 0, TAU); g.clip();
    const s = 0.15;
    for (const [x, y] of [[0, 0], [0.26, 0], [-0.26, 0], [0.13, 0.22], [-0.13, 0.22], [0.13, -0.22], [-0.13, -0.22]]){
      const p = new Path2D(); p.addPath(polygon(6, s, 0), new DOMMatrix([1, 0, 0, 1, x, y])); gap(g, p, 0.022);
    }
    g.restore();
    gap(g, path((p) => p.ellipse(0, 0, 0.36, 0.27, 0, 0, TAU)), 0.012);
  } },
  { name: "칠보", head: 0, draw(g, t){
    g.save(); g.beginPath(); g.arc(0, 0, 0.97, 0, TAU); g.clip();
    g.fillStyle = "#fff"; g.fillRect(-1, -1, 2, 2);
    g.rotate(t * 0.18);
    const s = 0.34;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) gap(g, circle(i * s, j * s, s), 0.03);
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) hole(g, circle((i + 0.5) * s, (j + 0.5) * s, 0.05 * (1 + 0.4 * Math.sin(t * 2 + i + j))));
    g.restore();
    gap(g, circle(0, 0, 0.97), 0.03);
  } },
  { name: "박쥐", head: -Math.PI / 2, draw(g, t){
    const f = Math.sin(t * 7);
    g.translate(0, f * 0.03);
    for (const d of [-1, 1]){
      about(g, 0.08 * d, -0.05, -d * f * 0.32, () => {
        g.save(); g.translate(0.08 * d, -0.05); g.scale(1, 1 - 0.25 * f); g.translate(-0.08 * d, 0.05);
        const w = path((p) => {
          p.moveTo(0.08 * d, -0.1);
          p.bezierCurveTo(0.3 * d, -0.45, 0.7 * d, -0.5, 0.98 * d, -0.3);
          for (let i = 0; i < 4; i++){ const u = (i + 1) / 4; const x = (0.98 - 0.8 * u) * d, y = -0.3 + 0.48 * u; p.quadraticCurveTo(x + 0.1 * d, y - 0.02, x, y + 0.06); }
          p.lineTo(0.06 * d, 0.2); p.closePath();
        });
        fill(g, w); gap(g, w, 0.022);
        for (let i = 1; i < 4; i++){ const u = i / 4; gap(g, line([[0.1 * d, -0.05], [(0.98 - 0.8 * u) * d, -0.3 + 0.48 * u + 0.04]]), 0.014); }
        g.restore();
      });
      fill(g, path((p) => { p.moveTo(0.05 * d, -0.22); p.lineTo(0.12 * d, -0.38); p.lineTo(0.13 * d, -0.18); p.closePath(); }));
    }
    fill(g, path((p) => p.ellipse(0, 0.02, 0.12, 0.26, 0, 0, TAU)));
    fill(g, circle(0, -0.2, 0.11));
    hole(g, circle(-0.045, -0.22, 0.018)); hole(g, circle(0.045, -0.22, 0.018));
  } },
  { name: "달과 별", head: 0, draw(g, t){
    const moon = circle(-0.2, 0.05, 0.62);
    fill(g, moon); hole(g, circle(0.05, -0.12, 0.55));
    gap(g, path((p) => p.arc(-0.2, 0.05, 0.62, 1.2, 3.9)), 0.02);
    [[0.62, -0.5, 0.2], [0.55, 0.45, 0.13], [0.85, 0.05, 0.09], [0.25, -0.85, 0.08], [0.0, 0.85, 0.07]].forEach(([x, y, r], i) => {
      const k = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.7 + i * 1.9));
      g.save(); g.translate(x, y); g.rotate(t * 0.6 * (i % 2 ? 1 : -1)); fill(g, star(4, r * k, r * k * 0.3, -Math.PI / 2)); g.restore();
    });
  } },
  { name: "포도", head: 0, draw(g, t){
    about(g, 0.1, -0.95, sway(t, 1.2, 0.05), () => {
      taper(g, bez([0.1, -0.95], [0.05, -0.75], [0.0, -0.6], [-0.05, -0.45]), 0.05, 0.035);
      g.save(); g.translate(0.45, -0.62); g.rotate(0.4 + sway(t, 1.6, 0.1));
      const leaf = path((p) => { p.moveTo(0, 0.3); for (let i = 0; i <= 5; i++){ const a = Math.PI + i * Math.PI / 5; const r = i % 2 ? 0.26 : 0.4; p.lineTo(r * Math.cos(a), r * Math.sin(a) * 0.9); } p.closePath(); });
      fill(g, leaf); for (let i = 0; i <= 5; i += 2){ const a = Math.PI + i * Math.PI / 5; gap(g, line([[0, 0.2], [0.36 * Math.cos(a), 0.36 * Math.sin(a) * 0.9]]), 0.015); }
      g.restore();
      g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.stroke(path((p) => { p.moveTo(-0.05, -0.55); p.quadraticCurveTo(-0.3, -0.6, -0.45, -0.7); spiral(p, -0.45, -0.7, 0.14, 0.02, t * 0.8, 1.4, -1, false); }));
      const rows = [[-0.42, 4], [-0.24, 5], [-0.06, 4], [0.12, 4], [0.3, 3], [0.48, 2], [0.66, 1]];
      rows.forEach(([y, n], ri) => { for (let i = 0; i < n; i++){
        const x = (i - (n - 1) / 2) * 0.19 + (y > 0 ? -0.04 : 0), yy = y + sway(t, 2.4, 0.012, ri + i);
        const p = circle(x, yy, 0.1); fill(g, p); gap(g, p, 0.022); hole(g, circle(x - 0.03, yy - 0.03, 0.015));
      } });
    });
  } },
];

// ---------- 결 입히기 ----------
// 값 노이즈 (씨앗마다 같은 결)
function makeNoise(seed){
  const N = 256, perm = new Uint8Array(N * 2), val = new Float32Array(N);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < N; i++){ perm[i] = i; val[i] = rnd(); }
  for (let i = N - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]], c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
const noiseA = makeNoise(11), noiseB = makeNoise(29), noiseC = makeNoise(47);

// 단청: 한지에 칠한 안료처럼 고르지 않은 농담과 잔 얼룩을 넣는다
function finishDancheong(cv, seed){
  const g = cv.getContext("2d"), W = cv.width, im = g.getImageData(0, 0, W, W), d = im.data;
  const k = 6 / W, f = 40 / W, ox = seed * 13.7, oy = seed * 7.3;
  for (let y = 0, i = 0; y < W; y++) for (let x = 0; x < W; x++, i += 4){
    if (!d[i + 3]) continue;
    const low = noiseA(x * k + ox, y * k + oy) - 0.5;
    const fine = noiseB(x * f + oy, y * f + ox) - 0.5;
    const speck = noiseC(x * 0.45, y * 0.45) > 0.86 ? -10 : 0;
    const m = 1 + low * 0.16 + fine * 0.08;
    d[i] = Math.min(255, d[i] * m + speck); d[i + 1] = Math.min(255, d[i + 1] * m + speck); d[i + 2] = Math.min(255, d[i + 2] * m + speck);
    d[i + 3] = Math.min(255, d[i + 3] * (0.93 + fine * 0.14));
  }
  g.putImageData(im, 0, 0);
}
// ---------- 자개: 진주빛 조개 결 ----------
// 한 번 만들어 두고 문양마다 다른 자리를 잘라 쓴다. 분홍·옥빛·보랏빛·하늘빛이 구름처럼 섞이고 가는 결이 흐른다.
const PEARL = [[238, 214, 234], [204, 238, 224], [216, 212, 246], [202, 228, 248], [246, 240, 224], [232, 206, 220], [188, 216, 226], [226, 236, 206]];
let pearlTex = null;
function pearl(){
  if (pearlTex) return pearlTex;
  const W = 768, cv = document.createElement("canvas"); cv.width = cv.height = W;
  const g = cv.getContext("2d"), im = g.createImageData(W, W), d = im.data, n = PEARL.length;
  for (let y = 0, i = 0; y < W; y++) for (let x = 0; x < W; x++, i += 4){
    const n1 = noiseA(x / 150, y / 150), n2 = noiseB(x / 40, y / 40), n3 = noiseC(x / 70 + n1 * 3, y / 9);
    let h = (n1 * 2.2 + n2 * 0.5) * n; h = ((h % n) + n) % n;
    const i0 = Math.floor(h), fr = h - i0, a = PEARL[i0], b = PEARL[(i0 + 1) % n];
    const lum = 0.86 + (n2 - 0.5) * 0.3 + Math.sin(x * 0.05 + y * 0.03 + n3 * 12) * 0.05 + (n3 - 0.5) * 0.16;
    for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, (a[c] + (b[c] - a[c]) * fr) * lum);
    d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return (pearlTex = cv);
}
// 반짝이는 점 자리 (판 좌표)
const GLINTS = Array.from({ length: 9 }, (_, i) => [noiseA(i * 3.1, 7.7) * 1.6 - 0.8, noiseB(i * 2.3, 1.9) * 1.6 - 0.8, 1 + i * 0.37]);
const pool = new Map();
function work(W){
  let cv = pool.get(W);
  if (!cv){ cv = document.createElement("canvas"); cv.width = cv.height = W; pool.set(W, cv); }
  return cv;
}
const bucket = (need, max) => { let s = 128; while (s < need && s < max) s *= 2; return s; };
// 자개 한 장면: 조각 모양(t초의 움직임) → 진주빛 결 → 흘러가는 무지개 빛 → 반짝임
// live: 실제 시계(ms), ph: 문양마다 다른 박자. 곧바로 화면에 옮겨 그리고 다시 쓴다.
function jagae(idx, need, t, live, ph){
  const m = JG[idx];
  if (!m) return null;
  const W = bucket(need, 1024), cv = work(W), g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  g.clearRect(0, 0, W, W);
  g.setTransform(W / 2 * 0.97, 0, 0, W / 2 * 0.97, W / 2, W / 2);
  m.draw(g, t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-in";
  const tex = pearl(), o = (ph * 97) % 256;
  g.drawImage(tex, o, (o * 1.7) % 256, 512, 512, 0, 0, W, W);
  // 빛이 비스듬히 흘러가며 무지갯빛으로 바뀐다
  g.globalCompositeOperation = "source-atop";
  const pos = ((live * 0.00016 + ph * 0.17) % 1.6) - 0.3;
  const x0 = (pos - 0.35) * W, x1 = (pos + 0.35) * W;
  const grad = g.createLinearGradient(x0, x0 * 0.4, x1, x1 * 0.4);
  grad.addColorStop(0, "rgba(255,160,220,0)");
  grad.addColorStop(0.25, "rgba(255,150,215,0.5)");
  grad.addColorStop(0.45, "rgba(150,235,255,0.55)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.68, "rgba(190,255,170,0.5)");
  grad.addColorStop(0.85, "rgba(205,170,255,0.45)");
  grad.addColorStop(1, "rgba(205,170,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, W, W);
  // 반짝임
  g.fillStyle = "#fff";
  for (const [x, y, sp] of GLINTS){
    const k = Math.pow(Math.max(0, Math.sin(live * 0.0021 * sp + ph * 3 + x * 5)), 12);
    if (k < 0.05) continue;
    const r = W * 0.06 * k, cx = (x * 0.5 + 0.5) * W, cy = (y * 0.5 + 0.5) * W;
    g.beginPath();
    g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.16, cy - r * 0.16); g.lineTo(cx + r, cy); g.lineTo(cx + r * 0.16, cy + r * 0.16);
    g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.16, cy + r * 0.16); g.lineTo(cx - r, cy); g.lineTo(cx - r * 0.16, cy - r * 0.16); g.closePath();
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  return cv;
}

// ---------- 단청 그림 (크기별로 한 번 그려 둔다) ----------
const cache = new Map();
function sprite(kind, idx, need){
  const m = DC[idx];
  if (!m) return null;
  const size = bucket(need, 2048);
  const key = idx + ":" + size;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d");
  g.translate(size / 2, size / 2); g.scale(size / 2 * 0.97, size / 2 * 0.97);
  m.draw(g);
  finishDancheong(cv, idx + 1);
  cache.set(key, cv);
  return cv;
}
// 고르기 단추에 쓰는 작은 그림
function icon(kind, idx, px = 96){
  const src = kind === "dc" ? sprite(kind, idx, px) : jagae(idx, px, 0.3, 4000, 0);
  const c = document.createElement("canvas"); c.width = c.height = src.width;
  c.getContext("2d").drawImage(src, 0, 0);
  return c.toDataURL("image/png");
}

window.MOTIFS = { dc: DC, jg: JG };
window.MotifArt = { sprite, jagae, icon };
})();
