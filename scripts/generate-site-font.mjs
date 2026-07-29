import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const fontDirectory = path.join(projectRoot, "public/assets/fonts");
const sourceDirectory = path.join(fontDirectory, "sources");
const outputPath = path.join(fontDirectory, "LXGWWenKaiMonoLite-Site.woff2");
const stylesheetPath = path.join(projectRoot, "src/styles/global.css");
const checkOnly = process.argv.includes("--check");
const temporaryDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), "bella-site-font-"),
);

function run(command, args) {
	execFileSync(command, args, {
		cwd: projectRoot,
		stdio: "inherit",
	});
}

function fontTools(command, args) {
	run("uvx", ["--from", "fonttools[woff]", command, ...args]);
}

function sha256(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

try {
	const generatedWoff2 = path.join(temporaryDirectory, "site.woff2");

	fontTools("python", [
		path.join(projectRoot, "scripts/merge-font-glyphs.py"),
		path.join(sourceDirectory, "LXGWWenKaiMonoLite-Site-base.woff2"),
		generatedWoff2,
		`${path.join(fontDirectory, "LXGWWenKaiMonoLite-Regular.ttf")}:5323,FF3B,FF3D`,
		`${path.join(sourceDirectory, "NotoSansMath-SiteSymbols.ttf")}:21BB,2B21`,
		`${path.join(sourceDirectory, "NotoSansSymbols-SiteSymbols.ttf")}:2301,2315`,
		`${path.join(sourceDirectory, "NotoSansSymbols2-SiteSymbols.ttf")}:2725,2726,2727`,
	]);

	const generated = fs.readFileSync(generatedWoff2);
	const outputHash = sha256(generated).slice(0, 12);
	const current = fs.existsSync(outputPath)
		? fs.readFileSync(outputPath)
		: null;
	const stylesheet = fs.readFileSync(stylesheetPath, "utf8");
	const expectedStylesheet = stylesheet.replace(
		/(LXGWWenKaiMonoLite-Site\.woff2\?v=)[a-f0-9]+/,
		`$1${outputHash}`,
	);

	if (checkOnly) {
		const problems = [];
		if (!current || !generated.equals(current)) {
			problems.push(
				"the generated WOFF2 differs from the committed output",
			);
		}
		if (expectedStylesheet !== stylesheet) {
			problems.push(
				"the font cache hash in src/styles/global.css is stale",
			);
		}
		if (problems.length > 0) {
			console.error(`Site font check failed: ${problems.join("; ")}.`);
			console.error("Run npm run font:optimize and commit the results.");
			process.exitCode = 1;
		} else {
			console.log(`Site font assets are current (${outputHash}).`);
		}
	} else {
		fs.copyFileSync(generatedWoff2, outputPath);
		fs.writeFileSync(stylesheetPath, expectedStylesheet);
		console.log(
			`Generated ${path.relative(projectRoot, outputPath)} (${outputHash}).`,
		);
	}
} finally {
	fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
