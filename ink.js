// 수묵 붓 엔진 (brush-test.html 시제품의 붓을 그대로 옮긴 것: 상수·계산은 바꾸지 않았다).
// 낮은 해상도 격자 위에서 물과 먹이 한지로 번지고, 마르며 가라앉는다.
// 그림은 획 기록(좌표·시간·붓 설정)으로 남고, 같은 기록을 넣으면 같은 붓질이 다시 그려진다.
(() => {
'use strict';

// ---------- 크기와 성능 ----------
const LW = 1200, LH = 750;                       // 논리 좌표 (기기와 상관없이 같은 그림)
const q = new URLSearchParams(location.search).get('q');
const lowPower = /Android|iPhone/.test(navigator.userAgent);
const SC = q ? Math.max(1, Math.min(4, +q)) : (lowPower ? 3 : 2);  // 격자 1칸 = SC 픽셀
const GW = Math.floor(LW / SC), GH = Math.floor(LH / SC), N = GW * GH;

// ---------- 시뮬레이션 상수 ----------
const STEP_MS = 1000 / 120;
const K = 0.07;           // 물 퍼짐
const KP = 0.03;          // 젖은 곳끼리 먹 섞임
const MINW = 0.015;       // 이보다 적으면 마른 칸
const SPREAD = 0.11;      // 마른 종이로 번져 나가려면 필요한 물
const EVAP = 0.0006;      // 증발
const EDGE_EVAP = 0.0013; // 가장자리(물이 얇은 곳) 추가 증발 → 테두리가 진해짐
const EDGE_T = 0.22;
const DEP = 0.009;         // 먹이 종이에 가라앉는 속도
const WMAX = 4;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;

// ---------- 한지 (흡수도는 모든 종이가 같이 쓴다) ----------
const A = new Float32Array(N);   // 종이 흡수도 (닥나무 섬유 결)
const G = new Float32Array(N);   // 고운 종이 결 (먹 속에 비치는 결)
{ const r = mulberry32(99); for (let i = 0; i < N; i++) G[i] = r(); }
const fibers = [];
const paperRnd = mulberry32(20261027);
(function makePaper(){
  const r = paperRnd;
  const tmp = new Float32Array(N);
  const octaves = [[60, 0.4], [16, 0.3], [5, 0.3]];   // 논리 픽셀 크기
  for (const [px, amp] of octaves){
    const cell = Math.max(1.5, px / SC);
    const lw = Math.ceil(GW / cell) + 2, lh = Math.ceil(GH / cell) + 2;
    const lat = new Float32Array(lw * lh); for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < GH; y++){
      const fy = y / cell, iy = fy | 0, ty = fy - iy, sy = ty*ty*(3-2*ty);
      for (let x = 0; x < GW; x++){
        const fx = x / cell, ix = fx | 0, tx = fx - ix, sx = tx*tx*(3-2*tx);
        const a = lat[iy*lw+ix], b = lat[iy*lw+ix+1], c = lat[(iy+1)*lw+ix], d = lat[(iy+1)*lw+ix+1];
        tmp[y*GW+x] += amp * ((a + (b-a)*sx) * (1-sy) + (c + (d-c)*sx) * sy);
      }
    }
  }
  // 섬유: 흡수가 잘 되는 가는 줄 → 먹이 실처럼 번져 나감
  const nF = Math.floor(LW * LH / 900);
  for (let k = 0; k < nF; k++){
    let x = r()*LW, y = r()*LH, ang = r()*Math.PI*2, len = 20 + r()*70;
    const pts = [[x,y]];
    for (let s = 0; s < len; s += 3){
      ang += (r()-0.5)*0.5; x += Math.cos(ang)*3; y += Math.sin(ang)*3; pts.push([x,y]);
      const gx = (x/SC)|0, gy = (y/SC)|0;
      if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) tmp[gy*GW+gx] += 0.28;
    }
    fibers.push(pts);
  }
  for (let i = 0; i < N; i++) A[i] = clamp(0.2 + tmp[i] * 1.3, 0.35, 1.7);
})();

// 보이는 종이를 캔버스에 그린다 (흡수도와 같은 결이라 먹이 보이는 섬유를 따라 번진다)
// tone: 'ink' 누런 한지(수묵), 'white' 흰 한지(단청), 'black' 검은 한지(자개), 'gray' 회색(섞음)
const TONES = {
  ink:   { bg: '#efe6d2', n: 7,  hi: 'rgba(255,252,240,.55)', lo: 'rgba(130,110,80,.13)' },
  white: { bg: '#f8f6f0', n: 5,  hi: 'rgba(255,255,255,.85)', lo: 'rgba(150,140,120,.10)' },
  black: { bg: '#161514', n: 6,  hi: 'rgba(120,112,100,.16)', lo: 'rgba(0,0,0,.25)' },
  gray:  { bg: '#5a5852', n: 6,  hi: 'rgba(150,145,135,.18)', lo: 'rgba(30,28,25,.16)' },   // 섞음
};
function drawPaper(pc, tone = 'ink'){
  const T = TONES[tone] || TONES.ink;
  pc.width = LW; pc.height = LH;
  const r = tone === 'ink' ? paperRnd : mulberry32(tone.length * 17 + 3);
  const g = pc.getContext('2d');
  g.fillStyle = T.bg; g.fillRect(0, 0, LW, LH);
  const id = g.getImageData(0, 0, LW, LH), px = id.data;
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++){
    const i = (y*LW+x)*4, a = A[Math.min(GH-1,(y/SC)|0)*GW + Math.min(GW-1,(x/SC)|0)];
    const n = (r()-0.5)*T.n - (a-1)*T.n;
    px[i] += n; px[i+1] += n; px[i+2] += n*0.9;
  }
  g.putImageData(id, 0, 0);
  g.lineCap = 'round';
  for (const f of fibers){
    g.strokeStyle = r() < 0.6 ? T.hi : T.lo;
    g.lineWidth = 0.6 + r()*0.8;
    g.beginPath(); g.moveTo(f[0][0], f[0][1]); for (const p of f) g.lineTo(p[0], p[1]); g.stroke();
  }
}

const ALUT = new Uint8ClampedArray(4096);
for (let k = 0; k < 4096; k++){ const p = k / 512; ALUT[k] = 255 * (1 - Math.exp(-3.4 * p)); }

// ---------- 먹물이 담기는 종이 한 장 ----------
// 화면에 보이는 종이 하나, 미리보기 그림을 굽는 종이 하나처럼 여러 장을 따로 만들 수 있다.
function makeSim(ic){
  const W = new Float32Array(N), S = new Float32Array(N), D = new Float32Array(N);
  const dW = new Float32Array(N), dS = new Float32Array(N);
  const C = new Float32Array(N);   // 먹 농도 = 먹 / 물
  const T = new Float32Array(N);   // 이 시각(시뮬레이션 시계)까지는 먹이 사라지지 않는다 (연주 모드)
  let bx0 = GW, by0 = GH, bx1 = -1, by1 = -1;      // 젖은 영역
  let rx0 = GW, ry0 = GH, rx1 = -1, ry1 = -1;      // 다시 그릴 영역
  let fx0 = GW, fy0 = GH, fx1 = -1, fy1 = -1;      // 먹이 있는 영역 (사라지게 할 곳)

  ic.width = GW; ic.height = GH;
  const ictx = ic.getContext('2d');
  const img = ictx.createImageData(GW, GH), pix = img.data;
  for (let i = 0; i < N; i++){ pix[i*4] = 12; pix[i*4+1] = 11; pix[i*4+2] = 14; pix[i*4+3] = 0; }

  const sim = {
    W, S, D, T, canvas: ic,
    clock: 0,          // 시뮬레이션 시계 (ms)
    keepUntil: 0,      // 젖어 있는 곳은 이 시각까지 남긴다
    fading: false,     // 연주 모드: 다시 그리기가 끝난 먹은 서서히 사라진다
    markR(x0,y0,x1,y1){ if(x0<rx0)rx0=x0; if(y0<ry0)ry0=y0; if(x1>rx1)rx1=x1; if(y1>ry1)ry1=y1; },
    markB(x0,y0,x1,y1){
      if(x0<bx0)bx0=x0; if(y0<by0)by0=y0; if(x1>bx1)bx1=x1; if(y1>by1)by1=y1;
      if(x0<fx0)fx0=x0; if(y0<fy0)fy0=y0; if(x1>fx1)fx1=x1; if(y1>fy1)fy1=y1;
    },
    wet(){ return bx0 <= bx1; },
    inked(){ return fx0 <= fx1; },
    render, clear, step, fade,
  };

  function render(){
    if (rx0 > rx1) return;
    for (let y = ry0; y <= ry1; y++){
      let i = y*GW + rx0;
      for (let x = rx0; x <= rx1; x++, i++){
        const p = S[i] + D[i];
        let a = ALUT[Math.min(4095, (p*512)|0)] * (0.84 + 0.16*G[i]);
        const w = W[i];
        if (w > 0) a += (255 - a) * Math.min(0.09, w * 0.06);   // 젖은 종이는 살짝 어둡게
        pix[i*4+3] = a;
      }
    }
    ictx.putImageData(img, 0, 0, rx0, ry0, rx1-rx0+1, ry1-ry0+1);
    rx0 = GW; ry0 = GH; rx1 = -1; ry1 = -1;
  }

  function clear(){
    W.fill(0); S.fill(0); D.fill(0); dW.fill(0); dS.fill(0); T.fill(0);
    bx0 = GW; by0 = GH; bx1 = -1; by1 = -1;
    fx0 = GW; fy0 = GH; fx1 = -1; fy1 = -1;
    sim.markR(0,0,GW-1,GH-1);
  }

  // ---------- 물과 먹의 움직임 ----------
  function flow(i, j){
    const wi = W[i], wj = W[j];
    if (wi < MINW){ if (wj < MINW) return; const a = A[i]; if (wj*a*a < SPREAD) return; }
    else if (wj < MINW){ const a = A[j]; if (wi*a*a < SPREAD) return; }
    const f = K * (A[i] + A[j]) * (wi - wj);
    let m;
    if (f > 0){ m = f * C[i]; if (wj < EDGE_T) m *= 0.8; }        // 번져 나가는 물은 먹을 조금 덜 데려감
    else { m = f * C[j]; if (wi < EDGE_T) m *= 0.8; }
    if (wi >= MINW && wj >= MINW) m += KP * (C[i] - C[j]) * (wi < wj ? wi : wj);
    dW[i] -= f; dW[j] += f; dS[i] -= m; dS[j] += m;
  }

  function step(){
    sim.clock += STEP_MS;
    if (bx0 > bx1) return;
    const x0 = Math.max(0,bx0-1), x1 = Math.min(GW-1,bx1+1), y0 = Math.max(0,by0-1), y1 = Math.min(GH-1,by1+1);
    for (let y = y0; y <= y1; y++){
      for (let i = y*GW + x0, e = y*GW + x1; i <= e; i++){ const w = W[i]; C[i] = w >= MINW ? S[i] / w : 0; }
    }
    for (let y = y0; y <= y1; y++){
      for (let i = y*GW + x0, e = y*GW + x1; i < e; i++) if (W[i] > 0 || W[i+1] > 0) flow(i, i+1);
    }
    for (let y = y0; y < y1; y++){
      for (let i = y*GW + x0, e = y*GW + x1; i <= e; i++) if (W[i] > 0 || W[i+GW] > 0) flow(i, i+GW);
    }
    const keep = sim.fading ? sim.keepUntil : 0;
    let nx0 = GW, ny0 = GH, nx1 = -1, ny1 = -1;
    for (let y = y0; y <= y1; y++){
      let i = y*GW + x0, rowWet = false;
      for (let x = x0; x <= x1; x++, i++){
        let w = W[i] + dW[i];
        if (w <= 0 && S[i] === 0 && dS[i] === 0){ W[i] = 0; dW[i] = 0; continue; }
        let s = S[i] + dS[i]; dW[i] = 0; dS[i] = 0;
        if (s < 0) s = 0;
        if (w > 0){
          w -= EVAP + (w < EDGE_T ? EDGE_EVAP : 0);
          if (w < MINW){ D[i] += s; s = 0; w = 0; }
          else {
            const dep = s * DEP * (1 + 0.12 / (w + 0.05));
            s -= dep; D[i] += dep;
            if (x < nx0) nx0 = x; if (x > nx1) nx1 = x; rowWet = true;
            if (T[i] < keep) T[i] = keep;
          }
        } else { w = 0; D[i] += s; s = 0; }
        W[i] = w; S[i] = s;
      }
      if (rowWet){ if (y < ny0) ny0 = y; ny1 = y; }
    }
    sim.markR(x0,y0,x1,y1);
    if (x0<fx0)fx0=x0; if (y0<fy0)fy0=y0; if (x1>fx1)fx1=x1; if (y1>fy1)fy1=y1;
    bx0 = nx0; by0 = ny0; bx1 = nx1; by1 = ny1;
  }

  // 연주 모드: 남겨 둘 시각이 지난 마른 먹을 k배로 옅게 한다 (한 장면에 한 번)
  function fade(k){
    if (fx0 > fx1) return;
    const now = sim.clock;
    let nx0 = GW, ny0 = GH, nx1 = -1, ny1 = -1;
    for (let y = fy0; y <= fy1; y++){
      let i = y*GW + fx0, row = false;
      for (let x = fx0; x <= fx1; x++, i++){
        const d = D[i];
        if (d === 0 && W[i] === 0) continue;
        if (W[i] === 0 && T[i] <= now){
          const nd = d * k;
          D[i] = nd < 0.004 ? 0 : nd;
          if (D[i] === 0) continue;
        }
        if (x < nx0) nx0 = x; if (x > nx1) nx1 = x; row = true;
      }
      if (row){ if (y < ny0) ny0 = y; ny1 = y; }
    }
    sim.markR(fx0, fy0, fx1, fy1);
    fx0 = nx0; fy0 = ny0; fx1 = nx1; fy1 = ny1;
  }

  clear();
  return sim;
}

// ---------- 붓 ----------
// 같은 획 기록을 넣으면 같은 붓질이 나오도록, 실시간과 다시 그리기가 이 함수를 같이 쓴다.
// keepUntil: 연주 모드에서 이 획의 먹을 남겨 둘 시각 (시뮬레이션 시계)
function makeBrush(st, sim, keepUntil = 0){
  const { W, S, D, T } = sim;
  const water = st.w/100, ink = st.i/100, size = st.s, deplete = st.d;
  const rnd = mulberry32(st.seed);
  const NB = clamp(Math.round(size/3), 12, 48), br0 = new Float32Array(NB), br = new Float32Array(NB);
  for (let k = 0; k < NB; k++) br0[k] = 0.25 + 0.75*rnd();
  const side = rnd() < 0.5 ? -1 : 1;   // 붓 한쪽에 먹이 더 많이 묻어 있음 → 한 획 안의 농담
  for (let k = 0; k < NB; k++) br[k] = (br0[Math.max(0,k-1)] + 2*br0[k] + br0[Math.min(NB-1,k+1)]) / 4;
  // 획을 따라 먹이 짙어졌다 옅어졌다 (60px 간격 값 잡음)
  const lat = new Float32Array(64); for (let k = 0; k < 64; k++) lat[k] = rnd();
  const along = d => { const t = d/60, k = t|0, f = t-k, sm = f*f*(3-2*f); return 0.72 + 0.4*(lat[k&63] + (lat[(k+1)&63]-lat[k&63])*sm); };
  let last = null, lastR = 0, dist = 0, speed = -1, gap = 0;

  function dab(x, y, r, nx, ny, d, sp){
    const gx = x/SC, gy = y/SC, gr = Math.max(0.7, r/SC);
    const load = deplete ? Math.max(0, 1 - d / (700 + 1800*water)) : 1;
    const wl = Math.max(0.03, water * Math.pow(load, 0.8));
    const dryness = Math.max(clamp(1 - wl/0.3, 0, 1), clamp(1 - load*3, 0, 1));
    const kpd = Math.min(1, sp / r);
    // 붓이 지나간 자리는 물·먹이 고르게 차오르고(목표치까지), 겹쳐 그으면 조금씩 더 짙어진다
    const wT = 1.25 * wl, wAdd = 0.35 * wl * kpd;
    const iT = 1.8 * Math.pow(ink, 1.5) * (0.5 + 0.55*wl) * (0.35 + 0.65*load) * along(d), iAdd = 0.22 * iT * kpd;
    const edgeDry = 0.55 * (1 - water*0.7);   // 붓 가장자리 털은 먼저 말라 거칠게 갈라짐
    const xa = Math.max(0, Math.floor(gx-gr)), xb = Math.min(GW-1, Math.ceil(gx+gr));
    const ya = Math.max(0, Math.floor(gy-gr)), yb = Math.min(GH-1, Math.ceil(gy+gr));
    if (xa > xb || ya > yb) return;
    const inv = 1/(gr*gr);
    for (let yy = ya; yy <= yb; yy++){
      const ddy = yy + 0.5 - gy;
      let i = yy*GW + xa;
      for (let xx = xa; xx <= xb; xx++, i++){
        const ddx = xx + 0.5 - gx, d2 = (ddx*ddx + ddy*ddy) * inv;
        if (d2 >= 1) continue;
        // 가장자리는 종이 결 따라 들쭉날쭉, 안쪽은 고르게 꽉 찬 붓 모양
        const de = d2 * (1.18 - 0.36*G[i]);
        if (de >= 1) continue;
        let f = 1 - de*de*de;
        const u = (ddx*nx + ddy*ny) / gr;
        const b = br[clamp(((u+1)*0.5*(NB-1) + 0.5)|0, 0, NB-1)];
        const u4 = u*u*u*u, dry = Math.max(dryness, edgeDry*u4);
        if (dry > 0){
          const v = b*0.6 + (A[i]-0.4)/1.2*0.32 + G[i]*0.08;
          if (v < dry*0.62) continue;
          f *= Math.min(1, (v - dry*0.62) * 4);
        }
        const ib = (0.35 + 0.65*b) * clamp(0.75 + 0.45*u*side, 0.3, 1.2);
        const w = W[i], tw = wT*f;
        W[i] = Math.min(WMAX, w + (tw > w ? (tw - w)*0.5 : 0) + wAdd*f);
        const si = S[i] + D[i]*0.5, ts = iT*f*ib;
        S[i] += (ts > si ? (ts - si)*0.5 : 0) + iAdd*f*ib;
        if (T[i] < keepUntil) T[i] = keepUntil;
      }
    }
    sim.markB(xa,ya,xb,yb); sim.markR(xa,ya,xb,yb);
  }

  return {
    add(pt){
      if (!last){
        last = pt; lastR = Math.max(1, size*0.5*0.35);
        dab(pt.x, pt.y, lastR, 0, 1, 0, lastR*0.5);
        return;
      }
      const dx = pt.x - last.x, dy = pt.y - last.y, len = Math.hypot(dx, dy);
      if (len < 0.75){
        // 붓을 멈추고 누르고 있으면 먹물이 고여 번진다
        const hold = pt.t - last.t;
        if (hold >= 30){
          const k = Math.min(3, hold/33);
          lastR = Math.min(size*0.9, lastR + 0.5*k);
          dab(last.x, last.y, lastR, 0, 1, dist, lastR*0.12*k);
          last = { x: last.x, y: last.y, t: pt.t, p: last.p };
        }
        return;
      }
      const v = len / Math.max(1, pt.t - last.t);
      speed = speed < 0 ? v : speed*0.75 + v*0.25;
      const pf = pt.p >= 0 ? 0.2 + 0.95*pt.p : clamp(1.2 - speed*0.5, 0.3, 1.15);
      const taper = Math.min(1, 0.3 + dist/50);
      const tR = Math.max(1, size*0.5*pf*taper);
      const nx = -dy/len, ny = dx/len;
      let s = gap;
      while (s <= len){
        const k = s/len, r = lastR + (tR - lastR)*k;
        const sp = Math.max(SC*0.45, r*0.22);
        dab(last.x + dx*k, last.y + dy*k, r, nx, ny, dist + s, sp);
        s += sp;
      }
      gap = s - len; dist += len; lastR = tR; last = pt;
    }
  };
}

// ---------- 다시 그리기 ----------
// 획 기록 묶음을 시간에 맞춰 붓에 넣는다. advance(ms)로 시계를 앞으로 돌린다.
function strokesLength(strokes){
  let end = 0;
  for (const st of strokes){ const p = st.pts[st.pts.length-1]; end = Math.max(end, st.t0 + (p ? p[2] : 0)); }
  return end;
}
function makeReplay(strokes, sim, keepUntil = 0){
  const brushes = strokes.map(() => null), ptr = strokes.map(() => 0);
  let el = 0;
  return {
    duration: strokesLength(strokes),
    done: false,
    // 시계를 el(ms)까지 돌린다. 다 그렸으면 true
    to(t){
      el = t;
      let done = true;
      strokes.forEach((st, k) => {
        if (ptr[k] >= st.pts.length) return;
        done = false;
        if (st.t0 > el) return;
        if (!brushes[k]) brushes[k] = makeBrush(st, sim, keepUntil);
        const br = brushes[k];
        while (ptr[k] < st.pts.length){
          const a = st.pts[ptr[k]];
          if (st.t0 + a[2] > el) break;
          br.add({ x: a[0], y: a[1], t: a[2], p: a[3] });
          ptr[k]++;
        }
      });
      this.done = done;
      return done;
    },
  };
}

// 화면에 보이지 않게, 획 기록을 처음부터 빠르게 다시 그린다 (마르는 시간 dryMs까지 포함)
function bake(strokes, sim, dryMs = 1500){
  sim.clear();
  const rp = makeReplay(strokes, sim);
  let t = 0;
  const end = rp.duration + dryMs;
  while (true){
    const done = rp.to(t);
    sim.step();
    t += STEP_MS;
    if (done && (t > end || !sim.wet())) break;
    if (t > end + 60000) break;
  }
  sim.render();
}

window.Ink = { LW, LH, SC, GW, GH, STEP_MS, drawPaper, mulberry32, makeSim, makeBrush, makeReplay, bake, strokesLength };
})();
