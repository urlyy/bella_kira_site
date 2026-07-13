const canvas = document.querySelector("#canvas"),
	ctx = canvas.getContext("2d"),
	W = 480,
	H = 660,
	R = 22,
	COLS = 10,
	ROW_H = 38,
	COLORS = ["#9e7bea", "#e66fa9", "#68c9e7", "#f1c86b", "#8bd29b"];
let grid = [],
	shot = null,
	current = 0,
	next = 1,
	aim = { x: W / 2, y: 200 },
	score = 0,
	running = true;
function key(r, c) {
	return `${r},${c}`;
}
function center(r, c) {
	return { x: R + c * R * 2 + (r % 2 ? R : 0), y: R + 8 + r * ROW_H };
}
function valid(r, c) {
	return r >= 0 && c >= 0 && c < COLS - (r % 2);
}
function neighbors(r, c) {
	return r % 2
		? [
				[r, c - 1],
				[r, c + 1],
				[r - 1, c],
				[r - 1, c + 1],
				[r + 1, c],
				[r + 1, c + 1],
			]
		: [
				[r, c - 1],
				[r, c + 1],
				[r - 1, c - 1],
				[r - 1, c],
				[r + 1, c - 1],
				[r + 1, c],
			];
}
function start() {
	grid = [];
	for (let r = 0; r < 6; r++)
		for (let c = 0; c < COLS - (r % 2); c++)
			grid.push({ r, c, color: Math.floor(Math.random() * 4) });
	shot = null;
	score = 0;
	running = true;
	current = Math.floor(Math.random() * 4);
	next = Math.floor(Math.random() * 4);
	document.querySelector("#score").textContent = 0;
	document.querySelector("#modal").hidden = true;
	updateNext();
}
function updateNext() {
	const el = document.querySelector("#next");
	el.style.background = COLORS[next];
	el.style.color = COLORS[next];
}
function cellAt(r, c) {
	return grid.find((b) => b.r === r && b.c === c);
}
function occupiedNear(x, y) {
	return grid.find((b) => {
		const p = center(b.r, b.c);
		return Math.hypot(x - p.x, y - p.y) < R * 1.8;
	});
}
function fire() {
	if (!running || shot) return;
	const base = { x: W / 2, y: H - 42 },
		dx = aim.x - base.x,
		dy = Math.min(-20, aim.y - base.y),
		len = Math.hypot(dx, dy);
	shot = {
		x: base.x,
		y: base.y,
		vx: (dx / len) * 8,
		vy: (dy / len) * 8,
		color: current,
	};
	current = next;
	next = Math.floor(Math.random() * COLORS.length);
	updateNext();
}
function snap() {
	let best = null,
		dist = Infinity;
	for (let r = 0; r < 15; r++)
		for (let c = 0; c < COLS - (r % 2); c++)
			if (!cellAt(r, c)) {
				const p = center(r, c),
					d = Math.hypot(shot.x - p.x, shot.y - p.y);
				if (d < dist) {
					dist = d;
					best = { r, c };
				}
			}
	if (!best) return;
	grid.push({ ...best, color: shot.color });
	shot = null;
	resolve(best);
}
function cluster(start, color) {
	const found = [],
		stack = [start],
		seen = new Set();
	while (stack.length) {
		const a = stack.pop(),
			k = key(a.r, a.c);
		if (seen.has(k)) continue;
		seen.add(k);
		const b = cellAt(a.r, a.c);
		if (!b || b.color !== color) continue;
		found.push(b);
		neighbors(a.r, a.c).forEach(([r, c]) => stack.push({ r, c }));
	}
	return found;
}
function resolve(pos) {
	const b = cellAt(pos.r, pos.c),
		same = cluster(pos, b.color);
	if (same.length >= 3) {
		grid = grid.filter((x) => !same.includes(x));
		const connected = new Set(),
			stack = grid.filter((x) => x.r === 0);
		while (stack.length) {
			const a = stack.pop(),
				k = key(a.r, a.c);
			if (connected.has(k)) continue;
			connected.add(k);
			neighbors(a.r, a.c).forEach(([r, c]) => {
				const n = cellAt(r, c);
				if (n && !connected.has(key(r, c))) stack.push(n);
			});
		}
		const floating = grid.filter((x) => !connected.has(key(x.r, x.c)));
		grid = grid.filter((x) => connected.has(key(x.r, x.c)));
		score += same.length * 10 + floating.length * 20;
		document.querySelector("#score").textContent = score;
	}
	if (grid.length === 0) finish(true);
	else if (grid.some((x) => center(x.r, x.c).y > H - 115)) finish(false);
}
function finish(win) {
	running = false;
	document.querySelector("#title").textContent = win
		? "舞台清空！"
		: "星泡压下来啦";
	document.querySelector("#summary").textContent = `本次获得 ${score} 分`;
	document.querySelector("#modal").hidden = false;
}
function update() {
	if (!shot) return;
	shot.x += shot.vx;
	shot.y += shot.vy;
	if (shot.x < R || shot.x > W - R) {
		shot.vx *= -1;
		shot.x = Math.max(R, Math.min(W - R, shot.x));
	}
	if (shot.y <= R + 8 || occupiedNear(shot.x, shot.y)) snap();
}
function bubble(x, y, color) {
	const g = ctx.createRadialGradient(x - 7, y - 8, 2, x, y, R);
	g.addColorStop(0, "#fff");
	g.addColorStop(0.18, COLORS[color]);
	g.addColorStop(1, "#21113b");
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y, R - 1, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#ffffff55";
	ctx.stroke();
	ctx.fillStyle = "#fff";
	ctx.font = "15px sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("✦", x, y);
}
function draw() {
	ctx.clearRect(0, 0, W, H);
	grid.forEach((b) => {
		const p = center(b.r, b.c);
		bubble(p.x, p.y, b.color);
	});
	const base = { x: W / 2, y: H - 42 },
		angle = Math.atan2(aim.y - base.y, aim.x - base.x);
	ctx.strokeStyle = "#ffffff55";
	ctx.setLineDash([6, 8]);
	ctx.beginPath();
	ctx.moveTo(base.x, base.y);
	ctx.lineTo(base.x + Math.cos(angle) * 150, base.y + Math.sin(angle) * 150);
	ctx.stroke();
	ctx.setLineDash([]);
	bubble(base.x, base.y, current);
	if (shot) bubble(shot.x, shot.y, shot.color);
}
function loop() {
	if (running) update();
	draw();
	requestAnimationFrame(loop);
}
function point(e) {
	const r = canvas.getBoundingClientRect();
	aim = {
		x: ((e.clientX - r.left) * W) / r.width,
		y: ((e.clientY - r.top) * H) / r.height,
	};
}
canvas.addEventListener("pointermove", point);
canvas.addEventListener("pointerdown", (e) => {
	point(e);
	fire();
});
document.querySelector("#restart").onclick = start;
document.querySelector("#again").onclick = start;
start();
loop();
