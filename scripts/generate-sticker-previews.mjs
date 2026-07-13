import { createHash } from "node:crypto";
import {
	access,
	mkdir,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve("public/assets/stickers");
const outputRoot = path.resolve("public/assets/optimized/stickers");
const manifestPath = path.join(outputRoot, "manifest.json");
const supportedExtensions = new Set([".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const settings = {
	version: 1,
	maxDimension: 512,
	staticQuality: 80,
	animatedQuality: 72,
	effort: 4,
};
const checkOnly = process.argv.includes("--check");
const hashFile = async (file) =>
	createHash("sha256")
		.update(await readFile(file))
		.digest("hex");
const exists = async (file) =>
	access(file).then(
		() => true,
		() => false,
	);
const toPosix = (value) => value.split(path.sep).join("/");
const manifest = await readFile(manifestPath, "utf8")
	.then(JSON.parse)
	.catch(() => ({ settings: null, images: {} }));
const settingsMatch =
	JSON.stringify(manifest.settings) === JSON.stringify(settings);
const walk = async (directory) =>
	(
		await Promise.all(
			(await readdir(directory, { withFileTypes: true })).map(
				async (entry) => {
					const absolute = path.join(directory, entry.name);
					return entry.isDirectory() ? walk(absolute) : absolute;
				},
			),
		)
	).flat();
const files = (await walk(sourceRoot))
	.filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()))
	.sort();
const problems = [];
const nextImages = {};
const expectedOutputs = new Set();
let generated = 0;

for (const source of files) {
	const relativePath = toPosix(path.relative(sourceRoot, source));
	const extension = path.extname(relativePath).toLowerCase();
	const outputName = relativePath.slice(0, -extension.length) + ".webp";
	const output = path.join(outputRoot, outputName);
	const sourceHash = await hashFile(source);
	const previous = manifest.images?.[relativePath];
	const current =
		settingsMatch &&
		previous?.sourceHash === sourceHash &&
		previous?.output === outputName &&
		(await exists(output)) &&
		previous?.outputHash === (await hashFile(output));
	expectedOutputs.add(outputName);
	if (checkOnly) {
		if (!current) problems.push(relativePath);
		continue;
	}
	if (!current) {
		await mkdir(path.dirname(output), { recursive: true });
		const animated = extension === ".gif";
		await sharp(source, { animated, limitInputPixels: false })
			.resize({
				width: 512,
				height: 512,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({
				quality: animated ? 72 : 80,
				alphaQuality: animated ? 82 : 90,
				effort: 4,
				loop: 0,
			})
			.toFile(output);
		generated += 1;
	}
	nextImages[relativePath] = {
		sourceHash,
		output: outputName,
		outputHash: await hashFile(output),
	};
}

for (const file of (await walk(outputRoot).catch(() => [])).filter((file) =>
	file.endsWith(".webp"),
)) {
	const relative = toPosix(path.relative(outputRoot, file));
	if (expectedOutputs.has(relative)) continue;
	if (checkOnly) problems.push(`orphan output: ${relative}`);
	else await rm(file);
}
if (checkOnly) {
	if (problems.length) {
		console.error(
			"Optimized sticker files are missing, stale, or orphaned:",
		);
		problems.forEach((problem) => console.error(`- ${problem}`));
		console.error(
			"Run `npm run stickers:optimize` and commit the generated files.",
		);
		process.exitCode = 1;
	} else
		console.log(
			`Optimized sticker files are current (${files.length} images).`,
		);
} else {
	await writeFile(
		manifestPath,
		`${JSON.stringify({ settings, images: nextImages }, null, 2)}\n`,
	);
	console.log(
		`Sticker optimization complete: ${generated} generated, ${files.length - generated} unchanged.`,
	);
}
