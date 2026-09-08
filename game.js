const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const stage=document.getElementById("stage");
const statusEl=document.getElementById("status");
const tip=document.getElementById("drawTip");
const raceBtn=document.getElementById("raceBtn");
const turboBtn=document.getElementById("turboBtn");
const clearBtn=document.getElementById("clearBtn");
const speedEl=document.getElementById("speed");
const distanceEl=document.getElementById("distance");
const timeEl=document.getElementById("time");
const pointsEl=document.getElementById("points");
const turboFill=document.getElementById("turboFill");
const turboLabel=document.getElementById("turboLabel");

let W=1,H=1,dpr=1;
let track=[];
let path=[];
let samples=[];
let raceRoute=[];
let drawing=false,racing=false,finished=false;
let lastDrawPoint=null,lastDrawTime=0;
let progress=0,startTime=0,lastFrame=0;
let turbo=100,turboHeld=false;
let car={x:0,y:0,a:0,speed:0,slip:0,driftX:0,driftY:0};
let validationProgress=0;

const CHECKPOINT_COUNT=28;
const START_TOLERANCE=.085;

function buildTrack(){
  track=[];
  const cx=W*.5,cy=H*.5;
  const rx=W*.405;
  const ry=H*.335;
  const count=900;

  // One simple, continuous, clockwise oval.
  // START/CÉL is the same physical gate; completing a lap means crossing
  // the ordered checkpoint sequence before returning to it.
  for(let i=0;i<count;i++){
    const t=Math.PI+(Math.PI*2*i)/(count-1);
    track.push({
      x:cx+rx*Math.cos(t),
      y:cy+ry*Math.sin(t)
    });
  }
}

function resize(){
  const r=stage.getBoundingClientRect();
  W=Math.max(1,r.width);
  H=Math.max(1,r.height);
  dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(W*dpr);
  canvas.height=Math.round(H*dpr);
  canvas.style.width="100%";
  canvas.style.height="100%";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildTrack();
  draw();
}
new ResizeObserver(resize).observe(stage);

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function pos(e){
  const r=canvas.getBoundingClientRect();
  return{x:e.clientX-r.left,y:e.clientY-r.top};
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

function stroke(points,color,width,dash){
  if(points.length<2)return;
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.lineCap="round";
  ctx.lineJoin="round";
  if(dash)ctx.setLineDash(dash);
  ctx.beginPath();
  for(let i=0;i<points.length;i++){
    const p=points[i];
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function tangent(i){
  const a=track[Math.max(0,i-5)];
  const b=track[Math.min(track.length-1,i+5)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function terrain(){
  ctx.fillStyle="#597451";
  ctx.fillRect(0,0,W,H);

  for(let i=0;i<36;i++){
    const x=(i*181+37)%W;
    const y=(i*113+51)%H;
    const r=10+(i%5)*6;
    ctx.fillStyle=i%2?"#66805d":"#4e6a4a";
    ctx.beginPath();
    ctx.ellipse(x,y,r,r*.62,(i%8)*.2,0,Math.PI*2);
    ctx.fill();
  }
}

function drawTrees(){
  for(let i=0;i<14;i++){
    const x=(i*239+43)%W;
    const y=(i*157+29)%H;
    const s=.65+(i%3)*.1;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.fillStyle="#29462e";
    ctx.fillRect(-3,8,6,13);
    for(let j=0;j<3;j++){
      ctx.fillStyle=j?"#315438":"#203e2a";
      ctx.beginPath();
      ctx.moveTo(0,-25+j*10);
      ctx.lineTo(-15+j*2,9+j*4);
      ctx.lineTo(15-j*2,9+j*4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawKerbs(){
  const half=W*.043;
  for(let i=0;i<track.length;i+=7){
    const p=track[i],a=tangent(i);
    for(const side of[-1,1]){
      const x=p.x-Math.sin(a)*half*side;
      const y=p.y+Math.cos(a)*half*side;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(a);
      ctx.fillStyle=(Math.floor(i/7)%2===0)?"#e10600":"#f5f5f0";
      const w=Math.max(8,W*.011);
      ctx.fillRect(-w/2,-3.5,w,7);
      ctx.restore();
    }
  }
}

function drawStartFinish(){
  const p=track[0],a=tangent(0),half=W*.043;

  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(a+Math.PI/2);
  const s=Math.max(4,Math.round(W*.005));
  for(let r=-4;r<=4;r++){
    for(let c=-8;c<=8;c++){
      ctx.fillStyle=((r+c)&1)?"#111":"#fff";
      ctx.fillRect(c*s,r*s,s,s);
    }
  }
  ctx.fillStyle="#20dc6b";
  ctx.fillRect(-half,-3,half*.62,6);
  ctx.restore();

  ctx.save();
  ctx.font=`900 ${Math.max(10,W*.011)}px system-ui`;
  ctx.textAlign="right";
  ctx.fillStyle="#20dc6b";
  ctx.fillText("START",p.x-W*.052,p.y-W*.055);
  ctx.textAlign="left";
  ctx.fillStyle="#fff";
  ctx.fillText("CÉL",p.x+W*.052,p.y-W*.055);
  ctx.restore();
}

function drawArrows(){
  for(let i=35;i<track.length;i+=55){
    const p=track[i],a=tangent(i);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(a);
    ctx.globalAlpha=.34;
    ctx.fillStyle="#eef0ef";
    ctx.beginPath();
    ctx.moveTo(15,0);
    ctx.lineTo(-7,-8);
    ctx.lineTo(-3,0);
    ctx.lineTo(-7,8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawTrack(){
  stroke(track,"#172022",W*.108);
  stroke(track,"#d5cfbd",W*.096);
  stroke(track,"#3f4649",W*.076);
  stroke(track,"#70777a",Math.max(1.5,W*.0018),[W*.01,W*.01]);
  drawKerbs();
  drawArrows();
  drawStartFinish();
}

function drawUserPath(){
  if(path.length<2)return;
  stroke(path,"#8c6f0b",Math.max(9,W*.010));
  stroke(path,"#ffe95b",Math.max(3,W*.0032));
}

function drawCar(){
  if(!racing&&!finished)return;

  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.a);

  const s=clamp(W/1050,.72,1.18);
  ctx.scale(s,s);

  ctx.fillStyle="#0009";
  ctx.beginPath();
  ctx.ellipse(0,9,24,9,0,0,Math.PI*2);
  ctx.fill();

  if(Math.abs(car.slip)>.08){
    ctx.globalAlpha=clamp(Math.abs(car.slip)*.5,.15,.62);
    ctx.fillStyle="#eef0ee";
    ctx.beginPath();ctx.arc(-23,-7,7,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(-29,7,5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.fillStyle="#e10600";
  ctx.beginPath();
  ctx.roundRect(-20,-10,40,20,6);
  ctx.fill();

  ctx.fillStyle="#20262a";
  ctx.beginPath();
  ctx.roundRect(-8,-8,16,16,4);
  ctx.fill();

  ctx.fillStyle="#fff";
  ctx.fillRect(12,-5,6,3);
  ctx.fillRect(12,2,6,3);

  ctx.fillStyle="#111";
  ctx.fillRect(-12,-12,7,5);
  ctx.fillRect(7,-12,7,5);
  ctx.fillRect(-12,7,7,5);
  ctx.fillRect(7,7,7,5);

  ctx.restore();
}

function draw(){
  terrain();
  drawTrees();
  drawTrack();
  drawUserPath();
  drawCar();
}

function startDraw(e){
  if(racing)return;

  const p=pos(e);
  const start=track[0];

  if(dist(p,start)>W*START_TOLERANCE){
    statusEl.textContent="Érintsd meg a zöld START/CÉL kaput a rajzolás megkezdéséhez";
    return;
  }

  drawing=true;
  path=[p];
  samples=[];
  validationProgress=0;
  lastDrawPoint=p;
  lastDrawTime=performance.now();

  raceBtn.disabled=true;
  tip.style.display="none";
  pointsEl.textContent="1";
  statusEl.textContent="Rajzolás… menj végig az egész oválison";

  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
  draw();
}

function moveDraw(e){
  if(!drawing||racing)return;

  const p=pos(e);
  const now=performance.now();
  const d=dist(p,lastDrawPoint);

  if(d<1.2)return;

  const dt=Math.max(4,now-lastDrawTime);
  const v=clamp(d/(dt/1000),15,1400);

  path.push(p);
  samples.push({v,t:now});
  lastDrawPoint=p;
  lastDrawTime=now;
  pointsEl.textContent=String(path.length);

  draw();
  e.preventDefault();
}

/*
  Robust full-lap validation.
  We map the drawn line to the oval's centerline and require it to pass
  ordered checkpoints all the way around the circuit. A tiny loop at START
  cannot satisfy this because it never reaches the later checkpoints.
*/
function getCheckpoints(){
  const out=[];
  for(let i=0;i<CHECKPOINT_COUNT;i++){
    const idx=Math.floor(i*(track.length-1)/(CHECKPOINT_COUNT-1));
    out.push(track[idx]);
  }
  return out;
}

function validateFullLap(){
  if(path.length<80){
    return {ok:false,msg:"Túl rövid útvonal — rajzold körbe az egész pályát"};
  }

  const checkpoints=getCheckpoints();
  const tolerance=W*.070;

  // The drawing must begin at START.
  if(dist(path[0],track[0])>W*START_TOLERANCE){
    return {ok:false,msg:"A rajzolt útvonalnak a START kapuból kell indulnia"};
  }

  let next=1;
  let furthest=0;

  // Sequential checkpoint progression. We deliberately never search backwards.
  for(let i=1;i<path.length&&next<checkpoints.length;i++){
    if(dist(path[i],checkpoints[next])<=tolerance){
      furthest=next;
      next++;
    }
  }

  // Final point must return to the same START/CÉL gate.
  const endDist=dist(path[path.length-1],track[0]);

  if(next<checkpoints.length-1){
    const pct=Math.round(furthest/(checkpoints.length-1)*100);
    return {
      ok:false,
      msg:`Még nincs meg a teljes kör — ${pct}% teljesítve`
    };
  }

  if(endDist>W*START_TOLERANCE){
    return {
      ok:false,
      msg:"Majdnem körbeértél — vezesd vissza a vonalat a kockás CÉL-hoz"
    };
  }

  return {ok:true,msg:"KÉSZ — teljes kör kirajzolva, indítható a verseny"};
}

function endDraw(e){
  if(!drawing)return;

  drawing=false;
  try{canvas.releasePointerCapture(e.pointerId)}catch(_){}

  const result=validateFullLap();

  if(!result.ok){
    raceBtn.disabled=true;
    statusEl.textContent=result.msg;
    draw();
    return;
  }

  raceBtn.disabled=false;
  statusEl.textContent=result.msg;
  draw();
}

/*
  Build the race route from EXACTLY what the user drew.
  No predefined racing line is substituted.
*/
function buildRaceRoute(){
  const route=[];
  if(path.length<2)return route;

  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=dist(a,b);
    const n=Math.max(1,Math.ceil(d/3));
    const v=samples[i]?.v||samples.at(-1)?.v||220;

    for(let j=0;j<n;j++){
      const u=j/n;
      route.push({
        x:a.x+(b.x-a.x)*u,
        y:a.y+(b.y-a.y)*u,
        v:clamp(v,15,1400)
      });
    }
  }

  const last=path[path.length-1];
  route.push({
    x:last.x,
    y:last.y,
    v:clamp(samples.at(-1)?.v||220,15,1400)
  });

  return route;
}

function routeTangent(i){
  const a=raceRoute[Math.max(0,i-8)];
  const b=raceRoute[Math.min(raceRoute.length-1,i+8)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function routeCurvature(i){
  const step=Math.max(5,Math.floor(raceRoute.length*.008));
  const a=raceRoute[Math.max(0,i-step)];
  const b=raceRoute[i];
  const c=raceRoute[Math.min(raceRoute.length-1,i+step)];

  const ab=Math.atan2(b.y-a.y,b.x-a.x);
  const bc=Math.atan2(c.y-b.y,c.x-b.x);
  let da=bc-ab;

  while(da>Math.PI)da-=Math.PI*2;
  while(da<-Math.PI)da+=Math.PI*2;

  const chord=Math.max(1,dist(a,c));
  return Math.abs(da)/(chord/100);
}

function nearestTrackDistance(p){
  let best=Infinity;
  for(let i=0;i<track.length;i+=4){
    best=Math.min(best,dist(p,track[i]));
  }
  return best;
}

function startRace(){
  if(racing)return;

  const validation=validateFullLap();
  if(!validation.ok){
    statusEl.textContent=validation.msg;
    raceBtn.disabled=true;
    return;
  }

  raceRoute=buildRaceRoute();

  if(raceRoute.length<2){
    statusEl.textContent="Nem sikerült létrehozni a versenyvonalat — rajzold újra";
    return;
  }

  const a=raceRoute[0],b=raceRoute[1];

  car={
    x:a.x,
    y:a.y,
    a:Math.atan2(b.y-a.y,b.x-a.x),
    speed:Math.max(15,a.v),
    slip:0,
    driftX:0,
    driftY:0
  };

  progress=0;
  racing=true;
  finished=false;
  turbo=100;
  turboHeld=false;
  startTime=performance.now();
  lastFrame=startTime;

  raceBtn.disabled=true;
  clearBtn.disabled=true;
  turboBtn.disabled=false;
  statusEl.textContent="VERSENY!";

  updateTurboUI();
  draw();
  requestAnimationFrame(loop);
}

function updateCar(dt){
  if(progress>=raceRoute.length-1)return;

  const idx=Math.min(Math.floor(progress),raceRoute.length-2);
  const a=raceRoute[idx],b=raceRoute[idx+1];

  // Exact finger speed is the base target speed.
  let target=a.v;

  // Finite turbo only modifies that measured speed.
  if(turboHeld&&turbo>0)target*=1.5;

  const curv=routeCurvature(idx);

  /*
    Corner model:
    - On a straight, almost all of the drawn speed is retained.
    - In a sharp turn, there is a speed threshold.
    - Arriving too fast creates both speed loss and lateral drift.
  */
  const safeSpeed=300/(1+curv*3.0);
  const excess=Math.max(0,target-safeSpeed);
  const cornerStress=clamp(excess/Math.max(1,target),0,1);

  // Leave the asphalt? The car follows the user's line, but off-track lines
  // lose speed noticeably.
  const offRoad=nearestTrackDistance(P(car.x,car.y))>W*.058;
  const offRoadMultiplier=offRoad?.48:1;

  target*=Math.max(.18,1-cornerStress*.62);
  target*=offRoadMultiplier;

  // Responsive speed change so the car closely follows the drawing speed.
  const response=.78;
  car.speed+=(target-car.speed)*Math.min(1,response*dt/16.666);

  const segment=dist(a,b);
  progress+=(car.speed*dt/1000)/Math.max(.25,segment);

  const i=Math.min(Math.floor(progress),raceRoute.length-2);
  const u=progress-i;
  const p=raceRoute[i],q=raceRoute[i+1];

  const routeAngle=routeTangent(i);
  let headingDelta=routeAngle-car.a;
  while(headingDelta>Math.PI)headingDelta-=Math.PI*2;
  while(headingDelta<-Math.PI)headingDelta+=Math.PI*2;

  /*
    At excessive corner speed the car cannot instantly rotate to the route.
    Instead it keeps part of its previous heading and develops a lateral
    velocity. This makes the car visibly leave the drawn line.
  */
  const steeringGrip=clamp(.90-cornerStress*.72, .16, .90);
  car.a+=headingDelta*Math.min(1,steeringGrip*dt/16.666);

  const idealX=p.x+(q.x-p.x)*u;
  const idealY=p.y+(q.y-p.y)*u;

  const sideX=-Math.sin(routeAngle);
  const sideY=Math.cos(routeAngle);

  const driftTarget=cornerStress*(W*.14)+Math.max(0,curv-.65)*W*.035;

  // Preserve a little drift momentum, then recover grip on straights.
  car.slip+=(driftTarget-car.slip)*Math.min(1,.055*dt/16.666);

  const direction=headingDelta>=0?1:-1;
  const driftOffset=car.slip*direction;

  car.x=idealX+sideX*driftOffset;
  car.y=idealY+sideY*driftOffset;

  // A little extra drag when the car is sliding.
  if(cornerStress>.05){
    car.speed*=1-Math.min(.018,cornerStress*.010*dt/16.666);
  }
}

function loop(now){
  if(!racing)return;

  const dt=Math.min(50,Math.max(1,now-lastFrame));
  lastFrame=now;

  if(turboHeld&&turbo>0){
    turbo=Math.max(0,turbo-dt*.065);
  }

  updateCar(dt);

  const pct=clamp(progress/(raceRoute.length-1)*100,0,100);
  speedEl.textContent=String(Math.round(car.speed*.055));
  distanceEl.textContent=String(Math.round(pct));
  timeEl.textContent=((now-startTime)/1000).toFixed(2);

  updateTurboUI();
  draw();

  if(progress>=raceRoute.length-1){
    finishRace();
    return;
  }

  requestAnimationFrame(loop);
}

function finishRace(){
  progress=raceRoute.length-1;
  racing=false;
  finished=true;
  turboHeld=false;
  turboBtn.disabled=true;
  clearBtn.disabled=false;
  speedEl.textContent="0";
  distanceEl.textContent="100";
  statusEl.textContent="CÉLBA ÉRTÉL 🏁";
  draw();
}

function updateTurboUI(){
  turboFill.style.width=`${turbo}%`;
  turboLabel.textContent=`${Math.round(turbo)}%`;
  if(turbo<=0)turboBtn.disabled=true;
}

function reset(){
  drawing=false;
  racing=false;
  finished=false;
  turboHeld=false;
  path=[];
  samples=[];
  raceRoute=[];
  progress=0;
  turbo=100;
  validationProgress=0;

  raceBtn.disabled=true;
  turboBtn.disabled=true;
  clearBtn.disabled=false;

  statusEl.textContent="Indulj a zöld START/CÉL kapuból";
  speedEl.textContent="0";
  distanceEl.textContent="0";
  timeEl.textContent="0.00";
  pointsEl.textContent="0";
  tip.style.display="block";

  updateTurboUI();
  draw();
}

raceBtn.addEventListener("click",startRace);
clearBtn.addEventListener("click",reset);

turboBtn.addEventListener("pointerdown",e=>{
  if(racing&&turbo>0){
    e.preventDefault();
    e.stopPropagation();
    turboHeld=true;
    try{turboBtn.setPointerCapture(e.pointerId)}catch(_){}
  }
});
["pointerup","pointercancel","pointerleave"].forEach(t=>{
  turboBtn.addEventListener(t,()=>turboHeld=false);
});

canvas.addEventListener("pointerdown",startDraw,{passive:false});
canvas.addEventListener("pointermove",moveDraw,{passive:false});
canvas.addEventListener("pointerup",endDraw,{passive:false});
canvas.addEventListener("pointercancel",endDraw,{passive:false});
canvas.addEventListener("contextmenu",e=>e.preventDefault());

resize();
window.addEventListener("load",resize);
