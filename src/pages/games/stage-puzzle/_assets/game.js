const IMAGE_LIBRARY = [
	{
		id: "birthday-poster",
		title: "六周年生日会海报",
		source: "/assets/optimized/game-bg.webp",
	},
	// 后续图片：{ id: "唯一名称", title: "显示名称", source: "图片路径" }
];

const boardEl = document.querySelector("#board");
const movesEl = document.querySelector("#moves");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const difficulty = document.querySelector("#difficulty");
const imageSelect = document.querySelector("#imageSelect");
const imageUpload = document.querySelector("#imageUpload");
const original = document.querySelector("#original");
const originalImage = document.querySelector("#originalImage");
const preview = document.querySelector("#preview");
const modal = document.querySelector("#winModal");
let size = 3,
	board = [],
	moves = 0,
	startedAt = 0,
	timer;
let currentImage = IMAGE_LIBRARY[0],
	splitResult = null,
	uploadedUrl = null,
	gameVersion = 0;

function populateImageLibrary() {
	imageSelect.replaceChildren();
	IMAGE_LIBRARY.forEach((image) => {
		const option = document.createElement("option");
		option.value = image.id;
		option.textContent = image.title;
		imageSelect.append(option);
	});
}

function formatTime(seconds) {
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function adjacentIndices(index) {
	const row = Math.floor(index / size),
		col = index % size,
		result = [];
	if (row > 0) result.push(index - size);
	if (row < size - 1) result.push(index + size);
	if (col > 0) result.push(index - 1);
	if (col < size - 1) result.push(index + 1);
	return result;
}

function shuffleSolvable() {
	board = [...Array(size * size - 1).keys(), null];
	let empty = board.length - 1,
		previous = -1;
	const turns = size === 3 ? 90 : 180;
	for (let i = 0; i < turns; i += 1) {
		const choices = adjacentIndices(empty).filter(
			(index) => index !== previous,
		);
		const next = choices[Math.floor(Math.random() * choices.length)];
		[board[empty], board[next]] = [board[next], board[empty]];
		previous = empty;
		empty = next;
	}
}

function isSolvableLayout(layout) {
	const values = layout.filter((value) => value !== null);
	let inversions = 0;
	for (let i = 0; i < values.length; i += 1) {
		for (let j = i + 1; j < values.length; j += 1) {
			if (values[i] > values[j]) inversions += 1;
		}
	}
	if (size % 2 === 1) return inversions % 2 === 0;
	const blankRowFromBottom = size - Math.floor(layout.indexOf(null) / size);
	return (blankRowFromBottom % 2 === 0) !== (inversions % 2 === 0);
}

function isSolved() {
	return board.every((value, index) =>
		index === board.length - 1 ? value === null : value === index,
	);
}

function buildBoard() {
	boardEl.replaceChildren();
	boardEl.style.setProperty("--size", size);
	const slot = document.createElement("div");
	slot.className = "empty-slot";
	slot.id = "emptySlot";
	boardEl.append(slot);

	splitResult.tiles.slice(0, -1).forEach((crop, tileNumber) => {
		const tile = document.createElement("button");
		tile.type = "button";
		tile.className = "tile";
		tile.dataset.tile = String(tileNumber);
		tile.style.backgroundImage = `url("${crop.source}")`;
		tile.style.backgroundSize = crop.backgroundSize;
		tile.style.backgroundPosition = crop.backgroundPosition;
		tile.setAttribute("aria-label", `拼图碎片 ${tileNumber + 1}`);
		tile.addEventListener("click", () =>
			moveTile(board.indexOf(tileNumber)),
		);
		boardEl.append(tile);
	});
	updateBoardPositions();
}

function updateBoardPositions() {
	const empty = board.indexOf(null);
	const slot = document.querySelector("#emptySlot");
	slot.style.gridColumn = String((empty % size) + 1);
	slot.style.gridRow = String(Math.floor(empty / size) + 1);
	board.forEach((tileNumber, index) => {
		if (tileNumber === null) return;
		const tile = boardEl.querySelector(`[data-tile="${tileNumber}"]`);
		tile.style.gridColumn = String((index % size) + 1);
		tile.style.gridRow = String(Math.floor(index / size) + 1);
	});
}

function startClock() {
	if (startedAt) return;
	startedAt = Date.now();
	timer = window.setInterval(
		() =>
			(timeEl.textContent = formatTime(
				Math.floor((Date.now() - startedAt) / 1000),
			)),
		1000,
	);
}

function moveTile(index) {
	const empty = board.indexOf(null);
	if (!adjacentIndices(empty).includes(index)) return;
	startClock();
	[board[empty], board[index]] = [board[index], board[empty]];
	moves += 1;
	movesEl.textContent = moves;
	updateBoardPositions();
	if (isSolved()) window.setTimeout(showWin, 250);
}

function bestKey() {
	return `bella-puzzle-${currentImage.id}-${size}-best`;
}

function showWin() {
	window.clearInterval(timer);
	const seconds = Math.floor((Date.now() - startedAt) / 1000);
	const previous = Number(localStorage.getItem(bestKey()) || 0);
	if (!previous || moves < previous) localStorage.setItem(bestKey(), moves);
	document.querySelector("#summary").textContent =
		`${moves} 步 · 用时 ${formatTime(seconds)}`;
	modal.hidden = false;
	updateBest();
}

function updateBest() {
	const value = localStorage.getItem(bestKey());
	bestEl.textContent = value ? `${value} 步` : "—";
}

async function newGame() {
	const version = ++gameVersion;
	window.clearInterval(timer);
	size = Number(difficulty.value);
	moves = 0;
	startedAt = 0;
	movesEl.textContent = "0";
	timeEl.textContent = "00:00";
	modal.hidden = true;
	original.hidden = true;
	preview.setAttribute("aria-pressed", "false");
	preview.textContent = "查看原图";
	boardEl.setAttribute("aria-busy", "true");
	try {
		const result = await window.ImageSplitter.splitImage(
			currentImage.source,
			size,
		);
		if (version !== gameVersion) return;
		splitResult = result;
		boardEl.style.aspectRatio = String(result.aspectRatio);
		originalImage.src = currentImage.source;
		originalImage.alt = `${currentImage.title}完整原图`;
		do shuffleSolvable();
		while (isSolved() || !isSolvableLayout(board));
		buildBoard();
		updateBest();
	} catch (error) {
		boardEl.replaceChildren();
		boardEl.textContent = error.message;
	} finally {
		if (version === gameVersion) boardEl.removeAttribute("aria-busy");
	}
}

imageSelect.addEventListener("change", () => {
	currentImage =
		IMAGE_LIBRARY.find((image) => image.id === imageSelect.value) ||
		IMAGE_LIBRARY[0];
	newGame();
});

imageUpload.addEventListener("change", () => {
	const file = imageUpload.files?.[0];
	if (!file) return;
	if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
	uploadedUrl = URL.createObjectURL(file);
	currentImage = {
		id: `upload-${file.name}`,
		title: file.name,
		source: uploadedUrl,
	};
	let option = imageSelect.querySelector("option[data-upload]");
	if (!option) {
		option = document.createElement("option");
		option.dataset.upload = "true";
		imageSelect.append(option);
	}
	option.value = currentImage.id;
	option.textContent = `已上传 · ${file.name}`;
	imageSelect.value = currentImage.id;
	newGame();
});

preview.addEventListener("click", () => {
	const showing = original.hidden;
	original.hidden = !showing;
	preview.setAttribute("aria-pressed", String(showing));
	preview.textContent = showing ? "返回拼图" : "查看原图";
});
document.querySelector("#shuffle").addEventListener("click", newGame);
document.querySelector("#again").addEventListener("click", newGame);
difficulty.addEventListener("change", newGame);
originalImage.addEventListener("dragstart", (event) => event.preventDefault());
populateImageLibrary();
newGame();
