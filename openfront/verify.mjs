// Real in-browser verification: spawn a solo game, toggle a feature, MEASURE.
import http from "http"; import fs from "fs"; import path from "path";
import { chromium } from "playwright";
const ROOT="/home/user/OpenFrontIO/static";
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".bin":"application/octet-stream",".woff2":"font/woff2",".mp3":"audio/mpeg",".wasm":"application/wasm"};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p==="/")p="/index.html";r.setHeader("Cross-Origin-Opener-Policy","same-origin");r.setHeader("Cross-Origin-Embedder-Policy","require-corp");fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end("x");}r.setHeader("Content-Type",MIME[path.extname(p)]||"application/octet-stream");r.end(d);});});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const b=await chromium.launch({args:["--no-sandbox"]});
const pg=await b.newPage();
pg.on("pageerror",e=>console.log("PAGEERR:",e.message.slice(0,120)));
const deepClick=(rx,excl)=>pg.evaluate(([rs,ex])=>{const r=new RegExp(rs,"i");const x=ex?new RegExp(ex,"i"):null;const a=[];(function d(n){for(const e of n.querySelectorAll("*")){a.push(e);if(e.shadowRoot)d(e.shadowRoot);}})(document);const el=a.find(e=>{const t=(e.textContent||"").trim();return r.test(t)&&(!x||!x.test(t))&&(e.tagName==="BUTTON"||e.tagName==="O-BUTTON"||/btn|button/i.test(e.className||""))&&t.length<22;});if(el){(el.shadowRoot?.querySelector("button")||el).click();return (el.textContent||"").trim().slice(0,20);}return null;},[rx,excl]);
const myTerritory=()=>pg.evaluate(()=>{const a=[];(function d(n){for(const e of n.querySelectorAll("*")){a.push(e);if(e.shadowRoot)d(e.shadowRoot);}})(document);
  // find leaderboard row flagged as my player; scrape a percentage
  let best=null;
  for(const e of a){const t=(e.textContent||"");const m=t.match(/(\d+(?:\.\d+)?)\s*%/);if(m&&/you|my/i.test(e.className||"")){best=parseFloat(m[1]);}}
  if(best===null){ // fallback: any percentage in a leaderboard-ish element
    for(const e of a){const cl=(e.className||"")+"";if(/leader|player/i.test(cl)){const m=(e.textContent||"").match(/(\d+(?:\.\d+)?)\s*%/);if(m){best=parseFloat(m[1]);break;}}}
  }
  return best;
});
try{
  await pg.goto("http://localhost:"+port+"/",{waitUntil:"load"}); await pg.waitForTimeout(3500);
  console.log("solo:", await deepClick("single ?player|solo"));
  await pg.waitForTimeout(2000);
  console.log("start:", await deepClick("start game|^start$|^play$","gold|troop|build|timer|auto"));
  await pg.waitForTimeout(6000);
  // SPAWN: click around canvas center to place starting tile
  const box=await pg.evaluate(()=>{const c=document.querySelector("canvas");if(!c)return null;const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  if(box){ for(const [fx,fy] of [[0.5,0.5],[0.45,0.55],[0.55,0.45],[0.5,0.6]]){ await pg.mouse.click(box.x+box.w*fx, box.y+box.h*fy); await pg.waitForTimeout(800);} }
  await pg.waitForTimeout(6000);
  const t0=await myTerritory();
  console.log("territory T0:", t0);
  // enable Auto Expand
  console.log("autoexpand toggle:", await deepClick("auto expand"));
  await pg.waitForTimeout(45000);
  const t1=await myTerritory();
  console.log("territory T1 (after 45s auto-expand):", t1);
  console.log("RESULT grew:", (t0!=null&&t1!=null)?(t1>t0?("YES "+t0+"->"+t1):("NO "+t0+"->"+t1)):"could not measure");
}catch(e){console.log("ERR:",e.message.slice(0,160));}
await b.close(); server.close();
