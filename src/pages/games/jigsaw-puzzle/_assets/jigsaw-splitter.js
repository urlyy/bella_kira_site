(function () {
	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

	function mulberry32(seed) {
		let state = seed >>> 0;
		return function () {
			state += 0x6d2b79f5;
			let value = state;
			value = Math.imul(value ^ (value >>> 15), value | 1);
			value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
			return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
		};
	}

	function randomEdge(random) {
		return {
			direction: random() < 0.5 ? -1 : 1,
			center: 0.43 + random() * 0.14,
			width: 0.25 + random() * 0.1,
			depth: 0.16 + random() * 0.08,
			shoulder: 0.34 + random() * 0.12,
		};
	}

	function createTopology(
		rows,
		columns,
		seed = Math.floor(Math.random() * 0xffffffff),
	) {
		if (
			!Number.isInteger(rows) ||
			!Number.isInteger(columns) ||
			rows < 2 ||
			columns < 2
		) {
			throw new Error("拼图行列数必须是不小于 2 的整数");
		}
		const random = mulberry32(seed);
		const vertical = Array.from({ length: rows }, () =>
			Array.from({ length: columns - 1 }, () => randomEdge(random)),
		);
		const horizontal = Array.from({ length: rows - 1 }, () =>
			Array.from({ length: columns }, () => randomEdge(random)),
		);
		return { rows, columns, seed, vertical, horizontal };
	}

	function edgeSegment(startX, startY, endX, endY, edge, sign) {
		if (!edge) return `L ${endX} ${endY}`;
		const dx = endX - startX,
			dy = endY - startY;
		const length = Math.hypot(dx, dy);
		const tx = dx / length,
			ty = dy / length;
		const nx = ty * sign,
			ny = -tx * sign;
		const center = edge.center * length;
		const half = (edge.width * length) / 2;
		const depth = edge.depth * length * edge.direction;
		const shoulder = edge.shoulder;
		const point = (along, normal = 0) => [
			startX + tx * along + nx * normal,
			startY + ty * along + ny * normal,
		];
		const a = point(center - half),
			b = point(center - half * shoulder, depth);
		const c = point(center + half * shoulder, depth),
			d = point(center + half);
		return [
			`L ${a[0]} ${a[1]}`,
			`C ${point(center - half * 0.82, 0)[0]} ${point(center - half * 0.82, 0)[1]} ${point(center - half * 0.78, depth)[0]} ${point(center - half * 0.78, depth)[1]} ${b[0]} ${b[1]}`,
			`C ${point(center - half * 0.18, depth * 1.12)[0]} ${point(center - half * 0.18, depth * 1.12)[1]} ${point(center + half * 0.18, depth * 1.12)[0]} ${point(center + half * 0.18, depth * 1.12)[1]} ${c[0]} ${c[1]}`,
			`C ${point(center + half * 0.78, depth)[0]} ${point(center + half * 0.78, depth)[1]} ${point(center + half * 0.82, 0)[0]} ${point(center + half * 0.82, 0)[1]} ${d[0]} ${d[1]}`,
			`L ${endX} ${endY}`,
		].join(" ");
	}

	function piecePath(topology, row, column, cellWidth, cellHeight, padding) {
		const left = padding,
			top = padding,
			right = padding + cellWidth,
			bottom = padding + cellHeight;
		const topEdge = row === 0 ? null : topology.horizontal[row - 1][column];
		const rightEdge =
			column === topology.columns - 1
				? null
				: topology.vertical[row][column];
		const bottomEdge =
			row === topology.rows - 1 ? null : topology.horizontal[row][column];
		const leftEdge =
			column === 0 ? null : topology.vertical[row][column - 1];
		const reversed = (edge) =>
			edge && {
				...edge,
				center: 1 - edge.center,
				direction: -edge.direction,
			};
		return [
			`M ${left} ${top}`,
			edgeSegment(left, top, right, top, topEdge, -1),
			edgeSegment(right, top, right, bottom, rightEdge, 1),
			edgeSegment(right, bottom, left, bottom, reversed(bottomEdge), -1),
			edgeSegment(left, bottom, left, top, reversed(leftEdge), 1),
			"Z",
		].join(" ");
	}

	async function loadImage(source) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error("无法读取所选图片"));
			image.src = source;
		});
	}

	async function splitImage(source, rows, columns = rows, seed) {
		const image = await loadImage(source);
		const topology = createTopology(rows, columns, seed);
		const cellWidth = image.naturalWidth / columns;
		const cellHeight = image.naturalHeight / rows;
		const padding = Math.min(cellWidth, cellHeight) * 0.28;
		const pieces = [];
		for (let row = 0; row < rows; row += 1) {
			for (let column = 0; column < columns; column += 1) {
				pieces.push({
					id: row * columns + column,
					row,
					column,
					x: column * cellWidth,
					y: row * cellHeight,
					width: cellWidth,
					height: cellHeight,
					padding,
					path: piecePath(
						topology,
						row,
						column,
						cellWidth,
						cellHeight,
						padding,
					),
				});
			}
		}
		return {
			source,
			seed: topology.seed,
			width: image.naturalWidth,
			height: image.naturalHeight,
			aspectRatio: image.naturalWidth / image.naturalHeight,
			rows,
			columns,
			pieces,
			topology,
		};
	}

	function validateSplit(result) {
		if (
			!result ||
			!Number.isFinite(result.width) ||
			!Number.isFinite(result.height) ||
			result.width <= 0 ||
			result.height <= 0
		)
			return false;
		const { rows, columns, pieces, topology } = result;
		if (
			!topology ||
			topology.rows !== rows ||
			topology.columns !== columns ||
			pieces.length !== rows * columns
		)
			return false;
		if (
			topology.vertical.length !== rows ||
			topology.vertical.some((line) => line.length !== columns - 1)
		)
			return false;
		if (
			topology.horizontal.length !== rows - 1 ||
			topology.horizontal.some((line) => line.length !== columns)
		)
			return false;
		const validEdge = (edge) =>
			edge &&
			[-1, 1].includes(edge.direction) &&
			[edge.center, edge.width, edge.depth, edge.shoulder].every(
				Number.isFinite,
			);
		if (
			topology.vertical.flat().some((edge) => !validEdge(edge)) ||
			topology.horizontal.flat().some((edge) => !validEdge(edge))
		)
			return false;
		const ids = new Set(),
			targets = new Set();
		for (const piece of pieces) {
			const target = `${piece.row}:${piece.column}`;
			if (
				ids.has(piece.id) ||
				targets.has(target) ||
				!piece.path.endsWith("Z")
			)
				return false;
			if (
				piece.row < 0 ||
				piece.row >= rows ||
				piece.column < 0 ||
				piece.column >= columns
			)
				return false;
			if (
				![
					piece.x,
					piece.y,
					piece.width,
					piece.height,
					piece.padding,
				].every(Number.isFinite) ||
				piece.width <= 0 ||
				piece.height <= 0
			)
				return false;
			ids.add(piece.id);
			targets.add(target);
		}
		return ids.size === rows * columns && targets.size === rows * columns;
	}

	window.JigsawSplitter = {
		createTopology,
		piecePath,
		splitImage,
		validateSplit,
		clamp,
	};
})();
