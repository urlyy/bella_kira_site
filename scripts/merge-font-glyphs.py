from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable


def unicode_cmap(font: TTFont) -> dict[int, str]:
    cmap: dict[int, str] = {}
    for table in font["cmap"].tables:
        if table.isUnicode():
            cmap.update(table.cmap)
    return cmap


def add_glyph(target: TTFont, source: TTFont, code_point: int) -> None:
    source_name = unicode_cmap(source).get(code_point)
    if source_name is None:
        raise ValueError(
            f"{source.reader.file.name} does not contain U+{code_point:04X}"
        )

    target_name = f"siteuni{code_point:04X}"
    target_advance = target["hmtx"].metrics.get("uni4E00", (target["head"].unitsPerEm, 0))[0]
    source_advance = source["hmtx"].metrics[source_name][0]
    scale = target["head"].unitsPerEm / source["head"].unitsPerEm
    x_offset = (target_advance - source_advance * scale) / 2

    pen = TTGlyphPen(target.getGlyphSet())
    transform_pen = TransformPen(pen, (scale, 0, 0, scale, x_offset, 0))
    source.getGlyphSet()[source_name].draw(transform_pen)

    glyph = pen.glyph()
    target["glyf"].glyphs[target_name] = glyph
    glyph.recalcBounds(target["glyf"])
    target["hmtx"].metrics[target_name] = (target_advance, glyph.xMin)
    if "vmtx" in target:
        target["vmtx"].metrics[target_name] = target["vmtx"].metrics.get(
            "uni4E00", (target["head"].unitsPerEm, 0)
        )
    target.setGlyphOrder([*target.getGlyphOrder(), target_name])
    for table in target["cmap"].tables:
        if table.isUnicode() and (
            table.format == 12 or code_point <= 0xFFFF
        ):
            table.cmap[code_point] = target_name


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("output")
    parser.add_argument(
        "addition",
        nargs="+",
        help="FONT_PATH:HEX_CODE_POINT[,HEX_CODE_POINT...]",
    )
    args = parser.parse_args()

    target = TTFont(args.base, recalcBBoxes=True, recalcTimestamp=False)
    target.ensureDecompiled()
    for addition in args.addition:
        font_path, code_points = addition.rsplit(":", 1)
        source = TTFont(font_path)
        for code_point in code_points.split(","):
            add_glyph(target, source, int(code_point, 16))
        source.close()

    default_advance = target["hmtx"].metrics.get(
        "uni4E00", (target["head"].unitsPerEm, 0)
    )[0]
    for glyph_name in target.getGlyphOrder():
        target["hmtx"].metrics.setdefault(glyph_name, (default_advance, 0))
        if "vmtx" in target:
            target["vmtx"].metrics.setdefault(
                glyph_name, (target["head"].unitsPerEm, 0)
            )
    target["maxp"].numGlyphs = len(target.getGlyphOrder())
    target["hhea"].advanceWidthMax = max(
        advance for advance, _ in target["hmtx"].metrics.values()
    )
    missing_metrics = [
        glyph_name
        for glyph_name in target.getGlyphOrder()
        if glyph_name not in target["hmtx"].metrics
    ]
    if missing_metrics:
        raise ValueError(f"Missing metrics before save: {missing_metrics}")
    rebuilt_hmtx = newTable("hmtx")
    rebuilt_hmtx.metrics = dict(target["hmtx"].metrics)
    target["hmtx"] = rebuilt_hmtx
    intermediate = Path(args.output).with_suffix(".ttf")
    target.flavor = None
    target.save(intermediate, reorderTables=False)
    target.close()

    compressed = TTFont(intermediate, recalcTimestamp=False)
    compressed.flavor = "woff2"
    compressed.save(Path(args.output), reorderTables=False)
    compressed.close()
    intermediate.unlink()


if __name__ == "__main__":
    main()
