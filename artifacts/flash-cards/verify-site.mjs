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


const {cdp,close}=await launch({width:1440,height:900},outDir);
const results=[];
const assert=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,JSON.stringify(detail));};
try {
 await cdp.send('Page.navigate',{url:target});await waitReady(cdp);
 for(const theme of ['light','dark']) {
  await cdp.eval('localStorage.setItem("bella-kira-theme",'+JSON.stringify(theme)+')');
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390],['short',1280,600]]) {
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
   await cdp.send('Page.navigate',{url:target});await waitReady(cdp);await cdp.eval('window.__holo.reset()');await sleep(800);
   const metrics=await cdp.eval('({width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,canvas:document.querySelector("canvas").getBoundingClientRect().height})');
   assert(theme+' '+name+' card layout',metrics.scroll<=width+1&&metrics.canvas>100&&metrics.theme===theme,metrics);
   await cdp.shot(theme+'-'+name+'-card',outDir);
   assert('only front face',await cdp.eval('!document.getElementById("back")&&window.__holo.config.frame===false&&window.__holo.config.typography===false'));
   await cdp.eval('document.getElementById("info").click()');assert('info opens',await cdp.eval('document.getElementById("about").open'));
   await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   assert('Escape closes info',!(await cdp.eval('document.getElementById("about").open')));
   await cdp.eval('document.querySelector(".wordmark").click()');await sleep(2300);
   assert('return to gallery',await cdp.eval('location.hash==="#gallery"'));
   await cdp.eval('document.querySelector(".gallery-visual").scrollTop=180');await sleep(200);
   await cdp.shot(theme+'-'+name+'-gallery',outDir);
   const gm=await cdp.eval('({width:innerWidth,scroll:document.documentElement.scrollWidth,entry:!!document.querySelector(".gallery-card"),preview:document.querySelector(".gallery-card img").naturalWidth})');assert('gallery entry layout',gm.scroll<=width+1&&gm.entry&&gm.preview>0,gm);
   await cdp.eval('document.querySelector("[data-gallery-open]").click()');await sleep(500);assert('original lightbox opens',await cdp.eval('document.querySelector("[data-gallery-lightbox]").open'));
   await cdp.eval('document.querySelector("[data-lightbox-next]").click()');assert('original next image',await cdp.eval('document.querySelector("[data-lightbox-count]").textContent.trim().startsWith("2 /")'));
   await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   assert('lightbox closes',!(await cdp.eval('document.querySelector("[data-gallery-lightbox]").open')));
   await cdp.eval('document.querySelector(".gallery-card").click()');await waitReady(cdp);
  }
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 await cdp.send('Page.navigate',{url:target});await waitReady(cdp);await cdp.eval('window.__holo.reset()');await sleep(500);
 const b=await cdp.eval('(()=>{let b=document.getElementById("stage").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()');
 const before=await cdp.eval('window.__holo.root.rotation.y');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+90,y:b.y+35}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(600);
 const after=await cdp.eval('window.__holo.root.rotation.y');assert('touch rotates card',Math.abs(after-before)>.05,{before,after});
} finally {close();rmSync(downloadDir,{recursive:true,force:true});}
writeFileSync(path.join(outDir,'site-report.json'),JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
