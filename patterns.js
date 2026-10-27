// 단청·자개 문양 찍기.
// 둥당기 1편의 단청·자개 문양을 도장처럼 찍고, 찍은 문양마다 고른 움직임으로 나타난다.
// 찍은 기록 하나: { m: 문양 번호, x, y: 가운데, s: 크기(긴 쪽 px), r: 돌림(도), a: 움직임 번호, t0: 나타나는 때(ms) }
// 그림 한 장(layer)에 문양을 넣고(add), draw로 화면에 옮긴다. 다시 그리기는 makeReplay가 시간에 맞춰 넣는다.
(() => {
'use strict';
const { LW, LH } = Ink;

const ANIM_MS = 900;   // 문양 하나가 다 나타나는 데 걸리는 시간
const GAP_MIN = 60, GAP_MAX = 600;   // 찍는 사이 쉬는 시간 (기록할 때 이 안으로 줄인다)

// ---------- 문양 그림 ----------
// 파일로 바로 열면(file://) motifs.js에 담긴 그림을 쓴다 (그래야 미리보기 그림을 저장할 수 있다).
const imgs = {}, waiting = [];
let pending = 0;
function img(id){
  if (imgs[id]) return imgs[id];
  const im = new Image();
  pending++;
  im.onload = im.onerror = () => { if (--pending === 0) waiting.splice(0).forEach((f) => f()); };
  im.src = (location.protocol === "file:" && window.MOTIF_DATA && MOTIF_DATA[id]) || `assets/motifs/${id}.webp`;
  return (imgs[id] = im);
}
for (const kind in MOTIFS) MOTIFS[kind].forEach((m) => img(m.id));
const ready = () => pending === 0;
const whenReady = (f) => (ready() ? f() : waiting.push(f));

// ---------- 움직임 ----------
// u: 나타나는 정도 0→1, live: 다 나타난 뒤에도 계속되는 움직임용 시계(ms), ph: 문양마다 다른 박자
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeBack = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function bounce(x){
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}
// 각 움직임은 { 크기 배, 돌림 더하기(라디안), 옮기기 dx·dy, 투명도, 펼치기(0~1, 왼쪽부터 드러남), 빛 } 을 돌려준다
const ANIMS = [
  { name: "피어나기", f: (u) => ({ k: Math.max(0, easeBack(u)), al: clamp01(u * 3) }) },
  { name: "스며들기", f: (u) => ({ al: easeInOut(u) }) },
  { name: "돌며 피기", f: (u) => ({ k: easeOut(u), rot: -(1 - easeOut(u)) * Math.PI * 1.5, al: clamp01(u * 2) }) },
  { name: "떨어지기", f: (u) => ({ dy: -(1 - bounce(u)) * 260, al: clamp01(u * 4) }) },
  { name: "날아들기", f: (u) => ({ dx: -(1 - easeOut(u)) * 360, rot: -(1 - easeOut(u)) * 0.5, al: clamp01(u * 2.5) }) },
  { name: "펼치기", f: (u) => ({ wipe: easeInOut(u) }) },
  { name: "흔들흔들", f: (u, live, ph) => ({ k: Math.max(0, easeBack(u)), al: clamp01(u * 3), rot: Math.sin(live * 0.005 + ph) * 0.16 }) },
  { name: "둥실둥실", f: (u, live, ph) => ({ dy: (1 - easeOut(u)) * 90 + Math.sin(live * 0.0035 + ph) * 12, al: easeOut(u) }) },
  { name: "빙글빙글", f: (u, live, ph) => ({ k: easeOut(u), al: clamp01(u * 2), rot: live * 0.0018 + ph }) },
  { name: "두근두근", f: (u, live, ph) => ({ k: Math.max(0, easeBack(u)) * (1 + 0.07 * Math.max(0, Math.sin(live * 0.009 + ph)) ** 3), al: clamp01(u * 3) }) },
  { name: "반짝반짝", f: (u, live, ph) => ({ al: clamp01(u * 1.5) * (u < 1 ? 0.55 + 0.45 * Math.abs(Math.sin(u * 14)) : 1), glow: 0.5 + 0.5 * Math.sin(live * 0.006 + ph) }) },
];

function drawStamp(ctx, kind, st, age, live){
  const m = MOTIFS[kind][st.m];
  const im = m && img(m.id);
  if (!im || !im.complete || !im.naturalWidth) return;
  const u = clamp01(age / ANIM_MS);
  const ph = (st.x * 0.013 + st.y * 0.007) % 6.283;
  const o = (ANIMS[st.a] || ANIMS[0]).f(u, live, ph);
  const al = o.al == null ? 1 : o.al, k = o.k == null ? 1 : o.k;
  if (al <= 0.003 || k <= 0.003) return;
  const sc = st.s / Math.max(im.naturalWidth, im.naturalHeight) * k;
  const w = im.naturalWidth, h = im.naturalHeight;
  const a = st.r * Math.PI / 180 + (o.rot || 0);
  const c = Math.cos(a) * sc, s = Math.sin(a) * sc;
  ctx.save();
  ctx.setTransform(c, s, -s, c, st.x + (o.dx || 0), st.y + (o.dy || 0));
  ctx.globalAlpha *= al;
  if (o.wipe != null){
    if (o.wipe <= 0){ ctx.restore(); return; }
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w * o.wipe, h); ctx.clip();
  }
  ctx.drawImage(im, -w / 2, -h / 2);
  if (o.glow){   // 빛을 받아 반짝이는 순간
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha *= 0.55 * o.glow * o.glow;
    ctx.drawImage(im, -w / 2, -h / 2);
  }
  ctx.restore();
}

// 그림 한 장: 찍은 문양 목록. 문양마다 나이(age)가 있어 움직임이 어디까지 갔는지 안다.
// rb(찍은 실제 시각)가 있으면 나이는 지금 시각으로 센다 (만들기 화면에서 막 찍은 문양).
function makeEngine(kind){
  return {
    kind,
    newLayer(){ return { items: [] }; },
    clear(L){ L.items.length = 0; },
    add(L, st, rb){ const it = { st, age: 0, rb: rb == null ? null : rb }; L.items.push(it); return it; },
    pop(L){ L.items.pop(); },
    draw(ctx, L, now){
      for (const it of L.items) drawStamp(ctx, kind, it.st, it.rb != null ? now - it.rb : it.age, now);
    },
  };
}
const dancheong = makeEngine("dc"), jagae = makeEngine("jg");

function stampsLength(stamps){
  let end = 0;
  for (const st of stamps) end = Math.max(end, st.t0 + ANIM_MS);
  return stamps.length ? end : 0;
}

// 찍은 기록을 시간에 맞춰 그림 한 장에 넣는다 (Ink.makeReplay와 같은 쓰임)
function makeReplay(engine, stamps, L){
  const items = stamps.map(() => null), end = stampsLength(stamps);
  return {
    duration: end,
    to(el){
      stamps.forEach((st, k) => {
        if (el < st.t0) return;
        if (!items[k]) items[k] = engine.add(L, st);
        items[k].age = el - st.t0;
      });
      return el >= end;
    },
  };
}

window.Patterns = { dancheong, jagae, ANIMS, ANIM_MS, GAP_MIN, GAP_MAX, img, ready, whenReady, stampsLength, makeReplay };
})();
