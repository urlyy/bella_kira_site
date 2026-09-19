import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const url = process.argv[2] || "http://127.0.0.1:4321/cards/gallery-005/";
const out = path.resolve(process.argv[3] || "artifacts/flash-cards/verification/pointer");
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(out, "chrome-"));
const browser = spawn(
	process.env.RUIC_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	[
		"--headless=new", "--enable-unsafe-swiftshader", "--disable-gpu",
		"--no-sandbox",
		"--disable-breakpad", "--disable-crash-reporter", "--noerrdialogs",
		"--no-first-run", "--no-default-browser-check",
		`--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
	],
	{ stdio: ["ignore", "ignore", "pipe"] },
);
const results = [];
let ws;
try {
	const endpoint = await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(Error("Chrome startup timed out")), 10000);
		browser.once("error", reject);
		browser.once("exit", (code) => {
			clearTimeout(timeout);
			reject(Error(`Chrome exited: ${code}`));
		});
		browser.stderr.on("data", (data) => {
			const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
			if (match) {
				clearTimeout(timeout);
				resolve(match[1]);
			}
		});
	});
	const origin = new URL(endpoint);
	const pages = await (await fetch(`http://${origin.host}/json/list`)).json();
	ws = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		ws.addEventListener("open", resolve, { once: true });
		ws.addEventListener("error", reject, { once: true });
	});
	let sequence = 0;
	const pending = new Map();
	const errors = [];
	ws.addEventListener("message", ({ data }) => {
		const message = JSON.parse(data);
		if (pending.has(message.id)) {
			const { resolve, reject, timeout } = pending.get(message.id);
			pending.delete(message.id);
			clearTimeout(timeout);
			message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
		}
		if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => {
		const id = ++sequence;
		const timeout = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 30000);
		pending.set(id, { resolve, reject, timeout });
		ws.send(JSON.stringify({ id, method, params }));
	});
	const evaluate = async (expression) => {
		const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
		if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
		return result.result.value;
	};
	const check = (name, pass, detail) => {
		results.push({ name, pass: !!pass, detail });
		console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(detail ?? ""));
	};
	const shot = async (name) => {
		const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
		const buffer = Buffer.from(data, "base64");
		writeFileSync(path.join(out, `${name}.png`), buffer);
		return buffer;
	};
	const ready = (fallback = false) => evaluate(`new Promise((resolve,reject) => {
		const start = performance.now();
		function frame() {
			if (window.__holo?.${fallback ? "fallback3d" : "ready"}) return resolve(true);
			if (performance.now()-start>12000) return reject(Error(window.__holo?.error || "not ready"));
			requestAnimationFrame(frame);
		}
		frame();
	})`);
	const navigate = async (target) => {
		const loaded = new Promise((resolve, reject) => {
			const timer = setTimeout(() => { ws.removeEventListener("message", listener); reject(Error("navigation timed out")); },15000);
			const listener = ({data}) => {
				if (JSON.parse(data).method !== "Page.loadEventFired") return;
				clearTimeout(timer);
				ws.removeEventListener("message", listener);
				resolve();
			};
			ws.addEventListener("message", listener);
		});
		await send("Page.navigate", {url: target});
		await loaded;
	};
	const settle = () => evaluate(`new Promise((resolve, reject) => {
		let previous, stable = 0;
		const started = performance.now();
		function frame() {
			const root = window.__holo.root;
			const next = [root.rotation.x, root.rotation.y];
			stable = previous && next.every((v, i) => Math.abs(v - previous[i]) < .00015) ? stable + 1 : 0;
			previous = next;
			if (stable >= 3) return resolve(true);
			if (performance.now() - started > 8000) return reject(Error("rotation did not settle"));
			requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	})`);
	const probe = () => evaluate(`(() => {
		const h = window.__holo;
		let front;
		h.root.traverse(o => {
			if (o.isMesh && o.material.name === "web_front") front = o;
		});
		const normal = h.root.position.clone().fromBufferAttribute(front.geometry.attributes.normal, 0).transformDirection(front.matrixWorld);
		const corner = (x, y) => h.root.position.clone().set(x, y, 0).applyMatrix4(h.root.matrixWorld).project(h.camera);
		const tl = corner(-3.15, 4.725), tr = corner(3.15, 4.725);
		const bl = corner(-3.15, -4.725), br = corner(3.15, -4.725);
		const stage = document.querySelector('[data-card="stage"]');
		const viewportAspect = stage.clientWidth / stage.clientHeight;
		const edge = (a, b) => Math.hypot((a.x-b.x)*viewportAspect, a.y-b.y);
		return { normal: normal.toArray(), rotation: [h.root.rotation.x, h.root.rotation.y],
			camera: h.camera.type, topWidth: edge(tl,tr), bottomWidth: edge(bl,br),
			state: h.getState(), shaders: h.renderer.info.programs.every(p => p.diagnostics?.runnable !== false) };
	})()`);
	const point = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
	const click = async (selector) => {
		const { x, y } = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2}; })()`);
		await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
		await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
	};
	const key = async (key, code = key) => {
		const virtual = {Home:36,End:35,Escape:27,Tab:9,ArrowRight:39,ArrowLeft:37,ArrowUp:38,ArrowDown:40}[key];
		await send("Input.dispatchKeyEvent", {type: "keyDown", key, code, windowsVirtualKeyCode:virtual});
		await send("Input.dispatchKeyEvent", {type: "keyUp", key, code, windowsVirtualKeyCode:virtual});
	};
	const verifyPrint = async (label) => {
		const samples = await evaluate(`(() => {
			const h = window.__holo;
			const rect = document.querySelector('[data-card="stage"]').getBoundingClientRect();
			const samples = [];
			for(let row=0;row<9;row++) for(let col=0;col<7;col++) {
				const u = .03+col*.94/6, v = .03+row*.94/8;
				const p = h.root.position.clone().set((u-.5)*6.3,(.5-v)*9.45,0).applyMatrix4(h.root.matrixWorld).project(h.camera);
				samples.push({u,v,x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2});
			}
			return {samples,asset: h.config.assets.subject};
		})()`);
		const frame = await sharp(await shot(label)).removeAlpha().raw().toBuffer({resolveWithObject:true});
		const sourcePath = path.join("public", decodeURIComponent(new URL(samples.asset,url).pathname));
		const source = await sharp(sourcePath).flatten({background:"#f6f3ed"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
		const rgb = (raw,x,y) => {
			x=Math.max(0,Math.min(raw.info.width-1,Math.round(x)));
			y=Math.max(0,Math.min(raw.info.height-1,Math.round(y)));
			const i=(y*raw.info.width+x)*raw.info.channels;
			return [...raw.data.subarray(i,i+3)];
		};
		const differences = samples.samples.map(({u,v,x,y}) => {
			const expected=rgb(source,u*source.info.width-.5,v*source.info.height-.5);
			const actual=rgb(frame,x,y);
			return expected.reduce((sum,c,i)=>sum+Math.abs(c-actual[i]),0)/3;
		});
		const mean = differences.reduce((a,b)=>a+b,0)/differences.length;
		check(`${label} print stays registered with artwork`,mean<19,{meanRGBError:mean,samples:differences.length});
	};
	await send("Page.enable");
	await send("Runtime.enable");
	await send("Network.enable");
	if (!process.env.GALLERY_ONLY) {
	for (const [mode, width, height, mobile] of [
		["desktop", 1280, 800, false],
		["mobile", 390, 844, true],
		["landscape", 844, 390, true],
	]) {
		await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
		for (const theme of ["light", "dark"]) {
			await send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("bella-kira-theme", ${JSON.stringify(theme)})` });
			await navigate(url);
			await ready();
			check(`${mode} ${theme} header has no action buttons`, await evaluate(`document.querySelectorAll(".masthead button").length === 0`));
			check(`${mode} ${theme} has no depth controls`, await evaluate(`!document.getElementById("parameter-panel") && !document.getElementById("depth-toggle")`));
			const bounds = await evaluate(`(() => { const r = document.querySelector('[data-card="stage"]').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
			const positions = mobile ? [["top", 0, -0.4], ["bottom", 0, 0.4]] : [
				["top-left", -0.4, -0.4], ["top", 0, -0.4], ["top-right", 0.4, -0.4],
				["left", -0.4, 0], ["center", 0, 0], ["right", 0.4, 0],
				["bottom-left", -0.4, 0.4], ["bottom", 0, 0.4], ["bottom-right", 0.4, 0.4],
			];
			for (const [name, x, y] of positions) {
				await point(bounds.x + bounds.w * (0.5 + x / 2), bounds.y + bounds.h * (0.5 + y / 2));
				await settle();
				const state = await probe();
				const [nx, ny, nz] = state.normal;
				check(`${mode} ${theme} ${name} front follows cursor`,
					(x ? nx * x > 0.015 : Math.abs(nx) < 0.01) &&
					(y ? ny * -y > 0.015 : Math.abs(ny) < 0.01) && nz > 0.8 && state.shaders, state);
				if (name === "top" || name === "bottom") {
					check(`${mode} ${theme} ${name} has visible perspective`,
						y * (state.topWidth - state.bottomWidth) > 0.003, state.camera);
					await shot(`${mode}-${theme}-${name}`);
				}
			}
			check(`${mode} ${theme} fits viewport`, await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
		}
	}
	// Rendering checks across the square and narrowest available source formats.
	for (const id of ["gallery-005", "gallery-022", "gallery-000"]) {
		for (const [mode,width,height,mobile] of [["desktop",1280,800,false],["mobile",390,844,true],["landscape",844,390,true]]) {
			await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
			for (const theme of ["light","dark"]) {
				await send("Page.addScriptToEvaluateOnNewDocument",{source:`localStorage.setItem("bella-kira-theme",${JSON.stringify(theme)})`});
				await navigate(new URL(`/cards/${id}/`,url).href);
				await ready();
				await point(width*.5,height*.5);
				await settle();
				// Choose the neutral finish before entering the compact landscape layout.
				if(mode==="landscape") await send("Emulation.setDeviceMetricsOverride",{width:844,height:800,deviceScaleFactor:1,mobile});
				await click('[data-finish="original"]');
				if(mode==="landscape") {
					await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
					const bounds=await evaluate(`document.querySelector('[data-card="stage"]').getBoundingClientRect().toJSON()`);
					await point(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
					await settle();
				}
				await verifyPrint(`${id}-${mode}-${theme}`);
				if(id==="gallery-005" && mode==="desktop" && theme==="light") {
					for (const x of [.2,.8]) {
						await point(width*x,height*.5);
						await settle();
						await verifyPrint(`fixed-print-tilt-${x}`);
					}
					const states = [];
					for (const finish of ["pearl","silver","gold","original"]) {
						await click(`[data-finish="${finish}"]`);
						await settle();
						check(`${finish} switches material`,await evaluate(`window.__holo.getState().finish===${JSON.stringify(finish)}`));
						const {data} = await sharp(await shot(`paper-${finish}`)).raw().toBuffer({resolveWithObject:true});
						states.push(data);
					}
					check("foil produces visible reflection",states[0].reduce((sum,c,i)=>sum+Math.abs(c-states[3][i]),0)/states[0].length>.15);
					check("original disables foil control",await evaluate(`document.querySelector('[data-card="foil"]').disabled`));
					await click('[data-finish="pearl"]');
					await click('[data-card="foil"]');
					await key("End");
					check("gloss range changes shader",await evaluate(`window.__holo.uniforms.uFoil.value===1`));
					await key("Home");
					check("gloss range can reach zero",await evaluate(`window.__holo.uniforms.uFoil.value===0`));
					await click('[data-card="stage"]');
					await key("r","KeyR");
					await settle();
					await key("ArrowRight");
					await settle();
					check("keyboard turns paper",await evaluate(`window.__holo.root.rotation.y>-.08`));
					const shape = await evaluate(`(() => {
						const h=window.__holo, meshes=[];
						h.root.traverse(o=>{if(o.isMesh)meshes.push({role:o.material.name,vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3})});
						return meshes;
					})()`);
					const frontShape=shape.find(m=>m.role==="web_front");
					check("export has softened corners and closed paper sides",frontShape?.vertices>4&&frontShape.vertices<=32&&shape.some(m=>m.role==="web_edge"&&m.triangles===frontShape.vertices*2),shape);
				}
				if(mode==="mobile" && theme==="dark") {
					await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
					await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:width*.5,y:height*.5}]});
					await send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:width*.65,y:height*.55}]});
					await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
					await settle();
					check(`${id} touch rotates card`,await evaluate(`window.__holo.root.rotation.y>.1`));
					await shot(`${id}-touch`);
					await send("Emulation.setTouchEmulationEnabled",{enabled:false});
				}
			}
		}
	}
	}
	const home = new URL("/#gallery",url).href;
	const homeReady = () => evaluate(`new Promise((resolve,reject)=> {
		const started=performance.now();
		function frame(){
			const r=document.querySelector(".gallery-card").getBoundingClientRect();
			const target=document.elementFromPoint(r.x+r.width/2,(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2);
			if(target?.closest(".gallery-card"))return resolve(true);
			if(performance.now()-started>25000)return reject(Error("gallery is covered: "+target?.className));
			requestAnimationFrame(frame);
		}frame();
	})`);
	const scrollIntoView = async selector => {
		const {root} = await send("DOM.getDocument");
		const {nodeId} = await send("DOM.querySelector",{nodeId:root.nodeId,selector});
		await send("DOM.scrollIntoViewIfNeeded",{nodeId});
	};
	const modal = '[data-gallery-card-dialog]';
	const modalStage = `${modal} [data-card="stage"]`;
	const closed = () => evaluate(`new Promise((resolve,reject) => {
		const started=performance.now();
		function frame() {
			if(document.querySelector('[data-gallery-card-dialog]')?.open===false && !window.__holo && !document.querySelector('[data-gallery-card-dialog] canvas,.fallback3d')) return resolve(true);
			if(performance.now()-started>2000) return reject(Error("viewer was not released"));
			requestAnimationFrame(frame);
		} frame();
	})`);
	for (const [mode,width,height,mobile] of [["desktop",1280,800,false],["mobile",390,844,true],["landscape",844,390,true],["short",1280,560,false]]) {
		await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
		for (const theme of ["light","dark"]) {
			await send("Page.addScriptToEvaluateOnNewDocument",{source:`localStorage.setItem("bella-kira-theme",${JSON.stringify(theme)})`});
			await navigate(home);
			await homeReady();
			check(`${mode} ${theme} gallery defers renderer`,await evaluate(`!window.__holo && !document.querySelector('[data-gallery-card-dialog] canvas') && !performance.getEntriesByType("resource").some(e=>e.name.includes("/flash-cards/")&&e.name.includes("card-config"))`));
			const scroll=await evaluate(`document.querySelector(".gallery-visual").scrollTop`);
			await click(".gallery-card");
			await ready();
			await point(width/2,height/2);
			await settle();
			check(`${mode} ${theme} preview stays in gallery`,await evaluate(`location.hash==="#gallery" && document.querySelector('[data-gallery-card-dialog]').open`));
			const sizing=await evaluate(`(() => {
				const h=window.__holo,s=document.querySelector('[data-card="stage"]').getBoundingClientRect();
				const visibleHeight=9.45*s.height/(2*h.camera.position.z*Math.tan(h.camera.fov*Math.PI/360));
				return {cardHeight:visibleHeight,stageHeight:s.height,stageWidth:s.width,aspect:h.config.cardAspect,viewportHeight:innerHeight,dialog:document.querySelector('[data-gallery-card-dialog]').getBoundingClientRect().toJSON()};
			})()`);
			check(`${mode} ${theme} card has margins`,sizing.cardHeight<=621 && sizing.cardHeight<=sizing.stageHeight*.81 && sizing.cardHeight*sizing.aspect<=sizing.stageWidth*.81,sizing);
			await shot(`gallery-${mode}-${theme}`);
			if(mode==="desktop" && theme==="light") {
				const current=await evaluate(`window.__holo.config.assets.subject`);
				for(let i=0;i<3;i++) await click(`${modal} [data-card-next]`);
				await ready();
				check("rapid next keeps one current card",await evaluate(`document.querySelectorAll('[data-gallery-card-dialog] canvas').length===1 && window.__holo.config.assets.subject!==${JSON.stringify(current)}`));
				for(let i=0;i<3;i++) await click(`${modal} [data-card-previous]`);
				await ready();
				check("previous returns to the same card",await evaluate(`window.__holo.config.assets.subject===${JSON.stringify(current)}`));
				await click(`${modal} [data-card="foil"]`);
				await key("ArrowRight");
				check("range keys do not change home chapter",await evaluate(`location.hash==="#gallery" && document.querySelector('[data-gallery-card-dialog]').open`));
				await click(modalStage);
				await key("ArrowDown");
				await settle();
				check("rotation keys stay inside modal",await evaluate(`location.hash==="#gallery" && document.querySelector('[data-gallery-card-dialog]').open`));
			}
			if(mode==="mobile") {
				await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
				await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:width*.5,y:height*.5}]});
				await send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:width*.7,y:height*.55}]});
				await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
				await settle();
				check(`${theme} modal touch rotates without chapter swipe`,await evaluate(`location.hash==="#gallery" && window.__holo.root.rotation.y>.1`));
				await send("Emulation.setTouchEmulationEnabled",{enabled:false});
			}
			await key("Escape");
			await closed();
			check(`${mode} ${theme} close restores focus and scroll`,await evaluate(`document.activeElement.matches(".gallery-card") && Math.abs(document.querySelector(".gallery-visual").scrollTop-${scroll})<1`));
			await click(".gallery-card");
			await ready();
			await click("[data-card-close]");
			await closed();
			check(`${mode} ${theme} reopen and close release viewer`,true);
			await scrollIntoView("[data-gallery-open]");
			await click("[data-gallery-open]");
			check(`${mode} ${theme} original still opens separately`,await evaluate(`document.querySelector('[data-gallery-lightbox]').open && !window.__holo`));
			await key("Escape");
		}
	}
	await send("Network.setBlockedURLs",{urls:["*flash-cards*card-config.json*"]});
	await click(".gallery-card");
	await evaluate(`new Promise((resolve,reject)=>{const started=performance.now();function frame(){if(document.querySelector('[data-flash-card-viewer]').dataset.state==="error")return resolve(true);if(performance.now()-started>5000)return reject(Error("no error UI"));requestAnimationFrame(frame)}frame()})`);
	check("failed config has in-place retry and Bella feedback",await evaluate(`!!document.querySelector('[data-card="loading"] button') && !document.querySelector('[data-card="notice"]').hidden`));
	await shot("gallery-error");
	await send("Network.setBlockedURLs",{urls:[]});
	await click('[data-card="loading"] button');
	await ready();
	check("retry recovers without leaving gallery",await evaluate(`location.hash==="#gallery" && window.__holo.ready`));
	await key("Escape");
	await closed();
	// Delay config traffic, close while loading, then ensure the late response cannot remount.
	await send("Network.emulateNetworkConditions",{offline:false,latency:350,downloadThroughput:-1,uploadThroughput:-1});
	await click(".gallery-card");
	await click("[data-card-close]");
	await closed();
	await send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
	await click(".gallery-card");
	await ready();
	check("closing a pending load allows clean reopen",await evaluate(`document.querySelectorAll('[data-gallery-card-dialog] canvas').length===1`));
	await key("Escape");
	await closed();
	await send("Emulation.setEmulatedMedia", { features: [{name: "prefers-reduced-motion", value: "reduce"}] });
	await navigate(url);
	await ready();
	check("reduced motion disables automatic movement", await evaluate(`!window.__holo.getState().auto`));
	await send("Page.addScriptToEvaluateOnNewDocument", { source: `const getContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.includes("webgl") ? null : getContext.call(this, type, ...args); };` });
	await navigate(url);
	await ready(true);
	check("fallback renders without removed buttons", await evaluate(`!!document.querySelector(".front3d img") && document.querySelectorAll(".masthead button").length === 0`));
	check("fallback has four thin paper edges",await evaluate(`document.querySelectorAll(".paper-edge3d").length === 4`));
	await shot("fallback-no-toolbar");
	await navigate(home);
	await homeReady();
	await click(".gallery-card");
	await ready(true);
	await shot("gallery-fallback");
	await key("Escape");
	await closed();
	check("fallback modal closes and releases its animation",true);
	check("no runtime errors", errors.length === 0, errors);
} finally {
	ws?.close();
	const closed = browser.exitCode !== null || browser.signalCode !== null
		? Promise.resolve()
		: new Promise((resolve) => browser.once("close", resolve));
	browser.kill("SIGKILL");
	await closed;
	rmSync(profile, { recursive: true, force: true });
	writeFileSync(path.join(out, "report.json"), JSON.stringify(results, null, 2));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
