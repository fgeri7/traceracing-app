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
let car={x:0,y:0,a:0,speed:0};

function buildTrack(){
  track=[];
  const cx=W*.5,cy=H*.5;
  const rx=Math.min(W*.405,Math.max(120,W*.405));
  const ry=Math.min(H*.34,Math.max(70,H*.34));
  // Start/finish at the LEFT. One complete clockwise oval returns to it.
  const count=720;
  for(let i=0;i<count;i++){
    const t=Math.PI+(Math.PI*2*i)/(count-1);
    track.push({x:cx+rx*Math.cos(t),y:cy+ry*Math.sin(t)});
  }
}

function resize(){
  const r=stage.getBoundingClientRect();
  W=Math.max(1,r.width);H=Math.max(1,r.height);
  dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
  canvas.style.width="100%";canvas.style.height="100%";
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
  const a=track[Math.max(0,i-4)];
  const b=track[Math.min(track.length-1,i+4)];
  return Math.atan2(b.y-a.y,b.x-a.x);
}

function terrain(){
  ctx.fillStyle="#597451";
  ctx.fillRect(0,0,W,H);
  for(let i=0;i<36;i++){
    const x=(i*181+37)%W,y=(i*113+51)%H,r=10+(i%5)*6;
    ctx.fillStyle=i%2?"#66805d":"#4e6a4a";
    ctx.beginPath();
    ctx.ellipse(x,y,r,r*.62,(i%8)*.2,0,Math.PI*2);
    ctx.fill();
  }
}

function drawTrees(){
  for(let i=0;i<14;i++){
    const x=(i*239+43)%W,y=(i*157+29)%H,s=.65+(i%3)*.1;
    ctx.save();
    ctx.translate(x,y);ctx.scale(s,s);
    ctx.fillStyle="#29462e";ctx.fillRect(-3,8,6,13);
    for(let j=0;j<3;j++){
      ctx.fillStyle=j?"#315438":"#203e2a";
      ctx.beginPath();
      ctx.moveTo(0,-25+j*10);
      ctx.lineTo(-15+j*2,9+j*4);
      ctx.lineTo(15-j*2,9+j*4);
      ctx.closePath();ctx.fill();
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
      ctx.translate(x,y);ctx.rotate(a);
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
  ctx.translate(p.x,p.y);ctx.rotate(a+Math.PI/2);
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
  ctx.textAlign="right";ctx.fillStyle="#20dc6b";
  ctx.fillText("START",p.x-W*.052,p.y-W*.055);
  ctx.textAlign="left";ctx.fillStyle="#fff";
  ctx.fillText("CÉL",p.x+W*.052,p.y-W*.055);
  ctx.restore();
}

function drawArrows(){
  for(let i=35;i<track.length;i+=48){
    const p=track[i],a=tangent(i);
    ctx.save();
    ctx.translate(p.x,p.y);ctx.rotate(a);
    ctx.globalAlpha=.34;ctx.fillStyle="#eef0ef";
    ctx.beginPath();
    ctx.moveTo(15,0);ctx.lineTo(-7,-8);ctx.lineTo(-3,0);ctx.lineTo(-7,8);
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
}

function drawTrack(){
  stroke(track,"#172022",W*.108);
  stroke(track,"#d5cfbd",W*.096);
  stroke(track,"#3f4649",W*.076);
  stroke(track,"#70777a",Math.max(1.5,W*.0018),[W*.01,W*.01]);
  drawKerbs();drawArrows();drawStartFinish();
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
  ctx.beginPath();ctx.ellipse(0,9,24,9,0,0,Math.PI*2);ctx.fill();

  if(Math.abs(car.slip)>.10){
    ctx.globalAlpha=.48;
    ctx.fillStyle="#eef0ee";
    ctx.beginPath();ctx.arc(-23,-7,7,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(-29,7,5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.fillStyle="#e10600";
  ctx.beginPath();ctx.roundRect(-20,-10,40,20,6);ctx.fill();
  ctx.fillStyle="#20262a";
  ctx.beginPath();ctx.roundRect(-8,-8,16,16,4);ctx.fill();
  ctx.fillStyle="#fff";
  ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);
  ctx.fillStyle="#111";
  ctx.fillRect(-12,-12,7,5);ctx.fillRect(7,-12,7,5);
  ctx.fillRect(-12,7,7,5);ctx.fillRect(7,7,7,5);
  ctx.restore();
}

function draw(){
  terrain();drawTrees();drawTrack();drawUserPath();drawCar();
}

function startDraw(e){
  if(racing)return;
  const p=pos(e),start=track[0];

  if(dist(p,start)>W*.085){
    statusEl.textContent="Érintsd meg a zöld START/CÉL kaput a rajzolás megkezdéséhez";
    return;
  }

  drawing=true;
  path=[p];
  samples=[];
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
  const p=pos(e),now=performance.now();
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

function endDraw(e){
  if(!drawing)return;
  drawing=false;
  try{canvas.releasePointerCapture(e.pointerId)}catch(_){}

  if(path.length<30){
    raceBtn.disabled=true;
    statusEl.textContent="Túl rövid útvonal — rajzold körbe az egész oválist";
    return;
  }

  const startDist=dist(path[0],track[0]);
  const endDist=dist(path[path.length-1],track[0]);

  // We only require that the line starts and finishes at the official gate.
  // There is deliberately NO fragile comparison against a theoretical ellipse
  // circumference. The actual drawn polyline is the race route.
  if(startDist>W*.085){
    raceBtn.disabled=true;
    statusEl.textContent="A rajzolt útvonalnak a START kapuból kell indulnia";
    return;
  }

  if(endDist>W*.085){
    raceBtn.disabled=true;
    statusEl.textContent="Még nem értél körbe — vezesd vissza a vonalat a CÉL-hoz";
    return;
  }

  raceBtn.disabled=false;
  statusEl.textContent="KÉSZ — nyomd meg a VERSENY gombot";
  draw();
}

/*
  Build the race route directly from the player's path.
  Every segment carries the exact finger speed measured while drawing it.
*/
function buildRaceRoute(){
  const route=[];
  if(path.length<2)return route;

  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const d=dist(a,b);
    const n=Math.max(1,Math.ceil(d/3));
    const v=samples[i]?samples[i].v:(samples.at(-1)?.v||220);

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
    x:last.x,y:last.y,
    v:clamp(samples.at(-1)?.v||220,15,1400)
  });

  return route;
}

function startRace(){
  if(racing)return;
  if(!path||path.length<30){
    statusEl.textContent="Előbb rajzold meg a teljes útvonalat";
    return;
  }

  raceRoute=buildRaceRoute();

  if(raceRoute.length<2){
    statusEl.textContent="Nem sikerült létrehozni a versenyvonalat — rajzold újra";
    return;
  }

  // The car becomes visible IMMEDIATELY when VERSENY is pressed.
  const a=raceRoute[0],b=raceRoute[1];

  car={
    x:a.x,
    y:a.y,
    a:Math.atan2(b.y-a.y,b.x-a.x),
    speed:Math.max(15,a.v),
    slip:0
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

  // Directly follow the speed recorded from the finger for this part.
  let target=a.v;

  // Turbo temporarily multiplies the exact drawn speed.
  if(turboHeld&&turbo>0)target*=1.5;

  // Very light smoothing: enough to avoid pointer jitter, but still closely
  // follows the drawing speed.
  const response=0.68;
  car.speed+=((target-car.speed)*Math.min(1,response*dt/16.666));

  const segment=dist(a,b);
  progress+=(car.speed*dt/1000)/Math.max(.25,segment);

  const i=Math.min(Math.floor(progress),raceRoute.length-2);
  const u=progress-i;
  const p=raceRoute[i],q=raceRoute[i+1];

  car.x=p.x+(q.x-p.x)*u;
  car.y=p.y+(q.y-p.y)*u;

  const ang=Math.atan2(q.y-p.y,q.x-p.x);
  let da=ang-car.a;
  while(da>Math.PI)da-=Math.PI*2;
  while(da<-Math.PI)da+=Math.PI*2;

  // Smoothly rotate toward the direction of the player's drawn line.
  car.a+=da*Math.min(1,.72*dt/16.666);

  // Small visual drift when the drawn line turns sharply at speed.
  const prev=raceRoute[Math.max(0,i-8)];
  const next=raceRoute[Math.min(raceRoute.length-1,i+8)];
  const aa=Math.atan2(next.y-prev.y,next.x-prev.x);
  let turn=aa-ang;
  while(turn>Math.PI)turn-=Math.PI*2;
  while(turn<-Math.PI)turn+=Math.PI*2;

  const stress=Math.min(1,Math.abs(turn)*car.speed/500);
  car.slip+=(stress-car.slip)*Math.min(1,.12*dt/16.666);
  car.x+=(-Math.sin(ang))*car.slip*W*.035;
  car.y+=( Math.cos(ang))*car.slip*W*.035;
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

// Buttons are bound directly in JS. No inline handler is required.
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

// Drawing input.
canvas.addEventListener("pointerdown",startDraw,{passive:false});
canvas.addEventListener("pointermove",moveDraw,{passive:false});
canvas.addEventListener("pointerup",endDraw,{passive:false});
canvas.addEventListener("pointercancel",endDraw,{passive:false});
canvas.addEventListener("contextmenu",e=>e.preventDefault());

resize();
window.addEventListener("load",resize);
