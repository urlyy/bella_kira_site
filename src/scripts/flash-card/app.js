import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Icons are inline data trees (icons.data.js) — zero sub-imports at runtime,
// so no ad/privacy blocker can kill the page by blocking an icon module.
import { ICON_TREES } from "./icons.data.js";
const icons = ICON_TREES;

// A viewer owns its listeners, animation, async loads and GPU resources.
// The gallery and standalone route use the same disposable instance.
export function mountFlashCard(host, configUrl) {
	let dispose;
	const retry = () => {
		dispose?.();
		dispose = createViewer(host, configUrl, retry);
	};
	retry();
	return () => dispose?.();
}

function createViewer(host, configUrl, retry) {
	const $ = (id) => host.querySelector(`[data-card="${id}"]`);
	const stage = $("stage");
	const lifetime = new AbortController();
	const resources = new Set();
	const observers = [];
	let disposed = false,
		animationFrame = 0,
		loadTimer,
		diagnostic;
	const on = (target, type, callback, options = {}) =>
		target.addEventListener(type, callback, {
			...options,
			signal: lifetime.signal,
		});
	const own = (resource) => {
		if (disposed) resource.dispose();
		else resources.add(resource);
		return resource;
	};
	const active = () => {
		if (disposed) throw new DOMException("Viewer closed", "AbortError");
	};
	const observe = (callback) => {
		const observer = new ResizeObserver(callback);
		observers.push(observer);
		observer.observe(stage);
	};
	const publish = (value) => {
		diagnostic = value;
		window.__holo = value;
		host.dataset.state = value.ready
			? "ready"
			: value.fallback3d
				? "fallback"
				: "error";
	};
	host.dataset.state = "loading";
	$("loading").hidden = false;
	$("loading").classList.remove("error");
	$("loading").setAttribute("role", "status");
	$("loading").textContent = "正在载入闪卡";
	$("notice").hidden = true;
	host.querySelectorAll("button,input").forEach((el) => (el.disabled = true));
	const media = matchMedia("(prefers-reduced-motion: reduce)");
	const scene = new THREE.Scene();
	// Perspective makes opposite tilts visibly distinct; orthographic projection
	// gives them the same outline and can make the front appear to lean backwards.
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
	camera.position.set(0, 0, 20);
	let renderer,
		root,
		uniforms,
		config,
		lastTime = 0,
		elapsed = 0;
	let motionActive = false,
		motionOrigin = null,
		motionTimer;
	let auto = false,
		dragging = false,
		finish = "pearl",
		zoom = 1;
	let targetX = -0.035,
		targetY = -0.15,
		lastPointer = { x: 0, y: 0 },
		noticeTimer;
	const settings = [["foil", "uFoil"]];
	const vertex = `
varying vec2 vUv;
varying vec3 vPosition, vNormal, vTangent;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vPosition = viewPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  vTangent = normalize((modelViewMatrix * vec4(1.,0.,0.,0.)).xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;
	const common = `
precision highp float;
varying vec2 vUv;
varying vec3 vPosition, vNormal, vTangent;
uniform float uFoil, uFinish, uAspect;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
vec3 spectrum(float phase) {
  return .60 + .36 * cos(6.28318 * (phase + vec3(0., .33, .67)));
}
float strength() { return abs(uFinish - 2.0) < 0.05 ? 0. : uFoil; }
vec3 linearPrint(vec3 color) {
  return mix(color / 12.92, pow((color + .055) / 1.055, vec3(2.4)), step(vec3(.04045),color));
}
`;
	const frontFragment =
		common +
		`
uniform sampler2D tArtwork;
void main() {
  // One print, fixed to the four corners. Viewing angle never changes its UVs.
  vec4 art = texture2D(tArtwork, vUv);
  vec3 col = linearPrint(mix(vec3(.965,.954,.932),art.rgb,art.a));
  vec3 N = normalize(vNormal);
  vec3 T = normalize(vTangent);
  vec3 B = normalize(cross(N,T));
  vec3 V = normalize(-vPosition);
  // A stationary studio softbox, expressed in camera space.
  vec3 L = normalize(vec3(-7.,9.,-5.) - vPosition);
  vec3 H = normalize(V+L);
  vec3 localView = vec3(dot(V,T),dot(V,B),max(dot(N,V),0.));

  // Fine paper tooth stays attached to the sheet. Both scales are filtered
  // against the pixel footprint, so tilting does not turn grain into moire.
  vec2 grainUv = vUv * vec2(uAspect,1.) * 650.;
  float grainFilter = 1.-smoothstep(.45,1.8,max(fwidth(grainUv.x),fwidth(grainUv.y)));
  float grain = (noise(grainUv)-.5)*grainFilter;
  vec2 fibreUv = grainUv*.38;
  float fibreFilter = 1.-smoothstep(.45,1.8,max(fwidth(fibreUv.x),fwidth(fibreUv.y)));
  float fibre = (noise(fibreUv)-.5)*fibreFilter;
  N = normalize(N + T*(noise(grainUv+19.)-.5)*.13*grainFilter
                  + B*(noise(grainUv+47.)-.5)*.13*grainFilter);
  float ndv = max(dot(N,V),0.);
  float ndl = max(dot(N,L),0.);
  float roughness = .34 + grain*.18 + fibre*.06;
  float exponent = 2./(roughness*roughness)-2.;
  float specular = pow(max(dot(N,H),0.),exponent);
  float fresnel = .04 + .96*pow(1.-max(dot(V,H),0.),5.);
  float coating = specular * fresnel * (1. + grain*.65);
  col *= (.94 + .06*ndl) * (1. + fibre*.032 + grain*.022);
  col += vec3(1.,.97,.91) * coating * .8;

  // Foil changes reflection, not the ink or card perimeter.
  float amount = strength();
  float phase = vUv.x*.85 + vUv.y*.55 + localView.x*1.5-localView.y*.9;
  vec3 foil = spectrum(phase);
  if (uFinish > 2.5) foil = mix(vec3(.72,.39,.10),vec3(1.,.86,.49),.5+.5*sin(phase*6.28318));
  else if (uFinish > .5) foil = vec3(.91,.94,.97);
  float band = pow(.5+.5*sin((vUv.x*.72+vUv.y*.45+localView.x*1.2+localView.y*.6)*6.28318),8.);
  float reflection = amount * (specular*.12 + band*.19) * (1.+grain*.7);
  col *= 1. - amount*.20*(1.-foil)*(.2+.8*band);
  col += foil*reflection;
  vec2 cell = floor(grainUv);
  float flake = step(.986,hash(cell))*pow(.5+.5*sin(hash(cell+8.)*30.+localView.x*20.+localView.y*12.),10.);
  col += foil*flake*amount*.075*grainFilter;
  gl_FragColor = vec4(clamp(col,0.,1.),1.);
  #include <colorspace_fragment>
}
`;
	const edgeFragment =
		common +
		`
void main() {
  vec3 L = normalize(vec3(-7.,9.,-5.)-vPosition);
  float diffuse = .62 + .38*max(dot(normalize(vNormal),L),0.);
  // Warm, matte cut paper. No metallic tint or luminous outline.
  vec3 col = linearPrint(vec3(.91,.895,.86))*diffuse;
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
}
`;

	// Render a lucide node tree (["svg", attrs, [children]]) into an svg element.
	function renderIconNode(node) {
		const [tag, attrs = {}, children = []] = node;
		const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (const [key, value] of Object.entries(attrs))
			el.setAttribute(key, value);
		for (const child of children) el.appendChild(renderIconNode(child));
		return el;
	}
	function refreshIcons() {
		const overrides = { "stroke-width": 1.5 };
		// icons.data.js is keyed in PascalCase (Play, RotateCcw, SlidersHorizontal …) while
		// the markup uses lucide's hyphenated names (play, rotate-ccw, sliders-horizontal).
		// Looking the raw attribute up never matched, so no icon ever rendered.
		const pascal = (name) =>
			name
				.split("-")
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join("");
		host.querySelectorAll("[data-lucide]").forEach((el) => {
			const name = el.getAttribute("data-lucide");
			const tree = icons[name] || icons[pascal(name)];
			if (!tree) return;
			const [tag, defaults = {}, children = []] = tree;
			const svg = renderIconNode([
				tag,
				{ ...defaults, ...overrides },
				children,
			]);
			el.replaceChildren(svg);
		});
	}
	function notice(message) {
		if (disposed) return;
		clearTimeout(noticeTimer);
		$("notice-message").textContent = message;
		$("notice").hidden = false;
		noticeTimer = setTimeout(() => ($("notice").hidden = true), 2600);
	}
	function stopMotion() {
		motionActive = false;
		motionOrigin = null;
		clearTimeout(motionTimer);
		window.removeEventListener("deviceorientation", followOrientation);
		$("motion").setAttribute("aria-pressed", "false");
		$("motion").textContent = "开启陀螺仪";
	}
	function followOrientation(event) {
		if (
			!motionActive ||
			document.hidden ||
			dragging ||
			!Number.isFinite(event.beta) ||
			!Number.isFinite(event.gamma)
		)
			return;
		const angle = screen.orientation?.angle ?? window.orientation ?? 0;
		if (!motionOrigin || motionOrigin.angle !== angle) {
			const first = !motionOrigin;
			motionOrigin = { beta: event.beta, gamma: event.gamma, angle };
			clearTimeout(motionTimer);
			if (first) notice("陀螺仪已开启，轻轻倾斜手机");
		}
		const radians = (angle * Math.PI) / 180;
		const beta = ((event.beta - motionOrigin.beta + 540) % 360) - 180;
		const gamma = event.gamma - motionOrigin.gamma;
		targetX = THREE.MathUtils.clamp(
			(beta * Math.cos(radians) + gamma * Math.sin(radians)) * 0.017,
			-0.41,
			0.41,
		);
		targetY = THREE.MathUtils.clamp(
			-(gamma * Math.cos(radians) - beta * Math.sin(radians)) * 0.024,
			-0.65,
			0.65,
		);
	}
	function setupMotion() {
		$("motion").onclick = async () => {
			if (motionActive) {
				stopMotion();
				notice("陀螺仪已关闭");
				return;
			}
			if (!window.isSecureContext || !window.DeviceOrientationEvent) {
				notice("当前浏览器无法开启陀螺仪，请使用 HTTPS 或触摸拖动");
				return;
			}
			const button = $("motion");
			button.disabled = true;
			try {
				if (
					typeof DeviceOrientationEvent.requestPermission ===
						"function" &&
					(await DeviceOrientationEvent.requestPermission()) !==
						"granted"
				) {
					notice("未获得陀螺仪权限，仍可触摸拖动");
					return;
				}
				active();
				setAuto(false);
				motionActive = true;
				motionOrigin = null;
				button.setAttribute("aria-pressed", "true");
				button.textContent = "关闭陀螺仪";
				window.addEventListener("deviceorientation", followOrientation);
				motionTimer = setTimeout(() => {
					if (motionActive && !motionOrigin) {
						stopMotion();
						notice("没有收到手机姿态数据，仍可触摸拖动");
					}
				}, 3500);
			} catch {
				if (disposed) return;
				stopMotion();
				notice("无法开启陀螺仪，仍可触摸拖动");
			} finally {
				if (!disposed) button.disabled = false;
			}
		};
	}
	async function init() {
		refreshIcons();
		const response = await fetch(configUrl, { signal: lifetime.signal });
		if (!response.ok) throw Error("作品配置未找到");
		config = await response.json();
		active();
		setupMotion();
		try {
			renderer = new THREE.WebGLRenderer({
				antialias: true,
				alpha: false,
				preserveDrawingBuffer: true,
				powerPreference: "high-performance",
			});
		} catch (error) {
			// First retry with the most permissive context attributes — some setups
			// reject "high-performance" but accept the default.
			try {
				renderer = new THREE.WebGLRenderer({
					antialias: true,
					alpha: false,
					preserveDrawingBuffer: true,
					powerPreference: "default",
					failIfMajorPerformanceCaveat: false,
				});
			} catch (retryError) {
				// No WebGL at all (browser hardware acceleration off): switch to the
				// CSS-3D paper card without the shader engine.
				fallback3D(retryError);
				return;
			}
		}
		renderer.setClearColor(
			document.documentElement.dataset.theme === "dark"
				? "#19121f"
				: "#fff8f5",
			1,
		);
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.NoToneMapping;
		stage.append(renderer.domElement);
		renderer.domElement.setAttribute("aria-hidden", "true");
		const textureLoader = new THREE.TextureLoader();
		const artwork = own(
			await textureLoader.loadAsync(config.assets.subject),
		);
		active();
		artwork.colorSpace = THREE.NoColorSpace;
		artwork.anisotropy = Math.min(
			8,
			renderer.capabilities.getMaxAnisotropy(),
		);
		const p = config.parameters || {};
		uniforms = {
			tArtwork: { value: artwork },
			uAspect: { value: config.cardAspect || 2 / 3 },
			uFoil: { value: p.foil ?? 0.52 },
			uFinish: { value: 0 },
		};
		const material = (fragment) =>
			own(
				new THREE.ShaderMaterial({
					uniforms,
					vertexShader: vertex,
					fragmentShader: fragment,
					side: THREE.FrontSide,
				}),
			);
		const materials = {
			web_front: material(frontFragment),
			web_back: material(edgeFragment),
			web_edge: material(edgeFragment),
		};
		const gltf = await new GLTFLoader().loadAsync(config.assets.model);
		gltf.scene.traverse((ob) => {
			if (!ob.isMesh) return;
			own(ob.geometry);
			for (const original of [ob.material].flat()) {
				for (const value of Object.values(original))
					if (value?.isTexture) own(value);
				own(original);
			}
		});
		active();
		root = new THREE.Group();
		root.add(gltf.scene);
		scene.add(root);
		let faces = 0;
		gltf.scene.traverse((ob) => {
			if (!ob.isMesh) return;
			const role = ob.material?.name;
			if (!materials[role]) {
				ob.visible = false;
				return;
			}
			if (role === "web_front") faces++;
			ob.material = materials[role];
			ob.material.name = role;
		});
		if (!faces) throw Error("卡片模型缺少正面材质");
		root.updateMatrixWorld(true);
		applyArtworkTransform();
		host.querySelectorAll("button[disabled],input[disabled]").forEach(
			(el) => (el.disabled = false),
		);
		observe(resize);
		resize();
		renderer.compile(scene, camera);
		renderer.render(scene, camera);
		const shaderErrors = (renderer.info.programs || []).filter(
			(p) => p.diagnostics && !p.diagnostics.runnable,
		);
		if (shaderErrors.length) {
			renderer.dispose();
			renderer.domElement.remove();
			renderer = null;
			fallback3D(new Error("当前设备无法显示卡面材质"));
			return;
		}
		setupControls();
		$("loading").hidden = true;
		root.rotation.set(targetX, targetY, 0);
		publish({
			ready: true,
			config,
			renderer,
			root,
			uniforms,
			camera,
			reset,
			modelSource: config.assets.model,
			getState: () => ({ auto, finish, zoom, motion: motionActive }),
		});
		setFinish(config.appearance?.finish || "pearl");
		setAuto(!media.matches);
		renderer.setAnimationLoop(animate);
	}
	// The fallback keeps the same complete print and thin paper core.
	function fallback3D(error) {
		console.warn(
			"[holo-card] WebGL unavailable, using CSS-3D fallback:",
			error,
		);
		const wrap = document.createElement("div");
		wrap.className = "fallback3d";
		const flipper = document.createElement("div");
		flipper.className = "flipper3d";
		const card = document.createElement("div");
		card.className = "card3d";
		card.id = "card3d";
		const front = document.createElement("div");
		front.className = "face3d front3d";
		const fitFallback = () => {
			const aspect = config.cardAspect || 2 / 3;
			const width = fittedHeight() * aspect;
			flipper.style.width = `${width}px`;
			flipper.style.height = `${width / aspect}px`;
			flipper.style.aspectRatio = String(aspect);
			flipper.style.setProperty(
				"--stock",
				`${(width / aspect) * (0.06 / 9.45)}px`,
			);
			flipper.style.setProperty(
				"--corner",
				`${(width / aspect) * (0.06 / 9.45)}px`,
			);
		};
		observe(fitFallback);
		fitFallback();
		const layer = document.createElement("div");
		layer.className = "layer3d";
		const img = document.createElement("img");
		img.src = config.assets.subject;
		img.alt = config.title || "卡片";
		img.decoding = "async";
		img.draggable = false;
		layer.append(img);
		front.append(layer);
		for (const side of ["left", "right", "top", "bottom"]) {
			const edge = document.createElement("div");
			edge.className = `paper-edge3d paper-edge3d-${side}`;
			card.append(edge);
		}
		const coating = document.createElement("div");
		coating.className = "coating3d";
		front.append(coating);
		const foil = document.createElement("div");
		foil.className = "foil3d";
		front.append(foil);
		card.append(front);
		flipper.append(card);
		wrap.append(flipper);
		stage.append(wrap);
		$("loading").hidden = true;

		// ---- interaction state (independent of the WebGL path) ----
		let tx = -0.03,
			ty = -0.06,
			curX = 0,
			curY = 0;
		let lastMove = 0,
			sway = !media.matches,
			fallbackDragging = false;
		on(stage, "pointerdown", (event) => {
			if (event.button !== 0 || !event.isPrimary) return;
			stopMotion();
			sway = false;
			fallbackDragging = true;
			stage.setPointerCapture(event.pointerId);
		});
		on(stage, "pointermove", (e) => {
			if (
				!fallbackDragging &&
				(media.matches || e.pointerType !== "mouse" || motionActive)
			)
				return;
			const r = stage.getBoundingClientRect();
			tx = Math.max(
				-0.5,
				Math.min(0.5, -((e.clientY - r.top) / r.height - 0.5) * 0.9),
			);
			ty = Math.max(
				-0.5,
				Math.min(0.5, ((e.clientX - r.left) / r.width - 0.5) * 1.1),
			);
			lastMove = performance.now();
		});
		on(stage, "pointerleave", () => {
			lastMove = 0;
		});
		for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
			on(stage, type, () => {
				fallbackDragging = false;
			});
		on(media, "change", () => {
			if (media.matches) sway = false;
		});
		const frame = (now) => {
			if (disposed) return;
			animationFrame = requestAnimationFrame(frame);
			if (document.hidden) return;
			if (motionActive) {
				tx = -targetX;
				ty = targetY;
			} else if (sway && now - lastMove > 1500) {
				const t = now / 1000;
				tx = Math.sin(t * 0.7) * 0.07 + 0.05;
				ty = Math.sin(t * 0.55) * 0.11 - 0.18;
			}
			curX += (tx - curX) * 0.08;
			curY += (ty - curY) * 0.08;
			flipper.style.transform = `rotateX(${curX.toFixed(4)}rad) rotateY(${curY.toFixed(4)}rad)`;
			front.style.setProperty("--mx", `${30 - curY * 100}%`);
			front.style.setProperty("--my", `${25 + curX * 100}%`);
		};
		animationFrame = requestAnimationFrame(frame);

		// ---- control wiring (mirrors the WebGL controls) ----
		const fallbackFinish = (value) => {
			front.classList.remove(
				"finish-gold",
				"finish-silver",
				"finish-pearl",
				"finish-original",
			);
			front.classList.add("finish-" + value);
			host.querySelectorAll("[data-finish]").forEach((b) =>
				b.setAttribute(
					"aria-pressed",
					String(b.dataset.finish === value),
				),
			);
			$("finish-name").textContent = {
				pearl: "珠光",
				silver: "银箔",
				gold: "烫金",
				original: "原画",
			}[value];
			$("foil").disabled = value === "original";
		};
		on(stage, "keydown", (event) => {
			if (
				![
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
					"r",
					"R",
					" ",
				].includes(event.key)
			)
				return;
			event.preventDefault();
			event.stopPropagation();
			stopMotion();
			if (event.key === " ") {
				sway = !sway;
				return;
			}
			sway = false;
			if (event.key.toLowerCase() === "r") {
				tx = 0;
				ty = 0;
				return;
			}
			if (event.key === "ArrowLeft") ty -= 0.08;
			if (event.key === "ArrowRight") ty += 0.08;
			if (event.key === "ArrowUp") tx += 0.06;
			if (event.key === "ArrowDown") tx -= 0.06;
			tx = THREE.MathUtils.clamp(tx, -0.48, 0.48);
			ty = THREE.MathUtils.clamp(ty, -0.8, 0.8);
		});
		$("motion").disabled = false;
		const bindRange = (id, output, fn) => {
			$(id).disabled = false;
			on($(id), "input", () => {
				const v = Number($(id).value);
				$(output).textContent = Math.round(v * 100) + "%";
				fn(v);
			});
		};
		host.querySelectorAll("[data-finish]").forEach((b) => {
			b.disabled = false;
			b.onclick = () => fallbackFinish(b.dataset.finish);
		});
		bindRange("foil", "foil-value", (v) => {
			front.style.setProperty("--foil-amount", v);
		});
		$("foil-value").textContent =
			Math.round(Number($("foil").value) * 100) + "%";
		front.style.setProperty("--foil-amount", $("foil").value);
		fallbackFinish(config.appearance?.finish || "pearl");
		notice("浏览器未开启 WebGL，已切换为轻量 3D 模式");
		publish({ ready: false, error: String(error), fallback3d: true });
	}
	function fittedHeight() {
		const aspect = config.cardAspect || 2 / 3;
		// Leave breathing room on every side, including wide art and short screens.
		return Math.max(
			1,
			Math.min(
				620,
				stage.clientHeight * 0.8,
				(stage.clientWidth * 0.8) / aspect,
			),
		);
	}
	function resize() {
		if (!renderer || disposed) return;
		const width = stage.clientWidth,
			height = stage.clientHeight;
		const aspect = width / height;
		if (!width || !height) return;
		const halfHeight = (4.725 * height) / fittedHeight() / zoom;
		camera.aspect = aspect;
		camera.fov = THREE.MathUtils.radToDeg(
			2 * Math.atan(halfHeight / camera.position.z),
		);
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
	}
	function applyArtworkTransform() {
		if (!root || !config) return;
		const aspectScale = (config.cardAspect || 2 / 3) / (2 / 3);
		root.scale.set(aspectScale, 1, 1);
		root.position.z = 0;
	}
	function setAuto(value) {
		if (value && motionActive) stopMotion();
		auto = value;
	}
	function setFinish(value) {
		finish = value;
		uniforms.uFinish.value =
			{ pearl: 0, silver: 1, original: 2, gold: 3 }[value] ?? 3;
		host.querySelectorAll("[data-finish]").forEach((b) =>
			b.setAttribute("aria-pressed", String(b.dataset.finish === value)),
		);
		$("finish-name").textContent = {
			pearl: "珠光",
			silver: "银箔",
			gold: "烫金",
			original: "原画",
		}[value];
		$("foil").disabled = value === "original";
	}
	function updateInput(id, name) {
		const input = $(id);
		const value = Number(input.value);
		uniforms[name].value = value;
		$(id + "-value").value =
			id === "foil"
				? Math.round(input.value * 100) + "%"
				: value.toFixed(2);
	}
	function reset() {
		stopMotion();
		targetX = -0.035;
		targetY = -0.15;
		zoom = 1;
		setAuto(false);
		const p = config.parameters || {};
		const defaults = {
			foil: p.foil ?? 0.52,
		};
		settings.forEach(([id, name]) => {
			$(id).value = defaults[id];
			updateInput(id, name);
		});
		setFinish(config.appearance?.finish || "pearl");
		resize();
	}
	function setupControls() {
		settings.forEach(([id, name]) => {
			$(id).value = uniforms[name].value;
			updateInput(id, name);
			on($(id), "input", () => updateInput(id, name));
		});
		on(stage, "pointerdown", (e) => {
			if (e.button !== 0 || !e.isPrimary) return;
			if (motionActive) {
				stopMotion();
				notice("已切换为拖动旋转");
			}
			dragging = true;
			setAuto(false);
			lastPointer = { x: e.clientX, y: e.clientY };
			stage.setPointerCapture(e.pointerId);
			stage.classList.add("dragging");
			stage.focus({ preventScroll: true });
		});
		on(stage, "pointermove", (e) => {
			if (!dragging) {
				if (e.pointerType !== "mouse" || media.matches || motionActive)
					return;
				const bounds = stage.getBoundingClientRect();
				const viewHeight =
					2 *
					camera.position.z *
					Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
				const cardWidth =
					(6.3 * root.scale.x * bounds.width) /
					(viewHeight * camera.aspect);
				const cardHeight = (9.45 * bounds.height) / viewHeight;
				setAuto(false);
				const offsetX = e.clientX - bounds.left - bounds.width / 2;
				const offsetY = e.clientY - bounds.top - bounds.height / 2;
				// The exported front normal is +Z: positive pitch faces down and
				// positive yaw faces right. Both axes must point toward the cursor.
				targetX =
					(THREE.MathUtils.clamp(
						(offsetY / bounds.height) * 0.5,
						-0.25,
						0.25,
					) +
						THREE.MathUtils.clamp(
							(offsetY / (cardHeight / 2)) * 0.5,
							-0.5,
							0.5,
						)) /
					2;
				targetY =
					(THREE.MathUtils.clamp(
						(offsetX / bounds.width) * 0.8,
						-0.4,
						0.4,
					) +
						THREE.MathUtils.clamp(
							(offsetX / (cardWidth / 2)) * 0.75,
							-0.75,
							0.75,
						)) /
					2;
				return;
			}
			const base = 0;
			targetY = THREE.MathUtils.clamp(
				targetY + (e.clientX - lastPointer.x) * 0.0075,
				base - 0.8,
				base + 0.8,
			);
			targetX = THREE.MathUtils.clamp(
				targetX + (e.clientY - lastPointer.y) * 0.005,
				-0.48,
				0.48,
			);
			lastPointer = { x: e.clientX, y: e.clientY };
		});
		on(stage, "pointerleave", (event) => {
			if (
				event.pointerType === "mouse" &&
				!dragging &&
				!motionActive &&
				!auto
			) {
				targetX = 0;
				targetY = 0;
			}
		});
		const release = () => {
			dragging = false;
			stage.classList.remove("dragging");
		};
		["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
			on(stage, type, release),
		);
		on(
			stage,
			"wheel",
			(e) => {
				e.preventDefault();
				zoom = THREE.MathUtils.clamp(
					zoom - e.deltaY * 0.001,
					0.82,
					1.05,
				);
				resize();
			},
			{ passive: false },
		);
		on(stage, "keydown", (e) => {
			if (
				![
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
					"r",
					"R",
					" ",
				].includes(e.key)
			)
				return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === " ") {
				setAuto(!auto);
				return;
			}
			if (e.key.toLowerCase() === "r") {
				reset();
				return;
			}
			setAuto(false);
			const base = 0;
			if (e.key === "ArrowLeft") targetY -= 0.08;
			if (e.key === "ArrowRight") targetY += 0.08;
			if (e.key === "ArrowUp") targetX -= 0.06;
			if (e.key === "ArrowDown") targetX += 0.06;
			targetY = THREE.MathUtils.clamp(targetY, base - 0.8, base + 0.8);
			targetX = THREE.MathUtils.clamp(targetX, -0.48, 0.48);
		});
		host.querySelectorAll("[data-finish]").forEach(
			(b) => (b.onclick = () => setFinish(b.dataset.finish)),
		);
		on(media, "change", () => {
			if (media.matches) setAuto(false);
		});
		on(renderer.domElement, "webglcontextlost", (e) => {
			e.preventDefault();
			renderer.setAnimationLoop(null);
			notice("图形显示已暂停，请刷新页面恢复");
		});
	}
	function animate(now) {
		if (disposed) return;
		const dt = Math.min((now - lastTime) / 1000, 0.06) || 0;
		lastTime = now;
		if (document.hidden) return;
		if (!media.matches || auto) elapsed += dt;
		if (auto) {
			targetY = Math.sin(elapsed * 0.42) * 0.23 - 0.055;
			targetX = Math.sin(elapsed * 0.53) * 0.055 - 0.018;
		}
		const ease = media.matches ? 1 : 1 - Math.exp(-dt * 8);
		root.rotation.x += (targetX - root.rotation.x) * ease;
		root.rotation.y += (targetY - root.rotation.y) * ease;
		root.updateMatrixWorld(true);
		renderer.render(scene, camera);
	}
	const fail = (message) => {
		if (disposed) return;
		dispose();
		const loading = $("loading");
		loading.hidden = false;
		loading?.classList.add("error");
		loading?.setAttribute("role", "alert");
		loading?.replaceChildren();
		const msg = document.createElement("span");
		msg.textContent = message;
		const button = document.createElement("button");
		button.textContent = "重新加载";
		button.onclick = retry;
		loading?.append(msg, button);
		$("notice-message").textContent = "闪卡加载失败，请重新加载";
		$("notice").hidden = false;
		publish({ ready: false, error: message });
	};
	const LOAD_TIMEOUT_MS = 12000;
	loadTimer = setTimeout(
		() => fail("卡片加载超时，请检查网络或重试"),
		LOAD_TIMEOUT_MS,
	);
	init()
		.catch((error) => {
			if (disposed) return;
			fail("作品暂时无法加载。\n" + error.message);
		})
		.finally(() => clearTimeout(loadTimer));

	on(window, "pagehide", () => {
		stopMotion();
		renderer?.setAnimationLoop(null);
	});
	on(window, "pageshow", () => {
		if (diagnostic?.ready) renderer.setAnimationLoop(animate);
	});
	on(document, "visibilitychange", () => {
		if (diagnostic?.ready)
			renderer.setAnimationLoop(document.hidden ? null : animate);
	});
	on(host, "dragstart", (event) => {
		if (event.target instanceof HTMLImageElement) event.preventDefault();
	});

	function dispose() {
		// Keep diagnostics from retaining a disposed scene, even after an error.
		if (window.__holo === diagnostic) delete window.__holo;
		if (disposed) return;
		disposed = true;
		lifetime.abort();
		stopMotion();
		clearTimeout(loadTimer);
		clearTimeout(noticeTimer);
		cancelAnimationFrame(animationFrame);
		observers.forEach((observer) => observer.disconnect());
		renderer?.setAnimationLoop(null);
		resources.forEach((resource) => resource.dispose());
		resources.clear();
		scene.clear();
		renderer?.dispose();
		renderer?.forceContextLoss();
		stage
			.querySelectorAll("canvas,.fallback3d")
			.forEach((node) => node.remove());
		stage.classList.remove("dragging");
		host.querySelectorAll("button").forEach(
			(button) => (button.onclick = null),
		);
	}
	return dispose;
}
