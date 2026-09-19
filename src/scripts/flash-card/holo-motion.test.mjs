import assert from "node:assert/strict";
import test from "node:test";
import { createHoloMotion, holoBackground } from "./holo-motion.mjs";

test("reference layer displacement gains", () => {
	const a = holoBackground(0.5, 0.5),
		b = holoBackground(0.6, 0.6);
	const close = (x, y) => assert(Math.abs(x - y) < 1e-10);
	close((1 - 4) * (b.y - a.y), -0.102);
	close((1 - 7) * (b.y - a.y), -0.204);
	close((1 - 3) * (b.x - a.x), -0.052);
	close((1 - 1.95) * -(b.x - a.x), 0.0247);
	close((1 - 4) * 1.5 * (b.x - a.x), -0.117);
});

test("same spring response at 60 and 120 Hz, with bounded overshoot", () => {
	const run = (fps) => {
		const motion = createHoloMotion();
		motion.move(1, 0);
		let peak = 0;
		for (let i = 1; i <= fps; i++) {
			motion.step(1 / fps, (i * 1000) / fps);
			peak = Math.max(peak, motion.value.x);
		}
		assert(peak > 1 && peak < 1.1);
		assert(Math.abs(motion.value.x - 1) < 0.001);
		return motion.value.x;
	};
	assert(Math.abs(run(60) - run(120)) < 1e-10);
});

test("500 ms return delay, re-entry cancels it, reduced motion snaps", () => {
	const m = createHoloMotion();
	m.move(1, 0);
	m.step(0, 0, true);
	m.leave(0);
	m.step(0, 499, true);
	assert.equal(m.value.x, 1);
	m.move(0.8, 0.2);
	m.step(0, 500, true);
	assert.equal(m.value.x, 0.8);
	m.leave(600);
	m.step(0, 1100, true);
	assert.equal(m.value.x, 0.5);
	assert.equal(m.value.opacity, 0);
	m.move(4, -3);
	m.step(0, 1200, true);
	assert.equal(m.value.x, 1);
	assert.equal(m.value.y, 0);
	m.reset();
	assert.equal(m.value.x, 0.5);
});
