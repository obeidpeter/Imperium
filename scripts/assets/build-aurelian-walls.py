"""Author Aurelian's walls of Rome for the finale in Blender (worlds and gameplay plan, release 9).

  "$BLENDER_PYTHON" scripts/assets/build-aurelian-walls.py -- --repo .      (the bpy module)

The brick-faced concrete curtain begun in AD 271 and still rising in 275
(docs/historical-research.md): about 3.5 m thick and, here, 6.6 m to the wall walk; a
square tower every 100 Roman feet; the gate's two arched passages faced in travertine
between two semicircular towers; and stretches still building behind scaffolding. Each
piece stands at its local ground origin on the wall's centre line, the stretch running
along z and its outer face toward -x (the finale's approach from the west), in runtime
metres (x east, y up, z south):
  wall_curtain       a finished 4 m stretch: wall walk, parapet and merlons
  wall_rising_low    a 4 m stretch still building, 2.8 m high, with its scaffold
  wall_rising_mid    the same at 4.2 m
  wall_rising_high   the same at 5.6 m
  wall_tower         a square tower projecting 3.6 m outward, its upper chamber windowed
  wall_gate          the double gateway and its two towers, 24.4 m along the wall
Original geometry and deterministic procedural maps (colour, ORM, normal), no source
images; the shared builders, bakes and export are in kitlib.py beside this script. Writes
art-source/models/aurelian-walls-kit.blend, the processed GLB and its report, and
src/showcase/aurelian-walls-components.js (each piece's runtime bounds).
"""
import argparse
import json
import math
import os
import sys

import numpy as np

import kitlib as K  # imports bpy first, which puts mathutils on the path
from kitlib import beam, box, cylinder, fbm, grid, joints, mesh, periodic_noise

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
SOURCE = os.path.join(REPO, 'art-source', 'models')
PROCESSED = os.path.join(SOURCE, 'processed')
os.makedirs(PROCESSED, exist_ok=True)
KIT = 'aurelian-walls-kit'

HALF = 1.75            # half the curtain's thickness (3.5 m)
WALK = 6.6             # the wall walk
PARAPET, MERLON = 7.6, 8.4
STRETCH = 4.0          # the finale's stretches (environment-finale.js)
TOWER_OUT = 3.6        # a tower's projection beyond the outer face
GATE_HALF = 12.2       # the gate piece's half-length along the wall


# --- Surfaces: each returns (colour, height, roughness) for kitlib.bake ---------------------------
def surface_brick(size):
    """Opus testaceum, one to 1.2 m: thin bricks in thick mortar, eighteen courses, with a
    bonding course of large tiles (bipedales) at the foot and one putlog hole."""
    x, y = grid(size)
    rng = np.random.default_rng(71)
    rows = 18
    row = np.floor(y * rows).astype(int)
    v = (y * rows) % 1
    colour = np.zeros((size, size, 3), np.float32); height = np.ones((size, size), np.float32)
    palette = np.array([(.60, .38, .26), (.53, .32, .22), (.64, .47, .33), (.49, .30, .21), (.58, .42, .30)], np.float32)
    mortar = np.array((.70, .66, .58), np.float32)
    for r in range(rows):
        m = row == r
        tile = r < 2  # the bonding course: long, even tiles
        n = 2 if tile else int(rng.integers(3, 6))
        widths = rng.uniform(.7, 1.3, n); edges = np.concatenate([[0], np.cumsum(widths) / widths.sum()])
        u = (x[m] + rng.random()) % 1
        k = np.searchsorted(edges, u, side='right') - 1
        tone = palette[(rng.integers(0, len(palette), n) if not tile else np.array([3, 3]))[k]]
        tone = tone * (.9 + rng.random(n)[k][:, None] * .2)
        across = np.minimum(u - edges[k], edges[k + 1] - u) * (n / 1.0)
        joint = np.minimum(np.minimum(v[m], 1 - v[m]) / .19, across / .05)
        face = np.clip(joint, 0, 1) ** .5
        colour[m] = tone * face[:, None] + mortar * (1 - face[:, None])
        height[m] = .45 + .55 * face
    weather = fbm(size, 73)
    colour *= (.86 + weather * .2)[..., None]
    # A putlog hole: the scaffolds' beam sockets, left open.
    hole = (np.abs(x - .5) < .034) & (np.abs(y - .36) < .038)
    colour[hole] = (.16, .13, .11); height[hole] = 0
    return np.clip(colour, .01, .97), height, .88


def surface_travertine(size):
    """Travertine ashlar, one to 1.2 m: two courses of blocks, their faces streaked with pores."""
    x, y = grid(size)
    rng = np.random.default_rng(81)
    rows = 2
    row = np.floor(y * rows); u = (x + row * .5) % 1; v = (y * rows) % 1
    block = np.floor(x + row * .5)
    tone = .92 + ((np.sin((block * 7 + row * 13) * 12.9898) * 43758.5453) % 1 - .5) * .1
    n = fbm(size, 83)
    pores = (periodic_noise(size, 96, 85) > .82) & (periodic_noise(size, 24, 87) > .45)
    colour = np.array((.80, .74, .62))[None, None] * (tone * (.92 + n * .14))[..., None]
    colour[pores] *= .62
    height = joints(np.minimum(u, 1 - u) / 2, np.minimum(v, 1 - v) / 2, width=.004)
    height = np.where(pores, .55, height)
    return np.clip(colour * (.9 + .1 * height)[..., None], .01, .97), height, .9


def surface_concrete(size):
    """The core's opus caementicium, one to 1.2 m: tufa and stone rubble in grey mortar."""
    x, y = grid(size)
    rng = np.random.default_rng(91)
    cells = 9
    pts = rng.random((cells, cells, 2)).astype(np.float32)
    gx, gy = x * cells, y * cells
    best = np.full((size, size), 9., np.float32); second = best.copy(); owner = np.zeros((size, size), np.int32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx = (np.floor(gx).astype(int) + dx) % cells; cy = (np.floor(gy).astype(int) + dy) % cells
            px = np.floor(gx) + dx + pts[cy, cx, 0]; py = np.floor(gy) + dy + pts[cy, cx, 1]
            d = np.hypot(gx - px, gy - py)
            closer = d < best
            second = np.where(closer, best, np.minimum(second, d)); owner = np.where(closer, cy * cells + cx, owner); best = np.minimum(best, d)
    edge = second - best
    stone = edge > .16
    hue = (np.sin(owner * 12.9898) * 43758.5453) % 1
    tufa, grey, mortar = np.array((.56, .48, .37)), np.array((.50, .49, .46)), np.array((.62, .60, .55))
    colour = np.where((hue > .45)[..., None], tufa, grey) * (.85 + hue[..., None] * .25)
    colour = np.where(stone[..., None], colour, mortar)
    colour *= (.85 + fbm(size, 93) * .25)[..., None]
    height = np.clip((edge - .1) / .12, 0, 1) * .8 + .2
    return np.clip(colour, .01, .97), height, .95


def surface_timber(size):
    """Rough scaffold poles and planks, one to 1.5 m."""
    x, y = grid(size)
    n = fbm(size, 61)
    grain = np.sin(x * math.tau * 24 + n * 9) * .5 + .5
    colour = np.array((.40, .31, .22))[None, None] * (.8 + grain * .2 + (n - .5) * .2)[..., None]
    return np.clip(colour, .01, .97), .8 + grain * .2, .9


TEXTURED = {
    'brick': ('Walls brick facing', surface_brick, 1.2, 0.),
    'travertine': ('Walls travertine ashlar', surface_travertine, 1.2, 0.),
    'concrete': ('Walls concrete core', surface_concrete, 1.2, 0.),
    'timber': ('Walls scaffold timber', surface_timber, 1.5, 0.),
}
PLAIN = {'shadow': ('Walls shadowed interior', (.045, .04, .035), 0., 1.)}


# --- Pieces -------------------------------------------------------------------------------------------
def component(name):
    return K.component(name, 'Original Blender-authored Aurelian Walls for Imperium')


def merlons(x0, x1, z0, z1, y, top, mat='brick', width=1.2, pitch=2.0):
    """Merlons along z from `y` to `top`, with crenels between them, centred on the stretch."""
    n = max(1, int((z1 - z0) / pitch))
    for i in range(n):
        c = z0 + (i + .5) * (z1 - z0) / n
        box(x0, x1, y, top, c - width / 2, c + width / 2, mat, .02)


def curtain():
    component('wall_curtain')
    z0, z1 = -STRETCH / 2, STRETCH / 2
    box(-HALF, HALF, 0, WALK, z0, z1, 'brick')
    box(-HALF, -HALF + .55, WALK, PARAPET, z0, z1, 'brick')
    merlons(-HALF, -HALF + .55, z0, z1, PARAPET, MERLON)
    box(HALF - .4, HALF, WALK, WALK + .5, z0, z1, 'brick')
    box(-HALF + .55, HALF - .4, WALK - .02, WALK + .05, z0, z1, 'concrete')


def rising(name, top):
    """A stretch still building: the two brick skins stepped where the courses stop, the
    concrete core between them, and the scaffold on the outer face."""
    component(name)
    z0, z1 = -STRETCH / 2, STRETCH / 2
    skin = .5
    for face, step in ((-1, (0, -.18, -.36)), (1, (-.1, -.28, 0))):
        x0, x1 = (-HALF, -HALF + skin) if face < 0 else (HALF - skin, HALF)
        for k, drop in enumerate(step):
            a, b = z0 + k * STRETCH / 3, z0 + (k + 1) * STRETCH / 3
            box(x0, x1, 0, top + drop, a, b, 'brick')
    box(-HALF + skin, HALF - skin, 0, top - .3, z0, z1, 'concrete')
    # Loose bricks and a mortar trough on the core.
    box(-.6, .2, top - .3, top - .02, -.9, -.2, 'timber')
    box(-.55, .15, top - .02, top + .06, -.85, -.25, 'concrete')
    for i in range(5): box(.3 + (i % 2) * .26, .52 + (i % 2) * .26, top - .3, top - .22 + .08 * (i // 2), .3 + i * .1, .5 + i * .1, 'brick')
    # The scaffold: two standards, ledgers, putlogs into the wall, a plank deck and a ladder.
    sx = -HALF - 1.15
    for z in (-1.6, 1.6): beam((sx, 0, z), (sx, top + 2.2, z), .07, 'timber', 7)
    for y in (top * .5, top - .45, top + .9):
        beam((sx, y, -1.9), (sx, y, 1.9), .05, 'timber', 6)
        for z in (-1.6, 0, 1.6): beam((sx - .15, y - .06, z), (-HALF + .05, y - .06, z), .04, 'timber', 5)
    for i in range(5): box(sx - .2, -HALF - .05, top - .45, top - .4, -1.9 + i * .78, -1.9 + i * .78 + .72, 'timber')
    foot, head = (sx - 1.2, .05, .9), (sx - .05, top - .4, .9)
    for dz in (-.24, .24): beam((foot[0], foot[1], foot[2] + dz), (head[0], head[1], head[2] + dz), .035, 'timber', 5)
    for k in range(1, int(top / .32)):
        t = k * .32 / top
        beam((foot[0] + (head[0] - foot[0]) * t, head[1] * t, .66), (foot[0] + (head[0] - foot[0]) * t, head[1] * t, 1.14), .022, 'timber', 4)
    # A stack of new bricks at the foot.
    for i in range(3):
        box(-HALF - 3.2, -HALF - 2.3, i * .18, i * .18 + .16, -1.6 + i * .05, -.7 - i * .05, 'brick')


def tower():
    component('wall_tower')
    x0, x1, z0, z1 = -HALF - TOWER_OUT, HALF + .05, -3.7, 3.7
    roof = 9.6
    box(x0, x1, 0, WALK, z0, z1, 'brick')
    box(x0 - .06, x1, WALK - .1, WALK + .12, z0 - .06, z1 + .06, 'travertine')
    # The chamber: four walls with arched windows, a dark room behind them.
    t = .7
    K.slab_with_openings(x0, x0 + t, z0, z1, [(-1.6, 7.3, 1.1, 8.7, True), (1.6, 7.3, 1.1, 8.7, True)], 'x', roof, 'brick', WALK + .12)
    for zs in ((z0, z0 + t), (z1 - t, z1)):
        K.slab_with_openings(x0 + t, x1, zs[0], zs[1], [(-2.0, 7.3, 1.0, 8.6, True)], 'z', roof, 'brick', WALK + .12)
    box(x1 - t, x1, WALK + .12, roof, z0 + t, z1 - t, 'brick')
    box(x0 + t, x1 - t, WALK + .12, roof - .1, z0 + t, z1 - t, 'shadow')
    box(x0 - .1, x1 + .02, roof, roof + .3, z0 - .1, z1 + .1, 'travertine')
    # The roof's parapet and merlons all round.
    box(x0, x0 + .5, roof + .3, roof + 1.0, z0, z1, 'brick')
    for zs in ((z0, z0 + .5), (z1 - .5, z1)): box(x0 + .5, x1, roof + .3, roof + 1.0, zs[0], zs[1], 'brick')
    for c in np.linspace(z0 + .6, z1 - .6, 4): box(x0, x0 + .5, roof + 1.0, roof + 1.8, c - .45, c + .45, 'brick', .02)
    for zs in (z0, z1 - .5):
        for c in np.linspace(x0 + .9, x1 - .6, 3): box(c - .45, c + .45, roof + 1.0, roof + 1.8, zs, zs + .5, 'brick', .02)


def gate():
    """The double gateway faced in travertine, an attic gallery above it, and two
    semicircular towers, with the curtain carried to the piece's ends."""
    component('wall_gate')
    face = -HALF - .4
    # The facade: two arched passages (3.8 m wide, crowns at 6.5 m) through the gate block.
    K.slab_with_openings(face, HALF, -5.2, 5.2, [(-2.5, -1, 3.8, 4.6, True), (2.5, -1, 3.8, 4.6, True)], 'x', 7.0, 'travertine')
    # The attic: a gallery of five arched windows over the passages, then the parapet.
    K.slab_with_openings(face, face + .6, -5.2, 5.2, [(c, 7.35, .8, 8.05, True) for c in (-3.6, -1.8, 0, 1.8, 3.6)], 'x', 9.0, 'travertine', 7.0)
    box(face + .6, HALF, 7.0, 9.0, -5.2, 5.2, 'brick')
    box(face + .6, face + .9, 7.2, 8.6, -4.4, 4.4, 'shadow')
    box(face - .12, HALF, 6.9, 7.08, -5.32, 5.32, 'travertine')
    box(face - .14, HALF, 9.0, 9.22, -5.34, 5.34, 'travertine')
    box(face, face + .55, 9.22, 9.9, -5.2, 5.2, 'brick')
    merlons(face, face + .55, -5.2, 5.2, 9.9, 9.9 + MERLON - PARAPET)
    # The towers, D-shaped: a half-round front on a square back, three storeys high.
    for s in (-1, 1):
        cz = s * 8.5
        cylinder(face + .4, cz, 0, 11.0, 3.4, 'brick', 28)
        box(face + .4, HALF, 0, 11.0, cz - 3.4, cz + 3.4, 'brick')
        cylinder(face + .4, cz, 6.9, 7.1, 3.5, 'travertine', 28)
        cylinder(face + .4, cz, 11.0, 11.25, 3.5, 'travertine', 28)
        # Windows on the upper storey, set into the curve.
        # A dark arched panel tangent to the curve just proud of it, at three bearings.
        for a in (-.55, 0, .55):
            wx, wz = face + .4 - math.cos(a) * 3.42, cz + math.sin(a) * 3.42
            outline = [(-.42, 8.2), (.42, 8.2), (.42, 9.3)] + [(.42 * math.cos(t), 9.3 + .42 * math.sin(t)) for t in np.linspace(0, math.pi, 9)[1:-1]] + [(-.42, 9.3)]
            pts = [(wx + u * math.sin(a), y, wz + u * math.cos(a)) for u, y in outline]
            n = len(pts)
            mesh('window', pts + [(p[0] - .03 * math.cos(a), p[1], p[2] + .03 * math.sin(a)) for p in pts],
                 [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], 'shadow', closed=True)
        # Merlons round the half-round top.
        for k in range(9):
            a = -math.pi / 2 + (k + .5) * math.pi / 9
            mx, mz = face + .4 - math.cos(a) * 3.15, cz + math.sin(a) * 3.15
            box(mx - .3, mx + .3, 11.25, 12.05, mz - .32, mz + .32, 'brick', .02)
    # The curtain carried from the towers to the piece's ends.
    for s in (-1, 1):
        z0, z1 = sorted((s * 11.6, s * GATE_HALF))
        box(-HALF, HALF, 0, WALK, z0, z1, 'brick')
        box(-HALF, -HALF + .55, WALK, PARAPET, z0, z1, 'brick')


K.reset()
for key, (name, build, repeat, offset) in TEXTURED.items():
    colour, height, rough = build(512)
    K.materials[key] = K.bake(name, colour, height, rough, repeat, offset)
for key, (name, base, metal, rough) in PLAIN.items():
    K.materials[key] = K.plain(name, base, metal, rough)
curtain()
for name, top in (('wall_rising_low', 2.8), ('wall_rising_mid', 4.2), ('wall_rising_high', 5.6)): rising(name, top)
tower()
gate()
measures = {'thickness': HALF * 2, 'walk': WALK, 'merlon': MERLON, 'stretch': STRETCH, 'towerProjection': TOWER_OUT, 'gateHalf': GATE_HALF,
            'rising': {'wall_rising_low': 2.8, 'wall_rising_mid': 4.2, 'wall_rising_high': 5.6}}
report = K.export(KIT, 'scripts/assets/build-aurelian-walls.py', [12], PROCESSED, SOURCE, {'measures': measures})
with open(os.path.join(REPO, 'src', 'showcase', 'aurelian-walls-components.js'), 'w', encoding='utf-8') as f:
    f.write('// Generated by scripts/assets/build-aurelian-walls.py: each piece\'s runtime bounds in metres\n')
    f.write('// (x east, y up, z south), centred on the wall line, its outer face toward -x.\n')
    f.write('export const AURELIAN_WALL_COMPONENTS = ' + json.dumps(K.bounds(report), indent=2) + ';\n')
    f.write('export const AURELIAN_WALL_MEASURES = ' + json.dumps(measures) + ';\n')
    f.write('for (const box of Object.values(AURELIAN_WALL_COMPONENTS)) { Object.freeze(box.min); Object.freeze(box.max); Object.freeze(box); }\n')
    f.write('Object.freeze(AURELIAN_WALL_COMPONENTS); Object.freeze(AURELIAN_WALL_MEASURES.rising); Object.freeze(AURELIAN_WALL_MEASURES);\n')
