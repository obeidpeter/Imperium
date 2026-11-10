"""Recolour one hue of a processed model's colour map: a variant of a generated model in another colour.

Development tool, for a model processed by process-model.py or process-kit.py (WebP maps, before
compress.mjs): a banner's cloth in another army's colour, say, with its geometry, its other maps and
every other colour of its map unchanged. It needs Pillow and NumPy, not Blender.

  python3 scripts/assets/recolour-model.py --input model.glb --output variant.glb --hue 0 --to '#4b5e7a' [options]

The colour map's pixels near --hue (within --width degrees, fading out over --soft more) and at least as
saturated as --min-saturation (fading in below it) take the hue of --to; their saturation and value are
scaled so that the recoloured region's mean is --to's, which keeps its folds and shading. Pixels between
take a blend, so the edges of the region have no seam. The GLB is written again with the new map in the
old one's place, and a JSON report records digests, settings and the region's colour before and after.
"""
import argparse
import colorsys
import hashlib
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image


def parse_args():
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--input', required=True, help='processed .glb (WebP or PNG maps)')
    p.add_argument('--output', required=True, help='recoloured .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--hue', type=float, required=True, help='the hue to recolour, in degrees (red is 0)')
    p.add_argument('--width', type=float, default=18.0, help='degrees either side of --hue recoloured in full')
    p.add_argument('--soft', type=float, default=10.0, help='degrees beyond --width over which the recolouring fades out')
    p.add_argument('--min-saturation', type=float, default=0.45, help='least saturation recoloured in full, 0-1')
    p.add_argument('--to', required=True, help='the colour the region takes, as #rrggbb')
    p.add_argument('--quality', type=int, default=80, help='WebP quality of the new map, 1-100')
    a = p.parse_args()
    if not (0 <= a.min_saturation <= 1 and a.width > 0 and a.soft >= 0 and 1 <= a.quality <= 100):
        p.error('settings out of range')
    if len(a.to) != 7 or not a.to.startswith('#'):
        p.error('--to takes #rrggbb')
    return a


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack('<4sII', data[:12])
    if magic != b'glTF' or version != 2 or length != len(data):
        sys.exit(f'{path} is not a GLB 2.0 file')
    chunks, at = [], 12
    while at < len(data):
        size, kind = struct.unpack('<I4s', data[at:at + 8])
        chunks.append((kind, data[at + 8:at + 8 + size]))
        at += 8 + size
    gltf = json.loads(chunks[0][1])
    binary = next((c for k, c in chunks if k == b'BIN\x00'), b'')
    return gltf, binary


def write_glb(path, gltf, views):
    """The buffer laid out again, view by view, each on a four-byte boundary."""
    binary = bytearray()
    for view, payload in zip(gltf['bufferViews'], views):
        binary += b'\0' * (-len(binary) % 4)
        view['byteOffset'] = len(binary)
        view['byteLength'] = len(payload)
        binary += payload
    binary += b'\0' * (-len(binary) % 4)
    gltf['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(gltf, separators=(',', ':')).encode('utf8')
    text += b' ' * (-len(text) % 4)
    out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(text) + 8 + len(binary))
    out += struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(binary), b'BIN\x00') + bytes(binary)
    with open(path, 'wb') as f:
        f.write(out)


def to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(axis=-1), rgb.min(axis=-1)
    delta = mx - mn
    h = np.zeros_like(mx)
    safe = np.where(delta > 0, delta, 1)
    h = np.where(mx == r, ((g - b) / safe) % 6, h)
    h = np.where(mx == g, (b - r) / safe + 2, h)
    h = np.where(mx == b, (r - g) / safe + 4, h)
    h = np.where(delta > 0, h * 60.0, 0.0)
    s = np.where(mx > 0, delta / np.where(mx > 0, mx, 1), 0.0)
    return h, s, mx


def from_hsv(h, s, v):
    c = v * s
    hp = (h % 360.0) / 60.0
    x = c * (1 - np.abs(hp % 2 - 1))
    zero = np.zeros_like(h)
    sector = np.floor(hp).astype(int) % 6
    r = np.select([sector == 0, sector == 1, sector == 2, sector == 3, sector == 4, sector == 5], [c, x, zero, zero, x, c])
    g = np.select([sector == 0, sector == 1, sector == 2, sector == 3, sector == 4, sector == 5], [x, c, c, x, zero, zero])
    b = np.select([sector == 0, sector == 1, sector == 2, sector == 3, sector == 4, sector == 5], [zero, zero, x, c, c, x])
    m = v - c
    return np.stack([r + m, g + m, b + m], axis=-1)


def region(rgb, a):
    """Each pixel's weight in the recoloured region, 0 to 1."""
    h, s, v = to_hsv(rgb)
    distance = np.abs((h - a.hue + 180.0) % 360.0 - 180.0)
    by_hue = np.clip(1 - (distance - a.width) / max(a.soft, 1e-6), 0, 1) if a.soft > 0 else (distance <= a.width).astype(float)
    by_saturation = np.clip((s - a.min_saturation * 0.6) / max(a.min_saturation * 0.4, 1e-6), 0, 1)
    return by_hue * by_saturation, (h, s, v)


def main():
    a = parse_args()
    source, output = os.path.abspath(a.input), os.path.abspath(a.output)
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    gltf, binary = read_glb(source)
    views = [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in gltf['bufferViews']]
    colour_images = set()
    for material in gltf.get('materials', []):
        texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture is not None:
            # A WebP map is named through EXT_texture_webp (Blender's export), a PNG or JPEG one directly.
            entry = gltf['textures'][texture['index']]
            image = entry.get('extensions', {}).get('EXT_texture_webp', {}).get('source', entry.get('source'))
            if image is None:
                sys.exit('The colour map is in a form this tool does not read.')
            colour_images.add(image)
    if not colour_images:
        sys.exit('The model has no colour map to recolour.')
    target = np.array([int(a.to[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    th, ts, tv = colorsys.rgb_to_hsv(*target)
    maps = []
    for index in sorted(colour_images):
        image = gltf['images'][index]
        if 'bufferView' not in image:
            sys.exit('The colour map is not embedded in the GLB.')
        picture = Image.open(io.BytesIO(views[image['bufferView']]))
        alpha = picture.getchannel('A') if picture.mode in ('RGBA', 'LA') else None
        rgb = np.asarray(picture.convert('RGB'), dtype=np.float64) / 255
        weight, (h, s, v) = region(rgb, a)
        inside = weight > 0.5
        if not inside.any():
            sys.exit(f'No pixel of the colour map is near hue {a.hue:g} and saturated enough.')
        mean_s, mean_v = float(s[inside].mean()), float(v[inside].mean())
        recoloured = from_hsv(np.full_like(h, th * 360.0), np.clip(s * (ts / max(mean_s, 1e-6)), 0, 1), np.clip(v * (tv / max(mean_v, 1e-6)), 0, 1))
        result = rgb * (1 - weight[..., None]) + recoloured * weight[..., None]
        before = rgb[inside].mean(axis=0)
        after = result[inside].mean(axis=0)
        picture = Image.fromarray(np.round(result * 255).astype(np.uint8), 'RGB')
        if alpha is not None:
            picture.putalpha(alpha)
        mime = image.get('mimeType', 'image/png')
        buffer = io.BytesIO()
        if mime == 'image/webp':
            picture.save(buffer, 'WEBP', quality=a.quality, method=6)
        else:
            picture.save(buffer, 'PNG', optimize=True)
        views[image['bufferView']] = buffer.getvalue()
        maps.append({'image': index, 'width': picture.width, 'height': picture.height, 'mimeType': mime,
                     'regionShare': round(float(inside.mean()), 4),
                     'regionMeanBefore': '#' + ''.join(f'{round(c * 255):02x}' for c in before),
                     'regionMeanAfter': '#' + ''.join(f'{round(c * 255):02x}' for c in after)})
    os.makedirs(os.path.dirname(output), exist_ok=True)
    write_glb(output, gltf, views)
    digest = lambda path: hashlib.sha256(open(path, 'rb').read()).hexdigest()
    shown = lambda path: os.path.relpath(path).replace(os.sep, '/') if not os.path.relpath(path).startswith('..') else path
    report = {'tool': 'scripts/assets/recolour-model.py',
              'input': {'path': shown(source), 'bytes': os.path.getsize(source), 'sha256': digest(source)},
              'output': {'path': shown(output), 'bytes': os.path.getsize(output), 'sha256': digest(output)},
              'settings': {'hue': a.hue, 'width': a.width, 'soft': a.soft, 'minSaturation': a.min_saturation, 'to': a.to, 'webpQuality': a.quality},
              'maps': maps}
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'maps')}))


if __name__ == '__main__':
    main()
