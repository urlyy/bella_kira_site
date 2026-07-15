const gameData = JSON.parse(
	document.querySelector("#superchat-data").textContent,
);
const messagesByPrice = new Map();

for (const message of gameData.messages) {
	const group = messagesByPrice.get(message.price) || [];
	group.push(message);
	messagesByPrice.set(message.price, group);
}

const stage = document.querySelector("#stage");
const dropLayer = document.querySelector("#drop-layer");
const player = document.querySelector("#bella-player");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start-button");
const wealthElement = document.querySelector("#wealth");
const caughtElement = document.querySelector("#caught");
const bestElement = document.querySelector("#best");
const shameLabel = document.querySelector("#shame-label");
const shameTrack = document.querySelector("#shame-track");
const shameFill = document.querySelector("#shame-fill");
const reaction = document.querySelector("#reaction");
const reactionText = document.querySelector("#reaction-text");
const lastPrice = document.querySelector("#last-price");
const lastMessage = document.querySelector("#last-message");
const toast = document.querySelector("#game-toast");
const toastMessage = document.querySelector("#toast-message");
const soundToggle = document.querySelector("#sound-toggle");

const keys = { left: false, right: false };
const drops = [];
let playing = false;
let wealth = 0;
let shame = 0;
let caught = 0;
let missed = 0;
let playerX = 0;
let lastFrame = 0;
let gameStartedAt = 0;
let nextSpawnAt = 0;
let frameId = 0;
let toastTimer = 0;
let reactionTimer = 0;
let audioContext;
let soundOn = true;
let dragging = false;

function readBest() {
	try {
		return Number(localStorage.getItem("bella-superchat-catch-best") || 0);
	} catch {
		return 0;
	}
}

function saveBest(value) {
	try {
		localStorage.setItem("bella-superchat-catch-best", String(value));
	} catch {}
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
	return min + Math.random() * (max - min);
}

function tone(frequency, duration = 0.1, volume = 0.08) {
	if (!soundOn) return;
	audioContext ||= new window.AudioContext();
	const oscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();
	const now = audioContext.currentTime;
	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(frequency, now);
	gain.gain.setValueAtTime(0.001, now);
	gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
	oscillator.connect(gain).connect(audioContext.destination);
	oscillator.start(now);
	oscillator.stop(now + duration + 0.02);
}

function playCatchTone(price) {
	const lift = Math.min(380, Math.log10(price) * 150);
	tone(480 + lift, 0.09, 0.07);
	window.setTimeout(() => tone(650 + lift, 0.12, 0.06), 55);
}

function showToast(message, state = "success") {
	window.clearTimeout(toastTimer);
	toastMessage.textContent = message;
	toast.dataset.state = state;
	toast.classList.add("is-visible");
	toastTimer = window.setTimeout(() => {
		toast.classList.remove("is-visible");
	}, 1500);
}

function showReaction(text) {
	window.clearTimeout(reactionTimer);
	reactionText.textContent = text;
	reaction.classList.add("is-speaking");
	reactionTimer = window.setTimeout(() => {
		reaction.classList.remove("is-speaking");
	}, 2100);
}

function updateHud() {
	wealthElement.textContent = wealth.toLocaleString("zh-CN");
	caughtElement.textContent = String(caught);
	const roundedShame = Math.min(100, Math.round(shame));
	shameLabel.textContent = `${roundedShame}%`;
	shameFill.style.width = `${clamp(shame, 0, 100)}%`;
	shameTrack.setAttribute("aria-valuenow", String(roundedShame));
	shameTrack.dataset.level =
		roundedShame >= 80 ? "critical" : roundedShame >= 55 ? "warm" : "calm";
}

function pickTier() {
	const total = gameData.tiers.reduce((sum, tier) => sum + tier.chance, 0);
	let roll = Math.random() * total;
	for (const tier of gameData.tiers) {
		roll -= tier.chance;
		if (roll <= 0) return tier;
	}
	return gameData.tiers[0];
}

function createDrop() {
	if (!playing) return;
	const tier = pickTier();
	const messages = messagesByPrice.get(tier.price);
	const message = messages[Math.floor(Math.random() * messages.length)];
	const card = document.createElement("div");
	card.className = "superchat";
	card.dataset.price = String(message.price);
	card.style.setProperty("--sc-panel", tier.panel);
	card.style.setProperty("--sc-header", tier.header);
	card.style.setProperty("--sc-body", tier.body);
	card.innerHTML = `
		<strong>¥${message.price}</strong>
		<p>${message.message}</p>
	`;
	card.setAttribute(
		"aria-label",
		`${message.price}元醒目留言：${message.message}`,
	);
	dropLayer.append(card);

	const stageWidth = stage.clientWidth;
	const width = card.offsetWidth;
	const elapsed = (performance.now() - gameStartedAt) / 1000;
	const drop = {
		element: card,
		message,
		tier,
		x: randomBetween(10, Math.max(11, stageWidth - width - 10)),
		y: -card.offsetHeight - 8,
		width,
		height: card.offsetHeight,
		speed:
			randomBetween(112, 145) +
			Math.min(46, elapsed * 0.45) -
			Math.log10(message.price) * 4,
	};
	drops.push(drop);
	paintDrop(drop);
}

function paintDrop(drop) {
	drop.element.style.transform = `translate3d(${drop.x}px, ${drop.y}px, 0)`;
}

function removeDrop(drop, index) {
	drop.element.remove();
	drops.splice(index, 1);
}

function makeBurst(drop) {
	const burst = document.createElement("span");
	burst.className = "catch-burst";
	burst.textContent = `+¥${drop.message.price}`;
	burst.style.left = `${drop.x + drop.width / 2}px`;
	burst.style.top = `${drop.y + drop.height / 2}px`;
	stage.append(burst);
	window.setTimeout(() => burst.remove(), 760);
}

function catchDrop(drop, index) {
	wealth += drop.message.price;
	shame = Math.min(100, shame + drop.message.shame);
	caught += 1;
	lastPrice.textContent = `+ ¥${drop.message.price}`;
	lastMessage.textContent = drop.message.message;
	lastPrice.style.color = drop.tier.panel;
	showReaction(drop.message.reaction);
	showToast(
		`接住 ¥${drop.message.price} · 羞耻 +${drop.message.shame}`,
		"success",
	);
	makeBurst(drop);
	playCatchTone(drop.message.price);
	player.classList.remove("is-catching");
	void player.offsetWidth;
	player.classList.add("is-catching");
	removeDrop(drop, index);
	updateHud();
}

function movePlayer(deltaSeconds) {
	const direction = Number(keys.right) - Number(keys.left);
	if (!direction) return;
	playerX +=
		direction * Math.min(460, stage.clientWidth * 0.72) * deltaSeconds;
	setPlayerX(playerX);
}

function setPlayerX(value) {
	const maxX = Math.max(0, stage.clientWidth - player.offsetWidth);
	playerX = clamp(value, 0, maxX);
	player.style.transform = `translate3d(${playerX}px, 0, 0)`;
}

function updateDrops(deltaSeconds) {
	const playerWidth = player.offsetWidth;
	const playerHeight = player.offsetHeight;
	const playerTop = stage.clientHeight - playerHeight - 10;
	const catchBox = {
		x: playerX + playerWidth * 0.09,
		y: playerTop + playerHeight * 0.05,
		width: playerWidth * 0.82,
		height: playerHeight * 0.52,
	};

	for (let index = drops.length - 1; index >= 0; index -= 1) {
		const drop = drops[index];
		drop.y += drop.speed * deltaSeconds;
		paintDrop(drop);
		const overlaps =
			drop.x < catchBox.x + catchBox.width &&
			drop.x + drop.width > catchBox.x &&
			drop.y < catchBox.y + catchBox.height &&
			drop.y + drop.height > catchBox.y;

		if (overlaps) {
			catchDrop(drop, index);
			continue;
		}

		if (drop.y > stage.clientHeight + 24) {
			missed += 1;
			removeDrop(drop, index);
		}
	}
}

function endGame() {
	if (!playing) return;
	playing = false;
	cancelAnimationFrame(frameId);
	keys.left = false;
	keys.right = false;
	for (const drop of drops.splice(0)) drop.element.remove();

	const best = Math.max(readBest(), wealth);
	saveBest(best);
	bestElement.textContent = best.toLocaleString("zh-CN");
	document.querySelector("#overlay-kicker").textContent =
		"SHAME LIMIT REACHED";
	document.querySelector("#overlay-title").textContent =
		wealth >= 5000
			? "羞耻爆表，但收获满满！"
			: wealth >= 2000
				? "这场直播，已经很努力了"
				: "脸红退场，再接一次吧";
	document.querySelector("#overlay-text").innerHTML =
		`最终财富 <strong>¥${wealth.toLocaleString("zh-CN")}</strong>，接住 ${caught} 条，错过 ${missed} 条。<br>最高纪录 ¥${best.toLocaleString("zh-CN")}。`;
	document.querySelector("#control-hints").hidden = true;
	startButton.textContent = "再来一局";
	overlay.hidden = false;
	showReaction("不行了，今天就读到这里！");
	showToast(`本场财富 ¥${wealth.toLocaleString("zh-CN")}`, "finish");
	tone(330, 0.18, 0.08);
	window.setTimeout(() => tone(260, 0.24, 0.06), 120);
}

function gameLoop(now) {
	if (!playing) return;
	const deltaSeconds = Math.min(0.034, (now - lastFrame) / 1000 || 0);
	lastFrame = now;
	const elapsed = (now - gameStartedAt) / 1000;
	movePlayer(deltaSeconds);
	updateDrops(deltaSeconds);
	shame = Math.min(100, shame + deltaSeconds);
	updateHud();

	if (shame >= 100) {
		endGame();
		return;
	}

	if (now >= nextSpawnAt) {
		createDrop();
		const pace = Math.max(720, 1380 - elapsed * 7.4);
		nextSpawnAt = now + pace * randomBetween(0.88, 1.12);
	}
	frameId = requestAnimationFrame(gameLoop);
}

function startGame() {
	for (const drop of drops.splice(0)) drop.element.remove();
	wealth = 0;
	shame = 0;
	caught = 0;
	missed = 0;
	lastFrame = performance.now();
	gameStartedAt = lastFrame;
	nextSpawnAt = lastFrame + 450;
	playing = true;
	reactionText.textContent = "好，今天的醒目留言我都能接住！";
	reaction.classList.remove("is-speaking");
	lastPrice.textContent = "等待";
	lastPrice.style.color = "";
	lastMessage.textContent = "第一条 SC";
	document.querySelector("#control-hints").hidden = false;
	overlay.hidden = true;
	updateHud();
	setPlayerX((stage.clientWidth - player.offsetWidth) / 2);
	tone(660, 0.13, 0.07);
	frameId = requestAnimationFrame(gameLoop);
}

function updatePlayerFromPointer(event) {
	const rect = stage.getBoundingClientRect();
	setPlayerX(event.clientX - rect.left - player.offsetWidth / 2);
}

function setDirection(direction, active) {
	keys[direction] = active;
}

stage.addEventListener("pointerdown", (event) => {
	if (!playing || event.target.closest("button")) return;
	dragging = true;
	stage.setPointerCapture(event.pointerId);
	updatePlayerFromPointer(event);
});

stage.addEventListener("pointermove", (event) => {
	if (dragging && playing) updatePlayerFromPointer(event);
});

stage.addEventListener("pointerup", () => {
	dragging = false;
});

stage.addEventListener("pointercancel", () => {
	dragging = false;
});

document.querySelectorAll("[data-direction]").forEach((button) => {
	const direction = button.dataset.direction;
	button.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		button.setPointerCapture(event.pointerId);
		setDirection(direction, true);
	});
	for (const eventName of [
		"pointerup",
		"pointercancel",
		"lostpointercapture",
	]) {
		button.addEventListener(eventName, () =>
			setDirection(direction, false),
		);
	}
});

window.addEventListener("keydown", (event) => {
	if (
		["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(
			event.code,
		)
	) {
		event.preventDefault();
	}
	if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
	if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
	if (event.code === "Space" && !playing) startGame();
});

window.addEventListener("keyup", (event) => {
	if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
	if (event.code === "ArrowRight" || event.code === "KeyD")
		keys.right = false;
});

window.addEventListener("blur", () => {
	keys.left = false;
	keys.right = false;
});

window.addEventListener("resize", () => setPlayerX(playerX));

soundToggle.addEventListener("click", () => {
	soundOn = !soundOn;
	soundToggle.setAttribute("aria-pressed", String(soundOn));
	soundToggle.setAttribute("aria-label", soundOn ? "关闭音效" : "打开音效");
	if (soundOn) tone(660, 0.1, 0.06);
});

startButton.addEventListener("click", startGame);
bestElement.textContent = readBest().toLocaleString("zh-CN");
setPlayerX((stage.clientWidth - player.offsetWidth) / 2);
