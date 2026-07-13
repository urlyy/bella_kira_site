declare module "gifenc" {
	export type Palette = number[][];

	export interface Encoder {
		writeFrame(
			indexed: Uint8Array,
			width: number,
			height: number,
			options: {
				palette: Palette;
				delay?: number;
				repeat?: number;
				transparent?: boolean;
				transparentIndex?: number;
				dispose?: number;
			},
		): void;
		finish(): void;
		bytes(): Uint8Array;
	}

	function GIFEncoder(): Encoder;
	function quantize(
		rgba: Uint8ClampedArray,
		maxColors: number,
		options?: {
			format?: "rgb444" | "rgb565" | "rgba4444";
			oneBitAlpha?: boolean;
		},
	): Palette;
	function applyPalette(
		rgba: Uint8ClampedArray,
		palette: Palette,
		format?: "rgb444" | "rgb565" | "rgba4444",
	): Uint8Array;

	const gifenc: {
		GIFEncoder: typeof GIFEncoder;
		quantize: typeof quantize;
		applyPalette: typeof applyPalette;
	};
	export default gifenc;
}
