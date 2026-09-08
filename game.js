const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const stage=document.getElementById("stage"),controls=document.getElementById("controls");
const statusEl=document.getElementById("status"),tip=document.getElementById("drawTip");
const raceBtn=document.getElementById("raceBtn"),turboBtn=document.getElementById("turboBtn"),clearBtn=document.getElementById("clearBtn");
const speedEl=document.getElementById("speed"),distanceEl=document.getElementById("distance"),timeEl=document.getElementById("time"),pointsEl=document.getElementById("points");
const turboFill=document.getElementById("turboFill"),turboLabel=document.getElementById("turboLabel");

let W=1,H=1,dpr=1,lastW=0,lastH=0,track=[],path=[],race=[];
let drawing=false,racing=false,finished=false,progress=0,startTime=0,lastTime=0;
let turbo=100,turboHeld=false;
let car={x:0,y:0,a:0,_speed:0,slip:0};
let drawSamples=[],lastDrawTime=0;

function P(x,y){return{x,y}}
function resize(){
 const r=stage.getBoundingClientRect(),nw=Math.max(1,Math.round(r.width)),nh=Math.max(1,Math.round(r.height));
 if(nw===lastW&&nh===lastH)return;
 lastW=nw;lastH=nh;W=nw;H=nh;dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 buildTrack();draw();
}
new ResizeObserver(resize).observe(stage);

/* One closed, non-crossing circuit. The centerline winds around the whole play area;
   the green infield/outfield is visible between every part of the road. */
const shape=[
 [.08,.80],[.08,.65],[.10,.51],[.08,.36],[.12,.22],[.23,.13],[.38,.11],
 [.53,.13],[.67,.11],[.82,.15],[.91,.25],[.92,.39],[.88,.49],[.78,.51],
 [.68,.48],[.61,.41],[.66,.33],[.78,.31],[.87,.34],[.92,.28],[.90,.18],
 [.81,.10],[.64,.09],[.52,.15],[.43,.10],[.28,.09],[.16,.15],[.10,.26],
 [.14,.38],[.21,.44],[.29,.41],[.35,.34],[.41,.39],[.43,.49],[.39,.59],
 [.31,.64],[.23,.61],[.17,.56],[.12,.61],[.11,.72],[.08,.80]
];
function catmull(ps,steps=7){
 const out=[];
 for(let i=0;i<ps.length-1;i++){
  const p0=ps[Math.max(0,i-1)],p1=ps[i],p2=ps[i+1],p3=ps[Math.min(ps.length-1,i+2)];
  for(let j=0;j<steps;j++){const t=j/steps,t2=t*t,t3=t2*t;
   const x=.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
   const y=.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
   out.push(P(x*W,y*H));
  }
 }out.push(P(ps.at(-1)[0]*W,ps.at(-1)[1]*H));return out;
}
function buildTrack(){track=catmull(shape,7)}
function line(points,color,width,dash=[]){
 if(points.length<2)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();
}
function tangent(i){const a=track[Math.max(0,i-3)],b=track[Math.min(track.length-1,i+3)];return Math.atan2(b.y-a.y,b.x-a.x)}
function sidePoint(i,side){const a=tangent(i),d=W*.073,p=track[i];return P(p.x-Math.sin(a)*d*side,p.y+Math.cos(a)*d*side)}

function terrain(){
 ctx.fillStyle="#5e7b53";ctx.fillRect(0,0,W,H);
 for(let i=0;i<30;i++){const x=(i*237+41)%W,y=(i*149+33)%H;ctx.fillStyle=i%2?"#6b855e":"#526e4b";ctx.beginPath();ctx.ellipse(x,y,18+(i%4)*11,11+(i%3)*7,(i%5)*.3,0,Math.PI*2);ctx.fill()}
}
function tree(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle="#263c29";ctx.fillRect(-3,7,6,13);for(let i=0;i<3;i++){ctx.fillStyle=i?"#315335":"#203d28";ctx.beginPath();ctx.moveTo(0,-24+i*10);ctx.lineTo(-13+i*2,8+i*4);ctx.lineTo(13-i*2,8+i*4);ctx.closePath();ctx.fill()}ctx.restore()}
function drawTrees(){for(let i=0;i<17;i++)tree((i*277+61)%W,(i*181+46)%H,.72+(i%3)*.12)}
function drawKerbs(){
 for(let i=4;i<track.length-4;i+=4)for(const side of[-1,1]){
  const p=sidePoint(i,side),a=tangent(i),len=Math.max(8,W*.011);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
  ctx.fillStyle=(Math.floor(i/4)%2===0)?"#e10600":"#f5f5ef";ctx.fillRect(-len/2,-4,len,8);ctx.restore();
 }
}
function gate(i,finish){
 const p=track[i],a=tangent(i),half=Math.max(28,W*.043);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a+Math.PI/2);
 if(finish){const s=6;for(let r=-3;r<4;r++)for(let c=-7;c<8;c++){ctx.fillStyle=(r+c)&1?"#111":"#fff";ctx.fillRect(c*s,r*s,s,s)}}
 else{ctx.fillStyle="#20dc6b";ctx.globalAlpha=.2;ctx.fillRect(-half,-7,half*2,14);ctx.globalAlpha=1;ctx.strokeStyle="#20dc6b";ctx.lineWidth=3;ctx.strokeRect(-half,-7,half*2,14)}
 ctx.restore();ctx.save();ctx.fillStyle=finish?"#fff":"#20dc6b";ctx.font=`900 ${Math.max(10,W*.012)}px system-ui`;ctx.textAlign="center";ctx.fillText(finish?"CÉL":"START",p.x,p.y-W*.055);ctx.restore();
}
function arrows(){for(const i of[25,55,85,115,145,175,205,235]){if(i>=track.length-3)continue;const p=track[i],a=tangent(i);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.globalAlpha=.45;ctx.fillStyle="#e1e5e6";ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-7,-7);ctx.lineTo(-3,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore()}}
function drawTrack(){line(track,"#192123",W*.166);line(track,"#c9c4b1",W*.145);line(track,"#3f4649",W*.119);line(track,"#606668",Math.max(2,W*.003));drawKerbs();arrows();gate(2,false);gate(track.length-3,true)}
function drawPath(){if(path.length>1){line(path,"#d7a91e",Math.max(7,W*.008));line(path,"#fff06a",Math.max(2,W*.0027))}}
function drawCar(){if(!racing&&!finished)return;ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);const s=Math.max(.75,Math.min(1.25,W/1050));ctx.scale(s,s);ctx.fillStyle="#0009";ctx.beginPath();ctx.ellipse(1,8,24,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e10600";ctx.beginPath();ctx.roundRect(-20,-10,40,20,6);ctx.fill();ctx.fillStyle="#252a2e";ctx.beginPath();ctx.roundRect(-8,-8,16,16,4);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);ctx.fillStyle="#111";for(const q of[[-12,-12],[8,-12],[-12,7],[8,7]])ctx.fillRect(q[0],q[1],7,5);ctx.restore()}
function draw(){terrain();drawTrees();drawTrack();drawPath();drawCar()}

function pos(e){const r=canvas.getBoundingClientRect();return P(e.clientX-r.left,e.clientY-r.top)}
function startDraw(e){
 if(racing)return;
 const p=pos(e),s=track[2];if(Math.hypot(p.x-s.x,p.y-s.y)>W*.11){statusEl.textContent="A zöld START kapuból kell indulnod";return}
 drawing=true;path=[p];drawSamples=[];lastDrawTime=performance.now();tip.style.display="none";pointsEl.textContent="1";
 statusEl.textContent="Rajzolás… vezesd a vonalat a kockás CÉL-ig";canvas.setPointerCapture?.(e.pointerId);draw();e.preventDefault();
}
function moveDraw(e){
 if(!drawing||racing)return;const p=pos(e),q=path.at(-1),now=performance.now(),dt=Math.max(8,now-lastDrawTime),dist=Math.hypot(p.x-q.x,p.y-q.y);
 if(dist<2)return;path.push(p);drawSamples.push({pxPerSec:dist/(dt/1000)});lastDrawTime=now;pointsEl.textContent=path.length;draw();e.preventDefault();
}
function endDraw(e){
 if(!drawing)return;drawing=false;const f=track[track.length-3],d=Math.hypot(path.at(-1).x-f.x,path.at(-1).y-f.y);
 if(path.length<15){statusEl.textContent="Túl rövid ív — rajzold újra";raceBtn.disabled=true;return}
 if(d>W*.14){statusEl.textContent="A vonal végét vidd a kockás CÉL-hoz";raceBtn.disabled=true;draw();return}
 raceBtn.disabled=false;statusEl.textContent="Kész — indíthatod a versenyt";draw();
}

canvas.addEventListener("pointerdown",startDraw,{passive:false});canvas.addEventListener("pointermove",moveDraw,{passive:false});
canvas.addEventListener("pointerup",endDraw);canvas.addEventListener("pointercancel",endDraw);canvas.addEventListener("contextmenu",e=>e.preventDefault());

function buildRace(){const out=[];for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/3)),sample=drawSamples[Math.min(i,drawSamples.length-1)],userSpeed=sample?.pxPerSec||220;for(let j=0;j<n;j++){const u=j/n;out.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,userSpeed})}}out.push({x:path.at(-1).x,y:path.at(-1).y,userSpeed:drawSamples.at(-1)?.pxPerSec||220});return out}
function nearestTrackDistance(x,y){let best=Infinity;for(let i=0;i<track.length;i+=3)best=Math.min(best,Math.hypot(x-track[i].x,y-track[i].y));return best}
function routeCurvature(i){const n=race.length,step=Math.max(3,Math.floor(n*.012)),a=race[Math.max(0,i-step)],b=race[i],c=race[Math.min(n-1,i+step)],ab=Math.atan2(b.y-a.y,b.x-a.x),bc=Math.atan2(c.y-b.y,c.x-b.x);let da=bc-ab;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;const d=Math.max(1,Math.hypot(c.x-a.x,c.y-a.y));return Math.abs(da)/(d/100)}
function updateCar(){
 const idx=Math.min(Math.floor(progress),race.length-2),u=progress-idx,a=race[idx],b=race[idx+1],curv=routeCurvature(idx);
 let targetA=Math.atan2(b.y-a.y,b.x-a.x),safe=Math.max(.28,1.08-curv*.8),off=nearestTrackDistance(car.x,car.y),offFactor=off>W*.065?.45:1;
 const desired=Math.max(25,(a.userSpeed||220)*safe*offFactor),actual=car._speed+(desired-car._speed)*.075;car._speed=actual;
 progress+=(actual/Math.max(45,W*.05));
 let da=targetA-car.a;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
 const grip=Math.max(.06,Math.min(.25,1-curv*.25));car.a+=da*grip;
 const idealX=a.x+(b.x-a.x)*u,idealY=a.y+(b.y-a.y)*u,sideX=-Math.sin(targetA),sideY=Math.cos(targetA);
 car.slip+=(curv*actual/170-car.slip)*.05;
 car.x=idealX+sideX*car.slip*W*.12;car.y=idealY+sideY*car.slip*W*.12;
 return {actual,off}
}
function startRace(){
 if(racing||path.length<15||raceBtn.disabled)return;
 race=buildRace();if(race.length<2)return;progress=0;racing=true;finished=false;startTime=performance.now();lastTime=startTime;turbo=100;turboHeld=false;
 raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;statusEl.textContent="VERSENY!";updateTurboUI();
 car={x:race[0].x,y:race[0].y,a:Math.atan2(race[1].y-race[0].y,race[1].x-race[0].x),_speed:race[0].userSpeed||220,slip:0};requestAnimationFrame(loop);
}
function loop(now){
 if(!racing)return;const dt=Math.min(50,now-lastTime);lastTime=now;if(turboHeld&&turbo>0)turbo=Math.max(0,turbo-dt*.055);
 const state=updateCar(),pct=Math.min(100,progress/(race.length-1)*100);speedEl.textContent=Math.round(state.actual*.62);distanceEl.textContent=Math.round(pct);timeEl.textContent=((now-startTime)/1000).toFixed(2);updateTurboUI();draw();
 if(progress>=race.length-1){finishRace();return}requestAnimationFrame(loop);
}
function updateTurboUI(){turboFill.style.width=`${turbo}%`;turboLabel.textContent=`${Math.round(turbo)}%`;if(turbo<=0)turboBtn.disabled=true}
function finishRace(){progress=race.length-1;updateCar();racing=false;finished=true;turboHeld=false;turboBtn.disabled=true;clearBtn.disabled=false;speedEl.textContent="0";distanceEl.textContent="100";statusEl.textContent="CÉLBA ÉRTÉL 🏁";draw()}
function reset(){drawing=false;racing=false;finished=false;turboHeld=false;path=[];race=[];progress=0;turbo=100;raceBtn.disabled=true;turboBtn.disabled=true;clearBtn.disabled=false;statusEl.textContent="Indulj a zöld START kapuból";speedEl.textContent="0";distanceEl.textContent="0";timeEl.textContent="0.00";pointsEl.textContent="0";tip.style.display="block";updateTurboUI();draw()}

/* Explicit handlers for both mouse/pointer and touch-capable Android WebView/PWA.
   Buttons are outside the canvas, so drawing handlers can never swallow them. */
function bindButton(button,fn){
 button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();fn()});
 button.addEventListener("pointerup",e=>{e.stopPropagation()});
}
bindButton(raceBtn,startRace);bindButton(clearBtn,reset);
turboBtn.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();if(racing&&turbo>0)turboHeld=true});
turboBtn.addEventListener("pointerup",e=>{e.preventDefault();e.stopPropagation();turboHeld=false});
turboBtn.addEventListener("pointercancel",()=>turboHeld=false);

resize();window.addEventListener("load",resize);
