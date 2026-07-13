const TARGETS = [
	{ icon: "★", points: 10, name: "星星" },
	{ icon: "🎤", points: 15, name: "话筒" },
	{ icon: "🦙", points: 20, name: "羊驼" },
	{ icon: "🥔", points: -25, name: "土豆雷", danger: true },
];

const grid = document.querySelector("#grid");
const overlay = document.querySelector("#overlay");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const soundButton = document.querySelector("#sound");
let score = 0,
	combo = 0,
	maxCombo = 0,
	playing = false,
	soundOn = true;
let endAt = 0,
	clockTimer,
	spawnTimer,
	currentTarget,
	audio;

for (let i = 0; i < 9; i += 1) {
	const hole = document.createElement("div");
	hole.className = "hole";
	grid.append(hole);
}

function tone(freq, duration = 0.1) {
	if (!soundOn) return;
	audio ||= new window.AudioContext();
	const osc = audio.createOscillator(),
		gain = audio.createGain();
	osc.frequency.value = freq;
	osc.type = "sine";
	gain.gain.setValueAtTime(0.001, audio.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
	osc.connect(gain).connect(audio.destination);
	osc.start();
	osc.stop(audio.currentTime + duration);
}

function pickTarget() {
	const random = Math.random();
	if (random < 0.18) return TARGETS[3];
	if (random < 0.42) return TARGETS[2];
	if (random < 0.7) return TARGETS[1];
	return TARGETS[0];
}

function hideTarget() {
	if (!currentTarget) return;
	const oldTarget = currentTarget;
	oldTarget.classList.remove("show");
	window.setTimeout(() => oldTarget.remove(), 170);
	currentTarget = null;
}

function spawn() {
	if (!playing) return;
	hideTarget();
	const holes = [...grid.children];
	const hole = holes[Math.floor(Math.random() * holes.length)];
	const item = pickTarget();
	const target = document.createElement("button");
	target.type = "button";
	target.className = `target${item.danger ? " danger" : ""}`;
	target.textContent = item.icon;
	target.setAttribute(
		"aria-label",
		`${item.name}，${item.points > 0 ? `加${item.points}` : `扣${Math.abs(item.points)}`}分`,
	);
	target.addEventListener("click", (event) => hit(event, item, target), {
		once: true,
	});
	hole.append(target);
	currentTarget = target;
	requestAnimationFrame(() => target.classList.add("show"));
	const pace = Math.max(470, 820 - score * 2);
	spawnTimer = window.setTimeout(spawn, pace);
}

function hit(event, item, target) {
	if (!playing || target !== currentTarget) return;
	score = Math.max(
		0,
		score + item.points + (item.danger ? 0 : Math.min(combo, 10)),
	);
	combo = item.danger ? 0 : combo + 1;
	maxCombo = Math.max(maxCombo, combo);
	scoreEl.textContent = score;
	comboEl.textContent = `×${combo}`;
	target.classList.add("hit");
	const label = document.createElement("span");
	label.className = `float-score${item.danger ? " bad" : ""}`;
	label.textContent = item.danger
		? "−25"
		: `+${item.points + Math.min(combo - 1, 10)}`;
	label.style.left = `${event.clientX - target.getBoundingClientRect().left}px`;
	label.style.top = `${event.clientY - target.getBoundingClientRect().top}px`;
	target.parentElement.append(label);
	window.setTimeout(() => label.remove(), 700);
	tone(item.danger ? 150 : 600 + combo * 20, item.danger ? 0.22 : 0.1);
	currentTarget = null;
}

function tick() {
	const left = Math.max(0, endAt - performance.now());
	timeEl.textContent = (left / 1000).toFixed(1);
	if (left <= 0) endGame();
}

function startGame() {
	score = 0;
	combo = 0;
	maxCombo = 0;
	playing = true;
	endAt = performance.now() + 30000;
	scoreEl.textContent = "0";
	comboEl.textContent = "×0";
	timeEl.textContent = "30.0";
	overlay.hidden = true;
	tone(660, 0.18);
	clockTimer = window.setInterval(tick, 50);
	spawn();
}

function endGame() {
	if (!playing) return;
	playing = false;
	window.clearInterval(clockTimer);
	window.clearTimeout(spawnTimer);
	hideTarget();
	const best = Math.max(
		score,
		Number(localStorage.getItem("bella-star-hit-best") || 0),
	);
	localStorage.setItem("bella-star-hit-best", best);
	bestEl.textContent = best;
	document.querySelector("#overlayTitle").textContent =
		score >= 300
			? "星光捕手，满分登场！"
			: score >= 150
				? "今晚的手感很闪耀"
				: "再靠近星光一点点";
	document.querySelector("#overlayText").innerHTML =
		`本轮得分 <strong>${score}</strong> · 最高连击 ×${maxCombo}<br>再挑战一次，舞台节奏会越来越快。`;
	document.querySelector("#start").textContent = "再来一局";
	overlay.hidden = false;
	tone(784, 0.25);
}

bestEl.textContent = localStorage.getItem("bella-star-hit-best") || "0";
document.querySelector("#start").addEventListener("click", startGame);
soundButton.addEventListener("click", () => {
	soundOn = !soundOn;
	soundButton.setAttribute("aria-pressed", String(soundOn));
	soundButton.setAttribute("aria-label", soundOn ? "关闭音效" : "打开音效");
	if (soundOn) tone(660);
});
