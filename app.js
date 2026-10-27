(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const GRID = "qwertyuiopasdfghjklzxcvbnm".split("");      // 터치 칸·링크 순서 (1편과 같다)
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
// 화면에는 두벌식 한글 자판 글자로 보여 준다 (동작은 1편처럼 자판 자리 e.code 기준)
const JAMO = Object.fromEntries(GRID.map((c, i) => [c, "ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔㅁㄴㅇㄹㅎㅗㅓㅏㅣㅋㅌㅊㅍㅠㅜㅡ"[i]]));
const MOBILE = window.matchMedia("(pointer: coarse)").matches;
const MAX_REPLAYS = MOBILE ? 6 : 12;   // 연주 때 동시에 다시 그려지는 그림 수 (1편 동시 영상 상한과 같다)
const VOICES_PER_KEY = 8;
const KEEP_MS = 900;                   // 다 그려진 그림이 사라지기 시작할 때까지
const FADE_K = 0.92;                   // 수묵: 한 장면마다 남는 먹 (약 1초에 걸쳐 사라진다)
const FADE_MS = 1000;                  // 단청·자개: 사라지는 데 걸리는 시간
const RATE_MIN = 0.25, RATE_MAX = 8;   // 소리 길이에 맞출 때 빠르기 한도
const STORE = "ddgmaker-work-v2", OLD_STORE = "ddgmaker-work-v1", THUMBS = "ddgmaker-thumbs-v3";
const SOUND_BY_ID = new Map(SOUNDS.map((s, i) => [s.id, { ...s, index: i }]));
const { LW, LH, STEP_MS } = Ink;

// 뱅크: 만들기는 1~3, 연주할 때는 4 섞음이 더 붙는다 (스페이스바 / 오른쪽 아래 칸으로 넘긴다)
const BANKS = [
  { name: "수묵", kind: "ink", tone: "ink" },
  { name: "단청", kind: "dc", tone: "white", engine: Patterns.dancheong },
  { name: "자개", kind: "jg", tone: "black", engine: Patterns.jagae },
];
const MIX = { name: "섞음", kind: "mix", tone: "gray" };
const NB = BANKS.length;

// ---------- 작품 ----------
// work = { title, banks: [ { keys: { g: { snd, fit, strokes: [...] } } } × 3 ] }
// 수묵은 획 { w, i, s, d, seed, t0, pts }, pts = [[x, y, t, p], ...] (x·y는 0.5px 단위, t는 ms, p는 펜 압력 또는 -1)
// 단청·자개는 찍은 문양 { m, x, y, s, r, a, t0 } (patterns.js) — 같은 strokes 자리에 담는다
function emptyBank(b){
  const keys = {};
  for (const c of GRID) keys[c] = { snd: null, fit: true, strokes: [] };
  for (const s of SOUNDS) if (s.bank === b && keys[s.key]) keys[s.key].snd = s.id;
  return { keys };
}
function emptyWork(){ return { title: "", banks: BANKS.map((_, b) => emptyBank(b)) }; }
function normalize(w){
  const out = emptyWork();
  if (!w) return out;
  out.title = typeof w.title === "string" ? w.title.slice(0, 30) : "";
  const banks = Array.isArray(w.banks) ? w.banks : w.keys ? [{ keys: w.keys }] : [];   // 예전 작품(뱅크 1개)은 수묵으로
  banks.slice(0, NB).forEach((bk, b) => {
    for (const c of GRID){
      const k = bk && bk.keys && bk.keys[c];
      if (!k) continue;
      let strokes = Array.isArray(k.strokes) ? k.strokes : [];
      if (BANKS[b].engine) strokes = strokes.filter(validStamp(b));   // 예전 단청·자개 붓 그림은 버린다
      out.banks[b].keys[c] = { snd: SOUND_BY_ID.has(k.snd) ? k.snd : null, fit: k.fit !== false, strokes };
    }
  });
  return out;
}
function validStamp(b){
  const n = MOTIFS[BANKS[b].kind].length;
  return (st) => st && Number.isInteger(st.m) && st.m >= 0 && st.m < n && [st.x, st.y, st.s, st.r, st.t0].every(Number.isFinite);
}
const keyOf = (w, b, c) => w.banks[b].keys[c];
const lenOf = (b, strokes) => (BANKS[b].engine ? Patterns.stampsLength(strokes) : Ink.strokesLength(strokes));
const hasDrawing = (w) => w.banks.some((bk) => GRID.some((c) => bk.keys[c].strokes.length));

let work, thumbs;
try {
  const raw = localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE);
  work = normalize(JSON.parse(raw || "null"));
} catch (_) { work = emptyWork(); }
try { thumbs = JSON.parse(localStorage.getItem(THUMBS) || "{}") || {}; } catch (_) { thumbs = {}; }
let saveTimer = 0;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(work)); } catch (_) { toast("저장할 자리가 모자라네"); }
    try { localStorage.setItem(THUMBS, JSON.stringify(thumbs)); } catch (_) {}
  }, 300);
}

let shared = null;       // 링크로 받은 작품
let playing = null;      // 지금 연주하는 작품
let mode = "start";      // start → make / play

// ---------- 알림 ----------
let toastT = 0;
function toast(msg, sec = 1.6){
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), sec * 1000);
}

// ---------- 소리 (둥당기 1편과 같은 방식) ----------
const audio = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
const master = audio.createGain();
master.connect(audio.destination);
const buffers = new Map(), loading = new Map(), voices = new Map();

async function loadSoundBytes(path){
  const b64 = location.protocol === "file:" && window.SOUND_DATA && window.SOUND_DATA[path];
  if (b64) return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} (${res.status})`);
  return res.arrayBuffer();
}
const decode = (bytes) => new Promise((ok, no) => audio.decodeAudioData(bytes, ok, no));
function ensureSound(id){
  if (!id || buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (!loading.has(id)){
    loading.set(id, loadSoundBytes(`sounds/${id}.m4a`).then(decode).then((b) => { buffers.set(id, b); refreshFit(); return b; })
      .catch((err) => { loading.delete(id); throw err; }));
  }
  return loading.get(id);
}
function soundSec(id){ const b = id && buffers.get(id); return b ? b.duration : 0; }

function playSound(id, key){
  const buf = buffers.get(id);
  if (!buf) return;
  if (audio.state !== "running") audio.resume();
  const src = audio.createBufferSource();
  src.buffer = buf; src.connect(master); src.start();
  const list = voices.get(key) || []; voices.set(key, list);
  list.push(src);
  src.onended = () => { const i = list.indexOf(src); if (i >= 0) list.splice(i, 1); };
  if (list.length > VOICES_PER_KEY) list.shift().stop();
}

// 휴대폰은 손가락을 뗄 때에만 소리를 켤 수 있다. 아이폰 무음 스위치와 상관없이 소리가 나게 한다.
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (_) {}
let unlocked = false, sessionAudio = null;
function unlockAudio(){
  if (audio.state !== "running"){ const p = audio.resume(); if (p && p.catch) p.catch(() => {}); }
  if (unlocked && audio.state === "running") return;
  const s = audio.createBufferSource();
  s.buffer = audio.createBuffer(1, 1, 22050); s.connect(audio.destination); s.start(0);
  if (!sessionAudio && !navigator.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && "ontouchend" in document){
    sessionAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=");
    sessionAudio.setAttribute("playsinline", "");
    const p = sessionAudio.play(); if (p && p.catch) p.catch(() => {});
  }
  unlocked = true;
}
for (const type of ["touchend", "pointerup", "click", "keydown"]) window.addEventListener(type, unlockAudio, { capture: true, passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audio.state !== "running"){ const p = audio.resume(); if (p && p.catch) p.catch(() => {}); }
});

// 소리는 처음에 다 받아 둔다 (소리 길이를 알아야 빠르기를 맞출 수 있다). 수묵 뱅크부터.
[0, 1, 2].reduce((p, b) => p.then(() => Promise.all(SOUNDS.filter((s) => s.bank === b).map((s) => ensureSound(s.id)))), Promise.resolve())
  .catch((err) => {
    const hint = location.protocol === "file:" ? " (소리를 바꿨다면 python3 tools/make_sounds_js.py 를 한 번 실행하시게)" : "";
    toast(`불러오지 못한 소리가 있네: ${err.message}${hint}`, 8);
  });

// ---------- 종이 ----------
// 뱅크마다 바탕 종이가 다르다: 수묵 누런 한지, 단청 흰 한지, 자개 검은 한지, 섞음 회색.
// 수묵은 먹이 번지는 격자(ic), 단청·자개는 그림 판(vc)에 그린다.
const stage = $("stage"), ic = $("inkc"), vc = $("vecc"), hint = $("hint");
const vctx = vc.getContext("2d");
vc.width = LW; vc.height = LH;
const papers = {};
for (const t of ["ink", "white", "black", "gray"]){
  const pc = document.createElement("canvas"); pc.className = "paper"; pc.dataset.tone = t;
  Ink.drawPaper(pc, t); stage.insertBefore(pc, ic); papers[t] = pc;
}
const sim = Ink.makeSim(ic);
const bakeSim = Ink.makeSim(document.createElement("canvas"));   // 미리보기 그림 굽기용 (화면에 안 보임)

function showBankOnStage(bank){   // bank: BANKS[b] 또는 MIX
  for (const t in papers) papers[t].hidden = t !== bank.tone;
  ic.hidden = !(bank.kind === "ink" || bank.kind === "mix");
  vc.hidden = bank.kind === "ink";
  stage.classList.toggle("mix", bank.kind === "mix");   // 섞음: 수묵 먹을 흰 먹으로
  stage.dataset.tone = bank.tone; $("play").dataset.tone = bank.tone;
}

// ---------- 다시 그리기 ----------
// 수묵: 시뮬레이션 시계에 맞춰 붓에 획을 넣는다. 단청·자개: 그림 판(layer)마다 따로 그린다.
// rate > 1 이면 빠르게.
let replays = [];    // 수묵 { rp, start, rate }
let vreplays = [];   // 단청·자개 { rp, L, engine, start, rate, keep, done }
function addReplay(strokes, rate, keep){
  if (!strokes.length) return;
  replays.push({ rp: Ink.makeReplay(strokes, sim, keep), start: sim.clock, rate });
  while (replays.length > MAX_REPLAYS) replays.shift();
}
function addVReplay(engine, strokes, rate, keep, L){
  if (!strokes.length) return null;
  L = L || engine.newLayer();
  const r = { rp: Patterns.makeReplay(engine, strokes, L), L, engine, start: sim.clock, rate, keep, done: false };
  vreplays.push(r);
  while (vreplays.length > MAX_REPLAYS) vreplays.shift();
  return r;
}
function tickReplays(){
  if (replays.length) replays = replays.filter((r) => !r.rp.to((sim.clock - r.start) * r.rate));
  for (const r of vreplays) if (!r.done) r.done = r.rp.to((sim.clock - r.start) * r.rate);
  if (mode === "make" && vreplays.length) vreplays = vreplays.filter((r) => !r.done);   // 만들기 화면은 그림 판에 남아 있으니 목록에서 뺀다
}
// 남은 붓질을 한꺼번에 끝낸다 (만들기 화면에서 다시 그리는 중에 붓을 대면)
function finishReplays(){
  let guard = 0;
  while (replays.length && guard++ < 20000){ tickReplays(); sim.step(); }
  replays = [];
  for (const r of vreplays) if (!r.done) r.done = r.rp.to(Infinity);
  vreplays = vreplays.filter((r) => r.keep);   // 만들기 화면의 다시 그리기는 끝낸 뒤 목록에서 뺀다
}

function rateFor(k, b){
  if (!k.fit) return 1;
  const len = lenOf(b, k.strokes), sec = soundSec(k.snd);
  if (!len || !sec) return 1;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, len / (sec * 1000)));
}

// ---------- 매 장면 ----------
let acc = 0, lastT = performance.now();
function frame(now){
  acc += Math.min(50, now - lastT); lastT = now;
  if (active && !active.stamp && now - active.lastMove > 33){          // 멈춰 있는 붓도 기록
    const ev = active.lastEv;
    addPt({ clientX: ev.clientX, clientY: ev.clientY, pointerType: ev.pointerType, pressure: ev.pressure, timeStamp: now - active.tsOff });
  }
  // 느린 기기에서는 한 장면에 8ms까지만 계산하고, 나머지는 천천히 마르게 둔다
  let n = 0;
  const t0 = performance.now();
  while (acc >= STEP_MS && n < 4){
    tickReplays(); sim.step(); acc -= STEP_MS; n++;
    if (performance.now() - t0 > 8){ acc = 0; break; }
  }
  if (n === 4) acc = 0;
  if (mode === "play") sim.fade(FADE_K);
  sim.render();
  drawVec(now);
  if (mode === "make") bakeNextThumb();
  requestAnimationFrame(frame);
}

// 단청·자개 그림 판을 화면에 옮긴다
function drawVec(now){
  if (vc.hidden) return;
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.clearRect(0, 0, LW, LH);
  if (mode === "make"){
    if (editLayer && BANKS[editBank].engine) BANKS[editBank].engine.draw(vctx, editLayer, now);
    return;
  }
  vreplays = vreplays.filter((r) => {
    const a = r.done && sim.clock > r.keep ? 1 - (sim.clock - r.keep) / FADE_MS : 1;
    if (a <= 0) return false;
    vctx.globalAlpha = a;
    r.engine.draw(vctx, r.L, now);
    return true;
  });
  vctx.globalAlpha = 1;
}

// ---------- 미리보기 그림 ----------
const thumbCanvas = document.createElement("canvas");
thumbCanvas.width = 240; thumbCanvas.height = 150;
const tctx = thumbCanvas.getContext("2d");
const tkey = (b, c) => b + c;
function thumbOfCanvas(canvas){
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, 240, 150);
  tctx.drawImage(canvas, 0, 0, 240, 150);
  return thumbCanvas.toDataURL("image/png");
}
// 문양은 setTransform으로 그리므로 큰 판에 그린 뒤 줄여서 옮긴다
const bigCanvas = Object.assign(document.createElement("canvas"), { width: LW, height: LH });
function thumbOfLayer(engine, L){
  const g = bigCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, LW, LH);
  engine.draw(g, L, performance.now());
  return thumbOfCanvas(bigCanvas);
}
function bakeThumb(b, strokes){
  const bank = BANKS[b];
  if (bank.kind === "ink"){ Ink.bake(strokes, bakeSim); return thumbOfCanvas(bakeSim.canvas); }
  if (!Patterns.ready()) return null;
  const L = bank.engine.newLayer();
  Patterns.makeReplay(bank.engine, strokes, L).to(Infinity);
  return thumbOfLayer(bank.engine, L);
}
let thumbTimer = 0;
function scheduleThumb(b, code){
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    if (mode !== "make" || editBank !== b || cur[b] !== code) return;
    if (active || replays.length || vreplays.length) return scheduleThumb(b, code);   // 그리는 중이면 조금 뒤에
    if (BANKS[b].kind === "ink"){ sim.render(); setThumb(b, code, thumbOfCanvas(ic)); }
    else setThumb(b, code, thumbOfLayer(BANKS[b].engine, editLayer));
  }, BANKS[b].kind === "ink" ? 1200 : Patterns.ANIM_MS + 100);
}
function setThumb(b, code, url){
  if (url) thumbs[tkey(b, code)] = url; else delete thumbs[tkey(b, code)];
  save(); if (b === editBank) drawTile(code);
}
// 미리보기가 없는 자판(링크로 받은 작품 등)은 쉬는 장면마다 하나씩 굽는다
function bakeNextThumb(){
  for (let b = 0; b < NB; b++){
    const code = GRID.find((c) => keyOf(work, b, c).strokes.length && !thumbs[tkey(b, c)] && !(b === editBank && c === cur[b]));
    if (code){ const t = bakeThumb(b, keyOf(work, b, code).strokes); if (t) setThumb(b, code, t); return; }
  }
}

// ---------- 만들기 화면 ----------
let editBank = 0;
const cur = ["g", "g", "g"];
let editLayer = null;   // 단청·자개: 지금 자판의 그림 판

// 붓 설정: 수묵
const ui = { water: $("water"), ink: $("ink"), size: $("size"), deplete: $("deplete") };
const presetBtns = [...$("presets").children];
function showVals(){
  $("waterV").textContent = ui.water.value; $("inkV").textContent = ui.ink.value; $("sizeV").textContent = ui.size.value;
  for (const b of presetBtns) b.classList.toggle("on", b.dataset.w === ui.water.value && b.dataset.i === ui.ink.value);
}
for (const k of ["water", "ink", "size"]) ui[k].addEventListener("input", showVals);
function applyPreset(b){ ui.water.value = b.dataset.w; ui.ink.value = b.dataset.i; showVals(); }
presetBtns.forEach((b) => b.addEventListener("click", () => applyPreset(b)));
showVals();

// 문양 찍기 설정: 뱅크마다 고른 문양과 움직임을 따로 기억한다
const mt = [null, { m: 0, a: 0 }, { m: 0, a: 0 }];
const mtSize = $("mt-size"), mtRot = $("mt-rot");
function buildMotifTools(b){
  const kind = BANKS[b].kind, box = $("mt-pick");
  box.innerHTML = ""; box.dataset.kind = kind;
  MOTIFS[kind].forEach((m, i) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.title = m.name;
    btn.innerHTML = `<img alt="" src="${Patterns.img(m.id).src}"><span>${m.name}</span>`;
    btn.addEventListener("click", () => { mt[b].m = i; drawMotifTools(); });
    box.appendChild(btn);
  });
  drawMotifTools();
}
(function buildAnimTools(){
  const box = $("mt-anim");
  Patterns.ANIMS.forEach((an, i) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = an.name;
    btn.addEventListener("click", () => { if (editBank) { mt[editBank].a = i; drawMotifTools(); } });
    box.appendChild(btn);
  });
})();
function drawMotifTools(){
  const sel = mt[editBank];
  if (!sel) return;
  [...$("mt-pick").children].forEach((btn, i) => btn.classList.toggle("on", i === sel.m));
  [...$("mt-anim").children].forEach((btn, i) => btn.classList.toggle("on", i === sel.a));
  $("mt-sizeV").textContent = mtSize.value; $("mt-rotV").textContent = mtRot.value + "°";
}
mtSize.addEventListener("input", drawMotifTools);
mtRot.addEventListener("input", drawMotifTools);

// 뱅크 고르기
const bankTabs = [...$("bank-tabs").children];
bankTabs.forEach((t, b) => t.addEventListener("click", () => selectBank(b)));
function selectBank(b){
  if (active) endStroke({ pointerId: active.id });
  finishReplays(); vreplays = [];
  editBank = b; lastEndReal = 0;
  bankTabs.forEach((t, i) => t.classList.toggle("on", i === b));
  for (const el of document.querySelectorAll("[data-tools]")) el.hidden = el.dataset.tools !== (BANKS[b].engine ? "stamp" : "ink");
  if (BANKS[b].engine) buildMotifTools(b);
  $("maker").dataset.bank = b;
  hint.textContent = BANKS[b].engine ? "문양을 골라 종이에 찍어 보시게 (누른 채 끌면 크기와 돌림이 바뀐다네)" : "여기에 붓으로 그려 보시게";
  $("side-tip").textContent = "소리를 누르면 미리 들어 볼 수 있다네. 고른 뒤에는 왼쪽 종이에 이 소리에 어울리는 " + (BANKS[b].engine ? "문양을 찍어 보시게." : "붓질을 그려 보시게.");
  showBankOnStage(BANKS[b]);
  buildSoundPick();
  showKeyDrawing(cur[b]); drawTiles(); drawSide();
}

const tiles = {};
(function buildKeyboard(){
  const box = $("keyboard");
  ROWS.forEach((row, ri) => {
    const r = document.createElement("div"); r.className = `krow r${ri + 1}`;
    for (const c of row){
      const el = document.createElement("div"); el.className = "kt";
      el.innerHTML = `<img alt="" hidden><b>${JAMO[c]}</b><span></span>`;
      el.addEventListener("click", () => { selectKey(c); preview(c); });
      r.appendChild(el); tiles[c] = el;
    }
    box.appendChild(r);
  });
})();
function drawTile(c){
  const el = tiles[c], k = keyOf(work, editBank, c), img = el.querySelector("img");
  const t = k.strokes.length && thumbs[tkey(editBank, c)];
  img.hidden = !t; if (t) img.src = t;
  el.classList.toggle("drawn", !!k.strokes.length);
  el.querySelector("span").textContent = k.snd ? SOUND_BY_ID.get(k.snd).name : "";
  el.classList.toggle("sel", c === cur[editBank]);
}
const drawTiles = () => GRID.forEach(drawTile);

function buildSoundPick(){
  const box = $("sound-pick"); box.innerHTML = "";
  for (const g of SOUND_GROUPS[editBank]){
    const d = document.createElement("div"); d.className = "grp";
    d.innerHTML = `<span>${g}</span><div class="chips"></div>`;
    const list = SOUNDS.filter((s) => s.bank === editBank && s.group === g)
      .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
    for (const s of list){
      const b = document.createElement("button"); b.type = "button"; b.textContent = s.name; b.dataset.id = s.id;
      b.addEventListener("click", () => chooseSound(s.id));
      d.lastChild.appendChild(b);
    }
    box.appendChild(d);
  }
  const d = document.createElement("div"); d.className = "grp";
  d.innerHTML = `<div class="chips"><button type="button" data-id="">소리 없음</button></div>`;
  d.querySelector("button").addEventListener("click", () => chooseSound(null));
  box.appendChild(d);
}
function drawSide(){
  const c = cur[editBank], k = keyOf(work, editBank, c);
  $("cur-key").textContent = JAMO[c];
  const s = k.snd && SOUND_BY_ID.get(k.snd);
  $("cur-sound").textContent = s ? `${s.group} ${s.name}` : "소리 없음";
  for (const b of $("sound-pick").querySelectorAll("button")) b.classList.toggle("on", (b.dataset.id || null) === k.snd);
  $("fit").checked = k.fit;
  refreshFit();
  $("undo").disabled = $("clear-key").disabled = $("replay").disabled = !k.strokes.length;
  $("redo").disabled = !(redoStack[tkey(editBank, cur[editBank])] || []).length;
}
function refreshFit(){
  if (mode !== "make") return;
  const k = keyOf(work, editBank, cur[editBank]);
  const len = lenOf(editBank, k.strokes) / 1000, sec = soundSec(k.snd);
  $("dur").textContent = k.strokes.length ? `그림 ${len.toFixed(1)}초` : "";
  let info = "";
  if (!k.strokes.length) info = "그림을 그리면 여기에 빠르기가 나온다네.";
  else if (!k.snd) info = "소리가 없으니 그린 빠르기 그대로 다시 그린다네.";
  else if (!sec) info = "";
  else if (!k.fit) info = `그린 빠르기 그대로 ${len.toFixed(1)}초 동안 그린다네. (소리 ${sec.toFixed(1)}초)`;
  else {
    const r = rateFor(k, editBank), shown = len / r;
    const how = Math.abs(r - 1) < 0.05 ? "그린 빠르기 그대로" : r > 1 ? `${r.toFixed(1)}배 빠르게` : `${(1 / r).toFixed(1)}배 느리게`;
    info = `소리 ${sec.toFixed(1)}초에 맞추어 ${how} 그린다네` + (Math.abs(shown - sec) > 0.15 ? ` (${shown.toFixed(1)}초, 더는 못 맞춘다네)` : "") + ".";
  }
  $("fit-info").textContent = info;
}
$("fit").addEventListener("change", () => { keyOf(work, editBank, cur[editBank]).fit = $("fit").checked; save(); refreshFit(); });

function chooseSound(id){
  const c = cur[editBank];
  keyOf(work, editBank, c).snd = id; save();
  drawSide(); drawTile(c);
  if (id) ensureSound(id).then(() => playSound(id, editBank + c));
}

function showKeyDrawing(code){
  replays = []; vreplays = []; sim.fading = false;
  const st = keyOf(work, editBank, code).strokes, bank = BANKS[editBank];
  if (bank.kind === "ink"){
    editLayer = null;
    if (st.length) Ink.bake(st, sim, 300); else sim.clear();
  } else {
    editLayer = bank.engine.newLayer();
    Patterns.makeReplay(bank.engine, st, editLayer).to(Infinity);
  }
  hint.style.opacity = st.length ? 0 : 1;
}
function selectKey(code){
  if (code === cur[editBank] && mode === "make") return;
  if (active) endStroke({ pointerId: active.id });
  cur[editBank] = code; lastEndReal = 0;
  showKeyDrawing(code);
  drawTiles(); drawSide();
}
// 자판 들어 보기: 소리와 함께 그림을 처음부터 다시 그린다 (연주 때와 같은 빠르기)
function preview(code){
  const k = keyOf(work, editBank, code), bank = BANKS[editBank];
  if (k.snd) playSound(k.snd, editBank + code);
  if (!k.strokes.length) return;
  replays = []; vreplays = []; hint.style.opacity = 0;
  if (bank.kind === "ink"){ sim.fading = false; sim.clear(); addReplay(k.strokes, rateFor(k, editBank), 0); }
  else { bank.engine.clear(editLayer); addVReplay(bank.engine, k.strokes, rateFor(k, editBank), 0, editLayer); }
  tiles[code].classList.add("flash"); setTimeout(() => tiles[code].classList.remove("flash"), 300);
}

$("replay").addEventListener("click", () => preview(cur[editBank]));
// 되돌리기·다시 하기: 되돌린 획·문양은 자판마다 따로 모아 두고, 새로 그리거나 찍으면 버린다.
const redoStack = {};
function undo(){
  const b = editBank, c = cur[b], k = keyOf(work, b, c);
  if (!k.strokes.length) return;
  if (active) endStroke({ pointerId: active.id });
  finishReplays();
  (redoStack[tkey(b, c)] = redoStack[tkey(b, c)] || []).push(k.strokes.pop());
  save();
  if (BANKS[b].engine){ BANKS[b].engine.pop(editLayer); hint.style.opacity = k.strokes.length ? 0 : 1; }
  else showKeyDrawing(c);
  setThumb(b, c, k.strokes.length ? bakeThumb(b, k.strokes) : null); drawSide();
  lastEndReal = 0;
}
function redo(){
  const b = editBank, c = cur[b], k = keyOf(work, b, c), stack = redoStack[tkey(b, c)];
  if (!stack || !stack.length) return;
  if (active) endStroke({ pointerId: active.id });
  finishReplays();
  const st = stack.pop();
  k.strokes.push(st); save();
  if (BANKS[b].engine){ BANKS[b].engine.add(editLayer, st, performance.now()); hint.style.opacity = 0; }   // 문양은 다시 나타나는 움직임을 보여 준다
  else showKeyDrawing(c);
  drawSide(); drawTile(c); scheduleThumb(b, c);
  lastEndReal = 0;
}
$("undo").addEventListener("click", undo);
$("redo").addEventListener("click", redo);
$("clear-key").addEventListener("click", () => {
  const c = cur[editBank], k = keyOf(work, editBank, c); if (!k.strokes.length) return;
  if (!confirm(`${JAMO[c]} 자판의 ${BANKS[editBank].engine ? "문양" : "그림"}을 모두 지우겠는가?`)) return;
  k.strokes = []; delete redoStack[tkey(editBank, c)]; save(); showKeyDrawing(c); setThumb(editBank, c, null); drawSide();
});
$("title").addEventListener("input", () => { work.title = $("title").value.slice(0, 30); save(); });

// ---------- 붓으로 그리기 (시제품과 같은 기록 방식, 좌표는 0.5px 단위로 맞춰 링크에 그대로 담기게) ----------
let active = null, lastEndReal = 0;
function stagePoint(ev){
  const r = stage.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * LW, y: (ev.clientY - r.top) / r.height * LH };
}
stage.addEventListener("pointerdown", (e) => {
  if (mode !== "make" || active) return;
  e.preventDefault();
  if (replays.length || vreplays.length) finishReplays();
  try { stage.setPointerCapture(e.pointerId); } catch (_){}
  hint.style.opacity = 0;
  const b = editBank, bank = BANKS[b], strokes = keyOf(work, b, cur[b]).strokes;
  const now = performance.now();
  if (bank.engine){ startStamp(e, b, strokes, now); return; }
  let t0 = 0;
  if (strokes.length){
    const prev = strokes[strokes.length - 1];
    const prevEnd = prev.t0 + (prev.pts.length ? prev.pts[prev.pts.length - 1][2] : 0);
    t0 = prevEnd + Math.min(450, lastEndReal ? now - lastEndReal : 450);   // 쉬는 시간은 짧게 줄여서 저장
  }
  t0 = Math.round(t0);
  const st = { w: +ui.water.value, i: +ui.ink.value, s: +ui.size.value, d: ui.deplete.checked ? 1 : 0, seed: (Math.random() * 1e9) | 0, t0, pts: [] };
  const brush = Ink.makeBrush(st, sim);
  strokes.push(st);
  delete redoStack[tkey(b, cur[b])];
  active = { st, brush, ts0: e.timeStamp, tsOff: now - e.timeStamp, id: e.pointerId, b, code: cur[b] };
  addPt(e);
});
// 문양 찍기: 누른 자리에 찍고, 누른 채 끌면 끈 길이만큼 크기, 끈 방향만큼 돌림이 바뀐다.
// 나타나는 때(t0)는 앞 문양을 찍은 뒤 쉰 시간 (GAP_MIN~GAP_MAX 안으로 줄인다)
function startStamp(e, b, stamps, now){
  const p = stagePoint(e), sel = mt[b];
  let t0 = 0;
  if (stamps.length){
    const gap = lastEndReal ? now - lastEndReal : 300;
    t0 = stamps[stamps.length - 1].t0 + Math.min(Patterns.GAP_MAX, Math.max(Patterns.GAP_MIN, gap));
  }
  const st = { m: sel.m, x: Math.round(p.x), y: Math.round(p.y), s: +mtSize.value, r: +mtRot.value, a: sel.a, t0: Math.round(t0) };
  stamps.push(st);
  delete redoStack[tkey(b, cur[b])];
  BANKS[b].engine.add(editLayer, st, now);
  lastEndReal = now;
  active = { stamp: true, st, x0: p.x, y0: p.y, s0: st.s, r0: st.r, id: e.pointerId, b, code: cur[b] };
}
function moveStamp(e){
  const p = stagePoint(e), A = active, dx = p.x - A.x0, dy = p.y - A.y0, d = Math.hypot(dx, dy);
  if (d < 14){ A.st.s = A.s0; A.st.r = A.r0; return; }
  A.st.s = Math.round(Math.min(900, Math.max(30, d * 2)));
  A.st.r = Math.round(((A.r0 + Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360);
}
function addPt(ev){
  const p = stagePoint(ev);
  const pt = { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2,
               t: Math.max(0, Math.round(ev.timeStamp - active.ts0)),
               p: ev.pointerType === "pen" ? Math.round(ev.pressure * 100) / 100 : -1 };
  active.st.pts.push([pt.x, pt.y, pt.t, pt.p]);
  active.brush.add(pt);
  active.lastMove = performance.now(); active.lastEv = ev;
}
stage.addEventListener("pointermove", (e) => {
  if (!active || e.pointerId !== active.id) return;
  if (active.stamp){ moveStamp(e); return; }
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) addPt(ev);
});
function endStroke(e){
  if (!active || e.pointerId !== active.id) return;
  const { b, code } = active;
  if (!active.stamp) lastEndReal = performance.now();
  active = null;
  save(); drawSide(); drawTile(code); scheduleThumb(b, code);
}
stage.addEventListener("pointerup", endStroke);
stage.addEventListener("pointercancel", endStroke);

// ---------- 연주 ----------
let playFrom = "make", playBank = 0, mixMap = null;
function enterPlay(w, from){
  playing = w; playFrom = from;
  if (active) endStroke({ pointerId: active.id });
  mode = "play";
  $("maker").hidden = true; $("play").hidden = false;
  $("play").appendChild(stage);
  hint.style.opacity = 0;
  setPlayBank(0, false);
  for (const bk of playing.banks) for (const c of GRID) ensureSound(bk.keys[c].snd).catch(() => {});
}
// 섞음: 들어올 때마다 뱅크 1·2·3에서 9·9·8개(8개 뱅크는 무작위)를 겹치지 않게 골라 26자판에 섞어 놓는다.
// 그림이 있는 자판을 먼저 고르고, 모자라면 소리만 있는 자판으로 채운다.
function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makeMix(w){
  const pools = BANKS.map((_, b) => {
    const drawn = shuffle(GRID.filter((c) => keyOf(w, b, c).strokes.length));
    const soundOnly = shuffle(GRID.filter((c) => !keyOf(w, b, c).strokes.length && keyOf(w, b, c).snd));
    return drawn.concat(soundOnly).map((c) => ({ b, c }));
  });
  const counts = [9, 9, 9]; counts[Math.floor(Math.random() * 3)] = 8;
  let picked = [];
  pools.forEach((p, b) => picked.push(...p.splice(0, counts[b])));
  const rest = shuffle(pools.flat());
  while (picked.length < GRID.length && rest.length) picked.push(rest.pop());
  picked = shuffle(picked);
  const map = {};
  GRID.forEach((key, i) => { if (picked[i]) map[key] = picked[i]; });
  return map;
}
let labelT = 0;
function setPlayBank(b, label = true){
  playBank = b;
  replays = []; vreplays = []; sim.clear(); sim.fading = true;
  const bank = b < NB ? BANKS[b] : MIX;
  if (bank.kind === "mix") mixMap = makeMix(playing);
  showBankOnStage(bank);
  if (label){
    const el = $("bank-label"); el.textContent = bank.name; el.classList.add("on");
    clearTimeout(labelT); labelT = setTimeout(() => el.classList.remove("on"), 600);
  }
}
const nextBank = () => setPlayBank((playBank + 1) % (NB + 1));
function trigger(code){
  if (!playing) return false;
  let b = playBank, c = code;
  if (playBank === NB){ const m = mixMap && mixMap[code]; if (!m) return false; b = m.b; c = m.c; }
  const k = keyOf(playing, b, c);
  if (k.snd) playSound(k.snd, b + c);
  if (k.strokes.length){
    const rate = rateFor(k, b);
    const keep = sim.clock + lenOf(b, k.strokes) / rate + KEEP_MS;
    if (BANKS[b].kind === "ink"){
      if (keep > sim.keepUntil) sim.keepUntil = keep;
      addReplay(k.strokes, rate, keep);
    } else addVReplay(BANKS[b].engine, k.strokes, rate, keep);
  }
  return !!(k.snd || k.strokes.length);
}
function exitPlay(){
  if (mode !== "play") return;
  if (playFrom === "make") enterMake();
  else { $("play").hidden = true; mode = "start"; showStart(); }
}
$("play-exit").addEventListener("click", exitPlay);
$("play-exit").addEventListener("pointerdown", (e) => e.stopPropagation());

// 화면 전체를 보이지 않는 칸으로 나눈다: 가로 화면 9x3, 세로 화면 3x9. 27번째(오른쪽 아래) 칸은 뱅크 넘기기.
function cellAt(x, y){
  const w = innerWidth, h = innerHeight, cols = w >= h ? 9 : 3, rows = 27 / cols;
  const c = Math.min(cols - 1, Math.max(0, Math.floor(x / w * cols)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(y / h * rows)));
  return GRID[r * cols + c] || "switch";
}
function ripple(x, y){
  const d = document.createElement("div"); d.className = "ripple";
  d.style.left = x + "px"; d.style.top = y + "px";
  document.body.appendChild(d); setTimeout(() => d.remove(), 600);
}
$("play").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockAudio();
  if (e.pointerType === "mouse") return;   // 마우스 클릭은 소리만 켜고 연주는 자판으로
  const cell = cellAt(e.clientX, e.clientY);
  if (cell === "switch"){ nextBank(); return; }
  if (trigger(cell)) ripple(e.clientX, e.clientY);
}, { passive: false });

// ---------- 화면 바꾸기 ----------
function enterMake(){
  mode = "make";
  $("play").hidden = true; $("maker").hidden = false;
  $("stage-box").appendChild(stage);
  $("title").value = work.title;
  selectBank(editBank);
}

const startEl = $("start");
let startPhase = "start";
function showStart(){
  startEl.hidden = false; startEl.classList.remove("out"); startPhase = "start";
  $("start-own").hidden = !!shared; $("start-shared").hidden = !shared;
  if (shared){
    const sub = $("start-sub");
    sub.textContent = "";
    const b = document.createElement("b"); b.textContent = shared.title ? `「${shared.title}」` : "벗이 보낸 작품";
    sub.append(b, document.createTextNode(shared.title ? ", 한번 연주해 보시게" : "을 연주해 보시게"));
    $("start-hint").textContent = "아무 자판이나 누르면 연주를 시작하네";
  }
}
function leaveStart(then){
  if (startPhase !== "start") return;
  closeVeil($("help"));
  unlockAudio();
  startPhase = "fading";
  startEl.classList.add("out");
  then();
  setTimeout(() => { startEl.hidden = true; startPhase = "gone"; }, 700);
}
$("start-make").addEventListener("click", () => leaveStart(enterMake));
$("start-play").addEventListener("click", () => leaveStart(() => enterPlay(shared, "start")));
$("start-remix").addEventListener("click", () => {
  if (hasDrawing(work) && !confirm("지금 만들던 작품 대신 이 작품을 고쳐 만들겠는가?\n(만들던 작품은 지워진다네)")) return;
  work = normalize(JSON.parse(JSON.stringify(shared)));
  thumbs = {}; save();
  shared = null;
  history.replaceState(null, "", location.pathname + location.search);   // 새로 고침하면 내 작품으로
  leaveStart(enterMake);
});
startEl.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, a")) return;
  e.preventDefault();
  primaryStart();
});
function primaryStart(){ if (shared) leaveStart(() => enterPlay(shared, "start")); else leaveStart(enterMake); }

// ---------- 창 ----------
let veilBack = null;
function openVeil(v, focus){ veilBack = document.activeElement; v.hidden = false; if (focus) focus.focus(); }
function closeVeil(v){ if (v.hidden) return; v.hidden = true; if (veilBack && veilBack.focus) veilBack.focus(); }
const openHelp = () => openVeil($("help"), $("help-close"));
for (const b of document.querySelectorAll(".start-help")) b.addEventListener("click", openHelp);
$("open-help").addEventListener("click", openHelp);
$("help-close").addEventListener("click", () => closeVeil($("help")));
for (const v of [$("help"), $("share")]){
  v.addEventListener("click", (e) => e.target === v && closeVeil(v));
  v.addEventListener("pointerdown", (e) => e.stopPropagation());
}

$("open-play").addEventListener("click", () => enterPlay(work, "make"));
$("open-share").addEventListener("click", async () => {
  if (!hasDrawing(work)){ toast("먼저 자판에 그림을 그려 보시게"); return; }
  const link = location.href.split("#")[0] + "#w=" + await encodeWork(work);
  $("share-link").value = link;
  const kb = (link.length / 1000).toFixed(1);
  $("share-note").textContent = link.length > 8000
    ? `주소가 길다네 (${kb}천 자). 메신저에 따라 잘릴 수 있으니, 그림을 짧게 하거나 획을 줄이면 짧아진다네.`
    : `주소 길이 ${link.length.toLocaleString()}자`;
  openVeil($("share"), $("share-copy"));
  $("share-link").select();
});
$("share-copy").addEventListener("click", async () => {
  const t = $("share-link");
  try { await navigator.clipboard.writeText(t.value); }
  catch (_) { t.select(); document.execCommand("copy"); }
  toast("주소를 복사했네");
});
$("share-close").addEventListener("click", () => closeVeil($("share")));

// ---------- 자판 ----------
addEventListener("keydown", (e) => {
  // 만들기: ⌘Z 되돌리기, ⇧⌘Z 다시 하기 (그 밖의 ⌘R 등 브라우저 단축키는 그대로)
  if (mode === "make" && (e.metaKey || e.ctrlKey) && e.code === "KeyZ"
      && $("help").hidden && $("share").hidden && !(e.target.matches && e.target.matches("input, textarea"))){
    e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const veil = !$("help").hidden ? $("help") : !$("share").hidden ? $("share") : null;
  if (veil){
    if (e.key === "Escape") closeVeil(veil);
    return;
  }
  if (e.target.matches && e.target.matches("input[type=text], input:not([type]), textarea")) {
    if (e.key === "Enter" || e.key === "Escape") e.target.blur();
    return;
  }
  // 한글 입력 상태에서도 자판 자리(e.code) 기준
  const code = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : "";
  if (mode === "start"){
    if (startPhase !== "start" || e.key === "Tab") return;
    if (e.target.closest && e.target.closest("button, a") && (e.key === "Enter" || e.code === "Space")) return;
    e.preventDefault();
    if (!e.repeat) primaryStart();
    return;
  }
  if (mode === "play"){
    if (e.key === "Escape"){ exitPlay(); return; }
    if (e.repeat || e.shiftKey) return;
    if (e.code === "Space"){ e.preventDefault(); nextBank(); return; }
    if (GRID.includes(code)){ e.preventDefault(); trigger(code); }
    return;
  }
  // 만들기
  if (e.target.closest && e.target.closest("button") && (e.key === "Enter" || e.code === "Space")) return;
  const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
  if (n >= 0 && editBank === 0){ applyPreset(presetBtns[n]); return; }
  if (GRID.includes(code)){
    e.preventDefault();
    if (e.repeat) return;
    selectKey(code); preview(code);
  }
});

addEventListener("contextmenu", (e) => { if (mode === "play" || stage.contains(e.target)) e.preventDefault(); });
document.addEventListener("gesturestart", (e) => e.preventDefault());

// ---------- 링크에 작품 담기 ----------
// 획 기록을 바이트로 줄여(변화량만, 가변 길이 정수) 압축한 뒤 주소 # 뒤에 붙인다. 서버가 필요 없다.
// 형식 3: 뱅크 3개(수묵 획·단청 문양·자개 문양)
function bytesWriter(){
  const a = [];
  const u = (n) => { n = Math.max(0, Math.round(n)); while (n >= 128){ a.push((n & 127) | 128); n = Math.floor(n / 128); } a.push(n); };
  return { a, u, z: (n) => { n = Math.round(n); u(n < 0 ? -2 * n - 1 : 2 * n); }, b: (n) => a.push(n & 255) };
}
function bytesReader(buf){
  let i = 0;
  const u = () => { let n = 0, m = 1, b; do { if (i >= buf.length) throw new Error("짧은 데이터"); b = buf[i++]; n += (b & 127) * m; m *= 128; } while (b & 128); return n; };
  return { u, z: () => { const n = u(); return n % 2 ? -(n + 1) / 2 : n / 2; }, b: () => { if (i >= buf.length) throw new Error("짧은 데이터"); return buf[i++]; } };
}
// 수묵 획: 붓 설정 + 점마다 변화량.  단청·자개 문양: 문양·움직임·자리·크기·돌림 + 앞 문양과의 시간 차.
function packInk(o, st){
  o.b(st.w); o.b(st.i); o.u(st.s); o.b(st.d); o.u(st.seed >>> 0);
  o.u(st.t0);
  const pen = st.pts.some((p) => p[3] >= 0);
  o.b(pen ? 1 : 0); o.u(st.pts.length);
  let px = 0, py = 0, pt = 0;
  for (const p of st.pts){
    o.z(p[0] * 2 - px); o.z(p[1] * 2 - py); o.z(p[2] - pt);
    px = Math.round(p[0] * 2); py = Math.round(p[1] * 2); pt = p[2];
    if (pen) o.b(p[3] >= 0 ? Math.round(p[3] * 100) : 255);
  }
}
function unpackInk(r){
  const st = { w: r.b(), i: r.b(), s: r.u(), d: r.b(), seed: r.u() | 0 };
  st.t0 = r.u(); st.pts = [];
  const pen = r.b() & 1, np = r.u();
  let px = 0, py = 0, pt = 0;
  for (let k = 0; k < np; k++){
    px += r.z(); py += r.z(); pt += r.z();
    let p = -1;
    if (pen){ const v = r.b(); p = v === 255 ? -1 : v / 100; }
    st.pts.push([px / 2, py / 2, pt, p]);
  }
  return st;
}
function packWork(w){
  const o = bytesWriter();
  o.b(3);   // 형식 번호
  const title = new TextEncoder().encode(w.title || "");
  o.u(title.length); for (const x of title) o.b(x);
  for (let b = 0; b < NB; b++){
    for (const c of GRID){
      const k = keyOf(w, b, c);
      o.u(k.snd ? SOUND_BY_ID.get(k.snd).index + 1 : 0);
      o.b(k.fit ? 1 : 0);
      o.u(k.strokes.length);
      let t = 0;
      for (const st of k.strokes){
        if (!BANKS[b].engine){ packInk(o, st); continue; }
        o.b(st.m); o.b(st.a); o.u(st.x); o.u(st.y); o.u(st.s); o.u(st.r); o.u(st.t0 - t); t = st.t0;
      }
    }
  }
  return new Uint8Array(o.a);
}
// 형식 1: 수묵 뱅크만. 형식 2: 단청·자개가 붓으로 그리던 때 — 수묵만 읽고 나머지는 버린다. 형식 3: 지금.
function unpackWork(buf){
  const r = bytesReader(buf);
  const ver = r.b();
  if (ver < 1 || ver > 3) throw new Error("모르는 형식");
  const tl = r.u(), tb = new Uint8Array(tl);
  for (let i = 0; i < tl; i++) tb[i] = r.b();
  const w = { title: new TextDecoder().decode(tb), banks: [] };
  for (let b = 0; b < (ver === 3 ? NB : 1); b++){
    const keys = {};
    for (const c of GRID){
      const si = r.u(), fit = r.b() & 1, ns = r.u(), strokes = [];
      let t = 0;
      for (let s = 0; s < ns; s++){
        if (!BANKS[b].engine){ strokes.push(unpackInk(r)); continue; }
        const m = r.b(), a = r.b();
        const st = { m, x: r.u(), y: r.u(), s: r.u(), r: r.u(), a };
        st.t0 = t += r.u();
        strokes.push(st);
      }
      keys[c] = { snd: si ? (SOUNDS[si - 1] || {}).id || null : null, fit: !!fit, strokes };
    }
    w.banks.push({ keys });
  }
  return normalize(w);
}
async function pipe(bytes, stream){
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
function toB64url(bytes){
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str){
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function encodeWork(w){
  const raw = packWork(w);
  if (window.CompressionStream) return "z" + toB64url(await pipe(raw, new CompressionStream("deflate-raw")));
  return "r" + toB64url(raw);
}
async function decodeWork(str){
  const kind = str[0], bytes = fromB64url(str.slice(1));
  if (kind === "z") return unpackWork(await pipe(bytes, new DecompressionStream("deflate-raw")));
  if (kind === "r") return unpackWork(bytes);
  throw new Error("모르는 형식");
}
window.ddgmaker = { encodeWork, decodeWork, packWork, get work(){ return work; }, get mixMap(){ return mixMap; } };   // 시험용

// ---------- 시작 ----------
showBankOnStage(BANKS[0]);
requestAnimationFrame(frame);
(async function boot(){
  const m = location.hash.match(/^#w=(.+)$/);
  if (m){
    try { shared = await decodeWork(m[1]); }
    catch (err){ console.warn(err); toast("주소에서 작품을 읽지 못했네. 주소가 잘리지 않았는지 살펴보시게.", 6); }
  }
  showStart();
})();
})();
