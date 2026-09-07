const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const stage=document.getElementById("stage"),statusEl=document.getElementById("status"),tip=document.getElementById("drawTip");
const raceBtn=document.getElementById("raceBtn"),turboBtn=document.getElementById("turboBtn"),clearBtn=document.getElementById("clearBtn");
const speedEl=document.getElementById("speed"),distanceEl=document.getElementById("distance"),timeEl=document.getElementById("time"),pointsEl=document.getElementById("points");

let W=1200,H=650,dpr=1,track=[],path=[],race=[];
let drawing=false,racing=false,finished=false,progress=0,startTime=0,lastTime=0,turboUntil=0;
let car={x:0,y:0,a:0};

const norm=[
[.08,.78],[.07,.54],[.15,.31],[.34,.22],[.55,.24],[.76,.16],[.91,.27],[.95,.49],
[.90,.68],[.75,.79],[.56,.79],[.43,.69],[.39,.54],[.46,.42],[.60,.37],[.75,.40],
[.82,.50],[.76,.59],[.61,.62],[.48,.61],[.32,.60],[.24,.67],[.25,.79],[.38,.88],
[.60,.90],[.79,.84],[.91,.72]
];

function P(x,y){return{x,y}}
function resize(){
 const r=stage.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);canvas.style.width=W+"px";canvas.style.height=H+"px";
 ctx.setTransform(dpr,0,0,dpr,0,0);buildTrack();draw();
}
function catmull(ps,n=10){
 const out=[];
 for(let i=0;i<ps.length-1;i++){
  const p0=ps[Math.max(0,i-1)],p1=ps[i],p2=ps[i+1],p3=ps[Math.min(ps.length-1,i+2)];
  for(let j=0;j<n;j++){const t=j/n,t2=t*t,t3=t2*t;
   out.push(P(.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)*W,
              .5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)*H));
  }
 }
 out.push(P(ps.at(-1)[0]*W,ps.at(-1)[1]*H));return out;
}
function buildTrack(){track=catmull(norm,11)}
function line(points,color,width,dash=[]){
 if(points.length<2)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();
}
function tangent(i){const a=track[Math.max(0,i-1)],b=track[Math.min(track.length-1,i+1)];return Math.atan2(b.y-a.y,b.x-a.x)}
function offset(i,dist){
 const a=tangent(i);return P(track[i].x-Math.sin(a)*dist,track[i].y+Math.cos(a)*dist);
}
function terrain(){
 ctx.fillStyle="#58734e";ctx.fillRect(0,0,W,H);
 for(let i=0;i<75;i++){const x=(i*193+31)%W,y=(i*117+22)%H;
  ctx.fillStyle=i%2?"#65805a":"#4e6a48";ctx.beginPath();ctx.ellipse(x,y,25+(i%4)*13,15+(i%3)*9,(i%5)*.35,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle="#3f5941";ctx.beginPath();ctx.moveTo(0,H*.22);ctx.lineTo(W*.12,H*.05);ctx.lineTo(W*.23,H*.19);ctx.lineTo(W*.39,H*.04);ctx.lineTo(W*.54,H*.19);ctx.lineTo(W*.69,H*.06);ctx.lineTo(W*.83,H*.19);ctx.lineTo(W,H*.07);ctx.lineTo(W,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
}
function tree(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle="#263b28";ctx.fillRect(-3,8,6,14);
 for(let i=0;i<3;i++){ctx.fillStyle=i?"#315335":"#213d29";ctx.beginPath();ctx.moveTo(0,-25+i*10);ctx.lineTo(-14+i*2,8+i*4);ctx.lineTo(14-i*2,8+i*4);ctx.closePath();ctx.fill()}ctx.restore()}
function drawTrees(){
 for(let i=0;i<28;i++){const x=(i*241+80)%W,y=(i*151+55)%H;tree(x,y,.7+(i%4)*.12)}
}
function drawKerbs(){
 // Proper continuous dashed kerbs along BOTH sides, offset from the road.
 for(let i=4;i<track.length-5;i+=5){
  const a=offset(i, W*.072),b=offset(i+2,W*.072),c=offset(i,-W*.072),d=offset(i+2,-W*.072);
  const ang1=Math.atan2(b.y-a.y,b.x-a.x),ang2=Math.atan2(d.y-c.y,d.x-c.x);
  const red=(Math.floor(i/5)%2===0);
  ctx.save();ctx.strokeStyle=red?"#e10600":"#f6f6f2";ctx.lineWidth=Math.max(9,W*.012);ctx.lineCap="butt";
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.strokeStyle=red?"#f6f6f2":"#e10600";ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.restore();
 }
}
function gate(i,label,finish){
 const p=track[i],a=tangent(i),half=Math.max(28,W*.045);
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a+Math.PI/2);
 if(finish){
  const s=7;for(let r=-2;r<3;r++)for(let c=-7;c<8;c++){ctx.fillStyle=(r+c)&1?"#111":"#fff";ctx.fillRect(c*s,r*s,s,s)}
 }else{
  ctx.fillStyle="#20d66a";ctx.globalAlpha=.22;ctx.fillRect(-half,-7,half*2,14);ctx.globalAlpha=1;
  ctx.strokeStyle="#20d66a";ctx.lineWidth=3;ctx.strokeRect(-half,-7,half*2,14);
 }
 ctx.restore();
 ctx.save();ctx.fillStyle=finish?"#fff":"#25df72";ctx.font=`900 ${Math.max(10,W*.012)}px system-ui`;ctx.textAlign="center";ctx.fillText(label,p.x,p.y-W*.058);ctx.restore();
}
function arrows(){
 // Direction arrows make the circuit unambiguous.
 for(const i of [18,48,78,108,138,168,198]){
  if(i>=track.length-2)continue;const p=track[i],a=tangent(i);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.globalAlpha=.55;ctx.fillStyle="#d9dde0";
  ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-8);ctx.lineTo(-3,0);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.restore();
 }
}
function drawTrack(){
 line(track,"#182023",W*.166); // bank
 line(track,"#c9c3af",W*.145); // shoulder
 line(track,"#42494c",W*.119); // asphalt
 line(track,"#606668",W*.006); // subtle center texture
 drawKerbs();arrows();gate(2,"START",false);gate(track.length-3,"CÉL",true);
}
function drawPath(){if(path.length>1){line(path,"#d9a91f",Math.max(7,W*.008));line(path,"#fff16a",Math.max(2,W*.0027))}}
function drawCar(){
 if(!racing&&!finished)return;ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);const s=Math.max(.72,Math.min(1.15,W/1100));ctx.scale(s,s);
 ctx.fillStyle="#0009";ctx.beginPath();ctx.ellipse(1,8,25,9,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#e10600";ctx.beginPath();ctx.roundRect(-21,-10,42,20,6);ctx.fill();
 ctx.fillStyle="#242a2e";ctx.beginPath();ctx.roundRect(-8,-8,17,16,4);ctx.fill();
 ctx.fillStyle="#fff";ctx.fillRect(12,-5,6,3);ctx.fillRect(12,2,6,3);
 ctx.fillStyle="#111";for(const q of [[-12,-12],[8,-12],[-12,7],[8,7]])ctx.fillRect(q[0],q[1],7,5);
 ctx.restore();
}
function draw(){terrain();drawTrees();drawTrack();drawPath();drawCar()}

function pos(e){const r=canvas.getBoundingClientRect();return P(e.clientX-r.left,e.clientY-r.top)}
function startDraw(e){
 if(racing)return;const p=pos(e),s=track[2];if(Math.hypot(p.x-s.x,p.y-s.y)>W*.095){statusEl.textContent="A zöld START mezőből indulj";return}
 drawing=true;path=[p];tip.style.display="none";pointsEl.textContent="1";statusEl.textContent="Rajzolás… vezesd a vonalat a kockás CÉL-ig";canvas.setPointerCapture?.(e.pointerId);draw()
}
function moveDraw(e){if(!drawing||racing)return;const p=pos(e),q=path.at(-1);if(Math.hypot(p.x-q.x,p.y-q.y)<2)return;path.push(p);pointsEl.textContent=path.length;draw()}
function endDraw(){
 if(!drawing)return;drawing=false;
 const f=track[track.length-3],d=Math.hypot(path.at(-1).x-f.x,path.at(-1).y-f.y);
 if(path.length<15){statusEl.textContent="Túl rövid ív — rajzold újra";raceBtn.disabled=true;return}
 if(d>W*.12){statusEl.textContent="Vezesd el a vonalat a kockás CÉLIG";raceBtn.disabled=true;draw();return}
 raceBtn.disabled=false;statusEl.textContent="Kész — indíthatod a versenyt";draw();
}
canvas.addEventListener("pointerdown",startDraw);canvas.addEventListener("pointermove",moveDraw);canvas.addEventListener("pointerup",endDraw);canvas.addEventListener("pointercancel",endDraw);canvas.addEventListener("contextmenu",e=>e.preventDefault());

function buildRace(){
 const out=[];for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/3));
  for(let j=0;j<n;j++){const u=j/n;out.push(P(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u))}
 }out.push(path.at(-1));return out;
}
function startRace(){
 if(racing||path.length<15)return;race=buildRace();if(race.length<2)return;
 racing=true;finished=false;progress=0;startTime=performance.now();lastTime=startTime;turboUntil=0;
 raceBtn.disabled=true;clearBtn.disabled=true;turboBtn.disabled=false;statusEl.textContent="VERSENY!";
 car={x:race[0].x,y:race[0].y,a:Math.atan2(race[1].y-race[0].y,race[1].x-race[0].x)};
 requestAnimationFrame(loop);
}
function loop(now){
 if(!racing)return;const dt=Math.min(50,now-lastTime);lastTime=now;const turbo=now<turboUntil?1.7:1;
 // Continuous distance-based interpolation: the car cannot get stuck on an integer index.
 const base=0.105*Math.max(1,Math.min(2,W/700));
 progress += base*turbo*(dt/16.666);
 if(progress>=race.length-1){progress=race.length-1;updateCar();finishRace();return}
 updateCar();
 const pct=progress/(race.length-1)*100;
 speedEl.textContent=Math.round(72+35*Math.sin(Math.min(1,pct/100)*Math.PI)+(turbo-1)*65);
 distanceEl.textContent=Math.round(pct);
 timeEl.textContent=((now-startTime)/1000).toFixed(2);
 draw();requestAnimationFrame(loop);
}
function updateCar(){
 const i=Math.floor(progress),u=progress-i,a=race[i],b=race[Math.min(i+1,race.length-1)];
 car.x=a.x+(b.x-a.x)*u;car.y=a.y+(b.y-a.y)*u;car.a=Math.atan2(b.y-a.y,b.x-a.x);
}
function finishRace(){racing=false;finished=true;turboBtn.disabled=true;clearBtn.disabled=false;speedEl.textContent="0";distanceEl.textContent="100";statusEl.textContent="CÉLBA ÉRTÉL 🏁";draw()}
function reset(){drawing=false;racing=false;finished=false;path=[];race=[];progress=0;raceBtn.disabled=true;turboBtn.disabled=true;clearBtn.disabled=false;statusEl.textContent="Rajzold meg az ideális versenyívet";speedEl.textContent="0";distanceEl.textContent="0";timeEl.textContent="0.00";pointsEl.textContent="0";tip.style.display="block";draw()}
function turbo(){if(racing)turboUntil=performance.now()+1200}
raceBtn.addEventListener("click",startRace);clearBtn.addEventListener("click",reset);turboBtn.addEventListener("pointerdown",turbo);
resize();
