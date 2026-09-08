const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const tip = document.getElementById('drawTip');
const raceBtn = document.getElementById('raceBtn');
const turboBtn = document.getElementById('turboBtn');
const clearBtn = document.getElementById('clearBtn');
const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const timeEl = document.getElementById('time');
const pointsEl = document.getElementById('points');
const turboFill = document.getElementById('turboFill');
const turboLabel = document.getElementById('turboLabel');

let W=1,H=1,dpr=1;
let track=[];
let path=[];
let samples=[];
let raceRoute=[];
let drawing=false,racing=false,finished=false;
let lastDrawPoint=null,lastDrawTime=0;
let progress=0,startTime=0,lastFrame=0;
let turbo=100,turboHeld=false;
let car={x:0,y:0,a:0,speed:0};

// Simple, unmistakable oval circuit. START and CÉL are on opposite sides.
function buildTrack(){
  track=[];
  const cx=W*.5, cy=H*.5;
  const rx=Math.max(120,W*.405), ry=Math.max(70,H*.34);
  // Clockwise, start at left and finish at right.
  const count=520;
  for(let i=0;i<count;i++){
    const t=Math.PI + (Math.PI*2*i)/(count-1);
    track.push({x:cx+rx*Math.cos(t),y:cy+ry*Math.sin(t)});
  }
}

function resize(){
  const r=stage.getBoundingClientRect();
  W=Math.max(1,r.width); H=Math.max(1,r.height);
  dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  canvas.style.width='100%'; canvas.style.height='100%';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildTrack();
  draw();
}
new ResizeObserver(resize).observe(stage);

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

function stroke(points,color,width,dash){
  if(points.length<2)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  if(dash)ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.stroke();ctx.restore();
}

function tangent(i){
  const a=track[Math.max(0,i-4)],b=track[Math.min(track.length-1,i+4)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function terrain(){
  ctx.fillStyle='#597451';ctx.fillRect(0,0,W,H);
  // Subtle infield texture, never crossing the road.
  for(let i=0;i<38;i++){
    const x=(i*181+37)%W,y=(i*113+51)%H,r=10+(i%5)*6;
    ctx.fillStyle=i%2?'#66805d':'#4e6a4a';
    ctx.beginPath();ctx.ellipse(x,y,r,r*.62,(i%8)*.2,0,Math.PI*2);ctx.fill();
  }
}

function drawTrees(){
  for(let i=0;i<16;i++){
    const x=(i*239+43)%W,y=(i*157+29)%H,s=0.65+(i%3)*.1;
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ctx.fillStyle='#29462e';ctx.fillRect(-3,8,6,13);
    for(let j=0;j<3;j++){
      ctx.fillStyle=j?'#315438':'#203e2a';
      ctx.beginPath();ctx.moveTo(0,-25+j*10);ctx.lineTo(-15+j*2,9+j*4);ctx.lineTo(15-j*2,9+j*4);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}

function drawKerbs(){
  const half=W*.043;
  for(let i=0;i<track.length;i+=6){
    const p=track[i],a=tangent(i);
    for(const side of[-1,1]){
      const x=p.x-Math.sin(a)*half*side;
      const y=p.y+Math.cos(a)*half*side;
      ctx.save();ctx.translate(x,y);ctx.rotate(a);
      ctx.fillStyle=(Math.floor(i/6)%2===0)?'#e10600':'#f5f5f0';
      ctx.fillRect(-Math.max(5,W*.006),-3.5,Math.max(10,W*.012),7);
      ctx.restore();
    }
  }
}

function drawStartFinish(){
  const p=track[0],a=tangent(0),half=W*.043;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a+Math.PI/2);
  // One real start/finish line, split visually into green START and checker CÉL.
  const s=5;
  for(let r=-4;r<=4;r++)for(let c=-8;c<=8;c++){
    ctx.fillStyle=((r+c)&1)?'#111':'#fff';ctx.fillRect(c*s,r*s,s,s);
  }
  ctx.fillStyle='#20dc6b';ctx.fillRect(-half,-3,half*.62,6);
  ctx.restore();
  ctx.save();ctx.fillStyle='#20dc6b';ctx.font=`900 ${Math.max(10,W*.011)}px system-ui`;ctx.textAlign='right';ctx.fillText('START',p.x-W*.052,p.y-W*.055);
  ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText('CÉL',p.x+W*.052,p.y-W*.055);ctx.restore();
}

function drawArrows(){
  for(let i=35;i<track.length;i+=45){
    const p=track[i],a=tangent(i);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.globalAlpha=.34;ctx.fillStyle='#eef0ef';
    ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-7,-8);ctx.lineTo(-3,0);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.restore();
  }
}

function drawTrack(){
  stroke(track,'#172022',W*.108);
  stroke(track,'#d5cfbd',W*.096);
  stroke(track,'#3f4649',W*.076);
  stroke(track,'#70777a',Math.max(1.5,W*.0018),[W*.01,W*.01]);
  drawKerbs();drawArrows();
  // START and CÉL share the official start/finish line. One complete oval lap is required.
  drawStartFinish();
}

function drawUserPath(){
  if(path.length<2)return;
  stroke(path,'#a78010',Math.max(8,W*.009));
  stroke(path,'#ffe95b',Math.max(2.5,W*.0028));
}

function drawCar(){
  if(!racing&&!finished)return;
  ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);
  const s=clamp(W/1050,.72,1.18);ctx.scale(s,s);
  ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(0,9,24,9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e10600';ctx.beginPath();ctx.roundRect(-20,-10,40,20,6);ctx.fill();
  ctx.fillStyle='#20262a';ctx.beginPath();ctx.roundRect(-8,-8,16,16,4);ctx.fill();
  ctx.fillStyle='#fff';ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);
  ctx.fillStyle='#111';ctx.fillRect(-12,-12,7,5);ctx.fillRect(7,-12,7,5);ctx.fillRect(-12,7,7,5);ctx.fillRect(7,7,7,5);
  ctx.restore();
}

function draw(){terrain();drawTrees();drawTrack();drawUserPath();drawCar()}

function startDraw(e){
  if(racing)return;
  const p=pos(e),start=track[0];
  if(dist(p,start)>W*.065){statusEl.textContent='A zöld START/CÉL vonalnál kell kezdened';return}
  drawing=true;path=[p];samples=[];lastDrawPoint=p;lastDrawTime=performance.now();
  raceBtn.disabled=true;tip.style.display='none';pointsEl.textContent='1';
  statusEl.textContent='Rajzolás… vezesd végig az ovális pályán a kockás CÉL-ig';
  try{canvas.setPointerCapture(e.pointerId)}catch(_){ }
  e.preventDefault();draw();
}

function moveDraw(e){
  if(!drawing||racing)return;
  const p=pos(e),now=performance.now();
  const d=dist(p,lastDrawPoint);
  if(d<2)return;
  const dt=Math.max(1,now-lastDrawTime);
  // True finger speed in canvas pixels per second.
  const v=clamp(d/(dt/1000),20,1800);
  path.push(p);samples.push({v,t:now});
  lastDrawPoint=p;lastDrawTime=now;
  pointsEl.textContent=String(path.length);
  draw();e.preventDefault();
}

function endDraw(e){
  if(!drawing)return;drawing=false;
  try{canvas.releasePointerCapture(e.pointerId)}catch(_){ }
  const startOK=dist(path[0],track[0])<=W*.065;
  const finishOK=dist(path[path.length-1],track[0])<=W*.065;
  const travelled=path.slice(1).reduce((sum,p,i)=>sum+dist(p,path[i]),0);
  const expected=Math.PI*(W*.405+H*.34);
  if(path.length<40 || travelled<expected*.88){statusEl.textContent='Rajzold végig az egész ovális kört — a rövid átvágás nem érvényes';raceBtn.disabled=true;return}
  if(!startOK){statusEl.textContent='A rajzolt vonalnak a START kapuból kell indulnia';raceBtn.disabled=true;return}
  if(!finishOK){statusEl.textContent='Még nem értél körbe — vezesd vissza a vonalat a START/CÉL vonalhoz';raceBtn.disabled=true;return}
  raceBtn.disabled=false;statusEl.textContent='Kész — a teljes ovális kör megrajzolva';draw();
}

// The drawn route is followed EXACTLY. We resample it by distance so movement
// is stable even if the phone emits uneven pointer-event spacing.
function buildRaceRoute(){
  const out=[];
  if(path.length<2)return out;
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1],d=dist(a,b);
    const n=Math.max(1,Math.ceil(d/4));
    const v=samples[Math.min(i,samples.length-1)]?.v||220;
    for(let j=0;j<n;j++){
      const u=j/n;
      out.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,v});
    }
  }
  const last=path[path.length-1];out.push({x:last.x,y:last.y,v:samples.at(-1)?.v||220});
  return out;
}

function startRace(){
  if(racing||raceBtn.disabled)return;
  raceRoute=buildRaceRoute();if(raceRoute.length<2)return;
  progress=0;racing=true;finished=false;startTime=performance.now();lastFrame=startTime;
  turbo=100;turboHeld=false;raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;
  const a=raceRoute[0],b=raceRoute[1];
  car={x:a.x,y:a.y,a:Math.atan2(b.y-a.y,b.x-a.x),speed:a.v};
  statusEl.textContent='VERSENY!';updateTurboUI();requestAnimationFrame(loop);
}

function updateCar(dt){
  if(progress>=raceRoute.length-1)return;
  const idx=Math.min(Math.floor(progress),raceRoute.length-2);
  const a=raceRoute[idx],b=raceRoute[idx+1];
  let target=a.v;
  if(turboHeld&&turbo>0)target*=1.5;
  // Speed follows the finger speed directly; only a small physical response
  // smoothing prevents jitter caused by pointer-event quantisation.
  const response=turboHeld?.34:.55;
  car.speed+=(target-car.speed)*Math.min(1,response*dt/16.666);
  const segment=dist(a,b);
  progress+=(car.speed*dt/1000)/Math.max(.5,segment);
  const i=Math.min(Math.floor(progress),raceRoute.length-2),u=progress-i;
  const p=raceRoute[i],q=raceRoute[i+1];
  car.x=p.x+(q.x-p.x)*u;
  car.y=p.y+(q.y-p.y)*u;
  const ang=Math.atan2(q.y-p.y,q.x-p.x);
  let da=ang-car.a;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
  car.a+=da*Math.min(1,.42*dt/16.666);
}

function loop(now){
  if(!racing)return;
  const dt=Math.min(50,now-lastFrame);lastFrame=now;
  if(turboHeld&&turbo>0)turbo=Math.max(0,turbo-dt*.065);
  updateCar(dt);
  const pct=clamp(progress/(raceRoute.length-1)*100,0,100);
  speedEl.textContent=String(Math.round(car.speed*.055));
  distanceEl.textContent=String(Math.round(pct));
  timeEl.textContent=((now-startTime)/1000).toFixed(2);
  updateTurboUI();draw();
  if(progress>=raceRoute.length-1){finishRace();return}
  requestAnimationFrame(loop);
}

function finishRace(){
  progress=raceRoute.length-1;racing=false;finished=true;turboHeld=false;
  turboBtn.disabled=true;clearBtn.disabled=false;speedEl.textContent='0';distanceEl.textContent='100';
  statusEl.textContent='CÉLBA ÉRTÉL 🏁';draw();
}

function updateTurboUI(){
  turboFill.style.width=`${turbo}%`;turboLabel.textContent=`${Math.round(turbo)}%`;
  if(turbo<=0)turboBtn.disabled=true;
}

function reset(){
  drawing=false;racing=false;finished=false;turboHeld=false;path=[];samples=[];raceRoute=[];progress=0;turbo=100;
  raceBtn.disabled=true;turboBtn.disabled=true;clearBtn.disabled=false;
  statusEl.textContent='Indulj a zöld START/CÉL vonalról';speedEl.textContent='0';distanceEl.textContent='0';timeEl.textContent='0.00';pointsEl.textContent='0';tip.style.display='block';
  updateTurboUI();draw();
}

turboBtn.addEventListener('pointerdown',e=>{if(racing&&turbo>0){e.preventDefault();e.stopPropagation();turboHeld=true;try{turboBtn.setPointerCapture(e.pointerId)}catch(_){}}});
['pointerup','pointercancel','pointerleave'].forEach(t=>turboBtn.addEventListener(t,()=>turboHeld=false));

// Canvas uses pointer events so Android touch, mouse and stylus all work.
canvas.addEventListener('pointerdown',startDraw,{passive:false});
canvas.addEventListener('pointermove',moveDraw,{passive:false});
canvas.addEventListener('pointerup',endDraw,{passive:false});
canvas.addEventListener('pointercancel',endDraw,{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.startRace=startRace;window.reset=reset;
resize();
window.addEventListener('load',resize);
