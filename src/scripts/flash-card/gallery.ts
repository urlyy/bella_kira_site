export function setupGalleryCards() {
	const dialog = document.querySelector<HTMLDialogElement>(
		"[data-gallery-card-dialog]",
	);
	const host = dialog?.querySelector<HTMLElement>("[data-flash-card-viewer]");
	const links = Array.from(
		document.querySelectorAll<HTMLButtonElement>(
			".gallery-card[data-card-config]",
		),
	);
	if (!dialog || !host || !links.length) return;

	let index = 0;
	let request = 0;
	let dispose: (() => void) | undefined;
	let trigger: HTMLElement | undefined;
	const previous = host.querySelector<HTMLButtonElement>(
		"[data-card-previous]",
	)!;
	const next = host.querySelector<HTMLButtonElement>("[data-card-next]")!;
	const count = host.querySelector<HTMLElement>("[data-card-count]")!;
	const loading = host.querySelector<HTMLElement>('[data-card="loading"]')!;

	const show = async (target: number) => {
		const ticket = ++request;
		dispose?.();
		dispose = undefined;
		index = (target + links.length) % links.length;
		const link = links[index];
		host.dataset.state = "loading";
		loading.hidden = false;
		loading.classList.remove("error");
		loading.setAttribute("role", "status");
		loading.textContent = "正在载入闪卡";
		host.querySelector<HTMLElement>('[data-card="notice"]')!.hidden = true;
		host.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
			"button,input",
		).forEach((control) => (control.disabled = true));
		dialog.setAttribute(
			"aria-label",
			link.getAttribute("aria-label") || "3D 闪卡预览",
		);
		count.textContent = `${index + 1} / ${links.length}`;
		try {
			// Three.js and the original artwork load only after a card is opened.
			const { mountFlashCard } = await import("./app.js");
			if (ticket !== request || !dialog.open) return;
			dispose = mountFlashCard(host, link.dataset.cardConfig);
		} catch {
			if (ticket !== request || !dialog.open) return;
			host.dataset.state = "error";
			loading.setAttribute("role", "alert");
			loading.classList.add("error");
			loading.textContent = "闪卡暂时无法加载";
			const retry = document.createElement("button");
			retry.type = "button";
			retry.textContent = "重新加载";
			retry.onclick = () => void show(index);
			loading.append(retry);
			host.querySelector<HTMLElement>(
				'[data-card="notice-message"]',
			)!.textContent = "闪卡加载失败，请重新加载";
			host.querySelector<HTMLElement>('[data-card="notice"]')!.hidden =
				false;
		}
	};
	links.forEach((link, target) => {
		link.addEventListener("click", () => {
			trigger = link;
			dialog.showModal();
			void show(target);
		});
	});
	for (const [link, delta] of [
		[previous, -1],
		[next, 1],
	] as const) {
		link.addEventListener("click", () => {
			void show(index + delta);
		});
	}
	const release = () => {
		request++;
		dispose?.();
		dispose = undefined;
		host.dataset.state = "closed";
		trigger?.focus({ preventScroll: true });
	};
	const close = () => {
		dialog.close();
		release();
	};
	dialog.querySelector("[data-card-close]")?.addEventListener("click", close);
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) close();
	});
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
		close();
	});
	dialog.addEventListener("close", () => {
		// Native close events are queued. An earlier close must not dispose a
		// viewer that the user has already opened again.
		if (!dialog.open && host.dataset.state !== "closed") release();
	});
	window.addEventListener("bella:pagewillchange", () => {
		if (dialog.open) close();
	});
}
