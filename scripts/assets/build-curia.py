"""Author the Curia of Chapters XI and XII in Blender (worlds and gameplay plan, release 9).

  "$BLENDER_PYTHON" scripts/assets/build-curia.py -- --repo .      (the bpy module)
  blender --background --python-exit-code 1 --python scripts/assets/build-curia.py -- --repo .

The Senate house as it stood in AD 274-276: the Curia Julia of Caesar and Augustus as
Domitian restored it, before the fire of 283 (docs/historical-research.md). It is widened
to hold the game's 8 x 8 chamber board (20 m square, centred on the origin) between the
senators' three low steps. Every piece is authored in place in the hall's own frame, in
runtime metres (x east, y up, z south; the board's north edge at z = -10), so the game
places each component at the origin:
  curia_floor        opus sectile around the board, under the walls and before the door
  curia_steps_west   three broad low steps carrying the senators' benches
  curia_steps_east
  curia_wall_west    marble dado, three aediculae, stucco above and a modillion cornice
  curia_wall_east
  curia_wall_north   the presiding end: three arched windows with bronze grilles
  curia_facade       the entrance wall seen from inside, its bronze doors standing open
  curia_tribunal     the presiding magistrates' platform just beyond the board's north edge (0.42 m)
  curia_victory      the gilded Victory on her globe and pedestal, her altar and two lamps
Original geometry and deterministic procedural maps (colour, ORM, normal), no source images;
the shared builders, bakes and export are in kitlib.py beside this script. Writes
art-source/models/roman-curia-kit.blend, the processed GLB and its report, and
src/showcase/curia-kit-components.js (each piece's runtime bounds).
"""
import argparse
import json
import math
import os
import sys

import numpy as np

import kitlib as K  # imports bpy first, which puts mathutils on the path
from kitlib import B, beam, box, cylinder, fbm, grid, joints, marble, mesh, plane, prism, sphere, speckled, torus
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
SOURCE = os.path.join(REPO, 'art-source', 'models')
PROCESSED = os.path.join(SOURCE, 'processed')
os.makedirs(PROCESSED, exist_ok=True)
KIT = 'roman-curia-kit'

# The hall (runtime metres). The board fills x, z in [-10, 10].
INNER_X, OUTER_X = 14.0, 15.2          # side walls' inner and outer faces
NORTH_IN, NORTH_OUT = -17.0, -18.2     # the presiding end
SOUTH_IN, SOUTH_OUT = 14.0, 15.2       # the entrance wall
HEIGHT = 21.0                          # the real hall's height, about 21 m
TRIBUNAL = .42                         # the magistrate's stand (src/core/realtime/chamber-world.js)
STEP_RISE, STEP_DEPTH, STEP_FRONT = .25, 1.0, 10.6
STEPS_Z = (-16.4, 12.4)
DADO, STRING, CORNICE = 3.6, 10.4, 20.0


# --- Surfaces: each returns (colour, height, roughness) for kitlib.bake ---------------------------
def surface_revetment(size):
    """The dado's opus sectile, one to 3.3 m: two upright slabs, pavonazzetto and cipollino,
    each framed by a thin giallo antico strip inside a white margin; a small porphyry
    roundel on the cipollino."""
    x, y = grid(size)
    white = marble(size, 3, (.86, .85, .82), (.52, .53, .56), .3)
    pav = marble(size, 7, (.85, .82, .78), (.42, .27, .34), .55, (1, 3), 1.4)
    cip = marble(size, 9, (.76, .79, .71), (.42, .50, .40), .5, (0, 3), 1.2)
    gia = marble(size, 11, (.74, .60, .37), (.58, .40, .2), .35, (3, 1))
    por = speckled(size, 13, (.33, .11, .12), (.74, .56, .56), .025)
    half = x >= .5
    u = (x * 2) % 1
    edge = np.minimum.reduce([u, 1 - u, y, 1 - y])
    r = np.hypot((u - .5) * .5, (y - .5))
    colour = np.where(half[..., None], cip, pav)
    strip = edge < .05
    colour[strip] = gia[strip]
    margin = edge < .022
    colour[margin] = white[margin]
    disc = half & (r < .055)
    ring = half & (r < .065) & ~disc
    colour[ring] = white[ring]
    colour[disc] = por[disc]
    height = joints(edge - .022, edge - .05, np.where(half, r - .065, 1), np.where(half, r - .055, 1), edge)
    return colour, height, .36


def surface_sectile(size):
    """The floor's opus sectile, one to 2.5 m (a board tile): four squares between white
    bands, roundels of porphyry in giallo and of serpentine in pavonazzetto."""
    x, y = grid(size)
    white = marble(size, 21, (.86, .85, .81), (.50, .51, .53), .28)
    pav = marble(size, 23, (.84, .81, .77), (.43, .28, .35), .5, (1, 2), 1.4)
    gia = marble(size, 25, (.74, .60, .38), (.56, .38, .19), .38, (3, 1))
    por = speckled(size, 27, (.31, .11, .12), (.74, .56, .56), .025)
    ser = speckled(size, 29, (.15, .22, .16), (.52, .64, .46), .03)
    qx, qy = (x * 2) % 1, (y * 2) % 1
    odd = ((np.floor(x * 2) + np.floor(y * 2)) % 2).astype(bool)
    edge = np.minimum.reduce([qx, 1 - qx, qy, 1 - qy])
    r = np.hypot(qx - .5, qy - .5)
    colour = np.where(odd[..., None], pav, gia)
    band = edge < .06
    colour[band] = white[band]
    ring = (r < .29) & ~band
    colour[ring] = white[ring]
    disc = r < .26
    colour[disc] = np.where(odd[..., None], ser, por)[disc]
    height = joints((edge - .06) / 2, r / 2 - .145, r / 2 - .13, edge / 2, width=.0016)
    return colour, height, .42


def surface_stucco(size):
    """Lime stucco ruled as ashlar, one to 2.4 m: four courses of two blocks."""
    x, y = grid(size)
    n = fbm(size, 31)
    row = np.floor(y * 4)
    u = (x * 2 + row * .5) % 1
    block = np.floor(x * 2 + row * .5)
    tone = .95 + (n - .5) * .12 + ((np.sin((block * 7 + row * 13) * 12.9898) * 43758.5453) % 1 - .5) * .05
    colour = np.clip(np.array((.87, .84, .77))[None, None] * tone[..., None], .01, .97)
    height = joints(np.minimum(u, 1 - u) / 2, np.minimum((y * 4) % 1, 1 - (y * 4) % 1) / 4, width=.0014)
    colour *= (.93 + .07 * height)[..., None]
    return colour, height, .84


def surface_marble(size):
    """White Luna marble for steps, mouldings, columns and the altar, one to 2 m."""
    colour = marble(size, 41, (.88, .87, .84), (.50, .52, .55), .32)
    return colour, np.ones((size, size), np.float32), .4


def surface_timber(size):
    """Oiled dark wood for the benches and footstools, one to 1.2 m."""
    x, y = grid(size)
    n = fbm(size, 51)
    grain = np.sin(x * math.tau * 40 + n * 7 + np.sin(y * math.tau * 2) * 2) * .5 + .5
    tone = .86 + grain * .16 + (n - .5) * .1
    colour = np.clip(np.array((.33, .21, .12))[None, None] * tone[..., None], .01, .97)
    return colour, .85 + grain * .15, .6


TEXTURED = {
    'marble': ('Curia Luna marble', surface_marble, 2.0, 0.),
    'revetment': ('Curia dado opus sectile', surface_revetment, 3.3, .32),
    'sectile': ('Curia floor opus sectile', surface_sectile, 2.5, 0.),
    'stucco': ('Curia ashlar stucco', surface_stucco, 2.4, 0.),
    'timber': ('Curia oiled bench wood', surface_timber, 1.2, 0.),
}
# Untextured: factors only (the game's normaliser gives them its neutral maps).
PLAIN = {
    'gilt': ('Curia gilded bronze', (1.0, .76, .36), 1.0, .3),
    'bronze': ('Curia dark bronze', (.45, .33, .19), .9, .4),
    'cloth': ('Curia madder wool', (.34, .07, .06), 0., .93),
}


# --- The hall's parts ------------------------------------------------------------------------------
def component(name):
    return K.component(name, 'Original Blender-authored Curia for Imperium, in place in the hall frame')


def slab_with_openings(x0, x1, z0, z1, openings, across):
    K.slab_with_openings(x0, x1, z0, z1, openings, across, HEIGHT)


BOARD_FLOOR = 11.5   # the code-built chamber floor's half-width (environment-campaign-terrain.js)
PAVING = .012        # the paving's height above the level terrain, clear of its depth


def floor():
    component('curia_floor')
    # Opus sectile round the code-built chamber floor that carries the board (none lies under
    # it), and white paving under the walls and before the door. All of it stands just above
    # the level terrain: paving on the ground itself would flicker with it.
    f = BOARD_FLOOR
    for x0, x1, z0, z1 in ((-INNER_X, INNER_X, NORTH_IN, -f), (-INNER_X, INNER_X, f, SOUTH_IN),
                           (-INNER_X, -f, -f, f), (f, INNER_X, -f, f)):
        plane(x0, x1, z0, z1, 'sectile', PAVING)
    edge = OUTER_X + 2.4
    plane(-edge, edge, SOUTH_IN, SOUTH_OUT + 5, 'marble', PAVING)
    plane(-edge, edge, NORTH_OUT, NORTH_IN, 'marble', PAVING)
    for side in (-1, 1): plane(min(side * INNER_X, side * edge), max(side * INNER_X, side * edge), NORTH_IN, SOUTH_IN, 'marble', PAVING)
    # A white marble frame where the board's own floor meets the sectile. It reaches down to
    # the ground, so the placed piece keeps its foot at 0 (scenery-models.js sets each
    # piece's lowest point on its ground).
    a, b = f - .05, f + .3
    for side in (-1, 1):
        box(side * a, side * b, 0, .028, -b, b, 'marble')
        box(-b, b, 0, .028, side * a, side * b, 'marble')


def steps(side):
    component('curia_steps_' + ('west' if side < 0 else 'east'))
    z0, z1 = STEPS_Z
    for k in range(3):
        front, top = side * (STEP_FRONT + k * STEP_DEPTH), (k + 1) * STEP_RISE
        box(front, side * INNER_X, 0, top, z0, z1, 'marble', .015)
        # A proud nosing catches the light along each tread.
        box(front - side * .03, front + side * .05, top - .05, top + .012, z0, z1, 'marble')
        # The senators' benches (subsellia) toward the back of each tread.
        seat, sx = top + .44, side * (STEP_FRONT + k * STEP_DEPTH + .62)
        benches, length, gap = 9, 2.5, .35
        start = (z0 + z1) / 2 - (benches * length + (benches - 1) * gap) / 2
        for j in range(benches):
            b0 = start + j * (length + gap); b1 = b0 + length
            box(sx - .21, sx + .21, seat - .07, seat, b0, b1, 'timber')
            for zz in (b0 + .14, b1 - .14): box(sx - .17, sx + .17, top, seat - .07, zz - .05, zz + .05, 'timber')
            box(sx - .03, sx + .03, top + .12, top + .18, b0 + .19, b1 - .19, 'timber')
            box(sx - .19, sx + .19, seat, seat + .06, b0 + .07, b1 - .07, 'cloth')


def modillions(along, fixed, axis, inward):
    """Small consoles under the cornice's corona, every 0.62 m."""
    a0, a1 = along
    n = int((a1 - a0) / .62)
    for i in range(n):
        c = a0 + (i + .5) * (a1 - a0) / n
        if axis == 'x': box(c - .11, c + .11, CORNICE + .02, CORNICE + .3, fixed + inward * .18, fixed + inward * .58, 'marble')
        else: box(fixed + inward * .18, fixed + inward * .58, CORNICE + .02, CORNICE + .3, c - .11, c + .11, 'marble')


def courses(face, inward, along, axis, gaps=()):
    """The bands every wall shares: plinth, revetted dado and its cornice, the string course
    and the crowning cornice. `face` is the inner face; `inward` points into the hall."""
    def band(t0, t1, y0, y1, mat, a0, a1, bevel=0.):
        p0, p1 = face + inward * t0, face + inward * t1
        if axis == 'x': return box(a0, a1, y0, y1, p0, p1, mat, bevel)
        return box(p0, p1, y0, y1, a0, a1, mat, bevel)
    pieces = [(along[0], along[1])]
    for g0, g1 in gaps:
        pieces = [q for p in pieces for q in ((p[0], max(p[0], g0)), (min(p[1], g1), p[1])) if q[1] - q[0] > .01]
    for a0, a1 in pieces:
        band(0, .14, 0, .32, 'marble', a0, a1, .02)
        band(0, .05, .32, DADO, 'revetment', a0, a1)
        band(0, .16, DADO, DADO + .14, 'marble', a0, a1, .015)
        band(0, .1, DADO + .14, DADO + .22, 'marble', a0, a1)
    band(0, .14, STRING, STRING + .22, 'marble', along[0], along[1], .015)
    band(0, .2, CORNICE - .42, CORNICE, 'marble', along[0], along[1])
    band(0, .64, CORNICE + .3, CORNICE + .72, 'marble', along[0], along[1], .02)
    band(0, .76, CORNICE + .72, HEIGHT, 'marble', along[0], along[1], .02)
    modillions(along, face, axis, inward)


def aedicula(face, inward, centre, index, axis):
    """A niche frame on consoles: columns, entablature and a pediment, triangular and
    segmental in turn, over a revetted panel."""
    def at(t0, t1, y0, y1, a0, a1, mat, bevel=0.):
        p0, p1 = face + inward * t0, face + inward * t1
        if axis == 'x': return box(a0, a1, y0, y1, p0, p1, mat, bevel)
        return box(p0, p1, y0, y1, a0, a1, mat, bevel)
    at(0, .035, DADO + .22, 8.6, centre - 1.05, centre + 1.05, 'revetment')
    for d in (-1.35, 1.35):
        c = centre + d
        at(0, .56, DADO + .22, 4.36, c - .21, c + .21, 'marble', .02)
        at(.1, .6, 4.36, 4.52, c - .25, c + .25, 'marble', .01)
        px = face + inward * .36
        if axis == 'x': cylinder(c, px, 4.52, 8.04, .165, 'marble', 14, .145)
        else: cylinder(px, c, 4.52, 8.04, .165, 'marble', 14, .145)
        at(.08, .64, 8.04, 8.36, c - .27, c + .27, 'marble', .015)
    at(0, .68, 8.36, 8.9, centre - 1.78, centre + 1.78, 'marble', .02)
    near, far = face, face + inward * .68
    if index % 2 == 0:
        outline = [(centre - 1.86, 8.9), (centre + 1.86, 8.9), (centre, 9.72)]
    else:
        outline = [(centre - 1.86, 8.9), (centre + 1.86, 8.9)] + [
            (centre + 1.86 * math.cos(t), 8.9 + .72 * math.sin(t)) for t in (math.pi * i / 10 for i in range(1, 10))]
    prism(outline, 'z' if axis == 'x' else 'x', near, far, 'marble')


def window(face, inward, centre, sill, width, spring, axis, mid):
    """An arched window's marble frame and its bronze grille, set in the wall's thickness."""
    r = width / 2
    def at(t0, t1, y0, y1, a0, a1, mat, bevel=0.):
        p0, p1 = face + inward * t0, face + inward * t1
        if axis == 'x': return box(a0, a1, y0, y1, p0, p1, mat, bevel)
        return box(p0, p1, y0, y1, a0, a1, mat, bevel)
    at(0, .22, sill - .28, sill, centre - r - .42, centre + r + .42, 'marble', .015)
    for s in (-1, 1): at(0, .12, sill, spring, centre + s * r, centre + s * (r + .34), 'marble', .01)
    for i in range(9):
        a, b = math.pi * i / 9 + .006, math.pi * (i + 1) / 9 - .006
        outer = r + .34 + (.08 if i == 4 else 0)
        pts = [(centre + rr * math.cos(t), spring + rr * math.sin(t)) for rr, t in ((r, a), (outer, a), (outer, b), (r, b))]
        prism(pts, 'z' if axis == 'x' else 'x', face, face + inward * (.12 + (.04 if i == 4 else 0)), 'marble')
    # The grille: bronze bars across the opening, clipped to its arch.
    for k in range(-3, 4):
        u = centre + k * width / 7.5
        top = spring + math.sqrt(max(0, r * r - (u - centre) ** 2))
        if axis == 'x': box(u - .025, u + .025, sill, top, mid - .03, mid + .03, 'bronze')
        else: box(mid - .03, mid + .03, sill, top, u - .025, u + .025, 'bronze')
    for y in [sill + (spring - sill) * f for f in (.25, .5, .75, 1.)] + [spring + r * .55]:
        half = r if y <= spring else math.sqrt(max(0, r * r - (y - spring) ** 2))
        if axis == 'x': box(centre - half, centre + half, y - .025, y + .025, mid - .03, mid + .03, 'bronze')
        else: box(mid - .03, mid + .03, y - .025, y + .025, centre - half, centre + half, 'bronze')


def side_wall(side):
    component('curia_wall_' + ('west' if side < 0 else 'east'))
    face, inward = side * INNER_X, -side
    slab_with_openings(side * INNER_X, side * OUTER_X, NORTH_IN, SOUTH_IN, [], 'x')
    courses(face, inward, (NORTH_IN, SOUTH_IN), 'z')
    for i, c in enumerate((-9.0, 0.0, 9.0)): aedicula(face, inward, c, i, 'z')


WINDOWS_NORTH = [(-8.0, 11.6, 3.2, 15.6), (0.0, 11.6, 3.2, 15.6), (8.0, 11.6, 3.2, 15.6)]
WINDOWS_SOUTH = [(-7.0, 11.0, 3.0, 14.6), (0.0, 11.0, 3.0, 14.6), (7.0, 11.0, 3.0, 14.6)]
DOOR = (0.0, 0.0, 4.4, 7.6)


def north_wall():
    component('curia_wall_north')
    face, inward, mid = NORTH_IN, 1, (NORTH_IN + NORTH_OUT) / 2
    slab_with_openings(-OUTER_X, OUTER_X, NORTH_OUT, NORTH_IN, [(c, s, w, t, True) for c, s, w, t in WINDOWS_NORTH], 'z')
    courses(face, inward, (-INNER_X, INNER_X), 'x')
    for centre, sill, width, spring in WINDOWS_NORTH: window(face, inward, centre, sill, width, spring, 'x', mid)
    # A tall revetted panel framed in white marble behind the Victory.
    box(-3.3, 3.3, DADO + .22, STRING - .2, face, face + .04, 'revetment')
    for x0, x1 in ((-3.5, -3.3), (3.3, 3.5)): box(x0, x1, DADO + .22, STRING - .2, face, face + .1, 'marble')
    box(-3.5, 3.5, STRING - .32, STRING - .2, face, face + .12, 'marble')


def facade():
    component('curia_facade')
    face, inward, mid = SOUTH_IN, -1, (SOUTH_IN + SOUTH_OUT) / 2
    centre, sill, width, height = DOOR
    slab_with_openings(-OUTER_X, OUTER_X, SOUTH_IN, SOUTH_OUT, [(centre, sill - 1, width, height, False)] + [(c, s, w, t, True) for c, s, w, t in WINDOWS_SOUTH], 'z')
    courses(face, inward, (-INNER_X, INNER_X), 'x', gaps=[(centre - width / 2 - .65, centre + width / 2 + .65)])
    for c, s, w, sp in WINDOWS_SOUTH: window(face, inward, c, s, w, sp, 'x', mid)
    # The door's marble frame, its hood on two consoles.
    half = width / 2
    for s in (-1, 1): box(s * half, s * (half + .65), 0, height, face, face - .16, 'marble', .015)
    box(-half - .65, half + .65, height, height + .75, face, face - .16, 'marble', .015)
    for s in (-1, 1): box(s * (half + .3), s * (half + .62), height + .3, height + .75, face - .16, face - .52, 'marble', .015)
    box(-half - .95, half + .95, height + .75, height + 1.0, face, face - .58, 'marble', .02)
    # The bronze doors stand open, folded back against the wall.
    for s in (-1, 1):
        x0, x1 = s * (half + .7), s * (half + .7 + width / 2)
        box(x0, x1, .04, height - .06, face - .3, face - .2, 'bronze')
        for row in range(4):
            for col in range(2):
                a0 = min(x0, x1) + .14 + col * (width / 4 - .04); a1 = a0 + width / 4 - .24
                y0 = .5 + row * (height - .9) / 4; y1 = y0 + (height - .9) / 4 - .26
                box(a0, a1, y0, y1, face - .34, face - .3, 'bronze')
        box(min(x0, x1) + .08, max(x0, x1) - .08, height * .48, height * .48 + .12, face - .35, face - .3, 'gilt')


def tribunal():
    component('curia_tribunal')
    front, back = -10.02, -13.2
    # The presiding platform stands wholly beyond the board's north edge, at the magistrate's height.
    box(-4.6, 4.6, 0, TRIBUNAL - .06, back, front, 'marble', .02)
    box(-4.7, 4.7, TRIBUNAL - .06, TRIBUNAL, back - .1, front, 'marble', .012)
    box(-4.7, 4.7, 0, .06, back - .1, front, 'marble')
    for s in (-1, 1):
        box(s * 4.6, s * 5.06, 0, .28, -12.6, -10.6, 'marble', .012)
        box(s * 5.06, s * 5.52, 0, .14, -12.6, -10.6, 'marble', .012)
    for cx in (-1.1, 1.1):
        cz, base = -11.9, TRIBUNAL
        # A curule chair: crossed bronze legs on either side, a cushioned seat.
        for sx in (-.27, .27):
            beam((cx + sx, base, cz - .2), (cx + sx, base + .5, cz + .2), .025, 'bronze')
            beam((cx + sx, base, cz + .2), (cx + sx, base + .5, cz - .2), .025, 'bronze')
        box(cx - .33, cx + .33, base + .5, base + .55, cz - .23, cz + .23, 'bronze')
        box(cx - .3, cx + .3, base + .55, base + .61, cz - .2, cz + .2, 'cloth')
        box(cx - .25, cx + .25, base, base + .12, cz + .34, cz + .64, 'timber')


def victory_figure(ox, oy, oz):
    """A stylised gilded Victory alighting on her globe: robe, wings spread, a wreath held out
    in the right hand and a palm in the left (after the type on coins of 29-27 BC)."""
    lean = .07
    profile = [(0, .27), (.08, .3), (.45, .27), (.82, .225), (1.04, .2), (1.28, .225), (1.46, .25), (1.55, .17), (1.6, .07)]
    segs, rings = 20, []
    for h, r in profile:
        ring = []
        for i in range(segs):
            t = math.tau * i / segs
            fold = 1 + .07 * math.sin(9 * t + h * 3) * max(0, 1 - h / 1.1)
            ring.append((ox + math.cos(t) * r * fold, oy + h, oz + math.sin(t) * r * .78 * fold + h * lean))
        rings.append(ring)
    vertices = [v for ring in rings for v in ring]
    faces = [(k * segs + i, k * segs + (i + 1) % segs, (k + 1) * segs + (i + 1) % segs, (k + 1) * segs + i)
             for k in range(len(rings) - 1) for i in range(segs)]
    faces.append(tuple(range(segs - 1, -1, -1)))
    faces.append(tuple(range((len(rings) - 1) * segs, len(rings) * segs)))
    mesh('robe', vertices, faces, 'gilt', closed=True, smooth=True)
    # The girdle under the breast, and the overfold of the peplos falling to the hips.
    torus(ox, oy + 1.27, oz + 1.27 * lean, .215, .02, 'gilt', math.pi / 2, 20, 5)
    fold = []
    for k, (h, r) in enumerate(((1.24, .23), (1.02, .255), (.86, .27))):
        fold.append([(ox + math.cos(math.tau * i / segs) * r * (1 + .05 * math.sin(7 * math.tau * i / segs)), oy + h,
                      oz + math.sin(math.tau * i / segs) * r * .8 + h * lean) for i in range(segs)])
    mesh('overfold', [v for ring in fold for v in ring],
         [(k * segs + i, k * segs + (i + 1) % segs, (k + 1) * segs + (i + 1) % segs, (k + 1) * segs + i) for k in range(2) for i in range(segs)],
         'gilt', .015, smooth=True)
    for s in (-1, 1): box(ox + s * .06 - .05, ox + s * .06 + .05, oy, oy + .07, oz + .16, oz + .32, 'gilt')
    top = oy + 1.6
    cylinder(ox, oz + 1.6 * lean, top - .04, top + .08, .055, 'gilt', 10)
    sphere(ox, top + .19, oz + 1.7 * lean + .02, .12, 'gilt', 18, 10, (1, 1.08, 1))
    sphere(ox, top + .22, oz + 1.7 * lean - .09, .07, 'gilt', 12, 6)
    sh = oy + 1.46
    # Right arm raised forward with the wreath; left arm lowered with the palm branch.
    beam((ox + .22, sh, oz + .1), (ox + .36, sh + .12, oz + .34), .045, 'gilt', 8)
    beam((ox + .36, sh + .12, oz + .34), (ox + .3, sh + .4, oz + .58), .04, 'gilt', 8)
    torus(ox + .3, sh + .52, oz + .62, .16, .028, 'gilt', .3)
    beam((ox - .22, sh, oz + .1), (ox - .33, sh - .28, oz + .16), .045, 'gilt', 8)
    beam((ox - .33, sh - .28, oz + .16), (ox - .3, sh - .44, oz + .34), .04, 'gilt', 8)
    beam((ox - .3, oy + .55, oz + .36), (ox - .36, oy + 2.05, oz + .3), .018, 'gilt', 6)
    for i in range(9):
        h = oy + 1.3 + i * .085
        for s in (-1, 1):
            beam((ox - .3 - .004 * i, h, oz + .33), (ox - .3 - .004 * i + s * (.22 - i * .015), h + .12, oz + .33 - .03), .012, 'gilt', 4)
    # The wings, raised and swept back from the shoulder blades: a smooth cupped surface,
    # and along its trailing edge tapered feathers, the primaries longest at the tip.
    for s in (-1, 1):
        span, chord = 12, 5
        def edge(u, v):
            lx, ly = .08 + 1.08 * u, sh + .12 + 1.02 * math.sin(u * math.pi / 2) ** 1.2
            along = v * (.8 - .55 * u)
            dx, dy = math.sin(.62 * u), -math.cos(.62 * u)
            z = oz - .16 - .38 * u - .18 * math.sin(math.pi * v) * (.3 + u)
            return (ox + s * (lx + dx * along), ly + dy * along, z)
        vertices = [edge(i / span, j / chord) for i in range(span + 1) for j in range(chord + 1)]
        faces = [(i * (chord + 1) + j, (i + 1) * (chord + 1) + j, (i + 1) * (chord + 1) + j + 1, i * (chord + 1) + j + 1)
                 for i in range(span) for j in range(chord)]
        if s < 0: faces = [tuple(reversed(f)) for f in faces]
        mesh('wing', vertices, faces, 'gilt', .04, smooth=True)
        for k in range(13):
            u = (k + .5) / 13
            root = Vector(edge(u, .82))
            lx, ly = math.sin(.62 * u), -math.cos(.62 * u)
            length = .22 + .45 * u ** 2
            tip = root + Vector((s * lx * length, ly * length, -.04 - .06 * u))
            side = Vector((s * -ly, lx, 0)).normalized() * (.05 + .02 * u)
            quill = [root - side, root + side, root + (tip - root) * .6 + side * .8, tip, root + (tip - root) * .6 - side * .8]
            mesh('feather', [tuple(p) for p in quill], [(0, 1, 2, 3, 4) if s > 0 else (4, 3, 2, 1, 0)], 'gilt', .02, smooth=True)


def victory():
    component('curia_victory')
    cz = -15.7
    # The pedestal, its inscribed die, and the globe.
    box(-1.1, 1.1, 0, .45, cz - 1.1, cz + 1.1, 'marble', .02)
    box(-.8, .8, .45, 2.85, cz - .8, cz + .8, 'marble', .02)
    box(-.56, .56, 1.3, 2.1, cz + .8, cz + .83, 'marble')
    box(-1.0, 1.0, 2.85, 3.15, cz - 1.0, cz + 1.0, 'marble', .02)
    sphere(0, 3.15 + .6, cz, .62, 'bronze', 28, 14)
    victory_figure(0, 3.15 + 1.2, cz)
    # The altar of Victory before her, with its bolsters, a garland and a bronze brazier.
    az = -14.0
    box(-.75, .75, 0, .18, az - .45, az + .45, 'marble', .015)
    box(-.62, .62, .18, 1.0, az - .35, az + .35, 'marble', .015)
    box(-.72, .72, 1.0, 1.14, az - .43, az + .43, 'marble', .015)
    for s in (-1, 1): beam((s * .55, 1.25, az - .41), (s * .55, 1.25, az + .41), .11, 'marble', 12)
    for i in range(9):
        t = i / 8
        sphere(-.45 + .9 * t, .78 - .22 * math.sin(math.pi * t), az + .37, .055, 'gilt', 8, 5)
    cylinder(0, az, 1.14, 1.26, .26, 'bronze', 16, .18)
    # Two bronze lampstands flank the statue.
    for s in (-1, 1):
        x = s * 2.7
        for k in range(3):
            a = math.tau * k / 3 + .4
            beam((x + .36 * math.cos(a), .03, cz + .36 * math.sin(a)), (x, .34, cz), .03, 'bronze', 6)
        cylinder(x, cz, .3, 2.7, .045, 'bronze', 10)
        sphere(x, 1.5, cz, .09, 'bronze', 10, 6)
        cylinder(x, cz, 2.7, 2.78, .28, 'bronze', 16, .22)


K.reset()
for key, (name, build, repeat, offset) in TEXTURED.items():
    colour, height, rough = build(512)
    K.materials[key] = K.bake(name, colour, height, rough, repeat, offset)
for key, (name, base, metal, rough) in PLAIN.items():
    K.materials[key] = K.plain(name, base, metal, rough)
floor()
for side in (-1, 1): steps(side)
for side in (-1, 1): side_wall(side)
north_wall()
facade()
tribunal()
victory()
hall = {'inner': {'minX': -INNER_X, 'maxX': INNER_X, 'minZ': NORTH_IN, 'maxZ': SOUTH_IN}, 'height': HEIGHT, 'tribunal': TRIBUNAL}
report = K.export(KIT, 'scripts/assets/build-curia.py', [11, 12], PROCESSED, SOURCE, {'hall': hall})
with open(os.path.join(REPO, 'src', 'showcase', 'curia-kit-components.js'), 'w', encoding='utf-8') as f:
    f.write('// Generated by scripts/assets/build-curia.py: each piece\'s runtime bounds in metres\n')
    f.write('// (x east, y up, z south), authored in place around the chamber board centred at the origin.\n')
    f.write('export const CURIA_KIT_COMPONENTS = ' + json.dumps(K.bounds(report), indent=2) + ';\n')
    f.write('export const CURIA_HALL = ' + json.dumps(hall) + ';\n')
    f.write('for (const box of Object.values(CURIA_KIT_COMPONENTS)) { Object.freeze(box.min); Object.freeze(box.max); Object.freeze(box); }\n')
    f.write('Object.freeze(CURIA_KIT_COMPONENTS); Object.freeze(CURIA_HALL.inner); Object.freeze(CURIA_HALL);\n')
