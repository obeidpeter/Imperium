"""Export approved built-in AI artwork into small, local WebP game assets.

Pillow is a development tool only. The browser has no image-generation dependency.
Examples:
  python scripts/optimize-assets.py portraits --input /path/cast-atlas.png
  python scripts/optimize-assets.py title --input /path/title.png
  python scripts/optimize-assets.py scenes --input /path/scenes-atlas.png
"""
from argparse import ArgumentParser
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = [
    ('hero-recruit', 'Protagonist, recruit, age 20'),
    ('hero-miles', 'Protagonist, miles, age 25'),
    ('hero-centurion', 'Protagonist, centurion, age 30'),
    ('hero-prefect', 'Protagonist, prefect, age 36'),
    ('hero-governor', 'Protagonist, governor, age 43'),
    ('hero-senator', 'Protagonist, senator, age 45'),
    ('hero-emperor', 'Protagonist, emperor, age 45'),
    ('varro', 'Varro, mentor and veteran, age 55'),
    ('lucan', 'Lucan, comrade, age 30'),
    ('crispus', 'Crispus, rival, age 35'),
    ('severianus', 'Severianus, patron, age 55'),
    ('aelia', 'Aelia, provincial ally, age 35'),
]
SCENES = [(name, label) for name, label in [
    ('danube', 'Danube frontier'), ('marsh', 'Marshland retreat'),
    ('eastern-fort', 'Eastern fortress'), ('river-crossing', 'River crossing'),
    ('province', 'Provincial centre'), ('rome', 'Rome and political chamber'),
]]

def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=['portraits', 'portraits-extra', 'title', 'scenes'])
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--quality', type=int, default=86)
    parser.add_argument('--width', type=int, help='Maximum output width; default 360/1600/720 by kind.')
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error('quality must be 1–100')
    if args.width is not None and args.width < 64:
        parser.error('width must be at least 64')
    source_bytes = args.input.read_bytes()
    source = ImageOps.exif_transpose(Image.open(args.input)).convert('RGB')
    image_width, image_height = source.size
    if args.kind == 'portraits':
        columns, rows, items, width, budget = 4, 3, PORTRAITS, args.width or 360, 400000
    elif args.kind == 'portraits-extra':
        columns, rows, items, width, budget = 2, 1, [('paullus', 'Lucius Cassius Paullus, elder senator, age 70'), ('sabinus', 'Sabinus, replacement officer, age 40')], args.width or 360, 400000
    elif args.kind == 'scenes':
        columns, rows, items, width, budget = 2, 3, SCENES, args.width or 720, 600000
    else:
        columns, rows, items, width, budget = 1, 1, [('frontier-oath', 'Title composition')], args.width or 1600, 350000
    manifest_path = ROOT / 'docs/asset-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {
        'schemaVersion': 1,
        'project': 'IMPERIUM',
        'artDirection': 'Cinematic painted chronicle, restored fresco pigment, quiet olive plaster, warm left light',
        'rightsNotice': 'AI-generated for this project through the built-in image_gen tool. No third-party source imagery supplied. No exclusive copyright or third-party license ownership is asserted. Historical references inform design only; their images are not copied.',
        'runtimePolicy': 'Local files only; no runtime generation, external image fetching, new subscription or paid CLI.',
        'assets': []
    }
    folder = ROOT / 'assets' / ('scenes' if args.kind == 'title' else 'portraits' if args.kind.startswith('portraits') else args.kind)
    folder.mkdir(parents=True, exist_ok=True)
    output_entries = []
    for i, (key, subject) in enumerate(items):
        col, row = i % columns, i // columns
        # One-pixel inset avoids adjacent atlas-cell paint at a shared boundary.
        inset = 1 if len(items) > 1 else 0
        box = (round(col * image_width / columns) + inset,
               round(row * image_height / rows) + inset,
               round((col + 1) * image_width / columns) - inset,
               round((row + 1) * image_height / rows) - inset)
        tile = source.crop(box)
        if tile.width > width:
            tile = tile.resize((width, round(tile.height * width / tile.width)), Image.Resampling.LANCZOS)
        target = folder / f'{key}.webp'
        tile.save(target, 'WEBP', quality=args.quality, method=6, exact=True)
        output = target.read_bytes()
        output_entries.append({
            'id': key, 'path': target.relative_to(ROOT).as_posix(), 'subject': subject,
            'source': {'method': 'OpenAI built-in image_gen', 'sourceFile': args.input.name,
                       'sourceSha256': sha256(source_bytes).hexdigest(), 'sourceSize': [image_width, image_height],
                       'atlasColumns': columns, 'atlasRows': rows, 'cell': [col, row], 'cropBox': list(box),
                       'instructions': 'docs/art-generation.md'},
            'usage': 'Title and New Game' if args.kind == 'title' else 'Dialogue, character, promotions and finale' if args.kind.startswith('portraits') else 'Chapter introductions and camp murals',
            'loading': 'initial' if key in ['hero-recruit', 'varro', 'frontier-oath'] else 'deferred',
            'export': {'format': 'WebP', 'width': tile.width, 'height': tile.height, 'quality': args.quality,
                       'method': 6, 'bytes': len(output), 'sha256': sha256(output).hexdigest()}
        })
    total = sum(entry['export']['bytes'] for entry in output_entries)
    budget_total = sum(p.stat().st_size for p in folder.glob('*.webp')) if args.kind.startswith('portraits') else total
    if budget_total > budget:
        raise SystemExit(f'{args.kind}: {budget_total:,} bytes exceed {budget:,}; reduce width/quality and export again before integrating.')
    ids = {entry['id'] for entry in output_entries}
    manifest['assets'] = [entry for entry in manifest['assets'] if entry['id'] not in ids] + output_entries
    manifest['totalArtworkBytes'] = sum(entry['export']['bytes'] for entry in manifest['assets'])
    manifest['budgets'] = {'portraitsBytes': 400000, 'titleBytes': 350000, 'sixScenesBytes': 600000, 'compressedInitialAndCompleteBuildBytes': 2000000}
    manifest['updatedAt'] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'kind': args.kind, 'assets': len(output_entries), 'bytes': total, 'budgetBytesUsed': budget_total, 'budget': budget, 'sourceSize': source.size}))

if __name__ == '__main__':
    main()
