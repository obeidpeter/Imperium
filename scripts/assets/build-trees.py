"""Author the regional tree kits in Blender (worlds and gameplay plan, release 5).

  "$BLENDER_PYTHON" scripts/assets/build-trees.py -- --repo . [--only temperate]
  blender --background --python-exit-code 1 --python scripts/assets/build-trees.py -- --repo .

One GLB per biome group, holding the species its chapters plant (world-weather.js):
  temperate  oak, beech, willow, alder, pine, fir      Chapters I-IV, VIII, X
  italy      poplar, cypress, umbrella, olive          Chapters VII, XI, XII
  arid       palm, tamarisk                            Chapters V, VI, IX
Every species comes three times, as named roots at the tree's foot:
  <species>       near: the trunk, boughs and twigs as tapered tubes, and the leaf cards
  <species>_mid   middle distance: the trunk and boughs, fewer and larger cards
  <species>_far   an impostor: two crossed cards showing the near tree from the side
Each root holds one mesh, `<root>_tree`, in the kit's one material: a 1024-pixel atlas
of 256-pixel cells holding the bark (one CC0 Poly Haven set per species, its colour
darkened by its own ambient occlusion, art-source/cc0/), the original procedural leaf
cards and the impostors rendered from them. One material lets the runtime draw a tree
in the environment's cut-out foliage program, wind included, so the bark sways with
its leaves and no shader program is added. Every tree is normalised to 0.5 units tall:
the runtime scales it to its placement's height, and the foliage wind, which sways a
vertex by its local height, then bends the whole tree from its foot. Writes
art-source/models/trees-<kit>.blend, the processed GLB and its report, and
src/showcase/tree-kit-components.js (each species' bounds and crown).
"""
import argparse
import atexit
import hashlib
import json
import math
import os
import random
import shutil
import sys
import tempfile

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Quaternion, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
parser.add_argument('--only', default='')
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
SOURCE = os.path.join(REPO, 'art-source', 'models')
PROCESSED = os.path.join(SOURCE, 'processed')
CC0 = os.path.join(REPO, 'art-source', 'cc0')
os.makedirs(PROCESSED, exist_ok=True)
# Scaled textures, the card atlas and the impostor renders: inputs to the export, not kept.
TMP = tempfile.mkdtemp(prefix='imperium-trees-')
atexit.register(shutil.rmtree, TMP, True)

KITS = {
    'temperate': {'chapters': [1, 2, 3, 4, 8, 10], 'species': ['oak', 'beech', 'willow', 'alder', 'pine', 'fir']},
    'italy': {'chapters': [7, 11, 12], 'species': ['poplar', 'cypress', 'umbrella', 'olive']},
    'arid': {'chapters': [5, 6, 9], 'species': ['palm', 'tamarisk']},
}
# The bark each species wears (Poly Haven ids) and the leaf card it carries.
BARK = {'oak': 'bark_brown_02', 'beech': 'bark_brown_01', 'alder': 'bark_brown_01', 'willow': 'bark_willow',
        'pine': 'pine_bark', 'fir': 'pine_bark', 'poplar': 'bark_willow', 'cypress': 'chinese_cedar_bark',
        'umbrella': 'pine_bark', 'olive': 'bark_brown_01', 'palm': 'palm_bark', 'tamarisk': 'bark_brown_01'}
LEAF = {'oak': 'lobed', 'beech': 'oval', 'alder': 'round', 'willow': 'narrow', 'pine': 'needles', 'fir': 'comb',
        'poplar': 'poplar', 'cypress': 'scale', 'umbrella': 'needles', 'olive': 'olive', 'palm': 'frond', 'tamarisk': 'feather'}
# Built at this height (metres) so bark and cards have real proportions, then
# normalised; canopy radii stay inside environment-composition.js's canopyRadius.
BUILD_HEIGHT = {'oak': 6.5, 'beech': 7.5, 'alder': 6.5, 'willow': 6, 'pine': 8, 'fir': 8.5, 'poplar': 8.5,
                'cypress': 7, 'umbrella': 7, 'olive': 4.5, 'palm': 6.5, 'tamarisk': 4.2}
NORMAL_HEIGHT = .5
IMPOSTOR_GAIN = 1.35
# The palm's photographed bark is far darker than the others' and read black on the trunk.
BARK_GAIN = {'palm_bark': 1.4}
ATLAS, CELL = 1024, 256
PER = ATLAS // CELL
TAU = math.tau


# --- The atlas ------------------------------------------------------------------------------------
# Sixteen cells of 256 px: the kit's bark sets first, so their mip levels blend bark into bark, then
# its leaf kinds, then one impostor per species. Image rows run top-down here; Blender's pixels are
# bottom-up, so the atlas is flipped once when it becomes an image.
class Painter:
    def __init__(self, size):
        self.rgba = np.zeros((size, size, 4), np.float32)
        self.size = size

    def oval(self, cx, cy, rx, ry, angle, colour, clip):
        x0, y0, x1, y1 = clip
        reach = max(rx, ry) + 1
        xs = np.arange(max(x0, int(cx - reach)), min(x1, int(cx + reach) + 1))
        ys = np.arange(max(y0, int(cy - reach)), min(y1, int(cy + reach) + 1))
        if not len(xs) or not len(ys): return
        X, Y = np.meshgrid(xs, ys)
        ca, sa = math.cos(angle), math.sin(angle)
        u = ((X - cx) * ca + (Y - cy) * sa) / max(rx, .3)
        v = (-(X - cx) * sa + (Y - cy) * ca) / max(ry, .3)
        d = u * u + v * v
        alpha = np.clip((1 - d) * max(rx, ry) * .9, 0, 1)
        vein = 1 - np.clip(np.abs(u) * 7, 0, 1)
        shade = .86 + (1 - v) * .08 + vein * .07
        region = self.rgba[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
        take = alpha > region[:, :, 3]
        for c in range(3): region[:, :, c] = np.where(take, colour[c] * shade, region[:, :, c])
        region[:, :, 3] = np.where(take, alpha, region[:, :, 3])

    def line(self, ax, ay, bx, by, r, colour, clip):
        n = max(1, int(math.hypot(bx - ax, by - ay) / max(.6, r * .7)))
        for i in range(n + 1):
            t = i / n
            self.oval(ax + (bx - ax) * t, ay + (by - ay) * t, r, r, 0, colour, clip)


# --- Leaf cards from CC0 sprites ------------------------------------------------------------------
# Each leaf card is composed in its cell: painted twigs fanning from the card's foot, and along them
# leaves, needle twigs or fronds cut from CC0 Poly Haven plant textures (art-source/cc0/, the maps a
# model's own textures name). A source's sprites are its connected shapes (alpha above .5 at 256 px),
# kept by area (in those pixels), by length over width and, where asked, by being greener than red.
# Oak and the date palm use cells of the game's own foliage atlas (assets/showcase/foliage-v016.webp,
# generated art recorded in docs/asset-manifest.json), as the code-built trees do: no CC0 source
# reachable from the build offers lobed oak leaves or a palm frond.
SPRITES = {
    'fir_tree_01': {'diff': 'twig_diff', 'alpha': 'twig_alpha', 'area': (100, 2000), 'aspect': 4, 'green': True},
    'pine_tree_01': {'diff': 'twig_diff', 'alpha': 'twig_alpha', 'area': (800, 1500), 'aspect': 4, 'green': False},
    'island_tree_01': {'diff': 'leaves_diff', 'alpha': 'leaves_alpha', 'area': (1000, 3000), 'aspect': 4, 'green': False},
    'tree_small_02': {'diff': 'leaves_diff', 'alpha': 'leaves_alpha', 'area': (300, 4000), 'aspect': 5, 'green': True},
    'shrub_02': {'diff': 'Diffuse', 'alpha': 'Alpha', 'area': (600, 3000), 'aspect': 8, 'green': True},
    'jacaranda_tree': {'diff': 'leaves_diff', 'alpha': 'leaves_alpha', 'area': (300, 6000), 'aspect': 5, 'green': True},
}
GAME_ATLAS = os.path.join(REPO, 'assets', 'showcase', 'foliage-v016.webp')
# The game atlas's 384-pixel cells used whole: (column, row), and the spray's foot and tip in the cell.
GAME_CELLS = {'oak': ((0, 0), (192, 378), (192, 6)), 'palm': ((0, 1), (22, 362), (362, 22))}
# Each leaf kind's card: its sprites, its twigs (count, fan in radians, length as a share of the cell),
# sprites along each twig (count, angle off the twig, length as a share of the cell), one at the tip,
# and the colour's tint and desaturation. `game` copies a game atlas cell instead.
CARDS = {
    'lobed': {'game': 'oak'},
    'frond': {'game': 'palm'},
    'oval': {'source': 'island_tree_01', 'twigs': (6, 1.05, .8), 'along': (12, .9, (.13, .17)), 'tip': .17, 'tint': (1.0, 1.04, 1.0), 'desat': .0},
    'round': {'source': 'tree_small_02', 'twigs': (4, 1.0, .72), 'along': (4, .65, (.32, .42)), 'tip': .4, 'tint': (.98, 1.0, .96), 'desat': .0},
    'poplar': {'source': 'island_tree_01', 'twigs': (7, .9, .82), 'along': (13, .9, (.10, .13)), 'tip': .13, 'tint': (1.02, 1.08, .95), 'desat': .0},
    'olive': {'source': 'shrub_02', 'twigs': (7, 1.05, .82), 'along': (16, .55, (.17, .22)), 'tip': .2, 'tint': (.96, 1.0, 1.04), 'desat': .3},
    'narrow': {'source': 'shrub_02', 'twigs': (6, .4, .94), 'along': (16, .32, (.2, .26)), 'tip': .24, 'tint': (1.0, 1.06, .92), 'desat': .0},
    'needles': {'source': 'pine_tree_01', 'twigs': (5, .95, .55), 'along': (2, .55, (.3, .36)), 'tip': .5, 'tint': (1.0, 1.06, 1.0), 'desat': .0},
    'comb': {'source': 'fir_tree_01', 'twigs': (4, .95, .62), 'along': (3, .7, (.33, .4)), 'tip': .48, 'tint': (.95, 1.0, .98), 'desat': .0},
    'scale': {'source': 'fir_tree_01', 'twigs': (7, .5, .7), 'along': (4, .5, (.22, .27)), 'tip': .3, 'tint': (.78, .86, .82), 'desat': .1},
    'feather': {'source': 'jacaranda_tree', 'twigs': (7, 1.0, .72), 'along': (4, .6, (.26, .32)), 'tip': .34, 'tint': (1.0, 1.0, 1.0), 'desat': .35},
}
TWIG = (.30, .25, .16)


def components(mask):
    """The 4-connected shapes of a boolean mask, as (rows, columns) index arrays."""
    h, w = mask.shape
    label = np.zeros((h, w), np.int32)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if label[y0, x0]: continue
        n = len(out) + 1
        stack, ys, xs = [(y0, x0)], [], []
        label[y0, x0] = n
        while stack:
            y, x = stack.pop(); ys.append(y); xs.append(x)
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not label[yy, xx]:
                    label[yy, xx] = n; stack.append((yy, xx))
        out.append((np.array(ys), np.array(xs)))
    return out, label


def sprite(rgba, foot=None, tip=None):
    """A sprite: its straight-alpha pixels, its foot and the angle and length from foot to tip.
    Without a given foot, its long axis is its shape's principal axis and its foot the narrower end
    (a leaf's stalk, a twig's cut end)."""
    if foot is None:
        ys, xs = np.nonzero(rgba[..., 3] > .5)
        pts = np.stack([xs, ys], 1).astype(np.float32)
        centre = pts.mean(0)
        axis = np.linalg.eigh(np.cov((pts - centre).T))[1][:, -1]
        t = (pts - centre) @ axis
        lo, hi = t.min(), t.max()
        span = hi - lo
        width = lambda sel: np.abs((pts[sel] - centre) @ np.array([-axis[1], axis[0]])).mean() if sel.any() else 0
        if width(t > hi - span * .15) < width(t < lo + span * .15): axis, lo, hi = -axis, -hi, -lo
        foot, tip = centre + axis * lo, centre + axis * hi
    foot, tip = np.asarray(foot, np.float32), np.asarray(tip, np.float32)
    d = tip - foot
    return {'rgba': rgba, 'foot': foot, 'angle': math.atan2(d[1], d[0]), 'length': float(np.hypot(*d))}


def load_sprites(record):
    """A CC0 record's sprites, cut from its 1024-pixel colour and alpha maps."""
    spec = SPRITES[record]
    files = {f['map']: os.path.join(REPO, f['path']) for f in json.load(open(os.path.join(CC0, f'polyhaven-{record}.json')))['files']}
    rgb, alpha = read_map(files[spec['diff']], True), read_map(files[spec['alpha']], False)[..., 0]
    comps, label = components(alpha.reshape(256, 4, 256, 4).mean(axis=(1, 3)) > .5)
    out = []
    for n, (ys, xs) in enumerate(comps, 1):
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if not spec['area'][0] <= len(ys) <= spec['area'][1] or max(h, w) > spec['aspect'] * min(h, w): continue
        y0, y1, x0, x1 = max(0, ys.min() * 4 - 8), min(1024, ys.max() * 4 + 12), max(0, xs.min() * 4 - 8), min(1024, xs.max() * 4 + 12)
        # Only this shape's pixels: its label grown by one coarse pixel, at full resolution.
        own = np.kron(label == n, np.ones((4, 4), bool))
        grown = own | np.roll(own, 4, 0) | np.roll(own, -4, 0) | np.roll(own, 4, 1) | np.roll(own, -4, 1)
        a = np.where(grown, alpha, 0)[y0:y1, x0:x1]
        px = rgb[y0:y1, x0:x1]
        if spec['green'] and not px[a > .5, 1].mean() > px[a > .5, 0].mean() * 1.04: continue
        out.append(sprite(np.concatenate([px, a[..., None]], 2)))
    assert out, f'no sprites kept from {record}'
    return out


def game_sprites():
    """The game atlas's oak and palm cells, each as one sprite."""
    img = bpy.data.images.load(GAME_ATLAS)
    w, h = img.size
    px = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    cell = w // 2
    out = {}
    for key, ((col, row), foot, tip) in GAME_CELLS.items():
        rgba = px[row * cell:(row + 1) * cell, col * cell:(col + 1) * cell].copy()
        scale = cell / 384
        out[key] = sprite(rgba, np.array(foot) * scale, np.array(tip) * scale)
    return out


def paste(painter, spr, foot, angle, length, clip, tint=(1, 1, 1), desat=0.):
    """Draw a sprite over the atlas, its foot at `foot`, pointing at `angle` (image radians), `length`
    pixels from foot to tip; sampled with premultiplied alpha after a box reduction toward its size."""
    k = length / max(spr['length'], 1)
    src, f0 = spr['rgba'], spr['foot']
    step = max(1, int(1 / k))
    if step > 1:
        hh, ww = src.shape[0] // step * step, src.shape[1] // step * step
        pre = np.concatenate([src[:hh, :ww, :3] * src[:hh, :ww, 3:], src[:hh, :ww, 3:]], 2)
        pre = pre.reshape(hh // step, step, ww // step, step, 4).mean(axis=(1, 3))
        src = np.concatenate([pre[..., :3] / np.maximum(pre[..., 3:], 1e-4), pre[..., 3:]], 2)
        f0, k = f0 / step, k * step
    turn = angle - spr['angle']
    c, s_ = math.cos(turn), math.sin(turn)
    h, w = src.shape[:2]
    corners = np.array([[0, 0], [w, 0], [0, h], [w, h]], np.float32) - f0
    placed = np.stack([corners[:, 0] * c - corners[:, 1] * s_, corners[:, 0] * s_ + corners[:, 1] * c], 1) * k + np.asarray(foot)
    x0, y0 = max(clip[0], int(placed[:, 0].min())), max(clip[1], int(placed[:, 1].min()))
    x1, y1 = min(clip[2], int(placed[:, 0].max()) + 1), min(clip[3], int(placed[:, 1].max()) + 1)
    if x1 <= x0 or y1 <= y0: return
    X, Y = np.meshgrid(np.arange(x0, x1) + .5 - foot[0], np.arange(y0, y1) + .5 - foot[1])
    u = (X * c + Y * s_) / k + f0[0] - .5
    v = (-X * s_ + Y * c) / k + f0[1] - .5
    inside = (u >= 0) & (v >= 0) & (u <= w - 1) & (v <= h - 1)
    ui, vi = np.clip(u.astype(int), 0, w - 2), np.clip(v.astype(int), 0, h - 2)
    fu, fv = np.clip(u - ui, 0, 1)[..., None], np.clip(v - vi, 0, 1)[..., None]
    pre = np.concatenate([src[..., :3] * src[..., 3:], src[..., 3:]], 2)
    sample = (pre[vi, ui] * (1 - fu) * (1 - fv) + pre[vi, ui + 1] * fu * (1 - fv) + pre[vi + 1, ui] * (1 - fu) * fv + pre[vi + 1, ui + 1] * fu * fv)
    sample *= inside[..., None]
    a = sample[..., 3:]
    rgb = sample[..., :3] / np.maximum(a, 1e-4)
    if desat: rgb = rgb + (rgb.mean(axis=2, keepdims=True) - rgb) * desat
    rgb = np.clip(rgb * np.array(tint, np.float32), 0, 1)
    region = painter.rgba[y0:y1, x0:x1]
    out_a = a + region[..., 3:] * (1 - a)
    region[..., :3] = (rgb * a + region[..., :3] * region[..., 3:] * (1 - a)) / np.maximum(out_a, 1e-4)
    region[..., 3:] = out_a


def paint_leaf_cell(painter, kind, ox, oy, seed, sprites):
    """One leaf card in the cell whose top-left pixel is (ox, oy): its twigs fan up from the foot
    (bottom centre), carrying sprites along them and at their tips."""
    rgen = random.Random(seed)
    card = CARDS[kind]
    s = CELL
    m = int(s * .035)
    clip = (ox + m, oy + m, ox + s - m, oy + s - m)
    foot = (ox + s * .5, oy + s * .965)
    if 'game' in card:
        spr = sprites['game'][card['game']]
        paste(painter, spr, foot, -math.pi / 2, s * .92, clip)
        fade_cell_edge(painter, ox, oy)
        return
    pool = sprites[card['source']]
    count, fan, reach = card['twigs']
    along, off, size = card['along']
    pick = lambda: pool[rgen.randrange(len(pool))]
    twigs = []
    for b in range(count):
        a = -math.pi / 2 + (-fan + 2 * fan * b / max(1, count - 1)) * (1 if count > 1 else 0) + rgen.uniform(-.12, .12)
        L = s * reach * rgen.uniform(.85, 1.05)
        end = (foot[0] + math.cos(a) * L, foot[1] + math.sin(a) * L)
        painter.line(foot[0], foot[1], end[0], end[1], s * .006, TWIG, clip)
        twigs.append((a, L, end))
    # Far sprites first, so the twig's own leaves lie over its neighbours' at the foot.
    for a, L, end in twigs:
        for j in range(along):
            t = .28 + .68 * (j + .5) / along + rgen.uniform(-.03, .03)
            at = (foot[0] + math.cos(a) * L * t, foot[1] + math.sin(a) * L * t)
            side = 1 if j % 2 else -1
            paste(painter, pick(), at, a + side * off * rgen.uniform(.8, 1.15), s * rgen.uniform(*size), clip, card['tint'], card['desat'])
        paste(painter, pick(), end, a + rgen.uniform(-.15, .15), s * card['tip'] * rgen.uniform(.9, 1.1), clip, card['tint'], card['desat'])
    fade_cell_edge(painter, ox, oy)


def fade_cell_edge(painter, ox, oy, band=10):
    """Sprites cut by the cell's clip fade out toward it, so a card shows no straight edge."""
    m = int(CELL * .035)
    d = np.minimum(np.arange(CELL) - m, CELL - 1 - m - np.arange(CELL)).astype(np.float32)
    ramp = np.clip(d / band, 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    painter.rgba[oy:oy + CELL, ox:ox + CELL, 3] *= np.minimum.outer(ramp, ramp)


_SPRITES = {}


def kit_sprites(kinds):
    """The sprites the kit's leaf kinds need, each source cut once per run."""
    for kind in kinds:
        key = CARDS[kind].get('source', 'game')
        if key not in _SPRITES: _SPRITES[key] = load_sprites(key) if key != 'game' else game_sprites()
    return _SPRITES


def atlas_cells(kit_species):
    """Each cell's (kind, key) -> index: bark sets, leaf kinds, then impostors in species order."""
    order = [('bark', b) for b in sorted({BARK[s] for s in kit_species})] + \
            [('leaf', k) for k in sorted({LEAF[s] for s in kit_species})] + [('impostor', s) for s in kit_species]
    assert len(order) <= PER * PER, order
    return {key: i for i, key in enumerate(order)}


def cell_origin(index):
    """The cell's top-left pixel (x, y), rows top-down."""
    return (index % PER) * CELL, (index // PER) * CELL


def cell_uv(index, pad=2):
    """UV rectangle (u0, v0, u1, v1) of a cell, glTF/Blender v up from the image's bottom."""
    ox, oy = cell_origin(index)
    u0, u1 = ox / ATLAS, (ox + CELL) / ATLAS
    v1 = 1 - oy / ATLAS
    v0 = v1 - CELL / ATLAS
    p = pad / ATLAS
    return (u0 + p, v0 + p, u1 - p, v1 - p)


def read_map(path, colour):
    """A CC0 map at 1024 px as floats, rows top-down: colour in sRGB, data as stored."""
    img = bpy.data.images.load(path)
    # A data map keeps its stored values; a 16-bit colour map arrives in linear light.
    if not colour: img.colorspace_settings.name = 'Non-Color'
    if tuple(img.size) != (1024, 1024): img.scale(1024, 1024)
    px = np.array(img.pixels[:], np.float32).reshape(1024, 1024, img.channels)[::-1, :, :3]
    if img.is_float and colour:
        px = np.where(px <= .0031308, px * 12.92, 1.055 * np.power(np.clip(px, 0, None), 1 / 2.4) - .055)
    bpy.data.images.remove(img)
    return np.clip(px, 0, 1)


def paint_bark_cell(painter, set_id, ox, oy):
    """A CC0 bark set in one cell: its colour, darkened in its crevices by its own ambient
    occlusion (the ARM map's red channel), averaged down to 256 px. The set tiles, so a
    trunk wrapped once round by the cell shows no seam."""
    files = {f['map']: os.path.join(REPO, f['path']) for f in json.load(open(os.path.join(CC0, f'polyhaven-{set_id}.json')))['files']}
    rgb = np.clip(read_map(files['Diffuse'], True) * (.62 + .38 * read_map(files['arm'], False)[..., :1]) * BARK_GAIN.get(set_id, 1), 0, 1)
    k = 1024 // CELL
    small = rgb.reshape(CELL, k, CELL, k, 3).mean(axis=(1, 3))
    painter.rgba[oy:oy + CELL, ox:ox + CELL, :3] = small
    painter.rgba[oy:oy + CELL, ox:ox + CELL, 3] = 1


# --- Geometry -----------------------------------------------------------------------------------
class Part:
    """Vertices, triangles and UVs accumulated for one mesh (a root's bark or leaves)."""
    def __init__(self):
        self.verts, self.faces, self.uvs = [], [], []

    def add_face(self, idx, uv):
        self.faces.append(idx)
        self.uvs.append(uv)

    def tris(self):
        return sum(len(f) - 2 for f in self.faces)


def frames(points):
    """Parallel-transport frames along a polyline."""
    tangents = []
    for i in range(len(points)):
        a, b = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < .9 else Vector((1, 0, 0))
    normal = tangents[0].cross(up).normalized()
    out = []
    for i, t in enumerate(tangents):
        if i:
            q = tangents[i - 1].rotation_difference(t)
            normal = (q @ normal).normalized()
        out.append((t, normal, t.cross(normal).normalized()))
    return out


def tube(part, points, radii, sides, tile, rect):
    """A tapered tube in a bark cell: the cell wraps once round it and repeats along it every
    `tile` metres, rounded to whole segments, so every face's UVs stay inside the cell."""
    base = len(part.verts)
    fr = frames(points)
    for i, p in enumerate(points):
        t, n, b = fr[i]
        for k in range(sides):
            a = k / sides * TAU
            part.verts.append(p + (n * math.cos(a) + b * math.sin(a)) * radii[i])
    seg = sum((points[i + 1] - points[i]).length for i in range(len(points) - 1)) / max(1, len(points) - 1)
    per = max(1, round(tile / max(seg, 1e-4)))
    u0, v0, u1, v1 = rect
    U, V = (lambda f: u0 + (u1 - u0) * f), (lambda f: v0 + (v1 - v0) * f)
    for i in range(len(points) - 1):
        va, vb = V(i % per / per), V((i % per + 1) / per)
        for k in range(sides):
            a, b2 = base + i * sides + k, base + i * sides + (k + 1) % sides
            c, d = base + (i + 1) * sides + (k + 1) % sides, base + (i + 1) * sides + k
            part.add_face([a, b2, c, d], [(U(k / sides), va), (U((k + 1) / sides), va), (U((k + 1) / sides), vb), (U(k / sides), vb)])


def card(part, centre, normal, up, w, h, uvrect, bend=0.):
    """A leaf card: two quads hinged along its length, its foot at `centre`."""
    n = normal.normalized()
    u = up - n * up.dot(n)
    if u.length < 1e-4: u = n.orthogonal()
    u.normalize()
    r = u.cross(n).normalized()
    u0, v0, u1, v1 = uvrect
    base = len(part.verts)
    # Three rows: foot, middle (bent back by `bend`), tip.
    for row, t in enumerate((0., .5, 1.)):
        lift = n * bend * math.sin(t * math.pi) * h
        for side in (-1, 1):
            part.verts.append(centre + u * h * t + r * side * w * .5 + lift)
    for row in range(2):
        a, b, c, d = base + row * 2, base + row * 2 + 1, base + row * 2 + 3, base + row * 2 + 2
        va, vb = v0 + (v1 - v0) * row * .5, v0 + (v1 - v0) * (row + 1) * .5
        part.add_face([a, b, c, d], [(u0, va), (u1, va), (u1, vb), (u0, vb)])


class Tree:
    def __init__(self, species, rng, lod, bark_rect):
        self.species, self.rng, self.lod, self.bark_rect = species, rng, lod, bark_rect
        self.bark, self.leaves = Part(), Part()
        self.height = BUILD_HEIGHT[species]
        self.crown = 0.

    def branch(self, start, direction, length, radius, droop=0., wander=.12, segments=6, end_radius=.25):
        pts = [Vector(start)]
        d = Vector(direction).normalized()
        step = length / segments
        for i in range(segments):
            jitter = Vector((self.rng.uniform(-1, 1), self.rng.uniform(-1, 1), self.rng.uniform(-.4, .4))) * wander
            d = (d + jitter + Vector((0, 0, -droop * (i + 1) / segments))).normalized()
            pts.append(pts[-1] + d * step)
        radii = [radius * (1 - (1 - end_radius) * i / segments) for i in range(segments + 1)]
        return pts, radii

    def add_branch(self, pts, radii, sides):
        if sides >= 3 and radii[0] > .004:
            tube(self.bark, pts, radii, sides, TAU * max(radii[0], .05) / .9, self.bark_rect)
        for p in pts: self.crown = max(self.crown, math.hypot(p.x, p.y))

    def cluster(self, at, outward, size, uvrect, count, spread, up_bias=.35, hang=False, bend=.2):
        for k in range(count):
            jitter = Vector((self.rng.uniform(-1, 1), self.rng.uniform(-1, 1), self.rng.uniform(-1, 1))) * spread
            c = at + jitter
            o = (outward + jitter * 1.5).normalized()
            if hang:
                up = Vector((self.rng.uniform(-.2, .2), self.rng.uniform(-.2, .2), -1)).normalized()
                normal = Vector((o.x, o.y, 0)).normalized() if math.hypot(o.x, o.y) > 1e-3 else Vector((1, 0, 0))
            else:
                up = (o + Vector((0, 0, up_bias))).normalized()
                normal = up.orthogonal()
                normal = Quaternion(up, self.rng.uniform(0, TAU)) @ normal
            s = size * self.rng.uniform(.8, 1.2)
            u0, v0, u1, v1 = uvrect
            card(self.leaves, c, normal, up, s, s * (1.6 if hang else 1.), (u0, v1, u1, v0) if hang else uvrect, bend)
            self.crown = max(self.crown, math.hypot(c.x, c.y) + s * .6)


def deciduous(tree, leaf, form):
    """Oak, beech, alder, willow, poplar, olive, tamarisk: a trunk, boughs, twigs and leaf cards."""
    rng, H, lod = tree.rng, tree.height, tree.lod
    near = lod == 'near'
    trunk_top = H * form['trunk']
    stems = form.get('stems', 1)
    trunk_sides, bough_sides, twig_sides = (8, 6, 4) if near else (6, 4, 0)
    tops = []
    for s in range(stems):
        lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * form.get('lean', .06) + Vector((0, 0, 1))
        if stems > 1:
            a = s / stems * TAU + rng.uniform(-.3, .3)
            lean += Vector((math.cos(a), math.sin(a), 0)) * form['splay']
        pts, radii = tree.branch((0, 0, -.1), lean, trunk_top + .1, form['radius'] / math.sqrt(stems), wander=form.get('twist', .05), segments=7, end_radius=.55)
        tree.add_branch(pts, radii, trunk_sides)
        tops.append((pts, radii))
    boughs = form['boughs'] if near else max(3, form['boughs'] - 2)
    for k in range(boughs):
        pts, radii = tops[k % stems]
        t = form['from'] + (1 - form['from']) * (k + .5) / boughs
        i = min(len(pts) - 2, int(t * (len(pts) - 1)))
        start = pts[i].lerp(pts[i + 1], t * (len(pts) - 1) - i)
        a = k * 2.39996 + rng.uniform(-.25, .25)
        rise = form['rise'] + rng.uniform(-.12, .12)
        direction = Vector((math.cos(a) * math.cos(rise), math.sin(a) * math.cos(rise), math.sin(rise)))
        length = H * form['reach'] * (1.15 - .45 * t if form.get('cone') else 1.) * rng.uniform(.85, 1.15)
        bpts, bradii = tree.branch(start, direction, length, radii[i] * form.get('bough_ratio', .55), droop=form.get('droop', .1), wander=.14, segments=6, end_radius=.3)
        tree.add_branch(bpts, bradii, bough_sides)
        twigs = form['twigs'] if near else 2
        for j in range(twigs):
            tt = .45 + .55 * (j + .5) / twigs
            q = min(len(bpts) - 2, int(tt * (len(bpts) - 1)))
            tstart = bpts[q]
            ta = a + rng.uniform(-1.1, 1.1)
            trise = rise + rng.uniform(-.2, .45) - form.get('droop', .1) * .8
            tdir = Vector((math.cos(ta) * math.cos(trise), math.sin(ta) * math.cos(trise), math.sin(trise)))
            tlen = length * form.get('twig_length', .45) * rng.uniform(.7, 1.1)
            tpts, tradii = tree.branch(tstart, tdir, tlen, bradii[q] * .55, droop=form.get('twig_droop', form.get('droop', .1) * 1.4), wander=.2,
                                       segments=3 if near else 2, end_radius=.35)
            if twig_sides: tree.add_branch(tpts, tradii, twig_sides)
            else:
                for p in tpts: tree.crown = max(tree.crown, math.hypot(p.x, p.y))
            # Leaf cards along the twig's outer half and at its tip.
            for c in range(form['clusters'] if near else 1):
                ct = .5 + .5 * (c + 1) / (form['clusters'] if near else 1)
                at = tpts[0].lerp(tpts[-1], ct)
                outward = (at - Vector((0, 0, at.z * .6))).normalized()
                size = form['card'] * (1 if near else 1.9)
                tree.cluster(at, outward, size, leaf, form['cards'] if near else 3, form['card'] * .5,
                             hang=form.get('hang', False), bend=.25)


def conifer(tree, leaf, form):
    """Pine, fir, umbrella pine and cypress: an upright stem, whorls or a crown, needle cards."""
    rng, H, lod = tree.rng, tree.height, tree.lod
    near = lod == 'near'
    pts, radii = tree.branch((0, 0, -.1), (rng.uniform(-.03, .03), rng.uniform(-.03, .03), 1), H * form['stem'] + .1,
                             form['radius'], wander=form.get('twist', .03), segments=8, end_radius=.18)
    tree.add_branch(pts, radii, 8 if near else 6)
    whorls = form['whorls'] if near else max(3, form['whorls'] // 2)
    for w in range(whorls):
        t = form['from'] + (form['to'] - form['from']) * (w + .5) / whorls
        z = H * t
        count = form['per'] if near else max(3, form['per'] - 2)
        for k in range(count):
            a = k / count * TAU + w * .9 + rng.uniform(-.25, .25)
            taper = (1 - (t - form['from']) / max(.01, (form['to'] - form['from']))) if form.get('cone') else 1.
            reach = H * form['reach'] * (form.get('top', .12) + (1 - form.get('top', .12)) * taper) * rng.uniform(.85, 1.1)
            rise = form['rise'] + rng.uniform(-.1, .1)
            direction = Vector((math.cos(a) * math.cos(rise), math.sin(a) * math.cos(rise), math.sin(rise)))
            start = Vector((pts[0].x, pts[0].y, z))
            bpts, bradii = tree.branch(start, direction, reach, form['radius'] * form.get('bough', .3) * (1.1 - t * .6),
                                       droop=form.get('droop', .15), wander=.08, segments=4, end_radius=.3)
            tree.add_branch(bpts, bradii, 5 if near else 3)
            steps = form['cards_per'] if near else 2
            for c in range(steps):
                ct = .35 + .65 * (c + 1) / steps
                at = bpts[0].lerp(bpts[-1], ct)
                outward = (Vector((at.x, at.y, 0)).normalized() + Vector((0, 0, form.get('lift', .3)))).normalized()
                size = form['card'] * (1 if near else 1.8) * (1.15 - t * .3 if form.get('cone') else 1.)
                tree.cluster(at, outward, size, leaf, form['cards'] if near else 2, form['card'] * .35, up_bias=.2, bend=.15)
    if form.get('crown_top'):
        # Umbrella pine and pine: the flat, broad crown of needle tufts above the bare stem.
        for k in range(form['crown_top'] if near else form['crown_top'] // 2):
            a = k * 2.39996
            r = math.sqrt((k + .5) / form['crown_top']) * H * form['reach']
            at = Vector((math.cos(a) * r, math.sin(a) * r, H * (form['to'] + .02) - (r / max(.01, H * form['reach'])) ** 2 * H * .07))
            if near and k % 2 == 0:
                bpts, bradii = tree.branch(Vector((0, 0, H * (form['to'] - .08))), at - Vector((0, 0, H * (form['to'] - .08))), (at - Vector((0, 0, H * (form['to'] - .08)))).length,
                                           form['radius'] * .32, droop=-.05, wander=.06, segments=4, end_radius=.35)
                tree.add_branch(bpts, bradii, 5)
            tree.cluster(at, Vector((math.cos(a) * .4, math.sin(a) * .4, 1)).normalized(), form['card'] * (1 if near else 1.7), leaf,
                         form['cards'] if near else 2, form['card'] * .4, up_bias=.6, bend=.1)
    if form.get('column'):
        # Cypress: scale sprays packed into a slender spindle round the stem.
        n = form['column'] if near else form['column'] // 3
        for k in range(n):
            t = .08 + .9 * (k + .5) / n
            radius = H * form['reach'] * math.sin(math.pi * min(1, t * 1.05)) ** .8 * (1 - t * .35)
            a = k * 2.39996
            at = Vector((math.cos(a) * radius, math.sin(a) * radius, H * t))
            tree.cluster(at, Vector((math.cos(a), math.sin(a), .5)).normalized(), form['card'] * (1 if near else 1.8), leaf,
                         2 if near else 1, form['card'] * .2, up_bias=.9, bend=.1)


def palm(tree, leaf, form):
    """Date palm: a ringed stem leaning a little, a crown of arching pinnate fronds."""
    rng, H, lod = tree.rng, tree.height, tree.lod
    near = lod == 'near'
    pts, radii = tree.branch((0, 0, -.1), (form['lean'], .03, 1), H * .86, form['radius'], wander=.02, segments=8, end_radius=.75)
    tree.add_branch(pts, radii, 8 if near else 6)
    top = pts[-1]
    fronds = form['fronds'] if near else form['fronds'] // 2
    u0, v0, u1, v1 = leaf
    for k in range(fronds):
        a = k * 2.39996
        tier = k % 3
        rise = .75 - tier * .45 + rng.uniform(-.1, .1)
        L = H * form['frond'] * rng.uniform(.85, 1.1)
        segs = 6 if near else 3
        base = len(tree.leaves.verts)
        d = Vector((math.cos(a) * math.cos(rise), math.sin(a) * math.cos(rise), math.sin(rise)))
        side = Vector((-math.sin(a), math.cos(a), 0))
        p = top.copy()
        for s in range(segs + 1):
            t = s / segs
            w = L * .2 * math.sin(math.pi * (.12 + t * .8)) ** .6
            dd = (d + Vector((0, 0, -1.3 * t))).normalized()
            if s: p = p + dd * (L / segs)
            # A shallow V: the leaflets rise a little from the rachis.
            for sgn in (-1, 1):
                tree.leaves.verts.append(p + side * sgn * w + Vector((0, 0, .08 * L * .2)))
            tree.crown = max(tree.crown, math.hypot(p.x, p.y) + w)
        for s in range(segs):
            a0, a1, b0, b1 = base + s * 2, base + s * 2 + 1, base + s * 2 + 2, base + s * 2 + 3
            va, vb = v0 + (v1 - v0) * s / segs, v0 + (v1 - v0) * (s + 1) / segs
            tree.leaves.add_face([a0, a1, b1, b0], [(u0, va), (u1, va), (u1, vb), (u0, vb)])


FORMS = {
    'oak': (deciduous, {'trunk': .42, 'radius': .26, 'boughs': 8, 'from': .35, 'rise': .55, 'reach': .37, 'twigs': 3, 'twig_length': .5,
                        'clusters': 2, 'cards': 3, 'card': .95, 'droop': .12}),
    'beech': (deciduous, {'trunk': .50, 'radius': .22, 'boughs': 8, 'from': .38, 'rise': .75, 'reach': .33, 'twigs': 3, 'twig_length': .5,
                          'clusters': 2, 'cards': 3, 'card': .9, 'droop': .08}),
    'alder': (deciduous, {'trunk': .75, 'radius': .17, 'boughs': 9, 'from': .30, 'rise': .55, 'reach': .26, 'twigs': 2, 'twig_length': .55,
                          'clusters': 2, 'cards': 3, 'card': .8, 'droop': .06, 'cone': True}),
    'willow': (deciduous, {'trunk': .34, 'radius': .28, 'boughs': 9, 'from': .55, 'rise': 1.15, 'reach': .32, 'twigs': 3, 'twig_length': .8,
                           'clusters': 2, 'cards': 3, 'card': .8, 'droop': .12, 'twig_droop': 1.6, 'hang': True}),
    'poplar': (deciduous, {'trunk': .82, 'radius': .2, 'boughs': 12, 'from': .18, 'rise': 1.25, 'reach': .26, 'twigs': 2, 'twig_length': .5,
                           'clusters': 2, 'cards': 2, 'card': .75, 'droop': -.05}),
    'olive': (deciduous, {'trunk': .36, 'radius': .24, 'stems': 3, 'splay': .25, 'twist': .2, 'boughs': 7, 'from': .55, 'rise': .7, 'reach': .3,
                          'twigs': 3, 'twig_length': .5, 'clusters': 2, 'cards': 3, 'card': .7, 'droop': .12}),
    'tamarisk': (deciduous, {'trunk': .55, 'radius': .12, 'stems': 3, 'splay': .22, 'twist': .15, 'boughs': 8, 'from': .5, 'rise': 1.0, 'reach': .34,
                             'twigs': 3, 'twig_length': .55, 'clusters': 2, 'cards': 3, 'card': .7, 'droop': .22, 'hang': True}),
    'pine': (conifer, {'stem': .92, 'radius': .22, 'whorls': 4, 'per': 5, 'from': .62, 'to': .92, 'rise': .25, 'reach': .26, 'bough': .35,
                       'cards_per': 2, 'cards': 3, 'card': .95, 'droop': .05, 'crown_top': 18, 'lift': .5}),
    'fir': (conifer, {'stem': .98, 'radius': .2, 'whorls': 11, 'per': 6, 'from': .10, 'to': .96, 'rise': -.12, 'reach': .36, 'bough': .3,
                      'cards_per': 3, 'cards': 2, 'card': .75, 'droop': .18, 'cone': True, 'top': .08, 'lift': .15}),
    'umbrella': (conifer, {'stem': .78, 'radius': .24, 'whorls': 2, 'per': 4, 'from': .72, 'to': .86, 'rise': .45, 'reach': .55, 'bough': .4,
                           'cards_per': 2, 'cards': 4, 'card': 1.05, 'droop': -.02, 'crown_top': 36, 'lift': .6}),
    'cypress': (conifer, {'stem': .95, 'radius': .15, 'whorls': 0, 'per': 0, 'from': .1, 'to': .95, 'rise': .9, 'reach': .11, 'bough': .2,
                          'cards_per': 0, 'cards': 0, 'card': .45, 'column': 140}),
    'palm': (palm, {'lean': .12, 'radius': .2, 'fronds': 24, 'frond': .56}),
}
assert set(FORMS) == set(BARK) == set(LEAF) == set(BUILD_HEIGHT)


# --- Blender objects, impostors and export --------------------------------------------------------
def kit_material(name, image):
    """The kit's one material: the atlas's colour and its alpha, cut out by the runtime."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = .86
    return mat


def merged(*parts):
    """One Part holding all the given parts' faces (a tree's bark and leaves, one mesh)."""
    out = Part()
    for part in parts:
        base = len(out.verts)
        out.verts += part.verts
        for face, uv in zip(part.faces, part.uvs): out.add_face([base + i for i in face], uv)
    return out


def mesh_object(name, part, mat, parent, scale):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new(v * scale) for v in part.verts]
    uv_layer = bm.loops.layers.uv.new('UVMap')
    for face, uv in zip(part.faces, part.uvs):
        try:
            f = bm.faces.new([verts[i] for i in face])
        except ValueError:
            continue
        for loop, (u, v) in zip(f.loops, uv): loop[uv_layer].uv = (u, v)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def render_impostor(objects, crown, height, path):
    """The near tree seen from the side, flat-lit, on a transparent ground (Cycles, CPU)."""
    scene = bpy.context.scene
    for o in scene.objects: o.hide_render = o not in objects and o.type == 'MESH'
    cam = bpy.data.objects.get('impostor camera') or bpy.data.objects.new('impostor camera', bpy.data.cameras.new('impostor camera'))
    if cam.name not in scene.collection.objects: scene.collection.objects.link(cam)
    scene.camera = cam
    span = max(crown * 2, height) * 1.04
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = span
    cam.location = (0, -40, span / 2); cam.rotation_euler = (math.pi / 2, 0, 0)
    world = scene.world or bpy.data.worlds.new('impostor light'); scene.world = world
    world.use_nodes = True; world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.
    scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 32
    # A ray crossing a crown passes many cut-out cards: too few transparent bounces end it black.
    scene.cycles.transparent_max_bounces = 128; scene.cycles.max_bounces = 6
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = CELL * 2
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = path
    # The flat-lit albedo only: a uniform white sky would gloss every card seen edge-on.
    sheen = [(m, m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value) for m in {s.material for o in objects for s in o.material_slots}]
    for m, _ in sheen: m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0
    bpy.ops.render.render(write_still=True)
    for m, level in sheen: m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = level
    for o in scene.objects: o.hide_render = False
    return span


def impostor_cards(part, span, uvrect):
    """Two crossed cards, each `span` wide and tall, the cell's foot at the tree's."""
    for a in (0, math.pi / 2):
        r = Vector((math.cos(a), math.sin(a), 0)) * span / 2
        base = len(part.verts)
        part.verts += [-r + Vector((0, 0, 0)), r + Vector((0, 0, 0)), r + Vector((0, 0, span)), -r + Vector((0, 0, span))]
        u0, v0, u1, v1 = uvrect
        part.add_face([base, base + 1, base + 2, base + 3], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_kit(kit):
    clear_scene()
    species = KITS[kit]['species']
    cells = atlas_cells(species)
    sprites = kit_sprites({LEAF[s] for s in species})
    painter = Painter(ATLAS)
    for (what, key), index in cells.items():
        ox, oy = cell_origin(index)
        if what == 'bark': paint_bark_cell(painter, key, ox, oy)
        elif what == 'leaf': paint_leaf_cell(painter, key, ox, oy, 4100 + index * 37, sprites)
    atlas_path = os.path.join(TMP, f'trees-{kit}-atlas-cards.png')
    # Write the bark and card cells first, so the impostor renders show the real tree.
    def save_atlas(path):
        img = (np.clip(painter.rgba, 0, 1) * 255).astype(np.uint8)
        from_top = img[::-1]  # Blender pixels run bottom-up
        image = bpy.data.images.new('atlas tmp', ATLAS, ATLAS, alpha=True)
        image.pixels.foreach_set((from_top.astype(np.float32) / 255).ravel())
        image.filepath_raw = path; image.file_format = 'PNG'; image.save()
        bpy.data.images.remove(image)
    save_atlas(atlas_path)
    atlas = bpy.data.images.load(atlas_path); atlas.name = f'Trees {kit} atlas'
    material = kit_material(f'Tree kit {kit}', atlas)
    reports, roots = [], []
    for index, sp in enumerate(species):
        made = {}
        for lod in ('near', 'mid'):
            # The bark cell is inset further: its texture tiles, and a wider margin keeps the
            # neighbouring cells out of its mip levels.
            tree = Tree(sp, random.Random(5000 + index * 101), lod, cell_uv(cells[('bark', BARK[sp])], pad=6))
            fn, form = FORMS[sp]
            fn(tree, cell_uv(cells[('leaf', LEAF[sp])]), form)
            made[lod] = tree
        top = max(v.z for v in made['near'].bark.verts + made['near'].leaves.verts)
        scale = NORMAL_HEIGHT / top
        near = None
        for lod in ('near', 'mid'):
            name = sp if lod == 'near' else f'{sp}_mid'
            r = root(name)
            obj = mesh_object(f'{name}_tree', merged(made[lod].bark, made[lod].leaves), material, r, scale)
            if lod == 'near': near = obj
            roots.append(r)
        png = os.path.join(TMP, f'trees-{kit}-{sp}-impostor.png')
        span = render_impostor([near], made['near'].crown * scale, NORMAL_HEIGHT, png)
        shot = bpy.data.images.load(png)
        px = np.array(shot.pixels[:], np.float32).reshape(CELL * 2, CELL * 2, 4)[::-1]  # top-down
        bpy.data.images.remove(shot)
        # Halved with premultiplied alpha, so the cut-out's edge keeps the crown's colour.
        blocks = px.reshape(CELL, 2, CELL, 2, 4)
        alpha = blocks[..., 3:].mean(axis=(1, 3))
        small = np.concatenate([(blocks[..., :3] * blocks[..., 3:]).mean(axis=(1, 3)) / np.maximum(alpha, 1e-4), alpha], axis=2)
        # The render darkens the crown's inside under a uniform sky; the game lights the crossed cards
        # from their sides, so the impostor is lifted to the near tree's brightness.
        small[..., :3] = np.clip(small[..., :3] * IMPOSTOR_GAIN, 0, 1)
        cell = cells[('impostor', sp)]
        ox, oy = cell_origin(cell)
        painter.rgba[oy:oy + CELL, ox:ox + CELL] = small
        far = Part()
        impostor_cards(far, span, cell_uv(cell))
        r = root(f'{sp}_far')
        mesh_object(f'{sp}_far_tree', far, material, r, 1.)
        roots.append(r)
        reports.append({'species': sp, 'buildHeight': BUILD_HEIGHT[sp], 'top': round(top, 3), 'bark': BARK[sp], 'leaf': LEAF[sp],
                        'crownRadius': round(made['near'].crown * scale, 4), 'impostorSpan': round(span, 4),
                        'triangles': {'near': made['near'].bark.tris() + made['near'].leaves.tris(),
                                      'mid': made['mid'].bark.tris() + made['mid'].leaves.tris(), 'far': 4}})
    # The finished atlas (cards and impostors) replaces the one the renders saw.
    final = os.path.join(TMP, f'trees-{kit}-atlas.png')
    save_atlas(final)
    atlas.filepath = final; atlas.reload(); atlas.pack()
    for i, r in enumerate(roots): r.location = ((i % 3) * 1.2, (i // 3) * 1.2, 0)
    bpy.context.view_layer.update()
    path = os.path.join(PROCESSED, f'trees-{kit}.glb')
    for r in roots: r.location = (0, 0, 0)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=False, export_extras=True,
                              export_image_format='AUTO', export_materials='EXPORT', export_normals=True, export_texcoords=True, export_tangents=False)
    for i, r in enumerate(roots): r.location = ((i % 3) * 1.2, (i // 3) * 1.2, 0)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE, f'trees-{kit}.blend'))
    with open(path, 'rb') as f: raw = f.read()
    report = {'version': 1, 'id': f'trees-{kit}', 'generator': 'scripts/assets/build-trees.py', 'kit': kit, 'chapters': KITS[kit]['chapters'],
              'normalHeight': NORMAL_HEIGHT, 'atlas': {'size': ATLAS, 'cell': CELL, 'cells': {f'{what}:{key}': i for (what, key), i in cells.items()}},
              'authorship': 'Original Blender-authored geometry and impostors rendered from it; leaf cards composed from CC0 Poly Haven '
                            'plant textures and, for oak and the palm, cells of the game\'s generated foliage atlas; CC0 Poly Haven bark '
                            '(colour and ambient occlusion)',
              'leaves': {k: (f'art-source/cc0/polyhaven-{CARDS[k]["source"]}.json' if 'source' in CARDS[k] else 'assets/showcase/foliage-v016.webp')
                         for k in sorted({LEAF[x] for x in species})},
              'bark': {s: f'art-source/cc0/polyhaven-{s}.json' for s in sorted({BARK[x] for x in species})},
              'species': reports,
              'output': {'path': f'art-source/models/processed/trees-{kit}.glb', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                         'triangles': sum(r['triangles']['near'] + r['triangles']['mid'] + 4 for r in reports)},
              'runtimePath': f'assets/models/scenery/trees-{kit}.glb'}
    with open(os.path.join(PROCESSED, f'trees-{kit}.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2); f.write('\n')
    print(json.dumps(report['output']))
    return report


reports = [build_kit(kit) for kit in KITS if not opts.only or opts.only == kit]
if not opts.only:
    data = {r['kit']: {s['species']: {'crownRadius': s['crownRadius'], 'impostorSpan': s['impostorSpan'], 'buildHeight': s['buildHeight']}
                       for s in r['species']} for r in reports}
    with open(os.path.join(REPO, 'src', 'showcase', 'tree-kit-components.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/assets/build-trees.py: each kit species\' crown radius and impostor span\n')
        f.write('// in its normalised units (the tree 0.5 tall, its foot at the origin), and the height it was built at.\n')
        f.write('export const TREE_KIT_COMPONENTS = ' + json.dumps(data, indent=2) + ';\n')
        f.write('for (const kit of Object.values(TREE_KIT_COMPONENTS)) { for (const s of Object.values(kit)) Object.freeze(s); Object.freeze(kit); }\nObject.freeze(TREE_KIT_COMPONENTS);\n')
