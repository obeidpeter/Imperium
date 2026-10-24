"""Render each region's distant panorama: the far skyline beyond the 3D scenes.

  $BLENDER_PYTHON scripts/assets/render-panorama.py -- --repo . [--only forest,rome] [--width 8192] [--samples 64]

Original, procedural landscapes in Cycles; no external images or models. Each
region is seeded value noise shaped by its own data (REGIONS): rolling ground
near, hills in the middle distance, mountain ranges in arcs far off, plains,
rivers and pools, forests and fields, and landmarks built from boxes, roofs
and drums (forts, villages, a city's walls, aqueducts, colonnades, tombs).

Coordinates: metres, +X east, +Y north, Z up. The camera stands at the centre,
12 m above the game's ground, and looks all round: an equirectangular band from
4 degrees below the horizon to 10.0625 above, so that 8192 pixels around make
320 rows. North is the image's centre and east three quarters across: a
bearing b (clockwise from north) is at u = 0.5 + b / 360. The terrain begins
620 m out, just beyond the game's own modelled ridges (550 m). The sky is left
transparent, so the game's own sky shows above. Aerial haze is part of every
surface: it fades toward a neutral haze with distance, and the game adds each
chapter's own fog and tint (src/showcase/environment-panorama.js).

Writes art-source/panoramas/<key>.png (kept out of the repository) and a report
of its seed, settings and digest to art-source/panoramas/<key>.json, which
scripts/assets/build-panoramas.mjs checks before it encodes the PNG for the
game. The same seed and settings give the same landscape.
"""
import argparse
import hashlib
import json
import math
import os
import sys
import time

import bpy
import addon_utils  # importable once bpy is
import mathutils
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
parser.add_argument('--only', default='')
parser.add_argument('--width', type=int, default=8192)
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--out', default='')
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
OUT = os.path.abspath(opts.out) if opts.out else os.path.join(REPO, 'art-source', 'panoramas')
os.makedirs(OUT, exist_ok=True)

LAT_MIN = -4.0
BAND = 14.0625            # degrees: 320 rows at 8192 pixels around
LAT_MAX = LAT_MIN + BAND
EYE = 12.0                # metres above the game's ground
START = 620.0             # the panorama's nearest ground
# A blue-grey haze, darker than the game's horizon sky, so that far ranges stay
# darker than the sky behind them; the game adds its own fog over it.
HAZE = (0.3, 0.34, 0.4)   # linear
HAZE_DISTANCE = 15000.0   # haze = HAZE_MAX * (1 - exp(-distance / HAZE_DISTANCE))
HAZE_MAX = 0.6
EARTH = 7.3e6             # effective radius, with refraction: far plains sink

# Colours are linear RGB.
STONE = (.42, .39, .33)
LIMESTONE = (.55, .5, .41)
MARBLE = (.66, .64, .58)
PLASTER = (.6, .55, .45)
MUDBRICK = (.5, .4, .28)
TILE = (.4, .15, .08)
THATCH = (.3, .25, .16)
TIMBER = (.2, .14, .08)
TENT = (.58, .52, .4)
ROMAN_WALLS = [PLASTER, (.46, .3, .2), (.52, .42, .3), (.56, .47, .36), (.42, .34, .26)]
SHADOW = (.08, .07, .06)
WATER = (.06, .07, .07)

# Each region: relief (metres) near, in the middle distance (with its ridged
# share) and in far ranges (bearing, half-width in degrees, height, start in
# metres); plains (bearing, half-width, flatness); cover shares and colours;
# the sun (bearing, elevation, strength, colour) and the sky's light; trees
# (style, share) on the forest mask and scattered (`lone`); landmarks (kind,
# bearing, distance, options). The battle camera faces north-north-east by
# default, so each region's chief sights stand between north and east.
REGIONS = {
    # The Danube frontier, the fort above the ford and the crossings (I, IV,
    # VIII): the river across the north, forest on its far bank, the Roman bank
    # rising to wooded hills and the Haemus far to the south, the Carpathians
    # faint beyond the plain to the north.
    'forest': dict(seed=11, near=36, mid=170, ridge=.45, plains=[(10, 70, .55)],
                   ranges=[(195, 115, 950, 9000), (15, 70, 650, 22000)],
                   forest=.52, lone=.012, fields=.14, rock=.04, river='danube',
                   land=(.17, .24, .1), dry=(.3, .3, .16), wood=(.05, .1, .04), rockc=(.36, .34, .3),
                   fieldc=[(.36, .32, .14), (.2, .28, .1), (.28, .22, .12)],
                   trees=[('broadleaf', .8), ('conifer', .2)], wall=PLASTER, roof=TILE, thatch=THATCH,
                   sun=(307, 46, 3.8, (1, .97, .9)), sky=((.52, .6, .7), .55),
                   landmarks=[('village', 22, 2700, {}), ('watchtower', 96, 1500, {}), ('fort', 128, 2900, {}),
                              ('village', 238, 2300, {}), ('watchtower', 274, 1700, {}), ('village', 332, 3400, {}),
                              ('watchtower', 62, 2300, {})]),
    # The marshes after Abritus (II): flooded meadow, pools and reed beds,
    # willows and alders, low ridges round about under a grey morning.
    'reeds': dict(seed=23, near=3, mid=22, ridge=.1, plains=[(0, 180, .6)],
                  ranges=[(170, 90, 460, 8000), (40, 60, 320, 9000), (300, 50, 260, 9000)],
                  forest=.2, lone=.02, fields=.5, rock=0, river='marsh', pools=70,
                  land=(.19, .22, .11), dry=(.3, .29, .15), wood=(.08, .11, .05), rockc=(.33, .32, .28),
                  fieldc=[(.4, .35, .16), (.3, .3, .13), (.34, .28, .15), (.24, .26, .12)],
                  trees=[('willow', .7), ('broadleaf', .3)], wall=MUDBRICK, roof=THATCH, thatch=THATCH,
                  sun=(105, 22, 2.2, (1, .92, .82)), sky=((.55, .58, .6), .8),
                  landmarks=[('huts', 35, 2100, {}), ('palisade', 70, 2600, {}), ('huts', 300, 2800, {})]),
    # The Danube road station (III): rolling hills of fields and vineyards,
    # villas and a station on the road, the Haemus to the south.
    'hills': dict(seed=31, near=40, mid=280, ridge=.35,
                  ranges=[(185, 110, 850, 9000)],
                  forest=.3, lone=.015, fields=.42, rock=.04, river=None,
                  land=(.2, .25, .11), dry=(.36, .33, .17), wood=(.06, .11, .04), rockc=(.36, .34, .3),
                  fieldc=[(.42, .36, .16), (.22, .28, .1), (.3, .24, .13), (.18, .22, .09)],
                  trees=[('broadleaf', .85), ('poplar', .15)], wall=PLASTER, roof=TILE, thatch=THATCH,
                  sun=(300, 44, 3.8, (1, .96, .88)), sky=((.55, .6, .68), .55),
                  landmarks=[('mansio', 36, 1900, {}), ('village', 70, 2700, {'tiled': True}), ('watchtower', 8, 1500, {}),
                             ('villa', 300, 2300, {}), ('fort', 205, 3100, {}), ('villa', 125, 2100, {})]),
    # The Euphrates (V, VI): the river's green valley to the east with its
    # palms, the desert plateau and its buttes to the west, the Persian siege
    # camp on the plain to the north; a low sun in the west at dusk.
    'mesa': dict(seed=43, near=10, mid=150, ridge=0, mesa=True, plains=[(80, 75, .95)], valleys=[(80, 70, 30)],
                 ranges=[(260, 80, 260, 9000)],
                 forest=0, lone=0, fields=.55, rock=.35, river='euphrates', river_base=-30,
                 land=(.36, .27, .16), dry=(.44, .34, .2), wood=(.08, .12, .04), rockc=(.42, .3, .18),
                 fieldc=[(.16, .22, .06), (.26, .26, .1), (.34, .28, .14)],
                 trees=[('palm', 1)], wall=MUDBRICK, roof=MUDBRICK, thatch=MUDBRICK,
                 sun=(282, 13, 4.6, (1, .76, .52)), sky=((.6, .55, .5), .45),
                 landmarks=[('camp', 8, 1500, {'tents': 220, 'size': 1.7}), ('camp', 38, 2600, {'tents': 160, 'size': 1.5}), ('riverpalms', 0, 0, {'n': 2600}),
                            ('ruin', 330, 2200, {}), ('village', 140, 2400, {'flat': True}), ('tombs', 245, 2300, {'n': 7})]),
    # The Po plain before Milan (VII): fields, poplar rows and villas, the
    # city's walls to the north-east and the Alps along the northern sky.
    'alps': dict(seed=53, near=4, mid=26, ridge=.2, plains=[(0, 180, .7)],
                 ranges=[(0, 95, 3000, 20000, 2.6), (180, 70, 900, 30000)], snow=2300,
                 forest=.1, lone=.015, fields=.62, rock=.04, river=None,
                 land=(.2, .26, .1), dry=(.4, .35, .16), wood=(.06, .11, .04), rockc=(.3, .31, .33),
                 fieldc=[(.44, .37, .15), (.22, .3, .1), (.34, .27, .13), (.5, .43, .2)],
                 trees=[('poplar', .5), ('broadleaf', .5)], wall=ROMAN_WALLS, roof=TILE, thatch=TILE,
                 sun=(250, 40, 3.9, (1, .97, .9)), sky=((.52, .6, .72), .55),
                 landmarks=[('walled', 48, 3600, {'radius': 650}), ('villa', 15, 1800, {}), ('poplars', 30, 1500, {}),
                            ('village', 100, 2500, {'tiled': True}), ('villa', 300, 2200, {}), ('poplars', 330, 1900, {}),
                            ('camp', 75, 1900, {'tents': 160, 'roman': True})]),
    # Palmyra (IX): the city's colonnade and the temple of Bel on the plain to
    # the north-east, Aurelian's camp and the oasis to the east and south-east,
    # tower tombs in the western valley and bare ranges to the north-west.
    'palmyra': dict(seed=61, near=14, mid=320, ridge=.6, plains=[(110, 70, .85)],
                    ranges=[(310, 70, 800, 8000, 2.2), (220, 50, 500, 10000)],
                    forest=0, lone=0, fields=.15, rock=.5, river=None,
                    land=(.38, .3, .18), dry=(.46, .37, .23), wood=(.08, .12, .04), rockc=(.3, .23, .15),
                    fieldc=[(.16, .22, .06), (.26, .27, .1)],
                    trees=[('palm', 1)], wall=(.5, .44, .34), roof=(.5, .44, .34), thatch=MUDBRICK,
                    sun=(300, 55, 4.0, (1, .95, .85)), sky=((.6, .6, .62), .45),
                    landmarks=[('palmyra', 58, 2800, {}), ('palms', 125, 2300, {'n': 900, 'spread': (900, 1500)}),
                               ('tombs', 262, 1900, {'n': 18}), ('tombs', 285, 2900, {'n': 12}), ('camp', 100, 1700, {'tents': 120, 'roman': True})]),
    # Dacia Aureliana (X): harvest fields over rolling hills south of the
    # Danube, villages, a granary, woods, the Haemus far to the south.
    'farmland': dict(seed=71, near=32, mid=170, ridge=.25, plains=[(10, 60, .5)],
                     ranges=[(185, 110, 1100, 10000)],
                     forest=.22, lone=.012, fields=.66, rock=.03, river='danube',
                     land=(.22, .26, .11), dry=(.44, .38, .18), wood=(.06, .11, .04), rockc=(.36, .34, .3),
                     fieldc=[(.52, .42, .18), (.46, .36, .15), (.24, .29, .1), (.36, .27, .14)],
                     trees=[('broadleaf', 1)], wall=PLASTER, roof=TILE, thatch=THATCH,
                     sun=(305, 40, 3.9, (1, .95, .84)), sky=((.55, .6, .68), .55),
                     landmarks=[('granary', 42, 2000, {}), ('village', 16, 2800, {}), ('villa', 80, 1800, {}),
                                ('village', 300, 2500, {}), ('watchtower', 118, 2200, {}), ('village', 200, 3200, {'tiled': True})]),
    # Rome within Aurelian's walls (XI): roofs on every side, the Colosseum,
    # the Palatine, the Capitol's temple and the Pantheon's dome; the new wall
    # and the Campagna beyond, the Alban and Sabine hills far off.
    'rome': dict(seed=83, near=22, mid=40, ridge=.2,
                 ranges=[(135, 40, 900, 18000), (60, 40, 1200, 26000), (5, 20, 600, 36000)],
                 forest=.05, lone=.01, fields=.15, rock=.03, river=None,
                 land=(.22, .24, .12), dry=(.38, .34, .2), wood=(.06, .1, .04), rockc=(.42, .4, .36),
                 fieldc=[(.36, .32, .16), (.22, .27, .1)],
                 trees=[('umbrella', .6), ('cypress', .4)], wall=ROMAN_WALLS, roof=TILE, thatch=TILE,
                 mounds=[(350, 1350, 300, 34), (318, 1250, 190, 40), (295, 2150, 320, 30), (40, 1950, 330, 30), (62, 1350, 380, 34), (275, 1200, 300, 32)],
                 sun=(300, 50, 3.9, (1, .96, .88)), sky=((.55, .6, .68), .55),
                 landmarks=[('rome', 0, 0, {}), ('gardens', 0, 0, {'n': 700}), ('colosseum', 28, 1500, {}), ('palatine', 350, 1350, {}),
                            ('temple', 318, 1250, {'size': 1.6}), ('pantheon', 300, 1750, {}), ('temple', 60, 1900, {'size': 1.1}),
                            ('aurelian', 0, 2600, {'arc': 360})]),
    # Rome and the rival armies (XII): the Campagna outside the walls at dusk,
    # aqueducts striding across it, tombs and pines along the road, the city on
    # its hills to the north-north-east behind Aurelian's wall, a rival camp.
    'campagna': dict(seed=89, near=18, mid=70, ridge=.2,
                     ranges=[(140, 45, 950, 18000), (70, 45, 1200, 26000), (5, 20, 650, 36000)],
                     forest=.08, lone=.012, fields=.3, rock=.03, river=None,
                     land=(.24, .25, .12), dry=(.4, .35, .19), wood=(.06, .1, .04), rockc=(.42, .4, .36),
                     fieldc=[(.4, .34, .16), (.24, .28, .11), (.34, .28, .15)],
                     trees=[('umbrella', .7), ('cypress', .3)], wall=ROMAN_WALLS, roof=TILE, thatch=TILE,
                     mounds=[(10, 3300, 480, 40), (26, 3100, 400, 36), (18, 3900, 560, 44), (36, 3700, 420, 32)],
                     sun=(282, 16, 4.4, (1, .8, .58)), sky=((.6, .56, .55), .45),
                     landmarks=[('city', 20, 3400, {'radius': 1100}), ('aurelian', 20, 2250, {'arc': 64}),
                                ('aqueduct', 0, 0, {'path': [(115, 7000), (82, 2300), (52, 1600)]}),
                                ('aqueduct', 0, 0, {'path': [(135, 6000), (100, 1700), (68, 1250)]}),
                                ('tombs', 200, 1300, {'n': 14, 'roman': True}), ('pines', 230, 1500, {'n': 80}), ('pines', 330, 1600, {'n': 80}),
                                ('pines', 60, 1100, {'n': 50}), ('camp', 300, 2100, {'tents': 220, 'roman': True}), ('villa', 160, 2000, {})]),
}

# Tree shapes: crown radii and height (times a size of about 1), the crown
# centre's height, a trunk (height, width) and a tint on the region's foliage.
TREES = {
    'broadleaf': dict(crown=(5.5, 5.5, 5), lift=6, trunk=None, tint=(1, 1, 1)),
    'conifer': dict(crown=(3, 3, 8), lift=7, trunk=None, tint=(.8, .95, .9)),
    'willow': dict(crown=(5.5, 5.5, 4.2), lift=4.5, trunk=None, tint=(1.5, 1.35, 1.2)),
    'poplar': dict(crown=(2.4, 2.4, 10), lift=9, trunk=None, tint=(1, 1.05, 1)),
    'cypress': dict(crown=(1.6, 1.6, 8), lift=7, trunk=None, tint=(.85, .95, .9)),
    'umbrella': dict(crown=(7, 7, 2.2), lift=12, trunk=(11, .6), tint=(1, 1, 1)),
    'palm': dict(crown=(4.2, 4.2, 1.6), lift=12, trunk=(12, .7), tint=(1.2, 1.1, 1)),
}


def value_noise(x, y, seed, scale):
    """Smooth value noise in [0, 1] over arrays of metres."""
    gx, gy = x / scale, y / scale
    ix, iy = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    fx, fy = gx - ix, gy - iy
    ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def lattice(a, b):
        h = (a * 374761393 + b * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
        return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0
    a, b = lattice(ix, iy), lattice(ix + 1, iy)
    c, d = lattice(ix, iy + 1), lattice(ix + 1, iy + 1)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy


def fbm(x, y, seed, scale, octaves=5):
    total, weight, amplitude = 0.0, 0.0, 1.0
    for k in range(octaves):
        total = total + value_noise(x, y, seed + k * 101, scale / (2 ** k)) * amplitude
        weight += amplitude
        amplitude *= .5
    return total / weight


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def bearing_of(x, y):
    """Degrees clockwise from north."""
    return np.degrees(np.arctan2(x, y)) % 360


def at(bearing, distance):
    b = math.radians(bearing)
    return distance * math.sin(b), distance * math.cos(b)


def arc(b, centre, half):
    """1 well inside the arc of `half` degrees either side of `centre`, easing to 0 at its ends."""
    off = np.abs((b - centre + 180) % 360 - 180)
    return smooth((half - off) / (half * .45))


def river_course(r, x, y):
    """Distance from a river's centreline, its width and its water level, for points (x, y)."""
    kind = r.get('river')
    if kind in ('danube', 'marsh'):
        # East-west across the north, from where the game's own river leaves its ridges.
        out = np.maximum(np.abs(x) - 510, 0)
        wide = 1.0 if kind == 'danube' else .35
        centre = 62 + out * .07 + np.sin(x / 2300 + 1.3) * np.minimum(out * .09, 900 * wide)
        width = 26 + out * .05 * wide
        offset = np.abs(y - centre)
    elif kind == 'euphrates':
        # North-south through the eastern valley.
        centre = 1900 + np.sin(y / 3100) * 420 + np.sin(y / 900) * 60
        width = 360 + 0 * y
        offset = np.abs(x - centre)
    else:
        return None
    d = np.hypot(x, y)
    rise = smooth((d - START - 30) / 1200)
    level = -15 * (1 - rise) + (r.get('river_base', 0) - 1.2) * rise - d * d / (2 * EARTH)
    return offset, width, level


POOLS = {}


def pool_sites(r):
    """Marsh pools: (x, y, radius, water level), each set just below its own ground."""
    if r['seed'] not in POOLS:
        rng = np.random.default_rng(r['seed'] + 400)
        sites = []
        for _ in range(r.get('pools', 0)):
            b, dist = rng.uniform(0, 360), rng.uniform(900, 6000)
            x, y = at(b, dist)
            radius = rng.uniform(80, 420) * (dist / 2500) ** .5
            a = np.linspace(0, 2 * math.pi, 9)
            rim = terrain_height(r, x + radius * np.cos(a), y + radius * np.sin(a), pools=False)
            sites.append((x, y, radius, float(rim.min()) - .6))
        POOLS[r['seed']] = sites
    return POOLS[r['seed']]


def terrain_height(r, x, y, pools=True):
    """Ground height for points 620 m out and beyond (metres, with the earth's curve)."""
    seed = r['seed']
    d = np.hypot(x, y)
    b = bearing_of(x, y)
    rise = smooth((d - START - 30) / 1200)
    near = (fbm(x, y, seed, 1300, 4) - .47) * r['near']
    hills = fbm(x, y, seed + 3, 3400, 5)
    ridged = (1 - np.abs(fbm(x, y, seed + 7, 2800, 4) * 2 - 1)) ** 2
    mid = (hills * (1 - r['ridge']) + ridged * r['ridge']) * r['mid'] * smooth((d - 900) / 2200)
    if r.get('mesa'):
        # Flat-topped buttes with cliff edges, some with a second tier.
        butte = fbm(x, y, seed + 41, 2200, 4)
        tops = smooth((butte - .6) / .025) + .55 * smooth((butte - .68) / .02)
        mid = (tops + hills * .15) * r['mid'] * smooth((d - 900) / 1200)
    for centre, half, flatness in r.get('plains', []):
        flat = arc(b, centre, half) * flatness
        near, mid = near * (1 - flat * .8), mid * (1 - flat)
    course = river_course(r, x, y)
    if course is not None:
        # The river's floodplain: flat ground either side of the water.
        offset, width, _ = course
        plain = smooth(1 - (offset - width / 2) / (width * 1.5 + 450))
        near, mid = near * (1 - .85 * plain), mid * (1 - plain)
    far = np.zeros_like(d)
    for centre, half, height, start, *sharp in r.get('ranges', []):
        crest = (1 - np.abs(fbm(x, y, seed + 31, 5200, 6) * 2 - 1)) ** (sharp[0] if sharp else 1.8)
        massif = smooth(fbm(x, y, seed + 37, 14000, 3) * 2.2 - .55)
        far = far + height * crest * (.3 + .7 * massif) * smooth((d - start) / (start * .6)) * arc(b, centre, half)
    h = (near + mid) * rise - 15 * (1 - rise) + far - d * d / (2 * EARTH)
    for centre, half, depth in r.get('valleys', []):
        h = h - depth * arc(b, centre, half) * smooth((d - 900) / 700)
    for bearing, distance, radius, height in r.get('mounds', []):
        mx, my = at(bearing, distance)
        h = h + height * smooth(1.15 - np.hypot(x - mx, y - my) / radius)
    if course is not None:
        offset, width, level = course
        # The channel below the water, its banks rising gently to the plain.
        h = np.minimum(h, level - 2.5 + np.maximum(offset - width / 2, 0) * .05)
    if pools:
        for px, py, radius, level in pool_sites(r):
            dist = np.hypot(x - px, y - py)
            h = np.where(dist < radius * 1.6, np.minimum(h, level - 1 + np.maximum(dist - radius, 0) * .05), h)
    return h


def haze_group():
    """Surfaces fade toward the neutral haze with view distance (aerial perspective)."""
    group = bpy.data.node_groups.new('Imperium haze', 'ShaderNodeTree')
    group.interface.new_socket('Shader', in_out='INPUT', socket_type='NodeSocketShader')
    group.interface.new_socket('Shader', in_out='OUTPUT', socket_type='NodeSocketShader')
    nodes, links = group.nodes, group.links
    inp, out = nodes.new('NodeGroupInput'), nodes.new('NodeGroupOutput')
    cam = nodes.new('ShaderNodeCameraData')
    curve = nodes.new('ShaderNodeMath'); curve.operation = 'MULTIPLY'; curve.inputs[1].default_value = -1 / HAZE_DISTANCE
    exp = nodes.new('ShaderNodeMath'); exp.operation = 'EXPONENT'
    fade = nodes.new('ShaderNodeMath'); fade.operation = 'SUBTRACT'; fade.inputs[0].default_value = 1.0
    keep = nodes.new('ShaderNodeMath'); keep.operation = 'MULTIPLY'; keep.inputs[1].default_value = HAZE_MAX
    emit = nodes.new('ShaderNodeEmission'); emit.inputs['Color'].default_value = (*HAZE, 1); emit.inputs['Strength'].default_value = 1.0
    mix = nodes.new('ShaderNodeMixShader')
    links.new(cam.outputs['View Distance'], curve.inputs[0])
    links.new(curve.outputs[0], exp.inputs[0])
    links.new(exp.outputs[0], fade.inputs[1])
    links.new(fade.outputs[0], keep.inputs[0])
    links.new(keep.outputs[0], mix.inputs['Fac'])
    links.new(inp.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])
    return group


def material(name, haze, roughness):
    """A surface coloured by its mesh's `cover` attribute, under the haze."""
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = roughness
    attr = nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'cover'
    links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    fog = nodes.new('ShaderNodeGroup'); fog.node_tree = haze
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(bsdf.outputs[0], fog.inputs[0])
    links.new(fog.outputs[0], out.inputs['Surface'])
    return mat


def shape(faces):
    """Faces as flat loop indices and sizes."""
    return np.array([i for f in faces for i in f], dtype=np.int64), np.array([len(f) for f in faces], dtype=np.int64)


def mesh_object(name, verts, loops, sizes, mat, colours, smooth_shading=False):
    """A mesh straight from arrays (Blender's own builder is slow at a million faces)."""
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set('co', np.asarray(verts, dtype=np.float32).ravel())
    mesh.loops.add(len(loops))
    mesh.loops.foreach_set('vertex_index', np.asarray(loops, dtype=np.int32))
    mesh.polygons.add(len(sizes))
    mesh.polygons.foreach_set('loop_start', (np.cumsum(sizes) - sizes).astype(np.int32))
    mesh.update(calc_edges=True)
    layer = mesh.color_attributes.new('cover', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([np.asarray(colours, dtype=np.float32), np.ones((len(verts), 1), dtype=np.float32)], axis=1)
    layer.data.foreach_set('color', rgba.ravel())
    if smooth_shading:
        mesh.shade_smooth()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# Unit shapes: a box standing on its base, a pitched roof along X.
CUBE = np.array([[-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0], [-.5, -.5, 1], [.5, -.5, 1], [.5, .5, 1], [-.5, .5, 1]])
CUBE_SHAPE = shape([[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
ROOF = np.array([[-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0], [-.5, 0, 1], [.5, 0, 1]])
ROOF_SHAPE = shape([[0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4]])
ICO = None  # an icosphere (two levels), read from Blender once


class Parts:
    """Shapes gathered into one mesh per surface: thousands of separate objects take Blender minutes."""

    def __init__(self, key):
        self.key, self.meshes = key, {}

    def add(self, verts, faces, colours, surface='matte'):
        """`verts` (n, 3), or (count, n, 3) for many copies of one shape; colours one or one per copy."""
        loops, sizes = faces
        verts = np.asarray(verts, dtype=float)
        copies = verts.reshape(-1, verts.shape[-2], 3) if verts.ndim == 3 else verts[None]
        count, n = copies.shape[0], copies.shape[1]
        entry = self.meshes.setdefault(surface, {'verts': [], 'loops': [], 'sizes': [], 'colours': [], 'n': 0})
        entry['verts'].append(copies.reshape(-1, 3))
        entry['loops'].append((loops[None, :] + entry['n'] + n * np.arange(count)[:, None]).ravel())
        entry['sizes'].append(np.tile(sizes, count))
        colours = np.asarray(colours, dtype=float).reshape(-1, 3)
        entry['colours'].append(np.repeat(np.broadcast_to(colours, (count, 3)), n, axis=0))
        entry['n'] += count * n

    def finish(self, materials):
        for surface, entry in self.meshes.items():
            mesh_object(self.key + ' ' + surface, np.concatenate(entry['verts']), np.concatenate(entry['loops']),
                        np.concatenate(entry['sizes']), materials[surface], np.concatenate(entry['colours']))
        return sum(entry['n'] for entry in self.meshes.values())


def turn(v, angle):
    c, s = math.cos(angle), math.sin(angle)
    out = np.array(v, dtype=float)
    out[..., 0], out[..., 1] = v[..., 0] * c - v[..., 1] * s, v[..., 0] * s + v[..., 1] * c
    return out


def shade(colour, rng, amount=.12):
    if isinstance(colour, list):
        colour = colour[rng.integers(len(colour))]
    k = 1 + rng.uniform(-amount, amount)
    return tuple(max(0.0, min(1.0, c * k)) for c in colour)


class Builder:
    """Landmarks and trees on the region's ground."""

    def __init__(self, r, parts, rng):
        self.r, self.parts, self.rng = r, parts, rng
        self.count = 0

    def ground(self, x, y, w=0, d=0, angle=0):
        """The lowest ground under a footprint, so nothing floats."""
        pts = [(x, y)]
        if w or d:
            for sx, sy in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)):
                dx, dy = sx * w, sy * d
                pts.append((x + dx * math.cos(angle) - dy * math.sin(angle), y + dx * math.sin(angle) + dy * math.cos(angle)))
        xs, ys = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        return float(np.min(terrain_height(self.r, xs, ys))) - .4

    def place(self, x, y, dx, dy, angle):
        return x + dx * math.cos(angle) - dy * math.sin(angle), y + dx * math.sin(angle) + dy * math.cos(angle)

    def box(self, x, y, w, d, h, colour, z=None, angle=0.0, surface='matte'):
        z = self.ground(x, y, w, d, angle) if z is None else z
        self.parts.add(turn(CUBE * (w, d, h), angle) + (x, y, z), CUBE_SHAPE, colour, surface)
        return z + h

    def roof(self, x, y, w, d, rise, colour, z, angle=0.0):
        self.parts.add(turn(ROOF * (w, d, rise), angle) + (x, y, z), ROOF_SHAPE, colour)

    def drum(self, x, y, rx, ry, h, colour, z=None, n=24, angle=0.0):
        z = self.ground(x, y, rx * 2, ry * 2) if z is None else z
        a = np.linspace(0, 2 * math.pi, n, endpoint=False)
        ring = np.stack([rx * np.cos(a), ry * np.sin(a), np.zeros(n)], axis=1)
        faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)] + [list(range(n, 2 * n))]
        self.parts.add(turn(np.concatenate([ring, ring + (0, 0, h)]), angle) + (x, y, z), shape(faces), colour)
        return z + h

    def house(self, x, y, w, d, h, wall, roof, angle, flat=False):
        top = self.box(x, y, w, d, h, shade(wall, self.rng), angle=angle)
        if flat:
            self.box(x, y, w + .6, d + .6, .6, shade(wall, self.rng, .2), z=top, angle=angle)
        else:
            self.roof(x, y, w + 1, d + 1, d * .42, shade(roof, self.rng), top, angle)
        self.count += 1

    def trees(self, xs, ys, styles, zs=None):
        """Many trees at once: crowns (and trunks) of each style in one batch."""
        xs, ys = np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)
        zs = terrain_height(self.r, xs, ys) - .3 if zs is None else np.asarray(zs, dtype=float)
        styles = np.asarray(styles)
        for style in np.unique(styles):
            k = np.flatnonzero(styles == style)
            spec = TREES[str(style)]
            size = self.rng.uniform(.8, 1.25, len(k))
            tint = np.array(spec['tint']) * np.array(self.r['wood'])
            colours = np.clip(tint[None, :] * (1 + self.rng.uniform(-.25, .25, (len(k), 1))), 0, 1)
            centres = np.stack([xs[k], ys[k], zs[k] + spec['lift'] * size], axis=1)
            crowns = ICO[0][None, :, :] * (np.array(spec['crown'])[None, None, :] * size[:, None, None]) + centres[:, None, :]
            self.parts.add(crowns, ICO[1], colours)
            if spec['trunk']:
                tall, width = spec['trunk']
                trunks = CUBE[None, :, :] * np.array([width, width, tall])[None, None, :] * np.stack([np.ones_like(size), np.ones_like(size), size], axis=1)[:, None, :]
                trunks = trunks + np.stack([xs[k], ys[k], zs[k]], axis=1)[:, None, :]
                self.parts.add(trunks, CUBE_SHAPE, (.2, .15, .1))
        return len(xs)

    def scatter(self, x, y, n, spread, style):
        xs, ys = x + self.rng.normal(0, spread[0], n), y + self.rng.normal(0, spread[1], n)
        keep = np.hypot(xs, ys) > START + 300
        return self.trees(xs[keep], ys[keep], [style] * int(keep.sum()))

    # Settlements -----------------------------------------------------------
    def village(self, x, y, n=36, spread=170, tiled=False, flat=False, **_):
        r = self.r
        for _ in range(n):
            hx, hy = x + self.rng.normal(0, spread), y + self.rng.normal(0, spread * .7)
            self.house(hx, hy, self.rng.uniform(8, 16), self.rng.uniform(6, 10), self.rng.uniform(3, 5),
                       r['wall'], r['roof'] if tiled else r['thatch'], self.rng.uniform(0, math.pi), flat=flat)

    def huts(self, x, y, n=14, **_):
        for _ in range(n):
            hx, hy, angle = x + self.rng.normal(0, 90), y + self.rng.normal(0, 60), self.rng.uniform(0, math.pi)
            top = self.box(hx, hy, 6, 5, 2.4, shade(TIMBER, self.rng), angle=angle)
            self.roof(hx, hy, 7, 6, 3.2, shade(THATCH, self.rng), top, angle)
            self.count += 1

    def palisade(self, x, y, size=120, **_):
        angle = self.rng.uniform(0, math.pi)
        self.fortwalls(x, y, size, size, 4, 5, angle, colour=TIMBER, spacing=12, tower=1.2)
        for _ in range(10):
            self.house(x + self.rng.normal(0, size * .2), y + self.rng.normal(0, size * .2), 9, 6, 2.8, TIMBER, THATCH, angle)

    def villa(self, x, y, **_):
        r, angle = self.r, self.rng.uniform(0, math.pi)
        for dx, dy, w, d in ((0, 0, 46, 14), (-20, 18, 12, 30), (20, 18, 12, 30), (0, -26, 30, 10)):
            self.house(*self.place(x, y, dx, dy, angle), w, d, 6, r['wall'], r['roof'], angle)
        self.scatter(x, y, 12, (50, 50), 'cypress' if r['roof'] is TILE else 'broadleaf')

    def mansio(self, x, y, **_):
        r, angle = self.r, self.rng.uniform(0, math.pi)
        for dx, dy, w, d in ((0, -24, 56, 10), (0, 24, 56, 10), (-24, 0, 10, 38), (24, 0, 10, 38), (52, 0, 30, 12), (52, 22, 24, 9)):
            self.house(*self.place(x, y, dx, dy, angle), w, d, 7, r['wall'], r['roof'], angle)
        self.village(x - 140, y + 60, n=12, spread=60, tiled=True)

    def granary(self, x, y, **_):
        angle = self.rng.uniform(0, math.pi)
        for k in (-1, 1):
            px, py = self.place(x, y, k * 30, 0, angle)
            top = self.box(px, py, 52, 20, 11, shade(STONE, self.rng), angle=angle)
            self.roof(px, py, 54, 22, 7, shade(TILE, self.rng), top, angle)
        self.fortwalls(x, y, 150, 120, 6, 9, angle)
        self.village(x + 260, y - 120, n=20, spread=110)

    def fortwalls(self, x, y, w, d, wall_h, tower_h, angle, colour=STONE, spacing=36, tower=7):
        corners = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            side = math.atan2(by - ay, bx - ax)
            steps = max(1, int(math.hypot(bx - ax, by - ay) // spacing))
            for k in range(steps + 1):
                t = k / steps
                self.box(*self.place(x, y, ax + (bx - ax) * t, ay + (by - ay) * t, angle), tower, tower, tower_h, shade(colour, self.rng, .06), angle=angle + side)
                if k < steps:
                    t2 = (k + .5) / steps
                    self.box(*self.place(x, y, ax + (bx - ax) * t2, ay + (by - ay) * t2, angle), math.hypot(bx - ax, by - ay) / steps, 3, wall_h,
                             shade(colour, self.rng, .06), angle=angle + side)

    def fort(self, x, y, **_):
        r, angle = self.r, self.rng.uniform(0, math.pi)
        self.fortwalls(x, y, 170, 210, 7, 11, angle)
        for row in range(-3, 4):
            for col in (-1, 1):
                self.house(*self.place(x, y, col * 42, row * 26, angle), 54, 9, 4.5, r['wall'], TILE, angle)
        self.house(x, y, 34, 30, 8, LIMESTONE, TILE, angle)
        self.village(*self.place(x, y, 230, 120, angle), n=22, spread=90)

    def watchtower(self, x, y, **_):
        angle = self.rng.uniform(0, math.pi)
        top = self.box(x, y, 6, 6, 11, shade(STONE, self.rng), angle=angle)
        self.roof(x, y, 7.5, 7.5, 3, shade(TILE if self.r['roof'] is TILE else THATCH, self.rng), top, angle)
        self.fortwalls(x, y, 30, 30, 3, 3.4, angle, colour=TIMBER, spacing=10, tower=1)
        self.count += 1

    def camp(self, x, y, tents=200, roman=False, size=1.0, **_):
        angle = self.rng.uniform(0, math.pi)
        cols = int(math.sqrt(tents * 1.6))
        k = size
        for i in range(tents):
            gx, gy = (i % cols - cols / 2) * 11 * k + self.rng.normal(0, 1.5), (i // cols - tents / cols / 2) * 13 * k + self.rng.normal(0, 1.5)
            px, py = self.place(x, y, gx, gy, angle)
            self.roof(px, py, 5 * k, 4.5 * k, 3 * k, shade(TENT if roman else [(.6, .5, .36), (.5, .2, .12), (.62, .56, .44)], self.rng, .1), self.ground(px, py), angle)
        size = max(cols * 11, tents / cols * 13) * k + 40
        if roman:
            self.fortwalls(x, y, size, size, 3, 3.5, angle, colour=(.32, .26, .16), spacing=24, tower=1.5)
        for _ in range(8):
            px, py = x + self.rng.normal(0, size * .3), y + self.rng.normal(0, size * .3)
            top = self.box(px, py, .5, .5, 9, SHADOW)
            self.box(px + 1.4, py, 2.6, .3, 1.8, (.45, .08, .05) if roman else (.42, .3, .1), z=top - 2.4)
        self.count += 1

    def ruin(self, x, y, **_):
        for _ in range(14):
            self.box(x + self.rng.normal(0, 120), y + self.rng.normal(0, 80), self.rng.uniform(6, 20), self.rng.uniform(2, 8), self.rng.uniform(2, 9),
                     shade(MUDBRICK, self.rng), angle=self.rng.uniform(0, math.pi))
        for _ in range(3):
            self.box(x + self.rng.normal(0, 100), y + self.rng.normal(0, 70), 8, 8, self.rng.uniform(10, 16), shade(MUDBRICK, self.rng))
        self.count += 1

    def tombs(self, x, y, n=12, roman=False, **_):
        for _ in range(n):
            px, py = x + self.rng.normal(0, 260), y + self.rng.normal(0, 200)
            if roman:
                self.drum(px, py, 9, 9, self.rng.uniform(6, 11), shade(LIMESTONE, self.rng))
            else:
                base = self.box(px, py, 10, 10, 3, shade(LIMESTONE, self.rng))
                self.box(px, py, 8, 8, self.rng.uniform(16, 27), shade(LIMESTONE, self.rng), z=base)
            self.count += 1

    def palms(self, x, y, n=600, spread=(500, 1500), **_):
        self.scatter(x, y, n, spread, 'palm')

    def riverpalms(self, x, y, n=2400, **_):
        """Palm groves along the river's banks, for some kilometres either way."""
        ys = self.rng.uniform(-6000, 8000, n)
        centre = 1900 + np.sin(ys / 3100) * 420 + np.sin(ys / 900) * 60
        side = np.where(self.rng.uniform(0, 1, n) < .5, -1, 1)
        xs = centre + side * (190 + np.abs(self.rng.normal(0, 260, n)))
        keep = np.hypot(xs, ys) > START + 300
        self.trees(xs[keep], ys[keep], ['palm'] * int(keep.sum()))

    def gardens(self, x, y, n=600, **_):
        """Pines and cypresses among the houses nearest the camera."""
        a, d = self.rng.uniform(0, 2 * math.pi, n), self.rng.uniform(START + 60, 1500, n)
        styles = np.where(self.rng.uniform(0, 1, n) < .6, 'umbrella', 'cypress')
        self.trees(d * np.sin(a), d * np.cos(a), styles)

    def poplars(self, x, y, **_):
        angle = self.rng.uniform(0, math.pi)
        pts = [self.place(x, y, (i - 20) * 9, (row - 2) * 140, angle) for row in range(5) for i in range(40)]
        self.trees([p[0] for p in pts], [p[1] for p in pts], ['poplar'] * len(pts))

    def pines(self, x, y, n=60, **_):
        self.scatter(x, y, n, (240, 180), 'umbrella')

    # Cities and monuments ---------------------------------------------------
    def roofs(self, x, y, radius, n, tall=(9, 20), clear=START + 30):
        """A city's houses and insulae within `radius` of (x, y), none nearer the camera than `clear`."""
        r = self.r
        placed = 0
        while placed < n:
            a, d = self.rng.uniform(0, 2 * math.pi), radius * math.sqrt(self.rng.uniform(0, 1))
            px, py = x + d * math.cos(a), y + d * math.sin(a)
            if math.hypot(px, py) < clear:
                continue
            angle = self.rng.choice([0, math.pi / 2]) + self.rng.normal(0, .08)
            w, d2, h = self.rng.uniform(12, 30), self.rng.uniform(10, 22), self.rng.uniform(*tall)
            if self.rng.random() < .55:
                self.house(px, py, w, d2, h, r['wall'], r['roof'], angle)
            else:
                top = self.box(px, py, w, d2, h, shade(r['wall'], self.rng), angle=angle)
                self.box(px, py, w * .92, d2 * .92, 1.4, shade(TILE, self.rng), z=top, angle=angle)
            placed += 1

    def city(self, x, y, radius=1400, **_):
        self.roofs(x, y, radius, 2600)
        for _ in range(5):
            a, d = self.rng.uniform(0, 2 * math.pi), radius * .5 * self.rng.uniform(0, 1)
            self.temple(x + d * math.cos(a), y + d * math.sin(a), size=self.rng.uniform(1, 1.5))
        self.colosseum(x + radius * .25, y - radius * .3)
        self.scatter(x, y, 120, (radius * .7, radius * .7), 'umbrella')

    def walled(self, x, y, radius=650, **_):
        n = int(2 * math.pi * radius / 34)
        for k in range(n):
            a = k / n * 2 * math.pi
            px, py = x + radius * math.cos(a), y + radius * math.sin(a)
            self.box(px, py, 34, 3, 9, shade(STONE, self.rng, .05), angle=a + math.pi / 2)
            if k % 2 == 0:
                self.box(px, py, 8, 8, 15, shade(STONE, self.rng, .05), angle=a)
        self.roofs(x, y, radius * .92, 900, tall=(7, 15))
        for _ in range(3):
            a, d = self.rng.uniform(0, 2 * math.pi), radius * .4 * self.rng.uniform(0, 1)
            self.temple(x + d * math.cos(a), y + d * math.sin(a))

    def rome(self, x, y, **_):
        # Low houses among gardens nearest, insulae beyond on every side, thinning past the wall.
        self.roofs(0, 0, 1150, 260, tall=(5, 9))
        self.roofs(0, 0, 2550, 4600, tall=(10, 22), clear=1100)
        self.roofs(0, 0, 4200, 500, tall=(5, 9), clear=2700)

    def temple(self, x, y, size=1.0, **_):
        angle = self.rng.uniform(0, math.pi)
        w, d = 36 * size, 22 * size
        top = self.box(x, y, w, d, 4 * size, shade(MARBLE, self.rng, .05), angle=angle)
        for side in (-1, 1):
            for i in range(8):
                self.box(*self.place(x, y, (i - 3.5) * w / 8.5, side * d * .42, angle), 1.6 * size, 1.6 * size, 13 * size, shade(MARBLE, self.rng, .04), z=top, angle=angle)
        self.box(x, y, w * .7, d * .55, 13 * size, shade(MARBLE, self.rng, .04), z=top, angle=angle)
        cap = self.box(x, y, w + 1, d + 1, 2.4 * size, shade(MARBLE, self.rng, .04), z=top + 13 * size, angle=angle)
        self.roof(x, y, w + 1.4, d + 1.4, 5 * size, shade(TILE, self.rng), cap, angle)
        self.count += 1

    def colosseum(self, x, y, **_):
        z = self.ground(x, y, 190, 160)
        self.drum(x, y, 94, 78, 48, shade(LIMESTONE, self.rng, .03), z=z, n=72)
        # Its arcades: three tiers of dark openings.
        for tier in range(3):
            for k in range(80):
                a = k / 80 * 2 * math.pi
                self.box(x + 94.6 * math.cos(a), y + 78.6 * math.sin(a), 3.2, .8, 6.5, SHADOW, z=z + 3 + tier * 11.5,
                         angle=math.atan2(78 * math.cos(a), -94 * math.sin(a)))
        self.count += 1

    def palatine(self, x, y, **_):
        # The palaces on the hill's summit: terraces, halls and arcades.
        for _ in range(30):
            self.house(x + self.rng.normal(0, 90), y + self.rng.normal(0, 70), self.rng.uniform(25, 60), self.rng.uniform(18, 40),
                       self.rng.uniform(14, 26), PLASTER, TILE, self.rng.normal(0, .05))
        self.scatter(x, y, 30, (110, 110), 'umbrella')

    def pantheon(self, x, y, **_):
        z = self.ground(x, y, 60, 60)
        top = self.drum(x, y, 29, 29, 30, shade(PLASTER, self.rng), z=z, n=40)
        for k in range(6):
            radius = 29 * math.cos((k + 1) / 6 * math.pi / 2) + .1
            self.drum(x, y, radius, radius, 29 / 6, shade((.5, .48, .44), self.rng, .02), z=top + 29 * math.sin(k / 6 * math.pi / 2), n=40)
        self.box(x - 40, y, 22, 34, 20, shade(MARBLE, self.rng))
        self.count += 1

    def aurelian(self, x, y, arc=360, **_):
        """Aurelian's wall: a curtain with a tower every 30 m, on a circle round the centre (or an arc of it)."""
        if arc >= 360:
            radius, start, span = 2600, 0, 360
        else:
            radius, span = math.hypot(x, y), arc
            start = float(bearing_of(np.array(x), np.array(y))) - arc / 2
        n = int(2 * math.pi * radius * span / 360 / 30)
        for k in range(n):
            b = start + span * k / n
            px, py = at(b, radius + math.sin(math.radians(b) * 7.1) * 120)
            angle = -math.radians(b)
            self.box(px, py, 30.5, 3.6, 8, shade(MUDBRICK, self.rng, .05), angle=angle)
            self.box(px + 15 * math.cos(angle), py + 15 * math.sin(angle), 7.6, 7.6, 14, shade(MUDBRICK, self.rng, .05), angle=angle)
        self.count += 1

    def aqueduct(self, x, y, path=(), **_):
        points = [at(b, d) for b, d in path]
        walked = 0.0
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            length = math.hypot(bx - ax, by - ay)
            angle = math.atan2(by - ay, bx - ax)
            n = int(length / 7)
            for k in range(n):
                t = (k + .5) / n
                px, py = ax + (bx - ax) * t, ay + (by - ay) * t
                z = self.ground(px, py)
                top = 34 - .0006 * (walked + length * t)
                self.box(px, py, 3, 3, max(2, top - z), shade(MUDBRICK, self.rng, .05), z=z, angle=angle)
                self.box(px, py, 7.2, 3.2, 3.2, shade(MUDBRICK, self.rng, .05), z=max(z + 2, top), angle=angle)
            walked += length
        self.count += 1

    def palmyra(self, x, y, **_):
        angle = math.radians(20)
        # The great colonnade, its tetrapylon, and houses on both sides.
        for i in range(160):
            for side in (-1, 1):
                self.box(*self.place(x, y, (i - 80) * 7, side * 11, angle), 1.4, 1.4, 10, shade(LIMESTONE, self.rng, .04), angle=angle)
        self.box(x, y, 16, 16, 15, shade(LIMESTONE, self.rng, .03), angle=angle)
        self.roofs(x, y, 650, 700, tall=(4, 8))
        # The temple of Bel in its walled court.
        bx, by = self.place(x, y, 700, -180, angle)
        self.fortwalls(bx, by, 205, 210, 16, 18, angle, colour=LIMESTONE, spacing=40)
        self.temple(bx, by, size=1.5)
        self.scatter(x, y - 500, 160, (500, 220), 'palm')
        self.count += 1

    def build(self, kind, bearing, distance, options):
        getattr(self, kind)(*at(bearing, distance), **options)


def forest_trees(r, builder, rng):
    """Trees on the forest mask from 0.7 to 4.5 km, and lone trees over open ground."""
    n = 90000
    radius = np.sqrt(rng.uniform(700 ** 2, 4500 ** 2, n))
    bearing = rng.uniform(0, 360, n)
    x, y = radius * np.sin(np.radians(bearing)), radius * np.cos(np.radians(bearing))
    forest = fbm(x, y, r['seed'] + 3, 1600, 4) > 1 - r['forest']
    lone = rng.uniform(0, 1, n) < r.get('lone', 0)
    keep = np.flatnonzero(forest | lone)[:42000]
    course = river_course(r, x[keep], y[keep])
    if course is not None:
        keep = keep[course[0] > course[1] / 2 + 15]
    if not len(keep):
        return 0
    styles = [s for s, _ in r['trees']]
    shares = np.array([w for _, w in r['trees']], dtype=float)
    picks = np.array(styles)[rng.choice(len(styles), size=len(keep), p=shares / shares.sum())]
    return builder.trees(x[keep], y[keep], picks)


def river_strip(r, parts):
    """The water along the river's course, from the game's ridges to the far horizon."""
    kind = r['river']
    if kind == 'euphrates':
        ys = np.concatenate([-np.geomspace(45000, 200, 160), np.geomspace(200, 45000, 160)])
        centre = 1900 + np.sin(ys / 3100) * 420 + np.sin(ys / 900) * 60
        left, right = np.stack([centre - 180, ys], axis=1), np.stack([centre + 180, ys], axis=1)
        runs = [(left, right)]
    else:
        runs = []
        for sign in (-1, 1):
            xs = sign * (1100 + np.geomspace(1, 45000, 220))
            out = np.maximum(np.abs(xs) - 510, 0)
            wide = 1.0 if kind == 'danube' else .35
            centre = 62 + out * .07 + np.sin(xs / 2300 + 1.3) * np.minimum(out * .09, 900 * wide)
            width = 26 + out * .05 * wide
            runs.append((np.stack([xs, centre - width / 2], axis=1), np.stack([xs, centre + width / 2], axis=1)))
    for left, right in runs:
        n = len(left)
        pts = np.concatenate([left, right])
        _, _, level = river_course(r, pts[:, 0], pts[:, 1])
        verts = np.column_stack([pts, level + 1.6])
        faces = [[i, i + 1, n + i + 1, n + i] for i in range(n - 1)]
        parts.add(verts, shape(faces), WATER, 'water')


def build_region(key, r, materials, rng):
    # Terrain: a polar grid, dense near and sparse far, out to 45 km.
    rings = np.concatenate([np.linspace(START, 3000, 130, endpoint=False), np.geomspace(3000, 12000, 90, endpoint=False), np.geomspace(12000, 45000, 60)])
    angles = np.linspace(0, 2 * math.pi, 4096, endpoint=False)
    rr, aa = np.meshgrid(rings, angles, indexing='ij')
    x, y = rr * np.sin(aa), rr * np.cos(aa)
    h = terrain_height(r, x, y)
    seed = r['seed']
    # Cover: land and dry ground, fields near, forest, bare rock and snow.
    slope = np.abs(np.gradient(h, axis=0)) / np.gradient(rings)[:, None]
    tone = fbm(x, y, seed + 13, 600, 3)[..., None]
    colour = np.array(r['land']) * (1 - tone) + np.array(r['dry']) * tone
    if r['fieldc']:
        fields = (fbm(x, y, seed + 5, 1500, 3) < r['fields']) & (slope < .12) & (rr < 14000)
        patch = np.floor(value_noise(x + 37 * np.sin(y / 90), y, seed + 17, 160) * len(r['fieldc']) * .999).astype(int)
        palette = np.array(r['fieldc'])[patch] * (.9 + value_noise(x, y, seed + 19, 70)[..., None] * .2)
        colour = np.where(fields[..., None], palette, colour)
    forest = (fbm(x, y, seed + 3, 1600, 4) > 1 - r['forest']) & (slope < .6)
    # Bare rock on steep ground, and on rocky ground as it steepens, blended in.
    rocky = np.clip(smooth((slope - .22) / .25) + smooth((r['rock'] * .6 - fbm(x, y, seed + 9, 700, 3)) / .1) * smooth((slope - .05) / .15), 0, 1)[..., None]
    colour = colour * (1 - rocky) + np.array(r['rockc']) * (.85 + tone * .3) * rocky
    colour = np.where(forest[..., None], np.array(r['wood']) * (.75 + tone * .5), colour)
    if r.get('snow'):
        line = r['snow'] + (fbm(x, y, seed + 23, 900, 4) - .5) * 700
        snow = (h > line) & (slope < .9)
        colour = np.where(snow[..., None], np.array([.8, .82, .86]) * (.92 + tone * .1), colour)
    course = river_course(r, x, y)
    if course is not None:
        colour = np.where((course[0] < course[1] / 2 + 30)[..., None], np.array(r['land']) * .7, colour)
    n_r, n_a = rr.shape
    idx = np.arange(n_r * n_a).reshape(n_r, n_a)
    a0, a1 = idx[:-1, :], np.roll(idx, -1, axis=1)[:-1, :]
    b0, b1 = idx[1:, :], np.roll(idx, -1, axis=1)[1:, :]
    loops = np.stack([a0, a1, b1, b0], axis=-1).ravel()
    mesh_object(key + ' terrain', np.stack([x.ravel(), y.ravel(), h.ravel()], axis=1), loops, np.full(len(loops) // 4, 4),
                materials['matte'], colour.reshape(-1, 3), smooth_shading=True)
    stats = {'terrainVertices': int(n_r * n_a), 'terrainFaces': int(len(loops) // 4)}
    parts = Parts(key)
    builder = Builder(r, parts, rng)
    if course is not None:
        stats['river'] = r['river']
        river_strip(r, parts)
    pools = pool_sites(r)
    for px, py, radius, level in pools:
        a = np.linspace(0, 2 * math.pi, 28, endpoint=False)
        ring = np.stack([px + radius * np.cos(a), py + radius * np.sin(a), np.full(28, level)], axis=1)
        parts.add(np.concatenate([[[px, py, level]], ring]), shape([[0, 1 + k, 1 + (k + 1) % 28] for k in range(28)]), WATER, 'water')
    stats['pools'] = len(pools)
    stats['treeCrowns'] = forest_trees(r, builder, rng)
    for kind, bearing, distance, options in r['landmarks']:
        builder.build(kind, bearing, distance, options)
    stats['landmarks'] = builder.count
    stats['partVertices'] = parts.finish(materials)
    return stats


def render(key, r):
    global ICO
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable('cycles', default_set=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = opts.samples
    scene.cycles.use_denoising = False
    scene.cycles.seed = r['seed']
    scene.cycles.max_bounces = 4
    scene.render.film_transparent = True
    width = opts.width
    height = int(round(width * BAND / 360.0))
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = width, height, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'Standard'
    sky_colour, sky_strength = r['sky']
    world = bpy.data.worlds.new(key + ' sky')
    scene.world = world
    if world.node_tree is None:
        world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (*sky_colour, 1)
        bg.inputs['Strength'].default_value = sky_strength
    bearing, elevation, strength, sun_colour = r['sun']
    light = bpy.data.lights.new('sun', 'SUN')
    light.energy = strength
    light.angle = math.radians(1.5)
    light.color = sun_colour
    sun = bpy.data.objects.new('sun', light)
    scene.collection.objects.link(sun)
    b, e = math.radians(bearing), math.radians(elevation)
    towards = mathutils.Vector((math.sin(b) * math.cos(e), math.cos(b) * math.cos(e), math.sin(e)))
    sun.rotation_euler = (-towards).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    proto = bpy.context.object
    ICO = (np.array([v.co[:] for v in proto.data.vertices]), shape([list(p.vertices) for p in proto.data.polygons]))
    bpy.data.objects.remove(proto)
    haze = haze_group()
    materials = {'matte': material(key + ' land', haze, .95), 'water': material(key + ' water', haze, .06)}
    rng = np.random.default_rng(r['seed'])
    started = time.time()
    stats = build_region(key, r, materials, rng)
    built = time.time() - started
    cam = bpy.data.cameras.new('panorama')
    cam.type = 'PANO'
    cam.panorama_type = 'EQUIRECTANGULAR'
    cam.latitude_min, cam.latitude_max = math.radians(LAT_MIN), math.radians(LAT_MAX)
    cam.longitude_min, cam.longitude_max = -math.pi, math.pi
    cam.clip_end = 60000
    camera = bpy.data.objects.new('panorama', cam)
    scene.collection.objects.link(camera)
    camera.location = (0, 0, EYE)
    camera.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = camera
    path = os.path.join(OUT, key + '.png')
    scene.render.filepath = path
    started = time.time()
    bpy.ops.render.render(write_still=True)
    with open(path, 'rb') as fh:
        data = fh.read()
    report = {'key': key, 'seed': r['seed'], 'width': width, 'height': height, 'latitude': [LAT_MIN, LAT_MAX], 'eye': EYE, 'start': START,
              'north': 'image centre; a bearing b (degrees clockwise from north) is at u = 0.5 + b / 360',
              'samples': opts.samples, 'renderer': 'Cycles (CPU), no denoiser', 'blender': bpy.app.version_string,
              'haze': {'colour': HAZE, 'distance': HAZE_DISTANCE, 'max': HAZE_MAX},
              'buildSeconds': round(built, 1), 'renderSeconds': round(time.time() - started, 1),
              'region': {k: v for k, v in r.items()}, **stats,
              'png': {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}}
    with open(os.path.join(OUT, key + '.json'), 'w') as fh:
        json.dump(report, fh, indent=1)
    print(key, width, 'x', height, report['buildSeconds'], 's to build,', report['renderSeconds'], 's to render', flush=True)


for key, region in REGIONS.items():
    if opts.only and key not in opts.only.split(','):
        continue
    render(key, region)
# The bpy module can hang while it tears down; everything is written by now.
sys.stdout.flush()
os._exit(0)
