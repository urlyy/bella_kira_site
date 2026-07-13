const ROWS = 6,
	COLS = 8,
	ICONS = [
		"★",
		"♥",
		"铃",
		"羊",
		"北",
		"贝",
		"拉",
		"✦",
		"月",
		"♪",
		"羽",
		"花",
	];
let grid,
	selected = null,
	seconds = 180,
	timer,
	running = false;
const board = document.querySelector("#board"),
	leftEl = document.querySelector("#left"),
	timeEl = document.querySelector("#time"),
	svg = document.querySelector("#path");
function shuffled(a) {
	return [...a].sort(() => Math.random() - 0.5);
}
function format(s) {
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function makeGrid() {
	const values = [];
	for (let i = 0; i < (ROWS * COLS) / 2; i++)
		values.push(ICONS[i % ICONS.length], ICONS[i % ICONS.length]);
	const mix = shuffled(values);
	grid = Array.from({ length: ROWS + 2 }, () => Array(COLS + 2).fill(null));
	for (let r = 1; r <= ROWS; r++)
		for (let c = 1; c <= COLS; c++) grid[r][c] = mix.shift();
}
function render() {
	board.replaceChildren();
	for (let r = 1; r <= ROWS; r++)
		for (let c = 1; c <= COLS; c++) {
			const b = document.createElement("button");
			b.textContent = grid[r][c] || "";
			b.className = grid[r][c] ? "" : "empty";
			b.dataset.r = r;
			b.dataset.c = c;
			b.onclick = () => choose(r, c, b);
			board.append(b);
		}
	leftEl.textContent = grid.flat().filter(Boolean).length;
}
function pathBetween(a, b) {
	const queue = [{ r: a.r, c: a.c, dir: -1, turns: 0, path: [a] }],
		seen = new Map(),
		dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];
	while (queue.length) {
		const cur = queue.shift();
		for (let d = 0; d < 4; d++) {
			const turns =
				cur.dir < 0 || cur.dir === d ? cur.turns : cur.turns + 1;
			if (turns > 2) continue;
			let r = cur.r + dirs[d][0],
				c = cur.c + dirs[d][1];
			while (
				r >= 0 &&
				r < ROWS + 2 &&
				c >= 0 &&
				c < COLS + 2 &&
				(!grid[r][c] || (r === b.r && c === b.c))
			) {
				const key = `${r},${c},${d}`,
					best = seen.get(key);
				if (best === undefined || turns < best) {
					seen.set(key, turns);
					const path =
						cur.dir === d
							? [...cur.path.slice(0, -1), { r, c }]
							: [...cur.path, { r, c }];
					if (r === b.r && c === b.c) return path;
					queue.push({ r, c, dir: d, turns, path });
				}
				if (r === b.r && c === b.c) break;
				r += dirs[d][0];
				c += dirs[d][1];
			}
		}
	}
	return null;
}
function drawPath(points) {
	const wrap = document.querySelector(".board-wrap").getBoundingClientRect(),
		buttons = [...board.children];
	const coords = points.map((p) => {
		if (p.r === 0 || p.r === ROWS + 1 || p.c === 0 || p.c === COLS + 1) {
			const cell = buttons[0].getBoundingClientRect(),
				gap = 6;
			return [
				(p.c - 0.5) * (cell.width + gap) + 42,
				(p.r - 0.5) * (cell.height + gap) + 42,
			];
		}
		const el = board.querySelector(`[data-r="${p.r}"][data-c="${p.c}"]`),
			r = el.getBoundingClientRect();
		return [
			r.left - wrap.left + r.width / 2,
			r.top - wrap.top + r.height / 2,
		];
	});
	svg.innerHTML = `<polyline points="${coords.map((x) => x.join(",")).join(" ")}"/>`;
	setTimeout(() => svg.replaceChildren(), 300);
}
function choose(r, c, el) {
	if (!running || !grid[r][c]) return;
	if (!selected) {
		selected = { r, c, el };
		el.classList.add("selected");
		return;
	}
	if (selected.r === r && selected.c === c) {
		el.classList.remove("selected");
		selected = null;
		return;
	}
	const first = selected;
	first.el.classList.remove("selected");
	selected = null;
	if (grid[first.r][first.c] !== grid[r][c]) return;
	const path = pathBetween(first, { r, c });
	if (!path) return;
	drawPath(path);
	grid[first.r][first.c] = grid[r][c] = null;
	setTimeout(render, 170);
	if (grid.flat().filter(Boolean).length === 0)
		setTimeout(() => finish(true), 350);
}
function findPair() {
	for (let r = 1; r <= ROWS; r++)
		for (let c = 1; c <= COLS; c++)
			if (grid[r][c])
				for (let rr = r; rr <= ROWS; rr++)
					for (let cc = 1; cc <= COLS; cc++)
						if (
							(rr !== r || cc !== c) &&
							grid[rr][cc] === grid[r][c] &&
							pathBetween({ r, c }, { r: rr, c: cc })
						)
							return [
								{ r, c },
								{ r: rr, c: cc },
							];
	return null;
}
function hint() {
	const p = findPair();
	if (!p) return shuffle();
	p.forEach((x) =>
		board
			.querySelector(`[data-r="${x.r}"][data-c="${x.c}"]`)
			.classList.add("hint"),
	);
	setTimeout(
		() =>
			document
				.querySelectorAll(".hint")
				.forEach((x) => x.classList.remove("hint")),
		1200,
	);
}
function shuffle() {
	const cells = [];
	for (let r = 1; r <= ROWS; r++)
		for (let c = 1; c <= COLS; c++) if (grid[r][c]) cells.push(grid[r][c]);
	const mix = shuffled(cells);
	for (let r = 1; r <= ROWS; r++)
		for (let c = 1; c <= COLS; c++)
			if (grid[r][c]) grid[r][c] = mix.shift();
	render();
	if (!findPair()) shuffle();
}
function finish(win) {
	running = false;
	clearInterval(timer);
	document.querySelector("#result").textContent = win
		? "星轨全部连通"
		: "时间到了";
	document.querySelector("#summary").textContent = win
		? `剩余时间 ${format(seconds)}`
		: "再试一次，这次一定可以";
	document.querySelector("#modal").hidden = false;
}
function start() {
	clearInterval(timer);
	makeGrid();
	selected = null;
	seconds = 180;
	running = true;
	document.querySelector("#modal").hidden = true;
	render();
	if (!findPair()) shuffle();
	timeEl.textContent = format(seconds);
	timer = setInterval(() => {
		seconds--;
		timeEl.textContent = format(seconds);
		if (seconds <= 0) finish(false);
	}, 1000);
}
document.querySelector("#hint").onclick = hint;
document.querySelector("#shuffle").onclick = shuffle;
document.querySelector("#restart").onclick = start;
document.querySelector("#again").onclick = start;
start();
