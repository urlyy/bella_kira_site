const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const IMAGE_LIBRARY = [
  { id: "birthday-poster", title: "2026 生日舞台海报", source: "/assets/26生日海报-无字.png" },
  { id: "bella-stage", title: "贝拉舞台写真", source: "/assets/91FB39CFE72B76E6E7FF7A5576E2334E.jpg" },
  { id: "bella-moment", title: "贝拉光影片段", source: "/assets/10EEE9DB206443E37AB036E5A8150DC6.jpg" },
];

const $ = selector => document.querySelector(selector);
const boardEl = $("#board"), trayEl = $("#tray"), playArea = $("#playArea");
const imageSelect = $("#imageSelect"), difficulty = $("#difficulty"), upload = $("#imageUpload");
const placedEl = $("#placed"), timeEl = $("#time"), preview = $("#preview"), original = $("#original");
let currentImage = IMAGE_LIBRARY[0], result, pieces = [], uploadedUrl, timer, startedAt = 0, version = 0, gameReady = false, previewVisible = false;

IMAGE_LIBRARY.forEach(item => imageSelect.add(new Option(item.title, item.id)));
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function startClock() {
  if (startedAt) return;
  startedAt = Date.now();
  timer = setInterval(() => timeEl.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000)), 1000);
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function makePiece(piece) {
  const scaleX = boardEl.clientWidth / result.width;
  const scaleY = boardEl.clientHeight / result.height;
  const paddingX = piece.padding * scaleX;
  const paddingY = piece.padding * scaleY;
  const element = document.createElement("div");
  element.className = "piece";
  element.dataset.id = piece.id;
  element.style.width = `${piece.width * scaleX + paddingX * 2}px`;
  element.style.height = `${piece.height * scaleY + paddingY * 2}px`;
  const svg = svgElement("svg", { viewBox: `0 0 ${piece.width + piece.padding * 2} ${piece.height + piece.padding * 2}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  const defs = svgElement("defs"), clip = svgElement("clipPath", { id: `clip-${version}-${piece.id}` });
  clip.append(svgElement("path", { d: piece.path })); defs.append(clip); svg.append(defs);
  const image = svgElement("image", {
    x: piece.padding - piece.x, y: piece.padding - piece.y,
    width: result.width, height: result.height,
    preserveAspectRatio: "none", "clip-path": `url(#clip-${version}-${piece.id})`,
  });
  image.setAttributeNS(XLINK_NS, "href", result.source);
  image.setAttribute("href", result.source);
  svg.append(image, svgElement("path", { d: piece.path, class: "piece-line" }));
  element.append(svg);
  element.addEventListener("pointerdown", event => beginDrag(event, element));
  return { ...piece, element, scaleX, scaleY, paddingX, paddingY, placed: false, dragX: 0, dragY: 0 };
}

function targetPosition(piece) {
  const boardBox = boardEl.getBoundingClientRect(), areaBox = playArea.getBoundingClientRect();
  const contentLeft = boardBox.left - areaBox.left + boardEl.clientLeft - playArea.clientLeft;
  const contentTop = boardBox.top - areaBox.top + boardEl.clientTop - playArea.clientTop;
  return {
    x: contentLeft + piece.x * piece.scaleX - piece.paddingX,
    y: contentTop + piece.y * piece.scaleY - piece.paddingY,
  };
}

function setPosition(state, x, y) {
  state.dragX = x; state.dragY = y;
  state.element.style.transform = `translate3d(${x}px,${y}px,0)`;
}

function isAtCorrectTarget(state, target) {
  const distance = Math.hypot(state.dragX - target.x, state.dragY - target.y);
  const shortestSide = Math.min(state.width * state.scaleX, state.height * state.scaleY);
  const snapRadius = Math.max(34, shortestSide * .38);
  return distance <= snapRadius;
}

function scatterPieces() {
  const areaWidth = playArea.clientWidth, trayTop = trayEl.offsetTop, trayHeight = trayEl.clientHeight;
  const shuffled = [...pieces].sort(() => Math.random() - 0.5);
  shuffled.forEach((piece, index) => {
    piece.placed = false; piece.element.classList.remove("placed");
    piece.element.style.pointerEvents = ""; piece.element.removeAttribute("aria-disabled");
    const columns = Math.max(3, Math.floor(areaWidth / (piece.element.offsetWidth * 0.82)));
    const col = index % columns, row = Math.floor(index / columns);
    const x = 8 + col * ((areaWidth - piece.element.offsetWidth - 16) / Math.max(columns - 1, 1)) + (Math.random() - .5) * 12;
    const rows = Math.ceil(pieces.length / columns);
    const y = trayTop + 5 + row * ((trayHeight - piece.element.offsetHeight - 10) / Math.max(rows - 1, 1)) + (Math.random() - .5) * 8;
    setPosition(piece, x, y);
  });
  updatePlaced();
}

function beginDrag(event, element) {
  const state = pieces.find(item => item.element === element);
  if (!gameReady || !state || state.placed) return;
  event.preventDefault(); startClock(); element.setPointerCapture(event.pointerId); element.classList.add("dragging");
  const startX = event.clientX, startY = event.clientY, originX = state.dragX, originY = state.dragY;
  const move = e => setPosition(state, originX + e.clientX - startX, originY + e.clientY - startY);
  const end = () => {
    element.classList.remove("dragging"); element.removeEventListener("pointermove", move); element.removeEventListener("pointerup", end); element.removeEventListener("pointercancel", end);
    const target = targetPosition(state);
    if (isAtCorrectTarget(state, target)) {
      setPosition(state, target.x, target.y); state.placed = true; element.classList.add("placed");
      element.style.pointerEvents = "none"; element.setAttribute("aria-disabled", "true"); updatePlaced();
      if (pieces.every(piece => piece.placed)) win();
    }
  };
  element.addEventListener("pointermove", move); element.addEventListener("pointerup", end); element.addEventListener("pointercancel", end);
}

function updatePlaced() { placedEl.textContent = `${pieces.filter(piece => piece.placed).length} / ${pieces.length}`; }

function renderPreviewState() {
  original.hidden = !previewVisible;
  preview.textContent = previewVisible ? "返回拼图" : "查看原图";
  preview.setAttribute("aria-pressed", String(previewVisible));
}

async function newGame(recut = true) {
  const ownVersion = ++version; gameReady = false; clearInterval(timer); startedAt = 0; timeEl.textContent = "00:00"; $("#winModal").hidden = true;
  renderPreviewState(); playArea.setAttribute("aria-busy", "true");
  try {
    const size = Number(difficulty.value);
    result = await window.JigsawSplitter.splitImage(currentImage.source, size, size, recut ? undefined : result?.seed);
    if (ownVersion !== version) return;
    if (!window.JigsawSplitter.validateSplit(result)) throw new Error("本局拼图校验未通过，请重新生成");
    const boardWidth = Math.min(430, playArea.clientWidth * .76, 400 * result.aspectRatio);
    const boardHeight = boardWidth / result.aspectRatio;
    playArea.style.setProperty("--board-width", `${boardWidth}px`);
    playArea.style.setProperty("--board-height", `${boardHeight}px`);
    boardEl.style.aspectRatio = result.aspectRatio; $("#guideImage").src = result.source; $("#originalImage").src = result.source;
    playArea.style.setProperty("--board-ratio", result.aspectRatio);
    trayEl.replaceChildren(); pieces.forEach(piece => piece.element.remove());
    pieces = result.pieces.map(makePiece); pieces.forEach(piece => playArea.append(piece.element));
    requestAnimationFrame(() => { scatterPieces(); gameReady = true; });
  } catch (error) { trayEl.textContent = error.message; }
  finally { if (ownVersion === version) playArea.removeAttribute("aria-busy"); }
}

function win() {
  clearInterval(timer); const seconds = Math.floor((Date.now() - startedAt) / 1000);
  $("#summary").textContent = `${pieces.length} 块碎片 · 用时 ${formatTime(seconds)}`;
  setTimeout(() => $("#winModal").hidden = false, 350);
}

imageSelect.addEventListener("change", () => { currentImage = IMAGE_LIBRARY.find(item => item.id === imageSelect.value) || currentImage; newGame(); });
upload.addEventListener("change", () => {
  const file = upload.files?.[0]; if (!file) return;
  if (uploadedUrl) URL.revokeObjectURL(uploadedUrl); uploadedUrl = URL.createObjectURL(file);
  currentImage = { id: `upload-${file.name}`, title: file.name, source: uploadedUrl };
  let option = imageSelect.querySelector("[data-upload]"); if (!option) { option = new Option(); option.dataset.upload = "true"; imageSelect.add(option); }
  option.value = currentImage.id; option.textContent = `已上传 · ${file.name}`; imageSelect.value = currentImage.id; newGame();
});
difficulty.addEventListener("change", () => newGame());
$("#recut").addEventListener("click", () => newGame(true));
$("#shuffle").addEventListener("click", () => { clearInterval(timer); startedAt = 0; timeEl.textContent = "00:00"; scatterPieces(); });
$("#again").addEventListener("click", () => newGame(true));
preview.addEventListener("click", () => { previewVisible = !previewVisible; renderPreviewState(); });
document.querySelectorAll("img").forEach(image => image.addEventListener("dragstart", event => event.preventDefault()));
newGame();
