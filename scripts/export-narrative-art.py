"""Mechanically crop approved narrative atlases and export local WebP files.

No image generation or retouching occurs here. The five original sheets must
come from the documented built-in image_gen workflow and pass visual review.
"""
from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
HEROES = ['recruit', 'miles', 'centurion', 'prefect', 'governor', 'senator', 'emperor']
CAST = ['varro', 'lucan', 'crispus', 'severianus', 'aelia', 'paullus', 'sabinus']

def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--portrait-quality', type=int, default=74)
    parser.add_argument('--scene-quality', type=int, default=76)
    args = parser.parse_args()
    manifest_path = ROOT / 'docs/asset-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    sheets = [
        ('hero-career-atlas.png', 4, 2, [('hero-' + name, 'portraits', 400, args.portrait_quality) for name in HEROES] + [('oath-seal', 'portraits', 256, 80)]),
        ('cast-neutral-atlas.png', 4, 2, [(name, 'portraits', 336, args.portrait_quality) for name in CAST]),
        ('cast-intense-atlas.png', 4, 2, [(name + '-intense', 'portraits', 336, args.portrait_quality - 2) for name in CAST]),
        ('frontier-scenes-atlas.png', 2, 2, [(name, 'scenes', 768, args.scene_quality) for name in ['danube', 'marsh', 'eastern-fort', 'river-crossing']]),
        ('civic-scenes-atlas.png', 2, 2, [(name, 'scenes', 832 if name == 'frontier-oath' else 768, args.scene_quality + 4 if name == 'frontier-oath' else args.scene_quality) for name in ['province', 'rome', 'frontier-oath', 'accession']]),
    ]
    entries = []
    for filename, columns, rows, specs in sheets:
        source_path = args.source_dir / filename
        data = source_path.read_bytes()
        source = ImageOps.exif_transpose(Image.open(source_path)).convert('RGB')
        for index, (key, folder, width, quality) in enumerate(specs):
            col, row = index % columns, index // columns
            box = (round(col * source.width / columns) + 2,
                   round(row * source.height / rows) + 2,
                   round((col + 1) * source.width / columns) - 2,
                   round((row + 1) * source.height / rows) - 2)
            crop = source.crop(box)
            if folder == 'portraits':
                crop = ImageOps.fit(crop, (min(width, crop.width), min(width, crop.height)), method=Image.Resampling.LANCZOS)
            elif crop.width > width:
                crop = crop.resize((width, round(crop.height * width / crop.width)), Image.Resampling.LANCZOS)
            path = ROOT / 'assets' / folder / (key + '.webp')
            crop.save(path, 'WEBP', quality=quality, method=6, exact=True)
            output = path.read_bytes()
            entries.append({
                'id': key, 'path': path.relative_to(ROOT).as_posix(),
                'subject': key.replace('-', ' '),
                'source': {'method': 'OpenAI built-in image_gen', 'sourceFile': filename,
                    'sourceSha256': sha256(data).hexdigest(), 'sourceSize': list(source.size),
                    'atlasColumns': columns, 'atlasRows': rows, 'cell': [col, row],
                    'cropBox': list(box), 'instructions': 'docs/graphics-narrative-art.md'},
                'usage': 'Narrative, character and promotion presentation' if folder == 'portraits' else 'Cinematic chapter, title and accession staging; not a rules map',
                'loading': 'initial' if key in ['hero-recruit', 'varro', 'frontier-oath'] else 'chapter',
                'export': {'format': 'WebP', 'width': crop.width, 'height': crop.height,
                    'quality': quality, 'method': 6, 'bytes': len(output), 'sha256': sha256(output).hexdigest()},
            })
    ids = {entry['id'] for entry in entries}
    manifest['assets'] = [entry for entry in manifest['assets'] if entry['id'] not in ids] + entries
    manifest['artDirection'] = 'Premium painted Roman chronicle: consistent aged identities, warm upper-left light, bronze and ivory, layered atmospheric settings'
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    portrait_bytes = sum(entry['export']['bytes'] for entry in entries if '/portraits/' in entry['path'])
    scene_bytes = sum(entry['export']['bytes'] for entry in entries if '/scenes/' in entry['path'])
    print(json.dumps({'portraits': portrait_bytes, 'scenes': scene_bytes, 'total': portrait_bytes + scene_bytes, 'assets': len(entries)}))
    if portrait_bytes > 400000:
        raise SystemExit('Portraits exceed 400 KB. Lower --portrait-quality and re-export before release.')
    if portrait_bytes + scene_bytes > 1100000:
        raise SystemExit('Narrative library exceeds its 1.1 MB graphics allocation.')

if __name__ == '__main__':
    main()
