import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { format } from "prettier";

const directory = "public/assets/flash-cards";
const gallery = "public/assets/gallery";
const check = process.argv.includes("--check");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const version = 2;
const textureSettings = { maxDimension: 2000, quality: 88, effort: 5 };
const files = (await readdir(gallery, { withFileTypes: true }))
	.filter(
		(entry) =>
			entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name),
	)
	.map((entry) => entry.name)
	.sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
let previous;
try {
	previous = JSON.parse(await readFile(`${directory}/manifest.json`, "utf8"));
} catch {
	previous = { cards: [] };
}
const modelHash = hash(await readFile(`${directory}/card.glb`));
const empty = await sharp({
	create: {
		width: 1,
		height: 1,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.png()
	.toBuffer();
if (!check) await writeFile(`${directory}/empty.png`, empty);
else if (hash(await readFile(`${directory}/empty.png`)) !== hash(empty))
	throw Error("Empty text layer differs; run npm run cards:generate");
const cards = [];
for (const [index, file] of files.entries()) {
	const source = await readFile(`${gallery}/${file}`);
	const sourceHash = hash(source);
	const id = /^gallery-\d+\./.test(file)
		? path.parse(file).name
		: `artwork-${hash(file).slice(0, 8)}`;
	const dest = `${directory}/${id}`;
	const { width, height } = await sharp(source).metadata();
	const texturePath = `${dest}/artwork.webp`;
	let artworkHash;
	try {
		artworkHash = hash(await readFile(texturePath));
	} catch {
		/* Generated below. */
	}
	const old = previous.cards.find((card) => card.id === id);
	if (
		previous.version !== version ||
		JSON.stringify(previous.textureSettings) !==
			JSON.stringify(textureSettings) ||
		old?.sourceHash !== sourceHash ||
		old?.artworkHash !== artworkHash ||
		!artworkHash
	) {
		if (check)
			throw Error(
				`Stale flash-card texture: ${file}; run npm run cards:generate`,
			);
		await mkdir(dest, { recursive: true });
		const artwork = await sharp(source, { animated: false })
			.rotate()
			.resize({
				width: textureSettings.maxDimension,
				height: textureSettings.maxDimension,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({
				quality: textureSettings.quality,
				effort: textureSettings.effort,
			})
			.toBuffer();
		await writeFile(texturePath, artwork);
		artworkHash = hash(artwork);
	}
	const mask = JSON.parse(await readFile(`${dest}/mask-source.json`, "utf8"));
	if (
		mask.sourceHash !== sourceHash ||
		hash(await readFile(`${dest}/subject-mask.png`)) !== mask.subjectHash ||
		hash(await readFile(`${dest}/background-mask.png`)) !==
			mask.backgroundHash
	)
		throw Error(
			`Stale subject mask: ${file}; run scripts/generate-card-masks.py`,
		);
	let lineHash;
	try {
		lineHash = hash(await readFile(`${dest}/lineart.png`));
	} catch {
		/* Generated below. */
	}
	if (
		previous.version !== version ||
		old?.sourceHash !== sourceHash ||
		old?.lineHash !== lineHash ||
		!lineHash
	) {
		if (check)
			throw Error(
				`Stale flash card: ${file}; run npm run cards:generate`,
			);
		await mkdir(dest, { recursive: true });
		const line = await sharp(source)
			.resize({
				width: 1536,
				height: 1536,
				fit: "inside",
				withoutEnlargement: true,
			})
			.greyscale()
			.convolve({
				width: 3,
				height: 3,
				kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
			})
			.threshold(45)
			.negate()
			.png()
			.toBuffer();
		await writeFile(`${dest}/lineart.png`, line);
		lineHash = hash(line);
	}
	const artwork = `/assets/flash-cards/${id}/artwork.webp?v=${artworkHash.slice(0, 12)}`;
	const config = {
		title: "贝拉kira",
		subtitle: "画廊闪卡",
		edition: `${index + 1} / ${files.length}`,
		collection: "非官方粉丝收藏",
		description: `画廊原图：${file}。原画及签名完整保留，权利归原权利人。`,
		sourceMode: "reference",
		typography: false,
		frame: false,
		cardAspect: width / height,
		artworkFit: [1, 1],
		assets: {
			model: `/assets/flash-cards/card.glb?v=${modelHash.slice(0, 12)}`,
			subject: artwork,
			subjectMask: `/assets/flash-cards/${id}/subject-mask.png?v=${mask.subjectHash.slice(0, 12)}`,
			backgroundMask: `/assets/flash-cards/${id}/background-mask.png?v=${mask.backgroundHash.slice(0, 12)}`,
			background: artwork,
			text: "/assets/flash-cards/empty.png",
			lineart: `/assets/flash-cards/${id}/lineart.png?v=${lineHash.slice(0, 12)}`,
		},
		parameters: {
			foil: 0.48,
		},
		safeArea: { scale: 1, offset: [0, 0] },
	};
	const json = await format(JSON.stringify(config), {
		parser: "json",
		useTabs: true,
		tabWidth: 4,
	});
	const configHash = hash(json);
	if (check) {
		if (hash(await readFile(`${dest}/card-config.json`)) !== configHash)
			throw Error(`Stale configuration: ${file}`);
	} else await writeFile(`${dest}/card-config.json`, json);
	cards.push({
		id,
		file,
		width,
		height,
		sourceHash,
		artworkHash,
		lineHash,
		configHash,
		configUrl: `/assets/flash-cards/${id}/card-config.json?v=${configHash.slice(0, 12)}`,
	});
}
const manifest = { version, textureSettings, modelHash, cards };
if (check) {
	if (JSON.stringify(previous) !== JSON.stringify(manifest))
		throw Error("Flash-card manifest differs; run npm run cards:generate");
} else
	await writeFile(
		`${directory}/manifest.json`,
		await format(JSON.stringify(manifest), {
			parser: "json",
			useTabs: true,
			tabWidth: 4,
		}),
	);
console.log(
	`${check ? "Verified" : "Generated"} ${cards.length} gallery flash cards.`,
);
