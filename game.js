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

  // Reverse-engineered from Draw Race 2:
  // draw speed is normalized against a slowly moving maximum (99% old,
  // 1% current), then stored as a 0..100 "gas" value. PathPoint smooths
  // successive gas values with 40/60 weighting and clamps the change to 5.
  let maxDrawSpeed=0;
  let previousGas=0;

  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=dist(a,b);
    const n=Math.max(1,Math.ceil(d/3));
    const v=clamp(samples[i]?.v||samples.at(-1)?.v||220,15,1400);

    maxDrawSpeed=maxDrawSpeed*.99+v*.01;
    const rawGas=maxDrawSpeed>0 ? clamp(v/maxDrawSpeed*100,0,100) : 0;

    // Same smoothing behavior as Path::addPointToPath().
    let gas=rawGas*.4+previousGas*.6;
    gas=clamp(gas,previousGas-5,previousGas+5);
    gas=clamp(gas,0,100);
    gas=Math.round(gas);
    previousGas=gas;

    for(let j=0;j<n;j++){
      const u=j/n;
      route.push({
        x:a.x+(b.x-a.x)*u,
        y:a.y+(b.y-a.y)*u,
        v,
        gas,
        skid:0
      });
    }
  }

  const last=path[path.length-1];
  const lastV=clamp(samples.at(-1)?.v||220,15,1400);
  maxDrawSpeed=maxDrawSpeed*.99+lastV*.01;
  let lastGas=maxDrawSpeed>0 ? clamp(lastV/maxDrawSpeed*100,0,100) : previousGas;
  lastGas=Math.round(clamp(lastGas*.4+previousGas*.6,previousGas-5,previousGas+5));
  route.push({x:last.x,y:last.y,v:lastV,gas:clamp(lastGas,0,100),skid:0});

  // Exact Path::calculateSkidValue() model. The original compares the
  // local turn angle (radians) with 25/gas; only an overspeed turn changes
  // skid, and skid is accumulated and clamped to +/-0.95.
  for(let i=1;i<route.length-1;i++){
    const prev=route[i-1], cur=route[i], next=route[i+1];
    const ax=cur.x-prev.x, ay=cur.y-prev.y;
    const bx=next.x-cur.x, by=next.y-cur.y;
    const al=Math.hypot(ax,ay), bl=Math.hypot(bx,by);
    let skid=route[i-1].skid||0;

    if(al>.0001 && bl>.0001 && cur.gas>0){
      let dot=(ax*bx+ay*by)/(al*bl);
      dot=clamp(dot,-1,1);
      const angle=Math.acos(dot);
      if(angle>25/cur.gas){
        const cross=ax*by-ay*bx;
        skid+=angle*(cross>0 ? .2 : -.2);
      }
    }

    route[i].skid=clamp(skid,-.95,.95);
  }
  if(route.length>1)route[route.length-1].skid=route[route.length-2].skid||0;
  return route;
}

function routeTangent(i){
  const a=raceRoute[Math.max(0,i-8)];
  const b=raceRoute[Math.min(raceRoute.length-1,i+8)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function routeTurn(i){
  // Draw Race 2 does not use a generic curvature number for the drawn
  // path's skid logic. PathPoint::calculateSkidValue() accumulates signed
  // skid from angle + normalized drawing gas. Convert that result back to a
  // stable 0..1 severity for the web physics.
  const p=raceRoute[Math.max(0,Math.min(raceRoute.length-1,i))];
  const skid=p?.skid||0;
  const a=raceRoute[Math.max(0,i-2)];
  const b=raceRoute[Math.min(raceRoute.length-1,i+2)];
  const turn=Math.atan2(b.y-a.y,b.x-a.x)-routeTangent(i);
  let t=turn;
  while(t>Math.PI)t-=Math.PI*2;
  while(t<-Math.PI)t+=Math.PI*2;
  return t*(.35+.65*clamp(Math.abs(skid)/.95,0,1));
}

function findRoutePointByDistance(index,offset){
  let i=index;
  let remaining=Math.abs(offset);
  const dir=offset<0?-1:1;

  while(remaining>0){
    const next=i+dir;
    if(next<0)return raceRoute[0];
    if(next>=raceRoute.length)return raceRoute[raceRoute.length-1];
    const d=dist(raceRoute[i],raceRoute[next]);
    if(d>=remaining){
      const u=remaining/Math.max(.001,d);
      return {
        x:raceRoute[i].x+(raceRoute[next].x-raceRoute[i].x)*u,
        y:raceRoute[i].y+(raceRoute[next].y-raceRoute[i].y)*u
      };
    }
    remaining-=d;
    i=next;
  }

  return raceRoute[i];
}

function routeCorner(i){
  const turn=routeTurn(i);
  const magnitude=Math.abs(turn);
  return {
    turn,
    sharpness:clamp(magnitude/0.030,0,1.8)
  };
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

  // The player's drawing defines the intended pace. The physics may reduce
  // that pace when the requested cornering speed is beyond the tyre grip.
  let target=a.v;
  if(turboHeld&&turbo>0)target*=1.5;

  const segment=Math.max(.25,dist(a,b));
  progress+=(Math.max(0,car.speed)*dt/1000)/segment;

  const i=Math.min(Math.floor(progress),raceRoute.length-2);
  const p=raceRoute[i],q=raceRoute[i+1];
  const u=progress-i;
  const routeAngle=routeTangent(i);
  const corner=routeCorner(i);
  const turnAngle=Math.abs(corner.turn);

  // --- CORNER PHYSICS ---------------------------------------------------
  // Instead of adding an arbitrary visual offset, calculate whether the
  // requested speed is physically compatible with the actual angle of the
  // player's drawn line. A near-90-degree corner therefore becomes a true
  // low-grip event at racing speed.
  //
  // cornerSeverity: 0 = gentle bend, 1 = approximately 90 degrees.
  const cornerSeverity=clamp(turnAngle/(Math.PI*.50),0,1);
  const currentSpeed=Math.max(0,car.speed);

  // Safe speed falls very sharply as the drawn corner approaches 90 degrees.
  // Values are in canvas pixels/sec. A 90-degree corner is intentionally
  // almost a hairpin: entering it at full drawing speed forces heavy braking.
  const safeCornerSpeed=150+520*Math.pow(1-cornerSeverity,1.65);
  const speedRatio=cornerSeverity>0.08
    ? currentSpeed/Math.max(80,safeCornerSpeed)
    : 0;

  // The excess is nonlinear: slightly too fast is manageable, but entering
  // a sharp corner far too fast causes a very strong loss of control.
  const excess=clamp((speedRatio-1)/2.15,0,1);
  const severeEntry=cornerSeverity*excess;

  // Asphalt/off-road drag remains a secondary effect.
  const offRoad=nearestTrackDistance({x:car.x,y:car.y})>W*.058;
  if(offRoad)target*=.58;

  // When the corner cannot be carried, rapidly bleed speed. This is the key
  // Draw Race-style behavior: a very fast 90-degree entry can lose almost all
  // of its speed before the car recovers.
  if(severeEntry>0){
    const brakeRate=7.5+8.5*cornerSeverity;
    car.speed*=Math.exp(-brakeRate*severeEntry*dt/1000);
  }

  // Normal speed response. Never force the car back to the player's speed
  // while it is in a severe slide; that would cancel the physics immediately.
  const response=1-Math.exp(-dt/(severeEntry>.12?190:105));
  car.speed+=(target-car.speed)*response;
  if(severeEntry>0.55){
    // The corner itself imposes a hard upper bound while grip is lost.
    const emergencyCap=safeCornerSpeed*(1-.72*severeEntry);
    car.speed=Math.min(car.speed,Math.max(8,emergencyCap));
  }
  car.speed=clamp(car.speed,0,1400*1.5);

  // --- STEERING / YAW ---------------------------------------------------
  let headingDelta=routeAngle-car.a;
  while(headingDelta>Math.PI)headingDelta-=Math.PI*2;
  while(headingDelta<-Math.PI)headingDelta+=Math.PI*2;

  // In a slide the nose keeps its inertia instead of snapping to the line.
  const steeringGrip=clamp(.98-.72*severeEntry,.18,.98);
  car.a+=headingDelta*(1-Math.exp(-steeringGrip*dt/52));

  const idealX=p.x+(q.x-p.x)*u;
  const idealY=p.y+(q.y-p.y)*u;
  const normalX=-Math.sin(routeAngle);
  const normalY=Math.cos(routeAngle);
  const turnSign=turnAngle<.00035?0:Math.sign(corner.turn);
  const outsideSign=-turnSign;

  let lateralVelocity=car.driftX*normalX+car.driftY*normalY;

  // Slip is proportional to how badly the entry speed exceeds the corner's
  // carrying speed. The car moves outward with genuine lateral velocity.
  const maxDrift=W*.19;
  const maxLateralVelocity=W*1.35;

  if(turnSign!==0 && severeEntry>0){
    const outwardAccel=(2600+5200*cornerSeverity)*Math.pow(severeEntry,1.18);
    lateralVelocity+=outsideSign*outwardAccel*dt/1000;
  }

  // Once speed falls back into the grip window, the tyres regain authority and
  // the car naturally returns toward the exact drawn line.
  const displacementError=car.slip;
  const recoveryStrength=severeEntry>.05
    ? 1.8+6.5*(1-severeEntry)
    : 9.5;
  const damping=2.4+3.5*severeEntry;
  lateralVelocity+=(-displacementError*recoveryStrength-lateralVelocity*damping)*dt/1000;
  lateralVelocity=clamp(lateralVelocity,-maxLateralVelocity,maxLateralVelocity);

  car.slip+=lateralVelocity*dt/1000;
  car.slip=clamp(car.slip,-maxDrift,maxDrift);
  car.driftX=normalX*lateralVelocity;
  car.driftY=normalY*lateralVelocity;

  // Additional tyre scrub from lateral slip. This creates visible time loss
  // without permanently breaking route following.
  if(severeEntry>0){
    const scrub=.10+.24*severeEntry;
    car.speed*=Math.exp(-scrub*dt/1000);
  }

  // When the car has slowed sufficiently, snap nothing: simply let the
  // physical recovery bring it back to the drawn line over time.
  car.x=idealX+normalX*car.slip;
  car.y=idealY+normalY*car.slip;
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
