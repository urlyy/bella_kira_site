// Card-space movement and spring settings follow Simey's pokemon-cards-css.
// Fixed 60 Hz steps preserve the same response on 60/120 Hz displays.
export function createHoloMotion() {
	const value = { x: 0.5, y: 0.5, opacity: 0 };
	const velocity = { x: 0, y: 0, opacity: 0 };
	let target = { ...value },
		remaining = 0,
		returnAt = Infinity,
		returning = false,
		mass = 1;
	return {
		value,
		move(x, y) {
			target = {
				x: Math.max(0, Math.min(1, x)),
				y: Math.max(0, Math.min(1, y)),
				opacity: 1,
			};
			returnAt = Infinity;
			returning = false;
			mass = 1;
		},
		leave(now) {
			if (returnAt === Infinity && !returning) returnAt = now + 500;
		},
		reset() {
			Object.assign(value, { x: 0.5, y: 0.5, opacity: 0 });
			Object.assign(velocity, { x: 0, y: 0, opacity: 0 });
			target = { ...value };
			returnAt = Infinity;
			returning = false;
			remaining = 0;
		},
		step(dt, now, reduced = false) {
			if (now >= returnAt) {
				target = { x: 0.5, y: 0.5, opacity: 0 };
				returning = true;
				mass = 0;
				returnAt = Infinity;
			}
			if (reduced) {
				Object.assign(value, target);
				Object.assign(velocity, { x: 0, y: 0, opacity: 0 });
				remaining = 0;
				return value;
			}
			remaining += Math.min(dt, 0.06);
			while (remaining >= 1 / 60 - 1e-9) {
				remaining -= 1 / 60;
				mass = returning ? Math.min(1, mass + 1 / 60) : 1;
				for (const key of Object.keys(value)) {
					velocity[key] +=
						((target[key] - value[key]) *
							(returning ? 0.01 : 0.066) -
							velocity[key] * (returning ? 0.06 : 0.25)) *
						mass;
					value[key] += velocity[key];
				}
			}
			return value;
		},
	};
}

// CSS percentages position the excess image area, not the card itself.
export function holoBackground(x, y) {
	return { x: 0.37 + 0.26 * x, y: 0.33 + 0.34 * y };
}
