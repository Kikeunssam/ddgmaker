(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const GRID = "qwertyuiopasdfghjklzxcvbnm".split("");      // 터치 칸·링크 순서 (1편과 같다)
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MOBILE = window.matchMedia("(pointer: coarse)").matches;
const MAX_REPLAYS = MOBILE ? 6 : 12;   // 연주 때 동시에 다시 그려지는 그림 수 (1편 동시 영상 상한과 같다)
const VOICES_PER_KEY = 8;
const KEEP_MS = 900;                   // 다 그려진 그림이 사라지기 시작할 때까지
const FADE_K = 0.92;                   // 한 장면마다 남는 먹 (약 1초에 걸쳐 사라진다)
const RATE_MIN = 0.25, RATE_MAX = 8;   // 소리 길이에 맞출 때 빠르기 한도
const STORE = "ddgmaker-work-v1", THUMBS = "ddgmaker-thumbs-v1";
const SOUND_BY_ID = new Map(SOUNDS.map((s, i) => [s.id, { ...s, index: i }]));
const { LW, LH, STEP_MS } = Ink;

// ---------- 작품 ----------
// work = { title, keys: { g: { snd: "janggu_deong_strong", fit: true, strokes: [...] } } }
// 획 하나 = { w, i, s, d, seed, t0, pts: [[x, y, t, p], ...] } (x·y는 0.5px 단위, t는 ms, p는 펜 압력 또는 -1)
function emptyWork(){
  const keys = {};
  for (const c of GRID) keys[c] = { snd: null, fit: true, strokes: [] };
  for (const s of SOUNDS) if (s.key && keys[s.key]) keys[s.key].snd = s.id;
  return { title: "", keys };
}
function normalize(w){
  const out = emptyWork();
  out.title = (w && typeof w.title === "string") ? w.title.slice(0, 30) : "";
  for (const c of GRID){
    const k = w && w.keys && w.keys[c];
    if (!k) continue;
    out.keys[c] = { snd: SOUND_BY_ID.has(k.snd) ? k.snd : null, fit: k.fit !== false, strokes: Array.isArray(k.strokes) ? k.strokes : [] };
  }
  return out;
}
const hasDrawing = (w) => GRID.some((c) => w.keys[c].strokes.length);

let work, thumbs;
try { work = normalize(JSON.parse(localStorage.getItem(STORE) || "null")); } catch (_) { work = emptyWork(); }
try { thumbs = JSON.parse(localStorage.getItem(THUMBS) || "{}") || {}; } catch (_) { thumbs = {}; }
let saveTimer = 0;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(work)); } catch (_) { toast("저장 공간이 모자라요"); }
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

// 소리는 모두 합쳐 3MB 남짓이라 처음에 다 받아 둔다 (소리 길이를 알아야 빠르기를 맞출 수 있다)
Promise.all(SOUNDS.map((s) => ensureSound(s.id))).catch((err) => {
  const hint = location.protocol === "file:" ? " (소리를 바꿨다면 python3 tools/make_sounds_js.py 를 한 번 실행해 주세요)" : "";
  toast(`불러오지 못한 소리가 있어요: ${err.message}${hint}`, 8);
});

// ---------- 먹 종이 ----------
const stage = $("stage"), ic = $("inkc"), hint = $("hint");
Ink.drawPaper($("paper"));
const sim = Ink.makeSim(ic);
const bakeSim = Ink.makeSim(document.createElement("canvas"));   // 미리보기 그림 굽기용 (화면에 안 보임)

// 다시 그리기: 시뮬레이션 시계에 맞춰 붓에 획을 넣는다. rate > 1 이면 빠르게.
let replays = [];   // { rp, start, rate, key }
function addReplay(strokes, rate, keep, key){
  if (!strokes.length) return null;
  const rp = Ink.makeReplay(strokes, sim, keep);
  const r = { rp, start: sim.clock, rate, key };
  replays.push(r);
  while (replays.length > MAX_REPLAYS) replays.shift();
  return r;
}
function tickReplays(){
  if (!replays.length) return;
  replays = replays.filter((r) => !r.rp.to((sim.clock - r.start) * r.rate));
}
// 남은 붓질을 한꺼번에 끝낸다 (만들기 화면에서 다시 그리는 중에 붓을 대면)
function finishReplays(){
  let guard = 0;
  while (replays.length && guard++ < 20000){ tickReplays(); sim.step(); }
  replays = [];
}

function rateFor(k){
  if (!k.fit) return 1;
  const len = Ink.strokesLength(k.strokes), sec = soundSec(k.snd);
  if (!len || !sec) return 1;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, len / (sec * 1000)));
}

// ---------- 매 장면 ----------
let acc = 0, lastT = performance.now();
function frame(now){
  acc += Math.min(50, now - lastT); lastT = now;
  if (active && now - active.lastMove > 33){          // 멈춰 있는 붓도 기록
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
  if (mode === "make") bakeNextThumb();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 미리보기 그림 ----------
const thumbCanvas = document.createElement("canvas");
thumbCanvas.width = 240; thumbCanvas.height = 150;
function thumbOf(canvas){
  const g = thumbCanvas.getContext("2d");
  g.clearRect(0, 0, 240, 150);
  g.drawImage(canvas, 0, 0, 240, 150);
  return thumbCanvas.toDataURL("image/png");
}
let thumbTimer = 0;
function scheduleThumb(code){
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    if (mode !== "make" || cur !== code) return;
    if (active || replays.length) return scheduleThumb(code);   // 그리는 중이거나 다시 그리는 중이면 조금 뒤에
    sim.render(); setThumb(code, thumbOf(ic));
  }, 1200);
}
function setThumb(code, url){
  if (url) thumbs[code] = url; else delete thumbs[code];
  save(); drawTile(code);
}
// 미리보기가 없는 키(링크로 받은 작품 등)는 쉬는 장면마다 하나씩 굽는다
function bakeNextThumb(){
  const code = GRID.find((c) => work.keys[c].strokes.length && !thumbs[c] && c !== cur);
  if (!code) return;
  Ink.bake(work.keys[code].strokes, bakeSim);
  setThumb(code, thumbOf(bakeSim.canvas));
}

// ---------- 만들기 화면 ----------
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

let cur = "g";
const tiles = {};
(function buildKeyboard(){
  const box = $("keyboard");
  ROWS.forEach((row, ri) => {
    const r = document.createElement("div"); r.className = `krow r${ri + 1}`;
    for (const c of row){
      const el = document.createElement("div"); el.className = "kt";
      el.innerHTML = `<img alt="" hidden><b>${c.toUpperCase()}</b><span></span>`;
      el.addEventListener("click", () => { selectKey(c); preview(c); });
      r.appendChild(el); tiles[c] = el;
    }
    box.appendChild(r);
  });
})();
function drawTile(c){
  const el = tiles[c], k = work.keys[c], img = el.querySelector("img");
  const t = k.strokes.length && thumbs[c];
  img.hidden = !t; if (t) img.src = t;
  el.classList.toggle("drawn", !!k.strokes.length);
  el.querySelector("span").textContent = k.snd ? SOUND_BY_ID.get(k.snd).name : "";
  el.classList.toggle("sel", c === cur);
}
const drawTiles = () => GRID.forEach(drawTile);

(function buildSoundPick(){
  const box = $("sound-pick");
  for (const g of SOUND_GROUPS){
    const d = document.createElement("div"); d.className = "grp";
    d.innerHTML = `<span>${g}</span><div class="chips"></div>`;
    for (const s of SOUNDS.filter((s) => s.group === g)){
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
})();
function drawSide(){
  const k = work.keys[cur];
  $("cur-key").textContent = cur.toUpperCase();
  const s = k.snd && SOUND_BY_ID.get(k.snd);
  $("cur-sound").textContent = s ? `${s.group} ${s.name}` : "소리 없음";
  for (const b of $("sound-pick").querySelectorAll("button")){
    b.classList.toggle("on", (b.dataset.id || null) === k.snd);
  }
  $("fit").checked = k.fit;
  refreshFit();
  $("undo").disabled = $("clear-key").disabled = $("replay").disabled = !k.strokes.length;
}
function refreshFit(){
  if (mode !== "make") return;
  const k = work.keys[cur];
  const len = Ink.strokesLength(k.strokes) / 1000, sec = soundSec(k.snd);
  $("dur").textContent = k.strokes.length ? `그림 ${len.toFixed(1)}초` : "";
  let info = "";
  if (!k.strokes.length) info = "그림을 그리면 여기에 빠르기가 나와요.";
  else if (!k.snd) info = "소리가 없어서 그린 빠르기 그대로 다시 그려요.";
  else if (!sec) info = "";
  else if (!k.fit) info = `그린 빠르기 그대로 ${len.toFixed(1)}초 동안 그려요. (소리 ${sec.toFixed(1)}초)`;
  else {
    const r = rateFor(k), shown = len / r;
    const how = Math.abs(r - 1) < 0.05 ? "그린 빠르기 그대로" : r > 1 ? `${r.toFixed(1)}배 빠르게` : `${(1 / r).toFixed(1)}배 느리게`;
    info = `소리 ${sec.toFixed(1)}초에 맞춰 ${how} 그려요` + (Math.abs(shown - sec) > 0.15 ? ` (${shown.toFixed(1)}초, 더는 못 맞춰요)` : "") + ".";
  }
  $("fit-info").textContent = info;
}
$("fit").addEventListener("change", () => { work.keys[cur].fit = $("fit").checked; save(); refreshFit(); });

function chooseSound(id){
  work.keys[cur].snd = id; save();
  drawSide(); drawTile(cur);
  if (id) ensureSound(id).then(() => playSound(id, cur));
}

function showKeyDrawing(code){
  replays = []; sim.fading = false;
  const st = work.keys[code].strokes;
  if (st.length) Ink.bake(st, sim, 300); else sim.clear();
  hint.style.opacity = st.length ? 0 : 1;
}
function selectKey(code){
  if (code === cur && mode === "make") return;
  if (active) endStroke({ pointerId: active.id });
  cur = code; lastEndReal = 0;
  showKeyDrawing(code);
  drawTiles(); drawSide();
}
// 키 들어 보기: 소리와 함께 그림을 처음부터 다시 그린다 (연주 때와 같은 빠르기)
function preview(code){
  const k = work.keys[code];
  if (k.snd) playSound(k.snd, code);
  if (!k.strokes.length) return;
  replays = []; sim.fading = false; sim.clear(); hint.style.opacity = 0;
  addReplay(k.strokes, rateFor(k), 0, code);
  tiles[code].classList.add("flash"); setTimeout(() => tiles[code].classList.remove("flash"), 300);
}

$("replay").addEventListener("click", () => preview(cur));
$("undo").addEventListener("click", () => {
  const k = work.keys[cur]; if (!k.strokes.length) return;
  k.strokes.pop(); save(); showKeyDrawing(cur);
  setThumb(cur, k.strokes.length ? thumbOf(ic) : null); drawSide();
});
$("clear-key").addEventListener("click", () => {
  const k = work.keys[cur]; if (!k.strokes.length) return;
  if (!confirm(`${cur.toUpperCase()} 키의 그림을 모두 지울까요?`)) return;
  k.strokes = []; save(); showKeyDrawing(cur); setThumb(cur, null); drawSide();
});
$("title").addEventListener("input", () => { work.title = $("title").value.slice(0, 30); save(); });

// ---------- 붓으로 그리기 (시제품과 같은 기록 방식, 좌표는 0.5px 단위로 맞춰 링크에 그대로 담기게) ----------
let active = null, lastEndReal = 0;
function stagePoint(ev){
  const r = ic.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * LW, y: (ev.clientY - r.top) / r.height * LH };
}
ic.addEventListener("pointerdown", (e) => {
  if (mode !== "make" || active) return;
  e.preventDefault();
  if (replays.length) finishReplays();
  try { ic.setPointerCapture(e.pointerId); } catch (_){}
  hint.style.opacity = 0;
  const strokes = work.keys[cur].strokes;
  const now = performance.now();
  let t0 = 0;
  if (strokes.length){
    const prev = strokes[strokes.length - 1];
    const prevEnd = prev.t0 + (prev.pts.length ? prev.pts[prev.pts.length - 1][2] : 0);
    t0 = prevEnd + Math.min(450, lastEndReal ? now - lastEndReal : 450);   // 쉬는 시간은 짧게 줄여서 저장
  }
  const st = { w: +ui.water.value, i: +ui.ink.value, s: +ui.size.value, d: ui.deplete.checked ? 1 : 0,
               seed: (Math.random() * 1e9) | 0, t0: Math.round(t0), pts: [] };
  strokes.push(st);
  active = { st, brush: Ink.makeBrush(st, sim), ts0: e.timeStamp, tsOff: now - e.timeStamp, id: e.pointerId, code: cur };
  addPt(e);
});
function addPt(ev){
  const p = stagePoint(ev);
  const pt = { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2,
               t: Math.max(0, Math.round(ev.timeStamp - active.ts0)),
               p: ev.pointerType === "pen" ? Math.round(ev.pressure * 100) / 100 : -1 };
  active.st.pts.push([pt.x, pt.y, pt.t, pt.p]);
  active.brush.add(pt);
  active.lastMove = performance.now(); active.lastEv = ev;
}
ic.addEventListener("pointermove", (e) => {
  if (!active || e.pointerId !== active.id) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) addPt(ev);
});
function endStroke(e){
  if (!active || e.pointerId !== active.id) return;
  const code = active.code;
  active = null; lastEndReal = performance.now();
  save(); drawSide(); drawTile(code); scheduleThumb(code);
}
ic.addEventListener("pointerup", endStroke);
ic.addEventListener("pointercancel", endStroke);

// ---------- 연주 ----------
let playFrom = "make";
function enterPlay(w, from){
  playing = w; playFrom = from;
  if (active) endStroke({ pointerId: active.id });
  mode = "play";
  $("maker").hidden = true; $("play").hidden = false;
  $("play").appendChild(stage);
  replays = []; sim.clear(); sim.fading = true; hint.style.opacity = 0;
  for (const c of GRID) ensureSound(playing.keys[c].snd).catch(() => {});
}
function trigger(code){
  const k = playing && playing.keys[code];
  if (!k) return false;
  if (k.snd) playSound(k.snd, code);
  if (k.strokes.length){
    const rate = rateFor(k);
    const keep = sim.clock + Ink.strokesLength(k.strokes) / rate + KEEP_MS;
    if (keep > sim.keepUntil) sim.keepUntil = keep;
    addReplay(k.strokes, rate, keep, code);
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

// 화면 전체를 보이지 않는 칸으로 나눈다: 가로 화면 9x3, 세로 화면 3x9 (27번째 칸은 비워 둔다)
function cellAt(x, y){
  const w = innerWidth, h = innerHeight, cols = w >= h ? 9 : 3, rows = 27 / cols;
  const c = Math.min(cols - 1, Math.max(0, Math.floor(x / w * cols)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(y / h * rows)));
  return GRID[r * cols + c];
}
function ripple(x, y){
  const d = document.createElement("div"); d.className = "ripple";
  d.style.left = x + "px"; d.style.top = y + "px";
  document.body.appendChild(d); setTimeout(() => d.remove(), 600);
}
$("play").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockAudio();
  if (e.pointerType === "mouse") return;   // 마우스 클릭은 소리만 켜고 연주는 키보드로
  const cell = cellAt(e.clientX, e.clientY);
  if (cell && trigger(cell)) ripple(e.clientX, e.clientY);
}, { passive: false });

// ---------- 화면 바꾸기 ----------
function enterMake(){
  mode = "make";
  $("play").hidden = true; $("maker").hidden = false;
  $("stage-box").appendChild(stage);
  $("title").value = work.title;
  showKeyDrawing(cur); drawTiles(); drawSide();
}

const startEl = $("start");
let startPhase = "start";
function showStart(){
  startEl.hidden = false; startEl.classList.remove("out"); startPhase = "start";
  $("start-own").hidden = !!shared; $("start-shared").hidden = !shared;
  if (shared){
    const sub = $("start-sub");
    sub.textContent = "";
    const b = document.createElement("b"); b.textContent = shared.title ? `「${shared.title}」` : "친구가 보낸 작품";
    sub.append(b, document.createTextNode(shared.title ? " 을(를) 연주해 보세요" : "을 연주해 보세요"));
    $("start-hint").textContent = "아무 키나 누르면 연주를 시작해요";
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
  if (hasDrawing(work) && !confirm("지금 만들고 있던 작품 대신 이 작품을 고쳐 만들까요?\n(만들던 작품은 지워져요)")) return;
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
  if (!hasDrawing(work)){ toast("먼저 키에 그림을 그려 주세요"); return; }
  const link = location.href.split("#")[0] + "#w=" + await encodeWork(work);
  $("share-link").value = link;
  const kb = (link.length / 1000).toFixed(1);
  $("share-note").textContent = link.length > 8000
    ? `링크가 길어요 (${kb}천 자). 메신저에 따라 잘릴 수 있으니, 그림을 짧게 하거나 획 수를 줄이면 짧아져요.`
    : `링크 길이 ${link.length.toLocaleString()}자`;
  openVeil($("share"), $("share-copy"));
  $("share-link").select();
});
$("share-copy").addEventListener("click", async () => {
  const t = $("share-link");
  try { await navigator.clipboard.writeText(t.value); }
  catch (_) { t.select(); document.execCommand("copy"); }
  toast("링크를 복사했어요");
});
$("share-close").addEventListener("click", () => closeVeil($("share")));

// ---------- 키보드 ----------
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;   // ⌘R 등 브라우저 단축키는 그대로
  const veil = !$("help").hidden ? $("help") : !$("share").hidden ? $("share") : null;
  if (veil){
    if (e.key === "Escape") closeVeil(veil);
    return;
  }
  if (e.target.matches && e.target.matches("input[type=text], input:not([type]), textarea")) {
    if (e.key === "Enter" || e.key === "Escape") e.target.blur();
    return;
  }
  // 한글 입력 상태에서도 키 자리(e.code) 기준
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
    if (GRID.includes(code)){ e.preventDefault(); trigger(code); }
    return;
  }
  // 만들기
  if (e.target.closest && e.target.closest("button") && (e.key === "Enter" || e.code === "Space")) return;
  const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
  if (n >= 0){ applyPreset(presetBtns[n]); return; }
  if (GRID.includes(code)){
    e.preventDefault();
    if (e.repeat) return;
    selectKey(code); preview(code);
  }
});

addEventListener("contextmenu", (e) => { if (mode === "play" || e.target === ic) e.preventDefault(); });
document.addEventListener("gesturestart", (e) => e.preventDefault());

// ---------- 링크에 작품 담기 ----------
// 획 기록을 바이트로 줄여(변화량만, 가변 길이 정수) 압축한 뒤 주소 # 뒤에 붙인다. 서버가 필요 없다.
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
function packWork(w){
  const o = bytesWriter();
  o.b(1);   // 형식 번호
  const title = new TextEncoder().encode(w.title || "");
  o.u(title.length); for (const x of title) o.b(x);
  for (const c of GRID){
    const k = w.keys[c];
    o.u(k.snd ? SOUND_BY_ID.get(k.snd).index + 1 : 0);
    o.b(k.fit ? 1 : 0);
    o.u(k.strokes.length);
    for (const st of k.strokes){
      o.b(st.w); o.b(st.i); o.u(st.s); o.b(st.d);
      o.u(st.seed >>> 0); o.u(st.t0);
      const pen = st.pts.some((p) => p[3] >= 0);
      o.b(pen ? 1 : 0); o.u(st.pts.length);
      let px = 0, py = 0, pt = 0;
      for (const p of st.pts){
        o.z(p[0] * 2 - px); o.z(p[1] * 2 - py); o.z(p[2] - pt);
        px = Math.round(p[0] * 2); py = Math.round(p[1] * 2); pt = p[2];
        if (pen) o.b(p[3] >= 0 ? Math.round(p[3] * 100) : 255);
      }
    }
  }
  return new Uint8Array(o.a);
}
function unpackWork(buf){
  const r = bytesReader(buf);
  if (r.b() !== 1) throw new Error("모르는 형식");
  const tl = r.u(), tb = new Uint8Array(tl);
  for (let i = 0; i < tl; i++) tb[i] = r.b();
  const w = { title: new TextDecoder().decode(tb), keys: {} };
  for (const c of GRID){
    const si = r.u(), fit = r.b() & 1, ns = r.u(), strokes = [];
    for (let s = 0; s < ns; s++){
      const st = { w: r.b(), i: r.b(), s: r.u(), d: r.b(), seed: r.u() | 0, t0: r.u(), pts: [] };
      const pen = r.b() & 1, np = r.u();
      let px = 0, py = 0, pt = 0;
      for (let k = 0; k < np; k++){
        px += r.z(); py += r.z(); pt += r.z();
        let p = -1;
        if (pen){ const v = r.b(); p = v === 255 ? -1 : v / 100; }
        st.pts.push([px / 2, py / 2, pt, p]);
      }
      strokes.push(st);
    }
    w.keys[c] = { snd: si ? (SOUNDS[si - 1] || {}).id || null : null, fit: !!fit, strokes };
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
window.ddgmaker = { encodeWork, decodeWork, packWork, get work(){ return work; } };   // 시험용

// ---------- 시작 ----------
(async function boot(){
  const m = location.hash.match(/^#w=(.+)$/);
  if (m){
    try { shared = await decodeWork(m[1]); }
    catch (err){ console.warn(err); toast("링크에서 작품을 읽지 못했어요. 주소가 잘리지 않았는지 확인해 주세요.", 6); }
  }
  showStart();
})();
})();
