const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const statusEl = document.getElementById("status");
const helpEl = document.getElementById("startHelp");
const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const timeEl = document.getElementById("time");
const pointsEl = document.getElementById("points");
const clearBtn = document.getElementById("clearBtn");
const raceBtn = document.getElementById("raceBtn");
const turboBtn = document.getElementById("turboBtn");

let W = 1280, H = 720, dpr = 1;
let drawing = false, racing = false, finished = false;
let path = [];
let racePoints = [];
let raceProgress = 0;
let raceStart = 0;
let lastFrame = 0;
let car = {x:0,y:0,angle:0};
let turboUntil = 0;

const TRACK_WIDTH = 0.16;
const ROAD_WIDTH = 0.125;

function P(x,y){ return {x,y}; }

function resize(){
  const r = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  canvas.width = Math.round(W*dpr);
  canvas.height = Math.round(H*dpr);
  canvas.style.width = W+"px";
  canvas.style.height = H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener("resize", resize);

function trackControlPoints(){
  return [
    P(.10,.78), P(.08,.60), P(.16,.43), P(.33,.35),
    P(.50,.37), P(.64,.29), P(.83,.32), P(.91,.47),
    P(.87,.65), P(.72,.74), P(.56,.68), P(.48,.55),
    P(.38,.51), P(.28,.57), P(.28,.72), P(.39,.82),
    P(.57,.85), P(.72,.78), P(.84,.66)
  ];
}

function catmullRom(points, samplesPerSeg=18){
  const result=[];
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)], p1=points[i];
    const p2=points[i+1], p3=points[Math.min(points.length-1,i+2)];
    for(let j=0;j<samplesPerSeg;j++){
      const t=j/samplesPerSeg, t2=t*t, t3=t2*t;
      const x=.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
      const y=.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
      result.push(P(x*W,y*H));
    }
  }
  result.push(P(points.at(-1).x*W,points.at(-1).y*H));
  return result;
}

let centerPts=[];
function rebuildTrack(){ centerPts=catmullRom(trackControlPoints(),18); }
function distPointSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const len2=dx*dx+dy*dy;
  const t=len2 ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)) : 0;
  const q=P(a.x+dx*t,a.y+dy*t);
  return {d:Math.hypot(p.x-q.x,p.y-q.y),t,q};
}
function distanceToTrack(p){
  let best={d:Infinity,index:0};
  for(let i=1;i<centerPts.length;i++){
    const q=distPointSegment(p,centerPts[i-1],centerPts[i]);
    if(q.d<best.d) best={d:q.d,index:i-1};
  }
  return best;
}

function drawPolyline(points,color,width,dash=[]){
  if(points.length<2)return;
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.lineCap="round";
  ctx.lineJoin="round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.stroke();
  ctx.restore();
}

function drawTerrain(){
  ctx.fillStyle="#55714a"; ctx.fillRect(0,0,W,H);

  // layered terrain patches
  for(let i=0;i<85;i++){
    const x=(i*173+41)%W, y=(i*97+23)%H;
    const rx=18+(i%5)*11, ry=13+(i%4)*9;
    ctx.fillStyle=i%2?"#617d55":"#4c6845";
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,((i*17)%180)*Math.PI/180,0,Math.PI*2);ctx.fill();
  }

  // distant mountain silhouettes
  ctx.fillStyle="#3d5940";
  ctx.beginPath();
  ctx.moveTo(0,H*.20);ctx.lineTo(W*.12,H*.07);ctx.lineTo(W*.23,H*.19);
  ctx.lineTo(W*.37,H*.04);ctx.lineTo(W*.50,H*.18);ctx.lineTo(W*.63,H*.06);
  ctx.lineTo(W*.79,H*.18);ctx.lineTo(W*.91,H*.08);ctx.lineTo(W,H*.21);
  ctx.lineTo(W,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();

  // trees kept outside the track
  for(let i=0;i<34;i++){
    const x=(i*229+70)%W, y=(i*137+55)%H;
    if(distanceToTrack(P(x,y)).d > W*.105){
      drawTree(x,y, .8+(i%3)*.13);
    }
  }
}

function drawTree(x,y,s){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle="#334631";ctx.fillRect(-3,9,6,13);
  ctx.fillStyle="#233b28";
  for(let i=0;i<3;i++){
    ctx.beginPath();ctx.moveTo(0,-22+i*9);ctx.lineTo(-13+i*2,8+i*4);ctx.lineTo(13-i*2,8+i*4);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

function drawTrack(){
  // outer dark bank
  drawPolyline(centerPts,"#1c2225",W*TRACK_WIDTH);
  // light shoulder
  drawPolyline(centerPts,"#d4d1bf",W*(TRACK_WIDTH-.014));
  // road
  drawPolyline(centerPts,"#444a4c",W*ROAD_WIDTH);
  // subtle road center highlight
  drawPolyline(centerPts,"#606466",W*.006);

  // red/white curb blocks following track edges
  for(let i=3;i<centerPts.length-3;i+=4){
    const a=centerPts[i-1], b=centerPts[i+1];
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    ctx.save();
    ctx.translate(centerPts[i].x,centerPts[i].y);
    ctx.rotate(angle);
    ctx.fillStyle=(Math.floor(i/4)%2)?"#f4f4ef":"#e10600";
    ctx.fillRect(-8,-W*.071,16,W*.018);
    ctx.restore();
  }

  // start and finish gates
  drawStartFinish();
}

function drawStartFinish(){
  const s=centerPts[0], s2=centerPts[4];
  const f=centerPts.at(-1), f2=centerPts.at(-5);

  drawGate(s,s2,"START","#22c55e");
  drawGate(f,f2,"CÉL","#ffffff");
}

function drawGate(p,dir,label,color){
  const angle=Math.atan2(dir.y-p.y,dir.x-p.x);
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(angle+Math.PI/2);

  ctx.fillStyle=color;
  ctx.globalAlpha=.18;
  ctx.fillRect(-W*.06,-W*.064,W*.12,W*.128);
  ctx.globalAlpha=1;

  ctx.strokeStyle=color;
  ctx.lineWidth=4;
  ctx.strokeRect(-W*.06,-W*.064,W*.12,W*.128);

  if(label==="CÉL"){
    const sq=9;
    for(let r=-6;r<7;r++) for(let c=-7;c<8;c++){
      ctx.fillStyle=((r+c)&1)?"#111":"#fff";
      ctx.fillRect(c*sq,r*sq,sq,sq);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle=label==="CÉL"?"#fff":"#22c55e";
  ctx.font=`900 ${Math.max(10,W*.012)}px system-ui`;
  ctx.textAlign="center";
  ctx.fillText(label,p.x,p.y-W*.08);
  ctx.restore();
}

function drawPlayerPath(){
  if(path.length<2)return;
  drawPolyline(path,"#e9b923",Math.max(7,W*.009));
  drawPolyline(path,"#fff06a",Math.max(2,W*.003));
}

function drawCar(){
  if(!racing && !finished)return;
  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.angle);
  const s=Math.max(0.65,Math.min(1.25,W/1000));
  ctx.scale(s,s);

  // shadow
  ctx.fillStyle="#0008";
  ctx.beginPath();ctx.ellipse(2,7,23,9,0,0,Math.PI*2);ctx.fill();

  // body
  ctx.fillStyle="#e10600";
  ctx.beginPath();
  ctx.roundRect(-20,-9,40,18,6);ctx.fill();

  // cabin
  ctx.fillStyle="#20262a";
  ctx.beginPath();ctx.roundRect(-7,-7,16,14,4);ctx.fill();

  // highlights/lights
  ctx.fillStyle="#fff";
  ctx.fillRect(12,-5,5,3);ctx.fillRect(12,2,5,3);

  // wheels
  ctx.fillStyle="#111";
  [[-11,-11],[8,-11],[-11,7],[8,7]].forEach(([x,y])=>ctx.fillRect(x,y,7,5));
  ctx.restore();
}

function pointerPos(e){
  const r=canvas.getBoundingClientRect();
  return P(e.clientX-r.left,e.clientY-r.top);
}

function reset(){
  drawing=false;racing=false;finished=false;
  path=[];racePoints=[];raceProgress=0;turboUntil=0;
  raceBtn.disabled=true;turboBtn.disabled=true;
  statusEl.textContent="Rajzold meg a versenyívet";
  helpEl.style.display="block";
  speedEl.textContent="0";distanceEl.textContent="0";timeEl.textContent="0.00";pointsEl.textContent="0";
  draw();
}

function startDraw(e){
  if(racing)return;
  const p=pointerPos(e);
  const start=centerPts[0];
  if(Math.hypot(p.x-start.x,p.y-start.y)>W*.10){
    statusEl.textContent="A zöld START mezőből indulj";
    return;
  }
  drawing=true;path=[p];
  canvas.setPointerCapture?.(e.pointerId);
  helpEl.style.display="none";
  statusEl.textContent="Rajzolás… vezesd a vonalat a célhoz";
  pointsEl.textContent="1";
  draw();
}

function moveDraw(e){
  if(!drawing||racing)return;
  const p=pointerPos(e);
  const prev=path.at(-1);
  if(Math.hypot(p.x-prev.x,p.y-prev.y)<2)return;
  path.push(p);
  pointsEl.textContent=path.length;
  draw();
}

function endDraw(){
  if(!drawing)return;
  drawing=false;

  if(path.length<12){
    statusEl.textContent="Túl rövid ív — rajzold újra";
    raceBtn.disabled=true;
    return;
  }

  const start=centerPts[0], finish=centerPts.at(-1);
  const startDist=Math.hypot(path[0].x-start.x,path[0].y-start.y);
  const endDist=Math.hypot(path.at(-1).x-finish.x,path.at(-1).y-finish.y);

  // Keep the prototype forgiving, but don't accept a random closed loop.
  if(endDist>W*.12){
    statusEl.textContent="Vezesd el a vonalat a kockás CÉLIG";
    raceBtn.disabled=true;
    draw();
    return;
  }

  raceBtn.disabled=false;
  statusEl.textContent="Kész — indíthatod a versenyt";
  draw();
}

canvas.addEventListener("pointerdown",startDraw);
canvas.addEventListener("pointermove",moveDraw);
canvas.addEventListener("pointerup",endDraw);
canvas.addEventListener("pointercancel",endDraw);

function buildRacePoints(){
  const out=[];
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=Math.hypot(b.x-a.x,b.y-a.y);
    const count=Math.max(1,Math.ceil(d/5));
    for(let k=0;k<count;k++){
      const u=k/count;
      out.push(P(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u));
    }
  }
  out.push(path.at(-1));
  return out;
}

function startRace(){
  if(racing||path.length<12)return;
  racePoints=buildRacePoints();
  raceProgress=0;
  racing=true;finished=false;
  raceStart=performance.now();lastFrame=raceStart;
  turboUntil=0;
  raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;
  statusEl.textContent="VERSENY!";
  car={x:racePoints[0].x,y:racePoints[0].y,angle:0};
  requestAnimationFrame(loop);
}

function loop(now){
  if(!racing)return;
  const dt=Math.min(40,now-lastFrame);lastFrame=now;
  const turbo=now<turboUntil?1.7:1;

  const i=Math.floor(raceProgress);
  if(i>=racePoints.length-1){finishRace();return;}

  const p=racePoints[i], n=racePoints[Math.min(i+1,racePoints.length-1)];
  car.x=p.x;car.y=p.y;car.angle=Math.atan2(n.y-p.y,n.x-p.x);

  // Pace varies with how quickly the player drew each section.
  const progressStep=Math.max(.8,(W*.0028))*turbo*(dt/16.67);
  raceProgress+=progressStep;

  const pct=Math.min(100,(raceProgress/(racePoints.length-1))*100);
  const kmh=Math.round(78+42*Math.sin(Math.min(1,pct/100)*Math.PI)+ (turbo-1)*70);

  speedEl.textContent=String(kmh);
  distanceEl.textContent=String(Math.round(pct));
  timeEl.textContent=((now-raceStart)/1000).toFixed(2);

  draw();

  if(pct>=100)finishRace();
  else requestAnimationFrame(loop);
}

function finishRace(){
  racing=false;finished=true;
  car={...racePoints.at(-1),angle:car.angle};
  speedEl.textContent="0";
  distanceEl.textContent="100";
  turboBtn.disabled=true;
  clearBtn.disabled=false;
  statusEl.textContent="CÉLBA ÉRTÉL 🏁";
  draw();
}

function activateTurbo(){
  if(racing)turboUntil=performance.now()+1100;
}

raceBtn.addEventListener("click",startRace);
clearBtn.addEventListener("click",reset);
turboBtn.addEventListener("pointerdown",activateTurbo);

rebuildTrack();
resize();
