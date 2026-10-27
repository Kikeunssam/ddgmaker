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
  { name: "여의주", draw(g){
    for (let i = 0; i < 7; i++){
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      g.save(); g.rotate(a + Math.PI / 2);
      banded(g, path((p) => { p.moveTo(-0.16, -0.42); p.bezierCurveTo(-0.24, -0.7, 0.1, -0.78, 0.04, -0.98 + Math.abs(i - 3) * 0.06); p.bezierCurveTo(0.28, -0.7, 0.2, -0.52, 0.16, -0.42); p.closePath(); }), C.orange, 0, -0.55, 0.02, [1, 0.7, 0.42]);
      g.restore();
    }
    banded(g, circle(0, 0.12, 0.56), C.red, 0, 0.12);
    bandedStroke(g, path((p) => spiral(p, 0, 0.12, 0.02, 0.36, 0, 1.6)), C.yellow, 0.06);
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

const JG = [
  { name: "학", draw(g){
    g.rotate(-0.08);
    // 날개: 어깨에서 퍼지는 깃털 조각들 (뒤쪽 날개를 먼저)
    const feathers = (x, y, a0, a1, n, l0, l1, w) => {
      for (let i = 0; i < n; i++){
        const t = i / (n - 1), a = a0 + (a1 - a0) * t, l = l0 + (l1 - l0) * t;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        const p = petal(l, w, 0.9); fill(g, p); gap(g, p, 0.018);
        g.restore();
      }
    };
    feathers(0.08, -0.02, -1.25, -0.55, 6, 0.42, 0.72, 0.09);
    feathers(-0.02, 0.0, -1.55, -2.55, 8, 0.5, 0.95, 0.1);
    // 꼬리와 다리
    g.save(); g.translate(-0.3, 0.14);
    for (const a of [2.7, 2.85, 3.0]){ g.save(); g.rotate(a + Math.PI / 2); const p = petal(0.3, 0.06, 1); fill(g, p); gap(g, p, 0.014); g.restore(); }
    g.restore();
    g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.lineCap = "round";
    for (const dy of [0, 0.05]){ g.beginPath(); g.moveTo(-0.12, 0.2 + dy); g.lineTo(-0.8, 0.42 + dy); g.stroke(); }
    // 몸통·목·머리
    const body = path((p) => p.ellipse(0.0, 0.1, 0.32, 0.13, -0.12, 0, TAU));
    fill(g, body); gap(g, body, 0.022);
    taper(g, bez([0.24, 0.04], [0.48, -0.04], [0.6, -0.02], [0.78, -0.16]), 0.08, 0.05);
    fill(g, circle(0.8, -0.18, 0.06));
    g.lineWidth = 0.028; g.beginPath(); g.moveTo(0.85, -0.18); g.lineTo(1.0, -0.13); g.stroke();
    hole(g, circle(0.815, -0.2, 0.014));
  } },
  { name: "나비", draw(g){
    for (const d of [-1, 1]){
      const up = path((p) => { p.moveTo(0.04 * d, -0.05); p.bezierCurveTo(0.3 * d, -0.9, 1.0 * d, -0.95, 0.92 * d, -0.45); p.bezierCurveTo(0.88 * d, -0.15, 0.4 * d, 0.0, 0.04 * d, 0.0); p.closePath(); });
      const lo = path((p) => { p.moveTo(0.04 * d, 0.02); p.bezierCurveTo(0.5 * d, 0.0, 0.8 * d, 0.3, 0.6 * d, 0.62); p.bezierCurveTo(0.42 * d, 0.9, 0.12 * d, 0.6, 0.04 * d, 0.1); p.closePath(); });
      fill(g, up); fill(g, lo); gap(g, up, 0.025); gap(g, lo, 0.025);
      for (const [x, y] of [[0.5, -0.62], [0.72, -0.4], [0.35, -0.3]]) gap(g, line([[0.06 * d, -0.04], [x * d, y]]), 0.014);
      for (const [x, y] of [[0.5, 0.38], [0.3, 0.55]]) gap(g, line([[0.06 * d, 0.04], [x * d, y]]), 0.014);
      hole(g, circle(0.62 * d, -0.55, 0.08));
      g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -0.2); g.quadraticCurveTo(0.08 * d, -0.55, 0.22 * d, -0.7); g.stroke();
      fill(g, circle(0.23 * d, -0.71, 0.035));
    }
    fill(g, path((p) => p.ellipse(0, 0.02, 0.05, 0.3, 0, 0, TAU)));
  } },
  { name: "모란", draw(g){
    for (const [x, y, a] of [[-0.55, 0.6, -2.3], [0.55, 0.6, 2.3]]){
      g.save(); g.translate(x, y); g.rotate(a);
      const leaf = path((p) => { p.moveTo(0, 0.35); p.bezierCurveTo(0.28, 0.1, 0.22, -0.25, 0, -0.35); p.bezierCurveTo(-0.22, -0.25, -0.28, 0.1, 0, 0.35); });
      fill(g, leaf); gap(g, line([[0, 0.3], [0, -0.3]]), 0.018); g.restore();
    }
    const wavy = (r, n, amp) => path((p) => { for (let i = 0; i <= 200; i++){ const a = TAU * i / 200, rr = r * (1 + amp * Math.abs(Math.sin(a * n / 2))); i ? p.lineTo(rr * Math.cos(a), rr * Math.sin(a) - 0.05) : p.moveTo(rr * Math.cos(a), rr * Math.sin(a) - 0.05); } p.closePath(); });
    for (const [r, n] of [[0.7, 6], [0.5, 5], [0.32, 5]]){
      const p = wavy(r, n, 0.16); fill(g, p); gap(g, p, 0.026);
      for (let i = 0; i < n; i++){ const a = TAU * i / n; gap(g, line([[r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a) - 0.05], [r * 1.05 * Math.cos(a), r * 1.05 * Math.sin(a) - 0.05]]), 0.018); }
    }
    for (let i = 0; i < 7; i++){ const a = TAU * i / 7; hole(g, circle(0.1 * Math.cos(a), 0.1 * Math.sin(a) - 0.05, 0.025)); }
  } },
  { name: "매화 가지", draw(g){
    taper(g, bez([-0.95, 0.75], [-0.5, 0.5], [-0.1, 0.4], [0.3, -0.05]), 0.11, 0.05);
    taper(g, bez([0.3, -0.05], [0.5, -0.3], [0.7, -0.45], [0.95, -0.55]), 0.05, 0.02);
    taper(g, bez([-0.4, 0.5], [-0.35, 0.1], [-0.15, -0.2], [-0.2, -0.55]), 0.06, 0.02);
    taper(g, bez([0.05, 0.25], [0.2, 0.4], [0.45, 0.4], [0.6, 0.5]), 0.04, 0.015);
    for (const [x, y, r, a] of [[0.3, -0.08, 0.17, 0.2], [-0.2, -0.56, 0.15, 0.6], [0.7, -0.45, 0.13, 1.1], [-0.4, 0.4, 0.15, 0.9], [0.6, 0.5, 0.12, 0.3], [-0.3, -0.12, 0.1, 0.5]]) flower5(g, x, y, r, a);
    for (const [x, y] of [[0.95, -0.55], [0.1, -0.35], [-0.75, 0.55]]) fill(g, circle(x, y, 0.045));
  } },
  { name: "대나무", draw(g){
    for (const [x0, x1, w] of [[-0.25, -0.15, 0.13], [0.2, 0.32, 0.1]]){
      const pts = bez([x0, 0.98], [x0 + 0.02, 0.3], [x1, -0.3], [x1, -0.98], 6);
      for (let i = 0; i < pts.length - 1; i++){
        g.lineCap = "butt"; g.lineWidth = w; g.strokeStyle = "#fff";
        g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke();
        if (i) gap(g, line([[pts[i][0] - w * 0.6, pts[i][1]], [pts[i][0] + w * 0.6, pts[i][1]]]), 0.022);
      }
    }
    const leaf = (x, y, a, l) => { g.save(); g.translate(x, y); g.rotate(a); const p = path((p) => { p.moveTo(0, 0); p.bezierCurveTo(l * 0.15, -l * 0.1, l * 0.75, -l * 0.07, l, 0); p.bezierCurveTo(l * 0.75, l * 0.04, l * 0.15, l * 0.08, 0, 0); }); fill(g, p); gap(g, line([[l * 0.05, 0], [l * 0.85, -0.004]]), 0.01); g.restore(); };
    for (const [x, y, a, l] of [[-0.18, -0.35, -0.5, 0.55], [-0.18, -0.35, -0.95, 0.45], [-0.18, -0.35, 3.3, 0.5], [0.3, 0.1, 0.4, 0.5], [0.3, 0.1, -0.1, 0.55], [0.3, 0.1, 2.8, 0.45], [-0.22, 0.45, 2.9, 0.5], [-0.22, 0.45, 3.4, 0.42]]) leaf(x, y, a, l);
  } },
  { name: "구름", draw(g){
    const body = path((p) => {
      p.moveTo(-0.95, 0.25); p.bezierCurveTo(-1.0, -0.1, -0.65, -0.3, -0.45, -0.15);
      p.bezierCurveTo(-0.42, -0.6, 0.05, -0.65, 0.12, -0.28); p.bezierCurveTo(0.32, -0.6, 0.82, -0.48, 0.72, -0.08);
      p.bezierCurveTo(1.0, -0.04, 1.0, 0.34, 0.7, 0.34); p.closePath();
    });
    fill(g, body);
    for (const [x, y, r, d] of [[-0.62, 0.04, 0.18, 1], [-0.12, -0.18, 0.22, -1], [0.42, -0.04, 0.2, 1]]) gap(g, path((p) => spiral(p, x, y, 0.01, r, 0, 1.6, d)), 0.03);
    gap(g, body, 0.03);
    taper(g, bez([-0.6, 0.4], [-0.2, 0.75], [0.4, 0.55], [0.95, 0.8]), 0.09, 0.02);
  } },
  { name: "국화", draw(g){
    const petals = (n, len, w, off) => { g.save(); g.rotate(off); ring(g, n, () => { const p = petal(len, w, 0.3); fill(g, p); gap(g, p, 0.016); }); g.restore(); };
    petals(22, 0.98, 0.1, 0); petals(16, 0.72, 0.1, 0.1); petals(11, 0.46, 0.1, 0.2);
    fill(g, circle(0, 0, 0.16)); gap(g, circle(0, 0, 0.16), 0.02);
    for (let i = 0; i < 6; i++){ const a = TAU * i / 6; hole(g, circle(0.08 * Math.cos(a), 0.08 * Math.sin(a), 0.018)); }
  } },
  { name: "연꽃", draw(g){
    taper(g, bez([0, 0.98], [0.02, 0.7], [-0.02, 0.4], [0, 0.18]), 0.05, 0.04);
    g.save(); g.translate(0.48, 0.62); g.scale(1, 0.42);
    const pad = circle(0, 0, 0.42); fill(g, pad);
    for (let i = 0; i < 9; i++){ const a = TAU * i / 9; gap(g, line([[0, 0], [0.42 * Math.cos(a), 0.42 * Math.sin(a)]]), 0.03); }
    g.restore();
    taper(g, bez([0.02, 0.8], [0.2, 0.75], [0.3, 0.7], [0.45, 0.64]), 0.035, 0.03);
    g.save(); g.translate(0, 0.2);
    for (const [a, l, w] of [[-1.15, 0.62, 0.2], [1.15, 0.62, 0.2], [-0.6, 0.78, 0.22], [0.6, 0.78, 0.22], [0, 0.9, 0.24]]){
      g.save(); g.rotate(a); const p = petal(l, w, 1); fill(g, p); gap(g, p, 0.024); gap(g, line([[0, -0.08], [0, -l * 0.8]]), 0.012); g.restore();
    }
    g.restore();
  } },
  { name: "물고기", draw(g){
    const body = path((p) => { p.moveTo(-0.9, 0.0); p.bezierCurveTo(-0.6, -0.5, 0.2, -0.48, 0.5, -0.02); p.bezierCurveTo(0.2, 0.42, -0.6, 0.45, -0.9, 0.0); p.closePath(); });
    const tail = path((p) => { p.moveTo(0.44, 0.0); p.lineTo(0.95, -0.38); p.quadraticCurveTo(0.8, 0.0, 0.95, 0.38); p.closePath(); });
    const fin1 = path((p) => { p.moveTo(-0.3, -0.32); p.quadraticCurveTo(-0.05, -0.6, 0.15, -0.34); p.closePath(); });
    const fin2 = path((p) => { p.moveTo(-0.2, 0.3); p.quadraticCurveTo(0.0, 0.5, 0.15, 0.3); p.closePath(); });
    for (const p of [tail, fin1, fin2]){ fill(g, p); gap(g, p, 0.02); }
    fill(g, body); gap(g, body, 0.022);
    for (let i = 0; i < 5; i++) gap(g, line([[0.55, 0], [0.92, (i - 2) * 0.15]]), 0.012);
    gap(g, path((p) => p.arc(-0.55, 0.0, 0.26, -1.0, 1.0)), 0.02);
    for (let c = 0; c < 4; c++) for (let r = -1; r <= 1; r++){
      const x = -0.3 + c * 0.17, y = r * 0.15 + (c % 2) * 0.075;
      if (Math.abs(y) > 0.3 - c * 0.02) continue;
      gap(g, path((p) => p.arc(x, y, 0.09, -1.3, 1.3)), 0.012);
    }
    hole(g, circle(-0.7, -0.06, 0.045));
  } },
  { name: "거북등", draw(g){
    g.save(); g.beginPath(); g.arc(0, 0, 0.97, 0, TAU); g.clip();
    g.fillStyle = "#fff"; g.fillRect(-1, -1, 2, 2);
    const s = 0.24, h = s * Math.sqrt(3);
    for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++){
      const x = s * 1.5 * q, y = h * (r + q / 2);
      if (Math.hypot(x, y) > 1.3) continue;
      const p = new Path2D(); p.addPath(polygon(6, s, 0), new DOMMatrix([1, 0, 0, 1, x, y])); gap(g, p, 0.035);
      const p2 = new Path2D(); p2.addPath(polygon(6, s * 0.45, 0), new DOMMatrix([1, 0, 0, 1, x, y])); gap(g, p2, 0.018);
    }
    g.restore();
    gap(g, circle(0, 0, 0.97), 0.03);
    gap(g, circle(0, 0, 0.88), 0.02);
  } },
  { name: "칠보", draw(g){
    g.save(); g.beginPath(); g.arc(0, 0, 0.97, 0, TAU); g.clip();
    g.fillStyle = "#fff"; g.fillRect(-1, -1, 2, 2);
    const s = 0.34;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++){ const p = circle(i * s, j * s, s); gap(g, p, 0.03); }
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) hole(g, circle((i + 0.5) * s, (j + 0.5) * s, 0.05));
    g.restore();
    gap(g, circle(0, 0, 0.97), 0.03);
  } },
  { name: "박쥐", draw(g){
    for (const d of [-1, 1]){
      const w = path((p) => {
        p.moveTo(0.08 * d, -0.1);
        p.bezierCurveTo(0.3 * d, -0.45, 0.7 * d, -0.5, 0.98 * d, -0.3);
        for (let i = 0; i < 4; i++){ const t = (i + 1) / 4; const x = (0.98 - 0.8 * t) * d, y = -0.3 + 0.48 * t; p.quadraticCurveTo((x + 0.12 * d) - 0.02 * d, y - 0.02, x, y + 0.06); }
        p.lineTo(0.06 * d, 0.2); p.closePath();
      });
      fill(g, w); gap(g, w, 0.022);
      for (let i = 1; i < 4; i++){ const t = i / 4; gap(g, line([[0.1 * d, -0.05], [(0.98 - 0.8 * t) * d, -0.3 + 0.48 * t + 0.04]]), 0.014); }
      fill(g, path((p) => { p.moveTo(0.05 * d, -0.22); p.lineTo(0.12 * d, -0.38); p.lineTo(0.13 * d, -0.18); p.closePath(); }));
    }
    fill(g, path((p) => p.ellipse(0, 0.02, 0.12, 0.26, 0, 0, TAU)));
    fill(g, circle(0, -0.2, 0.11));
    hole(g, circle(-0.045, -0.22, 0.018)); hole(g, circle(0.045, -0.22, 0.018));
  } },
  { name: "달과 별", draw(g){
    const moon = path((p) => { p.arc(-0.2, 0.05, 0.62, 0, TAU); });
    fill(g, moon); hole(g, circle(0.05, -0.12, 0.55));
    gap(g, path((p) => p.arc(-0.2, 0.05, 0.62, 1.2, 3.9)), 0.02);
    for (const [x, y, r] of [[0.62, -0.5, 0.2], [0.55, 0.45, 0.13], [0.85, 0.05, 0.09], [0.25, -0.85, 0.08]]){
      const st = star(4, r, r * 0.3, -Math.PI / 2); g.save(); g.translate(x, y); fill(g, st); g.restore();
    }
  } },
  { name: "포도", draw(g){
    taper(g, bez([0.1, -0.95], [0.05, -0.75], [0.0, -0.6], [-0.05, -0.45]), 0.05, 0.035);
    g.save(); g.translate(0.45, -0.62); g.rotate(0.4);
    const leaf = path((p) => { p.moveTo(0, 0.3); for (let i = 0; i <= 5; i++){ const a = Math.PI + i * Math.PI / 5; const r = i % 2 ? 0.26 : 0.4; p.lineTo(r * Math.cos(a), r * Math.sin(a) * 0.9); } p.closePath(); });
    fill(g, leaf); for (let i = 0; i <= 5; i += 2){ const a = Math.PI + i * Math.PI / 5; gap(g, line([[0, 0.2], [0.36 * Math.cos(a), 0.36 * Math.sin(a) * 0.9]]), 0.015); }
    g.restore();
    g.lineWidth = 0.02; g.strokeStyle = "#fff"; g.stroke(path((p) => { p.moveTo(-0.05, -0.55); p.quadraticCurveTo(-0.3, -0.6, -0.45, -0.7); spiral(p, -0.45, -0.7, 0.14, 0.02, 0, 1.4, -1, false); }));
    const rows = [[-0.42, 4], [-0.24, 5], [-0.06, 4], [0.12, 4], [0.3, 3], [0.48, 2], [0.66, 1]];
    for (const [y, n] of rows) for (let i = 0; i < n; i++){
      const x = (i - (n - 1) / 2) * 0.19 + (y > 0 ? -0.04 : 0);
      const p = circle(x, y, 0.1); fill(g, p); gap(g, p, 0.022); hole(g, circle(x - 0.03, y - 0.03, 0.015));
    }
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
function hsl(h, s, l){
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

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
// 자개: 조개껍데기의 무지갯빛 결 (층층이 물결진 결, 조각마다 다른 빛)
function finishJagae(cv, seed){
  const g = cv.getContext("2d"), W = cv.width, im = g.getImageData(0, 0, W, W), d = im.data;
  const k = 3.2 / W, f = 14 / W, ox = seed * 5.1, oy = seed * 3.7;
  for (let y = 0, i = 0; y < W; y++) for (let x = 0; x < W; x++, i += 4){
    const a = d[i + 3];
    if (!a) continue;
    const n1 = noiseA(x * k + ox, y * k + oy), n2 = noiseB(x * f + ox, y * f + oy), n3 = noiseC(x * k * 0.6 + oy, y * k * 0.6 + ox);
    const layers = Math.sin((x * 0.6 + y * 0.8) / W * 90 + n1 * 18 + n2 * 4);   // 겹겹이 진 결
    const hue = 150 + n1 * 220 + n3 * 80 + layers * 10;   // 푸른빛 ~ 분홍빛
    const sat = 0.16 + n2 * 0.22 + Math.max(0, layers) * 0.08;
    const lum = 0.7 + layers * 0.07 + (n3 - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
    const [r, gg, b] = hsl(hue, sat, Math.max(0.42, Math.min(0.94, lum)));
    d[i] = r * 255; d[i + 1] = gg * 255; d[i + 2] = b * 255;
  }
  g.putImageData(im, 0, 0);
}

// ---------- 그림 만들기 (크기별로 한 번 그려 둔다) ----------
const cache = new Map();
function sprite(kind, idx, need){
  const list = kind === "dc" ? DC : JG, m = list[idx];
  if (!m) return null;
  let size = 128;
  while (size < need && size < 2048) size *= 2;
  const key = kind + idx + ":" + size;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d");
  g.translate(size / 2, size / 2); g.scale(size / 2 * 0.97, size / 2 * 0.97);
  m.draw(g);
  if (kind === "dc") finishDancheong(cv, idx + 1); else finishJagae(cv, idx + 1);
  cache.set(key, cv);
  return cv;
}
// 고르기 단추에 쓰는 작은 그림
function icon(kind, idx, px = 96){ return sprite(kind, idx, px).toDataURL("image/png"); }

window.MOTIFS = { dc: DC, jg: JG };
window.MotifArt = { sprite, icon };
})();
