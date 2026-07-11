const scene = document.querySelector("#scene");
const stream = document.querySelector("#stream");
const card = document.querySelector(".game-card");
const statusEl = document.querySelector("#status");
const hint = document.querySelector("#sceneHint");
const toggleButton = document.querySelector("#toggle");
const countLabel = document.querySelector("#hairCount");
const flash = document.querySelector("#freezeFlash");
const looks = [
  { ornament: "🎀", className: "", base: "#291a42", shine: "#805079" },
  { ornament: "🌹", className: "", base: "#321b3c", shine: "#9b4f68" },
  { ornament: "✦", className: "short", base: "#21183d", shine: "#765ca0" },
  { ornament: "👑", className: "", base: "#39213e", shine: "#a16a73" },
  { ornament: "🎀", className: "short", base: "#231d42", shine: "#52528a" },
  { ornament: "🌙", className: "", base: "#241939", shine: "#6e476f" },
];

let paused = false;
let lookIndex = 0;
let spawnTimer;

function createHair() {
  if (paused) return;
  const look = looks[lookIndex % looks.length];
  const hair = document.createElement("div");
  hair.className = `hair ${look.className}`.trim();
  hair.style.setProperty("--base", look.base);
  hair.style.setProperty("--shine", look.shine);
  hair.style.setProperty("--duration", `${1.25 + Math.random() * .18}s`);
  hair.innerHTML = `<span>${look.ornament}</span>`;
  hair.dataset.look = String(lookIndex + 1);
  hair.addEventListener("animationend", () => hair.remove(), { once: true });
  stream.append(hair);
  lookIndex += 1;
  countLabel.textContent = `LOOK ${String((lookIndex % 99) || 99).padStart(2, "0")}`;
}

function scheduleNext() {
  window.clearTimeout(spawnTimer);
  if (paused) return;
  createHair();
  spawnTimer = window.setTimeout(scheduleNext, 390);
}

function closestHair() {
  const hairs = [...stream.querySelectorAll(".hair")];
  const target = scene.getBoundingClientRect().left + scene.clientWidth / 2;
  return hairs.reduce((closest, hair) => {
    const rect = hair.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - target);
    return !closest || distance < closest.distance ? { hair, distance } : closest;
  }, null)?.hair;
}

function pauseStream() {
  paused = true;
  window.clearTimeout(spawnTimer);
  card.classList.add("is-paused");
  const kept = closestHair();
  [...stream.querySelectorAll(".hair")].forEach(hair => {
    if (hair === kept) hair.classList.add("kept");
    else { hair.classList.add("fade"); window.setTimeout(() => hair.remove(), 230); }
  });
  statusEl.textContent = "已暂停 · 可截图";
  hint.textContent = "已保留最近发型 · 点击继续";
  toggleButton.textContent = "继续";
  scene.setAttribute("aria-label", "已暂停，点击继续发型循环");
  flash.classList.remove("flash");
  void flash.offsetWidth;
  flash.classList.add("flash");
}

function resumeStream() {
  paused = false;
  stream.replaceChildren();
  card.classList.remove("is-paused");
  statusEl.textContent = "高速循环中";
  hint.textContent = "点击画面暂停";
  toggleButton.textContent = "暂停";
  scene.setAttribute("aria-label", "点击暂停并保留最近的头发");
  scheduleNext();
}

function toggle() {
  if (paused) resumeStream(); else pauseStream();
}

scene.addEventListener("click", toggle);
toggleButton.addEventListener("click", toggle);
window.addEventListener("keydown", event => {
  if (event.code === "Space") { event.preventDefault(); toggle(); }
});

scheduleNext();
