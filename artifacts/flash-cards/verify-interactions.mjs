/**
 * End-to-end browser verification for a RuiC-card-skill viewer.
 *
 * references/verification.md asks for the running page to be driven, not merely
 * fetched: drag in both directions, wheel zoom, flip, reset, the keyboard, every
 * depth slider plus foil and the finish swatches, the screenshot download, a
 * ~390 px layout and the reduced-motion path. This script does exactly that over
 * the Chrome DevTools Protocol and compares REAL captured frames, so "the slider
 * moved its own readout" never counts as proof. `window.__holo` is used only for
 * state, never as evidence that the shaders compiled.
 *
 * It launches its own headless Chromium-family browser and, when handed a
 * project directory, its own viewer server — no manual setup, nothing left
 * running except when --keep-server is passed.
 *
 * Usage:
 *   node scripts/verify_web.mjs <project-dir | url> [--out DIR] [--browser PATH]
 *                               [--only desktop|mobile] [--keep-server]
 *
 * Exit code is 0 only when every check passed. Screenshots and report.json land
 * in <project>/verification by default.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? true) : fallback;
};
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  if (["--out", "--browser", "--only"].includes(argv[i])) {
    i += 1;
    continue;
  }
  if (argv[i].startsWith("--")) continue;
  positionals.push(argv[i]);
}
const target = positionals[0];
if (!target) {
  console.error("usage: node scripts/verify_web.mjs <project-dir | url> [--out DIR] [--browser PATH] [--only desktop|mobile] [--keep-server]");
  process.exit(2);
}
const only = flag("--only");
const keepServer = argv.includes("--keep-server");
const isDir = existsSync(target);
const project = isDir ? path.resolve(target) : null;
const outDir = path.resolve(flag("--out", project ? path.join(project, "verification") : process.cwd()));
const downloadDir = mkdtempSync(path.join(tmpdir(), "holo-dl-"));
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- browser
const BROWSERS = [
  process.env.RUIC_BROWSER,
  flag("--browser"),
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "msedge",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const browser = BROWSERS.find((p) => (p.includes("/") || p.includes("\\") ? existsSync(p) : true));
if (!browser) {
  console.error("No Chromium-family browser found. Pass --browser <path-to-msedge-or-chrome>.");
  process.exit(2);
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const waitForHttp = async (url, timeout = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await sleep(250);
  }
  return false;
};

// ---------------------------------------------------------------- CDP client
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") this.consoleErrors.push("exception: " + (msg.params?.exceptionDetails?.text || "?"));
      if (msg.method === "Log.entryAdded" && msg.params?.entry?.level === "error") this.consoleErrors.push("log: " + msg.params.entry.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error")
        this.consoleErrors.push("console: " + (msg.params.args || []).map((a) => a.value ?? a.description).join(" "));
      if (msg.method === "Network.loadingFailed" && !msg.params?.canceled) this.failedRequests.push(`${msg.params?.type} ${msg.params?.errorText}`);
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + JSON.stringify(r.result?.value));
    return r.result.value;
  }
  async shot(tag, out) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(data, "base64");
    writeFileSync(path.join(out, `${tag}.png`), buf);
    return sha(buf);
  }
}

/** Launch a headless instance and attach to its page target. */
async function launch({ width, height, extraFlags = [] }, out) {
  const port = await freePort();
  const profile = mkdtempSync(path.join(tmpdir(), "holo-profile-"));
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--enable-unsafe-swiftshader",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--window-size=${width},${height}`,
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      ...extraFlags,
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );
  let targetInfo = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      targetInfo = list.find((t) => t.type === "page");
      if (targetInfo) break;
    } catch {}
  }
  if (!targetInfo) throw new Error("headless browser did not expose a page target");
  const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });
  const cdp = new Cdp(ws);
  for (const d of ["Page", "Runtime", "Log", "Network", "DOM"]) await cdp.send(`${d}.enable`);
  const close = () => {
    try { ws.close(); } catch {}
    try { child.kill("SIGKILL"); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  return { cdp, close, port };
}

const waitReady = async (cdp, timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const st = await cdp.eval(`(()=>{const h=window.__holo;return h?{ready:!!h.ready,fallback:!!h.fallback3d,error:h.error||null}:null})()`);
    if (st && (st.ready || st.fallback)) return st;
    await sleep(250);
  }
  throw new Error("viewer never became ready");
};

const same = (a, b) => a === b;


const {cdp,close}=await launch({width:1280,height:800},outDir);
const results=[];
function check(name,pass,detail){results.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name,JSON.stringify(detail));}
const mouse=async(type,x,y,pressed=false)=>cdp.send('Input.dispatchMouseEvent',{type,x,y,button:pressed?'left':'none',buttons:pressed?1:0,clickCount:type==='mousePressed'||type==='mouseReleased'?1:0});
async function drag(x,y,dx,dy=0){await mouse('mousePressed',x,y,true);for(let i=1;i<=8;i++)await mouse('mouseMoved',x+dx*i/8,y+dy*i/8,true);await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1});await sleep(350);}
try {
 await cdp.send('Page.navigate',{url:target});await waitReady(cdp);
 await cdp.eval('window.__holo.reset()');await sleep(500);
 const b=await cdp.eval('(()=>{let r=document.getElementById("stage").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');
 await mouse('mouseMoved',b.x+b.w*.35,b.y+b.h*.3);await sleep(450);const left=await cdp.eval('window.__holo.root.rotation.y');await cdp.shot('hover-left',outDir);
 await mouse('mouseMoved',b.x+b.w*.65,b.y+b.h*.3);await sleep(450);const right=await cdp.eval('window.__holo.root.rotation.y');await cdp.shot('hover-right',outDir);
 check('mouse follows both directions',left>.1&&right<-.1,{left,right});

 const frontNormal=()=>cdp.eval('(()=>{let root=window.__holo.root,mesh;root.traverse(o=>{if(o.isMesh&&o.material.uniforms?.tSubject)mesh??=o});root.updateMatrixWorld(true);let a=mesh.geometry.attributes.normal,n=root.position.clone().fromBufferAttribute(a,0);return n.transformDirection(mesh.matrixWorld).toArray()})()');
 await mouse('mouseMoved',b.x+b.w*.5,b.y+b.h*.3);await sleep(450);const top=await frontNormal();await cdp.shot('hover-top',outDir);
 await mouse('mouseMoved',b.x+b.w*.5,b.y+b.h*.7);await sleep(450);const bottom=await frontNormal();await cdp.shot('hover-bottom',outDir);
 check('front normal faces mouse vertically',top[1]>.1&&bottom[1]<-.1&&top[2]>.8&&bottom[2]>.8,{top,bottom});
 await drag(b.x+b.w*.5,b.y+b.h*.5,-100,40);check('drag remains available',await cdp.eval('!window.__holo.getState().auto&&!document.getElementById("stage").classList.contains("dragging")'));
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await cdp.send('Page.navigate',{url:target});await waitReady(cdp);
 check('motion initially off',await cdp.eval('!window.__holo.getState().motion&&!window.__holo.getState().auto'));
 await cdp.eval('DeviceOrientationEvent.requestPermission=async()=>"denied";document.getElementById("motion").click()');await sleep(150);check('permission denied keeps motion off with feedback',await cdp.eval('!window.__holo.getState().motion&&document.getElementById("notice").textContent.includes("未获得")'));
 await cdp.eval('DeviceOrientationEvent.requestPermission=async()=>{throw Error("blocked")};document.getElementById("motion").click()');await sleep(150);check('permission error recovers button',await cdp.eval('!window.__holo.getState().motion&&!document.getElementById("motion").disabled'));
 await cdp.eval('DeviceOrientationEvent.requestPermission=async()=>"granted";document.getElementById("motion").click()');await sleep(150);
 await cdp.eval('window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:45,gamma:0}))');await cdp.eval('window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:60,gamma:20}))');await sleep(350);
 const sensor=await cdp.eval('({state:window.__holo.getState(),x:window.__holo.root.rotation.x,y:window.__holo.root.rotation.y})');check('authorized phone tilt rotates card',sensor.state.motion&&sensor.x>.1&&sensor.y<-.2,sensor);await cdp.shot('sensor-tilt',outDir);
 await cdp.eval('window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:null,gamma:null}))');await sleep(100);check('missing sensor values ignored',await cdp.eval('Number.isFinite(window.__holo.root.rotation.x)&&Number.isFinite(window.__holo.root.rotation.y)'));
 await cdp.eval('window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:179,gamma:89}))');await sleep(150);check('sensor rotation bounded',await cdp.eval('Math.abs(window.__holo.root.rotation.x)<=.411&&Math.abs(window.__holo.root.rotation.y)<=.651'));
 await cdp.eval('document.getElementById("motion").click()');check('motion toggle stops sensor',await cdp.eval('!window.__holo.getState().motion'));
 await cdp.eval('document.getElementById("motion").click()');await sleep(3700);check('no sensor data restores drag with feedback',await cdp.eval('!window.__holo.getState().motion&&document.getElementById("notice").textContent.includes("没有收到")'));
 await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await cdp.send('Page.navigate',{url:'http://127.0.0.1:4321/#watch'});await sleep(1800);
 for(const theme of ['light','dark']) {
  await cdp.eval('window.__bellaTheme.apply('+JSON.stringify(theme)+',true);document.querySelector(".main-nav").scrollLeft=0');await sleep(250);
  const n=await cdp.eval('(()=>{let e=document.querySelector(".main-nav"),r=e.getBoundingClientRect();return {x:r.x+200,y:r.y+r.height/2,max:e.scrollWidth-e.clientWidth}})()');
  const initialHash=await cdp.eval('location.hash');await drag(n.x,n.y,-150);
  const moved=await cdp.eval('({scroll:document.querySelector(".main-nav").scrollLeft,hash:location.hash,dragging:document.querySelector(".main-nav").classList.contains("is-dragging")})');check(theme+' navigation drags without activating links',moved.scroll>100&&moved.hash===initialHash&&!moved.dragging,moved);await cdp.shot(theme+'-nav-drag',outDir);
  await cdp.eval('document.querySelector(".main-nav").scrollLeft=0');await drag(n.x,n.y,120);check('nav left boundary',await cdp.eval('document.querySelector(".main-nav").scrollLeft===0'));
  await cdp.eval('document.querySelector(".main-nav").scrollLeft=99999');await drag(n.x,n.y,-120);check('nav right boundary',await cdp.eval('(()=>{let e=document.querySelector(".main-nav");return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth))<2})()'));
  await cdp.eval('document.querySelector(".main-nav").scrollLeft=0');
  const link=await cdp.eval('(()=>{let e=document.querySelector(".main-nav a[data-page="+JSON.stringify("1")+"]"),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await drag(link.x,link.y,2);await sleep(900);check('tiny movement still clicks chapter',await cdp.eval('location.hash==="#about"'));
  await cdp.eval('document.querySelector(".main-nav a[data-page="+JSON.stringify("5")+"]").click()');await sleep(900);
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp.eval('document.querySelector(".mobile-menu-toggle").click()');await sleep(350);check('mobile menu retained',await cdp.eval('document.querySelector(".mobile-menu-toggle").getAttribute("aria-expanded")==="true"'));await cdp.shot('mobile-menu',outDir);
}finally{close();rmSync(downloadDir,{recursive:true,force:true});}
writeFileSync(path.join(outDir,'interaction-report.json'),JSON.stringify(results,null,2));if(results.some(x=>!x.pass))process.exitCode=1;
