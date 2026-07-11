import { Midi } from "@tonejs/midi";

const canvas = document.querySelector("#sky");
const ctx = canvas.getContext("2d");
const message = document.querySelector("#message");
const muteButton = document.querySelector("#mute");
const fileInput = document.querySelector("#midi-file");
const trackSelect = document.querySelector("#midi-track");
const modeSelect = document.querySelector("#midi-mode");
const speedSelect = document.querySelector("#midi-speed");
const playButton = document.querySelector("#midi-play");
const restartButton = document.querySelector("#midi-restart");
const progressInput = document.querySelector("#midi-progress");
const currentLabel = document.querySelector("#midi-current");
const durationLabel = document.querySelector("#midi-duration");
const statusLabel = document.querySelector("#midi-status");

const SCALE = [0, 2, 4, 7, 9, 12, 14];
const BASE_MIDI = 57;
const MIN_VISUAL_MIDI = 0;
const MAX_VISUAL_MIDI = 127;
const MUSICAL_STAR_COUNT = 144;
const LOOKAHEAD = 0.28;
let stars = [];
let audio = null;
let muted = false;
let pressTimer = null;
let pressed = null;
let ripples = [];
let midi = null;
let playlist = [];
let duration = 0;
let playhead = 0;
let nextNoteIndex = 0;
let playing = false;
let anchorAudioTime = 0;
let anchorPlayhead = 0;
let scheduler = 0;
const activeSources = new Set();
const visualQueue = [];

function resize() {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(2, devicePixelRatio || 1);
  canvas.width = rect.width * density;
  canvas.height = rect.height * density;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  makeStars(rect.width, rect.height);
}

function makeStars(width, height) {
  const random = mulberry32(260711);
  const noteCount = MAX_VISUAL_MIDI - MIN_VISUAL_MIDI + 1;
  stars = Array.from({ length: MUSICAL_STAR_COUNT }, (_, index) => {
    const visualMidi = MIN_VISUAL_MIDI + (index < noteCount ? index : Math.floor(random() * noteCount));
    const heightRatio = (visualMidi - MIN_VISUAL_MIDI) / (MAX_VISUAL_MIDI - MIN_VISUAL_MIDI);
    return {
    x: (.025 + random() * .95) * width,
    y: (.1 + (1 - heightRatio) * .8 + (random() - .5) * .055) * height,
    b: .25 + random() * .75,
    size: .7 + random() * 2.1,
    note: SCALE[Math.floor(random() * SCALE.length)],
    visualMidi,
    phase: random() * 6.28,
    flash: 0,
  }});
  stars.push({ x: width * .68, y: height * .34, b: 1, size: 5, note: 0, visualMidi: BASE_MIDI, phase: 0, north: true, flash: 0 });
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function ensureAudio() {
  if (!audio) audio = new window.AudioContext();
  if (audio.state === "suspended") audio.resume();
}

function frequencyForMidi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function scheduleTone({ midiNote, duration: noteDuration = .9, velocity = .75, north = false, when }) {
  if (muted) return;
  ensureAudio();
  const start = Math.max(audio.currentTime, when ?? audio.currentTime);
  const release = Math.max(.08, noteDuration);
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  oscillator.type = north ? "sine" : "triangle";
  oscillator.frequency.value = frequencyForMidi(midiNote);
  filter.type = "lowpass";
  filter.frequency.value = north ? 900 : 1800;
  const peak = (north ? .18 : .105) * Math.max(.18, Math.min(1, velocity));
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + .018);
  gain.gain.exponentialRampToValueAtTime(.001, start + release);
  oscillator.connect(filter).connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + release + .04);
  activeSources.add(oscillator);
  oscillator.addEventListener("ended", () => activeSources.delete(oscillator), { once: true });
}

function tone(star, noteDuration = .9, offset = 0) {
  scheduleTone({ midiNote: BASE_MIDI + star.note + offset, duration: noteDuration, north: star.north });
}

function addRipple(star, big = false, strength = 1) {
  ripples.push({
    x: star.x,
    y: star.y,
    startRadius: big ? 5 : 4,
    bornAt: performance.now(),
    duration: big ? 3200 : 1800,
    big,
    strength: Math.max(.45, Math.min(1, strength)),
  });
}

function harmony() {
  if (muted) return;
  ensureAudio();
  [0, 4, 7, 12, 16].forEach((note, index) => {
    scheduleTone({ midiNote: BASE_MIDI + note, duration: 2.4, north: index === 0, when: audio.currentTime + index * .055 });
  });
  addRipple(pressed, true);
  message.textContent = "整片夜空，正在回应你";
  setTimeout(() => { if (!playing) message.textContent = "找到最亮的北极星"; }, 2600);
}

function hit(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return stars.reduce((best, star) => {
    const distance = Math.hypot(star.x - x, star.y - y);
    return distance < (star.north ? 28 : 18) && (!best || distance < best.d) ? { ...star, d: distance } : best;
  }, null);
}

function down(event) {
  pressed = hit(event);
  if (!pressed) return;
  event.preventDefault();
  tone(pressed);
  addRipple(pressed);
  if (pressed.north) pressTimer = setTimeout(harmony, 650);
}

function up() {
  clearTimeout(pressTimer);
  pressTimer = null;
  pressed = null;
}

function quantizeToSky(note) {
  let best = BASE_MIDI;
  let bestDistance = Infinity;
  for (let octave = -6; octave <= 7; octave += 1) {
    for (const interval of SCALE) {
      const candidate = BASE_MIDI + octave * 12 + interval;
      const distance = Math.abs(candidate - note);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function starForNote(note) {
  const visualNote = Math.max(MIN_VISUAL_MIDI, Math.min(MAX_VISUAL_MIDI, note));
  const exact = stars.filter((star) => !star.north && star.visualMidi === visualNote);
  if (exact.length) return exact[Math.abs(nextNoteIndex * 7) % exact.length];
  return stars.reduce((closest, star) => {
    if (star.north) return closest;
    return !closest || Math.abs(star.visualMidi - visualNote) < Math.abs(closest.visualMidi - visualNote) ? star : closest;
  }, null);
}

function formatTime(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

function selectedTracks() {
  if (!midi) return [];
  if (trackSelect.value === "all") return midi.tracks.filter((track) => track.channel !== 9 && track.notes.length);
  const track = midi.tracks[Number(trackSelect.value)];
  return track && track.channel !== 9 ? [track] : [];
}

function rebuildPlaylist() {
  stopPlayback(false);
  playlist = selectedTracks().flatMap((track) => track.notes.map((note) => ({
    time: note.time,
    duration: note.duration,
    midi: note.midi,
    velocity: note.velocity,
  }))).sort((a, b) => a.time - b.time || a.midi - b.midi);
  duration = playlist.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
  playhead = 0;
  nextNoteIndex = 0;
  updateTransport();
  const count = playlist.length;
  statusLabel.textContent = count ? `${fileInput.files?.[0]?.name ?? "MIDI"} · ${count} 个音符 · ${formatTime(duration)}` : "所选音轨没有可播放的旋律音符";
  playButton.disabled = !count;
  restartButton.disabled = !count;
  progressInput.disabled = !count;
}

function currentPlayhead() {
  if (!playing || !audio) return playhead;
  return Math.min(duration, anchorPlayhead + (audio.currentTime - anchorAudioTime) * Number(speedSelect.value));
}

function findNextNote(time) {
  let low = 0;
  let high = playlist.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (playlist[middle].time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function tickScheduler() {
  if (!playing || !audio) return;
  const rate = Number(speedSelect.value);
  const nowPosition = currentPlayhead();
  const horizon = nowPosition + LOOKAHEAD * rate;
  while (nextNoteIndex < playlist.length && playlist[nextNoteIndex].time <= horizon) {
    const note = playlist[nextNoteIndex];
    const mappedNote = modeSelect.value === "sky" ? quantizeToSky(note.midi) : note.midi;
    const star = starForNote(mappedNote);
    const when = anchorAudioTime + (note.time - anchorPlayhead) / rate;
    scheduleTone({ midiNote: mappedNote, duration: Math.max(.1, note.duration / rate), velocity: note.velocity, north: mappedNote === BASE_MIDI, when });
    visualQueue.push({ when, star, velocity: note.velocity });
    nextNoteIndex += 1;
  }
  if (nowPosition >= duration) stopPlayback(true);
}

function startPlayback() {
  if (!playlist.length) return;
  ensureAudio();
  if (playhead >= duration) playhead = 0;
  playing = true;
  anchorPlayhead = playhead;
  anchorAudioTime = audio.currentTime + .06;
  nextNoteIndex = findNextNote(playhead);
  scheduler = window.setInterval(tickScheduler, 70);
  tickScheduler();
  playButton.textContent = "暂停";
  message.textContent = "星空正在演奏";
}

function stopSources() {
  activeSources.forEach((source) => { try { source.stop(); } catch {} });
  activeSources.clear();
  visualQueue.length = 0;
}

function stopPlayback(ended) {
  if (playing) playhead = currentPlayhead();
  playing = false;
  window.clearInterval(scheduler);
  stopSources();
  if (ended) playhead = duration;
  if (playButton) playButton.textContent = ended ? "重新播放" : "播放";
  if (message) message.textContent = ended ? "这一段星光演奏完啦" : "找到最亮的北极星";
  updateTransport();
}

function seekTo(value) {
  const wasPlaying = playing;
  stopPlayback(false);
  playhead = Math.max(0, Math.min(duration, value));
  nextNoteIndex = findNextNote(playhead);
  updateTransport();
  if (wasPlaying) startPlayback();
}

function updateTransport() {
  const position = currentPlayhead();
  currentLabel.textContent = formatTime(position);
  durationLabel.textContent = formatTime(duration);
  progressInput.value = duration ? String(Math.round(position / duration * 1000)) : "0";
}

async function loadMidi(file) {
  stopPlayback(false);
  statusLabel.textContent = "正在读取 MIDI…";
  try {
    midi = new Midi(await file.arrayBuffer());
    trackSelect.replaceChildren(new Option("全部旋律轨", "all"));
    midi.tracks.forEach((track, index) => {
      if (track.channel === 9 || !track.notes.length) return;
      const name = track.name?.trim() || `音轨 ${index + 1}`;
      trackSelect.add(new Option(`${name} · ${track.notes.length} 音符`, String(index)));
    });
    trackSelect.disabled = false;
    rebuildPlaylist();
  } catch (error) {
    midi = null;
    playlist = [];
    statusLabel.textContent = "无法读取这个 MIDI，请换一个标准 MIDI 文件";
    playButton.disabled = true;
    restartButton.disabled = true;
    progressInput.disabled = true;
    console.error("MIDI parse failed", error);
  }
}

function draw(time) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (audio) {
    while (visualQueue.length && visualQueue[0].when <= audio.currentTime) {
      const visual = visualQueue.shift();
      visual.star.flash = Math.max(.5, visual.velocity);
      addRipple(visual.star, false, visual.velocity);
    }
  }
  for (const star of stars) {
    const pulse = .72 + .28 * Math.sin(time * .0012 + star.phase);
    const flash = star.flash || 0;
    const radius = star.size * (star.north ? 1.2 : pulse) * (1 + flash * 1.8);
    ctx.globalAlpha = Math.min(1, star.b * (star.north ? 1 : pulse) + flash);
    ctx.fillStyle = star.north ? "#fff4bd" : "#d7cbff";
    ctx.shadowColor = star.north ? "#ffe99a" : "#a88aff";
    ctx.shadowBlur = star.north ? 24 : star.b * 10 + flash * 30;
    ctx.beginPath();
    ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (star.north) {
      ctx.globalAlpha = .3 + flash * .5;
      ctx.beginPath();
      ctx.moveTo(star.x - 18, star.y);
      ctx.lineTo(star.x + 18, star.y);
      ctx.moveTo(star.x, star.y - 18);
      ctx.lineTo(star.x, star.y + 18);
      ctx.strokeStyle = "#fff5c5";
      ctx.stroke();
    }
    star.flash = Math.max(0, flash - .035);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ripples = ripples.filter((ripple) => time - ripple.bornAt < ripple.duration);
  for (const ripple of ripples) {
    const progress = Math.max(0, Math.min(1, (time - ripple.bornAt) / ripple.duration));
    const expansion = 1 - Math.pow(1 - progress, 2.6);
    const radius = ripple.startRadius + expansion * (ripple.big ? 118 : 52);
    ctx.globalAlpha = Math.pow(1 - progress, 1.65) * .62 * ripple.strength;
    ctx.strokeStyle = ripple.big ? "#fff0ad" : "#bda2ff";
    ctx.lineWidth = 1.5 - progress * .65;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (playing) updateTransport();
  requestAnimationFrame(draw);
}

canvas.addEventListener("pointerdown", down);
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", up);
canvas.addEventListener("pointerleave", up);
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "声音关闭" : "声音开启";
  if (muted) stopSources();
});
fileInput.addEventListener("change", () => { if (fileInput.files?.[0]) loadMidi(fileInput.files[0]); });
trackSelect.addEventListener("change", rebuildPlaylist);
modeSelect.addEventListener("change", () => { if (playing) seekTo(currentPlayhead()); });
speedSelect.addEventListener("change", () => { if (playing) seekTo(currentPlayhead()); });
playButton.addEventListener("click", () => { if (playing) stopPlayback(false); else startPlayback(); });
restartButton.addEventListener("click", () => seekTo(0));
progressInput.addEventListener("input", () => seekTo(Number(progressInput.value) / 1000 * duration));
window.addEventListener("resize", resize);
resize();
requestAnimationFrame(draw);
