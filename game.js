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

let W=1,H=1,dpr=1,lastW=0,lastH=0;
let track=[],checkpoints=[],path=[],race=[];
let drawing=false,racing=false,finished=false;
let progress=0,startTime=0,lastTime=0;
let turbo=100,turboHeld=false;
let drawSamples=[];
let car={x:0,y:0,a:0,speed:0,slip:0};

const ROAD_HALF_RATIO=.047;
const CHECKPOINT_COUNT=18;

/*
  V10 TRACK DESIGN
  ----------------
  A single closed circuit inspired directly by the supplied reference:
  - outer lap
  - long bottom start/finish straight
  - left hairpin
  - upper sweep
  - right-hand hairpin
  - inner return
  - visible green infield separating every parallel road section

  IMPORTANT: this is one continuous centerline. There are no crossing road
  ribbons, so START and CÉL can only be reached after completing the circuit.
*/
const shape=[
  [.08,.80],[.08,.67],[.10,.54],[.08,.40],[.11,.27],[.19,.18],
  [.31,.13],[.44,.11],[.58,.12],[.72,.12],[.84,.16],[.92,.24],
  [.95,.35],[.94,.47],[.90,.57],[.83,.64],[.73,.67],[.64,.64],
  [.57,.59],[.54,.52],[.56,.45],[.63,.40],[.73,.39],[.81,.42],
  [.86,.49],[.86,.58],[.82,.66],[.75,.72],[.65,.76],[.53,.77],
  [.41,.76],[.30,.73],[.22,.68],[.18,.60],[.19,.52],[.24,.47],
  [.33,.45],[.42,.46],[.49,.50],[.51,.57],[.48,.63],[.40,.66],
  [.31,.64],[.23,.60],[.16,.61],[.12,.68],[.12,.76],[.08,.80]
];

function P(x,y){return{x,y}}

function catmull(ps,steps=8){
  const out=[];
  for(let i=0;i<ps.length-1;i++){
    const p0=ps[Math.max(0,i-1)],p1=ps[i],p2=ps[i+1],p3=ps[Math.min(ps.length-1,i+2)];
    for(let j=0;j<steps;j++){
      const t=j/steps,t2=t*t,t3=t2*t;
      const x=.5*(2*p1[0]+(-p0[0]+p2[0])*t+
        (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+
        (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      const y=.5*(2*p1[1]+(-p0[1]+p2[1])*t+
        (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+
        (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      out.push(P(x*W,y*H));
    }
  }
  return out;
}

function resize(){
  const r=stage.getBoundingClientRect();
  const nw=Math.max(1,Math.round(r.width));
  const nh=Math.max(1,Math.round(r.height));
  if(nw===lastW&&nh===lastH)return;
  lastW=nw;lastH=nh;W=nw;H=nh;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(W*dpr);
  canvas.height=Math.round(H*dpr);
  canvas.style.width="100%";
  canvas.style.height="100%";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildTrack();
  draw();
}
new ResizeObserver(resize).observe(stage);

function buildTrack(){
  track=catmull(shape,8);
  checkpoints=[];
  for(let i=0;i<CHECKPOINT_COUNT;i++){
    const idx=Math.floor(i*(track.length-1)/(CHECKPOINT_COUNT-1));
    checkpoints.push(track[idx]);
  }
}

function line(points,color,width,dash=[]){
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

function tangent(points,i){
  const a=points[Math.max(0,i-3)];
  const b=points[Math.min(points.length-1,i+3)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function sidePoint(i,side){
  const a=tangent(track,i);
  const d=W*ROAD_HALF_RATIO+W*.006;
  const p=track[i];
  return P(p.x-Math.sin(a)*d*side,p.y+Math.cos(a)*d*side);
}

function terrain(){
  ctx.fillStyle="#5d7952";
  ctx.fillRect(0,0,W,H);

  // Restrained landscape details, kept outside the road.
  for(let i=0;i<42;i++){
    const x=(i*197+41)%W;
    const y=(i*131+27)%H;
    const s=16+(i%4)*9;
    ctx.fillStyle=i%2?"#6b855f":"#52704b";
    ctx.beginPath();
    ctx.ellipse(x,y,s,s*.62,(i%7)*.15,0,Math.PI*2);
    ctx.fill();
  }
}

function tree(x,y,s){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(s,s);
  ctx.fillStyle="#263d2a";
  ctx.fillRect(-3,7,6,13);
  for(let i=0;i<3;i++){
    ctx.fillStyle=i?"#315438":"#203e2a";
    ctx.beginPath();
    ctx.moveTo(0,-25+i*10);
    ctx.lineTo(-14+i*2,8+i*4);
    ctx.lineTo(14-i*2,8+i*4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTrees(){
  for(let i=0;i<19;i++){
    tree((i*263+65)%W,(i*173+42)%H,.70+(i%3)*.13);
  }
}

function drawKerbs(){
  for(let i=3;i<track.length-3;i+=4){
    for(const side of[-1,1]){
      const p=sidePoint(i,side);
      const a=tangent(track,i);
      const len=Math.max(8,W*.010);
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(a);
      ctx.fillStyle=(Math.floor(i/4)%2===0)?"#e10600":"#f5f5ef";
      ctx.fillRect(-len/2,-4,len,8);
      ctx.restore();
    }
  }
}

function drawStartGate(){
  const i=1,p=track[i],a=tangent(track,i),half=W*.047;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(a+Math.PI/2);
  ctx.fillStyle="#20dc6b33";
  ctx.fillRect(-half,-8,half*2,16);
  ctx.strokeStyle="#20dc6b";
  ctx.lineWidth=3;
  ctx.strokeRect(-half,-8,half*2,16);
  ctx.restore();

  ctx.save();
  ctx.fillStyle="#20dc6b";
  ctx.font=`900 ${Math.max(11,W*.012)}px system-ui`;
  ctx.textAlign="center";
  ctx.fillText("START",p.x,p.y-W*.058);
  ctx.restore();
}

function drawFinishGate(){
  const i=track.length-1,p=track[i],a=tangent(track,i),half=W*.047;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(a+Math.PI/2);
  const bw=6;
  for(let r=-4;r<5;r++){
    for(let c=-8;c<9;c++){
      ctx.fillStyle=((r+c)&1)?"#111":"#fff";
      ctx.fillRect(c*bw,r*bw,bw,bw);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle="#fff";
  ctx.font=`900 ${Math.max(11,W*.012)}px system-ui`;
  ctx.textAlign="center";
  ctx.fillText("CÉL",p.x,p.y-W*.058);
  ctx.restore();
}

function drawDirectionArrows(){
  const list=[18,48,78,108,138,168,198,228,258,288];
  for(const i of list){
    if(i>=track.length-4)continue;
    const p=track[i],a=tangent(track,i);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(a);
    ctx.globalAlpha=.34;
    ctx.fillStyle="#e7eaeb";
    ctx.beginPath();
    ctx.moveTo(16,0);
    ctx.lineTo(-7,-8);
    ctx.lineTo(-3,0);
    ctx.lineTo(-7,8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawTrack(){
  // Outer border -> kerb -> asphalt -> subtle center marking.
  line(track,"#1a2022",W*.108);
  line(track,"#d0c9b6",W*.095);
  line(track,"#3f4649",W*.076);
  line(track,"#70777a",Math.max(1.5,W*.0018),[W*.010,W*.010]);
  drawKerbs();
  drawDirectionArrows();
  drawStartGate();
  drawFinishGate();
}

function drawPath(){
  if(path.length<2)return;
  line(path,"#a88413",Math.max(8,W*.009));
  line(path,"#fff06a",Math.max(2.4,W*.0028));
}

function drawCar(){
  if(!racing&&!finished)return;
  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.a);
  const s=Math.max(.72,Math.min(1.18,W/1050));
  ctx.scale(s,s);

  // Shadow
  ctx.fillStyle="#0009";
  ctx.beginPath();
  ctx.ellipse(1,8,24,9,0,0,Math.PI*2);
  ctx.fill();

  // Drift smoke when the car loses grip.
  if(car.slip>.12){
    ctx.globalAlpha=Math.min(.55,car.slip*.28);
    ctx.fillStyle="#eef0ee";
    ctx.beginPath();ctx.arc(-22,-7,7,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(-27,7,5,0,Math.PI*2);ctx.fill();
  }

  ctx.globalAlpha=1;
  ctx.fillStyle="#e10600";
  ctx.beginPath();ctx.roundRect(-20,-10,40,20,6);ctx.fill();
  ctx.fillStyle="#252a2e";
  ctx.beginPath();ctx.roundRect(-8,-8,16,16,4);ctx.fill();
  ctx.fillStyle="#fff";
  ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);
  ctx.fillStyle="#111";
  for(const q of[[-12,-12],[8,-12],[-12,7],[8,7]])ctx.fillRect(q[0],q[1],7,5);
  ctx.restore();
}

function draw(){
  terrain();
  drawTrees();
  drawTrack();
  drawPath();
  drawCar();
}

function pos(e){
  const r=canvas.getBoundingClientRect();
  return P(e.clientX-r.left,e.clientY-r.top);
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

function startDraw(e){
  if(racing)return;
  const p=pos(e);
  const s=track[1];

  if(dist(p,s)>W*.075){
    statusEl.textContent="A zöld START kapuból kell indulnod";
    return;
  }

  drawing=true;
  path=[p];
  drawSamples=[];
  lastDrawTime=performance.now();
  tip.style.display="none";
  pointsEl.textContent="1";
  statusEl.textContent="Rajzolás… vezesd végig az egész pályán a kockás CÉL-ig";
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
  draw();
}

function moveDraw(e){
  if(!drawing||racing)return;
  const p=pos(e);
  const q=path[path.length-1];
  const now=performance.now();
  const dt=Math.max(4,now-lastDrawTime);
  const d=dist(p,q);

  if(d<1.5)return;

  path.push(p);
  // Actual finger speed in screen/canvas pixels per second.
  drawSamples.push({
    t:now,
    pxPerSec:Math.max(10,Math.min(1600,d/(dt/1000)))
  });
  lastDrawTime=now;
  pointsEl.textContent=path.length;
  draw();
  e.preventDefault();
}

function pointNearPath(p,arr,limit){
  let best=Infinity;
  for(let i=0;i<arr.length;i+=3)best=Math.min(best,dist(p,arr[i]));
  return best<=limit;
}

/*
  A shortcut is no longer accepted.
  The drawn line must visit sequential track checkpoints. It may be anywhere
  inside the road width, but it must actually travel around the circuit.
*/
function validateDrawing(){
  if(path.length<25)return {ok:false,msg:"Túl rövid vonal — rajzold végig a pályát"};

  const roadLimit=W*.065;
  let next=0;

  // Checkpoints are deliberately ordered around the entire circuit.
  for(let i=0;i<path.length&&next<checkpoints.length;i++){
    if(dist(path[i],checkpoints[next])<=roadLimit)next++;
  }

  const startOK=dist(path[0],track[1])<=W*.075;
  const finishOK=dist(path[path.length-1],track[track.length-1])<=W*.075;

  if(!startOK)return {ok:false,msg:"A rajzolt útvonalnak a START kapuból kell indulnia"};
  if(next<checkpoints.length)return {
    ok:false,
    msg:`Még nem jártad végig a pályát — ${next}/${checkpoints.length} szakasz teljesítve`
  };
  if(!finishOK)return {ok:false,msg:"A vonal végét vidd a kockás CÉL-hoz"};
  return {ok:true,msg:"Kész — az egész pálya ki van rajzolva"};
}

function endDraw(e){
  if(!drawing)return;
  drawing=false;

  const result=validateDrawing();
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
  Convert the user's drawn path to a clean, uniformly sampled route.
  Each route sample keeps the finger speed measured while that part of the
  line was drawn.
*/
function buildRace(){
  const out=[];
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=dist(a,b);
    const n=Math.max(1,Math.ceil(d/4));
    const measured=drawSamples[Math.min(i,drawSamples.length-1)]?.pxPerSec||220;

    for(let j=0;j<n;j++){
      const u=j/n;
      out.push({
        x:a.x+(b.x-a.x)*u,
        y:a.y+(b.y-a.y)*u,
        userSpeed:Math.max(20,Math.min(1600,measured))
      });
    }
  }
  out.push({
    x:path[path.length-1].x,
    y:path[path.length-1].y,
    userSpeed:drawSamples.at(-1)?.pxPerSec||220
  });
  return out;
}

function curvatureAt(i){
  const step=Math.max(5,Math.floor(race.length*.012));
  const a=race[Math.max(0,i-step)];
  const b=race[i];
  const c=race[Math.min(race.length-1,i+step)];

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
  for(let i=0;i<track.length;i+=2)best=Math.min(best,dist(p,track[i]));
  return best;
}

function startRace(){
  if(racing||raceBtn.disabled||path.length<25)return;

  race=buildRace();
  if(race.length<2)return;

  progress=0;
  racing=true;
  finished=false;
  startTime=performance.now();
  lastTime=startTime;
  turbo=100;
  turboHeld=false;

  raceBtn.disabled=true;
  clearBtn.disabled=true;
  turboBtn.disabled=false;
  statusEl.textContent="VERSENY!";

  car={
    x:race[0].x,
    y:race[0].y,
    a:Math.atan2(race[1].y-race[0].y,race[1].x-race[0].x),
    speed:race[0].userSpeed,
    slip:0
  };

  updateTurboUI();
  requestAnimationFrame(loop);
}

function updateCar(dt){
  const idx=Math.min(Math.floor(progress),race.length-2);
  const u=progress-idx;
  const a=race[idx],b=race[idx+1];

  // The finger speed is the actual target speed. No fixed animation speed.
  let target=a.userSpeed;

  // Corner physics: only excessive entry speed causes a penalty.
  const curv=curvatureAt(idx);
  const safeSpeed=Math.max(70,360/(1+curv*2.6));
  const excess=Math.max(0,target-safeSpeed);
  const cornerPenalty=Math.min(.78,excess/Math.max(1,target)*.92);

  // Off-road route slows down.
  const off=nearestTrackDistance(P(car.x,car.y));
  const offPenalty=off>W*.058?.52:1;

  // Finite turbo temporarily raises target speed.
  const turboBoost=(turboHeld&&turbo>0)?1.48:1;
  target*=Math.max(.2,1-cornerPenalty)*offPenalty*turboBoost;

  // Responsive speed following: fast enough to feel directly tied to drawing.
  const response=target<car.speed?.30:.42;
  car.speed+=((target-car.speed)*Math.min(1,response*dt/16.666));

  // Progress is physical distance / current speed, not a fixed animation step.
  const seg=dist(a,b);
  progress+=(car.speed*dt/1000)/Math.max(.1,seg);

  const targetA=Math.atan2(b.y-a.y,b.x-a.x);
  let da=targetA-car.a;
  while(da>Math.PI)da-=Math.PI*2;
  while(da<-Math.PI)da+=Math.PI*2;

  // Grip drops when entering a corner too fast.
  const grip=Math.max(.035,.24-curv*.035-cornerPenalty*.16);
  car.a+=da*Math.min(1,grip*dt/16.666);

  const idealX=a.x+(b.x-a.x)*u;
  const idealY=a.y+(b.y-a.y)*u;

  const sideX=-Math.sin(targetA);
  const sideY=Math.cos(targetA);

  const slipTarget=cornerPenalty*1.35+Math.max(0,curv-.45)*.30;
  car.slip+=(slipTarget-car.slip)*Math.min(1,.10*dt/16.666);

  car.x=idealX+sideX*car.slip*W*.10;
  car.y=idealY+sideY*car.slip*W*.10;

  return {actual:car.speed,curv,off,cornerPenalty};
}

function loop(now){
  if(!racing)return;

  const dt=Math.min(50,now-lastTime);
  lastTime=now;

  if(turboHeld&&turbo>0){
    turbo=Math.max(0,turbo-dt*.060);
  }

  const state=updateCar(dt);
  const pct=Math.min(100,progress/(race.length-1)*100);

  // px/s -> a stable game-facing km/h display.
  speedEl.textContent=Math.round(state.actual*.055);
  distanceEl.textContent=Math.round(pct);
  timeEl.textContent=((now-startTime)/1000).toFixed(2);

  updateTurboUI();
  draw();

  if(progress>=race.length-1){
    finishRace();
    return;
  }

  requestAnimationFrame(loop);
}

function finishRace(){
  progress=race.length-1;
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
  race=[];
  progress=0;
  turbo=100;

  raceBtn.disabled=true;
  turboBtn.disabled=true;
  clearBtn.disabled=false;

  statusEl.textContent="Indulj a zöld START kapuból";
  speedEl.textContent="0";
  distanceEl.textContent="0";
  timeEl.textContent="0.00";
  pointsEl.textContent="0";
  tip.style.display="block";

  updateTurboUI();
  draw();
}

// Turbo is held only while the finger is physically on the button.
turboBtn.addEventListener("pointerdown",e=>{
  if(racing&&turbo>0){
    e.preventDefault();
    e.stopPropagation();
    turboHeld=true;
    try{turboBtn.setPointerCapture(e.pointerId)}catch(_){}
  }
});
["pointerup","pointercancel","pointerleave"].forEach(type=>{
  turboBtn.addEventListener(type,()=>turboHeld=false);
});

// Explicit globals for inline Android-safe button handlers.
window.startRace=startRace;
window.reset=reset;

resize();
window.addEventListener("load",resize);
