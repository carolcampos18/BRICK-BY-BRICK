/* art.js — arte 2D compartilhada (início, loja, jogo). Personagens atualizados em 10/11/2026: herói com skins + acessórios, vilão de tempestade novo. */
const R=(a,b,s)=>{let x=Math.sin(s*127.1+a*311.7+b*74.7)*43758.5453;return x-Math.floor(x)};
function fit(cv){const d=Math.min(devicePixelRatio||1,2),r=cv.getBoundingClientRect();cv.width=r.width*d;cv.height=r.height*d;const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);return[c,r.width,r.height]}
function poly(c,pts,fill){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle=fill;c.fill()}
function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=k<0?0:255,t=Math.abs(k);r=Math.round(r+(f-r)*t);g=Math.round(g+(f-g)*t);b=Math.round(b+(f-b)*t);return`rgb(${r},${g},${b})`}
function lgr(c,y0,y1,stops){const g=c.createLinearGradient(0,y0,0,y1);stops.forEach(([o,col])=>g.addColorStop(o,col));return g}
function glow(c,x,y,r,rgb,al){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${rgb},${al})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r)}

/* ---------- elementos 2D ---------- */
function starsF(c,w,h,n,al){const k=Math.min(1,h/260);n=Math.max(7,Math.round(n*k));for(let i=0;i<n;i++){c.globalAlpha=al*(.4+R(i,4,3)*.6);c.fillStyle='#fff';c.beginPath();c.arc(R(i,1,3)*w,R(i,2,3)*h,(.5+R(i,3,3)*1.2)*(.5+.5*k),0,7);c.fill()}c.globalAlpha=1}
function diamond(c,x,y,s,col){poly(c,[[x,y-s],[x+s,y],[x,y+s],[x-s,y]],col)}
function shoot(c,x,y,len,ang){c.save();c.translate(x,y);c.rotate(ang);const g=c.createLinearGradient(-len,0,0,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.95)');c.strokeStyle=g;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-len,0);c.lineTo(0,0);c.stroke();c.restore()}
function crescent(c,mx,my,mr,col,glowOn){const oc=document.createElement('canvas');oc.width=oc.height=Math.ceil(mr*4);const o=oc.getContext('2d');o.fillStyle=col;o.beginPath();o.arc(mr*2,mr*2,mr,0,7);o.fill();o.globalCompositeOperation='destination-out';o.beginPath();o.arc(mr*2+mr*.6,mr*2-mr*.27,mr*.86,0,7);o.fill();c.save();if(glowOn){c.shadowColor=col;c.shadowBlur=mr*.8}c.drawImage(oc,mx-mr*2,my-mr*2);c.restore()}
function hillLayer(c,w,h,y,col,seed,amp){c.fillStyle=col;c.beginPath();c.moveTo(0,h);c.lineTo(0,y);const n=5;for(let i=0;i<n;i++){const x1=(i+.5)/n*w,x2=(i+1)/n*w;c.quadraticCurveTo(x1,y-amp*(.3+R(i,seed,3)*1.2),x2,y-R(i+1,seed,3)*amp*.7)}c.lineTo(w,h);c.closePath();c.fill()}
function trunkF(c,x,wd,hh,a,b){const g=c.createLinearGradient(x,0,x+wd,0);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(x,0,wd,hh)}
function bush(c,x,y,r,col){c.fillStyle=col;for(let k=-2;k<=2;k++){c.beginPath();c.ellipse(x+k*r*.5,y-r*(.5-Math.abs(k)*.1),r*.55,r*.6,0,0,7);c.fill()}}
function cloudF(c,x,y,s,col){c.fillStyle=col;[[0,0,16],[18,-7,20],[38,-1,15]].forEach(([dx,dy,r])=>{c.beginPath();c.arc(x+dx*s,y+dy*s,r*s,0,7);c.fill()});c.beginPath();c.roundRect(x-14*s,y-2*s,66*s,16*s,8*s);c.fill()}
function crys(c,x,y,s,col){c.save();c.translate(x,y);c.shadowColor=col;c.shadowBlur=14*s;poly(c,[[0,-22*s],[7*s,-4*s],[0,6*s],[-7*s,-4*s]],col);c.shadowBlur=0;poly(c,[[0,-22*s],[7*s,-4*s],[0,6*s]],shade(col,.35));poly(c,[[0,-22*s],[-7*s,-4*s],[0,-2*s]],shade(col,.6));c.restore()}
function rtree(c,x,y,s,col){c.fillStyle='#244a3a';c.fillRect(x-1.5*s,y-8*s,3*s,8*s);[[0,-16,10,12],[0,-27,7.5,9.5]].forEach(([dx,dy,rx,ry],i)=>{c.fillStyle=i?shade(col,.1):col;c.beginPath();c.ellipse(x+dx*s,y+dy*s,rx*s,ry*s,0,0,7);c.fill()});c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(x-3*s,y-29*s,2.5*s,4*s,.4,0,7);c.fill()}


/* ---------- cenários ---------- */
function menuBg(c,w,h){ // fundo neutro (musgo) das telas de menu
  c.fillStyle=lgr(c,0,h,[[0,'#17372f'],[.5,'#1e4a3f'],[1,'#143a3a']]);c.fillRect(0,0,w,h);
  for(let i=0;i<18;i++){c.globalAlpha=.04+R(i,2,5)*.07;c.fillStyle='#bff5d2';c.beginPath();c.arc(R(i,7,5)*w,R(i,8,5)*h,10+R(i,9,5)*40,0,7);c.fill()}c.globalAlpha=1;
  glow(c,w/2,h*.4,w*.9,'120,200,160',.10)}
function scene(c,w,h,id){
  const vg=(a,b,d)=>{c.fillStyle=lgr(c,0,h,[[0,a],[.55,b],[1,d]]);c.fillRect(0,0,w,h)};
  const stars=(n,al)=>starsF(c,w,h*.8,n,al);
  const bokeh=(n,col,al)=>{n=Math.max(4,Math.round(n*Math.min(1,h/200)));for(let i=0;i<n;i++){c.globalAlpha=al*(.4+R(i,2,5));c.fillStyle=col;c.beginPath();c.arc(R(i,7,5)*w,h*.35+R(i,8,5)*h*.6,3+R(i,9,5)*9*Math.min(1.6,h/200),0,7);c.fill()}c.globalAlpha=1};
  const trunk=(x,wd,dark)=>{const g=c.createLinearGradient(x,0,x+wd,0);g.addColorStop(0,dark?'#07161f':'#0d2a2c');g.addColorStop(1,dark?'#0d2a2c':'#07161f');c.fillStyle=g;c.fillRect(x,0,wd,h*.78)};
  if(id==='noite'){const k=w/390;
    c.fillStyle=lgr(c,0,h,[[0,'#0a1b36'],[.45,'#12404f'],[1,'#1d5a49']]);c.fillRect(0,0,w,h);
    glow(c,w*.68,h*.2,w*.7,'255,240,190',.26);
    stars(110,1);
    [[.15,.3],[.88,.5],[.3,.6],[.62,.14]].forEach(([a,b],i)=>{const x=a*w,y=b*h,s=(5+i%2*2)*Math.max(.5,k);c.fillStyle='#fff6c9';c.beginPath();c.moveTo(x,y-s);c.quadraticCurveTo(x,y,x+s,y);c.quadraticCurveTo(x,y,x,y+s);c.quadraticCurveTo(x,y,x-s,y);c.quadraticCurveTo(x,y,x,y-s);c.fill()});
    shoot(c,w*.52,h*.15,w*.39,-.5);
    crescent(c,w*.68,h*.2,Math.max(6,h*.04),'#fff1c4',true);
    trunk(-14*k,46*k,0);trunk(w-30*k,52*k,1);trunk(26*k,14*k,0);trunk(w-48*k,12*k,1);
    c.fillStyle=lgr(c,h*.55,h,[[0,'rgba(80,170,130,0)'],[1,'rgba(80,170,130,.35)']]);c.fillRect(0,h*.55,w,h*.45);
    bokeh(16,'#bff5d2',.12)}
  if(id==='dia'){vg('#c9f2e4','#5cbcae','#1f7585');
    for(let i=0;i<6;i++){c.fillStyle='rgba(255,255,255,'+(.05+R(i,1,1)*.1)+')';c.fillRect(w*(.2+i*.12),0,w*.05,h)}
    [[.08,.95],[.2,.8],[.88,.9],[.78,.72]].forEach(([a,b],i)=>{const x=a*w,y=b*h;c.fillStyle=i%2?'#1c6a6c':'#145558';c.beginPath();c.ellipse(x,y-h*.2,h*.1,h*.28,0,0,7);c.fill();c.fillRect(x-3,y-h*.1,6,h*.15)});
    bokeh(14,'#ffffff',.22);crys(c,w*.82,h*.28,h/110,'#ffe36a');crys(c,w*.15,h*.4,h/160,'#ffe36a')}
  if(id==='por'){vg('#cf5a4a','#e8806f','#f4bb92');c.fillStyle='#f2b24a';c.beginPath();c.arc(w*.3,h*.62,h*.2,0,7);c.fill();
    [[.15,.25,.9],[.78,.4,1.1]].forEach(([a,b,s])=>{c.fillStyle='#fde4de';[[0,0,16],[18,-6,20],[38,0,15],[18,6,22]].forEach(([dx,dy,r])=>{c.beginPath();c.arc(w*a+dx*s*h/300,h*b+dy*s*h/300,r*s*h/300,0,7);c.fill()})});
    for(let i=0;i<9;i++){c.fillStyle='#fde9c9';c.beginPath();c.ellipse(R(i,1,2)*w,R(i,2,2)*h*.6,5,2.5,R(i,3,2)*3,0,7);c.fill()}
    c.fillStyle='#8f3a3a';c.fillRect(0,h*.86,w,h*.14);for(let i=0;i<w/18;i++){c.fillRect(i*18,h*.82,10,h*.06)}}
  if(id==='aurora'){vg('#06162a','#0c3340','#14513f');stars(50,.9);
    [['rgba(100,255,190,.28)',.3],['rgba(150,120,255,.24)',.42],['rgba(100,230,255,.2)',.52]].forEach(([col,y])=>{c.strokeStyle=col;c.lineWidth=h*.14;c.lineCap='round';c.beginPath();c.moveTo(-10,h*(y+.1));c.bezierCurveTo(w*.3,h*(y-.2),w*.6,h*(y+.3),w+10,h*(y-.05));c.stroke()});
    for(let i=0;i<14;i++){c.fillStyle='#ffe9a0';c.shadowColor='#ffe9a0';c.shadowBlur=8;c.beginPath();c.arc(R(i,5,4)*w,h*.5+R(i,6,4)*h*.45,1.8,0,7);c.fill();c.shadowBlur=0}
    trunk(-6,w*.09,1);trunk(w*.95,w*.09,0)}
  if(id==='espaco'){vg('#1b1038','#3b2574','#74429f');stars(40,.9);
    c.fillStyle='#d9c8ff';c.shadowColor='#e9ddff';c.shadowBlur=24;c.beginPath();c.arc(w*.58,h*.4,h*.3,0,7);c.fill();c.shadowBlur=0;
    c.fillStyle='rgba(120,90,190,.35)';[[.5,.34,.07],[.66,.5,.05],[.6,.28,.04]].forEach(([a,b,r])=>{c.beginPath();c.arc(w*a,h*b,h*r,0,7);c.fill()});
    c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=3;c.beginPath();c.ellipse(w*.58,h*.42,h*.5,h*.1,-.25,0,7);c.stroke();
    [['#4a2f80',[[0,1],[.15,.62],[.3,.78],[.45,.58],[.6,1]]],['#35205f',[[.4,1],[.6,.66],[.78,.8],[.9,.6],[1,1]]]].forEach(([col,pts])=>poly(c,pts.map(([a,b])=>[a*w,b*h]),col));
    crys(c,w*.15,h*.72,h/120,'#ffe36a');crys(c,w*.88,h*.7,h/150,'#ffe36a')}
}

/* ---------- bases (ilhas low-poly) ---------- */
const BPAL={ilha:['#78c273','#5e7a62','#3f5a52'],coral:['#ec8a78','#b9524a','#8c3a40'],vulcao:['#7a6560','#55403f','#33282c'],cristal:['#a58ee0','#6f5db0','#4a3d86']};
function island(c,cx,cy,s,id,noExtras){
  const P=BPAL[id],N=9,rx=100*s,ry=34*s,rim=[];
  for(let i=0;i<N;i++){const a=i/N*6.283,j=1+(R(i,3,9)-.5)*.14;rim.push([cx+Math.cos(a)*rx*j,cy+Math.sin(a)*ry*j])}
  const dep=18*s,low=rim.map(p=>[p[0]+(cx-p[0])*.06,p[1]+dep]),apex=[cx+4*s,cy+126*s];
  for(let i=0;i<N;i++){const j=(i+1)%N;if(rim[i][1]<cy-4*s&&rim[j][1]<cy-4*s)continue;
    const mid=[(low[i][0]+low[j][0])/2*.55+apex[0]*.45,(low[i][1]+low[j][1])/2+(apex[1]-low[i][1])*.55];
    poly(c,[rim[i],rim[j],low[j],low[i]],shade(P[1],-.05-R(i,5,2)*.12));
    poly(c,[low[i],low[j],mid],shade(P[2],.1-R(i,6,2)*.2));poly(c,[mid,low[j],apex],shade(P[2],-.1-R(i,7,2)*.2));poly(c,[low[i],apex,mid],shade(P[2],-.15))}
  const ctr=[cx+3*s,cy-4*s];
  for(let i=0;i<N;i++){const j=(i+1)%N,l=(Math.cos(i/N*6.28-2.4)+1)/2;poly(c,[rim[i],rim[j],ctr],shade(P[0],-.3+l*.4))}
  if(noExtras)return;
  if(id==='ilha'){rtree(c,cx-70*s,cy-4*s,.8*s,'#2f8a5b');rtree(c,cx-54*s,cy-14*s,.65*s,'#2a7d55');rtree(c,cx+72*s,cy-8*s,.75*s,'#3a9a66');crys(c,cx+84*s,cy+10*s,.7*s,'#ffd84a')}
  if(id==='coral'){c.fillStyle='#f5cfc6';c.beginPath();c.roundRect(cx+30*s,cy-34*s,22*s,32*s,5*s);c.fill();
    c.fillStyle='#8c2f44';c.beginPath();c.moveTo(cx+26*s,cy-34*s);c.bezierCurveTo(cx+26*s,cy-58*s,cx+41*s,cy-62*s,cx+41*s,cy-72*s);c.bezierCurveTo(cx+41*s,cy-62*s,cx+56*s,cy-58*s,cx+56*s,cy-34*s);c.closePath();c.fill();
    c.fillStyle='#2a2140';c.beginPath();c.roundRect(cx+36*s,cy-22*s,10*s,20*s,5*s);c.fill();
    c.fillStyle='#f5cfc6';c.beginPath();c.roundRect(cx-76*s,cy-20*s,36*s,18*s,5*s);c.fill();c.fillStyle='#9d3f4a';for(let k=0;k<4;k++){c.beginPath();c.roundRect(cx-74*s+k*9*s,cy-25*s,6*s,7*s,2*s);c.fill()}}
  if(id==='vulcao'){c.fillStyle='#5b4646';c.beginPath();c.moveTo(cx-62*s,cy+2*s);c.bezierCurveTo(cx-40*s,cy-10*s,cx-24*s,cy-52*s,cx-12*s,cy-56*s);c.lineTo(cx+12*s,cy-56*s);c.bezierCurveTo(cx+24*s,cy-52*s,cx+40*s,cy-10*s,cx+62*s,cy+2*s);c.closePath();c.fill();
    c.fillStyle='#ff9a3c';c.beginPath();c.ellipse(cx,cy-56*s,13*s,5*s,0,0,7);c.fill();c.strokeStyle='#ff9a3c';c.lineWidth=4*s;c.lineCap='round';c.beginPath();c.moveTo(cx+4*s,cy-52*s);c.quadraticCurveTo(cx+14*s,cy-30*s,cx+10*s,cy-6*s);c.stroke();
    c.fillStyle='rgba(255,154,60,.35)';c.beginPath();c.arc(cx,cy-64*s,18*s,0,7);c.fill()}
  if(id==='cristal'){crys(c,cx-30*s,cy-6*s,1.7*s,'#ffd84a');crys(c,cx+10*s,cy-8*s,2.2*s,'#ffe36a');crys(c,cx+50*s,cy-2*s,1.4*s,'#c9b3ff');crys(c,cx-62*s,cy+4*s,1*s,'#ffd84a')}
}
function cloudBase(c,cx,cy,s){
  glow(c,cx,cy+40*s,110*s,'255,255,255',.5);
  [[-60,6,30],[-28,-8,38],[10,-10,40],[48,0,34],[72,10,24],[0,12,44],[-44,14,30],[36,14,32]].forEach(([dx,dy,r],i)=>{c.fillStyle=i<5?'#fff':'#e9f1ff';c.beginPath();c.arc(cx+dx*s,cy+dy*s,r*s,0,7);c.fill()});
  c.fillStyle='#d7e4f7';c.beginPath();c.ellipse(cx,cy+30*s,84*s,12*s,0,0,7);c.fill()}
function drawBase(c,cx,cy,s,id){id==='nuvem'?cloudBase(c,cx,cy,s):island(c,cx,cy,s,id)}
function islet(c,x,y,s,col){col=col||'#2f8a6b';
  const top=[[x-34*s,y],[x-12*s,y-9*s],[x+18*s,y-7*s],[x+36*s,y],[x+10*s,y+6*s],[x-18*s,y+6*s]];
  poly(c,top,col);poly(c,[top[0],top[5],[x,y+34*s]],'#23463f');poly(c,[top[5],top[4],[x,y+34*s]],'#1a3a36');poly(c,[top[4],top[3],[x,y+34*s]],'#143029');
  for(let i=0;i<2;i++)rtree(c,x-8*s+i*16*s,y-3*s,.66*s,'#2a8a62')}

/* ---------- peças de Tetris ---------- */
const SW_STONE=['#8d94a8','#a89f8f','#7f8aa0','#9c9486','#8791a5','#a69a88'];
const STY={
 geleia:{pal:['#62b9b0','#f2c764','#93c98f','#9a86d4','#6e9fd8','#e8806f'],mode:'glossy'},
 pedra:{pal:SW_STONE,mode:'stone'},
 gelo:{pal:['#b9ecf5','#a8d8f0','#cdf3fa','#9fd0ee','#bfeaf7','#d6f6ff'],mode:'ice'},
 doce:{pal:['#ff7fa8','#ffd36b','#7fe3c0','#b99cff','#7fc4ff','#ff9f7a'],mode:'candy'},
 neon:{pal:['#4de8d0','#ffd84a','#7dff8a','#b08cff','#5aa8ff','#ff6fa3'],mode:'neon'},
 ouro:{pal:['#f6c443','#e9a93a','#ffd96a','#d99a2b','#f2bb4a','#ffe08a'],mode:'gold'}
};
const PCS=[[[0,0],[1,0],[2,0],[3,0]],[[0,1],[1,1],[0,2],[1,2]],[[2,1],[3,1],[3,2],[4,2]],[[0,3],[1,3],[2,3],[1,4]],[[3,3],[4,3],[4,4],[4,5]],[[0,5],[1,5],[2,5],[2,6]]];
function drawPieces(c,x0,by,S,sty,only){
  const st=STY[sty],owner={},list=only||PCS;
  list.forEach((cells,pi)=>cells.forEach(([i,j])=>owner[i+','+j]=pi));
  list.forEach((cells,pi)=>{
    const col=st.pal[pi%6],has=(i,j)=>owner[i+','+j]===pi,r=S*.27,m=S*.27;
    const px=i=>x0+i*S,py=j=>by-(j+1)*S;
    let fill=col;
    if(st.mode==='neon')fill='#10303a';
    if(st.mode==='gold'){const g=c.createLinearGradient(0,by-7*S,0,by);g.addColorStop(0,'#ffe9a0');g.addColorStop(.5,col);g.addColorStop(1,'#b9791a');fill=g}
    c.save();if(st.mode==='ice')c.globalAlpha=.88;c.fillStyle=fill;
    cells.forEach(([i,j])=>{const x=px(i),y=py(j);c.beginPath();c.roundRect(x+1,y+1,S-2,S-2,r);c.fill();
      if(has(i+1,j))c.fillRect(x+S-m,y+1,2*m,S-2);if(has(i,j+1))c.fillRect(x+1,y-m,S-2,2*m);
      if(has(i+1,j)&&has(i,j+1)&&has(i+1,j+1))c.fillRect(x+S-m,y-m,2*m,2*m)});
    c.restore();
    cells.forEach(([i,j],k)=>{const x=px(i),y=py(j),top=!has(i,j+1),bot=!has(i,j-1),lf=!has(i-1,j),rt=!has(i+1,j);
      if(st.mode==='neon'){c.save();c.strokeStyle=col;c.lineWidth=2;c.lineCap='round';c.shadowColor=col;c.shadowBlur=8;c.beginPath();
        const sx=has(i-1,j)?x:x+r,ex=has(i+1,j)?x+S:x+S-r,sy=has(i,j+1)?y:y+r,ey=has(i,j-1)?y+S:y+S-r;
        if(top){c.moveTo(sx,y+2);c.lineTo(ex,y+2)}if(bot){c.moveTo(sx,y+S-2);c.lineTo(ex,y+S-2)}
        if(lf){c.moveTo(x+2,sy);c.lineTo(x+2,ey)}if(rt){c.moveTo(x+S-2,sy);c.lineTo(x+S-2,ey)}c.stroke();c.restore();return}
      if(top){c.fillStyle='rgba(255,255,255,'+(st.mode==='ice'?.55:.28)+')';c.beginPath();c.roundRect(x+S*.2,y+S*.15,S*.6,S*.2,S*.1);c.fill()}
      if(bot){c.fillStyle=st.mode==='ice'?'rgba(60,120,170,.18)':'rgba(40,30,70,.2)';c.beginPath();c.roundRect(x+S*.2,y+S*.7,S*.6,S*.15,S*.07);c.fill()}
      if(st.mode==='ice'){c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.3;c.beginPath();if(top){c.moveTo(x+r,y+1.5);c.lineTo(x+S-r,y+1.5)}if(lf){c.moveTo(x+1.5,y+r);c.lineTo(x+1.5,y+S-r)}c.stroke()}
      if(st.mode==='candy'){c.save();c.beginPath();c.roundRect(x+1,y+1,S-2,S-2,r);c.clip();c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=S*.16;for(let t=-1;t<3;t++){c.beginPath();c.moveTo(x+t*S*.55,y+S);c.lineTo(x+t*S*.55+S,y);c.stroke()}c.restore()}
      if(st.mode==='stone'){c.fillStyle='rgba(40,40,60,.22)';for(let n=0;n<3;n++){c.beginPath();c.arc(x+S*(.25+R(i*7+k,j,n)*.5),y+S*(.3+R(i,j*5+k,n+3)*.45),S*.045+R(i,j,n)*S*.03,0,7);c.fill()}}
      if(st.mode==='gold'){c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(x+S*.3,y+S*.34,S*.07,0,7);c.fill()}
      c.strokeStyle='rgba(40,30,70,.13)';c.lineWidth=1;
      if(has(i+1,j)){c.beginPath();c.moveTo(x+S,y+5);c.lineTo(x+S,y+S-5);c.stroke()}
      if(has(i,j+1)){c.beginPath();c.moveTo(x+5,y);c.lineTo(x+S-5,y);c.stroke()}
    });
  });
}

/* ---------- vilão: slime de tempestade (versão simplificada aprovada 10/11) ----------
   drawVillain(c,x,y,s,t,opt)  opt.rain=false tira os pingos, opt.face=true desenha só o rosto (ícone da barra) */
function drawVillain(c,x,y,s,t,opt){opt=opt||{};t=t||0;
  c.save();c.translate(x,y);c.scale(s,s);c.lineJoin='round';c.lineCap='round';
  const b=Math.sin(t*2.2)*2.2;
  if(!opt.face){
    glow(c,0,0+b,78,'150,110,255',.28);
    // pingos de chuva (2-3, caindo devagar)
    if(opt.rain!==false)[[-16,0],[4,.4],[22,.75]].forEach(([dx,ph])=>{const k=((t*.9+ph)%1),py=46+k*30;
      c.globalAlpha=1-k*.7;c.fillStyle='#8fd0ff';c.beginPath();c.moveTo(dx,py-7);c.quadraticCurveTo(dx+5,py,dx,py+4);c.quadraticCurveTo(dx-5,py,dx,py-7);c.fill();c.globalAlpha=1});
  }
  // raios-chifre
  if(!opt.face)[-1,1].forEach(d=>{c.save();c.translate(d*31,-28+b);c.scale(d*1.25,1.25);c.rotate(.3);
    c.fillStyle='#ffd84a';c.strokeStyle='#e0a21a';c.lineWidth=1.6;
    c.beginPath();c.moveTo(-3,4);c.lineTo(6,-12);c.lineTo(1,-12);c.lineTo(8,-30);c.lineTo(-6,-8);c.lineTo(0,-8);c.lineTo(-8,6);c.closePath();c.fill();c.stroke();c.restore()});
  // pezinhos
  if(!opt.face){c.fillStyle='#3a2690';[-16,16].forEach(px=>{c.beginPath();c.ellipse(px,33+b*.5,8,5,0,0,7);c.fill()})}
  // corpo de geleia
  const body=()=>{c.beginPath();c.moveTo(-40,26+b*.6);c.bezierCurveTo(-54,14+b,-52,-28+b,-26,-36+b);c.bezierCurveTo(-10,-41+b,10,-41+b,26,-36+b);
    c.bezierCurveTo(52,-28+b,54,14+b,40,26+b*.6);c.bezierCurveTo(28,36+b*.6,-28,36+b*.6,-40,26+b*.6);c.closePath()};
  const g=c.createLinearGradient(0,-40,0,36);g.addColorStop(0,'#8f74f2');g.addColorStop(.45,'#6447d0');g.addColorStop(1,'#3a2690');
  c.fillStyle=g;body();c.fill();c.strokeStyle='#2a1a6e';c.lineWidth=2;c.stroke();
  // brilho interno
  c.save();body();c.clip();const rg=c.createRadialGradient(-14,-18+b,2,-14,-18+b,44);rg.addColorStop(0,'rgba(190,170,255,.45)');rg.addColorStop(1,'rgba(190,170,255,0)');c.fillStyle=rg;c.fillRect(-60,-50,120,90);c.restore();
  c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.ellipse(-26,-24+b,9,4,-.7,0,7);c.fill();c.beginPath();c.arc(-14,-32+b,2,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.ellipse(38,0+b,2.4,6,.3,0,7);c.fill();
  // tufinho de nuvem (3 bolinhas)
  if(!opt.face){c.fillStyle='#463a86';[[-11,-38,9],[2,-44,11],[14,-38,9]].forEach(([px,py,r])=>{c.beginPath();c.arc(px,py+b,r,0,7);c.fill()});
    c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.ellipse(-2,-50+b,5,2.2,-.3,0,7);c.fill()}
  // bochechas
  c.fillStyle='rgba(255,120,190,.45)';[-33,33].forEach(px=>{c.beginPath();c.ellipse(px,8+b,6,3.4,0,0,7);c.fill()});
  // olhos com pupila elétrica
  [-1,1].forEach(d=>{c.save();c.translate(d*17,-6+b);
    c.fillStyle='#fff';c.beginPath();c.arc(0,0,12,0,7);c.fill();
    const pg=c.createRadialGradient(0,0,1,0,0,8.5);pg.addColorStop(0,'#7fd8ff');pg.addColorStop(1,'#1f6bff');c.fillStyle=pg;c.beginPath();c.arc(d*-1.5,1.5,8.5,0,7);c.fill();
    poly(c,[[d*-1.5+1.5,-4],[d*-1.5-2.8,2.4],[d*-1.5,2.4],[d*-1.5-1.5,7],[d*-1.5+2.8,.2],[d*-1.5,.2]],'#fff');
    // pálpebra brava cortando o olho
    c.save();c.beginPath();c.arc(0,0,12.6,0,7);c.clip();c.fillStyle='#6a4bd4';c.beginPath();c.moveTo(-15,-15);c.lineTo(15,-15);c.lineTo(15,d>0?-9:-2);c.lineTo(-15,d>0?-2:-9);c.closePath();c.fill();c.restore();
    c.restore()});
  // sobrancelhas
  c.strokeStyle='#1c1050';c.lineWidth=4.5;[-1,1].forEach(d=>{c.beginPath();c.moveTo(d*30,-20+b);c.lineTo(d*7,-12+b);c.stroke()});
  // sorriso com dentinhos
  c.fillStyle='#24124f';c.beginPath();c.moveTo(-15,10+b);c.quadraticCurveTo(0,15+b,15,10+b);c.quadraticCurveTo(10,24+b,0,24+b);c.quadraticCurveTo(-10,24+b,-15,10+b);c.closePath();c.fill();
  c.fillStyle='#fff';c.beginPath();c.moveTo(-14,10.5+b);for(let i=0;i<6;i++){const x0=-14+i*28/6;c.lineTo(x0+28/12,16+b-Math.abs(i-2.5)*.4);c.lineTo(x0+28/6,11.5+b+(i<3?0:-.3))}c.quadraticCurveTo(0,15+b,-14,10.5+b);c.closePath();c.fill();
  c.restore();
}
/* ícone do rosto do vilão (barra de tempestade) */
function villainFace(c,x,y,r){drawVillain(c,x,y+r*.15,r/40,0,{face:true})}

/* ---------- herói: slime de geleia com skins de cor ---------- */
const SKINS={
 perola:{name:'Pérola',top:'#ffffff',mid:'#f7f1ff',bot:'#e4dcfa',line:'rgba(150,130,210,.55)',feet:'#ece4ff',glow:'230,220,255',iri:true},
 menta:{name:'Menta',top:'#c9fbe8',mid:'#7fe3c0',bot:'#45b896',line:'rgba(30,120,95,.55)',feet:'#5ccaa6',glow:'120,240,200'},
 coral:{name:'Coral',top:'#ffd3cf',mid:'#ff8f8a',bot:'#e0605f',line:'rgba(170,60,70,.5)',feet:'#f07774',glow:'255,150,150'},
 lavanda:{name:'Lavanda',top:'#e7dcff',mid:'#b79cf0',bot:'#8a6bd6',line:'rgba(90,60,170,.5)',feet:'#a184e4',glow:'190,160,255'},
 ceu:{name:'Céu',top:'#d6efff',mid:'#7cc4f5',bot:'#4c98d6',line:'rgba(40,100,170,.5)',feet:'#63aee6',glow:'130,200,255'},
 sol:{name:'Sol',top:'#fff4c4',mid:'#ffd35c',bot:'#eba92c',line:'rgba(170,110,20,.5)',feet:'#f5bf44',glow:'255,215,110'}
};
/* IDs antigos e provisórios -> skins novas (para migrar saves) */
const OLD_SKIN={fantasma:'perola',flor:'coral',nuvem:'ceu',estrela:'sol',abobora:'lavanda',
 turquesa:'menta',magenta:'coral',ambar:'sol',noturno:'lavanda',aurora:'ceu',pessego:'coral'};
function skinOf(id){id=OLD_SKIN[id]||id;return SKINS[id]||SKINS.perola}

/* ---------- acessórios de cabeça (encaixados entre as orelhinhas) ---------- */
const ACC_LIST=[['antenas','Antenas'],['galhada','Galhada'],['concha','Concha'],['laco','Laço'],['cartola','Cartola'],['coroa','Coroa']];
function drawAcc(c,id,b){b=b||0;if(id==='tophat')id='cartola';c.save();c.translate(0,-17);c.lineCap='round';c.lineJoin='round';
  if(id==='antenas'){c.strokeStyle='#f08a3c';c.lineWidth=3.8;[-1,1].forEach(d=>{c.beginPath();c.moveTo(d*7,-58+b);c.quadraticCurveTo(d*7,-74+b,d*15,-84+b);c.stroke();
    const bg=c.createRadialGradient(d*15-2,-87+b,1,d*15,-85+b,6.5);bg.addColorStop(0,'#ffe08a');bg.addColorStop(1,'#f08a3c');c.fillStyle=bg;c.beginPath();c.arc(d*15,-85+b,6.2,0,7);c.fill();
    c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.arc(d*15-2.2,-87.5+b,1.6,0,7);c.fill()})}
  if(id==='galhada'){[-1,1].forEach(d=>{c.save();c.translate(d*27,-64+b);c.scale(d,1);
    c.strokeStyle='#ff6f9a';c.lineWidth=5.5;c.beginPath();c.moveTo(0,4);c.quadraticCurveTo(3,-10,8,-24);c.moveTo(3,-8);c.quadraticCurveTo(-4,-14,-6,-20);c.moveTo(6,-17);c.quadraticCurveTo(12,-20,15,-26);c.stroke();
    c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1.6;c.beginPath();c.moveTo(1,0);c.quadraticCurveTo(3,-10,7,-21);c.stroke();c.restore()})}
  if(id==='concha'){c.save();c.translate(8,-63+b);c.rotate(.25);c.scale(1.25,1.25);
    c.fillStyle='#e2c08f';c.beginPath();c.moveTo(-12,4);c.bezierCurveTo(-14,-8,-4,-16,6,-12);c.bezierCurveTo(14,-8,14,2,9,6);c.closePath();c.fill();
    c.strokeStyle='#a87b45';c.lineWidth=1.6;c.beginPath();c.arc(1,-4,6.5,3.6,9.2);c.stroke();c.beginPath();c.arc(1.5,-3.5,3,3.6,9.4);c.stroke();
    c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(-4,-10,3.4,1.5,-.5,0,7);c.fill();c.restore()}
  if(id==='laco'){c.save();c.translate(-26,-58+b);c.rotate(-.35);c.scale(1.3,1.3);c.fillStyle='#ff6fa3';
    [-1,1].forEach(d=>{c.beginPath();c.moveTo(0,0);c.bezierCurveTo(d*6,-10,d*15,-10,d*15,-1);c.bezierCurveTo(d*15,8,d*6,8,0,0);c.fill()});
    c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse(-9,-4,3,1.4,-.4,0,7);c.fill();c.beginPath();c.ellipse(9,-4,3,1.4,.4,0,7);c.fill();
    c.fillStyle='#e2527a';c.beginPath();c.arc(0,0,4,0,7);c.fill();c.restore()}
  if(id==='cartola'){c.save();c.translate(0,-60+b);c.rotate(-.05);
    c.fillStyle='rgba(60,40,110,.25)';c.beginPath();c.ellipse(0,3,19,4,0,0,7);c.fill();
    c.fillStyle='#2b2542';c.beginPath();c.ellipse(0,0,19,5,0,0,7);c.fill();c.beginPath();c.roundRect(-11.5,-24,23,24,4);c.fill();
    c.fillStyle='#e2527a';c.fillRect(-11.5,-8,23,5.5);c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.roundRect(-8,-21,3.5,12,2);c.fill();c.restore()}
  if(id==='coroa'){c.save();c.translate(1,-61+b);c.rotate(.06);
    const cg=c.createLinearGradient(0,-20,0,2);cg.addColorStop(0,'#ffe98a');cg.addColorStop(1,'#e7a623');c.fillStyle=cg;
    c.beginPath();c.moveTo(-14,2);c.lineTo(-16,-14);c.lineTo(-7,-6);c.lineTo(0,-20);c.lineTo(7,-6);c.lineTo(16,-14);c.lineTo(14,2);c.quadraticCurveTo(0,5,-14,2);c.closePath();c.fill();
    c.strokeStyle='#c58a12';c.lineWidth=1.2;c.stroke();
    [[-16,-14],[0,-20],[16,-14]].forEach(([px,py])=>{c.fillStyle='#ffe98a';c.beginPath();c.arc(px,py,2.2,0,7);c.fill()});
    c.fillStyle='#ff4f8a';c.beginPath();c.moveTo(0,-9);c.lineTo(4,-4);c.lineTo(0,1);c.lineTo(-4,-4);c.closePath();c.fill();
    c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.arc(-1.3,-5.5,1,0,7);c.fill();c.restore()}
  c.restore()}
/* ícone de acessório sozinho (cartão da loja) */
function accIcon(c,w,h,id){c.save();c.translate(w/2,h*.5);const k=id==='antenas'||id==='galhada'?1.05:1.6;c.scale(k,k);
  const cy=({antenas:72,galhada:80,concha:64,laco:58,cartola:70,coroa:68}[id]||64)+17;c.translate(id==='laco'?25:id==='concha'?-8:0,cy-(id==='galhada'?4:0));drawAcc(c,id,0);c.restore()}

/* slime(c,x,y,s,skin,_,mood,t,opt)
   skin: id de SKINS (ou '#fff' = pérola)   mood: 'idle' | 'feliz' | 'preocupado'   opt.acc: id do acessório */
function slime(c,x,y,s,main,dark,mood,t,opt){opt=opt||{};t=t||0;
  const K=skinOf(opt.skin||(SKINS[main]?main:OLD_SKIN[main]||'perola'));
  c.save();c.translate(x,y);c.scale(s*.9,s*.9);c.lineCap='round';c.lineJoin='round';
  const b=Math.sin(t*2)*1.2,sq=1+Math.sin(t*2)*.012;
  glow(c,0,-24,72,K.glow,.22);
  c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(0,3,46,6,0,0,7);c.fill();
  // pezinhos
  c.fillStyle=K.feet;[-24,24].forEach(px=>{c.beginPath();c.ellipse(px,1,8,5,0,0,7);c.fill()});
  c.save();c.scale(1,sq);
  // orelhinhas
  [-1,1].forEach(d=>{c.save();c.translate(d*28,-73+b);c.rotate(d*.3);const eg=c.createLinearGradient(0,-12,0,10);eg.addColorStop(0,K.top);eg.addColorStop(1,K.mid);
    c.fillStyle=eg;c.beginPath();c.ellipse(0,0,9,12.5,0,0,7);c.fill();c.strokeStyle=K.line;c.lineWidth=1.4;c.stroke();
    c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.ellipse(-2,-5,2,4,0,0,7);c.fill();c.restore()});
  const body=()=>{c.beginPath();c.moveTo(-40,0);c.bezierCurveTo(-50,0,-52,-18,-48,-34);c.bezierCurveTo(-44,-66+b,-25,-80+b,0,-80+b);
    c.bezierCurveTo(25,-80+b,44,-66+b,48,-34);c.bezierCurveTo(52,-18,50,0,40,0);c.quadraticCurveTo(0,3,-40,0);c.closePath()};
  const g=c.createLinearGradient(0,-80,0,2);g.addColorStop(0,K.top);g.addColorStop(.55,K.mid);g.addColorStop(1,K.bot);
  c.fillStyle=g;body();c.fill();
  c.save();body();c.clip();
  if(K.iri)[[-26,-18,32,'255,170,215',.42],[26,-20,32,'150,205,255',.44],[0,-54,26,'255,240,170',.38],[-4,-4,24,'190,160,255',.28]].forEach(([px,py,r,col,al])=>{
    const rg=c.createRadialGradient(px,py,1,px,py,r);rg.addColorStop(0,`rgba(${col},${al})`);rg.addColorStop(1,`rgba(${col},0)`);c.fillStyle=rg;c.fillRect(-60,-80,120,90)});
  const ig=c.createRadialGradient(-12,-48,2,-12,-48,48);ig.addColorStop(0,'rgba(255,255,255,.45)');ig.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=ig;c.fillRect(-60,-80,120,90);
  c.restore();
  body();c.strokeStyle=K.line;c.lineWidth=1.5;c.stroke();
  // bolhinhas
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1;[[-35,-12,2.4],[-29,-5,1.5],[35,-10,2.1],[28,-4,1.3],[2,-6,1.6]].forEach(([px,py,r])=>{c.beginPath();c.arc(px,py,r,0,7);c.stroke()});
  // brilhos
  c.fillStyle='rgba(255,255,255,.95)';c.beginPath();c.ellipse(-27,-62+b,10.5,4.4,-.6,0,7);c.fill();c.beginPath();c.arc(-13,-71+b,2.1,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.ellipse(40,-36,2.6,6.5,.45,0,7);c.fill();
  // olhos
  const ey=-39+b;[-19.5,19.5].forEach(ex=>{c.save();c.translate(ex,ey);
    c.fillStyle='#fff';c.beginPath();c.arc(0,0,14.5,0,7);c.fill();c.strokeStyle='rgba(120,100,190,.25)';c.lineWidth=1.2;c.stroke();
    c.fillStyle='#3d1a72';c.beginPath();c.arc(0,.5,10.2,0,7);c.fill();
    c.fillStyle='#fff';c.beginPath();for(let k=0;k<10;k++){const r=k%2?2.2:5.2,a=-Math.PI/2+k*Math.PI/5;c.lineTo(Math.cos(a)*r,.5+Math.sin(a)*r)}c.closePath();c.fill();
    c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(-5.5,-5.5,1.9,0,7);c.fill();c.restore()});
  // sobrancelhas (só preocupado)
  if(mood==='preocupado'){c.strokeStyle='#5a3a9a';c.lineWidth=2.4;[-1,1].forEach(d=>{c.beginPath();c.moveTo(d*29,-58+b);c.lineTo(d*11,-61+b);c.stroke()})}
  // bochechas
  c.fillStyle='rgba(255,130,170,.55)';[-34,34].forEach(px=>{c.beginPath();c.ellipse(px,-21+b,7,3.8,0,0,7);c.fill()});
  // boca
  c.strokeStyle='#5a3a9a';c.lineWidth=2.3;c.beginPath();
  if(mood==='preocupado'){c.moveTo(-6,-14+b);c.quadraticCurveTo(0,-19+b,6,-14+b);c.stroke()}
  else if(mood==='feliz'){c.fillStyle='#5a2a7a';c.moveTo(-8,-20+b);c.quadraticCurveTo(0,-18+b,8,-20+b);c.quadraticCurveTo(7,-10+b,0,-10+b);c.quadraticCurveTo(-7,-10+b,-8,-20+b);c.closePath();c.fill();
    c.fillStyle='#ff8fb0';c.beginPath();c.ellipse(0,-12.5+b,4,2,0,0,7);c.fill()}
  else{c.moveTo(-6,-19+b);c.quadraticCurveTo(0,-14+b,6,-19+b);c.stroke()}
  c.restore();
  // acessório (compatível com opt.shell antigo)
  const acc=opt.acc||(opt.shell===true?'concha':null);
  if(acc)drawAcc(c,acc,b);
  c.restore();
}



/* ---------- avatar + menu ---------- */
let AV_SKIN='perola',AV_ACC=null; // skin/acessório do jogador (vem do save)
function drawAvatar(){
  const cv=document.getElementById('av'),c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,112,112);
  c.save();c.scale(1.4,1.4);slime(c,40,62,.62,AV_SKIN,'','idle',0,{acc:AV_ACC});c.restore();
}
const ICON={
 home:'<path d="M20 34 L32 22 L44 34 M23 32v12h18V32" />',
 shop:'<path d="M22 28h20l-2 16H24z M27 28a5 5 0 0 1 10 0" />',
 duel:'<path d="M23 24l18 18M41 24L23 42M21 28l4-4M43 28l-4-4" />',
 user:'<circle cx="32" cy="27" r="5.5"/><path d="M22 44c1-8 6-10 10-10s9 2 10 10" />',
 gear:'<circle cx="32" cy="32" r="11" stroke-width="5" stroke-dasharray="4.3 4.3"/><circle cx="32" cy="32" r="8.5"/><circle cx="32" cy="32" r="3.5"/>'
};
function buildNav(on){
  const ITEMS=[['home','Início'],['shop','Loja'],['duel','Duelo'],['user','Perfil'],['gear','Ajustes']];
  document.getElementById('nav').innerHTML=ITEMS.map(([k,l],i)=>{const a=i===on;return`
 <button class="nb ${a?'on':''}"><svg viewBox="0 0 64 64">
  <defs><linearGradient id="st${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a?'#fff3c4':'#ecf8e6'}"/><stop offset="1" stop-color="${a?'#e3b94a':'#9dbb98'}"/></linearGradient></defs>
  <rect x="6" y="6" width="52" height="52" rx="18" fill="url(#st${i})" stroke="${a?'#b98a14':'#6f9a74'}" stroke-width="2.5"/>
  <rect x="10.5" y="10.5" width="43" height="43" rx="14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>
  <g fill="none" stroke="#46684f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</g></svg>${k==='duel'?'<i class="dot">2</i>':''}${l}</button>`}).join('');
}
