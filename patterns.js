// 단청 대칭 붓과 자개 끊음질 붓.
// 수묵 붓처럼 획 기록(좌표·시간·붓 설정)을 받아 그리므로, 다시 그리기·나누기를 그대로 쓸 수 있다.
// 그림 한 장(layer)에 begin → add … → end 순서로 획을 넣고, draw로 화면에 옮긴다.
(() => {
'use strict';
const { LW, LH, mulberry32, strokesLength } = Ink;
const CX = LW / 2, CY = LH / 2;

// ---------- 단청: 대칭 붓 ----------
// 가운데를 중심으로 n번 돌리고 거울로 뒤집어 같은 획을 되풀이한다 (n = 1이면 대칭 없음).
// 획 둘레에는 단청의 '긋기'처럼 먹선과 흰 선이 두르고, 가운데에는 같은 빛깔의 밝은 줄('빛')이 들어간다.
const DC_COLORS = [
  { name: "주홍", c: "#c3402c", hi: "#e8866a" },
  { name: "군청", c: "#1e4b8e", hi: "#5c8cd0" },
  { name: "양록", c: "#2b8660", hi: "#79c39c" },
  { name: "석간주", c: "#8a3a24", hi: "#c26a4b" },
  { name: "황", c: "#e0a429", hi: "#f6d77f" },
  { name: "분홍", c: "#e07e8c", hi: "#f6bcc4" },
  { name: "백", c: "#f8f4ea", hi: null },
  { name: "먹", c: "#26231f", hi: "#5b564f" },
];
const DC_SYM = [1, 4, 6, 8, 12];

function canvas(w = LW, h = LH){ const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function dcCopies(n){
  const out = [];
  for (let k = 0; k < n; k++){
    const a = (Math.PI * 2 * k) / n, c = Math.cos(a), s = Math.sin(a);
    out.push([c, s, 1]);
    if (n > 1) out.push([c, s, -1]);   // 거울
  }
  return out;
}

function drawDC(ctx, st, pts){
  if (!pts.length) return;
  const col = DC_COLORS[st.c] || DC_COLORS[0], w = st.s;
  const copies = dcCopies(st.n || 1);
  const passes = [["#1d1a17", w + 9], ["#fbf8ef", w + 4], [col.c, w]];
  if (col.hi) passes.push([col.hi, Math.max(1.5, w * 0.36)]);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [color, lw] of passes){
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [c, s, m] of copies){
      for (let i = 0; i < pts.length; i++){
        const dx = pts[i].x - CX, dy = (pts[i].y - CY) * m;
        const x = CX + dx * c - dy * s, y = CY + dx * s + dy * c;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (pts.length === 1){ const p = pts[0]; const dx = p.x - CX, dy = (p.y - CY) * m; const x = CX + dx * c - dy * s, y = CY + dx * s + dy * c; ctx.lineTo(x + 0.01, y); }
    }
    ctx.stroke();
  }
}

const dancheong = {
  kind: "dc",
  newLayer(){ const base = canvas(); return { base, bctx: base.getContext("2d"), active: null }; },
  clear(L){ L.bctx.clearRect(0, 0, LW, LH); L.active = null; },
  begin(L, st){ L.active = { st, pts: [] }; },
  add(L, pt){ if (L.active){ const a = L.active.pts, q = a[a.length - 1]; if (!q || q.x !== pt.x || q.y !== pt.y) a.push(pt); } },
  end(L){ if (L.active){ drawDC(L.bctx, L.active.st, L.active.pts); L.active = null; } },
  draw(ctx, L){ ctx.drawImage(L.base, 0, 0); if (L.active) drawDC(ctx, L.active.st, L.active.pts); },
};

// ---------- 자개: 끊음질 붓 ----------
// 그은 길을 따라 가는 자개 조각을 하나씩 끊어 박는다 (k = 0). k = 1 이면 동그란 자개 알을 박는다.
// 조각마다 결이 달라 빛을 받는 순간이 달라서, 시간이 흐르면 무지갯빛으로 반짝인다.
const JG_PALETTES = ["진주빛", "전복빛"];

function jgPiece(L, x, y, a){
  const st = L.active.st, r = L.active.rnd, s = st.s;
  if (st.k === 1){
    L.pieces.push({ x: x + (r() - 0.5) * s * 0.2, y: y + (r() - 0.5) * s * 0.2, a: r() * Math.PI, l: s * (0.7 + 0.25 * r()), w: s * (0.55 + 0.25 * r()), h: r(), c: st.c, dot: true });
  } else {
    L.pieces.push({ x, y, a: a + (r() - 0.5) * 0.22, l: s * 1.05 * (0.8 + 0.3 * r()), w: s * 0.55 * (0.8 + 0.4 * r()), sk: (r() - 0.5) * 0.5, h: r(), c: st.c, dot: false });
  }
}

const jagae = {
  kind: "jg",
  newLayer(){ return { pieces: [], active: null }; },
  clear(L){ L.pieces.length = 0; L.active = null; },
  begin(L, st){ L.active = { st, rnd: mulberry32(st.seed >>> 0), last: null, carry: 0 }; },
  add(L, pt){
    const A = L.active;
    if (!A) return;
    const step = A.st.k === 1 ? A.st.s * 1.15 : A.st.s * 1.2;
    if (!A.last){ A.last = pt; jgPiece(L, pt.x, pt.y, 0); A.carry = 0; return; }
    const dx = pt.x - A.last.x, dy = pt.y - A.last.y, len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const ang = Math.atan2(dy, dx);
    let d = step - A.carry;
    while (d <= len){
      jgPiece(L, A.last.x + dx * d / len, A.last.y + dy * d / len, ang);
      d += step;
    }
    A.carry = len - (d - step);
    A.last = pt;
  },
  end(L){ L.active = null; },
  draw(ctx, L, now){
    const t = now * 0.0016;
    for (const p of L.pieces){
      const light = 0.5 + 0.5 * Math.sin(t + p.x * 0.011 + p.y * 0.007 + p.a * 1.9 + p.h * 6.3);
      let hue, sat, lum;
      if (p.c === 1){ hue = 165 + light * 95 + p.h * 40; sat = 55; lum = 42 + light * 32; }   // 전복: 푸른·보랏빛
      else { hue = (p.h * 80 + light * 160 + 200) % 360; sat = 38 + light * 20; lum = 70 + light * 20; }   // 진주: 엷은 무지갯빛
      ctx.fillStyle = `hsl(${hue.toFixed(0)},${sat.toFixed(0)}%,${lum.toFixed(0)}%)`;
      const c = Math.cos(p.a), s = Math.sin(p.a);
      ctx.setTransform(c, s, -s, c, p.x, p.y);
      ctx.beginPath();
      if (p.dot) ctx.ellipse(0, 0, p.l / 2, p.w / 2, 0, 0, Math.PI * 2);
      else {
        const l = p.l / 2, w = p.w / 2, k = p.sk * w;
        ctx.moveTo(-l + k, -w); ctx.lineTo(l + k, -w); ctx.lineTo(l - k, w); ctx.lineTo(-l - k, w); ctx.closePath();
      }
      ctx.fill();
      if (light > 0.82){   // 빛이 닿는 순간의 반짝임
        ctx.fillStyle = `rgba(255,255,255,${((light - 0.82) * 3.2).toFixed(2)})`;
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
};

// 획 기록 묶음을 시간에 맞춰 그림 한 장에 넣는다 (Ink.makeReplay와 같은 쓰임)
function makeReplay(engine, strokes, L){
  const ptr = strokes.map(() => 0), started = strokes.map(() => false);
  return {
    duration: strokesLength(strokes),
    to(el){
      let done = true;
      strokes.forEach((st, k) => {
        if (ptr[k] >= st.pts.length) return;
        done = false;
        if (st.t0 > el) return;
        if (!started[k]){ engine.begin(L, st); started[k] = true; }
        while (ptr[k] < st.pts.length){
          const a = st.pts[ptr[k]];
          if (st.t0 + a[2] > el) break;
          engine.add(L, { x: a[0], y: a[1], t: a[2], p: a[3] });
          ptr[k]++;
        }
        if (ptr[k] >= st.pts.length) engine.end(L);
      });
      return done;
    },
  };
}

window.Patterns = { dancheong, jagae, DC_COLORS, DC_SYM, JG_PALETTES, makeReplay };
})();
