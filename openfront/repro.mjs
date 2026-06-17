import http from "http"; import fs from "fs"; import path from "path";
import { chromium } from "playwright";
const ROOT="/home/user/OpenFrontIO/static";
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".bin":"application/octet-stream",".woff2":"font/woff2",".mp3":"audio/mpeg",".wasm":"application/wasm"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split("?")[0]);if(p==="/")p="/index.html";const f=path.join(ROOT,p);res.setHeader("Cross-Origin-Opener-Policy","same-origin");res.setHeader("Cross-Origin-Embedder-Policy","require-corp");res.setHeader("Cross-Origin-Resource-Policy","cross-origin");fs.readFile(f,(e,d)=>{if(e){res.statusCode=404;res.end("404");return;}res.setHeader("Content-Type",MIME[path.extname(f)]||"application/octet-stream");res.end(d);});});
await new Promise(r=>server.listen(0,r));const port=server.address().port;
const logs=[];const browser=await chromium.launch({args:["--no-sandbox"]});const page=await browser.newPage();
page.on("console",m=>{const t=m.text();if(/single player game|joining lobby|local server|prestart|game start|MapLoader|terrain|worker|initialized|map\.|\.bin|Error|fail/i.test(t))logs.push("C."+m.type()+":"+t.slice(0,160));});
page.on("pageerror",e=>logs.push("PAGEERR:"+e.message.slice(0,140)));
page.on("response",r=>{const u=r.url();if(/\.bin|worker|world\//i.test(u))logs.push("HTTP"+r.status()+" "+u.split("/").slice(-2).join("/"));});
try{
 await page.goto(`http://localhost:${port}/`,{waitUntil:"load"});await page.waitForTimeout(3500);
 const clickSolo=await page.evaluate(()=>{const acc=[];(function d(r){for(const el of r.querySelectorAll("*")){acc.push(el);if(el.shadowRoot)d(el.shadowRoot);}})(document);const el=acc.find(e=>e.tagName==="BUTTON"&&/^solo$/i.test((e.textContent||"").trim()));if(el){el.click();return true;}return false;});
 logs.push("solo clicked:"+clickSolo);await page.waitForTimeout(2500);
 const clickStart=await page.evaluate(()=>{const acc=[];(function d(r){for(const el of r.querySelectorAll("*")){acc.push(el);if(el.shadowRoot)d(el.shadowRoot);}})(document);const ob=acc.find(e=>e.tagName==="O-BUTTON"&&e.getAttribute("translationkey")==="single_modal.start");if(!ob)return "no o-button";const inner=ob.shadowRoot&&ob.shadowRoot.querySelector("button");(inner||ob).click();return "clicked";});
 logs.push("start:"+clickStart);
 await page.waitForTimeout(15000);
 const st=await page.evaluate(()=>{const acc=[];(function d(r){for(const el of r.querySelectorAll("*")){acc.push(el);if(el.shadowRoot)d(el.shadowRoot);}})(document);const gsm=acc.find(e=>e.tagName==="GAME-STARTING-MODAL");const canvas=document.querySelector("canvas");return {hasModal:!!gsm,modalHidden:gsm?gsm.classList.contains("hidden"):null,canvas:!!canvas};});
 logs.push("STATE:"+JSON.stringify(st));
}catch(e){logs.push("ERR:"+e.message.slice(0,150));}
console.log(logs.join("\n"));await browser.close();server.close();
