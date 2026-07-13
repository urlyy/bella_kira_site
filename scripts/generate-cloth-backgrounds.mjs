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

const sourceRoot = path.resolve("public/assets/cloth_bg");
const outputRoot = path.resolve("public/assets/optimized/cloth-bg");
const manifestPath = path.join(outputRoot, "manifest.json");
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const settings = { version: 1, quality: 84, effort: 5 };
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
const manifest = await readFile(manifestPath, "utf8")
	.then(JSON.parse)
	.catch(() => ({ settings: null, images: {} }));
const settingsMatch =
	JSON.stringify(manifest.settings) === JSON.stringify(settings);

const entries = (await readdir(sourceRoot, { withFileTypes: true }))
	.filter((entry) => {
		const extension = path.extname(entry.name).toLowerCase();
		return (
			entry.isFile() &&
			supportedExtensions.has(extension) &&
			!path.basename(entry.name, extension).endsWith("_bak")
		);
	})
	.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

if (!checkOnly) await mkdir(outputRoot, { recursive: true });
const problems = [];
const nextImages = {};
const expectedOutputs = new Set();
let generated = 0;

for (const entry of entries) {
	const extension = path.extname(entry.name);
	const outputName = `${path.basename(entry.name, extension)}.webp`;
	const sourcePath = path.join(sourceRoot, entry.name);
	const outputPath = path.join(outputRoot, outputName);
	const sourceHash = await hashFile(sourcePath);
	const previous = manifest.images?.[entry.name];
	const current =
		settingsMatch &&
		previous?.sourceHash === sourceHash &&
		previous?.output === outputName &&
		(await exists(outputPath)) &&
		previous?.outputHash === (await hashFile(outputPath));
	expectedOutputs.add(outputName);

	if (checkOnly) {
		if (!current) problems.push(entry.name);
		continue;
	}
	if (!current) {
		await sharp(sourcePath, { limitInputPixels: false })
			.rotate()
			.webp({ quality: settings.quality, effort: settings.effort })
			.toFile(outputPath);
		generated += 1;
	}
	nextImages[entry.name] = {
		sourceHash,
		output: outputName,
		outputHash: await hashFile(outputPath),
	};
}

const outputEntries = await readdir(outputRoot, { withFileTypes: true }).catch(
	() => [],
);
for (const entry of outputEntries) {
	if (
		!entry.isFile() ||
		!entry.name.endsWith(".webp") ||
		expectedOutputs.has(entry.name)
	)
		continue;
	if (checkOnly) problems.push(`orphan output: ${entry.name}`);
	else await rm(path.join(outputRoot, entry.name));
}

if (checkOnly) {
	if (problems.length) {
		console.error(
			"Optimized cloth backgrounds are missing, stale, or orphaned:",
		);
		problems.forEach((problem) => console.error(`- ${problem}`));
		console.error(
			"Run `npm run cloth-bg:optimize` and commit the generated files.",
		);
		process.exitCode = 1;
	} else
		console.log(
			`Optimized cloth backgrounds are current (${entries.length} images).`,
		);
} else {
	await writeFile(
		manifestPath,
		`${JSON.stringify({ settings, images: nextImages }, null, 2)}\n`,
	);
	console.log(
		`Cloth background optimization complete: ${generated} generated, ${entries.length - generated} unchanged.`,
	);
}
