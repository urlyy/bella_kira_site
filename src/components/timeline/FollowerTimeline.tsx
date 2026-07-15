import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
	timelineEvents,
	type TimelineEvent,
} from "../../content/timeline-events";
import "./follower-timeline.css";

const REQUEST_URL = "/api/fans?name=%E8%B4%9D%E6%8B%89kira";
const PLAY_DURATION = 12000;

type Snapshot = { fetched_at: string; follower_count: number };
type ApiResponse = { ok: boolean; count: number; snapshots: Snapshot[] };
type Point = { date: Date; count: number };
type EventMarker = TimelineEvent & { dateObject: Date };
type ActiveEvent = {
	event: EventMarker;
	x: number;
	y: number;
	placement: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

function parseApiDate(value: string) {
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC\+8$/,
	);
	if (!match) return new Date(value);
	const [, y, m, d, h, min, s] = match;
	return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+08:00`);
}

function parseEventDate(value: string) {
	return new Date(`${value}T12:00:00+08:00`);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

const formatDate = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	year: "numeric",
	month: "long",
	day: "numeric",
});
const formatCount = new Intl.NumberFormat("zh-CN");

function positionMovingPoint(
	svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
	progress: number,
	innerWidth: number,
) {
	const path = svg.select<SVGPathElement>(".timeline-line").node();
	if (!path) return;
	const targetX = innerWidth * progress;
	let start = 0;
	let end = path.getTotalLength();
	for (let step = 0; step < 18; step += 1) {
		const middle = (start + end) / 2;
		if (path.getPointAtLength(middle).x < targetX) start = middle;
		else end = middle;
	}
	const point = path.getPointAtLength((start + end) / 2);
	svg.select<SVGLineElement>(".timeline-playhead")
		.attr("x1", point.x)
		.attr("x2", point.x);
	svg.select<SVGGElement>(".timeline-moving-point").attr(
		"transform",
		`translate(${point.x},${point.y})`,
	);
}

export default function FollowerTimeline() {
	const svgRef = useRef<SVGSVGElement>(null);
	const chartRef = useRef<HTMLDivElement>(null);
	const frameRef = useRef<number | null>(null);
	const startedAtRef = useRef(0);
	const startProgressRef = useRef(0);
	const readyRef = useRef(false);
	const autoPlayedRef = useRef(false);
	const progressRef = useRef(1);
	const previousProgressRef = useRef(1);
	const playingRef = useRef(false);
	const chartStateRef = useRef<{
		innerWidth: number;
		innerHeight: number;
		marginLeft: number;
		marginTop: number;
		x: d3.ScaleTime<number, number>;
		y: d3.ScaleLinear<number, number>;
	} | null>(null);
	const [points, setPoints] = useState<Point[]>([]);
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [error, setError] = useState("");
	const [progress, setProgress] = useState(1);
	const [playing, setPlaying] = useState(false);
	const [hovered, setHovered] = useState<Point | null>(null);
	const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);

	progressRef.current = progress;
	playingRef.current = playing;

	const load = useCallback(async () => {
		readyRef.current = false;
		setStatus("loading");
		setPlaying(false);
		setError("");
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 30000);
		try {
			const response = await fetch(REQUEST_URL, {
				signal: controller.signal,
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = (await response.json()) as ApiResponse;
			if (!payload.ok || !Array.isArray(payload.snapshots))
				throw new Error("数据格式不正确");
			const parsed = payload.snapshots
				.map((item) => ({
					date: parseApiDate(item.fetched_at),
					count: Number(item.follower_count),
				}))
				.filter(
					(item) =>
						Number.isFinite(item.date.getTime()) &&
						Number.isFinite(item.count),
				)
				.sort((a, b) => a.date.getTime() - b.date.getTime());
			if (parsed.length < 2) throw new Error("可用记录不足");
			setPoints(parsed);
			readyRef.current = true;
			setStatus("ready");
			const reduceMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			if (reduceMotion) {
				autoPlayedRef.current = true;
				setProgress(1);
			} else {
				setProgress(0);
				previousProgressRef.current = 0;
				if (window.location.hash === "#timeline") {
					autoPlayedRef.current = true;
					setActiveEvent(null);
					startProgressRef.current = 0;
					startedAtRef.current = performance.now();
					window.requestAnimationFrame(() => setPlaying(true));
				}
			}
		} catch (reason) {
			setError(
				reason instanceof DOMException && reason.name === "AbortError"
					? "等待数据超时了"
					: "暂时没能取得粉丝记录",
			);
			setStatus("error");
		} finally {
			window.clearTimeout(timeout);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const eventMarkers = useMemo(
		() =>
			timelineEvents
				.map((event) => ({
					...event,
					dateObject: parseEventDate(event.date),
				}))
				.filter((event) => Number.isFinite(event.dateObject.getTime()))
				.sort(
					(a, b) => a.dateObject.getTime() - b.dateObject.getTime(),
				),
		[],
	);
	const timelineDomain = useMemo<[Date, Date] | null>(() => {
		if (!points.length) return null;
		const firstPoint = points[0].date;
		const lastPoint = points[points.length - 1].date;
		const firstEvent = eventMarkers[0]?.dateObject;
		const lastEvent = eventMarkers[eventMarkers.length - 1]?.dateObject;
		return [
			firstEvent && firstEvent < firstPoint ? firstEvent : firstPoint,
			lastEvent && lastEvent > lastPoint ? lastEvent : lastPoint,
		];
	}, [eventMarkers, points]);
	const visibleIndex = useMemo(() => {
		if (!points.length || !timelineDomain) return 0;
		const [start, end] = timelineDomain;
		const playheadDate = new Date(
			start.getTime() + (end.getTime() - start.getTime()) * progress,
		);
		return d3
			.bisector<Point, Date>((d) => d.date)
			.center(points, playheadDate);
	}, [points, progress, timelineDomain]);
	const currentPoint = hovered ?? points[visibleIndex] ?? null;
	const latestPoint = points.at(-1) ?? null;
	const showEvent = useCallback(
		(event: EventMarker, syncSummary = false) => {
			const chartState = chartStateRef.current;
			if (!chartState || !points.length) return;
			const pointBisect = d3.bisector<Point, Date>((d) => d.date).center;
			const nearest =
				points[pointBisect(points, event.dateObject)] ?? points[0];
			const eventX = chartState.x(event.dateObject);
			const eventY = clamp(
				chartState.y(nearest.count),
				18,
				chartState.innerHeight - 24,
			);
			const placeAbove = eventY > chartState.innerHeight * 0.68;
			const placeLeft = eventX > chartState.innerWidth * 0.58;
			setHovered(syncSummary ? nearest : null);
			if (svgRef.current) {
				d3.select(svgRef.current)
					.select(".timeline-hover-focus")
					.style("display", "none");
			}
			setActiveEvent({
				event,
				x: chartState.marginLeft + eventX,
				y: chartState.marginTop + eventY,
				placement: `${placeAbove ? "top" : "bottom"}-${placeLeft ? "left" : "right"}`,
			});
		},
		[points],
	);

	useEffect(() => {
		if (!playing) return;
		const tick = (now: number) => {
			const elapsed = now - startedAtRef.current;
			const next = Math.min(
				1,
				startProgressRef.current + elapsed / PLAY_DURATION,
			);
			setProgress(next);
			if (next < 1) frameRef.current = requestAnimationFrame(tick);
			else setPlaying(false);
		};
		frameRef.current = requestAnimationFrame(tick);
		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
		};
	}, [playing]);

	useEffect(() => {
		const finishBeforeLeaving = (event: Event) => {
			const detail = (
				event as CustomEvent<{ fromHash?: string; toHash?: string }>
			).detail;
			if (
				detail?.fromHash !== "#timeline" ||
				detail.toHash === "#timeline" ||
				!readyRef.current
			)
				return;

			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
			progressRef.current = 1;
			playingRef.current = false;
			setPlaying(false);
			setHovered(null);
			setActiveEvent(null);
			setProgress(1);

			const chartState = chartStateRef.current;
			if (!svgRef.current || !chartState || !points.length) return;
			const latest = points[points.length - 1];
			const ax = chartState.x(latest.date);
			const ay = chartState.y(latest.count);
			const svg = d3.select(svgRef.current);
			svg.select<SVGRectElement>(".timeline-reveal-rect").attr(
				"width",
				chartState.innerWidth,
			);
			svg.select<SVGLineElement>(".timeline-playhead")
				.attr("x1", ax)
				.attr("x2", ax);
			svg.select<SVGGElement>(".timeline-moving-point").attr(
				"transform",
				`translate(${ax},${ay})`,
			);
		};

		window.addEventListener("bella:pagewillchange", finishBeforeLeaving);
		return () =>
			window.removeEventListener(
				"bella:pagewillchange",
				finishBeforeLeaving,
			);
	}, [points]);

	useEffect(() => {
		const autoplayWhenEntered = (event: Event) => {
			const detail = (event as CustomEvent<{ hash?: string }>).detail;
			if (
				detail?.hash !== "#timeline" ||
				!readyRef.current ||
				autoPlayedRef.current
			)
				return;
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				autoPlayedRef.current = true;
				setProgress(1);
				return;
			}
			autoPlayedRef.current = true;
			setHovered(null);
			setActiveEvent(null);
			setProgress(0);
			previousProgressRef.current = 0;
			startProgressRef.current = 0;
			startedAtRef.current = performance.now();
			setPlaying(true);
		};
		window.addEventListener("bella:pagechange", autoplayWhenEntered);
		return () => {
			window.removeEventListener("bella:pagechange", autoplayWhenEntered);
		};
	}, []);

	const togglePlayback = () => {
		if (playing) {
			setPlaying(false);
			return;
		}
		const nextStart = progress >= 1 ? 0 : progress;
		setHovered(null);
		setActiveEvent(null);
		setProgress(nextStart);
		previousProgressRef.current = nextStart;
		startProgressRef.current = nextStart;
		startedAtRef.current = performance.now();
		setPlaying(true);
	};

	useEffect(() => {
		if (!svgRef.current || !chartRef.current || points.length < 2) return;
		const container = chartRef.current;
		const svg = d3.select(svgRef.current);
		const render = () => {
			const width = container.clientWidth;
			const height = container.clientHeight;
			const compact = width < 680;
			const margin = {
				top: 32,
				right: compact ? 18 : 38,
				bottom: 46,
				left: compact ? 52 : 76,
			};
			const innerWidth = Math.max(1, width - margin.left - margin.right);
			const innerHeight = Math.max(
				1,
				height - margin.top - margin.bottom,
			);
			if (!timelineDomain) return;
			const x = d3
				.scaleTime()
				.domain(timelineDomain)
				.range([0, innerWidth]);
			const countExtent = d3.extent(points, (d) => d.count) as [
				number,
				number,
			];
			const padding = Math.max(
				1000,
				(countExtent[1] - countExtent[0]) * 0.07,
			);
			const y = d3
				.scaleLinear()
				.domain([countExtent[0] - padding, countExtent[1] + padding])
				.nice()
				.range([innerHeight, 0]);
			svg.attr("viewBox", `0 0 ${width} ${height}`);
			svg.selectAll("*").remove();
			const defs = svg.append("defs");
			const gradient = defs
				.append("linearGradient")
				.attr("id", "timeline-area")
				.attr("x1", "0")
				.attr("y1", "0")
				.attr("x2", "1")
				.attr("y2", ".18");
			gradient
				.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", "#76509a")
				.attr("stop-opacity", 0.5);
			gradient
				.append("stop")
				.attr("offset", "43%")
				.attr("stop-color", "#b36f9d")
				.attr("stop-opacity", 0.42);
			gradient
				.append("stop")
				.attr("offset", "72%")
				.attr("stop-color", "#db7d74")
				.attr("stop-opacity", 0.38);
			gradient
				.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", "#fff0aa")
				.attr("stop-opacity", 0.34);
			const areaMaskGradient = defs
				.append("linearGradient")
				.attr("id", "timeline-area-mask-gradient")
				.attr("x1", "0")
				.attr("y1", "0")
				.attr("x2", "0")
				.attr("y2", "1");
			areaMaskGradient
				.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", "white")
				.attr("stop-opacity", 0.96);
			areaMaskGradient
				.append("stop")
				.attr("offset", "48%")
				.attr("stop-color", "white")
				.attr("stop-opacity", 0.3);
			areaMaskGradient
				.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", "white")
				.attr("stop-opacity", 0);
			const areaMask = defs
				.append("mask")
				.attr("id", "timeline-area-fade");
			areaMask
				.append("rect")
				.attr("width", innerWidth)
				.attr("height", innerHeight)
				.attr("fill", "url(#timeline-area-mask-gradient)");
			const lineGradient = defs
				.append("linearGradient")
				.attr("id", "timeline-stroke")
				.attr("x1", "0")
				.attr("y1", "0")
				.attr("x2", "1")
				.attr("y2", "0");
			lineGradient
				.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", "#9a74ca");
			lineGradient
				.append("stop")
				.attr("offset", "32%")
				.attr("stop-color", "#c284bb");
			lineGradient
				.append("stop")
				.attr("offset", "59%")
				.attr("stop-color", "#db7d74");
			lineGradient
				.append("stop")
				.attr("offset", "81%")
				.attr("stop-color", "#edaa8e");
			lineGradient
				.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", "#fff0a8");
			const glow = defs
				.append("filter")
				.attr("id", "timeline-glow")
				.attr("x", "-30%")
				.attr("width", "160%");
			glow.append("feGaussianBlur")
				.attr("stdDeviation", "3.5")
				.attr("result", "blur");
			const merge = glow.append("feMerge");
			merge.append("feMergeNode").attr("in", "blur");
			merge.append("feMergeNode").attr("in", "SourceGraphic");
			const clip = defs.append("clipPath").attr("id", "timeline-reveal");
			clip.append("rect")
				.attr("class", "timeline-reveal-rect")
				.attr("height", innerHeight + 8)
				.attr("y", -4);
			const root = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);
			root.append("rect")
				.attr("class", "timeline-plot-wash")
				.attr("width", innerWidth)
				.attr("height", innerHeight)
				.attr("rx", 2);
			root.append("g")
				.attr("class", "timeline-grid")
				.call(
					d3
						.axisLeft(y)
						.ticks(compact ? 4 : 5)
						.tickSize(-innerWidth)
						.tickFormat(() => ""),
				);
			root.append("g")
				.attr("class", "timeline-grid timeline-grid-x")
				.attr("transform", `translate(0,${innerHeight})`)
				.call(
					d3
						.axisBottom(x)
						.ticks(compact ? 4 : 7)
						.tickSize(-innerHeight)
						.tickFormat(() => ""),
				);
			root.append("g")
				.attr("class", "timeline-axis timeline-axis-x")
				.attr("transform", `translate(0,${innerHeight})`)
				.call(
					d3
						.axisBottom(x)
						.ticks(compact ? 4 : 7)
						.tickFormat(d3.timeFormat("%Y.%m") as never),
				);
			root.append("g")
				.attr("class", "timeline-axis timeline-axis-y")
				.call(
					d3
						.axisLeft(y)
						.ticks(compact ? 4 : 5)
						.tickFormat(
							(d) => `${Math.round(Number(d) / 10000)}万`,
						),
				);
			const line = d3
				.line<Point>()
				.x((d) => x(d.date))
				.y((d) => y(d.count))
				.curve(d3.curveMonotoneX);
			const area = d3
				.area<Point>()
				.x((d) => x(d.date))
				.y0(innerHeight)
				.y1((d) => y(d.count))
				.curve(d3.curveMonotoneX);
			const revealed = root
				.append("g")
				.attr("clip-path", "url(#timeline-reveal)");
			revealed
				.append("path")
				.datum(points)
				.attr("class", "timeline-area")
				.attr("d", area)
				.attr("mask", "url(#timeline-area-fade)");
			revealed
				.append("path")
				.datum(points)
				.attr("class", "timeline-line-glow")
				.attr("d", line)
				.attr("filter", "url(#timeline-glow)");
			revealed
				.append("path")
				.datum(points)
				.attr("class", "timeline-line")
				.attr("d", line);
			root.append("line")
				.attr("class", "timeline-playhead")
				.attr("y1", 0)
				.attr("y2", innerHeight);
			const movingPoint = root
				.append("g")
				.attr("class", "timeline-moving-point");
			movingPoint
				.append("circle")
				.attr("class", "timeline-point-pulse")
				.attr("r", 9);
			movingPoint
				.append("image")
				.attr("class", "timeline-point")
				.attr("href", "/assets/optimized/beijixing.webp")
				.attr("x", -8)
				.attr("y", -10)
				.attr("width", 16)
				.attr("height", 20)
				.attr("preserveAspectRatio", "xMidYMid meet");
			const focus = root
				.append("g")
				.attr("class", "timeline-hover-focus")
				.style("display", "none");
			focus
				.append("line")
				.attr("class", "timeline-hover-line")
				.attr("y1", 0)
				.attr("y2", innerHeight);
			focus
				.append("circle")
				.attr("class", "timeline-hover-dot")
				.attr("r", 5.5);
			const bisect = d3.bisector<Point, Date>((d) => d.date).center;
			root.append("rect")
				.attr("class", "timeline-hit-area")
				.attr("width", innerWidth)
				.attr("height", innerHeight)
				.on("pointermove", (event) => {
					if (playingRef.current) return;
					const [mx] = d3.pointer(event);
					const point = points[bisect(points, x.invert(mx))];
					if (!point) return;
					setHovered(point);
					focus
						.style("display", null)
						.attr("transform", `translate(${x(point.date)},0)`);
					focus.select("circle").attr("cy", y(point.count));
				})
				.on("pointerleave", () => {
					setHovered(null);
					focus.style("display", "none");
				});
			const eventLayer = root
				.append("g")
				.attr("class", "timeline-event-layer");
			const pointBisect = d3.bisector<Point, Date>((d) => d.date).center;
			const eventNodes = eventLayer
				.selectAll<SVGGElement, EventMarker>("g")
				.data(eventMarkers, (d) => d.id)
				.join("g")
				.attr(
					"class",
					(d) =>
						`timeline-event-node${d.status === "upcoming" ? " is-upcoming" : ""}`,
				)
				.attr("tabindex", "0")
				.attr("role", "button")
				.attr("aria-label", (d) => `${d.date} ${d.title}`)
				.attr("data-event-date", (d) => d.dateObject.getTime())
				.attr("transform", (d) => {
					const nearest =
						points[pointBisect(points, d.dateObject)] ?? points[0];
					const eventX = x(d.dateObject);
					const eventY = clamp(
						y(nearest.count),
						18,
						innerHeight - 24,
					);
					return `translate(${eventX},${eventY})`;
				})
				.style("opacity", (d) =>
					x(d.dateObject) <= innerWidth * progressRef.current + 10
						? 1
						: 0.12,
				)
				.on("pointerenter focus", (_pointerEvent, d) => {
					showEvent(d, true);
				})
				.on("click", (_pointerEvent, d) => {
					showEvent(d, true);
				})
				.on("keydown", (keyboardEvent, d) => {
					if (
						keyboardEvent.key !== "Enter" &&
						keyboardEvent.key !== " "
					)
						return;
					keyboardEvent.preventDefault();
					showEvent(d, true);
				});
			eventNodes
				.append("circle")
				.attr("class", "timeline-event-breath")
				.attr("r", 9);
			eventNodes
				.append("circle")
				.attr("class", "timeline-event-dot")
				.attr("r", 4.5);

			chartStateRef.current = {
				innerWidth,
				innerHeight,
				marginLeft: margin.left,
				marginTop: margin.top,
				x,
				y,
			};
			svg.select<SVGRectElement>(".timeline-reveal-rect").attr(
				"width",
				innerWidth * progressRef.current,
			);
			positionMovingPoint(svg, progressRef.current, innerWidth);
		};
		render();
		const observer = new ResizeObserver(render);
		observer.observe(container);
		return () => observer.disconnect();
	}, [eventMarkers, points, showEvent, timelineDomain]);

	useEffect(() => {
		if (!svgRef.current || !points.length || !chartStateRef.current) return;
		const { innerWidth, x } = chartStateRef.current;
		const svg = d3.select(svgRef.current);
		svg.select<SVGRectElement>(".timeline-reveal-rect").attr(
			"width",
			innerWidth * progress,
		);
		positionMovingPoint(svg, progress, innerWidth);
		svg.selectAll<SVGGElement, EventMarker>(".timeline-event-node").style(
			"opacity",
			(d) => (x(d.dateObject) <= innerWidth * progress + 10 ? 1 : 0.12),
		);

		const previousProgress = previousProgressRef.current;
		previousProgressRef.current = progress;
		if (!playing || progress < previousProgress) return;
		const previousX = innerWidth * previousProgress;
		const currentX = innerWidth * progress;
		const latestX = x(points[points.length - 1].date);
		const crossedEvent = eventMarkers.findLast((event) => {
			const eventX = x(event.dateObject);
			return (
				eventX > previousX && eventX <= currentX && eventX <= latestX
			);
		});
		if (crossedEvent) showEvent(crossedEvent);
	}, [eventMarkers, playing, points, progress, showEvent, visibleIndex]);

	return (
		<section className="follower-timeline" aria-labelledby="timeline-title">
			<div className="timeline-ambient" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<div className="timeline-orbit" aria-hidden="true">
				<i />
				<i />
			</div>
			<header className="timeline-header">
				<div className="timeline-index" aria-hidden="true"></div>
				<div className="timeline-heading">
					<p>STARLIGHT ARCHIVE · 贝极星观测记录</p>
					<h1 id="timeline-title">一路繁花</h1>
					<span>
						沿着每一次相遇，回望贝拉与贝极星共同走过的轨迹。
					</span>
				</div>
				<div className="timeline-live">
					<i /> 数据持续更新
				</div>
			</header>

			<div className="timeline-panel">
				{status === "loading" && (
					<div className="timeline-state" role="status">
						<div className="timeline-loader">
							<i />
							<i />
							<i />
						</div>
						<strong>正在拾取星光记录</strong>
						<span>数据较多，请稍候片刻…</span>
					</div>
				)}
				{status === "error" && (
					<div className="timeline-state" role="alert">
						<div className="timeline-error-star">✦</div>
						<strong>{error}</strong>
						<span>数据源可能正在休息，稍后再试一次吧。</span>
						<button onClick={() => void load()}>重新连接</button>
					</div>
				)}
				{status === "ready" && (
					<>
						<div className="timeline-context" aria-hidden="true">
							<span>FOLLOWER TRAJECTORY</span>
							<strong>
								{latestPoint
									? `2020 — ${latestPoint.date.getFullYear()}`
									: "—"}
							</strong>
							<p>
								<i /> 贝拉kira · Bilibili
							</p>
						</div>
						<div className="timeline-summary">
							<span>
								{currentPoint
									? formatDate.format(currentPoint.date)
									: "—"}
							</span>
							<small className="timeline-summary-label">
								BILIBILI 粉丝量
							</small>
							<div>
								<strong>
									{currentPoint
										? formatCount.format(currentPoint.count)
										: "—"}
								</strong>
								<small>人</small>
							</div>
							<p>
								<em>
									{hovered
										? "正在查看记录"
										: playing
											? "时光正在流动"
											: progress < 1
												? "播放已暂停"
												: "最新观测"}
								</em>
							</p>
						</div>
						<div className="timeline-chart" ref={chartRef}>
							<span
								className="timeline-axis-label"
								aria-hidden="true"
							>
								粉丝量（人）
							</span>
							<svg
								ref={svgRef}
								role="img"
								aria-label="贝拉kira粉丝数量历史折线图"
							/>
							{activeEvent && (
								<article
									className={`timeline-event-card is-${activeEvent.placement}${activeEvent.event.status === "upcoming" ? " is-upcoming" : ""}`}
									style={
										{
											"--event-x": `${activeEvent.x}px`,
											"--event-y": `${activeEvent.y}px`,
										} as React.CSSProperties
									}
								>
									<button
										type="button"
										className="timeline-event-close"
										onClick={() => {
											setActiveEvent(null);
											setHovered(null);
										}}
										aria-label="关闭事件卡片"
									>
										×
									</button>
									<strong>{activeEvent.event.title}</strong>
									<time dateTime={activeEvent.event.date}>
										{activeEvent.event.date}
										{activeEvent.event.status === "upcoming"
											? " · 即将到来"
											: ""}
									</time>
									<p>{activeEvent.event.description}</p>
									{activeEvent.event.links?.length ? (
										<div className="timeline-event-links">
											{activeEvent.event.links.map(
												(link) => (
													<a
														key={link.url}
														href={link.url}
														target="_blank"
														rel="noreferrer"
													>
														{link.label}
													</a>
												),
											)}
										</div>
									) : null}
								</article>
							)}
						</div>
						<div className="timeline-controls">
							<button
								className="timeline-play"
								onClick={togglePlayback}
								aria-label={
									playing
										? "暂停播放"
										: progress >= 1
											? "从头播放"
											: "继续播放"
								}
							>
								<span aria-hidden="true">
									{playing ? "Ⅱ" : "▶"}
								</span>
								{playing
									? "暂停"
									: progress >= 1
										? "播放时光"
										: "继续"}
							</button>
							<label>
								<span className="sr-only">播放进度</span>
								<input
									style={
										{
											"--timeline-progress": `${progress * 100}%`,
										} as React.CSSProperties
									}
									type="range"
									min="0"
									max="1"
									step="0.001"
									value={progress}
									onChange={(event) => {
										setPlaying(false);
										setHovered(null);
										setProgress(Number(event.target.value));
									}}
								/>
							</label>
							<span>
								<b>{points.length}</b> 次观测
							</span>
						</div>
					</>
				)}
			</div>
			<p className="timeline-footnote">
				原始数据来源：
				<a
					href="https://zeroroku.com/bilibili/author/672353429"
					target="_blank"
					rel="noreferrer"
				>
					ZeroRoku
				</a>
				<span aria-hidden="true"> · </span>
				当前增量数据来源：自制爬虫每日23时爬取
			</p>
		</section>
	);
}
