const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('.stage-wrap');
const statusEl = document.getElementById('status');
const hint = document.getElementById('hint');
const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const timeEl = document.getElementById('time');
const pointsEl = document.getElementById('points');
const clearBtn = document.getElementById('clearBtn');
const raceBtn = document.getElementById('raceBtn');
const turboBtn = document.getElementById('turboBtn');

let W=1200,H=750,dpr=1;
let drawing=false, racing=false, finished=false;
let path=[], samples=[], sampleIndex=0, raceStart=0, lastFrame=0;
let car={x:0,y:0,angle:0};
let turboUntil=0;

function resize(){
  const r=stage.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=r.width; H=r.height;
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize',resize);

function P(x,y){return {x,y}}
function trackCenter(t){
  // Closed-ish alpine track centerline, parametrized from start around two hairpins.
  const pts=[
    P(.09,.78),P(.14,.62),P(.27,.55),P(.39,.57),P(.47,.67),
    P(.43,.82),P(.30,.86),P(.20,.77),P(.25,.63),P(.42,.42),
    P(.60,.31),P(.78,.34),P(.89,.48),P(.86,.64),P(.70,.67),
    P(.60,.58),P(.65,.46),P(.79,.43),P(.91,.30)
  ];
  const scaled=pts.map(q=>P(q.x*W,q.y*H));
  const i=Math.min(scaled.length-2,Math.floor(t*(scaled.length-1)));
  const u=t*(scaled.length-1)-i;
  const a=scaled[i],b=scaled[i+1];
  return P(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);
}
function centerlinePoints(){
  const a=[]; for(let i=0;i<=220;i++)a.push(trackCenter(i/220)); return a;
}
const centerPts=centerlinePoints();

function drawTrack(){
  ctx.fillStyle='#8fa08c';ctx.fillRect(0,0,W,H);
  // terrain patches
  for(let i=0;i<65;i++){
    const x=(i*173)%W,y=(i*97)%H,r=12+(i%5)*8;
    ctx.fillStyle=i%2?'#84957f':'#9aa68c';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  // curbs + road using centerline
  drawPolyline(centerPts,'#20262b',W*.14);
  drawPolyline(centerPts,'#f1f1eb',W*.125);
  drawPolyline(centerPts,'#5d6264',W*.112);
  // road texture
  ctx.save();
  ctx.globalAlpha=.18;
  drawPolyline(centerPts,'#151719',W*.006);
  ctx.restore();
  // red/white kerbs as short blocks along outside
  for(let i=3;i<centerPts.length-3;i+=5){
    const a=centerPts[i-1],b=centerPts[i+1];
    const ang=Math.atan2(b.y-a.y,b.x-a.x);
    ctx.save();ctx.translate(centerPts[i].x,centerPts[i].y);ctx.rotate(ang);
    ctx.fillStyle=(i/5|0)%2?'#d92727':'#f6f6f1';
    ctx.fillRect(-7,-W*.071/2,14,W*.071);
    ctx.restore();
  }
  // start line
  const s=centerPts[0],n=centerPts[3];
  const ang=Math.atan2(n.y-s.y,n.x-s.x);
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(ang+Math.PI/2);
  for(let i=-5;i<5;i++)for(let j=0;j<2;j++){
    ctx.fillStyle=(i+j)%2?'#222':'#fff';
    ctx.fillRect(i*10,j*8,10,8);
  }
  ctx.restore();
  // decorative trees
  for(let i=0;i<28;i++){
    const x=(i*211+80)%W,y=(i*131+35)%H;
    if(distanceToCenter(P(x,y))>W*.10){
      ctx.fillStyle='#334b32';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#4d6a45';ctx.beginPath();ctx.arc(x-2,y-6,8,0,Math.PI*2);ctx.fill();
    }
  }
}
function drawPolyline(points,color,width){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
}
function distanceToCenter(p){
  let best=Infinity;
  for(let i=1;i<centerPts.length;i++){
    const a=centerPts[i-1],b=centerPts[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    const q=P(a.x+dx*t,a.y+dy*t);
    best=Math.min(best,Math.hypot(p.x-q.x,p.y-q.y));
  }
  return best;
}
function pos(e){
  const r=canvas.getBoundingClientRect();
  return P(e.clientX-r.left,e.clientY-r.top);
}
function startDraw(e){
  if(racing)return;
  drawing=true; path=[pos(e)]; samples=[{p:path[0],speed:0}];
  canvas.setPointerCapture?.(e.pointerId);
  statusEl.textContent='Rajzolás…';
  hint.style.display='none';
  draw();
}
function moveDraw(e){
  if(!drawing||racing)return;
  const p=pos(e), prev=path[path.length-1], now=performance.now();
  const dt=Math.max(8,now-(samples[samples.length-1]?.t||now-16));
  const dist=Math.hypot(p.x-prev.x,p.y-prev.y);
  const pxPerMs=dist/dt;
  path.push(p);
  samples.push({p,speed:Math.max(.02,Math.min(1,pxPerMs/.9)),t:now});
  draw();
}
function endDraw(){
  if(!drawing)return;
  drawing=false;
  statusEl.textContent=path.length>8?'Kész — indíthatod a versenyt':'Túl rövid ív';
  raceBtn.disabled=path.length<9;
  pointsEl.textContent=path.length;
  draw();
}
canvas.addEventListener('pointerdown',startDraw);
canvas.addEventListener('pointermove',moveDraw);
canvas.addEventListener('pointerup',endDraw);
canvas.addEventListener('pointercancel',endDraw);

function buildRaceSamples(){
  if(path.length<9)return;
  // Resample the player's line. Speed is inherited from drawing velocity.
  const out=[];
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=Math.hypot(b.x-a.x,b.y-a.y);
    const speed=samples[i]?.speed||.3;
    const count=Math.max(1,Math.ceil(d/3));
    for(let k=0;k<count;k++){
      const u=k/count;
      out.push({
        x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,
        speed:70+speed*250
      });
    }
  }
  out.push({...path[path.length-1],speed:90});
  return out;
}
function startRace(){
  if(path.length<9||racing)return;
  samples=buildRaceSamples();
  sampleIndex=0;racing=true;finished=false;raceStart=performance.now();lastFrame=raceStart;
  turboUntil=0;turboBtn.disabled=false;raceBtn.disabled=true;clearBtn.disabled=true;
  statusEl.textContent='VERSENY!';
  car={...samples[0],angle:0};
  requestAnimationFrame(loop);
}
function loop(now){
  const dt=Math.min(50,now-lastFrame);lastFrame=now;
  const turbo=now<turboUntil?1.75:1;
  const current=samples[sampleIndex];
  if(!current){finishRace();return}
  const next=samples[Math.min(sampleIndex+1,samples.length-1)];
  car.angle=Math.atan2(next.y-current.y,next.x-current.x);
  car.x=current.x;car.y=current.y;
  // Drawing speed becomes progression speed.
  const advance=Math.max(1, current.speed/105 * turbo * dt/16);
  sampleIndex+=advance;
  const progress=Math.min(1,sampleIndex/(samples.length-1));
  speedEl.textContent=Math.round(current.speed*turbo);
  distanceEl.textContent=Math.round(progress*100);
  timeEl.textContent=((now-raceStart)/1000).toFixed(2);
  draw();
  if(progress>=1)finishRace();
  else requestAnimationFrame(loop);
}
function finishRace(){
  racing=false;finished=true;turboBtn.disabled=true;clearBtn.disabled=false;
  statusEl.textContent='CÉLBA ÉRTÉL 🏁';
  distanceEl.textContent='100'; draw();
}
function activateTurbo(){
  if(racing)turboUntil=performance.now()+1100;
}
function clearRace(){
  drawing=false;racing=false;finished=false;path=[];samples=[];sampleIndex=0;
  raceBtn.disabled=true;clearBtn.disabled=false;turboBtn.disabled=true;
  statusEl.textContent='Rajzold meg a versenyívet';
  speedEl.textContent='0';distanceEl.textContent='0';timeEl.textContent='0.00';pointsEl.textContent='0';
  hint.style.display='block';draw();
}
raceBtn.addEventListener('click',startRace);
turboBtn.addEventListener('pointerdown',activateTurbo);
clearBtn.addEventListener('click',clearRace);

function drawPlayerPath(){
  if(path.length<2)return;
  ctx.save();
  drawPolyline(path,'#ffe14a',Math.max(3,W*.006));
  ctx.shadowColor='#ffe14a';ctx.shadowBlur=14;
  drawPolyline(path,'#fff39a',Math.max(1,W*.002));
  ctx.restore();
}
function drawCar(){
  if(!racing&&!finished)return;
  ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle);
  ctx.shadowColor='#000';ctx.shadowBlur=10;
  ctx.fillStyle='#d92323';ctx.roundRect(-14,-8,28,16,5);ctx.fill();
  ctx.fillStyle='#161a1d';ctx.fillRect(-5,-6,11,12);
  ctx.fillStyle='#eee';ctx.fillRect(7,-5,4,10);
  ctx.fillStyle='#111';ctx.fillRect(-10,-11,6,4);ctx.fillRect(5,-11,6,4);ctx.fillRect(-10,7,6,4);ctx.fillRect(5,7,6,4);
  ctx.restore();
}
function draw(){
  drawTrack();
  drawPlayerPath();
  drawCar();
}
resize();
