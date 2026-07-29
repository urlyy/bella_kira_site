import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import * as fontkit from "fontkit";
import ts from "typescript";

const PROJECT_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const FONT_PATH = path.join(
	PROJECT_ROOT,
	"public/assets/fonts/LXGWWenKaiMonoLite-Site.woff2",
);
const SOURCE_EXTENSIONS = new Set([
	".astro",
	".css",
	".js",
	".jsx",
	".json",
	".ts",
	".tsx",
]);
const VISIBLE_ATTRIBUTES = new Set([
	"alt",
	"aria-description",
	"aria-label",
	"aria-placeholder",
	"data-label",
	"placeholder",
	"title",
]);
const ENTITY_VALUES = new Map([
	["amp", "&"],
	["apos", "'"],
	["gt", ">"],
	["hellip", "…"],
	["ldquo", "“"],
	["lsquo", "‘"],
	["lt", "<"],
	["mdash", "—"],
	["middot", "·"],
	["nbsp", "\u00a0"],
	["quot", '"'],
	["rdquo", "”"],
	["rsquo", "’"],
]);

const occurrences = new Map();

function addText(value, filePath, offset, source) {
	if (typeof value !== "string" || value.length === 0) return;

	let cursor = offset;
	for (const character of decodeEntities(value)) {
		if (shouldCheck(character)) {
			const codePoint = character.codePointAt(0);
			const entries = occurrences.get(codePoint) ?? [];
			if (entries.length < 8) {
				entries.push({ filePath, offset: cursor, source });
				occurrences.set(codePoint, entries);
			}
		}
		cursor += character.length;
	}
}

function decodeEntities(value) {
	return value.replace(
		/&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi,
		(match, decimal, hexadecimal, name) => {
			if (decimal) return String.fromCodePoint(Number(decimal));
			if (hexadecimal)
				return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
			return ENTITY_VALUES.get(name.toLowerCase()) ?? match;
		},
	);
}

function shouldCheck(character) {
	return (
		!/\s/u.test(character) &&
		!/\p{Control}/u.test(character) &&
		!/\p{Surrogate}/u.test(character) &&
		!/\p{Private_Use}/u.test(character) &&
		!/\p{Extended_Pictographic}/u.test(character) &&
		character !== "\u200d" &&
		character !== "\ufe0e" &&
		character !== "\ufe0f"
	);
}

async function listSourceFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return listSourceFiles(entryPath);
			if (SOURCE_EXTENSIONS.has(path.extname(entry.name)))
				return [entryPath];
			return [];
		}),
	);
	return files.flat();
}

function extractJson(source, filePath) {
	const sourceFile = ts.parseJsonText(filePath, source);
	const visit = (node) => {
		if (
			ts.isStringLiteral(node) &&
			!(
				node.parent &&
				ts.isPropertyAssignment(node.parent) &&
				node.parent.name === node
			)
		) {
			addText(
				node.text,
				filePath,
				node.getStart(sourceFile),
				"JSON value",
			);
		}
		ts.forEachChild(node, visit);
	};

	if (sourceFile.parseDiagnostics.length > 0) {
		const diagnostic = sourceFile.parseDiagnostics[0];
		throw new Error(
			`${relative(filePath)} is not valid JSON: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
		);
	}
	visit(sourceFile);
}

function extractScript(
	source,
	filePath,
	baseOffset = 0,
	kind = ts.ScriptKind.TSX,
) {
	const sourceFile = ts.createSourceFile(
		filePath,
		source,
		ts.ScriptTarget.Latest,
		true,
		kind,
	);

	const visit = (node) => {
		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateHead(node) ||
			ts.isTemplateMiddle(node) ||
			ts.isTemplateTail(node)
		) {
			addText(
				node.text,
				filePath,
				baseOffset + node.getStart(sourceFile),
				"script string",
			);
		} else if (ts.isJsxText(node)) {
			addText(
				node.getText(sourceFile),
				filePath,
				baseOffset + node.pos,
				"JSX text",
			);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
}

function extractCss(source, filePath, baseOffset = 0) {
	const contentPattern = /(?:^|[;{])\s*content\s*:\s*(["'])(.*?)\1/gs;
	for (const match of source.matchAll(contentPattern)) {
		addText(
			match[2],
			filePath,
			baseOffset + match.index + match[0].indexOf(match[2]),
			"CSS content",
		);
	}
}

function extractAstro(source, filePath) {
	let markup = source;
	const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
	if (frontmatter) {
		const bodyOffset =
			frontmatter.index + frontmatter[0].indexOf(frontmatter[1]);
		extractScript(frontmatter[1], filePath, bodyOffset, ts.ScriptKind.TS);
		markup = `${" ".repeat(frontmatter[0].length)}${source.slice(frontmatter[0].length)}`;
	}

	markup = markup.replace(
		/<script\b[^>]*>([\s\S]*?)<\/script>/gi,
		(full, body, offset) => {
			extractScript(body, filePath, offset + full.indexOf(body));
			return " ".repeat(full.length);
		},
	);
	markup = markup.replace(
		/<style\b[^>]*>([\s\S]*?)<\/style>/gi,
		(full, body, offset) => {
			extractCss(body, filePath, offset + full.indexOf(body));
			return " ".repeat(full.length);
		},
	);

	const attributePattern =
		/\b([:\w-]+)\s*=\s*(?:(["'])(.*?)\2|\{\s*(["'`])([\s\S]*?)\4\s*\})/g;
	for (const match of markup.matchAll(attributePattern)) {
		if (!VISIBLE_ATTRIBUTES.has(match[1].toLowerCase())) continue;
		const value = match[3] ?? match[5] ?? "";
		addText(
			value,
			filePath,
			match.index + match[0].indexOf(value),
			`${match[1]} attribute`,
		);
	}

	const textOnly = markup
		.replace(/<!--[\s\S]*?-->/g, (value) => " ".repeat(value.length))
		.replace(/<[^>]*>/g, (value) => " ".repeat(value.length))
		.replace(/\{[\s\S]*?\}/g, (value) => " ".repeat(value.length));
	for (const match of textOnly.matchAll(/[^\s]+/g)) {
		addText(match[0], filePath, match.index, "Astro text");
	}
}

function extractFile(source, filePath) {
	switch (path.extname(filePath)) {
		case ".astro":
			extractAstro(source, filePath);
			break;
		case ".css":
			extractCss(source, filePath);
			break;
		case ".json":
			extractJson(source, filePath);
			break;
		case ".js":
			extractScript(source, filePath, 0, ts.ScriptKind.JS);
			break;
		case ".jsx":
			extractScript(source, filePath, 0, ts.ScriptKind.JSX);
			break;
		case ".ts":
			extractScript(source, filePath, 0, ts.ScriptKind.TS);
			break;
		case ".tsx":
			extractScript(source, filePath, 0, ts.ScriptKind.TSX);
			break;
	}
}

function relative(filePath) {
	return path.relative(PROJECT_ROOT, filePath);
}

async function lineAndColumn(filePath, offset) {
	const source = await fs.readFile(filePath, "utf8");
	const before = source.slice(0, offset);
	const lines = before.split(/\r?\n/);
	return { line: lines.length, column: [...lines.at(-1)].length + 1 };
}

function codePointLabel(codePoint) {
	return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

const files = await listSourceFiles(SOURCE_ROOT);
for (const filePath of files) {
	extractFile(await fs.readFile(filePath, "utf8"), filePath);
}

const font = fontkit.create(await fs.readFile(FONT_PATH));
const supported = new Set(font.characterSet);
const missing = [...occurrences.keys()]
	.filter((codePoint) => !supported.has(codePoint))
	.sort((left, right) => left - right);

if (missing.length === 0) {
	console.log(
		`Font coverage OK: ${relative(FONT_PATH)} covers all ${occurrences.size} checked characters from ${files.length} source files.`,
	);
	process.exit(0);
}

console.error(
	`Font coverage failed: ${missing.length} character(s) are missing from ${relative(FONT_PATH)}.\n`,
);
for (const codePoint of missing) {
	const character = String.fromCodePoint(codePoint);
	console.error(`${JSON.stringify(character)} ${codePointLabel(codePoint)}`);
	for (const occurrence of occurrences.get(codePoint).slice(0, 3)) {
		const location = await lineAndColumn(
			occurrence.filePath,
			occurrence.offset,
		);
		console.error(
			`  ${relative(occurrence.filePath)}:${location.line}:${location.column} (${occurrence.source})`,
		);
	}
}
console.error(
	"\nEmoji, whitespace, control characters, variation selectors, and private-use characters are intentionally ignored.",
);
process.exit(1);
