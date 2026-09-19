"""Prepare the borderless, full-art RuiC reference card. Run with uv + Pillow."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parents[2]
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
source = Image.open(SITE / 'public/assets/gallery/gallery-005.png').convert('RGBA')
source = source.resize((1024, 1536), Image.Resampling.LANCZOS)
source.save(assets / 'subject.png')
source.convert('RGB').save(assets / 'background.png')
line = source.convert('L').filter(ImageFilter.FIND_EDGES).point(lambda p: 0 if p > 35 else 255)
ImageDraw.Draw(line).rectangle((0, 0, 1023, 1535), outline=255, width=4)
line.convert('RGB').save(assets / 'lineart.png')
Image.new('RGBA', source.size).save(assets / 'text.png')
(assets / 'effects.png').unlink(missing_ok=True)
cfg = {
 'title': '贝拉kira', 'subtitle': '画廊闪卡', 'edition': '001',
 'collection': '非官方粉丝收藏', 'description': '画廊原图 gallery-005.png，保留完整构图与签名。',
 'sourceMode': 'reference', 'typography': False, 'frame': False, 'artworkFit': [1, 1],
 'assets': {k: './assets/' + k + '.png' for k in ['subject', 'background', 'text', 'lineart']},
 'parameters': {'foil': .48},
 'safeArea': {'scale': 1, 'offset': [0, 0]},
}
cfg['assets']['model'] = './assets/card.glb'
(ROOT / 'card-config.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
source.thumbnail((512,768)); source.save(ROOT / 'preview.webp', quality=88)
