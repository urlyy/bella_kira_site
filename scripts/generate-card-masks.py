"""Generate subject-protection masks, without changing or cutting the original art.

uv run --python 3.11 --with 'rembg[cpu]==2.0.67' python scripts/generate-card-masks.py
Read-only validation is included in npm run cards:check.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "public/assets/flash-cards"
MODEL = "isnet-anime"
VERSION = 1


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    from PIL import Image, ImageFilter, ImageOps
    from rembg import new_session, remove

    cards = [{"file": p.name, "id": p.stem if re.match(r"gallery-\d+\.", p.name)
              else "artwork-" + digest(p.name.encode())[:8]}
             for p in sorted((ROOT / "public/assets/gallery").iterdir())
             if p.is_file() and p.suffix.lower() in {".avif", ".gif", ".jpg", ".jpeg", ".png", ".webp"}]
    session = None
    for card in cards:
        source = ROOT / "public/assets/gallery" / card["file"]
        folder = DIRECTORY / card["id"]
        folder.mkdir(parents=True, exist_ok=True)
        record = folder / "mask-source.json"
        source_hash = digest(source.read_bytes())
        revision = 3 if card["id"] in {"gallery-008", "gallery-009", "gallery-042"} else VERSION
        if record.exists():
            old = json.loads(record.read_text())
            if (old.get("version") == revision and old.get("sourceHash") == source_hash
                and all((folder / name).exists() and digest((folder / name).read_bytes()) == old.get(key)
                        for name, key in [("subject-mask.png", "subjectHash"), ("background-mask.png", "backgroundHash")])):
                continue
        if session is None:
            session = new_session(MODEL, providers=["CPUExecutionProvider"])
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((1024, 1024))
            if card["id"] in {"gallery-008", "gallery-009"}:
                import numpy as np
                from scipy.ndimage import label
                pixels = np.asarray(image).astype(float)
                color = np.median(pixels[:, :3], axis=(0, 1))
                candidates = np.max(np.abs(pixels - color), axis=2) < 38
                regions, _ = label(candidates)
                border = np.unique(np.concatenate([regions[0], regions[-1], regions[:, 0], regions[:, -1]]))
                background = np.isin(regions, border[border != 0])
                mask = Image.fromarray(np.uint8(~background) * 255)
            elif card["id"] == "gallery-042":
                mask = remove(image.rotate(-90, expand=True), session=session, only_mask=True).convert("L").rotate(90, expand=True)
            else:
                mask = remove(image, session=session, only_mask=True).convert("L")
        # Slightly expand protection so antialiased hair edges do not take the foil tint.
        mask = mask.point(lambda v: min(255, v * 2)).filter(ImageFilter.MaxFilter(5))
        mask.save(folder / "subject-mask.png", optimize=True)
        background = Image.new("RGBA", mask.size, (255, 255, 255, 0))
        background.putalpha(ImageOps.invert(mask))
        background.save(folder / "background-mask.png", optimize=True)
        record.write_text(json.dumps({
            "version": revision, "model": MODEL, "sourceHash": source_hash,
            "subjectHash": digest((folder / "subject-mask.png").read_bytes()),
            "backgroundHash": digest((folder / "background-mask.png").read_bytes()),
        }, indent="\t") + "\n")
        print("Generated subject mask:", card["id"], flush=True)


if __name__ == "__main__":
    main()
