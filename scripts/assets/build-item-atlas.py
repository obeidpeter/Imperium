"""Builds the inventory's item atlas (release 13) from the rendered picture masters.

The plan (art-source/items/item-pictures.json) lists each picture with its shape in pack cells ("2x3") and the
items it serves; its master is a picture at 128 pixels a cell (render-item-pictures.py), named for the picture
(item-spatha.png). The atlas holds one slot per picture: the master scaled to --cell pixels a cell by area
averaging in premultiplied alpha, so edges do not darken. An item of another shape shows its picture fitted
into its own box without stretching (item-art.js). The slots are packed in shelves into one WebP, and where
each item's picture lies is written as data for item-art.js. Only the atlas ships.

Run it through item-atlas.mjs, which first checks the plan against src/data/items.js:
  node scripts/assets/item-atlas.mjs [--cell 80] [--quality 78]
"""
import argparse
import json
import os
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
parser = argparse.ArgumentParser()
parser.add_argument('--masters', required=True)
parser.add_argument('--plan', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--data', required=True)
parser.add_argument('--src', help='the atlas URL as the page loads it (default: ./ + --output)')
parser.add_argument('--cell', type=int, default=80)
parser.add_argument('--width', type=int, default=1024)
parser.add_argument('--quality', type=int, default=78)
parser.add_argument('--gap', type=int, default=2)
opts = parser.parse_args(argv)

plan = json.load(open(opts.plan, encoding='utf-8'))  # {"pictures": {"parma": {"cells": "2x2", "items": ["parma", …]}}, "drawn": […]}


def load(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)  # bottom row first, as Blender stores it


def weights(src, dst):
    """The share of each source pixel in each target pixel (area averaging; rows sum to 1)."""
    m = np.zeros((dst, src), dtype=np.float32)
    scale = src / dst
    for i in range(dst):
        a, b = i * scale, (i + 1) * scale
        j0, j1 = int(np.floor(a)), min(src, int(np.ceil(b)))
        for j in range(j0, j1):
            m[i, j] = max(0.0, min(b, j + 1) - max(a, j))
        m[i] /= m[i].sum()
    return m


def fitted(px, w, h):
    """The master inside a w x h box: scaled to fit without stretching, centred, on transparency."""
    sh, sw = px.shape[:2]
    s = min(w / sw, h / sh)
    tw, th = max(1, round(sw * s)), max(1, round(sh * s))
    pre = px.copy()
    pre[..., :3] *= pre[..., 3:4]
    wy, wx = weights(sh, th), weights(sw, tw)
    small = np.einsum('ij,jkc->ikc', wy, np.einsum('kl,jlc->jkc', wx, pre))
    a = small[..., 3:4]
    small[..., :3] = np.where(a > 1e-6, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.zeros((h, w, 4), dtype=np.float32)
    y0, x0 = (h - th) // 2, (w - tw) // 2
    out[y0:y0 + th, x0:x0 + tw] = small
    return out


slots = []
for name, spec in sorted(plan['pictures'].items()):
    path = os.path.join(opts.masters, f'item-{name}.png')
    if not os.path.exists(path):
        raise SystemExit(f'{path}: missing master for {name}')
    cw, ch = (int(n) for n in spec['cells'].lower().split('x'))
    w, h = cw * opts.cell, ch * opts.cell
    slots.append({'name': name, 'w': w, 'h': h, 'px': fitted(load(path), w, h), 'items': sorted(spec['items'])})

# Shelf packing: tallest first, left to right, a new shelf when a row is full.
slots.sort(key=lambda p: (-p['h'], -p['w'], p['name']))
x = y = shelf = 0
for p in slots:
    if x + p['w'] > opts.width:
        x, y, shelf = 0, y + shelf + opts.gap, 0
    p['x'], p['y'] = x, y
    x += p['w'] + opts.gap
    shelf = max(shelf, p['h'])
height = y + shelf
atlas = np.zeros((height, opts.width, 4), dtype=np.float32)
for p in slots:
    # Blender rows run bottom to top: each slot's bottom row goes to the atlas's matching row.
    top = height - p['y'] - p['h']
    atlas[top:top + p['h'], p['x']:p['x'] + p['w']] = p['px']

img = bpy.data.images.new('item-atlas', opts.width, height, alpha=True, float_buffer=False)
img.pixels.foreach_set(atlas.ravel())
scene = bpy.context.scene
# Save the pixels as they are: no view transform or look (the masters already carry the rendered look).
scene.display_settings.display_device = 'sRGB'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = opts.quality
os.makedirs(os.path.dirname(opts.output) or '.', exist_ok=True)
img.save_render(opts.output, scene=scene)

places = {}
for p in slots:
    for item in p['items']:
        places[item] = [p['x'], p['y'], p['w'], p['h']]
size = os.path.getsize(opts.output)
src = opts.src or './' + opts.output.replace(os.sep, '/')
drawn = sorted(plan['drawn'])
with open(opts.data, 'w', encoding='utf-8') as f:
    f.write('// Generated by scripts/assets/item-atlas.mjs from art-source/items (release 13). Do not edit by hand.\n')
    f.write('// Where each item\'s picture lies in the atlas, as [x, y, width, height] in pixels, and the items that keep\n')
    f.write('// their drawn silhouette (src/ui/item-art.js).\n')
    f.write(f"export const ITEM_ATLAS=Object.freeze({{src:{json.dumps(src)},width:{opts.width},height:{height},cell:{opts.cell},bytes:{size}}});\n")
    f.write('export const ITEM_PICTURES=Object.freeze({\n')
    f.write(',\n'.join(f"  {json.dumps(k)}:Object.freeze({json.dumps(v)})" for k, v in sorted(places.items())))
    f.write('\n});\n')
    f.write(f"export const ITEM_DRAWN=Object.freeze({json.dumps(drawn)});\n")
print(f'{len(slots)} pictures for {len(places)} items -> {opts.output} ({opts.width}x{height}, {size / 1024:.1f} KB)')
