"""Normalize the approved ImageGen specialist sheet; no generative editing.

Usage: python scripts/export-specialist-art.py /path/specialists-corrected.png
The source grid was visually reviewed. Row boundaries follow transparent gaps.
"""
from pathlib import Path
from hashlib import sha256
import json
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
source_path = Path(sys.argv[1])
source = Image.open(source_path).convert('RGBA')
if source.size != (1086, 1448):
    raise SystemExit('This exporter requires the reviewed 1086 × 1448 source sheet.')
boundaries = [0, 361, 714, 1078, 1448]
sheet = Image.new('RGBA', (768, 1024))
cells = []
for row in range(4):
    for col in range(4):
        rect = [round(col * source.width / 4), boundaries[row], round((col + 1) * source.width / 4), boundaries[row + 1]]
        cell = source.crop(rect)
        bounds = cell.getchannel('A').point(lambda value: 255 if value > 12 else 0).getbbox()
        if not bounds:
            raise SystemExit('Empty cell in the approved sheet.')
        cell = cell.crop(bounds)
        cell.thumbnail((176, 232), Image.Resampling.LANCZOS)
        xy = [col * 192 + (192 - cell.width) // 2, row * 256 + 240 - cell.height]
        sheet.alpha_composite(cell, tuple(xy))
        cells.append({'cell': [col, row], 'sourceCrop': rect, 'alphaBounds': list(bounds), 'placement': xy, 'size': list(cell.size)})
path = root / 'assets/tactical/units-specialists.webp'
sheet.save(path, 'WEBP', quality=80, method=6, exact=True)
data = path.read_bytes()
if len(data) > 230000:
    raise SystemExit('Specialist sheet exceeds its 230 KB allocation.')
entry = {
    'id': 'units-specialists', 'path': path.relative_to(root).as_posix(),
    'subject': 'Gothic archer, Roman archer, Persian infantry and Palmyrene infantry; four authored facings per row',
    'source': {'method': 'OpenAI built-in image_gen', 'sourceFile': source_path.name,
        'sourceSha256': sha256(source_path.read_bytes()).hexdigest(), 'sourceSize': list(source.size),
        'atlasColumns': 4, 'atlasRows': 4, 'rowBoundaries': boundaries,
        'instructions': 'docs/graphics-narrative-art.md', 'cells': cells},
    'usage': 'Faction-specific tactical characters. Four direction images with runtime procedural poses; not authored walk cycles.',
    'loading': 'chapter',
    'export': {'format': 'WebP', 'width': 768, 'height': 1024, 'cellWidth': 192, 'cellHeight': 256,
        'feetY': 240, 'alpha': True, 'quality': 80, 'method': 6, 'bytes': len(data), 'sha256': sha256(data).hexdigest()},
}
manifest_path = root / 'docs/asset-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['assets'] = [item for item in manifest['assets'] if item['id'] != entry['id']] + [entry]
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'path': entry['path'], 'bytes': len(data), 'size': list(sheet.size), 'alphaRange': list(sheet.getchannel('A').getextrema())}))
