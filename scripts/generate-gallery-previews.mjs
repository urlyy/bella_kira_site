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
import process from "node:process";
import sharp from "sharp";

const rootDirectory = process.cwd();
const galleryDirectory = path.join(rootDirectory, "public/assets/gallery");
const previewDirectory = path.join(galleryDirectory, "previews");
const manifestPath = path.join(previewDirectory, "manifest.json");
const supportedExtensions = new Set([
	".avif",
	".gif",
	".jpeg",
	".jpg",
	".png",
	".webp",
]);
const previewSettings = { version: 1, maxDimension: 1200, quality: 80 };
const checkOnly = process.argv.includes("--check");

const fileExists = async (filePath) => {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
};

const readManifest = async () => {
	try {
		return JSON.parse(await readFile(manifestPath, "utf8"));
	} catch {
		return { settings: null, images: {} };
	}
};

const hashFile = async (filePath) => {
	const contents = await readFile(filePath);
	return createHash("sha256").update(contents).digest("hex");
};

const entries = (await readdir(galleryDirectory, { withFileTypes: true }))
	.filter(
		(entry) =>
			entry.isFile() &&
			supportedExtensions.has(path.extname(entry.name).toLowerCase()),
	)
	.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

const manifest = await readManifest();
const settingsMatch =
	JSON.stringify(manifest.settings) === JSON.stringify(previewSettings);
const originals = new Set(entries.map((entry) => entry.name));
const nextImages = {};
const problems = [];
let generatedCount = 0;

if (!checkOnly) await mkdir(previewDirectory, { recursive: true });

for (const entry of entries) {
	const sourcePath = path.join(galleryDirectory, entry.name);
	const previewName = `${entry.name}.webp`;
	const previewPath = path.join(previewDirectory, previewName);
	const sourceHash = await hashFile(sourcePath);
	const isCurrent =
		settingsMatch &&
		manifest.images?.[entry.name]?.sourceHash === sourceHash &&
		manifest.images?.[entry.name]?.preview === previewName &&
		(await fileExists(previewPath));

	nextImages[entry.name] = { sourceHash, preview: previewName };

	if (isCurrent) continue;
	if (checkOnly) {
		problems.push(entry.name);
		continue;
	}

	await sharp(sourcePath, { animated: false })
		.rotate()
		.resize({
			width: previewSettings.maxDimension,
			height: previewSettings.maxDimension,
			fit: "inside",
			withoutEnlargement: true,
		})
		.webp({ quality: previewSettings.quality, effort: 5 })
		.toFile(previewPath);
	generatedCount += 1;
	console.log(`generated ${path.relative(rootDirectory, previewPath)}`);
}

const previewEntries = await readdir(previewDirectory, {
	withFileTypes: true,
}).catch(() => []);
for (const entry of previewEntries) {
	if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;
	const originalName = entry.name.slice(0, -".webp".length);
	if (originals.has(originalName)) continue;

	if (checkOnly) problems.push(`orphan preview: ${entry.name}`);
	else await rm(path.join(previewDirectory, entry.name));
}

for (const originalName of Object.keys(manifest.images ?? {})) {
	if (!originals.has(originalName) && checkOnly)
		problems.push(`orphan manifest entry: ${originalName}`);
}

if (checkOnly) {
	if (problems.length > 0) {
		console.error("Gallery previews are missing or stale:");
		problems.forEach((problem) => console.error(`- ${problem}`));
		console.error(
			"Run `npm run gallery:optimize` and commit the generated files.",
		);
		process.exitCode = 1;
	} else {
		console.log(`Gallery previews are current (${entries.length} images).`);
	}
} else {
	const nextManifest = { settings: previewSettings, images: nextImages };
	await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
	console.log(
		`Gallery preview generation complete: ${generatedCount} generated, ${entries.length - generatedCount} unchanged.`,
	);
}
