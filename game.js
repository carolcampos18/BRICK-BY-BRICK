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
const W = 400, H = 700;        // tamanho lógico de cada arena
const S = 30;                  // tamanho de cada quadradinho do bloco
const BASE_Y = 560;            // altura da superfície da ilha
const BASE_W = 200;            // largura da ilha
const GOAL = 600;              // altura da meta no modo 2 jogadores
const LIVES = 3;               // blocos que podem cair antes de perder
const FALL = 2.0;              // velocidade normal de queda
const FALL_FAST = 9;           // velocidade ao segurar "descer"
const MOVE = 4.2;              // velocidade lateral
const WIND_FORCE = 0.00004;    // força do vento (0 desliga)
const WIND_FROM_HEIGHT = 150;  // vento só começa depois dessa altura
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
  mascot: { label:'Mascote', items:[
    {id:'branco',n:'Nuvi',p:0},{id:'rosa',n:'Rosinha',p:40},{id:'menta',n:'Menta',p:40},
    {id:'azul',n:'Azulzinho',p:60},{id:'dourado',n:'Dourado',p:150}]},
};
const MASCOT_COL = { branco:'#f6f3ea', rosa:'#ffc6d9', menta:'#bff0d0', azul:'#bcd7ff', dourado:'#ffe08a' };
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
    owned:{ blocks:['geleia'], theme:['noite'], base:['ilha'], hat:['nenhum'], mascot:['branco'] },
    eq:{ blocks:'geleia', theme:'noite', base:'ilha', hat:'nenhum', mascot:'branco' } };
}
function loadSave() {
  const d = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      d.coins = +s.coins || 0; d.best = +s.best || 0; d.xp = +s.xp || 0; d.blocks = +s.blocks || 0; d.games = +s.games || 0;
      for (const k in d.owned) {
        if (s.owned && Array.isArray(s.owned[k])) d.owned[k] = Array.from(new Set(d.owned[k].concat(s.owned[k])));
        if (s.eq && typeof s.eq[k] === 'string' && d.owned[k].includes(s.eq[k])) d.eq[k] = s.eq[k];
      }
    }
  } catch (e) {}
  return d;
}
const SAVE = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
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
function drawBase(c, id, t) {
  const x0 = W / 2 - BASE_W / 2 - 4, x1 = W / 2 + BASE_W / 2 + 4, y = BASE_Y;
  c.save(); c.lineJoin = 'round';
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
function drawMascot(c, x, y, s, colId, hatId, mood, t) {
  const col = MASCOT_COL[colId] || MASCOT_COL.branco;
  let bob = 0, sx = 0;
  if (mood === 'idle') bob = Math.sin(t * 2.2) * 1.6;
  else if (mood === 'happy') bob = -Math.abs(Math.sin(t * 11)) * 11;
  else if (mood === 'scared') sx = Math.sin(t * 45) * 1.6;
  c.save(); c.translate(x + sx, y + bob); c.scale(s, s); c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 3 - bob / s, 20, 5, 0, 0, 7); c.fill();
  // pés
  c.fillStyle = shade(col, -18); c.beginPath(); c.ellipse(-9, -2, 7, 4.5, 0, 0, 7); c.ellipse(9, -2, 7, 4.5, 0, 0, 7); c.fill();
  // braços
  c.fillStyle = col; c.strokeStyle = shade(col, -35); c.lineWidth = 1.5;
  const ay = mood === 'happy' ? -34 : mood === 'scared' ? -30 : -18;
  c.beginPath(); c.ellipse(-23, ay, 5.5, 4.5, -.4, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(23, ay, 5.5, 4.5, .4, 0, 7); c.fill(); c.stroke();
  // corpo
  c.beginPath(); c.moveTo(-20, -6); c.bezierCurveTo(-28, -32, -14, -50, 0, -50); c.bezierCurveTo(14, -50, 28, -32, 20, -6); c.quadraticCurveTo(0, 5, -20, -6); c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-9, -40, 6, 3.4, -.5, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,120,150,.45)'; c.beginPath(); c.arc(-14, -22, 4, 0, 7); c.arc(14, -22, 4, 0, 7); c.fill();
  // rosto
  const ink = '#26333a'; c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 2.2; c.lineCap = 'round';
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
  c.save(); c.translate(0, -48); drawHat(c, hatId); c.restore();
  c.restore();
}

/* ====== ARENA (um jogador) ====== */
const held = (keys, list) => list.some(k => keys.has(k));
const keysDown = new Set();

class Arena {
  constructor(canvas, opt) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.ctrl = opt.ctrl; this.look = opt.look; this.name = opt.name; this.goal = !!opt.goal;
    this.stars = makeStars();
    this.touch = null; this.tx = W / 2; this.hint = IS_TOUCH ? 7 : 0;
    this.bindTouch();
    this.reset();
  }
  /* Gestos: arrastar = mover · toque rápido = girar · deslizar p/ baixo (segurando) = cair rápido */
  bindTouch() {
    const cv = this.cv;
    const toL = dx => dx * W / Math.max(1, cv.getBoundingClientRect().width);
    cv.addEventListener('pointerdown', e => {
      if (this.touch || Game.paused || Game.over) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      this.touch = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, t0: performance.now(), moved: false, down: false };
      this.tx = this.cur ? this.cur.position.x : W / 2; this.hint = 0;
    });
    cv.addEventListener('pointermove', e => {
      const t = this.touch; if (!t || t.id !== e.pointerId) return;
      e.preventDefault();
      this.tx = clamp(this.tx + toL(e.clientX - t.lx) * 1.15, S, W - S); t.lx = e.clientX;
      if (Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 12) t.moved = true;
      t.down = (e.clientY - t.sy) > 55;
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
    this.base = Bodies.rectangle(W / 2, BASE_Y + 15, BASE_W, 30, { isStatic: true, friction: 1, frictionStatic: 1, label: 'base' });
    Composite.add(this.world, this.base);
    this.placed = []; this.cur = null; this.bag = []; this.coinsField = []; this.pops = [];
    this.next = this.draw7();
    this.lives = LIVES; this.height = 0; this.record = 0; this.earned = 0;
    this.camY = 0; this.t = 0; this.spawnIn = .5; this.wobble = 0;
    this.mood = 'idle'; this.moodT = 0; this.wind = 0; this.windLeft = 0; this.windIn = rnd(8, 13);
    Events.on(this.engine, 'collisionStart', e => {
      for (const p of e.pairs) {
        const a = p.bodyA.parent || p.bodyA, b = p.bodyB.parent || p.bodyB;
        if (this.cur && !this.cur.torre.locked && (a === this.cur || b === this.cur)) { this.lockCur(); break; }
      }
    });
  }
  draw7() {
    if (!this.bag.length) {
      this.bag = Object.keys(SHAPES);
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
    }
    return this.bag.pop();
  }
  setMood(m, d) { this.mood = m; this.moodT = d; }
  pop(text, color) { this.pops.push({ text, color: color || '#ffd166', t: 0 }); }
  spawn() {
    const type = this.next; this.next = this.draw7();
    const parts = SHAPES[type].map(([cx, cy]) => Bodies.rectangle(cx * S, cy * S, S, S, { chamfer: { radius: 4 } }));
    const body = Body.create({ parts, friction: .9, frictionStatic: 1.4, restitution: 0, frictionAir: 0, density: .002 });
    body.torre = { type, locked: false };
    Body.setPosition(body, { x: W / 2, y: this.camY + 50 });
    this.tx = W / 2;
    Composite.add(this.world, body);
    this.cur = body;
    if (this.coinsField.length < 2 && Math.random() < .55) this.coinsField.push({ x: rnd(120, 280), y: this.camY + rnd(190, 290), t: rnd(0, 6) });
  }
  rotate() { if (this.cur && !this.cur.torre.locked && this.state() === 'play') { Body.rotate(this.cur, Math.PI / 2); beep(520, .05, 'square', .02); } }
  state() { return this._state || 'play'; }
  lockCur() {
    const b = this.cur; b.torre.locked = true; this.placed.push(b); this.cur = null;
    this.spawnIn = .6; this.setMood('happy', .7); sfx.land();
    SAVE.blocks++; addCoins(1); this.earned += 1;
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
    if (this.lives <= 0) { this._state = 'dead'; return; }
    // vento
    if (WIND_FORCE > 0 && this.height > WIND_FROM_HEIGHT) {
      if (this.windLeft > 0) { this.windLeft -= dt; if (this.windLeft <= 0) { this.wind = 0; this.windIn = rnd(9, 15); } }
      else { this.windIn -= dt; if (this.windIn <= 0) { this.wind = Math.random() < .5 ? -1 : 1; this.windLeft = rnd(2.5, 4); } }
    } else this.wind = 0;
    if (this.wind) for (const b of this.placed) Body.applyForce(b, b.position, { x: this.wind * WIND_FORCE * b.mass, y: 0 });
    // peça atual
    if (this.cur && !this.cur.torre.locked) {
      const dir = (held(keysDown, this.ctrl.right) ? 1 : 0) - (held(keysDown, this.ctrl.left) ? 1 : 0);
      const tch = this.touch;
      const fall = (held(keysDown, this.ctrl.down) || (tch && tch.down)) ? FALL_FAST : FALL;
      const vx = tch ? clamp((this.tx - this.cur.position.x) * .4, -16, 16) : dir * MOVE;
      Body.setVelocity(this.cur, { x: vx + this.wind * .7, y: fall });
      Body.setAngularVelocity(this.cur, 0);
      const bd = this.cur.bounds;
      if (bd.min.x < 4) Body.translate(this.cur, { x: 4 - bd.min.x, y: 0 });
      if (bd.max.x > W - 4) Body.translate(this.cur, { x: W - 4 - bd.max.x, y: 0 });
      // moedas
      for (const k of this.coinsField) {
        if (k.x > bd.min.x - 9 && k.x < bd.max.x + 9 && k.y > bd.min.y - 9 && k.y < bd.max.y + 9) {
          k.got = true; addCoins(3); this.earned += 3; sfx.coin(); this.pop('+3', '#ffd166');
        }
      }
      this.coinsField = this.coinsField.filter(k => !k.got);
      if (this.cur.position.y > BASE_Y + 450) this.loseCur();
    }
    Engine.update(this.engine, 1000 / 60);
    // peças caídas e altura da torre
    let top = BASE_Y, wob = 0;
    for (const b of this.placed.slice()) {
      if (b.position.y > BASE_Y + 450) {
        Composite.remove(this.world, b); this.placed.splice(this.placed.indexOf(b), 1);
        this.lives--; this.setMood('sad', 1.2); sfx.lose(); this.pop('Caiu!', '#ff8fab'); continue;
      }
      wob += b.speed + Math.abs(b.angularSpeed) * 20;
      if (b.speed < .6 && b.position.y < BASE_Y + 50) top = Math.min(top, b.bounds.min.y);
    }
    this.height = Math.max(0, BASE_Y - top);
    this.wobble += (wob - this.wobble) * .08;
    if (this.mood === 'idle' && this.wobble > 4 && this.placed.length > 2) this.setMood('scared', .3);
    if (this.height >= this.record + 100) {
      this.record = Math.floor(this.height / 100) * 100; addCoins(5); this.earned += 5; sfx.rec(); this.setMood('happy', 1); this.pop('Novo recorde! +5', '#9be59f');
    }
    this.coinsField = this.coinsField.filter(k => k.y < BASE_Y - this.height + 10);
    this.camY += (Math.min(0, BASE_Y - this.height - 330) - this.camY) * .05;
    if (!this.cur) { this.spawnIn -= dt; if (this.spawnIn <= 0 && this.lives > 0) this.spawn(); }
  }

  /* --- desenho --- */
  render() {
    const c = this.ctx, L = this.look();
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(c, THEMES[L.theme] || THEMES.noite, this.height, this.t, this.stars, this.camY);
    c.save(); c.translate(0, -this.camY);
    drawBase(c, L.base, this.t);
    if (this.goal) {
      const gy = BASE_Y - GOAL;
      c.strokeStyle = 'rgba(255,230,120,.9)'; c.lineWidth = 3; c.setLineDash([14, 10]); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffd166'; c.font = '600 16px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('★ META', 12, gy + 22);
    }
    for (const k of this.coinsField) {
      const yy = k.y + Math.sin(this.t * 3 + k.t) * 4, sc = Math.abs(Math.cos(this.t * 2.5 + k.t));
      c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 10; c.fillStyle = '#ffc300'; c.strokeStyle = '#a86b00'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(k.x, yy, 3 + 8 * sc, 11, 0, 0, 7); c.fill(); c.stroke(); c.restore();
    }
    const all = this.cur ? this.placed.concat([this.cur]) : this.placed;
    for (const b of all) {
      const ps = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const p of ps) drawPart(c, p, b.torre.type, L.blocks, this.t);
    }
    c.restore();
    this.drawHud(c, L);
  }
  drawHud(c, L) {
    const hb = c.createLinearGradient(0, 0, 0, 110); hb.addColorStop(0, 'rgba(0,10,20,.55)'); hb.addColorStop(1, 'rgba(0,10,20,0)');
    c.fillStyle = hb; c.fillRect(0, 0, W, 110);
    // mascote em uma pedrinha, sempre visível
    c.save(); c.fillStyle = 'rgba(30,70,60,.85)'; c.beginPath(); c.ellipse(52, 664, 40, 9, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(18, 666); c.lineTo(86, 666); c.lineTo(62, 690); c.lineTo(40, 684); c.closePath(); c.fill(); c.restore();
    drawMascot(c, 52, 664, 1.05, L.mascot, L.hat, this.lives <= 0 ? 'sad' : this.mood, this.t);
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
    c.fillText(this.goal ? 'meta: ' + (GOAL / 50).toFixed(0) + ' m' : 'recorde: ' + (Math.max(SAVE.best, this.height) / 50).toFixed(1) + ' m', W / 2, 54);
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
    if (this.wind) { c.fillStyle = '#bfe6da'; c.font = '600 18px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(this.wind > 0 ? 'vento ➜' : '⬅ vento', W / 2, 84); }
    // avisos
    for (const p of this.pops) {
      c.globalAlpha = clamp(1.4 - p.t, 0, 1); c.fillStyle = p.color; c.font = '700 24px Outfit, Inter, system-ui, sans-serif'; c.textAlign = 'center';
      c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6; c.fillText(p.text, W / 2, 150 - p.t * 36); c.restore(); c.globalAlpha = 1;
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
const Game = { mode: null, arenas: [], running: false, paused: false, over: false, last: 0, acc: 0, raf: 0 };
const CTRL_SOLO = { left: ['ArrowLeft', 'KeyA', 'T_left'], right: ['ArrowRight', 'KeyD', 'T_right'], rot: ['ArrowUp', 'KeyW', 'Space', 'T_rot'], down: ['ArrowDown', 'KeyS', 'T_down'] };
const CTRL_P1 = { left: ['KeyA'], right: ['KeyD'], rot: ['KeyW'], down: ['KeyS'] };
const CTRL_P2 = { left: ['ArrowLeft'], right: ['ArrowRight'], rot: ['ArrowUp'], down: ['ArrowDown'] };

const SCREENS = ['menu', 'shop', 'profile', 'help', 'game'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  $('nav').classList.toggle('hidden', id === 'game');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
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
function lookP1() { return SAVE.eq; }
function lookP2() {
  const alt = ['rosa', 'menta', 'azul', 'dourado', 'branco'].find(m => m !== SAVE.eq.mascot);
  return Object.assign({}, SAVE.eq, { mascot: alt, hat: SAVE.eq.hat === 'coroa' ? 'nenhum' : 'coroa' });
}

function startGame(mode) {
  stopLoop(); keysDown.clear();
  Game.mode = mode; Game.over = false; Game.paused = false; Game.arenas = [];
  const stage = $('stage'); stage.innerHTML = ''; stage.className = mode === 'duo' ? 'duo' : '';
  const defs = mode === 'duo'
    ? [{ ctrl: CTRL_P1, look: lookP1, name: 'Jogador 1' }, { ctrl: CTRL_P2, look: lookP2, name: 'Jogador 2' }]
    : [{ ctrl: CTRL_SOLO, look: lookP1, name: '' }];
  for (const d of defs) {
    const cv = document.createElement('canvas'); cv.className = 'arena'; cv.width = W * DPR; cv.height = H * DPR; stage.appendChild(cv);
    Game.arenas.push(new Arena(cv, Object.assign({ goal: mode === 'duo' }, d)));
  }
  $('overlay').classList.add('hidden');
  show('game'); layout();
  Game.running = true; Game.last = performance.now(); Game.acc = 0;
  Game.raf = requestAnimationFrame(loop);
}
function layout() {
  const n = Math.max(1, Game.arenas.length), coarse = matchMedia('(pointer:coarse)').matches;
  const availW = innerWidth - 16 * 2 - 14 * (n - 1), availH = innerHeight - 16 - (coarse ? 64 : 0);
  const k = Math.max(.2, Math.min(availW / n / W, availH / H, 1.12));
  for (const a of Game.arenas) { a.cv.style.width = (W * k) + 'px'; a.cv.style.height = (H * k) + 'px'; }
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
  Game.raf = requestAnimationFrame(loop);
}
function checkEnd() {
  if (Game.over) return;
  const A = Game.arenas;
  if (Game.mode === 'solo') { if (A[0].lives <= 0) finish(0); return; }
  const [a, b] = A, aw = a.height >= GOAL, bw = b.height >= GOAL;
  if (!(aw || bw || a.lives <= 0 || b.lives <= 0)) return;
  let w;
  if (aw && bw) w = a.height >= b.height ? 0 : 1;
  else if (aw) w = 0; else if (bw) w = 1;
  else if (a.lives <= 0 && b.lives > 0) w = 1;
  else if (b.lives <= 0 && a.lives > 0) w = 0;
  else w = a.height > b.height ? 0 : b.height > a.height ? 1 : -1;
  finish(w);
}
function finish(w) {
  Game.over = true;
  const A = Game.arenas, best = Math.max(...A.map(a => a.height), 0);
  const prev = SAVE.best; if (best > SAVE.best) SAVE.best = Math.round(best); SAVE.games++; persist();
  const earned = A.reduce((s, a) => s + a.earned, 0);
  let title, line;
  if (Game.mode === 'solo') {
    title = best > prev && prev > 0 ? 'Novo recorde!' : 'Fim de jogo';
    line = 'Altura: ' + (best / 50).toFixed(1) + ' m · Recorde: ' + (SAVE.best / 50).toFixed(1) + ' m';
  } else if (w < 0) { title = 'Empate!'; line = 'Os dois chegaram à mesma altura.'; }
  else { title = 'Jogador ' + (w + 1) + ' venceu!'; line = 'Alturas: ' + (A[0].height / 50).toFixed(1) + ' m × ' + (A[1].height / 50).toFixed(1) + ' m'; }
  if (w !== 0 || Game.mode === 'duo') sfx.win();
  showOverlay('<h2>' + title + '</h2><p>' + line + '</p><p>Moedas ganhas: <b style="color:#ffd166">' + earned + '</b></p>' +
    '<button class="btn" id="oAgain">Jogar de novo</button><button class="btn alt" id="oShop">Loja</button><button class="btn alt" id="oMenu">Menu</button>');
  $('oAgain').onclick = () => startGame(Game.mode);
  $('oShop').onclick = () => { stopLoop(); openShop(); };
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
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
    if (!e.repeat && !Game.paused && !Game.over) for (const a of Game.arenas) if (a.ctrl.rot.includes(e.code)) a.rotate();
  }
  keysDown.add(e.code);
});
window.addEventListener('keyup', e => keysDown.delete(e.code));
window.addEventListener('blur', () => { keysDown.clear(); setPause(true); });
window.addEventListener('contextmenu', e => e.preventDefault());
$('btnSolo').onclick = () => startGame('solo');
$('btnDuo').onclick = () => startGame('duo');
$('btnShop').onclick = () => openShopTab('mascot');
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { stopLoop(); go(b.dataset.go); });
$('gPause').onclick = () => setPause(!Game.paused);
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
window.__torre = { startGame, openShop, Game, SAVE, Arena, CAT, step(n){ for(let i=0;i<n;i++){ for(const a of Game.arenas) a.update(1/60); checkEnd(); if(Game.over) break; } for(const a of Game.arenas) a.render(); } };
})();
