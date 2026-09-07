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

let W=1,H=1,dpr=1,track=[];
let path=[],race=[];
let drawing=false,racing=false,finished=false;
let progress=0,startTime=0,lastTime=0,turboUntil=0;
let car={x:0,y:0,a:0};

function P(x,y){return{x,y}}
let lastW=0,lastH=0;
function resize(){
  const r=stage.getBoundingClientRect();
  const nw=Math.max(1,Math.round(r.width));
  const nh=Math.max(1,Math.round(r.height));
  if(nw===lastW && nh===lastH) return;
  lastW=nw;lastH=nh;W=nw;H=nh;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
  canvas.style.width="100%";canvas.style.height="100%";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildTrack();draw();
}
const ro=new ResizeObserver(()=>resize());
ro.observe(stage);

/* A deliberately simple, readable Alpine circuit:
   start/finish -> uphill sweep -> fast right -> tight hairpin ->
   long back straight -> S section -> final hairpin -> finish. */
const shape=[
 [.08,.76],[.07,.57],[.12,.38],[.25,.20],[.43,.13],[.63,.16],
 [.80,.10],[.91,.21],[.95,.39],[.94,.56],[.86,.69],
 [.72,.77],[.57,.73],[.47,.63],[.41,.51],[.34,.45],
 [.24,.49],[.19,.60],[.23,.72],[.37,.79],[.54,.82],
 [.70,.87],[.84,.91],[.92,.82],[.91,.70],[.84,.61],
 [.73,.54],[.62,.49],[.52,.43],[.45,.35],[.37,.28],
 [.26,.29],[.18,.39],[.14,.52],[.15,.67],[.22,.78],
 [.38,.88],[.58,.93],[.77,.88],[.90,.76]
];

function catmull(ps,steps=10){
 const out=[];
 for(let i=0;i<ps.length-1;i++){
  const p0=ps[Math.max(0,i-1)],p1=ps[i],p2=ps[i+1],p3=ps[Math.min(ps.length-1,i+2)];
  for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t;
   const x=.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
   const y=.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p0[1]-3*p2[1]+p3[1])*0);
   /* replace y with the proper Catmull-Rom expression */
   const yy=.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
   out.push(P(x*W,yy*H));
  }
 }
 const q=ps[ps.length-1];out.push(P(q[0]*W,q[1]*H));return out;
}
function buildTrack(){track=catmull(shape,10)}

function line(points,color,width,dash=[]){
 if(points.length<2)return;
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();
}
function tangent(i){
 const a=track[Math.max(0,i-2)],b=track[Math.min(track.length-1,i+2)];
 return Math.atan2(b.y-a.y,b.x-a.x);
}
function sidePoint(i,side){
 const a=tangent(i),d=W*.073,p=track[i];
 return P(p.x-Math.sin(a)*d*side,p.y+Math.cos(a)*d*side);
}

function terrain(){
 ctx.fillStyle="#5e7a53";ctx.fillRect(0,0,W,H);
 // restrained landscape texture, deliberately outside the racing surface
 for(let i=0;i<46;i++){
  const x=(i*233+47)%W,y=(i*137+31)%H;
  ctx.fillStyle=i%2?"#6b855e":"#526e4a";
  ctx.beginPath();ctx.ellipse(x,y,20+(i%4)*12,12+(i%3)*8,(i%5)*.3,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle="#405a42";
 ctx.beginPath();ctx.moveTo(0,H*.23);ctx.lineTo(W*.13,H*.05);ctx.lineTo(W*.27,H*.20);
 ctx.lineTo(W*.40,H*.07);ctx.lineTo(W*.54,H*.19);ctx.lineTo(W*.69,H*.04);
 ctx.lineTo(W*.83,H*.18);ctx.lineTo(W,H*.07);ctx.lineTo(W,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
}
function tree(x,y,s){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 ctx.fillStyle="#263b28";ctx.fillRect(-3,7,6,14);
 for(let i=0;i<3;i++){ctx.fillStyle=i?"#315335":"#203d28";ctx.beginPath();ctx.moveTo(0,-24+i*10);ctx.lineTo(-13+i*2,8+i*4);ctx.lineTo(13-i*2,8+i*4);ctx.closePath();ctx.fill()}
 ctx.restore();
}
function drawTrees(){
 for(let i=0;i<23;i++){const x=(i*251+70)%W,y=(i*157+48)%H;tree(x,y,.72+(i%3)*.12)}
}

function drawKerbs(){
 // Continuous short kerb blocks following the road edges. No floating squares.
 for(let i=5;i<track.length-4;i+=4){
   const len=Math.max(9,W*.012),gap=2;
   for(const side of [-1,1]){
     const p=sidePoint(i,side),a=tangent(i);
     ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
     ctx.fillStyle=(Math.floor(i/4)%2===0)?"#e10600":"#f4f4ef";
     ctx.fillRect(-len/2,-4,len,8);ctx.restore();
   }
 }
}
function gate(i,finish){
 const p=track[i],a=tangent(i),half=Math.max(28,W*.045);
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a+Math.PI/2);
 if(finish){
   const s=6;for(let r=-3;r<4;r++)for(let c=-7;c<8;c++){ctx.fillStyle=(r+c)&1?"#111":"#fff";ctx.fillRect(c*s,r*s,s,s)}
 }else{
   ctx.fillStyle="#20dc6b";ctx.globalAlpha=.2;ctx.fillRect(-half,-7,half*2,14);ctx.globalAlpha=1;
   ctx.strokeStyle="#20dc6b";ctx.lineWidth=3;ctx.strokeRect(-half,-7,half*2,14);
 }
 ctx.restore();
 ctx.save();ctx.fillStyle=finish?"#fff":"#20dc6b";ctx.font=`900 ${Math.max(10,W*.012)}px system-ui`;ctx.textAlign="center";
 ctx.fillText(finish?"CÉL":"START",p.x,p.y-W*.055);ctx.restore();
}
function directionArrows(){
 for(const i of [22,58,94,130,166,202]){
  if(i>=track.length-3)continue;
  const p=track[i],a=tangent(i);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.globalAlpha=.5;ctx.fillStyle="#dce1e2";
  ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-7);ctx.lineTo(-3,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
 }
}
function drawTrack(){
 line(track,"#192123",W*.166);
 line(track,"#c9c4b1",W*.145);
 line(track,"#3f4649",W*.119);
 line(track,"#606668",Math.max(2,W*.003));
 drawKerbs();directionArrows();
 gate(2,false);gate(track.length-3,true);
}
function drawPath(){
 if(path.length<2)return;
 line(path,"#d7a91e",Math.max(7,W*.008));
 line(path,"#fff06a",Math.max(2,W*.0027));
}
function drawCar(){
 if(!racing&&!finished)return;
 ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);
 const s=Math.max(.75,Math.min(1.25,W/1050));ctx.scale(s,s);
 ctx.fillStyle="#0009";ctx.beginPath();ctx.ellipse(1,8,24,9,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#e10600";ctx.beginPath();ctx.roundRect(-20,-10,40,20,6);ctx.fill();
 ctx.fillStyle="#252a2e";ctx.beginPath();ctx.roundRect(-8,-8,16,16,4);ctx.fill();
 ctx.fillStyle="#fff";ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);
 ctx.fillStyle="#111";for(const q of [[-12,-12],[8,-12],[-12,7],[8,7]])ctx.fillRect(q[0],q[1],7,5);
 ctx.restore();
}
function draw(){terrain();drawTrees();drawTrack();drawPath();drawCar()}

function pos(e){const r=canvas.getBoundingClientRect();return P(e.clientX-r.left,e.clientY-r.top)}
function startDraw(e){
 if(racing)return;
 const p=pos(e),s=track[2];
 if(Math.hypot(p.x-s.x,p.y-s.y)>W*.10){statusEl.textContent="A zöld START kapuból kell indulnod";return}
 drawing=true;path=[p];tip.style.display="none";pointsEl.textContent="1";
 statusEl.textContent="Rajzolás… vezesd a vonalat a kockás CÉL-ig";
 canvas.setPointerCapture?.(e.pointerId);draw();
}
function moveDraw(e){
 if(!drawing||racing)return;
 const p=pos(e),q=path[path.length-1];
 if(Math.hypot(p.x-q.x,p.y-q.y)<2)return;
 path.push(p);pointsEl.textContent=path.length;draw();
}
function endDraw(){
 if(!drawing)return;drawing=false;
 const f=track[track.length-3],d=Math.hypot(path.at(-1).x-f.x,path.at(-1).y-f.y);
 if(path.length<15){statusEl.textContent="Túl rövid ív — rajzold újra";raceBtn.disabled=true;return}
 if(d>W*.12){statusEl.textContent="A vonal végét vidd a kockás CÉL-hoz";raceBtn.disabled=true;draw();return}
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
  const a=path[i],b=path[i+1],d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/3));
  for(let j=0;j<n;j++){const u=j/n;out.push(P(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u))}
 }
 out.push(path[path.length-1]);return out;
}
function startRace(){
 if(racing||path.length<15)return;
 race=buildRace();progress=0;racing=true;finished=false;
 startTime=performance.now();lastTime=startTime;turboUntil=0;
 raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;statusEl.textContent="VERSENY!";
 car={x:race[0].x,y:race[0].y,a:Math.atan2(race[1].y-race[0].y,race[1].x-race[0].x)};
 requestAnimationFrame(loop);
}
function updateCar(){
 const i=Math.min(Math.floor(progress),race.length-2),u=progress-i,a=race[i],b=race[i+1];
 car.x=a.x+(b.x-a.x)*u;car.y=a.y+(b.y-a.y)*u;car.a=Math.atan2(b.y-a.y,b.x-a.x);
}
function loop(now){
 if(!racing)return;
 const dt=Math.min(50,now-lastTime);lastTime=now;
 const turbo=now<turboUntil?1.7:1;
 // Progress is continuous and independent of path point count.
 progress += 0.42*turbo*(dt/16.666);
 updateCar();
 const pct=progress/(race.length-1)*100;
 speedEl.textContent=Math.round(75+(turbo-1)*65);
 distanceEl.textContent=Math.min(100,Math.round(pct));
 timeEl.textContent=((now-startTime)/1000).toFixed(2);
 draw();
 if(progress>=race.length-1){finishRace();return}
 requestAnimationFrame(loop);
}
function finishRace(){
 progress=race.length-1;updateCar();racing=false;finished=true;
 turboBtn.disabled=true;clearBtn.disabled=false;speedEl.textContent="0";distanceEl.textContent="100";
 statusEl.textContent="CÉLBA ÉRTÉL 🏁";draw();
}
function reset(){
 drawing=false;racing=false;finished=false;path=[];race=[];progress=0;
 raceBtn.disabled=true;turboBtn.disabled=true;clearBtn.disabled=false;
 statusEl.textContent="Indulj a zöld START kapuból";
 speedEl.textContent="0";distanceEl.textContent="0";timeEl.textContent="0.00";pointsEl.textContent="0";
 tip.style.display="block";draw();
}
turboBtn.addEventListener("pointerdown",()=>{if(racing)turboUntil=performance.now()+1200});
raceBtn.addEventListener("click",startRace);
clearBtn.addEventListener("click",reset);
resize();
window.addEventListener('load',resize);
