/* Brick by Brick — jogo de empilhar blocos (solo ou 2 jogadores no mesmo teclado)
   Física: Matter.js. Tudo é desenhado em canvas, sem imagens externas. */
(() => {
'use strict';

if (typeof Matter === 'undefined') {
  const n = document.getElementById('nophys'); if (n) n.classList.remove('hidden');
  return;
}
const { Engine, Bodies, Body, Composite, Events } = Matter;
try { document.fonts.load('600 16px Outfit'); document.fonts.load('700 32px "Cormorant Garamond"'); } catch (e) {}

/* ====== AJUSTES FÁCEIS (mexa aqui para mudar a dificuldade) ====== */
const ZOOM = 14 / 30;          // zoom da câmera. Medido no 99 Bricks: cada quadradinho = 3,5% da largura da tela (14 de 400)
const W = 400, WW = W / ZOOM;  // W = largura da tela lógica; WW = largura do mundo da física
let H = 700, WH = 1400, CAM0 = 0;   // tamanho lógico da arena (a altura H se adapta à tela do celular)
const S = 30;                  // tamanho de cada quadradinho do bloco (maior = blocos maiores)
const BASE_Y = 560;            // altura da superfície da ilha
const BASE_W = 160;            // largura da ilha
const GRID = S / 2;            // "travas": a peça anda de meio em meio quadradinho e encaixa no alinhamento
const DROP_PX = 36;            // touch: quanto o dedo precisa descer (em linha reta) para a peça cair rápido
const WIND_PUSH = .8;          // vento empurra a peça que está caindo (px por frame no pico)
const CP_FIRST = 330;          // altura (px) da 1ª linha de pavimento; ~50 px = 1 m
const CP_STEP = 330;           // distância até a próxima linha depois de pavimentar
const TOOLS_START = 3;         // usos da colher de pedreiro (cimento) no início
function fitWorld() { const vw = Math.min(innerWidth, innerHeight * .62); H = Math.max(640, Math.min(940, Math.round(W * innerHeight / Math.max(1, vw)))); WH = H / ZOOM; CAM0 = BASE_Y + 150 / ZOOM - WH; }
const GOAL = 600;              // altura da meta no modo 2 jogadores
const LIVES = 3;               // blocos que podem cair antes de perder
const FALL = 1.3;              // velocidade normal de queda (menor = mais devagar)
const FALL_FAST = 16;           // velocidade ao segurar "descer"
const MOVE = 4;                // velocidade lateral no teclado
const DRAG_GAIN = 1.0;         // touch: 1 = a peça acompanha o dedo exatamente; menor = menos sensível
const MOVE_MAX = 9;            // touch: velocidade lateral máxima da peça (menor = mais firme)
const DEADZONE = 8;            // touch: pixels que o dedo precisa andar antes de contar como arrasto
const FRICTION = 1;            // atrito entre blocos (mais alto = menos escorrega)
const FRICTION_STATIC = 10;    // atrito parado (alto = o bloco "gruda" onde pousou)
const WIND_FORCE = 0.00005;    // força do vento sobre a torre (0 desliga). Leve de propósito.
const EVT_FIRST = 10;          // 1º evento (vento ou feitiço) depois de ~10 s; depois a cada 12–20 s
const SPELL_TIME = 9;          // duração do feitiço do vilão (segundos)
const SPELL_MULT = 2.4;        // quanto as peças aceleram durante o feitiço
const DUEL_PIECES = 25;        // peças por jogador no duelo
const DPR = Math.min(2, window.devicePixelRatio || 1);
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;

/* ====== PEÇAS ====== */
const SHAPES = {
  I: [[-1.5,0],[-.5,0],[.5,0],[1.5,0]],
  O: [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]],
  T: [[-1,0],[0,0],[1,0],[0,-1]],
  S: [[-1,0],[0,0],[0,-1],[1,-1]],
  Z: [[-1,-1],[0,-1],[0,0],[1,0]],
  J: [[-1,-1],[-1,0],[0,0],[1,0]],
  L: [[1,-1],[-1,0],[0,0],[1,0]],
};
const PALETTE = { I:'#5ce1e6', O:'#ffd166', T:'#c77dff', S:'#7bd88f', Z:'#ff7a90', J:'#6fa8ff', L:'#ffa95c' };
const STONE = { I:'#8d99a6', O:'#a09a90', T:'#7b8794', S:'#8a9288', Z:'#9a8f8f', J:'#7f8aa0', L:'#948d80' };

/* ====== LOJA ====== */
const CAT = {
  blocks: { label:'Blocos', items:[
    {id:'geleia',n:'Geleia',p:0},{id:'pedra',n:'Pedra',p:30},{id:'gelo',n:'Gelo',p:60},
    {id:'doce',n:'Doce',p:80},{id:'neon',n:'Neon',p:120},{id:'ouro',n:'Ouro',p:200}]},
  theme: { label:'Fundo', items:[
    {id:'noite',n:'Noite',p:0},{id:'dia',n:'Dia',p:40},{id:'por',n:'Pôr do sol',p:60},
    {id:'aurora',n:'Aurora',p:100},{id:'espaco',n:'Espaço',p:150}]},
  base: { label:'Base', items:[
    {id:'ilha',n:'Ilha',p:0},{id:'castelo',n:'Castelo',p:80},{id:'vulcao',n:'Vulcão',p:120},{id:'nuvem',n:'Nuvem',p:150}]},
  hat: { label:'Chapéu', items:[
    {id:'nenhum',n:'Sem chapéu',p:0},{id:'folha',n:'Folhinha',p:30},{id:'laco',n:'Laço',p:40},
    {id:'cartola',n:'Cartola',p:50},{id:'mago',n:'Mago',p:80},{id:'coroa',n:'Coroa',p:100}]},
  mascot: { label:'Personagem', items:[
    {id:'fantasma',n:'Fantasma',p:0},{id:'flor',n:'Flor',p:60},{id:'nuvem',n:'Nuvem',p:90},
    {id:'estrela',n:'Estrela',p:120},{id:'abobora',n:'Abóbora',p:150}]},
};
const THEMES = {
  noite:  { top:'#06151c', bot:'#14433f', stars:1,  orb:'moon' },
  dia:    { top:'#5fb8f0', bot:'#dff6ff', stars:0,  orb:'sun',  clouds:true },
  por:    { top:'#3a2a6e', bot:'#ff9e6e', stars:.35, orb:'sunlow', clouds:true },
  aurora: { top:'#04111f', bot:'#0d4a45', stars:1,  aurora:true },
  espaco: { top:'#05040f', bot:'#2b1252', stars:1,  orb:'planet' },
};

/* ====== SALVAR NO NAVEGADOR ====== */
const SAVE_KEY = 'brick_by_brick_v1';
function defaults() {
  return { coins:0, best:0, xp:0, blocks:0, games:0,
    owned:{ blocks:['geleia'], theme:['noite'], base:['ilha'], hat:['nenhum'], mascot:['fantasma'] },
    eq:{ blocks:'geleia', theme:'noite', base:'ilha', hat:'nenhum', mascot:'fantasma' }, name:'', nameB:'' };
}
function normalize(s) {
  const d = defaults();
  if (s && typeof s === 'object') {
    d.coins = +s.coins || 0; d.best = +s.best || 0; d.xp = +s.xp || 0; d.blocks = +s.blocks || 0; d.games = +s.games || 0;
    d.name = typeof s.name === 'string' ? s.name.slice(0, 12) : ''; d.nameB = typeof s.nameB === 'string' ? s.nameB.slice(0, 12) : '';
    for (const k in d.owned) {
      if (s.owned && Array.isArray(s.owned[k])) d.owned[k] = Array.from(new Set(d.owned[k].concat(s.owned[k]))).filter(id => CAT[k].items.some(i => i.id === id));
      if (s.eq && typeof s.eq[k] === 'string' && d.owned[k].includes(s.eq[k])) d.eq[k] = s.eq[k];
    }
  }
  return d;
}
function loadSave() { try { return normalize(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { return defaults(); } }
const SAVE = loadSave();
let sb = null, authUser = null, syncT = 0;
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} scheduleSync(); }
function addCoins(n) { SAVE.coins += n; SAVE.xp += n; persist(); }

/* ====== UTILIDADES ====== */
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hex2rgb(h) { h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function mix(a, b, k) { const A = hex2rgb(a), B = hex2rgb(b); return 'rgb(' + A.map((v,i) => Math.round(v + (B[i]-v)*k)).join(',') + ')'; }
function shade(h, amt) { const A = hex2rgb(h); return 'rgb(' + A.map(v => clamp(Math.round(v + amt), 0, 255)).join(',') + ')'; }

/* ====== SOM (bipes simples, sem arquivos) ====== */
let AC = null, muted = false;
function beep(f, d = .09, type = 'sine', v = .05, slide = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
const sfx = {
  land: () => beep(150, .12, 'triangle', .09, -60),
  coin: () => { beep(880, .08, 'square', .03); setTimeout(() => beep(1320, .12, 'square', .03), 70); },
  lose: () => beep(300, .35, 'sawtooth', .05, -220),
  rec:  () => { beep(660, .1, 'triangle', .06); setTimeout(() => beep(990, .16, 'triangle', .06), 90); },
  win:  () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2, 'triangle', .07), i * 120)),
  spell: () => { beep(220, .28, 'sawtooth', .05, 200); setTimeout(() => beep(330, .3, 'square', .03, -140), 130); },
};

/* ====== DESENHO: PEÇAS ====== */
function pathVerts(c, v) { c.beginPath(); c.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) c.lineTo(v[i].x, v[i].y); c.closePath(); }
function bbox(v) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of v) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
}
function drawPart(c, part, type, skin, t) {
  const v = part.vertices, base = PALETTE[type] || '#fff';
  const bb = bbox(v), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  c.save(); c.lineJoin = 'round';
  pathVerts(c, v);
  if (skin === 'pedra') {
    c.fillStyle = STONE[type] || '#888'; c.fill();
    c.lineWidth = 2; c.strokeStyle = '#3f4854'; c.stroke();
    const h = ((part.id || 1) * 9301 + 49297) % 233280 / 233280;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(cx - 6 + h * 8, cy - 4 + h * 6, 3, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(cx + 6 - h * 6, cy + 5 - h * 4, 2.2, 0, 7); c.fill();
  } else if (skin === 'gelo') {
    c.fillStyle = 'rgba(186,232,255,.78)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 8, cy + 5); c.lineTo(cx - 2, cy - 7); c.stroke();
  } else if (skin === 'doce') {
    c.fillStyle = base; c.fill();
    c.save(); c.clip(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 5;
    for (let x = bb.x0 - 40; x < bb.x1 + 40; x += 12) { c.beginPath(); c.moveTo(x, bb.y1 + 20); c.lineTo(x + 40, bb.y0 - 20); c.stroke(); }
    c.restore();
    pathVerts(c, v); c.lineWidth = 2; c.strokeStyle = shade(base, -70); c.stroke();
  } else if (skin === 'neon') {
    c.fillStyle = '#08121c'; c.fill();
    c.shadowColor = base; c.shadowBlur = 12; c.lineWidth = 2.6; c.strokeStyle = base; c.stroke();
    c.shadowBlur = 0;
  } else if (skin === 'ouro') {
    const g = c.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
    g.addColorStop(0, '#fff3a6'); g.addColorStop(.5, '#f6c10f'); g.addColorStop(1, '#b97b00');
    c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#8a5a00'; c.stroke();
    const sh = (Math.sin((t || 0) * 2 + cx * .05) + 1) / 2;
    const u = (bb.x1 - bb.x0) / 30; c.fillStyle = 'rgba(255,255,255,' + (.2 + sh * .35) + ')'; c.beginPath(); c.arc(cx - 6 * u, cy - 6 * u, 4 * u, 0, 7); c.fill();
  } else { // geleia (padrão)
    c.fillStyle = base; c.fill();
    c.lineWidth = 2; c.strokeStyle = shade(base, -60); c.stroke();
    const u = (bb.x1 - bb.x0) / 30; c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx - 6 * u, cy - 6 * u, 5 * u, 0, 7); c.fill();
  }
  c.restore();
}
function sparkle(c, x, y, r) {
  const k = r * .2; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + k, y - k, x + r, y); c.quadraticCurveTo(x + k, y + k, x, y + r);
  c.quadraticCurveTo(x - k, y + k, x - r, y); c.quadraticCurveTo(x - k, y - k, x, y - r); c.closePath();
}
function quadFake(x, y, s, id) {
  return { id: id || 1, vertices: [{x:x,y:y},{x:x+s,y:y},{x:x+s,y:y+s},{x:x,y:y+s}] };
}

/* ====== DESENHO: CÉU ====== */
function makeStars() { const a = []; for (let i = 0; i < 70; i++) a.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 2), p: rnd(0, 6.28) }); return a; }
function floatIsland(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-46, 0); c.quadraticCurveTo(0, -12, 46, 0); c.lineTo(30, 14); c.lineTo(12, 36); c.lineTo(-4, 20); c.lineTo(-22, 26); c.lineTo(-34, 10); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(0, -2, 40, 6, 0, 0, 7); c.fill();
  c.fillStyle = shade('#2c6b55', -20);
  for (const tx of [-24, -8, 16]) { c.beginPath(); c.moveTo(tx - 6, -3); c.lineTo(tx, -20 - (tx % 5)); c.lineTo(tx + 6, -3); c.fill(); }
  c.restore();
}
function drawSky(c, th, h, t, stars, camY) {
  const k = clamp(h / 800, 0, 1);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(th.top, '#020611', k * .75));
  g.addColorStop(1, mix(th.bot, '#0a2030', k * .45));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sa = Math.max(th.stars || 0, k * .95);
  if (th.aurora) {
    for (let i = 0; i < 3; i++) {
      const gg = c.createLinearGradient(0, 40, 0, 300);
      gg.addColorStop(0, 'rgba(90,255,190,0)'); gg.addColorStop(.5, i % 2 ? 'rgba(160,120,255,.28)' : 'rgba(90,255,190,.3)'); gg.addColorStop(1, 'rgba(90,255,190,0)');
      c.fillStyle = gg; c.beginPath(); c.moveTo(0, 120 + i * 30);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, 120 + i * 30 + Math.sin(x * .02 + t * .6 + i) * 24);
      for (let x = W; x >= 0; x -= 20) c.lineTo(x, 280 + i * 30 + Math.sin(x * .017 + t * .5 + i * 2) * 30);
      c.closePath(); c.fill();
    }
  }
  if (sa > 0.02) {
    c.fillStyle = '#fff';
    for (const s of stars) { c.globalAlpha = sa * (.45 + .55 * Math.sin(t * 1.5 + s.p)); c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  const orbY = 110 + camY * .03;
  if (th.orb === 'moon') {
    const hg = c.createRadialGradient(318, orbY, 20, 318, orbY, 90);
    hg.addColorStop(0, 'rgba(255,250,200,.35)'); hg.addColorStop(1, 'rgba(255,250,200,0)');
    c.fillStyle = hg; c.fillRect(218, orbY - 100, 200, 200);
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.arc(331, orbY - 6, 26, 0, Math.PI * 2); c.clip('evenodd');
    c.fillStyle = '#f6f2d0'; c.beginPath(); c.arc(318, orbY, 30, 0, 7); c.fill(); c.restore();
  } else if (th.orb === 'sun' || th.orb === 'sunlow') {
    const y = th.orb === 'sun' ? orbY : 400 + camY * .03;
    const rg = c.createRadialGradient(100, y, 8, 100, y, 80);
    rg.addColorStop(0, 'rgba(255,240,160,1)'); rg.addColorStop(.4, 'rgba(255,200,90,.55)'); rg.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = rg; c.fillRect(0, y - 90, 220, 180);
    c.fillStyle = '#fff6b8'; c.beginPath(); c.arc(100, y, 26, 0, 7); c.fill();
  } else if (th.orb === 'planet') {
    c.save(); c.translate(310, orbY + 10); c.fillStyle = '#7b5cd6'; c.beginPath(); c.arc(0, 0, 32, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(-10, -10, 14, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,214,140,.8)'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 50, 12, -.35, 0, 7); c.stroke(); c.restore();
  }
  if (th.clouds) {
    c.fillStyle = th.orb === 'sunlow' ? 'rgba(255,190,170,.5)' : 'rgba(255,255,255,.75)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 150 + t * (6 + i * 2)) % (W + 160)) - 80;
      const cy = (((i * 210 - camY * .12) % (H + 120)) + H + 120) % (H + 120) - 60;
      c.beginPath(); c.ellipse(cx, cy, 44, 14, 0, 0, 7); c.ellipse(cx - 22, cy + 4, 24, 11, 0, 0, 7); c.ellipse(cx + 24, cy + 3, 26, 12, 0, 0, 7); c.fill();
    }
  }
  const dark = th === THEMES.dia ? 'rgba(70,130,120,.55)' : th === THEMES.por ? 'rgba(80,40,100,.55)' : 'rgba(10,40,45,.7)';
  const wrap = H + 240;
  const specs = [[70, 150, .7], [330, 330, .9], [150, 520, .6], [350, 600, .55]];
  specs.forEach((s, i) => {
    const y = (((s[1] - camY * (.18 + i * .03)) % wrap) + wrap) % wrap - 120;
    floatIsland(c, s[0] + Math.sin(t * .5 + i) * 4, y, s[2], dark);
  });
}

/* ====== DESENHO: BASES ====== */
function drawBase(c, id, t, cx) {
  const x0 = W / 2 - BASE_W / 2 - 4, x1 = W / 2 + BASE_W / 2 + 4, y = BASE_Y;
  c.save(); c.lineJoin = 'round'; if (cx != null) c.translate(cx - W / 2, 0);
  if (id === 'castelo') {
    c.fillStyle = '#8f98a8'; c.fillRect(x0 + 4, y, x1 - x0 - 8, 150);
    c.fillStyle = '#6f7888'; c.fillRect(x0 + 4, y, x1 - x0 - 8, 12);
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2;
    for (let r = 0; r < 6; r++) { const yy = y + 20 + r * 22; c.beginPath(); c.moveTo(x0 + 4, yy); c.lineTo(x1 - 4, yy); c.stroke();
      for (let xx = x0 + 4 + (r % 2) * 20; xx < x1 - 4; xx += 40) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 22); c.stroke(); } }
    c.fillStyle = '#4a4f5c'; c.beginPath(); c.moveTo(176, y + 150); c.lineTo(176, y + 92); c.arc(200, y + 92, 24, Math.PI, 0); c.lineTo(224, y + 150); c.fill();
    for (const tx of [x0 - 22, x1 - 6]) {
      c.fillStyle = '#7f889a'; c.fillRect(tx, y + 30, 28, 120);
      c.fillStyle = '#ff6b8a'; c.beginPath(); c.moveTo(tx - 4, y + 30); c.lineTo(tx + 14, y + 4); c.lineTo(tx + 32, y + 30); c.fill();
    }
    c.fillStyle = '#ffd166'; c.fillRect(x0 + 40, y + 50, 8, 16); c.fillRect(x1 - 48, y + 50, 8, 16);
  } else if (id === 'vulcao') {
    c.fillStyle = '#4b3030'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.lineTo(x1 - 50, y + 150); c.lineTo(x0 + 50, y + 150); c.closePath(); c.fill();
    c.fillStyle = '#2d1b1b'; c.fillRect(x0, y, x1 - x0, 10);
    const glow = .65 + .35 * Math.sin(t * 3);
    c.save(); c.shadowColor = '#ff7a1a'; c.shadowBlur = 10; c.strokeStyle = 'rgba(255,140,40,' + glow + ')'; c.lineWidth = 4; c.lineCap = 'round';
    for (const sx of [-60, -10, 45]) { c.beginPath(); c.moveTo(200 + sx, y + 10); c.quadraticCurveTo(200 + sx + 14, y + 50, 200 + sx - 6, y + 90); c.stroke(); }
    c.restore();
  } else if (id === 'nuvem') {
    c.fillStyle = '#f4fbff'; c.fillRect(x0 + 6, y, x1 - x0 - 12, 20);
    for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(x0 + 12 + i * 29, y + 20 + Math.sin(i * 2) * 5, 20 + (i % 3) * 5, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(160,200,240,.35)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x0 + 30 + i * 34, y + 44 + Math.sin(i) * 6, 16, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x0 + 6, y, x1 - x0 - 12, 5);
  } else { // ilha
    c.fillStyle = '#3d4d47';
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.lineTo(x1 - 22, y + 50); c.lineTo(x1 - 48, y + 78); c.lineTo(x1 - 78, y + 112); c.lineTo(200, y + 160);
    c.lineTo(x0 + 70, y + 108); c.lineTo(x0 + 40, y + 76); c.lineTo(x0 + 16, y + 44); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(200, y); c.lineTo(x1 - 22, y + 50); c.lineTo(200, y + 160); c.closePath(); c.fill();
    c.fillStyle = '#6fc27a'; c.beginPath(); c.roundRect ? c.roundRect(x0 - 2, y - 4, x1 - x0 + 4, 20, 8) : c.rect(x0 - 2, y - 4, x1 - x0 + 4, 20); c.fill();
    c.fillStyle = '#9be59f'; c.fillRect(x0 + 4, y - 4, x1 - x0 - 8, 5);
    c.fillStyle = '#4fa062';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x0 + 6 + i * 24, y + 16); c.lineTo(x0 + 10 + i * 24, y + 28); c.lineTo(x0 + 16 + i * 24, y + 16); c.fill(); }
    const cg = .6 + .4 * Math.sin(t * 2);
    c.save(); c.shadowColor = '#ffb347'; c.shadowBlur = 10 * cg; c.fillStyle = '#ffb347';
    c.beginPath(); c.moveTo(160, y + 92); c.lineTo(168, y + 124); c.lineTo(176, y + 92); c.fill();
    c.beginPath(); c.moveTo(214, y + 116); c.lineTo(222, y + 140); c.lineTo(230, y + 114); c.fill();
    c.restore();
    c.fillStyle = '#f7a8c4'; for (const fx of [x0 + 14, x1 - 20, x0 + 26]) { c.beginPath(); c.arc(fx, y - 8, 3.2, 0, 7); c.fill(); }
  }
  c.restore();
}

/* ====== DESENHO: MASCOTE (Nuvi) ====== */
function drawHat(c, id) {
  c.save();
  if (id === 'mago') {
    c.fillStyle = '#6b46c1'; c.beginPath(); c.moveTo(-14, -3); c.quadraticCurveTo(-4, -22, 6, -40); c.quadraticCurveTo(8, -20, 15, -3); c.closePath(); c.fill();
    c.fillStyle = '#553399'; c.beginPath(); c.ellipse(0, -2, 21, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#ffd166'; c.beginPath(); c.arc(2, -16, 3, 0, 7); c.fill();
  } else if (id === 'coroa') {
    c.fillStyle = '#ffd43b'; c.strokeStyle = '#b88a00'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-13, 0); c.lineTo(-14, -15); c.lineTo(-6, -8); c.lineTo(0, -18); c.lineTo(6, -8); c.lineTo(14, -15); c.lineTo(13, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff6b8a'; c.beginPath(); c.arc(0, -6, 2.6, 0, 7); c.fill();
  } else if (id === 'cartola') {
    c.fillStyle = '#20252f'; c.fillRect(-11, -24, 22, 22); c.beginPath(); c.ellipse(0, -2, 19, 4.5, 0, 0, 7); c.fill();
    c.fillStyle = '#e0526b'; c.fillRect(-11, -9, 22, 5);
  } else if (id === 'laco') {
    c.fillStyle = '#ff7fa3'; c.beginPath(); c.moveTo(13, -6); c.lineTo(3, -14); c.lineTo(3, 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(13, -6); c.lineTo(23, -14); c.lineTo(23, 2); c.closePath(); c.fill();
    c.fillStyle = '#ff4f80'; c.beginPath(); c.arc(13, -6, 3.5, 0, 7); c.fill();
  } else if (id === 'folha') {
    c.fillStyle = '#6fcf6f'; c.strokeStyle = '#3f9a4f'; c.lineWidth = 1.2;
    c.save(); c.rotate(-.35); c.beginPath(); c.ellipse(0, -9, 5.5, 11, 0, 0, 7); c.fill(); c.stroke(); c.restore();
    c.save(); c.rotate(.5); c.beginPath(); c.ellipse(2, -7, 4, 8, 0, 0, 7); c.fill(); c.stroke(); c.restore();
  }
  c.restore();
}
const HAT_Y = { fantasma:-48, flor:-55, nuvem:-48, estrela:-52, abobora:-47 };
function drawMascot(c, x, y, sc, skin, hatId, mood, t) {
  if (!HAT_Y[skin]) skin = 'fantasma';
  let bob = 0, sx = 0;
  if (mood === 'idle') bob = Math.sin(t * 2.2) * 1.6;
  else if (mood === 'happy') bob = -Math.abs(Math.sin(t * 11)) * 11;
  else if (mood === 'scared') sx = Math.sin(t * 45) * 1.6;
  c.save(); c.translate(x + sx, y + bob); c.scale(sc, sc); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 3 - bob / sc, 20, 5, 0, 0, 7); c.fill();
  const ay = mood === 'happy' ? -34 : mood === 'scared' ? -30 : -18;
  const arms = (fill, stroke) => {
    c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(-23, ay, 5.5, 4.5, -.4, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(23, ay, 5.5, 4.5, .4, 0, 7); c.fill(); c.stroke();
  };
  const feet = fill => { c.fillStyle = fill; c.beginPath(); c.ellipse(-9, -2, 7, 4.5, 0, 0, 7); c.ellipse(9, -2, 7, 4.5, 0, 0, 7); c.fill(); };
  let cheek = 'rgba(255,120,150,.45)';
  if (skin === 'fantasma') {
    arms('#f6f3ea', '#bdb8a8');
    c.fillStyle = '#f6f3ea'; c.strokeStyle = '#bdb8a8'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-21, -4); c.bezierCurveTo(-31, -32, -14, -50, 0, -50); c.bezierCurveTo(14, -50, 31, -32, 21, -4);
    c.quadraticCurveTo(16, 6, 10, -2); c.quadraticCurveTo(5, 7, 0, -2); c.quadraticCurveTo(-5, 7, -10, -2); c.quadraticCurveTo(-16, 6, -21, -4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-9, -40, 6, 3.4, -.5, 0, 7); c.fill();
  } else if (skin === 'flor') {
    feet('#5fbf6a'); arms('#7fd98a', '#3f9a4f'); cheek = 'rgba(255,110,140,.5)';
    c.fillStyle = '#ff9ec7'; c.strokeStyle = '#d9628f'; c.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; c.beginPath(); c.arc(Math.cos(an) * 17, -29 + Math.sin(an) * 17, 8.5, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#fff0c2'; c.strokeStyle = '#e0b968'; c.beginPath(); c.arc(0, -29, 15, 0, 7); c.fill(); c.stroke();
  } else if (skin === 'nuvem') {
    arms('#eaf5ff', '#9bb8d6'); feet('#cfe3f5');
    const bumps = [[-15, -22, 13], [0, -30, 17], [15, -22, 13], [-8, -14, 14], [8, -14, 14]];
    c.strokeStyle = '#9bb8d6'; c.lineWidth = 3.2; for (const q of bumps) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.stroke(); }
    c.fillStyle = '#eaf5ff'; for (const q of bumps) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-8, -40, 6, 3.4, -.5, 0, 7); c.fill();
  } else if (skin === 'estrela') {
    arms('#ffd84d', '#c99200'); feet('#f2b705'); cheek = 'rgba(255,120,110,.5)';
    c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 15.5 : 29, an = -Math.PI / 2 + i * Math.PI / 5; const px = Math.cos(an) * r, py = -27 + Math.sin(an) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
    c.strokeStyle = '#c99200'; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#ffd84d'; c.lineWidth = 5; c.stroke(); c.fillStyle = '#ffd84d'; c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-8, -37, 5, 3, -.6, 0, 7); c.fill();
  } else { // abóbora
    feet('#4f9d45'); arms('#ff9a3c', '#b85a10');
    c.fillStyle = '#ff9a3c'; c.strokeStyle = '#b85a10'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, -24, 27, 22, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(184,90,16,.55)'; c.lineWidth = 1.5;
    for (const ex of [-11, 11]) { c.beginPath(); c.ellipse(ex, -24, 8, 21, 0, 0, 7); c.stroke(); }
    c.fillStyle = '#5da84f'; c.strokeStyle = '#3d7a34'; c.beginPath(); c.moveTo(-3, -42); c.lineTo(-2, -52); c.lineTo(4, -52); c.lineTo(3, -42); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-14, -34, 5, 3, -.6, 0, 7); c.fill();
  }
  c.fillStyle = cheek; c.beginPath(); c.arc(-14, -22, 4, 0, 7); c.arc(14, -22, 4, 0, 7); c.fill();
  const ink = '#26333a'; c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 2.2;
  if (mood === 'happy') {
    c.beginPath(); c.arc(-8, -27, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(8, -27, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.beginPath(); c.arc(0, -22, 5.5, 0, Math.PI); c.fill();
  } else if (mood === 'scared') {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-8, -28, 5.5, 0, 7); c.arc(8, -28, 5.5, 0, 7); c.fill(); c.stroke();
    c.fillStyle = ink; c.beginPath(); c.arc(-8, -28, 1.8, 0, 7); c.arc(8, -28, 1.8, 0, 7); c.fill();
    c.beginPath(); c.ellipse(0, -18, 3, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#7fd4ff'; c.beginPath(); c.moveTo(22, -40); c.quadraticCurveTo(26, -34, 22, -31); c.quadraticCurveTo(18, -34, 22, -40); c.fill();
  } else if (mood === 'sad') {
    c.beginPath(); c.arc(-8, -27, 2.6, 0, 7); c.arc(8, -27, 2.6, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -15, 4, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.fillStyle = '#7fd4ff'; c.beginPath(); c.ellipse(-12, -20, 1.8, 3, 0, 0, 7); c.fill();
  } else {
    c.beginPath(); c.arc(-8, -27, 2.6, 0, 7); c.arc(8, -27, 2.6, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -22, 3.5, .15 * Math.PI, .85 * Math.PI); c.stroke();
  }
  c.save(); c.translate(0, HAT_Y[skin]); drawHat(c, hatId); c.restore();
  c.restore();
}

/* ====== SORTEIO COM SEMENTE (duelo justo: mesmas peças e eventos para os dois) ====== */
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ====== VILÃO (original): a Nuvem de Tempestade ====== */
function drawVillain(c, x, y, sc, t, charge) {
  const bob = Math.sin(t * 3) * 3;
  c.save(); c.translate(x, y + bob); c.scale(sc, sc); c.lineJoin = 'round'; c.lineCap = 'round';
  // chuva
  c.strokeStyle = 'rgba(170,205,255,' + (.35 + charge * .4) + ')'; c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const rx = -34 + i * 8.5, ph = (t * 2.2 + i * .37) % 1;
    c.beginPath(); c.moveTo(rx, 20 + ph * 56); c.lineTo(rx - 3, 30 + ph * 56); c.stroke();
  }
  // corpo da nuvem (cinza-azulado escuro)
  const puffs = [[-30, 4, 19], [-12, -10, 25], [12, -12, 26], [31, 3, 20], [0, 8, 24]];
  c.fillStyle = '#3d4a6b'; c.strokeStyle = '#1c2540'; c.lineWidth = 2.4;
  c.beginPath(); for (const p of puffs) { c.moveTo(p[0] + p[2], p[1]); c.arc(p[0], p[1], p[2], 0, 7); } c.fill();
  c.fillStyle = '#566590';
  c.beginPath(); c.arc(-10, -16, 11, Math.PI, Math.PI * 1.75); c.arc(14, -18, 12, Math.PI * 1.1, Math.PI * 1.7); c.lineWidth = 0; c.fill();
  // barriga mais escura
  c.fillStyle = 'rgba(20,28,56,.45)'; c.beginPath(); c.ellipse(0, 16, 34, 8, 0, 0, 7); c.fill();
  // carinha zangada
  c.fillStyle = '#f4f7ff'; c.beginPath(); c.ellipse(-9, 0, 4.4, 5, 0, 0, 7); c.ellipse(9, 0, 4.4, 5, 0, 0, 7); c.fill();
  c.fillStyle = '#10162e'; c.beginPath(); c.arc(-8, 1, 2.2, 0, 7); c.arc(10, 1, 2.2, 0, 7); c.fill();
  c.strokeStyle = '#10162e'; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(-16, -8); c.lineTo(-4, -4); c.moveTo(16, -8); c.lineTo(4, -4); c.stroke();
  c.beginPath(); c.arc(0, 14, 5, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  // raio carregando
  const g = c.createRadialGradient(0, 28, 1, 0, 28, 8 + charge * 24);
  g.addColorStop(0, 'rgba(255,248,170,' + (.4 + charge * .6) + ')'); g.addColorStop(1, 'rgba(255,230,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 28, 8 + charge * 24, 0, 7); c.fill();
  c.restore();
}

/* ====== ARENA (um jogador) ====== */
const partsOf = b => (b.parts.length > 1 ? b.parts.slice(1) : b.parts);
const held = (keys, list) => list.some(k => keys.has(k));
const keysDown = new Set();

class Arena {
  constructor(canvas, opt) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.ctrl = opt.ctrl; this.look = opt.look; this.name = opt.name; this.limit = opt.limit || 0;
    this.seed = (opt.seed != null ? opt.seed : Math.random() * 2147483647) >>> 0;
    this.stars = makeStars();
    this.touch = null; this.tx = WW / 2; this.hint = IS_TOUCH ? 7 : 0;
    this.bindTouch();
    this.reset();
  }
  /* Gestos: arrastar = mover (encaixa de meio em meio bloco) · toque rápido = girar · puxar o dedo para baixo = cair rápido */
  bindTouch() {
    const cv = this.cv;
    const toL = dx => dx * WW / Math.max(1, cv.getBoundingClientRect().width);
    cv.addEventListener('pointerdown', e => {
      if (this.touch || Game.paused || Game.over) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      this.touch = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, ay: e.clientY, t0: performance.now(), moved: false, down: false };
      this.tx = this.cur ? this.cur.position.x : WW / 2; this.hint = 0;
    });
    cv.addEventListener('pointermove', e => {
      const t = this.touch; if (!t || t.id !== e.pointerId) return;
      e.preventDefault();
      const mx = e.clientX - t.lx, my = e.clientY - t.ly; t.lx = e.clientX; t.ly = e.clientY;
      let first = false;
      if (!t.moved && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > DEADZONE) { t.moved = true; first = true; t.ay = e.clientY - my; }
      if (!t.moved) return;
      // movimento mais horizontal (ou para cima) zera a "âncora" de descida: arrastar de lado com a mão torta não faz a peça cair
      if (Math.abs(mx) > Math.abs(my) || my < 0) t.ay = e.clientY;
      t.down = (e.clientY - t.ay) > DROP_PX;
      if (!t.down) this.tx += toL(first ? e.clientX - t.sx : mx) * DRAG_GAIN;
    });
    const end = e => {
      const t = this.touch; if (!t || t.id !== e.pointerId) return;
      if (e.type === 'pointerup' && !t.moved && performance.now() - t.t0 < 350) this.rotate();
      this.touch = null;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  reset() {
    this.engine = Engine.create({ gravity: { x: 0, y: 1 } });
    this.engine.positionIterations = 10; this.engine.velocityIterations = 8;
    this.world = this.engine.world;
    this.base = Bodies.rectangle(WW / 2, BASE_Y + 15, BASE_W, 30, { isStatic: true, friction: FRICTION, frictionStatic: FRICTION_STATIC, restitution: 0, label: 'base' });
    Composite.add(this.world, this.base);
    this.rb = mulberry32(this.seed ^ 0x9e3779b9); this.rc = mulberry32(this.seed ^ 0x85ebca6b); this.re = mulberry32(this.seed ^ 0xc2b2ae35);
    this.placed = []; this.live = []; this.cur = null; this.bag = []; this.coinsField = []; this.pops = [];
    this.next = this.draw7();
    this.lives = LIVES; this.height = 0; this.record = 0; this.earned = 0;
    this.camY = CAM0; this.t = 0; this.cpLevel = CP_FIRST; this.cpFlash = 0; this.tools = TOOLS_START; this.cement = false; this.calm = true; this.spawnIn = .5; this.wobble = 0;
    this.mood = 'idle'; this.moodT = 0; this.windAmt = 0; this.evt = null; this.evtIn = EVT_FIRST + this.re() * 4; this.fastLeft = 0; this.flash = 0; this.streaks = [];
    this.spawned = 0; this.endIn = null; this.finished = false;
  }
  draw7() {
    if (!this.bag.length) {
      this.bag = Object.keys(SHAPES);
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.rb() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
    }
    return this.bag.pop();
  }
  setMood(m, d) { this.mood = m; this.moodT = d; }
  pop(text, color) { this.pops.push({ text, color: color || '#ffd166', t: 0 }); }
  spawn() {
    if (this.limit && this.spawned >= this.limit) return;
    this.spawned++;
    const type = this.next; this.next = this.draw7();
    // opções novas a cada quadradinho (o Matter apaga "chamfer" do objeto) e atrito definido em cada parte E no corpo
    const parts_ = SHAPES[type].map(([cx, cy]) => Bodies.rectangle(cx * S, cy * S, S, S, { friction: FRICTION, frictionStatic: FRICTION_STATIC, restitution: 0, density: .002 }));
    const body = Body.create({ parts: parts_, friction: FRICTION, frictionStatic: FRICTION_STATIC, restitution: 0, frictionAir: .02, density: .002 });
    body.torre = { type, locked: false, sup: [], hull: null, fixed: false, glue: false, calmN: 0, age: 0 };
    Body.setPosition(body, { x: WW / 2, y: this.camY + 185 / ZOOM });
    this.tx = WW / 2;
    this.cur = body;       // a peça que cai NÃO está no motor de física: é movida pelo jogo, com encaixe exato
    if (this.coinsField.length < 2 && this.rc() < .55) this.coinsField.push({ x: WW * .3 + this.rc() * WW * .4, y: this.camY + 250 / ZOOM + this.rc() * 100 / ZOOM, t: this.rc() * 6 });
  }
  /* --- geometria (todas as peças pousadas são caixinhas alinhadas, então usamos os retângulos delas) --- */
  hits(body) {
    const bb = body.bounds, E = .6, bp = partsOf(body);
    for (const o of this.placed.concat([this.base])) {
      const ob = o.bounds;
      if (bb.max.x <= ob.min.x + E || bb.min.x >= ob.max.x - E || bb.max.y <= ob.min.y + E || bb.min.y >= ob.max.y - E) continue;
      for (const p of bp) for (const q of partsOf(o)) {
        if (p.bounds.max.x > q.bounds.min.x + E && p.bounds.min.x < q.bounds.max.x - E && p.bounds.max.y > q.bounds.min.y + E && p.bounds.min.y < q.bounds.max.y - E) return true;
      }
    }
    return false;
  }
  tryMove(dx, dy) {
    const b = this.cur; Body.translate(b, { x: dx, y: dy });
    if (this.hits(b)) { Body.translate(b, { x: -dx, y: -dy }); return false; }
    return true;
  }
  rotate() {
    if (!this.cur || this.cur.torre.locked || this.state() !== 'play') return;
    const b = this.cur;
    Body.rotate(b, Math.PI / 2);
    if (this.hits(b)) { Body.rotate(b, -Math.PI / 2); return; }   // não gira se for entrar em outra peça
    beep(520, .05, 'square', .02);
  }
  state() { return this._state || 'play'; }
  /* move a peça atual: encaixe lateral em "travas" + queda; ao tocar em algo, pousa */
  stepCur() {
    const b = this.cur, tch = this.touch;
    const down = held(keysDown, this.ctrl.down) || (tch && tch.down);
    const fall = down ? FALL_FAST : (this.fastLeft > 0 ? FALL * SPELL_MULT : FALL);
    let bd = b.bounds; const w = bd.max.x - bd.min.x;
    this.tx = clamp(this.tx, 4 + w / 2, WW - 4 - w / 2);
    const tl = clamp(Math.round((this.tx - w / 2 - WW / 2) / GRID) * GRID + WW / 2, 4, WW - 4 - w);
    let dx = clamp(tl - bd.min.x, -MOVE_MAX, MOVE_MAX);
    if (Math.abs(dx) > .01 && !this.tryMove(dx, 0)) { const h = Math.sign(dx) * Math.min(Math.abs(dx), 1.5); this.tryMove(h, 0); }
    let rem = fall;
    while (rem > 0) {
      const d = Math.min(rem, 1.5);
      if (this.tryMove(0, d)) { rem -= d; continue; }
      for (const f of [.75, .4, .2, .1]) if (this.tryMove(0, f)) break;
      this.land(); return;
    }
  }
  /* pouso: calcula o apoio. Se o centro de massa (com o peso de tudo que está em cima) passa da borda do apoio, a peça cai */
  supportOf(b) {
    const set = new Set(); let lo = 1e9, hi = -1e9;
    for (const p of partsOf(b)) for (const o of this.placed.concat([this.base])) {
      if (o === b) continue;
      for (const q of partsOf(o)) {
        if (Math.abs(q.bounds.min.y - p.bounds.max.y) > 1.6) continue;
        const a = Math.max(p.bounds.min.x, q.bounds.min.x), z = Math.min(p.bounds.max.x, q.bounds.max.x);
        if (z - a > 1) { lo = Math.min(lo, a); hi = Math.max(hi, z); if (o !== this.base) set.add(o); }
      }
    }
    return { bodies: Array.from(set), hull: hi > lo ? [lo, hi] : null };
  }
  chainCheck(N) {
    const anc = [], seen = new Set(), q = [N];
    while (q.length) { const x = q.pop(); if (seen.has(x)) continue; seen.add(x); anc.push(x); for (const s_ of x.torre.sup) if (this.placed.includes(s_)) q.push(s_); }
    const memo = new Map();
    const load = X => {
      if (memo.has(X)) return memo.get(X);
      let m = 0, mx = 0; for (const p of partsOf(X)) { m++; mx += (p.bounds.min.x + p.bounds.max.x) / 2; }
      for (const Y of this.placed) {
        if (Y.torre.glue || Y.torre.sup.indexOf(X) < 0) continue;
        const L = load(Y), k = 1 / Y.torre.sup.length; m += L.m * k; mx += L.mx * k;
      }
      const r = { m, mx }; memo.set(X, r); return r;
    };
    const bad = [];
    for (const X of anc) {
      const t_ = X.torre; if (t_.fixed || t_.glue) continue;
      if (!t_.hull) { bad.push({ X, dir: 0 }); continue; }
      const L = load(X), c = L.mx / L.m, h = t_.hull;
      if (c <= h[0] + .5 || c >= h[1] - .5) bad.push({ X, dir: c > (h[0] + h[1]) / 2 ? 1 : -1 });
    }
    return bad;
  }
  topple(bad) {
    const rel = new Set();
    const add = X => { if (rel.has(X)) return; rel.add(X); for (const Y of this.placed) if (Y.torre.sup.indexOf(X) >= 0) add(Y); };
    for (const o of bad) add(o.X);
    for (const X of rel) {
      X.torre.sup = []; X.torre.hull = null; X.torre.fixed = false; X.torre.calmN = 0; X.torre.age = 0;
      Body.setStatic(X, false); Body.setVelocity(X, { x: 0, y: 0 }); Body.setAngularVelocity(X, 0);
      if (!this.live.includes(X)) this.live.push(X);
    }
    for (const o of bad) if (o.dir) { Body.setVelocity(o.X, { x: o.dir * .6, y: 0 }); Body.setAngularVelocity(o.X, o.dir * .012); }
    this.pop('Sem apoio!', '#ff8fab'); sfx.lose();
  }
  freeze(b) {
    Body.setStatic(b, true); b.torre.fixed = true; b.torre.sup = []; b.torre.hull = null;
    const i = this.live.indexOf(b); if (i >= 0) this.live.splice(i, 1);
  }
  land() {
    const b = this.cur; this.cur = null; b.torre.locked = true;
    Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); Body.setPosition(b, { x: b.position.x, y: b.position.y });
    const sp = this.supportOf(b); b.torre.sup = sp.bodies; b.torre.hull = sp.hull;
    b.torre.flash = 1; this.placed.push(b); Composite.add(this.world, b); Body.setStatic(b, true);
    if (this.cement) { this.cement = false; b.torre.glue = true; b.torre.fixed = true; this.pop('Cimentado!', '#cfd8e8'); }
    else { const bad = this.chainCheck(b); if (bad.length) this.topple(bad); }
    this.spawnIn = .6; this.setMood('happy', .7); sfx.land();
    SAVE.blocks++; addCoins(1); this.earned += 1;
  }
  /* linha de pavimento: ao alcançá-la, a torre vira chão firme (blocos fixos) e a próxima linha sobe */
  pave() {
    for (const b of this.placed) { if (!b.isStatic) Body.setStatic(b, true); b.torre.fixed = true; b.torre.sup = []; }
    this.live = [];
    this.cpLevel = this.height + CP_STEP; this.cpFlash = 1; this.tools++;
    if (this.lives < LIVES) this.lives++;
    addCoins(10); this.earned += 10; sfx.rec(); this.setMood('happy', 1.2);
    this.pop('Pavimentado! +10', '#bff3ff'); this.pop('+1 cimento', '#cfd8e8');
  }
  useTool() {
    if (!this.cur || this.cur.torre.locked || this.state() !== 'play') return;
    if (this.cement) { this.cement = false; this.tools++; return; }
    if (this.tools <= 0) { this.pop('Sem cimento', '#ff8fab'); return; }
    this.tools--; this.cement = true; beep(380, .08, 'triangle', .03);
    this.pop('Cimento pronto!', '#cfd8e8');
  }
  loseCur() {
    if (this.cur) { Composite.remove(this.world, this.cur); this.cur = null; }
    this.lives--; this.spawnIn = .9; this.setMood('sad', 1.2); sfx.lose(); this.pop('Caiu!', '#ff8fab');
  }
  update(dt) {
    this.t += dt;
    if (this.hint > 0) this.hint -= dt;
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 'idle'; }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < 1.4);
    if (this.lives <= 0) { this._state = 'dead'; this.finished = true; return; }
    // eventos (vento e feitiço): sorteados pela semente, iguais para todos no duelo
    if (!this.evt) { this.evtIn -= dt; if (this.evtIn <= 0 && this.endIn === null) this.startEvent(); }
    else this.runEvent(dt);
    if (this.fastLeft > 0) this.fastLeft -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.windAmt) for (const b of this.live) Body.applyForce(b, b.position, { x: this.windAmt * WIND_FORCE * b.mass, y: 0 });
    this.streaks = this.streaks.filter(q => { q.x += q.sp * 60 * dt; return q.x > -140 && q.x < W + 140; });
    // peça atual
    if (this.cur && !this.cur.torre.locked) {
      const dir = (held(keysDown, this.ctrl.right) ? 1 : 0) - (held(keysDown, this.ctrl.left) ? 1 : 0);
      this.tx += dir * MOVE + this.windAmt * WIND_PUSH;
      const bd = this.cur.bounds;
      for (const k of this.coinsField) {
        if (k.x > bd.min.x - 9 && k.x < bd.max.x + 9 && k.y > bd.min.y - 9 && k.y < bd.max.y + 9) {
          k.got = true; addCoins(3); this.earned += 3; sfx.coin(); this.pop('+3', '#ffd166');
        }
      }
      this.coinsField = this.coinsField.filter(k => !k.got);
      this.stepCur();
      if (this.cur && this.cur.position.y > BASE_Y + 600) this.loseCur();
    }
    Engine.update(this.engine, 1000 / 60);
    for (let i = Math.max(0, this.placed.length - 4); i < this.placed.length; i++) { const t_ = this.placed[i].torre; if (t_.flash > 0) t_.flash = Math.max(0, t_.flash - dt * 3.5); }
    // peças que desabaram: quando param (ou passam de 6 s), viram chão firme; assim nada fica "tremendo"
    for (const b of this.live.slice()) {
      b.torre.age++;
      const calm = b.speed < .2 && Math.abs(b.angularSpeed || 0) < .004;
      b.torre.calmN = calm ? b.torre.calmN + 1 : 0;
      if (b.speed > 14) { const k = 14 / b.speed; Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k }); }
      if (b.torre.calmN > 25 || b.torre.age > 360) this.freeze(b);
    }
    // peças caídas e altura da torre
    let top = BASE_Y, wob = 0;
    for (const b of this.placed.slice()) {
      if (b.position.y > BASE_Y + 600) {
        Composite.remove(this.world, b); this.placed.splice(this.placed.indexOf(b), 1); const li = this.live.indexOf(b); if (li >= 0) this.live.splice(li, 1);
        this.lives--; this.setMood('sad', 1.2); sfx.lose(); this.pop('Caiu!', '#ff8fab'); continue;
      }
      wob += b.speed + Math.abs(b.angularSpeed) * 20;
      if (b.speed < .6 && b.position.y < BASE_Y + 50) top = Math.min(top, b.bounds.min.y);
    }
    this.height = Math.max(0, BASE_Y - top);
    this.calm = this.live.length === 0;
    if (this.cpFlash > 0) this.cpFlash -= dt;
    if (this.height >= this.cpLevel && this.calm && this.cur) this.pave();
    this.wobble += (wob - this.wobble) * .08;
    if (this.mood === 'idle' && this.wobble > 4 && this.placed.length > 2) this.setMood('scared', .3);
    if (this.height >= this.record + 100) {
      this.record = Math.floor(this.height / 100) * 100; addCoins(5); this.earned += 5; sfx.rec(); this.setMood('happy', 1); this.pop('Novo recorde! +5', '#9be59f');
    }
    this.coinsField = this.coinsField.filter(k => k.y < BASE_Y - this.height + 10);
    this.camY += (Math.min(CAM0, BASE_Y - this.height - WH * .47) - this.camY) * .05;
    if (!this.cur) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0 && this.lives > 0 && this.live.length === 0) {
        if (this.limit && this.spawned >= this.limit) { if (this.endIn === null) this.endIn = 2.8; }
        else this.spawn();
      }
    }
    if (this.endIn !== null) { this.endIn -= dt; if (this.endIn <= 0) this.finished = true; }
  }
  startEvent() {
    const wind = this.re() < .55;
    this.evt = { kind: wind ? 'wind' : 'spell', t: 0, dir: this.re() < .5 ? -1 : 1, fired: false };
  }
  runEvent(dt) {
    const e = this.evt; e.t += dt;
    if (e.kind === 'wind') {
      const WARN = 1.6, BLOW = 4;
      if (e.t < WARN) this.windAmt = 0;
      else if (e.t < WARN + BLOW) {
        this.windAmt = e.dir * Math.sin(Math.PI * (e.t - WARN) / BLOW);
        if (Math.random() < .7) this.streaks.push({ x: e.dir > 0 ? -30 : W + 30, y: 70 + Math.random() * (H - 140), len: 40 + Math.random() * 60, sp: e.dir * (7 + Math.random() * 6) });
      } else this.endEvent();
    } else {
      if (e.t > 1.7 && !e.fired) { e.fired = true; this.fastLeft = SPELL_TIME; this.flash = .7; this.pop('Tempestade! Peças mais rápidas', '#ffe27a'); sfx.spell(); }
      if (e.t > 2.8) this.endEvent();
    }
  }
  endEvent() { this.evt = null; this.windAmt = 0; this.evtIn = 12 + this.re() * 8; }
  drawEvent(c) {
    const e = this.evt; if (!e || e.kind !== 'spell') return;
    const t = e.t, ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
    let x = W + 90;
    if (t < .8) x = W + 90 - (W + 90 - (W - 66)) * ease(t / .8);
    else if (t < 2) x = W - 66;
    else x = W - 66 + 160 * clamp((t - 2) / .8, 0, 1);
    const y = 300, sc = 1.45, charge = clamp((t - .8) / .9, 0, 1) * (t < 1.8 ? 1 : 1.4);
    drawVillain(c, x, y, sc, this.t, charge);
    const tipX = x, tipY = y + 28 * sc;
    if (t > 1.45 && t < 1.95 && this.cur) {
      const p = (t - 1.45) / .5, tx = this.cur.position.x * ZOOM, ty = (this.cur.position.y - this.camY) * ZOOM;
      const px = tipX + (tx - tipX) * p, py = tipY + (ty - tipY) * p;
      const g = c.createRadialGradient(px, py, 1, px, py, 16); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(.5, 'rgba(255,225,90,.85)'); g.addColorStop(1, 'rgba(255,190,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, 16, 0, 7); c.fill();
    }
  }


  /* faixa-guia: mostra a coluna da peça e onde ela vai pousar (como no 99 Bricks) */
  dropGap() {
    const b = this.cur; let gap = 1e9;
    for (const p of partsOf(b)) for (const o of this.placed.concat([this.base])) for (const q of partsOf(o)) {
      if (p.bounds.max.x > q.bounds.min.x + .6 && p.bounds.min.x < q.bounds.max.x - .6 && q.bounds.min.y >= p.bounds.max.y - .6) gap = Math.min(gap, q.bounds.min.y - p.bounds.max.y);
    }
    return gap;
  }
  drawGuide(c) {
    const b = this.cur; if (!b) return;
    const bd = b.bounds, gap = this.dropGap(), y0 = this.camY - 40, y1 = gap < 1e8 ? bd.max.y + gap : this.camY + WH + 40;
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(190,240,255,0)'); g.addColorStop(.35, 'rgba(190,240,255,.10)'); g.addColorStop(1, 'rgba(190,240,255,.22)');
    c.fillStyle = g; c.fillRect(bd.min.x, y0, bd.max.x - bd.min.x, y1 - y0);
    if (gap < 1e8) { c.fillStyle = 'rgba(220,250,255,.55)'; c.fillRect(bd.min.x, y1 - 2, bd.max.x - bd.min.x, 2); }
  }
  drawCheckpoint(c) {
    const y = BASE_Y - this.cpLevel, d = 28, n = Math.ceil(WW / d);
    c.save();
    const near = clamp(1 - (this.cpLevel - this.height) / 120, 0, 1);
    c.shadowColor = '#bff3ff'; c.shadowBlur = 8 + near * 14;
    c.fillStyle = 'rgba(190,245,255,' + (.5 + near * .4) + ')'; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
    for (let i = 0; i < n; i++) { const x = d * (i + .5); c.beginPath(); c.moveTo(x, y - d * .5); c.lineTo(x + d * .5, y); c.lineTo(x, y + d * .5); c.lineTo(x - d * .5, y); c.closePath(); c.fill(); c.stroke(); }
    c.shadowBlur = 0; c.fillStyle = '#e9fbff'; c.font = '700 24px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('PAVIMENTO', 14, y - d * .5 - 10);
    c.restore();
  }

  /* --- desenho --- */
  render() {
    const c = this.ctx, L = this.look();
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(c, THEMES[L.theme] || THEMES.noite, this.height * ZOOM, this.t, this.stars, this.camY * ZOOM);
    c.save(); c.scale(ZOOM, ZOOM); c.translate(0, -this.camY);
    drawBase(c, L.base, this.t, WW / 2);
    if (this.goal) {
      const gy = BASE_Y - GOAL;
      c.strokeStyle = 'rgba(255,230,120,.9)'; c.lineWidth = 3; c.setLineDash([14, 10]); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffd166'; c.font = '600 16px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('★ META', 12, gy + 22);
    }
    this.drawCheckpoint(c);
    for (const k of this.coinsField) {
      const yy = k.y + Math.sin(this.t * 3 + k.t) * 4, sc = Math.abs(Math.cos(this.t * 2.5 + k.t));
      c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 10; c.fillStyle = '#ffc300'; c.strokeStyle = '#a86b00'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(k.x, yy, 3 + 8 * sc, 11, 0, 0, 7); c.fill(); c.stroke(); c.restore();
    }
    this.drawGuide(c, L);
    const all = this.cur ? this.placed.concat([this.cur]) : this.placed;
    for (const b of all) {
      const ps = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const p of ps) {
        drawPart(c, p, b.torre.type, L.blocks, this.t);
        if (b.torre.flash > 0) { c.save(); c.beginPath(); p.vertices.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)); c.closePath(); c.fillStyle = 'rgba(255,255,255,' + b.torre.flash * .75 + ')'; c.fill(); c.restore(); }
        if (b.torre.glue || (b === this.cur && this.cement)) {
          c.save(); c.beginPath(); p.vertices.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)); c.closePath();
          if (b.torre.glue) { c.fillStyle = 'rgba(225,232,245,.22)'; c.fill(); }
          else { c.shadowColor = '#ffffff'; c.shadowBlur = 24; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 5; c.stroke(); }
          c.restore();
        }
      }
    }
    c.restore();
    c.lineCap = 'round'; c.lineWidth = 2;
    for (const q of this.streaks) { c.strokeStyle = 'rgba(225,248,242,.3)'; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - Math.sign(q.sp) * q.len, q.y + 3); c.stroke(); }
    if (this.fastLeft > 0 || this.flash > 0) { c.fillStyle = 'rgba(130,60,210,' + (.08 + .04 * Math.sin(this.t * 8) + Math.max(0, this.flash) * .25) + ')'; c.fillRect(0, 0, W, H); }
    if (this.cpFlash > 0) { c.fillStyle = 'rgba(200,245,255,' + this.cpFlash * .35 + ')'; c.fillRect(0, 0, W, H); }
    this.drawEvent(c);
    this.drawHud(c, L);
  }
  drawHud(c, L) {
    const hb = c.createLinearGradient(0, 0, 0, 110); hb.addColorStop(0, 'rgba(0,10,20,.55)'); hb.addColorStop(1, 'rgba(0,10,20,0)');
    c.fillStyle = hb; c.fillRect(0, 0, W, 110);
    // mascote em uma pedrinha, sempre visível
    c.save(); c.fillStyle = 'rgba(30,70,60,.85)'; c.beginPath(); c.ellipse(52, H - 36, 40, 9, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(18, H - 34); c.lineTo(86, H - 34); c.lineTo(62, H - 10); c.lineTo(40, H - 16); c.closePath(); c.fill(); c.restore();
    drawMascot(c, 52, H - 36, 1.05, L.mascot, L.hat, this.lives <= 0 ? 'sad' : this.mood, this.t);
    // vidas
    for (let i = 0; i < LIVES; i++) {
      c.save(); c.translate(26 + i * 28, 28); c.fillStyle = i < this.lives ? '#ff6b8a' : 'rgba(255,255,255,.15)'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-14, -4, -8, -14, 0, -7); c.bezierCurveTo(8, -14, 14, -4, 0, 6); c.fill(); c.stroke(); c.restore();
    }
    c.fillStyle = '#cfeee4'; c.font = '600 14px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText(this.name, 14, 56);
    // altura
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '700 36px "Cormorant Garamond", "GFS Baskerville", Georgia, serif';
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.fillText((this.height / 50).toFixed(1) + ' m', W / 2, 36); c.restore();
    c.font = '500 13px Outfit, Inter, system-ui, sans-serif'; c.fillStyle = '#bfe6da';
    c.fillText(this.limit ? 'peça ' + Math.min(this.spawned, this.limit) + ' / ' + this.limit : 'recorde: ' + (Math.max(SAVE.best, this.height) / 50).toFixed(1) + ' m', W / 2, 54);
    // moedas
    c.textAlign = 'right'; c.fillStyle = '#ffd166'; c.font = '700 20px Outfit, Inter, system-ui, sans-serif'; c.fillText(String(SAVE.coins), W - 38, 30);
    c.fillStyle = '#ffc300'; c.strokeStyle = '#a86b00'; c.lineWidth = 2; c.beginPath(); c.arc(W - 22, 24, 9, 0, 7); c.fill(); c.stroke();
    // próxima peça
    c.fillStyle = 'rgba(0,0,0,.3)'; c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect ? c.roundRect(W - 84, 44, 70, 54, 12) : c.rect(W - 84, 44, 70, 54); c.fill(); c.stroke();
    c.fillStyle = '#9fd1c2'; c.font = '500 11px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('PRÓXIMA', W - 49, 57);
    const cs = SHAPES[this.next], s2 = 11;
    cs.forEach(([cx, cy], i) => drawPart(c, quadFake(W - 49 + cx * s2 - s2 / 2, 78 + cy * s2 - s2 / 2, s2, i + 1), this.next, L.blocks, this.t));
    // vento
    const ev = this.evt;
    if (ev && ev.kind === 'wind') {
      const warn = ev.t < 1.6; c.font = '600 18px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = warn ? '#ffe08a' : '#bfe6da';
      if (!warn || Math.floor(ev.t * 4) % 2 === 0) c.fillText(warn ? 'vento chegando…' : (ev.dir > 0 ? 'vento ➜' : '⬅ vento'), W / 2, 84);
    }
    if (this.fastLeft > 0) {
      c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 62, 90, 124, 9, 4.5) : c.rect(W / 2 - 62, 90, 124, 9); c.fill();
      c.fillStyle = '#c486ff'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 62, 90, 124 * this.fastLeft / SPELL_TIME, 9, 4.5) : c.rect(W / 2 - 62, 90, 124 * this.fastLeft / SPELL_TIME, 9); c.fill();
      c.fillStyle = '#e2c4ff'; c.font = '600 12px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('TEMPESTADE · peças rápidas', W / 2, 114);
    }
    // avisos
    for (const p of this.pops) {
      c.globalAlpha = clamp(1.4 - p.t, 0, 1); c.fillStyle = p.color; c.font = '700 24px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center';
      c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6; c.fillText(p.text, W / 2, 196 - p.t * 28 + this.pops.indexOf(p) * 30); c.restore(); c.globalAlpha = 1;
    }
    if (this.hint > 0 && this.lives > 0) {
      c.save(); c.globalAlpha = clamp(this.hint, 0, 1);
      c.fillStyle = 'rgba(6,24,30,.8)'; c.strokeStyle = 'rgba(190,255,230,.25)'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect ? c.roundRect(36, 250, W - 72, 132, 22) : c.rect(36, 250, W - 72, 132); c.fill(); c.stroke();
      c.fillStyle = '#eafff6'; c.font = '600 20px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('↔  Arraste: mover', W / 2, 293); c.fillText('◉  Toque: girar', W / 2, 326); c.fillText('↓  Deslize p/ baixo: cair', W / 2, 359);
      c.restore();
    }
    if (this.lives <= 0) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '700 34px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('Fim!', W / 2, H / 2); }
  }
}

/* ====== CONTROLE DO JOGO ====== */
const Game = { mode: null, arenas: [], running: false, paused: false, over: false, last: 0, acc: 0, raf: 0, duel: null };
const CTRL_SOLO = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], rot: ['ArrowUp', 'KeyW', 'Space'], down: ['ArrowDown', 'KeyS'] };
const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = h => (h / 50).toFixed(1) + ' m';

const SCREENS = ['menu', 'shop', 'profile', 'help', 'duel', 'game'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  $('nav').classList.toggle('hidden', id === 'game');
  const on = id === 'duel' ? 'menu' : id;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === on));
}
function levelInfo() {
  const xp = SAVE.xp || 0, lvl = Math.floor(Math.sqrt(xp / 20)) + 1, a = 20 * (lvl - 1) * (lvl - 1), b = 20 * lvl * lvl;
  return { lvl, cur: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}
function refreshWallet() {
  for (const id of ['walletMenu', 'walletShop', 'walletProf']) $(id).textContent = SAVE.coins;
  const L = levelInfo(); $('lvlNum').textContent = L.lvl; $('xpFill').style.width = Math.round(L.pct * 100) + '%';
}
function openProfile() {
  refreshWallet(); show('profile');
  const L = levelInfo(), cv = $('profCv'); cv.width = 120 * DPR; cv.height = 120 * DPR;
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 120, 120);
  drawMascot(c, 60, 108, 2, SAVE.eq.mascot, SAVE.eq.hat, 'happy', 0);
  $('pLvl').textContent = 'Nv. ' + L.lvl; $('pXp').style.width = Math.round(L.pct * 100) + '%'; $('pXpTxt').textContent = L.cur + ' / ' + L.need + ' XP para o próximo nível';
  const rows = [['Recorde de altura', (SAVE.best / 50).toFixed(1) + ' m'], ['Moedas', SAVE.coins], ['Blocos empilhados', SAVE.blocks], ['Partidas', SAVE.games]];
  $('pStats').innerHTML = rows.map(r => '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
}
function go(id) { if (id === 'shop') openShop(); else if (id === 'menu') goMenu(); else if (id === 'profile') openProfile(); else if (id === 'help') show('help'); }
function openShopTab(t) { shopTab = t; openShop(); }

const lookMine = () => SAVE.eq;
function lookRival() {
  const alt = ['estrela', 'flor', 'nuvem', 'abobora', 'fantasma'].find(m => m !== SAVE.eq.mascot);
  return Object.assign({}, SAVE.eq, { mascot: alt, hat: SAVE.eq.hat === 'coroa' ? 'nenhum' : 'coroa' });
}

function startGame(mode, o = {}) {
  stopLoop(); keysDown.clear();
  Game.mode = mode; Game.over = false; Game.paused = false; Game.arenas = [];
  if (mode === 'solo') Game.duel = null;
  fitWorld();
  const stage = $('stage'); stage.innerHTML = '';
  const cv = document.createElement('canvas'); cv.className = 'arena'; cv.width = W * DPR; cv.height = H * DPR; stage.appendChild(cv);
  Game.arenas.push(new Arena(cv, { ctrl: CTRL_SOLO, look: o.look || lookMine, name: o.name || '', seed: o.seed, limit: o.limit || 0 }));
  $('overlay').classList.add('hidden');
  show('game'); layout();
  Game.running = true; Game.last = performance.now(); Game.acc = 0;
  Game.raf = requestAnimationFrame(loop);
}
function layout() {
  const coarse = matchMedia('(pointer:coarse)').matches, pad = coarse ? 0 : 8;
  const k = Math.max(.2, Math.min((innerWidth - pad * 2) / W, (innerHeight - pad * 2) / H, 1.7));
  for (const a of Game.arenas) { a.cv.style.width = (W * k) + 'px'; a.cv.style.height = (H * k) + 'px'; }
  const tb = $('gTool'); if (tb) tb.classList.toggle('hidden', !Game.arenas.length);
}
window.addEventListener('resize', layout); window.addEventListener('orientationchange', () => setTimeout(layout, 200));
function stopLoop() { Game.running = false; cancelAnimationFrame(Game.raf); }
function loop(now) {
  if (!Game.running) return;
  const dt = Math.min(.1, (now - Game.last) / 1000); Game.last = now;
  if (!Game.paused && !Game.over) {
    Game.acc += dt;
    while (Game.acc >= 1 / 60) { for (const a of Game.arenas) a.update(1 / 60); Game.acc -= 1 / 60; checkEnd(); if (Game.over) break; }
  }
  for (const a of Game.arenas) a.render();
  syncTool();
  Game.raf = requestAnimationFrame(loop);
}
function checkEnd() {
  if (Game.over) return;
  const a = Game.arenas[0];
  if (Game.mode === 'solo' ? a.lives <= 0 : a.finished) finish();
}
function finish() {
  Game.over = true;
  const a = Game.arenas[0], prev = SAVE.best;
  SAVE.games++; if (a.height > SAVE.best) SAVE.best = Math.round(a.height); persist();
  if (Game.mode === 'duel') return duelFinish(a);
  const rec = a.height > prev && prev > 0;
  if (rec) sfx.win();
  showOverlay('<h2>' + (rec ? 'Novo recorde!' : 'Fim de jogo') + '</h2><p>Altura: ' + fmt(a.height) + ' · Recorde: ' + fmt(SAVE.best) + '</p><p>Moedas ganhas: <b class="gold">' + a.earned + '</b></p>' +
    '<button class="btn" id="oAgain">Jogar de novo</button><button class="btn alt" id="oShop">Loja</button><button class="btn alt" id="oMenu">Menu</button>');
  $('oAgain').onclick = () => startGame('solo');
  $('oShop').onclick = () => { stopLoop(); openShop(); };
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
}

/* ====== DUELO (por turnos): cada um monta a sua torre com a MESMA sequência de peças e eventos ====== */
const newSeed = () => (Math.random() * 2147483647) >>> 0;
const cmp = (x, y) => { const hx = Math.round(x.h / 5), hy = Math.round(y.h / 5); if (hx !== hy) return hx > hy ? 1 : -1; return x.l === y.l ? 0 : x.l > y.l ? 1 : -1; };
function nameIn(id, fb) { return $(id).value.trim().slice(0, 12) || fb; }
function openDuel() { $('nameA').value = SAVE.name || ''; $('nameB').value = SAVE.nameB || ''; show('duel'); }
function duelStart(kind, names, chal) {
  Game.duel = { kind, seed: chal ? chal.seed : newSeed(), names, res: [null, null], turn: 0, chal: chal || null };
  duelRun(kind === 'recv' ? 1 : 0);
}
function duelLocal() {
  SAVE.name = $('nameA').value.trim().slice(0, 12); SAVE.nameB = $('nameB').value.trim().slice(0, 12); persist();
  duelStart('local', [nameIn('nameA', 'Jogador 1'), nameIn('nameB', 'Jogador 2')]);
}
function duelSend() {
  SAVE.name = $('nameA').value.trim().slice(0, 12); persist();
  duelStart('send', [nameIn('nameA', 'Jogador 1'), '']);
}
function duelRun(i) {
  const d = Game.duel, mine = !(d.kind === 'local' && i === 1);
  d.turn = i;
  startGame('duel', { seed: d.seed, limit: DUEL_PIECES, name: d.names[i], look: mine ? lookMine : lookRival });
  Game.paused = true;
  const target = d.kind === 'recv' ? '<p>Torre a bater: <b class="gold">' + fmt(d.chal.h) + '</b> (' + esc(d.chal.n) + ')</p>' : '';
  showOverlay('<h2>Vez de ' + esc(d.names[i]) + '</h2><p>' + DUEL_PIECES + ' peças. Mesma sequência, vento e feitiços para todos.</p>' + target +
    '<button class="btn" id="oGo">Começar</button><button class="btn alt" id="oMenu">Cancelar</button>');
  $('oGo').onclick = () => { $('overlay').classList.add('hidden'); Game.paused = false; Game.last = performance.now(); };
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
}
function duelFinish(a) {
  const d = Game.duel, res = { h: Math.round(a.height), l: a.lives };
  d.res[d.turn] = res;
  if (d.kind === 'local') {
    if (d.turn === 0) {
      showOverlay('<h2>' + esc(d.names[0]) + '</h2><p>Torre: <b class="gold">' + fmt(res.h) + '</b></p><p>Agora é a vez de <b>' + esc(d.names[1]) + '</b>, com as mesmas peças!</p>' +
        '<button class="btn" id="oNext">Passar para ' + esc(d.names[1]) + '</button><button class="btn alt" id="oMenu">Cancelar</button>');
      $('oNext').onclick = () => duelRun(1);
      $('oMenu').onclick = () => { stopLoop(); goMenu(); };
      return;
    }
    return duelResult(d.names, d.res);
  }
  if (d.kind === 'recv') return duelResult([d.chal.n, d.names[1]], [{ h: d.chal.h, l: d.chal.l }, res]);
  const link = makeLink(d, res);
  showOverlay('<h2>Sua torre: ' + fmt(res.h) + '</h2><p>Envie o link para um amigo tentar bater!</p>' +
    '<button class="btn" id="oShare">Enviar desafio</button><button class="btn alt" id="oCopy">Copiar link</button><button class="btn alt" id="oMenu">Menu</button>');
  $('oShare').onclick = () => shareLink(link, res.h);
  $('oCopy').onclick = () => copyLink(link, $('oCopy'));
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
}
function duelResult(names, res) {
  const c = cmp(res[0], res[1]), d = Game.duel; sfx.win();
  const side = (i, w) => '<div class="' + (w ? 'win' : '') + '"><span>' + (w ? '✦ ' : '') + esc(names[i]) + '</span><b>' + fmt(res[i].h) + '</b></div>';
  showOverlay('<h2>' + (c === 0 ? 'Empate!' : esc(names[c > 0 ? 0 : 1]) + ' venceu!') + '</h2>' +
    '<div class="vs">' + side(0, c > 0) + '<em>×</em>' + side(1, c < 0) + '</div>' + (c === 0 ? '<p>Mesma altura e mesmas vidas.</p>' : '') +
    '<button class="btn" id="oAgain">' + (d.kind === 'recv' ? 'Desafiar de volta' : 'Revanche') + '</button><button class="btn alt" id="oMenu">Menu</button>');
  $('oAgain').onclick = () => { if (d.kind === 'recv') duelStart('send', [d.names[1], '']); else duelStart('local', d.names); };
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
}

/* desafio à distância por link (sem cadastro): o link leva a semente da partida e o resultado de quem desafiou */
function makeLink(d, res) {
  const p = { v: 1, sd: d.seed, n: d.names[0], h: res.h, l: res.l };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.href.split('#')[0] + '#d=' + b64;
}
function readLink() {
  const m = /^#d=([\w-]+)/.exec(location.hash); if (!m) return null;
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
    if (p && p.v === 1 && Number.isFinite(+p.sd) && Number.isFinite(+p.h)) return { seed: +p.sd >>> 0, n: String(p.n || 'Amigo').slice(0, 12), h: clamp(+p.h, 0, 6000), l: clamp(+p.l | 0, 0, LIVES) };
  } catch (e) {}
  return null;
}
async function shareLink(link, h) {
  const text = 'Bata a minha torre de ' + fmt(h) + ' no Brick by Brick!';
  try { if (navigator.share) { await navigator.share({ title: 'Brick by Brick', text, url: link }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  copyLink(link, $('oCopy'));
}
async function copyLink(link, btn) {
  try { await navigator.clipboard.writeText(link); if (btn) btn.textContent = 'Link copiado ✓'; }
  catch (e) { window.prompt('Copie o link do desafio:', link); }
}
function showChallenge(ch) {
  const m = $('modal');
  m.innerHTML = '<div class="panel"><h2>Desafio!</h2><p><b>' + esc(ch.n) + '</b> montou uma torre de <b class="gold">' + fmt(ch.h) + '</b>. Consegue bater?</p>' +
    '<input id="nameRecv" maxlength="12" placeholder="Seu nome" value="' + esc(SAVE.name || '') + '"><button class="btn" id="oAccept">Aceitar desafio</button><button class="btn alt" id="oDecline">Agora não</button></div>';
  m.classList.remove('hidden');
  const clear = () => { m.classList.add('hidden'); try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) {} };
  $('oDecline').onclick = clear;
  $('oAccept').onclick = () => {
    const me = $('nameRecv').value.trim().slice(0, 12) || 'Você'; SAVE.name = $('nameRecv').value.trim().slice(0, 12); persist(); clear();
    duelStart('recv', [ch.n, me], ch);
  };
}

function showOverlay(html) { const o = $('overlay'); o.innerHTML = '<div class="panel">' + html + '</div>'; o.classList.remove('hidden'); }
function setPause(p) {
  if (!Game.running || Game.over) return;
  Game.paused = p;
  if (p) {
    for (const a of Game.arenas) a.touch = null;
    showOverlay('<h2>Pausado</h2><button class="btn" id="oResume">Continuar</button><button class="btn alt" id="oMenu">Sair para o menu</button>');
    $('oResume').onclick = () => setPause(false);
    $('oMenu').onclick = () => { stopLoop(); goMenu(); };
  } else { $('overlay').classList.add('hidden'); Game.last = performance.now(); }
}
function goMenu() { $('overlay').classList.add('hidden'); refreshWallet(); show('menu'); }

/* ====== LOJA (interface) ====== */
let shopTab = 'blocks';
function preview(cv, cat, id) {
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 84, 84);
  if (cat === 'blocks') {
    ['T', 'O', 'L', 'I'].forEach((tp, i) => drawPart(c, quadFake(12 + (i % 2) * 30, 12 + Math.floor(i / 2) * 30, 28, i + 1), tp, id, 0));
  } else if (cat === 'theme') {
    c.save(); c.beginPath(); c.rect(0, 0, 84, 84); c.clip(); c.scale(84 / W, 84 / W);
    const st = makeStars(); drawSky(c, THEMES[id], 0, 1, st, 0); c.restore();
  } else if (cat === 'base') {
    c.save(); c.beginPath(); c.rect(0, 0, 84, 84); c.clip(); c.fillStyle = '#12403d'; c.fillRect(0, 0, 84, 84);
    c.scale(.34, .34); c.translate(-76, -BASE_Y + 41); drawBase(c, id, 0); c.restore();
  } else {
    const hat = cat === 'hat' ? id : SAVE.eq.hat, col = cat === 'mascot' ? id : SAVE.eq.mascot;
    drawMascot(c, 42, 74, 1.1, col, cat === 'mascot' ? 'nenhum' : hat, 'idle', 0);
  }
}
function renderShop() {
  refreshWallet();
  const tabs = $('tabs'); tabs.innerHTML = '';
  for (const k in CAT) {
    const b = document.createElement('button'); b.className = 'tab' + (k === shopTab ? ' on' : ''); b.textContent = CAT[k].label;
    b.onclick = () => { shopTab = k; renderShop(); }; tabs.appendChild(b);
  }
  const grid = $('grid'); grid.innerHTML = '';
  for (const it of CAT[shopTab].items) {
    const owned = SAVE.owned[shopTab].includes(it.id), eq = SAVE.eq[shopTab] === it.id;
    const d = document.createElement('div'); d.className = 'item' + (eq ? ' eq' : '');
    const cv = document.createElement('canvas'); cv.width = 84 * DPR; cv.height = 84 * DPR; d.appendChild(cv);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.n; d.appendChild(nm);
    const b = document.createElement('button'); b.className = 'btn' + (owned ? ' alt' : '');
    if (eq) { b.textContent = 'Em uso ✓'; b.disabled = true; }
    else if (owned) { b.textContent = 'Usar'; b.onclick = () => { SAVE.eq[shopTab] = it.id; persist(); renderShop(); }; }
    else {
      b.innerHTML = '<span class="coin" style="width:16px;height:16px;vertical-align:-3px"></span> ' + it.p;
      if (SAVE.coins < it.p) b.disabled = true;
      b.onclick = () => { if (SAVE.coins >= it.p) { SAVE.coins -= it.p; SAVE.owned[shopTab].push(it.id); SAVE.eq[shopTab] = it.id; persist(); sfx.coin(); renderShop(); } };
    }
    d.appendChild(b); grid.appendChild(d); preview(cv, shopTab, it.id);
  }
}
function openShop() { show('shop'); renderShop(); }

/* ====== EVENTOS ====== */
const BLOCK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
window.addEventListener('keydown', e => {
  if (!$('game').classList.contains('hidden')) {
    if (BLOCK_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) setPause(!Game.paused); return; }
    if (!e.repeat && !Game.paused && !Game.over) for (const a of Game.arenas) { if (a.ctrl.rot.includes(e.code)) a.rotate(); if (e.code === 'KeyE' || e.code === 'KeyC') a.useTool(); }
  }
  keysDown.add(e.code);
});
window.addEventListener('keyup', e => keysDown.delete(e.code));
window.addEventListener('blur', () => { keysDown.clear(); setPause(true); });
window.addEventListener('contextmenu', e => e.preventDefault());
$('btnSolo').onclick = () => startGame('solo');
$('btnDuo').onclick = openDuel;
$('btnDuelLocal').onclick = duelLocal;
$('btnDuelSend').onclick = duelSend;
$('btnShop').onclick = () => openShopTab('mascot');
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { stopLoop(); go(b.dataset.go); });
$('gPause').onclick = () => setPause(!Game.paused);
$('gTool').onclick = () => { const a = Game.arenas[0]; if (a && !Game.paused && !Game.over) a.useTool(); };
function syncTool() {
  const a = Game.arenas[0], b = $('gTool'); if (!a || !b) return;
  const n = String(a.tools); if (b.dataset.n !== n) { b.dataset.n = n; $('gToolN').textContent = n; }
  b.classList.toggle('armed', !!a.cement); b.classList.toggle('empty', a.tools <= 0 && !a.cement);
}
function toggleMute() { muted = !muted; document.body.classList.toggle('muted', muted); }
$('btnMute').onclick = toggleMute; $('gMute').onclick = toggleMute;

/* estrelinhas animadas no fundo do menu */
(function bgStars() {
  const cv = $('stars'), c = cv.getContext('2d'); let st = [];
  function size() { cv.width = innerWidth; cv.height = innerHeight; st = Array.from({ length: 80 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.8 + .4, p: Math.random() * 6 })); }
  size(); window.addEventListener('resize', size);
  (function f(t) { c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = '#fff'; for (const s of st) { c.globalAlpha = .3 + .6 * Math.abs(Math.sin(t / 900 + s.p)); c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); } requestAnimationFrame(f); })(0);
})();

(function hero() {
  const cv = $('hero'); if (!cv) return;
  const c = cv.getContext('2d'), HW = 400, HH = 360;
  cv.width = HW * DPR; cv.height = HH * DPR;
  const cells = [[115,160,'I'],[145,160,'I'],[175,160,'I'],[205,160,'I'],[145,130,'O'],[175,130,'O'],[145,100,'O'],[175,100,'O'],[145,70,'T'],[175,70,'T'],[205,70,'T'],[175,40,'T']];
  const st = Array.from({ length: 26 }, () => ({ x: rnd(0, HW), y: rnd(0, 230), r: rnd(.7, 2), p: rnd(0, 6) }));
  function frame(ms) {
    requestAnimationFrame(frame);
    if ($('menu').classList.contains('hidden')) return;
    const t = ms / 1000, L = SAVE.eq, bob = Math.sin(t * 1.2) * 4;
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, HW, HH);
    for (const s of st) { c.globalAlpha = .3 + .6 * Math.abs(Math.sin(t * 1.4 + s.p)); c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const hg = c.createRadialGradient(330, 62, 14, 330, 62, 58); hg.addColorStop(0, 'rgba(255,250,200,.35)'); hg.addColorStop(1, 'rgba(255,250,200,0)');
    c.fillStyle = hg; c.fillRect(260, 0, 140, 130);
    c.save(); c.beginPath(); c.rect(0, 0, HW, HH); c.arc(341, 56, 21, 0, 7); c.clip('evenodd'); c.fillStyle = '#f6f2d0'; c.beginPath(); c.arc(330, 62, 25, 0, 7); c.fill(); c.restore();
    floatIsland(c, 52, 118 + Math.sin(t) * 5, .7, 'rgba(10,45,48,.75)'); floatIsland(c, 352, 250 + Math.sin(t + 2) * 5, .55, 'rgba(10,45,48,.75)');
    for (const [kx, ky, o] of [[70, 60, 0], [345, 150, 2]]) {
      const yy = ky + Math.sin(t * 2.4 + o) * 5, sc = Math.abs(Math.cos(t * 2 + o));
      c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 10; c.fillStyle = '#ffc300'; c.strokeStyle = '#a86b00'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(kx, yy, 3 + 8 * sc, 11, 0, 0, 7); c.fill(); c.stroke(); c.restore();
    }
    c.save(); c.translate(0, bob);
    c.save(); c.translate(0, 190 - BASE_Y); drawBase(c, L.base, t); c.restore();
    c.save(); c.translate(175, 190); c.rotate(Math.sin(t * 1.3) * .012); c.translate(-175, -190);
    cells.forEach((q, i) => drawPart(c, quadFake(q[0], q[1], 30, i + 1), q[2], L.blocks, t)); c.restore();
    drawMascot(c, 268, 190, 1.35, L.mascot, L.hat, (t % 4) > 3 ? 'happy' : 'idle', t);
    c.restore();
    // balão de recorde (como o balão de coração das referências)
    const txt = 'Recorde ' + (SAVE.best / 50).toFixed(1) + ' m';
    c.font = '600 15px Outfit, Inter, system-ui, sans-serif'; const bw = c.measureText(txt).width + 46, bx = 175 - bw / 2, by = 4;
    c.fillStyle = 'rgba(6,26,30,.92)'; c.strokeStyle = 'rgba(170,215,198,.4)'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, 27, 13.5) : c.rect(bx, by, bw, 27); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(166, by + 26); c.lineTo(175, by + 35); c.lineTo(184, by + 26); c.closePath(); c.fill();
    c.fillStyle = '#f2c46d'; sparkle(c, bx + 17, by + 13.5, 7); c.fill();
    c.fillStyle = '#e9f6ef'; c.textAlign = 'left'; c.fillText(txt, bx + 31, by + 19);
  }
  requestAnimationFrame(frame);
})();

refreshWallet();
{ const ch = readLink(); if (ch) setTimeout(() => showChallenge(ch), 500); }
window.__torre = { startGame, openShop, Game, SAVE, Arena, CAT, drawMascot, step(n){ for(let i=0;i<n;i++){ for(const a of Game.arenas) a.update(1/60); checkEnd(); if(Game.over) break; } for(const a of Game.arenas) a.render(); } };

/* ====== LOGIN COM GOOGLE (Supabase) — opcional; sem config.js o jogo funciona como visitante ====== */
function scheduleSync() { if (!sb || !authUser) return; clearTimeout(syncT); syncT = setTimeout(pushCloud, 2500); }
async function pushCloud() {
  if (!sb || !authUser) return;
  try {
    const { error } = await sb.from('profiles').upsert({ id: authUser.id, data: SAVE, updated_at: new Date().toISOString() });
    setSyncMsg(error ? 'Não foi possível sincronizar agora.' : 'Progresso salvo na nuvem.');
  } catch (e) { setSyncMsg('Não foi possível sincronizar agora.'); }
}
function setSyncMsg(t) { const el = $('acctSync'); if (el) el.textContent = t; }
// junta nuvem + aparelho sem perder nada: maiores números, todos os itens comprados
function mergeSaves(a, b) {
  const m = defaults();
  for (const k of ['coins', 'best', 'xp', 'blocks', 'games']) m[k] = Math.max(a[k] || 0, b[k] || 0);
  for (const k in m.owned) m.owned[k] = Array.from(new Set((a.owned[k] || []).concat(b.owned[k] || [])));
  m.eq = Object.assign({}, a.eq); m.name = a.name || b.name; m.nameB = a.nameB || b.nameB;
  return normalize(m);
}
async function pullCloud() {
  try {
    const { data, error } = await sb.from('profiles').select('data').eq('id', authUser.id).maybeSingle();
    if (error) throw error;
    const merged = data && data.data ? mergeSaves(normalize(data.data), SAVE) : SAVE;
    Object.assign(SAVE, merged); persist(); refreshWallet(); await pushCloud();
  } catch (e) { setSyncMsg('Não foi possível sincronizar agora.'); }
}
function renderAcct() {
  const cfg = window.BBB_CONFIG, on = !!sb;
  $('acctOff').classList.toggle('hidden', on);
  $('acctGuest').classList.toggle('hidden', !on || !!authUser);
  $('acctUser').classList.toggle('hidden', !on || !authUser);
  if (authUser) {
    const m = authUser.user_metadata || {};
    $('acctName').textContent = m.full_name || m.name || 'Jogador';
    $('acctMail').textContent = authUser.email || '';
    $('acctAv').style.backgroundImage = m.avatar_url || m.picture ? 'url("' + (m.avatar_url || m.picture) + '")' : '';
    if (!SAVE.name && (m.full_name || m.name)) { SAVE.name = String(m.full_name || m.name).split(' ')[0].slice(0, 12); }
  }
}
function initAuth() {
  const cfg = window.BBB_CONFIG;
  if (cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/COLE_/.test(cfg.SUPABASE_URL) && window.supabase) {
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }
  }
  renderAcct();
  if (!sb) return;
  $('btnGoogle').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  $('btnLogout').onclick = async () => { await sb.auth.signOut(); authUser = null; renderAcct(); };
  sb.auth.onAuthStateChange((ev, session) => {
    const u = session && session.user ? session.user : null;
    const first = u && (!authUser || authUser.id !== u.id);
    authUser = u; renderAcct();
    if (first) setTimeout(pullCloud, 0);   // fora do callback, como recomenda o Supabase
  });
}
initAuth();
})();
