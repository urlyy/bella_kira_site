import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const get = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const canvas = get<HTMLCanvasElement>("#previewCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true })!;
const status = get<HTMLElement>("#status");
const preset = get<HTMLSelectElement>("#preset");
const upload = get<HTMLInputElement>("#upload");
const generate = get<HTMLButtonElement>("#generate");
const download = get<HTMLAnchorElement>("#download");
const FRAME_COUNT = 10;
const FRAME_DELAY = 20;
const EXPORT_SIZE = 128;
const handFrames = Array.from({ length: FRAME_COUNT }, (_, index) => {
  const frame = new Image();
  frame.src = `/assets/pet-pet/hands/pet${index}.gif`;
  frame.draggable = false;
  return frame;
});

let avatar = new Image();
let uploadedUrl: string | null = null;
let downloadUrl: string | null = null;
let frameIndex = 0;
let lastFrameAt = 0;

function loadImage(source: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.draggable = false;
    image.onload = () => { avatar = image; resolve(); };
    image.onerror = () => reject(new Error("无法读取这张图片"));
    image.src = source;
  });
}

function waitForHands() {
  return Promise.all(handFrames.map((image) => image.complete && image.naturalWidth
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("原版手部素材加载失败"));
      })));
}

function drawFrame(ctx: CanvasRenderingContext2D, index: number, resolution: number) {
  ctx.clearRect(0, 0, resolution, resolution);
  const pressure = index < FRAME_COUNT / 2 ? index : FRAME_COUNT - index;
  const width = 0.8 + pressure * 0.02;
  const height = 0.8 - pressure * 0.05;
  const offsetX = (1 - width) * 0.5 + 0.1;
  const offsetY = (1 - height) - 0.08;
  if (avatar.complete && avatar.naturalWidth) {
    ctx.drawImage(avatar, resolution * offsetX, resolution * offsetY, resolution * width, resolution * height);
  }
  const hand = handFrames[index];
  if (hand.complete && hand.naturalWidth) ctx.drawImage(hand, 0, 0, resolution, resolution);
}

function animate(time: number) {
  if (time - lastFrameAt >= FRAME_DELAY) {
    frameIndex = (frameIndex + 1) % FRAME_COUNT;
    lastFrameAt = time;
  }
  drawFrame(context, frameIndex, canvas.width);
  requestAnimationFrame(animate);
}

async function selectSource(source: string, label: string) {
  status.textContent = "正在读取图片…";
  download.hidden = true;
  try {
    await loadImage(source);
    status.textContent = `${label} · 可以生成了`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "无法读取这张图片";
  }
}

async function generateGif() {
  generate.disabled = true;
  generate.textContent = "正在生成…";
  status.textContent = "正在合成原版 10 帧动画…";
  try {
    await waitForHands();
    const output = document.createElement("canvas");
    output.width = output.height = EXPORT_SIZE;
    const outputContext = output.getContext("2d", { willReadFrequently: true })!;
    const gif = GIFEncoder();
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      drawFrame(outputContext, index, EXPORT_SIZE);
      const pixels = outputContext.getImageData(0, 0, EXPORT_SIZE, EXPORT_SIZE).data;
      const palette = quantize(pixels, 256, { format: "rgba4444", oneBitAlpha: true });
      const indexed = applyPalette(pixels, palette, "rgba4444");
      const transparentIndex = Math.max(0, palette.findIndex((color) => color[3] === 0));
      gif.writeFrame(indexed, EXPORT_SIZE, EXPORT_SIZE, {
        palette, delay: FRAME_DELAY, repeat: 0, transparent: true, transparentIndex, dispose: 2,
      });
      await new Promise(requestAnimationFrame);
    }
    gif.finish();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const bytes = gif.bytes();
    const gifBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(gifBuffer).set(bytes);
    downloadUrl = URL.createObjectURL(new Blob([gifBuffer], { type: "image/gif" }));
    download.href = downloadUrl;
    download.download = "bella-petpet.gif";
    download.hidden = false;
    status.textContent = "原版 PetPet GIF 已生成 · 128 × 128";
  } catch (error) {
    status.textContent = `生成失败：${error instanceof Error ? error.message : "未知错误"}`;
  } finally {
    generate.disabled = false;
    generate.textContent = "生成 GIF";
  }
}

preset.addEventListener("change", () => selectSource(preset.value, preset.selectedOptions[0].textContent));
upload.addEventListener("change", () => {
  const file = upload.files?.[0];
  if (!file) return;
  if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
  uploadedUrl = URL.createObjectURL(file);
  void selectSource(uploadedUrl, file.name);
});
generate.addEventListener("click", generateGif);
window.addEventListener("pagehide", () => {
  if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});

void selectSource(preset.value, "贝拉舞台写真");
void waitForHands().catch((error: Error) => { status.textContent = error.message; });
requestAnimationFrame(animate);
