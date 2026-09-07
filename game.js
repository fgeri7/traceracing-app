const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const stage=document.getElementById("stage");
const statusEl=document.getElementById("status");
const speedEl=document.getElementById("speed");
const distanceEl=document.getElementById("distance");
const timeEl=document.getElementById("time");
const pointsEl=document.getElementById("points");
const clearBtn=document.getElementById("clearBtn");
const raceBtn=document.getElementById("raceBtn");
const turboBtn=document.getElementById("turboBtn");

let W=1200,H=650,dpr=1;
let centerPts=[],path=[],racePoints=[];
let drawing=false,racing=false,finished=false;
let raceProgress=0,raceStart=0,lastFrame=0,turboUntil=0;
let car={x:0,y:0,angle:0};

function P(x,y){return{x,y}}

function controlPoints(){
  return [
    P(.10,.72),P(.08,.48),P(.19,.29),P(.39,.24),
    P(.58,.29),P(.78,.20),P(.91,.34),P(.92,.57),
    P(.82,.73),P(.65,.78),P(.52,.69),P(.47,.53),
    P(.36,.46),P(.27,.53),P(.28,.69),P(.40,.79),
    P(.57,.84),P(.75,.78),P(.88,.64)
  ];
}

function catmull(points,steps=12){
  const out=[];
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    for(let j=0;j<steps;j++){
      const t=j/steps,t2=t*t,t3=t2*t;
      const x=.5*(2*p1.x+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
      const y=.5*(2*p1.y+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
      out.push(P(x*W,y*H));
    }
  }
  const last=points[points.length-1];
  out.push(P(last.x*W,last.y*H));
  return out;
}

function rebuildTrack(){centerPts=catmull(controlPoints(),14)}

function resize(){
  const r=stage.getBoundingClientRect();
  W=Math.max(1,r.width);H=Math.max(1,r.height);
  dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
  canvas.style.width=W+"px";canvas.style.height=H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  rebuildTrack();draw();
}
window.addEventListener("resize",resize);
window.addEventListener("orientationchange",()=>setTimeout(resize,100));

function stroke(points,color,width,dash=[]){
  if(!points||points.length<2)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);
  ctx.beginPath();
  for(let i=0;i<points.length;i++) i?ctx.lineTo(points[i].x,points[i].y):ctx.moveTo(points[i].x,points[i].y);
  ctx.stroke();ctx.restore();
}

function distTrack(p){
  let best=Infinity;
  for(let i=1;i<centerPts.length;i++){
    const a=centerPts[i-1],b=centerPts[i],dx=b.x-a.x,dy=b.y-a.y;
    const len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
    const q=P(a.x+dx*t,a.y+dy*t);
    best=Math.min(best,Math.hypot(p.x-q.x,p.y-q.y));
  }
  return best;
}

function tree(x,y,s){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle="#263b28";ctx.fillRect(-3,9,6,14);
  for(let i=0;i<3;i++){
    ctx.fillStyle=i===0?"#203b27":"#315335";
    ctx.beginPath();ctx.moveTo(0,-25+i*10);ctx.lineTo(-14+i*2,8+i*4);ctx.lineTo(14-i*2,8+i*4);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

function drawTerrain(){
  ctx.fillStyle="#5f7a54";ctx.fillRect(0,0,W,H);
  for(let i=0;i<65;i++){
    const x=(i*191+43)%W,y=(i*113+17)%H;
    ctx.fillStyle=i%2?"#6d875f":"#526f4c";
    ctx.beginPath();ctx.ellipse(x,y,24+(i%4)*12,15+(i%3)*9,(i%6)*.5,0,Math.PI*2);ctx.fill();
  }
  // mountain band
  ctx.fillStyle="#405941";ctx.beginPath();ctx.moveTo(0,H*.25);
  ctx.lineTo(W*.13,H*.08);ctx.lineTo(W*.25,H*.24);ctx.lineTo(W*.40,H*.05);
  ctx.lineTo(W*.54,H*.22);ctx.lineTo(W*.69,H*.08);ctx.lineTo(W*.84,H*.23);
  ctx.lineTo(W,H*.10);ctx.lineTo(W,H*.35);ctx.lineTo(0,H*.35);ctx.closePath();ctx.fill();

  for(let i=0;i<34;i++){
    const x=(i*227+80)%W,y=(i*139+40)%H;
    if(distTrack(P(x,y))>W*.095)tree(x,y,.75+(i%4)*.1);
  }
}

function gate(point,next,label,finish=false){
  const ang=Math.atan2(next.y-point.y,next.x-point.x)+Math.PI/2;
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(ang);
  const half=Math.max(34,W*.055);
  ctx.fillStyle=finish?"#fff":"#22c55e";
  ctx.globalAlpha=.18;ctx.fillRect(-half,-6,half*2,12);ctx.globalAlpha=1;
  ctx.strokeStyle=finish?"#fff":"#22c55e";ctx.lineWidth=3;ctx.strokeRect(-half,-6,half*2,12);
  if(finish){
    const sq=7;
    for(let r=-2;r<3;r++)for(let c=-7;c<8;c++){
      ctx.fillStyle=(r+c)&1?"#111":"#fff";ctx.fillRect(c*sq,r*sq,sq,sq);
    }
  }
  ctx.restore();
  ctx.save();ctx.fillStyle=finish?"#fff":"#25d366";
  ctx.font=`900 ${Math.max(10,W*.011)}px system-ui`;ctx.textAlign="center";
  ctx.fillText(label,point.x,point.y-W*.065);ctx.restore();
}

function drawTrack(){
  stroke(centerPts,"#1c2325",W*.155);
  stroke(centerPts,"#c8c3ae",W*.140);
  stroke(centerPts,"#41484a",W*.118);
  stroke(centerPts,"#666b6c",W*.006);

  // visible alternating kerbs on both sides
  for(let i=3;i<centerPts.length-2;i+=5){
    const a=centerPts[i-1],b=centerPts[i+1],ang=Math.atan2(b.y-a.y,b.x-a.x);
    ctx.save();ctx.translate(centerPts[i].x,centerPts[i].y);ctx.rotate(ang);
    ctx.fillStyle=(Math.floor(i/5)%2)?"#fff":"#e10600";
    ctx.fillRect(-7,-W*.078,14,W*.018);
    ctx.fillStyle=(Math.floor(i/5)%2)?"#e10600":"#fff";
    ctx.fillRect(-7,W*.060,14,W*.018);
    ctx.restore();
  }

  // start/finish gates
  gate(centerPts[0],centerPts[4],"START",false);
  gate(centerPts[centerPts.length-1],centerPts[centerPts.length-5],"CÉL",true);
}

function drawPlayerPath(){
  if(path.length<2)return;
  stroke(path,"#e4b62e",Math.max(7,W*.008));
  stroke(path,"#fff06a",Math.max(2,W*.0025));
}

function drawCar(){
  if(!racing&&!finished)return;
  ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle);
  const s=Math.max(.7,Math.min(1.2,W/1000));ctx.scale(s,s);
  ctx.fillStyle="#0008";ctx.beginPath();ctx.ellipse(2,8,23,9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#e10600";ctx.beginPath();ctx.roundRect(-20,-9,40,18,5);ctx.fill();
  ctx.fillStyle="#20262a";ctx.beginPath();ctx.roundRect(-7,-7,15,14,4);ctx.fill();
  ctx.fillStyle="#fff";ctx.fillRect(12,-5,5,3);ctx.fillRect(12,2,5,3);
  ctx.fillStyle="#111";for(const q of [[-11,-11],[8,-11],[-11,7],[8,7]])ctx.fillRect(q[0],q[1],7,5);
  ctx.restore();
}

function draw(){
  if(!W||!H||centerPts.length<2)return;
  drawTerrain();drawTrack();drawPlayerPath();drawCar();
}

function pos(e){
  const r=canvas.getBoundingClientRect();
  return P(e.clientX-r.left,e.clientY-r.top);
}

function startDraw(e){
  if(racing)return;
  const p=pos(e),s=centerPts[0];
  if(Math.hypot(p.x-s.x,p.y-s.y)>W*.095){
    statusEl.textContent="A zöld START mezőből indulj";
    return;
  }
  drawing=true;path=[p];
  canvas.setPointerCapture?.(e.pointerId);
  statusEl.textContent="Rajzolás… vezesd a vonalat a kockás CÉLIG";
  pointsEl.textContent="1";draw();
}

function moveDraw(e){
  if(!drawing||racing)return;
  const p=pos(e),prev=path[path.length-1];
  if(Math.hypot(p.x-prev.x,p.y-prev.y)<2)return;
  path.push(p);pointsEl.textContent=path.length;draw();
}

function endDraw(){
  if(!drawing)return;
  drawing=false;
  const finish=centerPts[centerPts.length-1];
  const d=Math.hypot(path[path.length-1].x-finish.x,path[path.length-1].y-finish.y);
  if(path.length<12){statusEl.textContent="Túl rövid ív — rajzold újra";raceBtn.disabled=true;return}
  if(d>W*.12){statusEl.textContent="Vezesd el a vonalat a kockás CÉLIG";raceBtn.disabled=true;draw();return}
  raceBtn.disabled=false;statusEl.textContent="Kész — indíthatod a versenyt";draw();
}

canvas.addEventListener("pointerdown",startDraw);
canvas.addEventListener("pointermove",moveDraw);
canvas.addEventListener("pointerup",endDraw);
canvas.addEventListener("pointercancel",endDraw);
canvas.addEventListener("contextmenu",e=>e.preventDefault());

function buildRace(){
  const out=[];
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1],d=Math.hypot(b.x-a.x,b.y-a.y);
    const n=Math.max(1,Math.ceil(d/4));
    for(let j=0;j<n;j++){const u=j/n;out.push(P(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u))}
  }
  out.push(path[path.length-1]);return out;
}

function startRace(){
  if(racing||path.length<12)return;
  racePoints=buildRace();raceProgress=0;racing=true;finished=false;
  raceStart=performance.now();lastFrame=raceStart;turboUntil=0;
  raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;
  statusEl.textContent="VERSENY!";
  car={x:racePoints[0].x,y:racePoints[0].y,angle:0};
  requestAnimationFrame(loop);
}

function loop(now){
  if(!racing)return;
  const dt=Math.min(40,now-lastFrame);lastFrame=now;
  const turbo=now<turboUntil?1.75:1;
  const i=Math.min(Math.floor(raceProgress),racePoints.length-2);
  const p=racePoints[i],n=racePoints[i+1];
  car.x=p.x;car.y=p.y;car.angle=Math.atan2(n.y-p.y,n.x-p.x);
  raceProgress+=(1.35*turbo)*(dt/16.67);
  const pct=Math.min(100,raceProgress/(racePoints.length-1)*100);
  speedEl.textContent=String(Math.round(82+(turbo-1)*65));
  distanceEl.textContent=String(Math.round(pct));
  timeEl.textContent=((now-raceStart)/1000).toFixed(2);
  draw();
  if(pct>=100)finishRace();else requestAnimationFrame(loop);
}

function finishRace(){
  racing=false;finished=true;turboBtn.disabled=true;clearBtn.disabled=false;
  distanceEl.textContent="100";speedEl.textContent="0";
  car={...racePoints[racePoints.length-1],angle:car.angle};
  statusEl.textContent="CÉLBA ÉRTÉL 🏁";draw();
}

function activateTurbo(){if(racing)turboUntil=performance.now()+1100}

function reset(){
  drawing=false;racing=false;finished=false;path=[];racePoints=[];raceProgress=0;
  raceBtn.disabled=true;turboBtn.disabled=true;clearBtn.disabled=false;
  statusEl.textContent="A zöld START mezőből indulj";
  speedEl.textContent="0";distanceEl.textContent="0";timeEl.textContent="0.00";pointsEl.textContent="0";
  draw();
}

raceBtn.addEventListener("click",startRace);
clearBtn.addEventListener("click",reset);
turboBtn.addEventListener("pointerdown",activateTurbo);

resize();
