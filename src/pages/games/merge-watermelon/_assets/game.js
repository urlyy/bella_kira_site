const canvas = document.querySelector("#canvas"),
	ctx = canvas.getContext("2d"),
	W = canvas.width,
	H = canvas.height;
const ITEMS = [
	["✦", 16, "#c9b7ff"],
	["★", 22, "#a98cf5"],
	["北", 29, "#8271e8"],
	["铃", 37, "#e878b2"],
	["羊", 47, "#f0a3c9"],
	["贝", 59, "#8cd6f0"],
	["拉", 73, "#b9a3ff"],
	["♥", 88, "#ed6fa8"],
	["星", 105, "#ffe9a8"],
];
const DANGER_LINE = 72,
	DROP_COOLDOWN = 260,
	OVERFLOW_GRACE = 1100;
let balls = [],
	next = 0,
	aim = W / 2,
	score = 0,
	running = true,
	last = 0,
	lastDropAt = -Infinity;
const scoreEl = document.querySelector("#score"),
	bestEl = document.querySelector("#best");
document.querySelector("#levels").innerHTML = ITEMS.map(
	(x) => `<li style="color:${x[2]}">${x[0]}</li>`,
).join("");
bestEl.textContent = localStorage.getItem("bella-merge-best") || 0;
function reset() {
	balls = [];
	next = Math.random() < 0.8 ? 0 : 1;
	score = 0;
	running = true;
	lastDropAt = -Infinity;
	scoreEl.textContent = 0;
	document.querySelector("#over").hidden = true;
}
function drop() {
	const now = performance.now();
	if (!running || now - lastDropAt < DROP_COOLDOWN) return;
	lastDropAt = now;
	const r = ITEMS[next][1];
	balls.push({
		x: Math.max(r, Math.min(W - r, aim)),
		y: 42,
		r,
		level: next,
		vx: 0,
		vy: 1,
		entered: false,
		overflowFor: 0,
	});
	next = Math.random() < 0.74 ? 0 : Math.random() < 0.82 ? 1 : 2;
}
function merge(a, b) {
	const level = Math.min(a.level + 1, ITEMS.length - 1);
	const ball = {
		x: (a.x + b.x) / 2,
		y: (a.y + b.y) / 2,
		r: ITEMS[level][1],
		level,
		vx: (a.vx + b.vx) / 2,
		vy: -2,
		entered: a.entered || b.entered,
		overflowFor: 0,
	};
	balls = balls.filter((x) => x !== a && x !== b);
	balls.push(ball);
	score += 2 ** level * 10;
	scoreEl.textContent = score;
}
function update(dt) {
	for (const b of balls) {
		b.vy += 0.16 * dt;
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		b.vx *= 0.995;
		if (b.x - b.r < 0) {
			b.x = b.r;
			b.vx = Math.abs(b.vx) * 0.45;
		}
		if (b.x + b.r > W) {
			b.x = W - b.r;
			b.vx = -Math.abs(b.vx) * 0.45;
		}
		if (b.y + b.r > H) {
			b.y = H - b.r;
			b.vy *= -0.24;
			if (Math.abs(b.vy) < 0.35) b.vy = 0;
		}
		if (b.y - b.r >= DANGER_LINE) b.entered = true;
	}
	for (let i = 0; i < balls.length; i++)
		for (let j = i + 1; j < balls.length; j++) {
			const a = balls[i],
				b = balls[j],
				dx = b.x - a.x,
				dy = b.y - a.y,
				d = Math.hypot(dx, dy),
				min = a.r + b.r;
			if (d < min && d) {
				if (a.level === b.level && a.level < ITEMS.length - 1) {
					merge(a, b);
					return;
				}
				const nx = dx / d,
					ny = dy / d,
					p = (min - d) / 2;
				a.x -= nx * p;
				a.y -= ny * p;
				b.x += nx * p;
				b.y += ny * p;
				const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
				if (rel < 0) {
					const impulse = -rel * 0.58;
					a.vx -= impulse * nx;
					a.vy -= impulse * ny;
					b.vx += impulse * nx;
					b.vy += impulse * ny;
				}
			}
		}
	for (const b of balls) {
		const overflowing = b.entered && b.y - b.r < DANGER_LINE;
		if (overflowing) {
			b.overflowFor += dt * 16.67;
		} else {
			b.overflowFor = 0;
		}
	}
	if (balls.some((b) => b.overflowFor >= OVERFLOW_GRACE)) {
		running = false;
		const best = Math.max(
			score,
			Number(localStorage.getItem("bella-merge-best") || 0),
		);
		localStorage.setItem("bella-merge-best", best);
		bestEl.textContent = best;
		document.querySelector("#summary").textContent = `本次获得 ${score} 分`;
		document.querySelector("#over").hidden = false;
	}
}
function draw() {
	ctx.clearRect(0, 0, W, H);
	ctx.strokeStyle = "#ef9fbd66";
	ctx.setLineDash([8, 8]);
	ctx.beginPath();
	ctx.moveTo(0, DANGER_LINE);
	ctx.lineTo(W, DANGER_LINE);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 0.38;
	ctx.beginPath();
	ctx.moveTo(aim, 0);
	ctx.lineTo(aim, DANGER_LINE);
	ctx.strokeStyle = "#fff";
	ctx.stroke();
	ctx.globalAlpha = 1;
	for (const b of balls) {
		const item = ITEMS[b.level],
			g = ctx.createRadialGradient(
				b.x - b.r * 0.3,
				b.y - b.r * 0.35,
				1,
				b.x,
				b.y,
				b.r,
			);
		g.addColorStop(0, "#fff");
		g.addColorStop(0.18, item[2]);
		g.addColorStop(1, "#2b1748");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "#ffffff55";
		ctx.stroke();
		ctx.fillStyle = "#fff";
		ctx.font = `700 ${Math.max(13, b.r * 0.62)}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(item[0], b.x, b.y + 1);
	}
}
function loop(t) {
	const dt = Math.min(2, (t - last) / 16.67 || 1);
	last = t;
	if (running) update(dt);
	draw();
	requestAnimationFrame(loop);
}
function point(e) {
	const r = canvas.getBoundingClientRect();
	aim = ((e.clientX - r.left) * W) / r.width;
}
canvas.addEventListener("pointermove", point);
canvas.addEventListener("pointerdown", (e) => {
	point(e);
	drop();
});
document.querySelector("#restart").onclick = reset;
document.querySelector("#again").onclick = reset;
reset();
requestAnimationFrame(loop);
