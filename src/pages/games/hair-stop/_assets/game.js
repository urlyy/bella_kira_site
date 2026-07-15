const MANIFEST_URL = "/assets/character-assembly/manifest.json";
const CANVAS_SIZE = 1280;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.25;
const SCALE_STEP = 0.1;
const ROTATION_STEP = 5;
const HISTORY_LIMIT = 60;
const CHARACTER_NAMES = JSON.parse(
	document.querySelector("#character-name-map")?.textContent || "{}",
);

const CATEGORIES = [
	{ id: "all", label: "全部" },
	{ id: "hair", label: "头发", parts: ["back-hair", "front-hair"] },
	{
		id: "face",
		label: "五官",
		parts: [
			"face",
			"ears",
			"eyebrow",
			"eyewhite",
			"irides",
			"eyelash",
			"nose",
			"mouth",
		],
	},
	{
		id: "upper",
		label: "上身",
		parts: ["neck", "topwear", "handwear"],
	},
	{
		id: "lower",
		label: "下身",
		parts: ["bottomwear", "legwear", "footwear"],
	},
	{
		id: "accessory",
		label: "配饰",
		parts: ["headwear", "neckwear", "earwear", "eyewear", "tail"],
	},
];

const board = document.querySelector("#assembly-board");
const pieceStage = document.querySelector("#piece-stage");
const boardEmpty = document.querySelector("#board-empty");
const sourceFilters = document.querySelector("#source-filters");
const categoryFilters = document.querySelector("#category-filters");
const partsList = document.querySelector("#parts-list");
const statusLabel = document.querySelector("#assembly-title");
const pieceCount = document.querySelector("#piece-count");
const libraryCount = document.querySelector("#library-count");
const selectionLabel = document.querySelector("#selection-label");
const layerControls = document.querySelector("#layer-controls");
const undoButton = document.querySelector("#undo-button");
const multiSelectToggle = document.querySelector("#multi-select-toggle");
const meshToggle = document.querySelector("#mesh-toggle");
const clearButton = document.querySelector("#clear-button");
const exportButton = document.querySelector("#export-button");
const themeToggle = document.querySelector("#theme-toggle");
const toast = document.querySelector("#game-toast");
const toastMessage = document.querySelector("#toast-message");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const meshEditor = document.createElement("div");
meshEditor.className = "mesh-editor";
meshEditor.hidden = true;
meshEditor.innerHTML = `<svg viewBox="0 0 1280 1280" aria-hidden="true"><g></g></svg><div class="mesh-handles"></div>`;
board.append(meshEditor);
const meshLineLayer = meshEditor.querySelector("g");
const meshHandles = meshEditor.querySelector(".mesh-handles");

let manifest;
let library = [];
let selectedSource = "all";
let selectedCategory = "all";
let selectedInstances = [];
let multiSelectMode = false;
let meshInstance = null;
let instances = [];
let instanceSequence = 0;
let history = [];
let toastTimer = 0;
let desktopLibraryDrag = null;

function showToast(message, state = "success") {
	window.clearTimeout(toastTimer);
	toastMessage.textContent = message;
	toast.dataset.state = state;
	toast.classList.add("is-visible");
	toastTimer = window.setTimeout(() => {
		toast.classList.remove("is-visible");
	}, 1900);
}

function formatCount(value) {
	return String(value).padStart(2, "0");
}

function syncThemeControl() {
	const isLight = document.documentElement.dataset.theme === "light";
	themeToggle.querySelector("span").textContent = isLight ? "☀" : "☾";
	themeToggle.querySelector("b").textContent = isLight
		? "切换深色"
		: "切换浅色";
	themeToggle.setAttribute(
		"aria-label",
		isLight ? "切换深色主题" : "切换浅色主题",
	);
	if (themeMeta) themeMeta.content = isLight ? "#f6e7e2" : "#10091f";
}

function toggleTheme() {
	const next =
		document.documentElement.dataset.theme === "light" ? "dark" : "light";
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem("bella-kira-theme", next);
	} catch {
		// The theme still applies for this visit when storage is unavailable.
	}
	syncThemeControl();
}

function partStyle(part, x = part.x, y = part.y) {
	return {
		left: `${(x / CANVAS_SIZE) * 100}%`,
		top: `${(y / CANVAS_SIZE) * 100}%`,
		width: `${(part.width / CANVAS_SIZE) * 100}%`,
		height: `${(part.height / CANVAS_SIZE) * 100}%`,
	};
}

function transformedSize(part, scale, rotation) {
	const radians = (rotation * Math.PI) / 180;
	const cosine = Math.abs(Math.cos(radians));
	const sine = Math.abs(Math.sin(radians));
	return {
		width: (part.width * cosine + part.height * sine) * scale,
		height: (part.width * sine + part.height * cosine) * scale,
	};
}

function maximumScale(part, rotation) {
	const unitSize = transformedSize(part, 1, rotation);
	return Math.max(
		MIN_SCALE,
		Math.min(
			MAX_SCALE,
			CANVAS_SIZE / unitSize.width,
			CANVAS_SIZE / unitSize.height,
		),
	);
}

function normalizeRotation(rotation) {
	return ((((rotation + 180) % 360) + 360) % 360) - 180;
}

function applyPosition(instance, x, y) {
	const { part } = instance.entry;
	instance.rotation = normalizeRotation(instance.rotation ?? 0);
	instance.scale = Math.max(
		MIN_SCALE,
		Math.min(maximumScale(part, instance.rotation), instance.scale ?? 1),
	);
	const size = transformedSize(part, instance.scale, instance.rotation);
	const centerX = x + part.width / 2;
	const centerY = y + part.height / 2;
	const clampedCenterX = Math.max(
		size.width / 2,
		Math.min(CANVAS_SIZE - size.width / 2, centerX),
	);
	const clampedCenterY = Math.max(
		size.height / 2,
		Math.min(CANVAS_SIZE - size.height / 2, centerY),
	);
	const nextX = clampedCenterX - part.width / 2;
	const nextY = clampedCenterY - part.height / 2;
	instance.x = nextX;
	instance.y = nextY;
	Object.assign(instance.element.style, partStyle(part, nextX, nextY));
	instance.element.style.transform = `rotate(${instance.rotation}deg) scale(${instance.scale})`;
	if (meshInstance === instance) updateMeshEditor();
}

function snapshotState() {
	return {
		selectedIds: selectedInstances.map((instance) => instance.id),
		instances: instances.map((instance) => ({
			id: instance.id,
			sourceId: instance.entry.character.id,
			partId: instance.entry.part.id,
			x: instance.x,
			y: instance.y,
			scale: instance.scale,
			rotation: instance.rotation,
			mesh: instance.mesh.map((point) => ({ ...point })),
		})),
	};
}

function updateUndoState() {
	undoButton.disabled = history.length === 0;
}

function pushHistory(snapshot = snapshotState()) {
	history.push(snapshot);
	if (history.length > HISTORY_LIMIT) history.shift();
	updateUndoState();
}

function defaultMesh(part) {
	return Array.from({ length: 9 }, (_, index) => ({
		x: ((index % 3) * part.width) / 2,
		y: (Math.floor(index / 3) * part.height) / 2,
	}));
}

function drawMeshTriangle(context, image, source, destination) {
	const [s0, s1, s2] = source;
	const [d0, d1, d2] = destination;
	const determinant =
		s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
	if (Math.abs(determinant) < 0.0001) return;

	const a =
		(d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) /
		determinant;
	const c =
		(d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) /
		determinant;
	const e =
		(d0.x * (s1.x * s2.y - s2.x * s1.y) +
			d1.x * (s2.x * s0.y - s0.x * s2.y) +
			d2.x * (s0.x * s1.y - s1.x * s0.y)) /
		determinant;
	const b =
		(d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) /
		determinant;
	const d =
		(d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) /
		determinant;
	const f =
		(d0.y * (s1.x * s2.y - s2.x * s1.y) +
			d1.y * (s2.x * s0.y - s0.x * s2.y) +
			d2.y * (s0.x * s1.y - s1.x * s0.y)) /
		determinant;

	context.save();
	context.beginPath();
	context.moveTo(d0.x, d0.y);
	context.lineTo(d1.x, d1.y);
	context.lineTo(d2.x, d2.y);
	context.closePath();
	context.clip();
	context.setTransform(a, b, c, d, e, f);
	context.drawImage(image, 0, 0);
	context.restore();
}

function renderInstance(instance) {
	if (!instance.sourceImage.complete || !instance.sourceImage.naturalWidth)
		return;
	const { part } = instance.entry;
	const context = instance.element.getContext("2d");
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, part.width, part.height);

	for (let row = 0; row < 2; row += 1) {
		for (let column = 0; column < 2; column += 1) {
			const sourceTopLeft = {
				x: (column * part.width) / 2,
				y: (row * part.height) / 2,
			};
			const sourceTopRight = {
				x: ((column + 1) * part.width) / 2,
				y: (row * part.height) / 2,
			};
			const sourceBottomLeft = {
				x: (column * part.width) / 2,
				y: ((row + 1) * part.height) / 2,
			};
			const sourceBottomRight = {
				x: ((column + 1) * part.width) / 2,
				y: ((row + 1) * part.height) / 2,
			};
			const topLeft = instance.mesh[row * 3 + column];
			const topRight = instance.mesh[row * 3 + column + 1];
			const bottomLeft = instance.mesh[(row + 1) * 3 + column];
			const bottomRight = instance.mesh[(row + 1) * 3 + column + 1];
			drawMeshTriangle(
				context,
				instance.sourceImage,
				[sourceTopLeft, sourceTopRight, sourceBottomRight],
				[topLeft, topRight, bottomRight],
			);
			drawMeshTriangle(
				context,
				instance.sourceImage,
				[sourceTopLeft, sourceBottomRight, sourceBottomLeft],
				[topLeft, bottomRight, bottomLeft],
			);
		}
	}
}

function meshPointToWorld(instance, point) {
	const { part } = instance.entry;
	const radians = (instance.rotation * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const localX = (point.x - part.width / 2) * instance.scale;
	const localY = (point.y - part.height / 2) * instance.scale;
	return {
		x: instance.x + part.width / 2 + localX * cosine - localY * sine,
		y: instance.y + part.height / 2 + localX * sine + localY * cosine,
	};
}

function clientPointToMesh(instance, clientX, clientY) {
	const { part } = instance.entry;
	const boardRect = board.getBoundingClientRect();
	const worldX = ((clientX - boardRect.left) / boardRect.width) * CANVAS_SIZE;
	const worldY = ((clientY - boardRect.top) / boardRect.height) * CANVAS_SIZE;
	const centerX = instance.x + part.width / 2;
	const centerY = instance.y + part.height / 2;
	const radians = (-instance.rotation * Math.PI) / 180;
	const deltaX = worldX - centerX;
	const deltaY = worldY - centerY;
	const localX =
		(deltaX * Math.cos(radians) - deltaY * Math.sin(radians)) /
		instance.scale;
	const localY =
		(deltaX * Math.sin(radians) + deltaY * Math.cos(radians)) /
		instance.scale;
	return {
		x: Math.max(0, Math.min(part.width, localX + part.width / 2)),
		y: Math.max(0, Math.min(part.height, localY + part.height / 2)),
	};
}

function updateMeshEditor() {
	if (!meshInstance) return;
	const worldPoints = meshInstance.mesh.map((point) =>
		meshPointToWorld(meshInstance, point),
	);
	meshLineLayer.replaceChildren();
	for (let row = 0; row < 3; row += 1) {
		const path = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);
		path.setAttribute(
			"d",
			worldPoints
				.slice(row * 3, row * 3 + 3)
				.map(
					(point, index) =>
						`${index === 0 ? "M" : "L"}${point.x} ${point.y}`,
				)
				.join(" "),
		);
		meshLineLayer.append(path);
	}
	for (let column = 0; column < 3; column += 1) {
		const path = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);
		path.setAttribute(
			"d",
			[0, 1, 2]
				.map((row, index) => {
					const point = worldPoints[row * 3 + column];
					return `${index === 0 ? "M" : "L"}${point.x} ${point.y}`;
				})
				.join(" "),
		);
		meshLineLayer.append(path);
	}
	[...meshHandles.children].forEach((handle, index) => {
		const point = worldPoints[index];
		handle.style.left = `${(point.x / CANVAS_SIZE) * 100}%`;
		handle.style.top = `${(point.y / CANVAS_SIZE) * 100}%`;
	});
}

function closeMeshEditor() {
	meshInstance = null;
	meshEditor.hidden = true;
	meshToggle.setAttribute("aria-pressed", "false");
	meshHandles.replaceChildren();
	meshLineLayer.replaceChildren();
}

function openMeshEditor(instance) {
	meshInstance = instance;
	meshEditor.hidden = false;
	meshToggle.setAttribute("aria-pressed", "true");
	meshHandles.replaceChildren();
	instance.mesh.forEach((_, index) => {
		const handle = document.createElement("button");
		handle.type = "button";
		handle.className = "mesh-handle";
		handle.setAttribute("aria-label", `网格控制点 ${index + 1}`);
		let drag = null;
		handle.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			handle.setPointerCapture(event.pointerId);
			drag = {
				pointerId: event.pointerId,
				before: snapshotState(),
				start: { ...instance.mesh[index] },
				moved: false,
			};
		});
		handle.addEventListener("pointermove", (event) => {
			if (!drag || drag.pointerId !== event.pointerId) return;
			const point = clientPointToMesh(
				instance,
				event.clientX,
				event.clientY,
			);
			instance.mesh[index] = point;
			drag.moved =
				drag.moved ||
				Math.abs(point.x - drag.start.x) > 0.5 ||
				Math.abs(point.y - drag.start.y) > 0.5;
			renderInstance(instance);
			updateMeshEditor();
		});
		const endDrag = (event) => {
			if (!drag || drag.pointerId !== event.pointerId) return;
			if (drag.moved) pushHistory(drag.before);
			drag = null;
		};
		handle.addEventListener("pointerup", endDrag);
		handle.addEventListener("pointercancel", endDrag);
		handle.addEventListener("keydown", (event) => {
			const amount = event.shiftKey ? 10 : 2;
			const moves = {
				ArrowLeft: [-amount, 0],
				ArrowRight: [amount, 0],
				ArrowUp: [0, -amount],
				ArrowDown: [0, amount],
			};
			if (!moves[event.key]) return;
			event.preventDefault();
			const before = snapshotState();
			const [dx, dy] = moves[event.key];
			const { part } = instance.entry;
			instance.mesh[index] = {
				x: Math.max(
					0,
					Math.min(part.width, instance.mesh[index].x + dx),
				),
				y: Math.max(
					0,
					Math.min(part.height, instance.mesh[index].y + dy),
				),
			};
			renderInstance(instance);
			updateMeshEditor();
			pushHistory(before);
		});
		meshHandles.append(handle);
	});
	updateMeshEditor();
}

function toggleMeshEditor() {
	if (selectedInstances.length !== 1) return;
	if (meshInstance === selectedInstances[0]) closeMeshEditor();
	else openMeshEditor(selectedInstances[0]);
}

function basePartId(id) {
	return id.replace(/-(left|right)(-\d+)?$/, "");
}

function categoryMatches(entry) {
	if (selectedCategory === "all") return true;
	const category = CATEGORIES.find((item) => item.id === selectedCategory);
	return category?.parts?.includes(basePartId(entry.part.id)) ?? false;
}

function createFilterButton({ id, label }, kind) {
	const active =
		kind === "source" ? id === selectedSource : id === selectedCategory;
	const button = document.createElement("button");
	button.type = "button";
	button.className = "filter-button";
	button.dataset.filter = id;
	button.setAttribute("aria-pressed", String(active));
	button.textContent = label;
	button.addEventListener("click", () => {
		if (kind === "source") selectedSource = id;
		else selectedCategory = id;
		renderFilters();
		renderParts();
	});
	return button;
}

function renderFilters() {
	sourceFilters.replaceChildren();
	sourceFilters.append(
		createFilterButton({ id: "all", label: "全部" }, "source"),
	);
	manifest.characters.forEach((character) => {
		sourceFilters.append(
			createFilterButton(
				{ id: character.id, label: character.name },
				"source",
			),
		);
	});

	categoryFilters.replaceChildren();
	CATEGORIES.forEach((category) => {
		categoryFilters.append(createFilterButton(category, "category"));
	});
}

function renderParts() {
	const filtered = library.filter(
		(entry) =>
			(selectedSource === "all" ||
				entry.character.id === selectedSource) &&
			categoryMatches(entry),
	);
	partsList.replaceChildren();
	libraryCount.textContent = `${filtered.length} 个可选组件`;

	filtered.forEach((entry, index) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "part-option";
		button.dataset.part = entry.part.id;
		button.dataset.source = entry.character.id;
		button.style.setProperty("--delay", `${Math.min(index * 12, 180)}ms`);
		button.setAttribute(
			"aria-label",
			`拖动${entry.character.name}的${entry.part.label}到画布`,
		);
		button.innerHTML = `<span><img src="${entry.part.src}" alt="" draggable="false" loading="lazy" decoding="async" /></span><b>${entry.part.label}</b><small>${entry.character.name}</small><i class="part-drag-handle" aria-hidden="true">↗</i>`;
		bindLibraryDrag(button, entry);
		partsList.append(button);
	});
}

function isPointInsideBoard(clientX, clientY) {
	const rect = board.getBoundingClientRect();
	return (
		clientX >= rect.left &&
		clientX <= rect.right &&
		clientY >= rect.top &&
		clientY <= rect.bottom
	);
}

function dropPosition(entry, clientX, clientY) {
	const rect = board.getBoundingClientRect();
	return {
		x:
			((clientX - rect.left) / rect.width) * CANVAS_SIZE -
			entry.part.width / 2,
		y:
			((clientY - rect.top) / rect.height) * CANVAS_SIZE -
			entry.part.height / 2,
	};
}

function bindLibraryDrag(button, entry) {
	let drag = null;
	let ignoreClickUntil = 0;
	button.draggable = true;

	button.addEventListener("dragstart", (event) => {
		desktopLibraryDrag = { button, entry };
		button.classList.add("is-library-dragging");
		event.dataTransfer.effectAllowed = "copy";
		event.dataTransfer.setData("text/plain", entry.part.id);
	});

	button.addEventListener("dragend", () => {
		const missedBoard = desktopLibraryDrag?.button === button;
		button.classList.remove("is-library-dragging");
		board.classList.remove("is-drop-target");
		desktopLibraryDrag = null;
		if (missedBoard) showToast("请把组件放进限定拼装区域", "error");
	});

	const updateDrag = (clientX, clientY) => {
		if (!drag) return;
		drag.preview.style.left = `${clientX}px`;
		drag.preview.style.top = `${clientY}px`;
		const inside = isPointInsideBoard(clientX, clientY);
		drag.preview.classList.toggle("is-over-board", inside);
		board.classList.toggle("is-drop-target", inside);
	};

	button.addEventListener("pointerdown", (event) => {
		if (event.pointerType === "mouse") return;
		if (!event.target.closest(".part-drag-handle")) return;
		event.preventDefault();
		const preview = document.createElement("div");
		preview.className = "part-drag-preview";
		preview.innerHTML = `<img src="${entry.part.src}" alt="" draggable="false" /><span>${entry.character.name} · ${entry.part.label}</span>`;
		document.body.append(preview);
		button.setPointerCapture(event.pointerId);
		drag = {
			pointerId: event.pointerId,
			preview,
			startX: event.clientX,
			startY: event.clientY,
			moved: false,
		};
		button.classList.add("is-library-dragging");
		updateDrag(event.clientX, event.clientY);
	});

	button.addEventListener("pointermove", (event) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		drag.moved =
			drag.moved ||
			Math.hypot(
				event.clientX - drag.startX,
				event.clientY - drag.startY,
			) > 5;
		updateDrag(event.clientX, event.clientY);
	});

	const endDrag = (event, cancelled = false) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const droppedInside =
			!cancelled && isPointInsideBoard(event.clientX, event.clientY);
		const moved = drag.moved;
		drag.preview.remove();
		drag = null;
		button.classList.remove("is-library-dragging");
		board.classList.remove("is-drop-target");
		if (droppedInside && moved) {
			ignoreClickUntil = performance.now() + 350;
			addPiece(entry, dropPosition(entry, event.clientX, event.clientY));
		} else if (moved) {
			showToast("请把组件放进限定拼装区域", "error");
		}
	};
	button.addEventListener("pointerup", endDrag);
	button.addEventListener("pointercancel", (event) => endDrag(event, true));
	button.addEventListener("click", (event) => {
		event.preventDefault();
		if (performance.now() < ignoreClickUntil) return;
		showToast("请拖动组件到拼装区域内");
	});
}

function updateLayerOrder() {
	instances.forEach((instance, index) => {
		instance.element.style.zIndex = String(index + 1);
	});
}

function isSelected(instance) {
	return selectedInstances.includes(instance);
}

function updateSelectionUi(focusInstance = null) {
	layerControls.querySelectorAll("[data-action]").forEach((button) => {
		button.disabled = selectedInstances.length === 0;
	});
	meshToggle.disabled = selectedInstances.length !== 1;

	if (selectedInstances.length === 1) {
		const instance = selectedInstances[0];
		const { character, part } = instance.entry;
		statusLabel.textContent = `已选 · ${character.name} ${part.label}`;
		selectionLabel.textContent = `${character.name} · ${part.label}（${Math.round(instance.scale * 100)}% / ${instance.rotation}°）`;
	} else if (selectedInstances.length > 1) {
		statusLabel.textContent = `已选 ${selectedInstances.length} 件`;
		selectionLabel.textContent = `已选 ${selectedInstances.length} 件 · 可统一移动与变换`;
	} else {
		statusLabel.textContent = "自由拼装中";
		selectionLabel.textContent = "尚未选中画布组件";
	}
	if (focusInstance) focusInstance.element.focus({ preventScroll: true });
}

function setSelection(next, focusInstance = null) {
	const unique = [...new Set(next)].filter((instance) =>
		instances.includes(instance),
	);
	if (meshInstance && (unique.length !== 1 || unique[0] !== meshInstance)) {
		closeMeshEditor();
	}
	selectedInstances.forEach((instance) =>
		instance.element.classList.remove("is-selected"),
	);
	selectedInstances = unique;
	selectedInstances.forEach((instance) =>
		instance.element.classList.add("is-selected"),
	);
	updateSelectionUi(focusInstance);
}

function toggleSelection(instance, focus = false) {
	setSelection(
		isSelected(instance)
			? selectedInstances.filter((item) => item !== instance)
			: [...selectedInstances, instance],
		focus ? instance : null,
	);
}

function createInstance(entry, state = {}) {
	const element = document.createElement("canvas");
	const sourceImage = new Image();
	const instance = {
		id: state.id ?? `piece-${++instanceSequence}`,
		entry,
		element,
		sourceImage,
		x: state.x ?? entry.part.x,
		y: state.y ?? entry.part.y,
		scale: state.scale ?? 1,
		rotation: state.rotation ?? 0,
		mesh:
			state.mesh?.map((point) => ({ ...point })) ??
			defaultMesh(entry.part),
	};
	element.className = "assembly-piece";
	element.width = entry.part.width;
	element.height = entry.part.height;
	element.tabIndex = 0;
	element.dataset.instance = instance.id;
	element.setAttribute("role", "img");
	element.setAttribute(
		"aria-label",
		`${entry.character.name}的${entry.part.label}，可拖动、缩放、旋转和网格变形`,
	);
	sourceImage.decoding = "async";
	sourceImage.addEventListener("load", () => renderInstance(instance), {
		once: true,
	});
	sourceImage.src = entry.part.src;
	applyPosition(instance, instance.x, instance.y);
	bindPieceInput(instance);
	return instance;
}

function entryForState(state) {
	return library.find(
		(entry) =>
			entry.character.id === state.sourceId &&
			entry.part.id === state.partId,
	);
}

function restoreSnapshot(snapshot) {
	closeMeshEditor();
	selectedInstances = [];
	instances = snapshot.instances
		.map((state) => {
			const entry = entryForState(state);
			return entry ? createInstance(entry, state) : null;
		})
		.filter(Boolean);
	pieceStage.replaceChildren(
		...instances.map((instance) => instance.element),
	);
	updateLayerOrder();
	updateCanvasState();
	setSelection(
		instances.filter((instance) =>
			(snapshot.selectedIds ?? []).includes(instance.id),
		),
	);
}

function undo() {
	const snapshot = history.pop();
	if (!snapshot) {
		showToast("还没有可以撤销的操作");
		return;
	}
	restoreSnapshot(snapshot);
	updateUndoState();
	showToast("已撤销上一步操作");
}

function addPiece(entry, position = null) {
	pushHistory();
	const instance = createInstance(entry, position ?? {});

	let insertAt = instances.findIndex(
		(item) => item.entry.part.z > entry.part.z,
	);
	if (insertAt === -1) insertAt = instances.length;
	instances.splice(insertAt, 0, instance);
	pieceStage.append(instance.element);
	updateLayerOrder();
	setSelection([instance], instance);
	updateCanvasState();
	showToast(`已加入「${entry.character.name} · ${entry.part.label}」`);
}

function visualBounds(instance, x = instance.x, y = instance.y) {
	const { part } = instance.entry;
	const size = transformedSize(part, instance.scale, instance.rotation);
	const centerX = x + part.width / 2;
	const centerY = y + part.height / 2;
	return {
		left: centerX - size.width / 2,
		right: centerX + size.width / 2,
		top: centerY - size.height / 2,
		bottom: centerY + size.height / 2,
	};
}

function moveSelection(origins, dx, dy) {
	if (origins.length === 0) return false;
	const bounds = origins.reduce(
		(result, origin) => {
			const current = visualBounds(origin.instance, origin.x, origin.y);
			return {
				left: Math.min(result.left, current.left),
				right: Math.max(result.right, current.right),
				top: Math.min(result.top, current.top),
				bottom: Math.max(result.bottom, current.bottom),
			};
		},
		{ left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
	);
	const clampedDx = Math.max(
		-bounds.left,
		Math.min(CANVAS_SIZE - bounds.right, dx),
	);
	const clampedDy = Math.max(
		-bounds.top,
		Math.min(CANVAS_SIZE - bounds.bottom, dy),
	);
	origins.forEach((origin) =>
		applyPosition(
			origin.instance,
			origin.x + clampedDx,
			origin.y + clampedDy,
		),
	);
	updateSelectionUi();
	return Math.abs(clampedDx) > 0.01 || Math.abs(clampedDy) > 0.01;
}

function selectionOrigins() {
	return selectedInstances.map((instance) => ({
		instance,
		x: instance.x,
		y: instance.y,
	}));
}

function bindPieceInput(instance) {
	const { element } = instance;
	let drag = null;

	element.addEventListener("pointerdown", (event) => {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		event.preventDefault();
		const additive =
			multiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey;
		const wasSelected = isSelected(instance);
		if (!wasSelected) {
			setSelection(
				additive ? [...selectedInstances, instance] : [instance],
				instance,
			);
		} else {
			element.focus({ preventScroll: true });
		}
		element.setPointerCapture(event.pointerId);
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			origins: selectionOrigins(),
			before: snapshotState(),
			moved: false,
			toggleOff: additive && wasSelected,
		};
		selectedInstances.forEach((item) =>
			item.element.classList.add("is-dragging"),
		);
	});

	element.addEventListener("pointermove", (event) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const rect = board.getBoundingClientRect();
		const dx = ((event.clientX - drag.startX) / rect.width) * CANVAS_SIZE;
		const dy = ((event.clientY - drag.startY) / rect.height) * CANVAS_SIZE;
		drag.moved = moveSelection(drag.origins, dx, dy) || drag.moved;
	});

	const endDrag = (event) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		selectedInstances.forEach((item) =>
			item.element.classList.remove("is-dragging"),
		);
		if (drag.moved) pushHistory(drag.before);
		else if (drag.toggleOff) toggleSelection(instance, true);
		drag = null;
	};
	element.addEventListener("pointerup", endDrag);
	element.addEventListener("pointercancel", endDrag);

	element.addEventListener("keydown", (event) => {
		const amount = event.shiftKey ? 40 : 12;
		const moves = {
			ArrowLeft: [-amount, 0],
			ArrowRight: [amount, 0],
			ArrowUp: [0, -amount],
			ArrowDown: [0, amount],
		};
		if (moves[event.key]) {
			event.preventDefault();
			if (!isSelected(instance)) setSelection([instance], instance);
			const before = snapshotState();
			const [dx, dy] = moves[event.key];
			if (moveSelection(selectionOrigins(), dx, dy)) pushHistory(before);
		} else if (event.key === "Delete" || event.key === "Backspace") {
			event.preventDefault();
			deleteSelected();
		} else if (event.key === "PageUp") {
			event.preventDefault();
			moveSelectedLayer(1);
		} else if (event.key === "PageDown") {
			event.preventDefault();
			moveSelectedLayer(-1);
		} else if (event.key === "[" || event.key === "]") {
			event.preventDefault();
			transformSelected(
				event.key === "[" ? "rotate-left" : "rotate-right",
			);
		} else if (event.key === "-" || event.key === "=") {
			event.preventDefault();
			transformSelected(event.key === "-" ? "shrink" : "grow");
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (meshInstance) closeMeshEditor();
			else setSelection([]);
		}
	});
}

function updateCanvasState() {
	pieceCount.textContent = `画布 ${formatCount(instances.length)} 件`;
	boardEmpty.hidden = instances.length > 0;
	exportButton.disabled = instances.length === 0;
	if (instances.length === 0) setSelection([]);
}

function moveSelectedLayer(direction) {
	if (selectedInstances.length === 0) return;
	const before = snapshotState();
	const selected = new Set(selectedInstances);
	const beforeOrder = instances.map((instance) => instance.id).join("|");
	if (direction > 0) {
		for (let index = instances.length - 2; index >= 0; index -= 1) {
			if (
				selected.has(instances[index]) &&
				!selected.has(instances[index + 1])
			) {
				[instances[index], instances[index + 1]] = [
					instances[index + 1],
					instances[index],
				];
			}
		}
	} else {
		for (let index = 1; index < instances.length; index += 1) {
			if (
				selected.has(instances[index]) &&
				!selected.has(instances[index - 1])
			) {
				[instances[index], instances[index - 1]] = [
					instances[index - 1],
					instances[index],
				];
			}
		}
	}
	if (beforeOrder === instances.map((instance) => instance.id).join("|")) {
		showToast(direction > 0 ? "已经在最上层啦" : "已经在最下层啦");
		return;
	}
	pushHistory(before);
	updateLayerOrder();
	showToast(direction > 0 ? "所选组件已上移一层" : "所选组件已下移一层");
}

function restoreSelected() {
	if (selectedInstances.length === 0) return;
	const alreadyRestored = selectedInstances.every((instance) => {
		const { part } = instance.entry;
		const mesh = defaultMesh(part);
		return (
			Math.abs(instance.x - part.x) < 0.01 &&
			Math.abs(instance.y - part.y) < 0.01 &&
			Math.abs(instance.scale - 1) < 0.001 &&
			Math.abs(instance.rotation) < 0.001 &&
			instance.mesh.every(
				(point, index) =>
					Math.abs(point.x - mesh[index].x) < 0.01 &&
					Math.abs(point.y - mesh[index].y) < 0.01,
			)
		);
	});
	if (alreadyRestored) {
		showToast("所选组件已经是初始状态啦");
		return;
	}
	pushHistory();
	selectedInstances.forEach((instance) => {
		const { part } = instance.entry;
		instance.scale = 1;
		instance.rotation = 0;
		instance.mesh = defaultMesh(part);
		renderInstance(instance);
		applyPosition(instance, part.x, part.y);
	});
	updateSelectionUi();
	if (meshInstance) updateMeshEditor();
	showToast("所选组件已恢复原始位置、大小、角度和网格");
}

function transformSelected(action) {
	if (selectedInstances.length === 0) return;
	const before = snapshotState();
	let changed = false;
	let message = "";

	selectedInstances.forEach((instance) => {
		const beforeScale = instance.scale;
		const beforeRotation = instance.rotation;
		if (action === "shrink") {
			instance.scale = Math.max(MIN_SCALE, instance.scale - SCALE_STEP);
			message = "所选组件已缩小";
		} else if (action === "grow") {
			instance.scale = Math.min(
				maximumScale(instance.entry.part, instance.rotation),
				instance.scale + SCALE_STEP,
			);
			message = "所选组件已放大";
		} else if (action === "rotate-left") {
			instance.rotation = normalizeRotation(
				instance.rotation - ROTATION_STEP,
			);
			message = "所选组件已向左旋转";
		} else if (action === "rotate-right") {
			instance.rotation = normalizeRotation(
				instance.rotation + ROTATION_STEP,
			);
			message = "所选组件已向右旋转";
		}
		changed =
			changed ||
			Math.abs(instance.scale - beforeScale) > 0.001 ||
			Math.abs(instance.rotation - beforeRotation) > 0.001;
		applyPosition(instance, instance.x, instance.y);
	});

	if (!changed) {
		showToast(action === "grow" ? "已经放到最大啦" : "已经缩到最小啦");
		return;
	}
	pushHistory(before);
	updateSelectionUi();
	showToast(message);
}

function deleteSelected() {
	if (selectedInstances.length === 0) return;
	pushHistory();
	const removed = [...selectedInstances];
	closeMeshEditor();
	instances = instances.filter((instance) => !removed.includes(instance));
	removed.forEach((instance) => instance.element.remove());
	setSelection([]);
	updateLayerOrder();
	updateCanvasState();
	showToast(`已移除 ${removed.length} 件组件`);
}

function clearCanvas() {
	if (instances.length === 0) {
		showToast("画布已经是空的");
		return;
	}
	pushHistory();
	closeMeshEditor();
	instances = [];
	pieceStage.replaceChildren();
	setSelection([]);
	updateCanvasState();
	showToast("画布已清空，可以重新自由拼装");
}

async function exportPng() {
	if (instances.length === 0) {
		showToast("先加入一些组件再导出吧");
		return;
	}

	exportButton.disabled = true;
	exportButton.textContent = "正在导出…";
	try {
		await Promise.all(
			instances.map(async (instance) => {
				if (!instance.sourceImage.complete) {
					await instance.sourceImage.decode();
				}
				renderInstance(instance);
			}),
		);

		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = CANVAS_SIZE;
		exportCanvas.height = CANVAS_SIZE;
		const context = exportCanvas.getContext("2d");
		instances.forEach((instance) => {
			const { part } = instance.entry;
			context.save();
			context.translate(
				instance.x + part.width / 2,
				instance.y + part.height / 2,
			);
			context.rotate((instance.rotation * Math.PI) / 180);
			context.scale(instance.scale, instance.scale);
			context.drawImage(
				instance.element,
				-part.width / 2,
				-part.height / 2,
				part.width,
				part.height,
			);
			context.restore();
		});

		const blob = await new Promise((resolve) =>
			exportCanvas.toBlob(resolve, "image/png"),
		);
		if (!blob) throw new Error("PNG export failed");
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		const timestamp = new Date()
			.toISOString()
			.slice(0, 19)
			.replaceAll(":", "-");
		link.href = url;
		link.download = `枝江拼装-${timestamp}.png`;
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		showToast("已导出 1280×1280 透明背景 PNG");
	} catch (error) {
		console.error(error);
		showToast("PNG 导出失败，请稍后再试", "error");
	} finally {
		exportButton.textContent = "导出 PNG";
		exportButton.disabled = instances.length === 0;
	}
}

function handleLayerAction(event) {
	const action = event.target.closest("[data-action]")?.dataset.action;
	if (!action) return;
	if (action === "back") moveSelectedLayer(-1);
	if (action === "front") moveSelectedLayer(1);
	if (action === "restore") restoreSelected();
	if (["shrink", "grow", "rotate-left", "rotate-right"].includes(action))
		transformSelected(action);
	if (action === "delete") deleteSelected();
}

async function boot() {
	try {
		const response = await fetch(MANIFEST_URL);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		manifest = await response.json();
		manifest.characters.forEach((character) => {
			character.name =
				CHARACTER_NAMES[character.source] ?? character.name;
		});
		library = manifest.characters.flatMap((character) =>
			character.parts.map((part) => ({ character, part })),
		);
		renderFilters();
		renderParts();
		updateCanvasState();
	} catch (error) {
		console.error(error);
		statusLabel.textContent = "组件加载失败";
		selectionLabel.textContent = "请刷新页面后再试";
		boardEmpty.innerHTML =
			"<span>!</span><b>组件暂时没有加载成功</b><small>刷新页面再试一次</small>";
		showToast("组件加载失败，请刷新后重试", "error");
	}
}

board.addEventListener("dragover", (event) => {
	if (!desktopLibraryDrag) return;
	event.preventDefault();
	event.dataTransfer.dropEffect = "copy";
	board.classList.add("is-drop-target");
});
board.addEventListener("dragleave", (event) => {
	if (!board.contains(event.relatedTarget)) {
		board.classList.remove("is-drop-target");
	}
});
board.addEventListener("drop", (event) => {
	if (!desktopLibraryDrag) return;
	event.preventDefault();
	const { button, entry } = desktopLibraryDrag;
	button.classList.remove("is-library-dragging");
	board.classList.remove("is-drop-target");
	desktopLibraryDrag = null;
	addPiece(entry, dropPosition(entry, event.clientX, event.clientY));
});
board.addEventListener("pointerdown", (event) => {
	if (!event.target.closest?.(".assembly-piece, .mesh-handle"))
		setSelection([]);
});
layerControls.addEventListener("click", handleLayerAction);
undoButton.addEventListener("click", undo);
multiSelectToggle.addEventListener("click", () => {
	multiSelectMode = !multiSelectMode;
	multiSelectToggle.setAttribute("aria-pressed", String(multiSelectMode));
	multiSelectToggle.textContent = multiSelectMode ? "多选中" : "多选";
	showToast(multiSelectMode ? "多选已开启，点组件可增减选择" : "多选已关闭");
});
meshToggle.addEventListener("click", toggleMeshEditor);
exportButton.addEventListener("click", exportPng);
clearButton.addEventListener("click", clearCanvas);
themeToggle.addEventListener("click", toggleTheme);
window.addEventListener("keydown", (event) => {
	if (
		(event.ctrlKey || event.metaKey) &&
		!event.shiftKey &&
		event.key.toLowerCase() === "z"
	) {
		event.preventDefault();
		undo();
	} else if (
		(event.ctrlKey || event.metaKey) &&
		event.key.toLowerCase() === "a"
	) {
		event.preventDefault();
		setSelection([...instances], instances.at(-1) ?? null);
		showToast(`已选择全部 ${instances.length} 件组件`);
	}
});
syncThemeControl();
updateUndoState();
boot();
