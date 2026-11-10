/* Brick by Brick — jogo de empilhar blocos (solo ou 2 jogadores no mesmo teclado)
   Física: Matter.js. Tudo é desenhado em canvas, sem imagens externas.
   Visual (personagens, cenários, ilhas): art.js, carregado antes deste arquivo. Redesign 10/11/2026. */
(() => {
'use strict';

if (typeof Matter === 'undefined') {
  const n = document.getElementById('nophys'); if (n) n.classList.remove('hidden');
  return;
}
const { Engine, Bodies, Body, Composite, Events } = Matter;
try { document.fonts.load('600 16px Fredoka'); document.fonts.load('700 32px Fredoka'); } catch (e) {}
const ART = window;   // funções de desenho do art.js (slime, drawVillain, island, scene...)

/* ====== AJUSTES FÁCEIS (mexa aqui para mudar a dificuldade) ====== */
const ZOOM = .52;          // zoom da câmera. Medido no 99 Bricks: cada quadradinho = 3,5% da largura da tela (14 de 400)
const W = 400, WW = W / ZOOM;  // W = largura da tela lógica; WW = largura do mundo da física
let H = 700, WH = 1400, CAM0 = 0;   // tamanho lógico da arena (a altura H se adapta à tela do celular)
const S = 30;                  // tamanho de cada quadradinho do bloco (maior = blocos maiores)
const BASE_Y = 560;            // altura da superfície da ilha
const BASE_W = 160;            // largura da ilha
const GRID = S / 2;            // "travas": a peça anda de meio em meio quadradinho e encaixa no alinhamento
const G_FALL = .32;            // gravidade dos blocos que perderam o apoio (px/frame²)
const V_FALL = 14;             // velocidade máxima de queda
const TIP_MIN_ARM = 3;         // tombar: braço de alavanca mínimo (px): o quanto o peso já "puxa" quando o centro está quase na borda
const OMEGA_MAX = .12;         // tombar: giro máximo (rad/frame)
const TIP_RELEASE = 1.1;       // tombar: ângulo (rad) em que o bloco desencosta da borda e passa a cair solto
const DROP_PX = 36;            // touch: quanto o dedo precisa descer (em linha reta) para a peça cair rápido
const WIND_PUSH = .8;          // vento empurra a peça que está caindo (px por frame no pico)
const CP_FIRST = 330;          // altura (px) da 1ª linha de pavimento; ~50 px = 1 m
const CP_STEP = 330;           // distância até a próxima linha depois de pavimentar
const TOOLS_START = 3;         // usos da colher de pedreiro (cimento) no início
function fitWorld() { const vw = Math.min(innerWidth, innerHeight * .62); H = Math.max(640, Math.min(940, Math.round(W * innerHeight / Math.max(1, vw)))); WH = H / ZOOM; CAM0 = BASE_Y + GROUND_FROM_BOTTOM / ZOOM - WH; }
const GOAL = 600;              // altura da meta no modo 2 jogadores
const LIVES = 3;               // blocos que podem cair antes de perder
const FALL = 1.3;              // velocidade normal de queda (menor = mais devagar)
const FALL_FAST = 16;           // velocidade ao segurar "descer"
const MOVE = 4;                // velocidade lateral no teclado
const DRAG_GAIN = .6;          // touch: 1 = a peça acompanha o dedo exatamente; menor = menos sensível
const HYST = .4;               // touch: histerese da trava (maior = a peça só pula de casa depois de um arrasto mais claro)
const GROUND_FROM_BOTTOM = 105; // distância da superfície da ilha até o fim da tela, no início (maior = ilha mais alta)
const UNDO_START = 1;          // quantos "desfazer" o jogador começa tendo
const STOP_START = 1;          // quantos "parar tempestade" o jogador começa tendo
const STOP_EVERY = 12;         // +1 parar-tempestade a cada N peças (e +1 a cada pavimento)
const UNDO_EVERY = 8;          // ganha +1 desfazer a cada N peças pousadas (e +1 a cada pavimento)
const MOVE_MAX = 9;            // touch: velocidade lateral máxima da peça (menor = mais firme)
const DEADZONE = 12;           // touch: pixels que o dedo precisa andar antes de contar como arrasto
const FRICTION = 1;            // atrito entre blocos (mais alto = menos escorrega)
const FRICTION_STATIC = 10;    // atrito parado (alto = o bloco "gruda" onde pousou)
const WIND_FORCE = 0.00005;    // força do vento sobre a torre (0 desliga). Leve de propósito.
const EVT_FIRST = 18;          // 1º evento (vento ou feitiço) depois de ~10 s; depois a cada 12–20 s
const SPELL_TIME = 14;         // duração do feitiço do vilão (segundos)
const EVT_GAP = 28;             // tempo mínimo entre eventos (vento/tempestade), em segundos
const EVT_GAP_VAR = 14;        // + sorteio de 0 a este valor
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
const PALETTE = { I:'#62b9b0', O:'#f2c764', T:'#9a86d4', S:'#93c98f', Z:'#e8806f', J:'#6e9fd8', L:'#f0a35e' };   // paleta suave do redesign
const STONE = { I:'#8d99a6', O:'#a09a90', T:'#7b8794', S:'#8a9288', Z:'#9a8f8f', J:'#7f8aa0', L:'#948d80' };

/* ====== LOJA ====== */
const CAT = {   // a ordem aqui é a ordem das abas da loja
  mascot: { label:'Cor', items:[
    {id:'perola',n:'Pérola',p:0},{id:'menta',n:'Menta',p:40},{id:'coral',n:'Coral',p:60},
    {id:'lavanda',n:'Lavanda',p:80},{id:'ceu',n:'Céu',p:100},{id:'sol',n:'Sol',p:130}]},
  hat: { label:'Acessório', items:[
    {id:'nenhum',n:'Nenhum',p:0},{id:'antenas',n:'Antenas',p:30},{id:'laco',n:'Laço',p:40},{id:'galhada',n:'Galhada',p:50},
    {id:'concha',n:'Concha',p:60},{id:'cartola',n:'Cartola',p:80},{id:'coroa',n:'Coroa',p:120}]},
  blocks: { label:'Blocos', items:[
    {id:'geleia',n:'Geleia',p:0},{id:'pedra',n:'Pedra',p:30},{id:'gelo',n:'Gelo',p:60},
    {id:'doce',n:'Doce',p:80},{id:'neon',n:'Neon',p:120},{id:'ouro',n:'Ouro',p:200}]},
  theme: { label:'Cenário', items:[
    {id:'noite',n:'Floresta',p:0},{id:'dia',n:'Cachoeira',p:40},{id:'por',n:'Poente Coral',p:60},
    {id:'aurora',n:'Aurora',p:100},{id:'espaco',n:'Lua Roxa',p:150}]},
  base: { label:'Base', items:[
    {id:'ilha',n:'Ilha',p:0},{id:'coral',n:'Torre Coral',p:80},{id:'vulcao',n:'Vulcão',p:120},{id:'nuvem',n:'Nuvem',p:150},{id:'cristal',n:'Cristal',p:180}]},
};
/* itens antigos -> novos (quem já tinha comprado não perde nada) */
const MIGRATE = {
  base: { castelo:'coral' },
  hat: { folha:'antenas', mago:'galhada' },
  mascot: { fantasma:'perola', flor:'coral', nuvem:'ceu', estrela:'sol', abobora:'lavanda',
            turquesa:'menta', magenta:'coral', ambar:'sol', noturno:'lavanda', aurora:'ceu', pessego:'coral' },
};
const mig = (k, id) => (MIGRATE[k] && MIGRATE[k][id]) || id;
const accOf = h => (h && h !== 'nenhum') ? h : null;
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
    owned:{ blocks:['geleia'], theme:['noite'], base:['ilha'], hat:['nenhum'], mascot:['perola'] },
    eq:{ blocks:'geleia', theme:'noite', base:'ilha', hat:'nenhum', mascot:'perola' }, name:'', nameB:'' };
}
function normalize(s) {
  const d = defaults();
  if (s && typeof s === 'object') {
    d.coins = +s.coins || 0; d.best = +s.best || 0; d.xp = +s.xp || 0; d.blocks = +s.blocks || 0; d.games = +s.games || 0;
    d.name = typeof s.name === 'string' ? s.name.slice(0, 12) : ''; d.nameB = typeof s.nameB === 'string' ? s.nameB.slice(0, 12) : '';
    for (const k in d.owned) {
      if (s.owned && Array.isArray(s.owned[k])) d.owned[k] = Array.from(new Set(d.owned[k].concat(s.owned[k].map(id => mig(k, id))))).filter(id => CAT[k].items.some(i => i.id === id));
      const e = s.eq && typeof s.eq[k] === 'string' ? mig(k, s.eq[k]) : null;
      if (e && d.owned[k].includes(e)) d.eq[k] = e;
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
function drawSkyTh(c, th, h, t, stars, camY) {
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

function drawSky(c, id, h, t, stars, camY) { drawSkyTh(c, THEMES[id] || THEMES.noite, h, t, stars, camY); }
/* cenário estático (loja, miniaturas, fundo do início): desenha o céu antigo e ajusta ao tamanho pedido */
const SCN = {}, SCN_STARS = (() => { const r = mulberry32(7); return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, r: .6 + r() * 1.4, p: r() * 6.28 })); })();
function skyScene(c, w, h, id) {
  const th = THEMES[id] || THEMES.noite, key = id + '|' + H;
  if (!SCN[key]) { const cv = document.createElement('canvas'); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const x = cv.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); drawSkyTh(x, th, 0, 1, SCN_STARS, 0); SCN[key] = cv; }
  const k = Math.max(w / W, h / H); c.drawImage(SCN[key], (w - W * k) / 2, (h - H * k) / 2, W * k, H * k);
}

/* ====== DESENHO: BASES ====== */
function drawBase(c, id, t, cx) {   // ilhas low-poly do art.js, alinhadas com o chão da física (BASE_Y)
  if (cx == null) cx = W / 2;
  const s = (BASE_W / 2 + 6) / 100;
  id = mig('base', id);
  if (id === 'nuvem') ART.cloudBase(c, cx, BASE_Y + 34, s);
  else ART.island(c, cx, BASE_Y - 6, s, BPAL[id] ? id : 'ilha');
}

/* ====== DESENHO: PERSONAGEM (slime de geleia, art.js) ======
   skin = cor (perola, menta, coral, lavanda, ceu, sol) · hatId = acessório · mood: idle | happy | scared | sad */
function drawMascot(c, x, y, sc, skin, hatId, mood, t) {
  let bob = 0, sx = 0;
  if (mood === 'happy') bob = -Math.abs(Math.sin(t * 11)) * 11;
  else if (mood === 'scared') sx = Math.sin(t * 45) * 1.6;
  const face = mood === 'happy' ? 'feliz' : (mood === 'scared' || mood === 'sad') ? 'preocupado' : 'idle';
  ART.slime(c, x + sx, y + bob, sc * .6, mig('mascot', skin), '', face, t || 0, { acc: accOf(mig('hat', hatId)) });
}

/* ====== SORTEIO COM SEMENTE (duelo justo: mesmas peças e eventos para os dois) ====== */
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ====== VILÃO: o slime da tempestade (art.js) ====== */
function drawVillain(c, x, y, sc, t, charge) {
  ART.drawVillain(c, x, y, sc, t, {});
  if (charge > 0) {   // raio carregando embaixo dele
    const r = (10 + charge * 22) * sc, cy = y + 40 * sc, g = c.createRadialGradient(x, cy, 1, x, cy, r);
    g.addColorStop(0, 'rgba(255,248,170,' + (.4 + charge * .5) + ')'); g.addColorStop(1, 'rgba(255,230,90,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, cy, r, 0, 7); c.fill();
  }
}

/* ====== ARENA (um jogador) ====== */
function satDepth(A, B) {      // sobreposição mínima entre dois polígonos convexos (0 = separados)
  let min = 1e9;
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      let nx = p2.y - p1.y, ny = p1.x - p2.x; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const v of A) { const d = v.x * nx + v.y * ny; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const v of B) { const d = v.x * nx + v.y * ny; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      const ov = Math.min(a1, b1) - Math.max(a0, b0);
      if (ov <= 0) return 0;
      if (ov < min) min = ov;
    }
  }
  return min;
}
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
      if (!t.down) t.down = (e.clientY - t.ay) > DROP_PX;   // ao começar a descer, a posição fica travada até soltar o dedo
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
    this.placed = []; this.slides = []; this.cur = null; this.bag = []; this.coinsField = []; this.pops = [];
    this.next = this.draw7();
    this.lives = LIVES; this.height = 0; this.record = 0; this.earned = 0;
    this.camY = CAM0; this.t = 0; this.undos = UNDO_START; this.stops = STOP_START; this.landed = 0; this.cpLevel = CP_FIRST; this.cpFlash = 0; this.tools = TOOLS_START; this.cement = false; this.calm = true; this.spawnIn = .5; this.wobble = 0;
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
    this.tx = WW / 2; this.gi = null;
    this.cur = body;       // a peça que cai NÃO está no motor de física: é movida pelo jogo, com encaixe exato
    if (this.coinsField.length < 2 && this.rc() < .55) this.coinsField.push({ x: WW * .42 + this.rc() * WW * .16, y: this.camY + 250 / ZOOM + this.rc() * 100 / ZOOM, t: this.rc() * 6 });
  }
  /* --- geometria (todas as peças pousadas são caixinhas alinhadas, então usamos os retângulos delas) --- */
  hits(body, skip) {
    const bb = body.bounds, E = .6, bp = partsOf(body);
    for (const o of this.placed.concat([this.base])) {
      if (o === body || (skip && skip.has(o))) continue;
      const ob = o.bounds;
      if (bb.max.x <= ob.min.x + E || bb.min.x >= ob.max.x - E || bb.max.y <= ob.min.y + E || bb.min.y >= ob.max.y - E) continue;
      for (const p of bp) for (const q of partsOf(o)) {
        if (o.torre && o.torre.tilted) { if (p.bounds.max.x > q.bounds.min.x && p.bounds.min.x < q.bounds.max.x && p.bounds.max.y > q.bounds.min.y && p.bounds.min.y < q.bounds.max.y && satDepth(p.vertices, q.vertices) > 1.2) return true; continue; }
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
    this.gi = null;
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
    const want = (this.tx - w / 2 - WW / 2) / GRID;
    if (this.gi == null || Math.abs(want - this.gi) > .5 + HYST) this.gi = Math.round(want);
    const tl = clamp(this.gi * GRID + WW / 2, 4, WW - 4 - w);
    let dx = clamp(tl - bd.min.x, -MOVE_MAX, MOVE_MAX);
    // anda em passinhos de 1.5px: a peça nunca atravessa blocos já colocados (só desliza pelas laterais da torre)
    { let left = Math.abs(dx); const sg = Math.sign(dx);
      while (left > .01) { const st = Math.min(left, 1.5); if (!this.tryMove(sg * st, 0)) break; left -= st; } }
    let rem = fall;
    while (rem > 0) {
      const d = Math.min(rem, 1.5);
      if (this.tryMove(0, d)) { rem -= d; continue; }
      for (const f of [.75, .4, .2, .1]) if (this.tryMove(0, f)) break;
      this.land(); return;
    }
  }
  /* pouso: calcula o apoio. Se o centro de massa (com o peso de tudo que está em cima) passa da borda do apoio, a peça cai */
  supportOf(b, skip) {
    const set = new Set(); let lo = 1e9, hi = -1e9, ytop = 0, ys = 0, yn = 0;
    for (const p of partsOf(b)) for (const o of this.placed.concat([this.base])) {
      if (o === b || (skip && skip.has(o))) continue;
      for (const q of partsOf(o)) {
        if (Math.abs(q.bounds.min.y - p.bounds.max.y) > 1.6) continue;
        const a = Math.max(p.bounds.min.x, q.bounds.min.x), z = Math.min(p.bounds.max.x, q.bounds.max.x);
        if (z - a > 1) { lo = Math.min(lo, a); hi = Math.max(hi, z); ytop = q.bounds.min.y; ys += q.bounds.min.y; yn++; if (o !== this.base) set.add(o); }
      }
    }
    return { bodies: Array.from(set), hull: hi > lo ? [lo, hi, ys / yn] : null, y: ytop };
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
  /* bloco sem apoio suficiente: ele e tudo que está em cima formam um grupo rígido que TOMBA pela quina do apoio
     (o peso puxa para baixo e o grupo gira em torno da quina), depois desencosta e cai solto com a gravidade */
  topple(bad) {
    bad = bad.slice().sort((p, q) => q.X.bounds.max.y - p.X.bounds.max.y);   // o mais baixo cai primeiro, levando o que está em cima
    const X = bad[0].X, dir = bad[0].dir, hull = X.torre.hull;
    const rel = new Set();
    const add = Z => { if (rel.has(Z)) return; rel.add(Z); for (const Y of this.placed) if (Y.torre.sup.indexOf(Z) >= 0) add(Y); };
    add(X);
    for (const Z of rel) { Z.torre.sup = []; Z.torre.hull = null; Z.torre.fixed = false; Z.torre.moving = true; }
    const g = { members: Array.from(rel), set: rel, mode: 'fly', dir, P: null, w: 0, th: 0, v: { x: 0, y: 0 }, age: 0 };
    if (hull && dir) { g.mode = 'tip'; g.P = { x: dir > 0 ? hull[1] : hull[0], y: hull[2] }; }
    this.slides.push(g);
    
  }
  groupHitsPoly(g) {
    for (const m of g.members) for (const p of partsOf(m)) {
      for (const o of (g.ghost ? [this.base] : this.placed.concat([this.base]))) {
        if (g.set.has(o)) continue;
        const ob = o.bounds; if (p.bounds.max.x <= ob.min.x || p.bounds.min.x >= ob.max.x || p.bounds.max.y <= ob.min.y || p.bounds.min.y >= ob.max.y) continue;
        for (const q of partsOf(o)) {
          if (p.bounds.max.x <= q.bounds.min.x || p.bounds.min.x >= q.bounds.max.x || p.bounds.max.y <= q.bounds.min.y || p.bounds.min.y >= q.bounds.max.y) continue;
          if (satDepth(p.vertices, q.vertices) > 1.5) return true;
        }
      }
    }
    return false;
  }
  groupCenter(g) {
    let x = 0, y = 0, n = 0;
    for (const m of g.members) for (const p of partsOf(m)) { x += p.position.x; y += p.position.y; n++; }
    return { x: x / n, y: y / n };
  }
  rotateGroup(g, ang, pt) { for (const m of g.members) Body.rotate(m, ang, pt); }
  moveGroupBy(g, dx, dy) { for (const m of g.members) Body.translate(m, { x: dx, y: dy }); }
  /* o grupo parou: se está reto, vira peça normal (confere o apoio de novo); se está torto, vira entulho firme onde parou */
  stopGroup(g) {
    const frozen = () => {
      const i = this.slides.indexOf(g); if (i >= 0) this.slides.splice(i, 1);
      for (const m of g.members) { m.torre.moving = false; m.torre.fixed = true; m.torre.sup = []; m.torre.hull = null; m.torre.tilted = true; }
      sfx.land();
    };
    // quanto o grupo está torto em relação a "deitado/de pé" (múltiplos de 90°)
    const ang = g.members[0].angle || 0, Q = Math.PI / 2;
    const r = ((ang + Q / 2) % Q + Q) % Q - Q / 2;
    if (Math.abs(r) < .09) {
      // quase reto: alinha de vez e confere o apoio como qualquer peça (se não tiver apoio, tomba de novo)
      if (Math.abs(r) > .002) { const C = this.groupCenter(g); this.rotateGroup(g, -r, C); if (this.groupHitsPoly(g)) this.rotateGroup(g, r, C); }
      g.th = 0; g.w = 0; this.settle(g); return;
    }
    // inclinado e encostado só numa quina: não pode ficar parado. Continua tombando em volta dessa quina
    g.jam = (g.jam || 0) + 1;
    if (g.jam <= 14) {
      let P = this.contactPoint(g);
      if (!P) { let low = -1e9, lx = 0; for (const m of g.members) for (const p of partsOf(m)) for (const v of p.vertices) if (v.y > low) { low = v.y; lx = v.x; } P = { x: lx, y: low }; }
      const C = this.groupCenter(g), d = C.x - P.x;
      // tentativas alternadas: ora tomba para o lado do peso, ora "assenta" deitando sobre o que está embaixo
      const flatten = g.jam % 2 === 0 || Math.abs(d) <= 1.5;
      g.P = P; g.mode = 'tip'; g.w = 0; g.th = 0; g.age = Math.min(g.age, 200);
      if (flatten) { g.flat = true; g.dir = -Math.sign(r) || 1; } else { g.flat = false; g.dir = Math.sign(d); }
      return;
    }
    // não consegue tombar (entalado): se está pousado em algo, fica; se está no ar, solta e cai (só a ilha o segura)
    if (g.ghost || this.restsOnSomething(g)) { frozen(); return; }
    g.jam = 0; g.ghost = true; g.mode = 'fly'; g.age = Math.min(g.age, 300);
    g.v = { x: (g.dir || 1) * 1.2, y: 1 }; g.w = (g.dir || 1) * .02;
  }
  /* onde o grupo toca em outro bloco (ponto de contato mais próximo): é a quina em torno da qual ele tomba */
  contactPoint(g) {
    const dseg = (px, py, a, b) => {
      const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1, t = clamp(((px - a.x) * vx + (py - a.y) * vy) / L, 0, 1);
      return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
    };
    const dpoly = (px, py, V) => { let d = 1e9; for (let i = 0; i < V.length; i++) d = Math.min(d, dseg(px, py, V[i], V[(i + 1) % V.length])); return d; };
    let best = 6, P = null;
    for (const m of g.members) for (const p of partsOf(m)) {
      for (const o of this.placed.concat([this.base])) {
        if (g.set.has(o)) continue;
        for (const q of partsOf(o)) {
          if (p.bounds.max.x < q.bounds.min.x - 6 || p.bounds.min.x > q.bounds.max.x + 6 || p.bounds.max.y < q.bounds.min.y - 6 || p.bounds.min.y > q.bounds.max.y + 6) continue;
          for (const v of p.vertices) { const d = dpoly(v.x, v.y, q.vertices); if (d < best) { best = d; P = { x: v.x, y: v.y }; } }
          for (const v of q.vertices) { const d = dpoly(v.x, v.y, p.vertices); if (d < best) { best = d; P = { x: v.x, y: v.y }; } }
        }
      }
    }
    return P;
  }
  /* o ponto mais baixo do grupo está pousado em cima de alguma coisa (ilha ou topo de outro bloco)? */
  restsOnSomething(g) {
    let low = -1e9, lx = 0;
    for (const m of g.members) for (const p of partsOf(m)) for (const v of p.vertices) if (v.y > low) { low = v.y; lx = v.x; }
    if (low >= BASE_Y - 10) return true;
    for (const o of this.placed) {
      if (g.set.has(o)) continue;
      for (const q of partsOf(o)) if (lx >= q.bounds.min.x - 4 && lx <= q.bounds.max.x + 4 && Math.abs(q.bounds.min.y - low) <= 6) return true;
    }
    return false;
  }
  settle(g) {
    const i = this.slides.indexOf(g); if (i >= 0) this.slides.splice(i, 1);
    for (const m of g.members) { m.torre.moving = false; m.torre.n = (m.torre.n || 0) + 1; }
    for (const m of g.members) { const sp = this.supportOf(m); m.torre.sup = sp.bodies; m.torre.hull = sp.hull; }
    const bad = [];
    for (const m of g.members) {
      if (m.torre.n >= 4) { m.torre.fixed = true; m.torre.sup = []; continue; }
      for (const x of this.chainCheck(m)) if (!bad.some(o => o.X === x.X)) bad.push(x);
    }
    if (bad.length) this.topple(bad); else sfx.land();
  }
  stepSlides() {
    for (const g of this.slides.slice()) {
      if (!this.slides.includes(g)) continue;
      g.members = g.members.filter(m => this.placed.includes(m)); if (!g.members.length) { this.slides.splice(this.slides.indexOf(g), 1); continue; }
      if (++g.age > 420) { if (!g.ghost) { g.ghost = true; g.mode = 'fly'; g.age = 300; g.v = { x: 0, y: 2 }; } else { for (const m of g.members) { m.torre.moving = false; m.torre.fixed = true; m.torre.sup = []; } this.slides.splice(this.slides.indexOf(g), 1); continue; } }
      if (g.mode === 'tip') {
        // física de um corpo rígido apoiado numa quina: o peso (centro de massa fora da borda) gera torque e o grupo gira
        let sx = 0, I = 0, n = 0;
        for (const m of g.members) for (const p of partsOf(m)) { const dx = p.position.x - g.P.x, dy = p.position.y - g.P.y; sx += dx; I += dx * dx + dy * dy + S * S / 6; n++; }
        let tau = G_FALL * sx; const minT = G_FALL * n * TIP_MIN_ARM;
        if (g.dir * tau < minT) tau = g.dir * minT;
        g.w = g.flat ? g.dir * .035 : clamp(g.w + tau / I, -OMEGA_MAX, OMEGA_MAX);
        this.rotateGroup(g, g.w, g.P);
        if (this.groupHitsPoly(g)) { this.rotateGroup(g, -g.w, g.P); this.stopGroup(g); continue; }
        g.th += g.w;
        if (g.flat) {   // deitando: ao ficar reto, confere o apoio
          const an = g.members[0].angle || 0, Q = Math.PI / 2, rr = ((an + Q / 2) % Q + Q) % Q - Q / 2;
          if (Math.abs(rr) < .03) { this.stopGroup(g); continue; }
        } else if (Math.abs(g.th) >= TIP_RELEASE) {
          const C = this.groupCenter(g), rx = C.x - g.P.x, ry = C.y - g.P.y;
          g.v = { x: -ry * g.w, y: rx * g.w }; g.mode = 'fly';
        }
      } else {
        // queda livre: gravidade puxa para baixo, o giro adquirido continua
        g.v.y = Math.min(g.v.y + G_FALL, V_FALL);
        const steps = Math.max(1, Math.ceil(Math.hypot(g.v.x, g.v.y) / 3)); let stopped = false;
        for (let k = 0; k < steps && !stopped; k++) {
          const dx = g.v.x / steps, dy = g.v.y / steps, da = g.w / steps;
          this.moveGroupBy(g, dx, dy);
          if (da) this.rotateGroup(g, da, this.groupCenter(g));
          g.th += da;
          if (this.groupHitsPoly(g)) {
            // roçou na quina do apoio: empurra para o lado do excesso de peso (escorrega pela quina) e segue caindo
            let freed = false;
            if (g.dir) for (let n = 1; n <= 16 && !freed; n++) { this.moveGroupBy(g, g.dir * 2, 0); if (!this.groupHitsPoly(g)) freed = true; }
            if (!freed) {
              if (g.dir) this.moveGroupBy(g, -g.dir * 32, 0);
              if (da) this.rotateGroup(g, -da, this.groupCenter(g));
              g.th -= da; this.moveGroupBy(g, -dx, -dy); stopped = true;
            }
          }
        }
        if (stopped) this.stopGroup(g);
      }
    }
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
    if (++this.landed % UNDO_EVERY === 0) { this.undos++; this.pop('+1 desfazer', '#9be59f'); }
    if (this.landed % STOP_EVERY === 0) { this.stops++; this.pop('+1 parar tempestade', '#ffe27a'); }
  }
  /* poder: interrompe a tempestade (a nuvem vai embora e as peças voltam ao ritmo normal) */
  stopStorm() {
    if (this.state() !== 'play') return;
    const e = this.evt, active = this.fastLeft > 0 || (e && e.kind === 'spell');
    if (!active) { this.pop('Sem tempestade agora', '#ffe08a'); return; }
    if (this.stops <= 0) { this.pop('Sem poder de sol', '#ff8fab'); return; }
    this.stops--; this.fastLeft = 0; this.flash = .5;
    if (e && e.kind === 'spell') { e.fired = true; e.t = Math.max(e.t, 2); }
    this.pop('Tempestade interrompida!', '#ffe27a'); sfx.rec();
  }
  /* poder básico: elimina a última peça posicionada */
  undo() {
    if (this.state() !== 'play') return;
    const b = this.placed[this.placed.length - 1];
    if (!b) { this.pop('Nada para desfazer', '#ffe08a'); return; }
    if (this.undos <= 0) { this.pop('Sem desfazer', '#ff8fab'); return; }
    this.undos--; Composite.remove(this.world, b); this.placed.pop();
    for (const g of this.slides) g.members = g.members.filter(m => m !== b);   // vale também para a peça em queda
    this.slides = this.slides.filter(g => g.members.length);
    for (const m of this.placed) if (m.torre.sup) m.torre.sup = m.torre.sup.filter(x => x !== b);
    this.pop('Peça removida', '#bff3ff'); beep(300, .09, 'triangle', .03);
  }
  /* linha de pavimento: ao alcançá-la, a torre vira chão firme (blocos fixos) e a próxima linha sobe */
  pave() {
    for (const b of this.placed) { b.torre.fixed = true; b.torre.sup = []; b.torre.moving = false; }
    this.slides = [];
    this.cpLevel = this.height + CP_STEP; this.cpFlash = 1; this.tools++; this.undos++; this.stops++;
    if (this.lives < LIVES) this.lives++;
    addCoins(10); this.earned += 10; sfx.rec(); this.setMood('happy', 1.2);
    this.pop('Pavimentado! +10', '#bff3ff'); this.pop('+1 cimento · desfazer · sol', '#cfd8e8');
  }
  useTool() {
    if (!this.cur || this.cur.torre.locked || this.state() !== 'play') return;
    if (this.cement) { this.cement = false; this.tools++; return; }
    if (this.tools <= 0) { this.pop('Sem cimento', '#ff8fab'); return; }
    this.tools--; this.cement = true; beep(380, .08, 'triangle', .03);
    this.pop('Cimento pronto!', '#cfd8e8');
  }
  /* chão da queda: borda de baixo da tela (e não a base da torre) */
  floorY() { return this.camY + WH + 25; }
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
    this.streaks = this.streaks.filter(q => { q.x += q.sp * 60 * dt; return q.x > -140 && q.x < W + 140; });
    // peça atual
    if (this.cur && !this.cur.torre.locked) {
      const dir = (held(keysDown, this.ctrl.right) ? 1 : 0) - (held(keysDown, this.ctrl.left) ? 1 : 0);
      if (!(this.touch && this.touch.down)) this.tx += dir * MOVE + this.windAmt * WIND_PUSH;
      const bd = this.cur.bounds;
      for (const k of this.coinsField) {
        if (k.x > bd.min.x - 9 && k.x < bd.max.x + 9 && k.y > bd.min.y - 9 && k.y < bd.max.y + 9) {
          k.got = true; addCoins(3); this.earned += 3; sfx.coin(); this.pop('+3', '#ffd166');
        }
      }
      this.coinsField = this.coinsField.filter(k => !k.got);
      this.stepCur();
      if (this.cur && this.cur.position.y > this.floorY()) this.loseCur();
    }
    Engine.update(this.engine, 1000 / 60);
    for (let i = Math.max(0, this.placed.length - 4); i < this.placed.length; i++) { const t_ = this.placed[i].torre; if (t_.flash > 0) t_.flash = Math.max(0, t_.flash - dt * 3.5); }
    this.stepSlides();
    // peças caídas e altura da torre
    let top = BASE_Y, wob = 0;
    for (const b of this.placed.slice()) {
      if (b.position.y > (b.torre.moving ? this.floorY() : BASE_Y + 600)) {   // torre apoiada nunca "cai" só porque a câmera subiu
        Composite.remove(this.world, b); this.placed.splice(this.placed.indexOf(b), 1);
        this.lives--; this.setMood('sad', 1.2); sfx.lose(); this.pop('Caiu!', '#ff8fab'); continue;
      }
      if (b.torre.moving) { wob += 3; continue; }
      if (b.position.y < BASE_Y + 50) top = Math.min(top, b.bounds.min.y);
    }
    this.height = Math.max(0, BASE_Y - top);
    this.calm = this.slides.length === 0;
    if (this.cpFlash > 0) this.cpFlash -= dt;
    if (this.height >= this.cpLevel && this.calm && this.cur) this.pave();
    this.wobble += (wob - this.wobble) * .08;
    if (this.mood === 'idle' && this.wobble > 4 && this.placed.length > 2) this.setMood('scared', .3);
    if (this.height >= this.record + 100) {
      this.record = Math.floor(this.height / 100) * 100; addCoins(5); this.earned += 5; sfx.rec(); this.setMood('happy', 1); this.pop('Novo recorde! +5', '#9be59f');
    }
    this.coinsField = this.coinsField.filter(k => k.y < BASE_Y - this.height + 10);
    this.camY += (Math.min(CAM0, BASE_Y - this.height - WH * .5) - this.camY) * .08;
    if (!this.cur) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0 && this.lives > 0 && this.slides.length === 0) {
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
  endEvent() { this.evt = null; this.windAmt = 0; this.evtIn = EVT_GAP + this.re() * EVT_GAP_VAR; }
  drawEvent(c) {
    const e = this.evt, spell = !!(e && e.kind === 'spell');
    if (!spell && !(this.fastLeft > 0)) return;
    const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3), HX = 80, HY = 236, sc = 1.05;
    let x = HX, charge = 0;
    const t = spell ? e.t : 99;
    if (spell) {
      if (t < .8) x = -90 + (HX + 90) * ease(t / .8);
      charge = clamp((t - .8) / .9, 0, 1) * (t < 1.8 ? 1 : 1.4);
      if (e.fired && t >= 2 && this.fastLeft <= 0) x = HX - 180 * clamp((t - 2) / .8, 0, 1);   // tempestade interrompida: vai embora
    } else if (this.fastLeft < .8) x = HX - 180 * (1 - this.fastLeft / .8);                    // fim da tempestade
    drawVillain(c, x, HY, sc, this.t, charge);
    const tipX = x, tipY = HY + 40 * sc;
    if (spell && t > 1.45 && t < 1.95 && this.cur) {
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
    for (let i = 0; i < n; i++) { const x = d * (i + .5); c.beginPath(); c.arc(x, y, 6.5, 0, 7); c.fill(); }
    c.shadowBlur = 0; c.fillStyle = '#e9fbff'; c.font = '700 24px Fredoka, Nunito, ui-rounded, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('PAVIMENTO  ✦', 14 / ZOOM, y - 22);
    c.restore();
  }

  /* --- desenho --- */
  render() {
    const c = this.ctx, L = this.look();
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(c, L.theme, this.height * ZOOM, this.t, this.stars, this.camY * ZOOM);
    c.save(); c.scale(ZOOM, ZOOM); c.translate(0, -this.camY);
    drawBase(c, L.base, this.t, WW / 2);
    if (this.goal) {
      const gy = BASE_Y - GOAL;
      c.strokeStyle = 'rgba(255,230,120,.9)'; c.lineWidth = 3; c.setLineDash([14, 10]); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffd166'; c.font = '600 16px Fredoka, Nunito, ui-rounded, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('★ META', 12, gy + 22);
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
    const F = 'Fredoka, Nunito, ui-rounded, system-ui, sans-serif';
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
    const hb = c.createLinearGradient(0, 0, 0, 120); hb.addColorStop(0, 'rgba(5,15,30,.5)'); hb.addColorStop(1, 'rgba(5,15,30,0)');
    c.fillStyle = hb; c.fillRect(0, 0, W, 120);
    // personagem no cantinho, num montinho de grama
    c.save(); c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(58, H - 12, 46, 9, 0, 0, 7); c.fill();
    c.fillStyle = '#2f7a5a'; c.beginPath(); c.ellipse(58, H - 15, 48, 12, 0, 0, 7); c.fill();
    c.fillStyle = '#4fa36f'; c.beginPath(); c.ellipse(58, H - 18, 44, 9, 0, 0, 7); c.fill(); c.restore();
    const fear = this.mood === 'idle' && (this.fastLeft > 0 || (this.evt && this.evt.kind === 'spell')) ? 'scared' : this.mood;
    drawMascot(c, 58, H - 20, 1.3, L.mascot, L.hat, this.lives <= 0 ? 'sad' : fear, this.t);
    // vidas
    for (let i = 0; i < LIVES; i++) {
      c.save(); c.translate(28 + i * 30, 28); c.scale(1.15, 1.15); c.fillStyle = i < this.lives ? '#ff6b8f' : 'rgba(255,255,255,.18)'; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-14, -4, -8, -14, 0, -7); c.bezierCurveTo(8, -14, 14, -4, 0, 6); c.fill(); c.stroke(); c.restore();
    }
    if (this.name) { c.fillStyle = '#cfe9d4'; c.font = '600 13px ' + F; c.textAlign = 'left'; c.fillText(this.name, 16, 58); }
    // altura + recorde
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '700 38px ' + F;
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.fillText((this.height / 50).toFixed(1) + ' m', W / 2, 40); c.restore();
    c.font = '600 14px ' + F; c.fillStyle = '#cfe9d4';
    c.fillText(this.limit ? 'peça ' + Math.min(this.spawned, this.limit) + ' / ' + this.limit : 'recorde: ' + (Math.max(SAVE.best, this.height) / 50).toFixed(1) + ' m', W / 2, 60);
    // barra da tempestade com o rostinho do vilão (enche quando ele chega, esvazia com o tempo da tempestade)
    const ev = this.evt, spell = !!(ev && ev.kind === 'spell');
    let fill = 0; if (this.fastLeft > 0) fill = this.fastLeft / SPELL_TIME; else if (spell) fill = clamp(ev.t / 1.7, 0, 1);
    const hot = fill > 0, bx = W / 2 - 62, by = 70;
    c.fillStyle = 'rgba(11,31,42,.82)'; c.strokeStyle = hot ? 'rgba(255,140,170,.8)' : 'rgba(169,211,184,.6)'; c.lineWidth = 1.5; rr(bx, by, 124, 26, 13); c.fill(); c.stroke();
    ART.villainFace(c, bx + 17, by + 13, 9 * (hot ? 1 + .08 * Math.sin(this.t * 10) : 1));
    c.fillStyle = '#0b1f2a'; rr(bx + 32, by + 9, 82, 8, 4); c.fill();
    if (fill > 0) { const g = c.createLinearGradient(bx + 32, 0, bx + 114, 0); g.addColorStop(0, '#b48cff'); g.addColorStop(1, '#ff5a6e'); c.fillStyle = g; rr(bx + 32, by + 9, Math.max(8, 82 * fill), 8, 4); c.fill(); }
    if (this.fastLeft > 0) { c.fillStyle = '#ffd0e0'; c.font = '600 12px ' + F; c.textAlign = 'center'; c.fillText('tempestade · peças rápidas', W / 2, by + 42); }
    // próxima peça (canto de cima, à direita)
    c.fillStyle = 'rgba(35,74,64,.88)'; c.strokeStyle = '#a9d3b8'; c.lineWidth = 2; rr(W - 88, 12, 74, 60, 16); c.fill(); c.stroke();
    c.fillStyle = '#cfe9d4'; c.font = '700 11px ' + F; c.textAlign = 'center'; c.fillText('PRÓXIMA', W - 51, 29);
    const cs = SHAPES[this.next], s2 = 11;
    cs.forEach(([cx, cy], i) => drawPart(c, quadFake(W - 51 + cx * s2 - s2 / 2, 50 + cy * s2 - s2 / 2, s2, i + 1), this.next, L.blocks, this.t));
    // vento
    if (ev && ev.kind === 'wind') {
      const warn = ev.t < 1.6; c.font = '600 18px ' + F; c.textAlign = 'center'; c.fillStyle = warn ? '#ffe58a' : '#cfe9d4';
      if (!warn || Math.floor(ev.t * 4) % 2 === 0) c.fillText(warn ? 'vento chegando…' : (ev.dir > 0 ? 'vento ➜' : '⬅ vento'), W / 2, 122);
    }
    // avisos
    for (const p of this.pops) {
      c.globalAlpha = clamp(1.4 - p.t, 0, 1); c.fillStyle = p.color; c.font = '700 24px ' + F; c.textAlign = 'center';
      c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6; c.fillText(p.text, W / 2, 196 - p.t * 28 + this.pops.indexOf(p) * 30); c.restore(); c.globalAlpha = 1;
    }
    if (this.hint > 0 && this.lives > 0) {
      c.save(); c.globalAlpha = clamp(this.hint, 0, 1);
      c.fillStyle = 'rgba(35,74,64,.92)'; c.strokeStyle = '#a9d3b8'; c.lineWidth = 2; rr(36, 250, W - 72, 132, 24); c.fill(); c.stroke();
      c.fillStyle = '#eaf6e6'; c.font = '600 20px ' + F; c.textAlign = 'center';
      c.fillText('↔  Arraste: mover', W / 2, 293); c.fillText('◉  Toque: girar', W / 2, 326); c.fillText('↓  Deslize p/ baixo: cair', W / 2, 359);
      c.restore();
    }
    if (this.lives <= 0) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '700 34px ' + F; c.textAlign = 'center'; c.fillText('Fim!', W / 2, H / 2); }
  }
}

/* ====== CONTROLE DO JOGO ====== */
const Game = { mode: null, arenas: [], running: false, paused: false, over: false, last: 0, acc: 0, raf: 0, duel: null };
const CTRL_SOLO = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], rot: ['ArrowUp', 'KeyW', 'Space'], down: ['ArrowDown', 'KeyS'] };
const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = h => (h / 50).toFixed(1) + ' m';

const SCREENS = ['menu', 'shop', 'profile', 'help', 'duel', 'game'];
let curScreen = 'menu';
const BG = { draw() {} };   // fundo das telas de menu (preenchido mais abaixo)
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  for (const el of ['nav', 'topbar', 'bgArt']) $(el).classList.toggle('hidden', id === 'game');
  curScreen = id; BG.draw();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
}
function levelInfo() {
  const xp = SAVE.xp || 0, lvl = Math.floor(Math.sqrt(xp / 20)) + 1, a = 20 * (lvl - 1) * (lvl - 1), b = 20 * lvl * lvl;
  return { lvl, cur: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}
function refreshWallet() {
  for (const id of ['walletMenu', 'walletShop', 'walletProf']) { const el = $(id); if (el) el.textContent = SAVE.coins; }
  const L = levelInfo(); $('lvlNum').textContent = L.lvl; $('xpFill').style.width = Math.round(L.pct * 100) + '%';
  const xt = $('xpTxt'); if (xt) xt.textContent = L.cur + '/' + L.need + ' XP';
  const nm = $('tbName'); if (nm) nm.textContent = myName();
  const hr = $('homeRec'); if (hr) hr.textContent = '★ Recorde ' + fmt(SAVE.best);
  const av = $('tbAv');
  if (av) { av.width = 60 * DPR; av.height = 60 * DPR; const c = av.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 60, 60);
    ART.slime(c, 30, 55, .45, SAVE.eq.mascot, '', 'idle', 0, { acc: accOf(SAVE.eq.hat) }); }
}
function openProfile() {
  refreshWallet(); show('profile');
  const L = levelInfo(), cv = $('profCv'); cv.width = 130 * DPR; cv.height = 130 * DPR;
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 130, 130);
  ART.glow(c, 65, 80, 70, '255,235,170', .22);
  drawMascot(c, 65, 122, 1.7, SAVE.eq.mascot, SAVE.eq.hat, 'happy', 0);
  $('pLvl').textContent = 'Nv. ' + L.lvl; $('pXp').style.width = Math.round(L.pct * 100) + '%'; $('pXpTxt').textContent = L.cur + ' / ' + L.need + ' XP para o próximo nível';
  const rows = [['Recorde de altura', (SAVE.best / 50).toFixed(1) + ' m'], ['Moedas', SAVE.coins], ['Blocos empilhados', SAVE.blocks], ['Partidas', SAVE.games]];
  $('pStats').innerHTML = rows.map(r => '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
}
function go(id) { if (id === 'shop') openShop(); else if (id === 'menu') goMenu(); else if (id === 'profile') openProfile(); else if (id === 'duel') openDuel(); else if (id === 'help') show('help'); }
function openShopTab(t) { shopTab = t; openShop(); }

const lookMine = () => SAVE.eq;
function lookRival() {
  const alt = ['sol', 'coral', 'ceu', 'lavanda', 'menta', 'perola'].find(m => m !== SAVE.eq.mascot);
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
  for (const id of ['gTool', 'gUndo', 'gSun']) { const tb = $(id); if (tb) tb.classList.toggle('hidden', !Game.arenas.length); }
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

/* ====== DUELO ENTRE AMIGOS (Supabase): você joga primeiro, depois é a vez do amigo ======
   Mesma semente = mesmas peças, vento e feitiços para os dois. O servidor guarda os resultados,
   decide o vencedor e libera o prêmio (50 ao vencedor, 30 para cada no empate). */
const newSeed = () => (Math.random() * 2147483647) >>> 0;
const cmp = (x, y) => { const hx = Math.round(x.h / 5), hy = Math.round(y.h / 5); if (hx !== hy) return hx > hy ? 1 : -1; return x.l === y.l ? 0 : x.l > y.l ? 1 : -1; };
let friends = [], duels = [], playerOk = false, claiming = false;
const firstName = n => String(n || 'Amigo').trim().split(/\s+/)[0].slice(0, 14);
const myName = () => { const m = authUser && authUser.user_metadata || {}; return (m.full_name || m.name) ? firstName(m.full_name || m.name) : (SAVE.name || 'Você'); };
const pById = id => friends.find(f => f.id === id) || { id, name: 'Amigo', avatar: null };
const expired = d => d.status === 'pending' && new Date(d.expires_at) <= Date.now();
function timeLeft(iso) { const ms = new Date(iso) - Date.now(); if (ms <= 0) return ''; const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return h ? h + ' h ' + m + ' min' : m + ' min'; }
const avStyle = u => /^https:\/\//.test(u || '') ? ' style="background-image:url(\'' + esc(encodeURI(u)) + '\')"' : '';

async function upsertPlayer() {
  const m = authUser.user_metadata || {};
  const name = String(m.full_name || m.name || (authUser.email || '').split('@')[0] || 'Jogador').trim().slice(0, 24) || 'Jogador';
  const { error } = await sb.from('players').upsert({ id: authUser.id, name, avatar: m.avatar_url || m.picture || null, updated_at: new Date().toISOString() });
  if (error) throw error; playerOk = true;
}
function openDuel() { show('duel'); duelRefresh(); }
async function duelRefresh(keep) {
  const on = !!sb && !!authUser;
  $('duelGuest').classList.toggle('hidden', on); $('duelMain').classList.toggle('hidden', !on);
  $('duelGuestTxt').textContent = sb ? 'Para duelar com amigos, entre com o Google.' : 'O login não está disponível neste momento.';
  $('btnDuelLogin').classList.toggle('hidden', !sb);
  if (!on) return;
  $('duelMsg').textContent = 'Carregando…';
  try {
    if (!playerOk) await upsertPlayer();
    const [p, d] = await Promise.all([
      sb.from('players').select('id,name,avatar').order('name').limit(500),
      sb.from('duels').select('*').order('created_at', { ascending: false }).limit(20)]);
    if (p.error) throw p.error; if (d.error) throw d.error;
    friends = p.data || []; duels = d.data || [];
    $('duelMsg').textContent = typeof keep === 'string' ? keep : '';
    renderDuels(); renderFriends(); claimAll();
  } catch (e) { console.warn(e); $('duelMsg').textContent = 'Não foi possível carregar os duelos agora. Tente atualizar.'; }
}
function setDuelDot(n) { const d = $('duelDot'); if (!d) return; d.textContent = n; d.classList.toggle('hidden', !(n > 0)); }
async function duelBadge() {   // bolinha vermelha do Duelo no menu = desafios esperando você
  if (!sb || !authUser) return setDuelDot(0);
  try {
    const { data, error } = await sb.from('duels').select('id,opponent,status,expires_at').eq('opponent', authUser.id).eq('status', 'pending').limit(50);
    if (!error) setDuelDot((data || []).filter(d => !expired(d)).length);
  } catch (e) {}
}
function renderDuels() {
  const me = authUser.id, el = $('duelList');
  setDuelDot(duels.filter(d => d.status === 'pending' && d.opponent === me && !expired(d)).length);
  const rank = d => (d.status === 'pending' && d.opponent === me && !expired(d)) ? 0 : (d.status === 'pending' && !expired(d)) ? 1 : 2;
  const list = duels.slice().sort((x, y) => rank(x) - rank(y));
  if (!list.length) { el.innerHTML = '<div class="empty-note">Nenhum duelo ainda. Desafie um amigo abaixo!</div>'; return; }
  el.innerHTML = list.map(d => {
    const mine = d.challenger === me, other = pById(mine ? d.opponent : d.challenger), nm = esc(other.name);
    let info, btn = '';
    if (d.status === 'pending' && expired(d)) info = '<b>' + nm + '</b><span>Expirado sem resposta</span>';
    else if (d.status === 'pending' && mine) info = '<b>Aguardando ' + nm + '</b><span>Sua torre: ' + fmt(d.ch_h) + ' · expira em ' + timeLeft(d.expires_at) + '</span>';
    else if (d.status === 'pending') { info = '<b>' + nm + ' te desafiou!</b><span>Torre a bater: <span class="gold">' + fmt(d.ch_h) + '</span> · expira em ' + timeLeft(d.expires_at) + '</span>'; btn = '<button class="btn mini" data-play="' + esc(d.id) + '">Jogar</button>'; }
    else {
      const my = mine ? [d.ch_h, d.ch_l] : [d.op_h, d.op_l], his = mine ? [d.op_h, d.op_l] : [d.ch_h, d.ch_l];
      const res = d.winner === null ? 'Empate · +30' : d.winner === me ? 'Você venceu · +50' : 'Você perdeu';
      info = '<b>' + fmt(my[0]) + ' × ' + fmt(his[0]) + ' · ' + nm + '</b><span class="gold">' + res + '</span>';
    }
    return '<div class="frow"><div class="av"' + avStyle(other.avatar) + '></div><div class="tx">' + info + '</div>' + btn + '</div>';
  }).join('');
  el.querySelectorAll('[data-play]').forEach(b => b.onclick = () => duelAccept(b.dataset.play));
}
function renderFriends() {
  const me = authUser.id, q = $('friendQ').value.trim().toLowerCase(), el = $('friendList');
  const all = friends.filter(f => f.id !== me), list = all.filter(f => !q || f.name.toLowerCase().includes(q)).slice(0, 60);
  if (!all.length) { el.innerHTML = '<div class="empty-note">Ainda não há amigos cadastrados. Peça para eles entrarem com o Google!</div>'; return; }
  if (!list.length) { el.innerHTML = '<div class="empty-note">Ninguém com esse nome.</div>'; return; }
  const waiting = new Set(duels.filter(d => d.challenger === me && d.status === 'pending' && !expired(d)).map(d => d.opponent));
  el.innerHTML = list.map(f => '<div class="frow"><div class="av"' + avStyle(f.avatar) + '></div><div class="tx"><b>' + esc(f.name) + '</b></div>' +
    (waiting.has(f.id) ? '<button class="btn alt mini" disabled>Aguardando</button>' : '<button class="btn mini" data-ch="' + esc(f.id) + '">Desafiar</button>') + '</div>').join('');
  el.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => duelChallenge(pById(b.dataset.ch)));
}
// recebe os prêmios dos duelos já concluídos (o servidor paga uma única vez por duelo)
async function claimAll() {
  if (claiming || !authUser) return; claiming = true;
  try {
    const me = authUser.id; let total = 0;
    for (const d of duels) {
      const key = d.challenger === me ? 'ch_claimed' : 'op_claimed';
      if (d.status !== 'done' || d[key]) continue;
      const { data, error } = await sb.rpc('claim_duel', { p_id: d.id });
      if (error) continue; d[key] = true; total += +data || 0;
    }
    if (total > 0) { addCoins(total); refreshWallet(); sfx.rec(); $('duelMsg').textContent = '+' + total + ' moedas dos seus duelos!'; }
  } catch (e) { console.warn(e); }
  claiming = false;
}

function duelChallenge(f) {
  Game.duel = { kind: 'send', seed: newSeed(), other: f, row: null };
  duelRun();
}
async function duelAccept(id) {
  const row = duels.find(d => d.id === id); if (!row) return;
  $('duelMsg').textContent = 'Abrindo duelo…';
  try {
    const { data, error } = await sb.rpc('start_duel', { p_id: id });
    if (error) throw error;
    if (data.status === 'done') {   // já tinha começado antes e saiu: conta como derrota
      return duelRefresh('Você já tinha começado esse duelo e saiu no meio, então ele contou como derrota.');
    }
    $('duelMsg').textContent = '';
    Game.duel = { kind: 'recv', seed: row.seed, other: pById(row.challenger), row };
    duelRun();
  } catch (e) { console.warn(e); duelRefresh('Esse duelo não está mais disponível (pode ter expirado).'); }
}
function duelRun() {
  const d = Game.duel;
  startGame('duel', { seed: d.seed, limit: DUEL_PIECES, name: myName(), look: lookMine });
  Game.paused = true;
  const recv = d.kind === 'recv', who = esc(firstName(d.other.name));
  showOverlay('<h2>' + (recv ? 'Duelo contra ' + who : 'Desafiar ' + who) + '</h2><p>' + DUEL_PIECES + ' peças. Mesma sequência, vento e feitiços para os dois.</p>' +
    (recv ? '<p>Torre a bater: <b class="gold">' + fmt(d.row.ch_h) + '</b></p><p class="sub">Você só joga uma vez: se sair no meio, conta como derrota.</p>'
          : '<p class="sub">Você joga primeiro. Depois ' + who + ' tem 1 dia para jogar as mesmas peças.</p>') +
    '<button class="btn" id="oGo">Começar</button><button class="btn alt" id="oMenu">' + (recv ? 'Sair' : 'Cancelar') + '</button>');
  $('oGo').onclick = () => { $('overlay').classList.add('hidden'); Game.paused = false; Game.last = performance.now(); };
  $('oMenu').onclick = () => { stopLoop(); openDuel(); };
}
function duelFinish(a) {
  const d = Game.duel, res = { h: Math.round(a.height), l: a.lives };
  duelSubmit(d, res);
}
async function duelSubmit(d, res) {
  showOverlay('<h2>Salvando…</h2><p>Sua torre: <b class="gold">' + fmt(res.h) + '</b></p>');
  const who = esc(firstName(d.other.name));
  try {
    if (d.kind === 'send') {
      const { error } = await sb.from('duels').insert({ challenger: authUser.id, opponent: d.other.id, seed: d.seed, pieces: DUEL_PIECES, ch_h: res.h, ch_l: res.l });
      if (error) throw error;
      showOverlay('<h2>Desafio enviado!</h2><p>Sua torre: <b class="gold">' + fmt(res.h) + '</b></p><p>' + who + ' tem 1 dia para jogar as mesmas peças. O resultado e as moedas aparecem na tela Duelo.</p>' +
        '<button class="btn" id="oDuels">Ver duelos</button><button class="btn alt" id="oMenu">Menu</button>');
      $('oDuels').onclick = () => { stopLoop(); openDuel(); };
      $('oMenu').onclick = () => { stopLoop(); goMenu(); };
    } else {
      const { data, error } = await sb.rpc('submit_duel', { p_id: d.row.id, p_h: res.h, p_l: res.l });
      if (error) throw error;
      let prize = 0;
      try { const c = await sb.rpc('claim_duel', { p_id: d.row.id }); if (!c.error) prize = +c.data || 0; } catch (e) {}
      if (prize > 0) { addCoins(prize); refreshWallet(); }
      duelResult(d, data, prize);
    }
  } catch (e) {
    console.warn(e);
    showOverlay('<h2>Não deu para salvar</h2><p>Sua torre: <b class="gold">' + fmt(res.h) + '</b></p><p>Confira a conexão e tente de novo.</p>' +
      '<button class="btn" id="oRetry">Tentar de novo</button><button class="btn alt" id="oMenu">Menu</button>');
    $('oRetry').onclick = () => duelSubmit(d, res);
    $('oMenu').onclick = () => { stopLoop(); goMenu(); };
  }
}
function duelResult(d, row, prize) {
  const c = row.winner === null ? 0 : row.winner === row.challenger ? 1 : -1; sfx.win();
  const names = [firstName(d.other.name), myName()], res = [{ h: row.ch_h }, { h: row.op_h }];
  const side = (i, w) => '<div class="' + (w ? 'win' : '') + '"><span>' + (w ? '✦ ' : '') + esc(names[i]) + '</span><b>' + fmt(res[i].h) + '</b></div>';
  showOverlay('<h2>' + (c === 0 ? 'Empate!' : c < 0 ? 'Você venceu!' : esc(names[0]) + ' venceu!') + '</h2>' +
    '<div class="vs">' + side(0, c > 0) + '<em>×</em>' + side(1, c < 0) + '</div>' +
    (prize > 0 ? '<p>Prêmio: <b class="gold">+' + prize + ' moedas</b></p>' : '<p>Boa tentativa! Na próxima você leva.</p>') +
    '<button class="btn" id="oAgain">Desafiar de volta</button><button class="btn alt" id="oDuels">Ver duelos</button><button class="btn alt" id="oMenu">Menu</button>');
  $('oAgain').onclick = () => duelChallenge(d.other);
  $('oDuels').onclick = () => { stopLoop(); openDuel(); };
  $('oMenu').onclick = () => { stopLoop(); goMenu(); };
}

function showOverlay(html) { const o = $('overlay'); o.innerHTML = '<div class="panel">' + html + '</div>'; o.classList.remove('hidden'); }
function setPause(p) {
  if (!Game.running || Game.over) return;
  Game.paused = p;
  if (p) {
    for (const a of Game.arenas) a.touch = null;
    const rv = Game.mode === 'duel' && Game.duel && Game.duel.kind === 'recv';
    const snd = () => muted ? '🔇 Som desligado' : '🔊 Som ligado';
    showOverlay('<h2>Pausado</h2>' + (rv ? '<p class="sub">Se sair, o duelo conta como derrota.</p>' : '') + '<button class="btn" id="oResume">Continuar</button><button class="btn alt" id="oSnd">' + snd() + '</button><button class="btn alt" id="oMenu">Sair para o menu</button>');
    $('oResume').onclick = () => setPause(false);
    $('oSnd').onclick = () => { toggleMute(); $('oSnd').textContent = snd(); };
    $('oMenu').onclick = () => { stopLoop(); goMenu(); };
  } else { $('overlay').classList.add('hidden'); Game.last = performance.now(); }
}
function goMenu() { $('overlay').classList.add('hidden'); refreshWallet(); show('menu'); }

/* ====== LOJA (interface) ====== */
let shopTab = 'mascot';
const shopSel = {};
// torre de exemplo (quadradinhos de 30 px; base em y = 190, centro em x = 175)
const TOWER = [[115,160,'I'],[145,160,'I'],[175,160,'I'],[205,160,'I'],[145,130,'O'],[175,130,'O'],[145,100,'O'],[175,100,'O'],[145,70,'T'],[175,70,'T'],[205,70,'T'],[175,40,'T']];
function drawTower(c, x, y, k, skin, t, cells) {
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-175, -190);
  (cells || TOWER).forEach((q, i) => drawPart(c, quadFake(q[0], q[1], 30, i + 1), q[2], skin, t || 0)); c.restore();
}
function rarity(tab, it) {   // borda do cartão: comum (menta), raro (azul), o mais caro (dourado)
  const ps = CAT[tab].items.map(i => i.p).filter(p => p > 0).sort((a, b) => a - b);
  if (!it.p) return 'r1'; if (it.p === ps[ps.length - 1]) return 'r3';
  return it.p >= ps[Math.floor(ps.length / 2)] ? 'r2' : 'r1';
}
function cardIcon(cv, cat, id) {
  cv.width = 64 * DPR; cv.height = 48 * DPR;
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 64, 48);
  if (cat === 'blocks') ['T', 'O', 'L', 'I'].forEach((tp, i) => drawPart(c, quadFake(13 + (i % 2) * 19, 5 + Math.floor(i / 2) * 19, 18, i + 1), tp, id, 0));
  else if (cat === 'theme') { c.save(); c.beginPath(); c.roundRect ? c.roundRect(0, 0, 64, 48, 10) : c.rect(0, 0, 64, 48); c.clip(); skyScene(c, 64, 48, id); c.restore(); }
  else if (cat === 'base') { c.save(); c.translate(32, 0); c.scale(.3, .3); c.translate(-W / 2, -(BASE_Y - 6) + 62); drawBase(c, id, 0); c.restore(); }
  else if (cat === 'hat') { ART.glow(c, 32, 26, 30, '255,240,200', .35); if (id === 'nenhum') ART.slime(c, 32, 46, .4, SAVE.eq.mascot, '', 'idle', 0); else { c.save(); c.scale(.62, .62); ART.accIcon(c, 64 / .62, 48 / .62, id); c.restore(); } }
  else ART.slime(c, 32, 46, .4, id, '', 'idle', 0);
}
function shopPreview() {
  const cv = $('shopPv'), tab = shopTab, id = shopSel[tab]; if (!cv) return;
  const [c, w, h] = ART.fit(cv); if (!w) return;
  const pedestal = rw => { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(w / 2, h - 26, rw + 4, 12, 0, 0, 7); c.fill(); c.fillStyle = '#b6d6bd'; c.beginPath(); c.ellipse(w / 2, h - 30, rw, 11, 0, 0, 7); c.fill(); };
  const hero = (skin, hat, k) => ART.slime(c, w / 2, h - 32, k || 1.1, skin, '', 'feliz', 0, { acc: accOf(hat) });
  if (tab === 'theme') { skyScene(c, w, h, id); pedestal(62); hero(SAVE.eq.mascot, SAVE.eq.hat, .95); return; }
  ART.glow(c, w / 2, h * .55, w * .5, '255,235,170', .2);
  [[.1, .5], [.9, .75], [.2, .82], [.86, .3]].forEach(([a, b], i) => { const x = a * w, y = b * h, s = 5 + i % 2 * 2; c.fillStyle = '#fff6c9'; c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill(); });
  if (tab === 'mascot') { pedestal(66); hero(id, SAVE.eq.hat); }
  else if (tab === 'hat') { pedestal(66); hero(SAVE.eq.mascot, id); }
  else if (tab === 'blocks') { pedestal(80); drawTower(c, w / 2, h - 32, .6, id, 0); }
  else if (tab === 'base') {
    c.save(); c.translate(w / 2, h * .45); c.scale(.8, .8); c.translate(-W / 2, -BASE_Y); drawBase(c, id, 0); c.restore();
    drawTower(c, w / 2, h * .45 - 4, .4, SAVE.eq.blocks, 0);
  }
}
function renderShop() {
  refreshWallet();
  const tabs = $('tabs'); tabs.innerHTML = '';
  for (const k in CAT) {
    const b = document.createElement('button'); b.className = 'tab' + (k === shopTab ? ' on' : ''); b.textContent = CAT[k].label; b.type = 'button';
    b.onclick = () => { shopTab = k; renderShop(); }; tabs.appendChild(b);
  }
  const items = CAT[shopTab].items;
  if (!items.some(i => i.id === shopSel[shopTab])) shopSel[shopTab] = SAVE.eq[shopTab];
  const grid = $('grid'); grid.innerHTML = '';
  for (const it of items) {
    const owned = SAVE.owned[shopTab].includes(it.id), eq = SAVE.eq[shopTab] === it.id;
    const d = document.createElement('div'); d.className = 'item ' + rarity(shopTab, it) + (eq ? ' eq' : '') + (it.id === shopSel[shopTab] ? ' sel' : '');
    const cv = document.createElement('canvas'); d.appendChild(cv); cardIcon(cv, shopTab, it.id);
    d.insertAdjacentHTML('beforeend', eq ? '<span class="tag use">✓ Em uso</span>' : owned ? '<span class="tag own">Tenho</span>' : '<span class="tag"><span class="coin"></span>' + it.p + '</span>');
    d.onclick = () => { shopSel[shopTab] = it.id; renderShop(); };
    grid.appendChild(d);
  }
  for (let i = items.length; i % 3; i++) grid.insertAdjacentHTML('beforeend', '<div class="item lock"><svg viewBox="0 0 48 48" width="40" height="40"><rect x="12" y="22" width="24" height="18" rx="5" fill="#ffffff44"/><path d="M17 22v-5a7 7 0 0 1 14 0v5" stroke="#ffffff66" stroke-width="4" fill="none" stroke-linecap="round"/></svg><span class="tag soon">Em breve</span></div>');
  const it = items.find(i => i.id === shopSel[shopTab]), owned = SAVE.owned[shopTab].includes(it.id), eq = SAVE.eq[shopTab] === it.id;
  $('shopName').textContent = it.n;
  const b = $('shopBuy'); b.className = 'btn'; b.disabled = false; b.onclick = null;
  if (eq) { b.className = 'btn alt'; b.textContent = '✓ EM USO'; b.disabled = true; }
  else if (owned) { b.textContent = 'USAR'; b.onclick = () => { SAVE.eq[shopTab] = it.id; persist(); BG.draw(); renderShop(); }; }
  else if (SAVE.coins >= it.p) {
    b.innerHTML = 'COMPRAR · <span class="coin"></span> ' + it.p;
    b.onclick = () => { if (SAVE.coins < it.p) return; SAVE.coins -= it.p; SAVE.owned[shopTab].push(it.id); SAVE.eq[shopTab] = it.id; persist(); sfx.coin(); BG.draw(); renderShop(); };
  } else { b.className = 'btn grey'; b.innerHTML = 'FALTAM <span class="coin"></span> ' + (it.p - SAVE.coins); b.disabled = true; }
  shopPreview();
}
function openShop() { show('shop'); renderShop(); }

/* ====== EVENTOS ====== */
const BLOCK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
window.addEventListener('keydown', e => {
  if (!$('game').classList.contains('hidden')) {
    if (BLOCK_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) setPause(!Game.paused); return; }
    if (!e.repeat && !Game.paused && !Game.over) for (const a of Game.arenas) { if (a.ctrl.rot.includes(e.code)) a.rotate(); if (e.code === 'KeyE' || e.code === 'KeyC') a.useTool(); if (e.code === 'KeyZ' || e.code === 'KeyU') a.undo(); if (e.code === 'KeyX' || e.code === 'KeyT') a.stopStorm(); }
  }
  keysDown.add(e.code);
});
window.addEventListener('keyup', e => keysDown.delete(e.code));
window.addEventListener('blur', () => { keysDown.clear(); setPause(true); });
window.addEventListener('contextmenu', e => e.preventDefault());
$('btnSolo').onclick = () => startGame('solo');
$('btnAcct').onclick = () => openProfile();
$('tbAvBox').onclick = () => openProfile();
$('btnDuelLogin').onclick = () => openProfile();
$('btnDuelRefresh').onclick = () => duelRefresh();
$('friendQ').oninput = () => { if (authUser) renderFriends(); };
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { stopLoop(); go(b.dataset.go); });
$('gPause').onclick = () => setPause(!Game.paused);
$('gTool').onclick = () => { const a = Game.arenas[0]; if (a && !Game.paused && !Game.over) a.useTool(); };
$('gSun').onclick = () => { const a = Game.arenas[0]; if (a && !Game.paused && !Game.over) a.stopStorm(); };
$('gUndo').onclick = () => { const a = Game.arenas[0]; if (a && !Game.paused && !Game.over) a.undo(); };
function syncTool() {
  const a = Game.arenas[0], b = $('gTool');
  const on = !!a && curScreen === 'game';
  for (const id of ['gTool', 'gUndo', 'gSun']) { const tb = $(id); if (tb) tb.classList.toggle('hidden', !on); }
  if (!a || !b) return;
  const n = String(a.tools); if (b.dataset.n !== n) { b.dataset.n = n; $('gToolN').textContent = n; }
  const u = $('gUndo'), un = String(a.undos); if (u.dataset.n !== un) { u.dataset.n = un; $('gUndoN').textContent = un; } u.classList.toggle('empty', a.undos <= 0);
  const sn = $('gSun'), sv = String(a.stops); if (sn.dataset.n !== sv) { sn.dataset.n = sv; $('gSunN').textContent = sv; } sn.classList.toggle('empty', a.stops <= 0); sn.classList.toggle('armed', a.fastLeft > 0 || !!(a.evt && a.evt.kind === 'spell'));
  b.classList.toggle('armed', !!a.cement); b.classList.toggle('empty', a.tools <= 0 && !a.cement);
}
function toggleMute() { muted = !muted; document.body.classList.toggle('muted', muted); }
$('btnMute').onclick = toggleMute; $('gMute').onclick = toggleMute;

/* fundo das telas: cenário equipado na tela inicial, musgo nas outras (o jogo desenha o próprio fundo) */
(function bgArt() {
  const cv = $('bgArt'); let last = '';
  BG.draw = function () {
    if (curScreen === 'game') return;
    const key = (curScreen === 'menu' ? 'scene:' + SAVE.eq.theme : 'moss') + '|' + innerWidth + 'x' + innerHeight;
    if (key === last) return; last = key;
    const [c, w, h] = ART.fit(cv);
    if (curScreen === 'menu') skyScene(c, w, h, SAVE.eq.theme || 'noite'); else ART.menuBg(c, w, h);
  };
  window.addEventListener('resize', () => { last = ''; BG.draw(); });
  BG.draw();
})();

/* tela inicial: ilha com a torre-casa e o personagem */
(function hero() {
  const cv = $('hero'); if (!cv) return;
  let C = null; window.addEventListener('resize', () => { C = null; });
  function frame(ms) {
    requestAnimationFrame(frame);
    if ($('menu').classList.contains('hidden')) { C = null; return; }
    if (!C) { C = ART.fit(cv); if (!C[1]) { C = null; return; } }
    const [c, w, h] = C, t = ms / 1000, L = SAVE.eq;
    const k = Math.min(w / 390, h / 330), cx = w / 2, cy = h * .58;
    c.clearRect(0, 0, w, h);
    c.save(); c.translate(cx, cy); c.scale(k, k);
    ART.islet(c, -125, -150, .8, '#2f8a6b'); ART.islet(c, 140, -40, .7, '#2f8a6b'); ART.islet(c, -150, -10, .5, '#2a7a62');
    ART.glow(c, 0, 60, 190, '255,225,120', .18);
    const base = mig('base', L.base);
    if (base === 'nuvem') ART.cloudBase(c, 0, 18, 1.4); else ART.island(c, 0, 0, 1.5, BPAL[base] ? base : 'ilha', base === 'ilha');
    if (base === 'ilha') {
      [[78, 14, 5], [92, 2, 4], [-96, 8, 5]].forEach(([x, y, r]) => ART.poly(c, [[x - r, y], [x, y - r * .8], [x + r, y], [x, y + r * .6]], '#9fb9a2'));
      ART.rtree(c, -122, -10, 1.1, '#2f8a5b'); ART.rtree(c, -104, -24, .9, '#2a7d55'); ART.rtree(c, 104, -18, 1, '#2f8a5b'); ART.rtree(c, 120, -6, .8, '#3a9a66');
      [[60, 24, '#e2527a'], [-60, 30, '#ffb347']].forEach(([x, y, col]) => { c.fillStyle = '#f6ecd8'; c.fillRect(x - 2, y - 8, 4, 8); ART.poly(c, [[x - 8, y - 8], [x + 8, y - 8], [x + 5, y - 15], [x - 5, y - 15]], col); });
      ART.crys(c, 104, 34, .8, '#ffd84a'); ART.crys(c, 130, 14, .9, '#ffd84a'); ART.crys(c, 140, 26, .6, '#ffd84a');
    }
    // torre-casa com porta acesa
    const S = 26, bx = 30, by = 8;
    ART.drawPieces(c, bx - 2.5 * S, by, S, STY[L.blocks] ? L.blocks : 'geleia');
    { const dx = bx - S, dy = by, ww = 18, hh = 24;
      c.fillStyle = '#2a2140'; c.beginPath(); c.moveTo(dx - ww / 2, dy); c.lineTo(dx - ww / 2, dy - hh + ww / 2); c.arc(dx, dy - hh + ww / 2, ww / 2, Math.PI, 0); c.lineTo(dx + ww / 2, dy); c.closePath(); c.fill();
      const dg = c.createLinearGradient(0, dy - hh, 0, dy); dg.addColorStop(0, '#ffe9a8'); dg.addColorStop(1, '#ffb347');
      c.fillStyle = dg; c.beginPath(); c.moveTo(dx - ww / 2 + 3, dy); c.lineTo(dx - ww / 2 + 3, dy - hh + ww / 2 + 1); c.arc(dx, dy - hh + ww / 2 + 1, ww / 2 - 3, Math.PI, 0); c.lineTo(dx + ww / 2 - 3, dy); c.closePath(); c.fill(); }
    ART.slime(c, -84, 26, .82, L.mascot, '', (t % 5) > 4.2 ? 'feliz' : 'idle', t, { acc: accOf(L.hat) });
    const f = Math.sin(t * 1.5) * 3; ART.crys(c, 66, -150 + f, .9, '#ffd84a'); ART.crys(c, -70, -118 - f, .7, '#ffd84a');
    c.restore();
  }
  requestAnimationFrame(frame);
})();

refreshWallet();
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
function setAuthMsg(t) { const el = $('authMsg'); if (el) el.textContent = t; }
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
  if (cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/COLE_/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) && window.supabase) {
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }
  }
  renderAcct();
  if (!sb) return;
  $('btnGoogle').onclick = async () => {
    setAuthMsg('Abrindo o Google…');
    try {
      // pegamos o endereço de login e levamos a chave junto (o Supabase novo exige a chave no pedido)
      const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true } });
      if (r.error || !r.data || !r.data.url) throw r.error || new Error('endereço de login vazio');
      const u = new URL(r.data.url); if (!u.searchParams.has('apikey')) u.searchParams.set('apikey', cfg.SUPABASE_ANON_KEY);
      location.href = u.toString();
    } catch (e) { setAuthMsg('Não foi possível abrir o login: ' + ((e && e.message) || e)); }
  };
  $('btnLogout').onclick = async () => { await sb.auth.signOut(); authUser = null; playerOk = false; friends = []; duels = []; renderAcct(); setDuelDot(0); refreshWallet(); };
  sb.auth.onAuthStateChange((ev, session) => {
    const u = session && session.user ? session.user : null;
    const first = u && (!authUser || authUser.id !== u.id);
    authUser = u; renderAcct(); if (first) playerOk = false;
    if (first) { setTimeout(pullCloud, 0); setTimeout(duelBadge, 1500); }   // fora do callback, como recomenda o Supabase
    refreshWallet();
  });
}
initAuth();
// se o login voltou com erro (o Supabase manda o motivo no endereço), mostra na tela do Perfil
(function authReturnError() {
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const err = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
  if (!err) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  setTimeout(() => { openProfile(); setAuthMsg('O login voltou com erro: ' + err); }, 500);
})();
})();
