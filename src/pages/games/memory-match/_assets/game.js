const ITEMS = [
  { icon: "★", name: "北极星" },
  { icon: "🎤", name: "舞台" },
  { icon: "🦙", name: "羊驼" },
  { icon: "🎀", name: "缎带" },
  { icon: "🌹", name: "玫瑰" },
  { icon: "🎧", name: "旋律" },
  { icon: "💜", name: "心意" },
  { icon: "🌙", name: "月光" },
];

const CONFIG = {
  easy: { pairs: 4, columns: 4 },
  normal: { pairs: 6, columns: 4 },
  hard: { pairs: 8, columns: 4 },
};

const board = document.querySelector("#board");
const template = document.querySelector("#cardTemplate");
const movesEl = document.querySelector("#moves");
const comboEl = document.querySelector("#combo");
const timeEl = document.querySelector("#time");
const difficulty = document.querySelector("#difficulty");
const modal = document.querySelector("#winModal");
const soundButton = document.querySelector("#soundButton");

let openCards = [];
let matchedPairs = 0;
let moves = 0;
let combo = 0;
let startedAt = null;
let timer = null;
let locked = false;
let soundOn = true;
let audioContext = null;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function playTone(frequency, duration = 0.12) {
  if (!soundOn) return;
  audioContext ||= new window.AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function startTimer() {
  if (startedAt) return;
  startedAt = Date.now();
  timer = window.setInterval(() => {
    timeEl.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
  }, 1000);
}

function createCard(item, id) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.pair = item.name;
  card.dataset.id = id;
  card.setAttribute("aria-label", "未翻开的卡牌");
  card.querySelector("b").textContent = item.icon;
  card.querySelector("small").textContent = item.name;
  card.addEventListener("click", () => flipCard(card));
  return card;
}

function flipCard(card) {
  if (locked || card.classList.contains("is-flipped") || card.classList.contains("is-matched")) return;
  startTimer();
  card.classList.add("is-flipped");
  card.setAttribute("aria-label", `${card.dataset.pair}，已翻开`);
  openCards.push(card);
  playTone(440 + openCards.length * 80);
  if (openCards.length === 2) checkPair();
}

function checkPair() {
  locked = true;
  moves += 1;
  movesEl.textContent = moves;
  const [first, second] = openCards;
  const isMatch = first.dataset.pair === second.dataset.pair;

  if (isMatch) {
    combo += 1;
    matchedPairs += 1;
    first.classList.add("is-matched");
    second.classList.add("is-matched");
    first.setAttribute("aria-label", `${first.dataset.pair}，已配对`);
    second.setAttribute("aria-label", `${second.dataset.pair}，已配对`);
    openCards = [];
    locked = false;
    playTone(784, 0.24);
    if (matchedPairs === CONFIG[difficulty.value].pairs) window.setTimeout(showWin, 550);
  } else {
    combo = 0;
    window.setTimeout(() => {
      first.classList.remove("is-flipped");
      second.classList.remove("is-flipped");
      first.setAttribute("aria-label", "未翻开的卡牌");
      second.setAttribute("aria-label", "未翻开的卡牌");
      openCards = [];
      locked = false;
    }, 820);
  }
  comboEl.textContent = `×${combo}`;
}

function showWin() {
  window.clearInterval(timer);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  document.querySelector("#winSummary").textContent = `用时 ${formatTime(elapsed)} · ${moves} 步完成配对`;
  modal.hidden = false;
  document.querySelector("#playAgain").focus();
  [659, 784, 988].forEach((note, i) => window.setTimeout(() => playTone(note, 0.3), i * 120));
}

function newGame() {
  window.clearInterval(timer);
  openCards = [];
  matchedPairs = 0;
  moves = 0;
  combo = 0;
  startedAt = null;
  locked = false;
  movesEl.textContent = "0";
  comboEl.textContent = "×0";
  timeEl.textContent = "00:00";
  modal.hidden = true;
  board.replaceChildren();

  const { pairs, columns } = CONFIG[difficulty.value];
  board.style.setProperty("--columns", columns);
  const deck = shuffle(ITEMS.slice(0, pairs).flatMap((item) => [item, item]));
  deck.forEach((item, index) => board.append(createCard(item, index)));
}

document.querySelector("#restart").addEventListener("click", newGame);
document.querySelector("#playAgain").addEventListener("click", newGame);
difficulty.addEventListener("change", newGame);
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.setAttribute("aria-pressed", String(soundOn));
  soundButton.setAttribute("aria-label", soundOn ? "关闭音效" : "打开音效");
  if (soundOn) playTone(660);
});

newGame();
