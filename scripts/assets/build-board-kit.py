"""Author the board kit in Blender: the field's own structures fitted to the
rules' 2.5 m cell and heights (worlds and gameplay plan, release 4).

  blender --background --python-exit-code 1 --python scripts/assets/build-board-kit.py -- --repo . [--only stone]
  "$BLENDER_PYTHON" scripts/assets/build-board-kit.py -- --repo .      (the bpy module)

One GLB per material family (stone, mudbrick, timber), each holding named
component roots at their local ground origin, the cell centred on it, its face
(crenels, the deck's open side, a gate's swing) toward +X. Every piece comes
twice: `<piece>` near and `<piece>_far` for distance (a few boxes).
  wall_block      a curtain cell: 3.2 m (stone, mudbrick) or 2.5 m (timber) high
  tower           a tower's deck cell, 3.2 m, its parapet open toward -X (the stair)
  tower_stair     the stair cell, rising toward +X from the ground to the deck
  gate_frame      the gate cell's piers and lintel; gate_closed, gate_barred,
                  gate_open and gate_battered are its leaves; gate_panel shuts
                  the other cells of a closed gate's line
  breach_rubble   a breach cell's fallen work, below boot height
  bridge_deck     one cell of footbridge along +X; bridge_damaged, bridge_stumps
  breastwork      a rampart cell's wattle revetment along its +X edge
Original geometry and deterministic procedural maps (colour, ORM, normal), no
source images. Writes art-source/models/board-kit-<family>.blend, the processed
GLB and its report, and src/showcase/board-kit-components.js (piece bounds).
"""
import argparse
import hashlib
import json
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
parser.add_argument('--only', default='')
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
SOURCE = os.path.join(REPO, 'art-source', 'models')
PROCESSED = os.path.join(SOURCE, 'processed')
os.makedirs(PROCESSED, exist_ok=True)
CELL = 2.5
# The rules' heights (src/data/structures.js, src/core/realtime/sight.js).
DECK, STAIR = 3.2, 1.6
FAMILIES = {
    # family: (curtain height, masonry kind, masonry base colour, timber base colour)
    'stone': (3.2, 'ashlar', (.52, .49, .43), (.30, .22, .15)),
    'mudbrick': (3.2, 'mudbrick', (.58, .43, .28), (.33, .24, .16)),
    'timber': (2.5, 'revetment', (.34, .26, .18), (.30, .22, .15)),
}
materials = {}
roots = []
current = None
rng = random.Random(4024)


# --- Surfaces ---------------------------------------------------------------------------------
def periodic_noise(size, cells, seed):
    """Smooth value noise that tiles over the image."""
    r = np.random.default_rng(seed).random((cells, cells)).astype(np.float32)
    g = np.linspace(0, cells, size, endpoint=False)
    i0 = np.floor(g).astype(int); t = g - i0; t = t * t * (3 - 2 * t); i1 = (i0 + 1) % cells
    a = r[np.ix_(i0, i0)]; b = r[np.ix_(i0, i1)]; c = r[np.ix_(i1, i0)]; d = r[np.ix_(i1, i1)]
    tx = t[None, :]; ty = t[:, None]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def courses(size, rows, seed, mortar):
    """Staggered blocks: height field (0 in joints), a per-block value, and the joint mask."""
    rgen = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] / size
    row = np.floor(y * rows).astype(int)
    height = np.ones((size, size), np.float32); block = np.zeros((size, size), np.float32)
    for r in range(rows):
        widths = rgen.uniform(.7, 1.3, rgen.integers(3, 6)); edges = np.concatenate([[0], np.cumsum(widths) / widths.sum()])
        shift = rgen.random()
        m = row == r; u = (x[m] + shift) % 1
        k = np.searchsorted(edges, u, side='right') - 1
        across = np.minimum(u - edges[k], edges[k + 1] - u)
        along = np.minimum((y[m] * rows) % 1, 1 - (y[m] * rows) % 1) / rows
        joint = np.minimum(across, along)
        height[m] = np.clip(joint / mortar, 0, 1) ** .5
        block[m] = (np.sin((k + r * 7) * 12.9898 + seed) * 43758.5453) % 1
    return height, block


def bake(name, kind, base, size=512):
    """Colour, glTF ORM (roughness in G, metalness in B) and a tangent-space normal map."""
    n1, n2 = periodic_noise(size, 8, len(name)), periodic_noise(size, 32, len(name) + 1)
    metal = 0.
    if kind == 'ashlar':
        h, b = courses(size, 7, 11, .012)
        tone = .86 + b * .2 + (n2 - .5) * .1; h = h * (.86 + n2 * .14); rough = .9 - b * .08
    elif kind == 'mudbrick':
        h, b = courses(size, 14, 23, .02)
        # Worn mud plaster survives in a few soft patches near the bricks' own colour (bright, hard-edged
        # patches read as camouflage), and the joints read a shade darker where it has gone.
        plaster = np.clip((n1 - .66) * 3.5, 0, 1) ** 2 * .6
        tone = ((.84 + b * .18) * (1 - plaster) + .98 * plaster + (n2 - .5) * .07) * (.9 + .1 * np.clip(h + plaster, 0, 1))
        h = h * (1 - plaster) * .7 + plaster * (.9 + n2 * .1); rough = .95 - plaster * .05
    elif kind == 'revetment':
        h, b = courses(size, 10, 31, .016)
        grain = np.sin(np.mgrid[0:size, 0:size][1] / size * math.tau * 40 + n1 * 6) * .5 + .5
        tone = .82 + b * .22 + grain * .08; h = h * (.82 + grain * .18); rough = .88
    elif kind == 'planks':
        y, x = np.mgrid[0:size, 0:size] / size
        seam = np.minimum((x * 8) % 1, 1 - (x * 8) % 1) / 8
        h = np.clip(seam / .006, 0, 1) ** .4; plank = np.floor(x * 8)
        grain = np.sin(y * math.tau * 22 + np.sin(plank * 3.1 + y * 5) * 2 + n1 * 4) * .5 + .5
        tone = .8 + ((np.sin(plank * 78.233) * 43758.5453) % 1) * .25 + grain * .1; rough = .86
    else:  # iron: dark, faintly pitted, metallic
        h = .9 + n2 * .1; tone = .9 + (n2 - .5) * .25 + (n1 - .5) * .1; rough = .55 + n1 * .2; metal = .85
    colour = np.ones((size, size, 4), np.float32)
    for c in range(3):
        colour[:, :, c] = np.clip(base[c] * tone * (1 if c == 0 else .97), .01, .96)
    orm = np.ones((size, size, 4), np.float32)
    orm[:, :, 1] = np.clip(rough + (1 - h) * .08, .25, 1); orm[:, :, 2] = metal
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * size / 64; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * size / 64
    # Blender images run bottom-up: +v is up the image, as glTF's +Y tangent expects.
    nrm = np.dstack([-gx, gy, np.ones_like(gx)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    normal = np.ones((size, size, 4), np.float32); normal[:, :, :3] = nrm * .5 + .5
    images = []
    for suffix, pixels, data in [('colour', colour, False), ('orm', orm, True), ('normal', normal, True)]:
        image = bpy.data.images.new(f'{name} {suffix}', width=size, height=size)
        if data: image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(pixels.ravel()); image.pack(); images.append(image)
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = [nodes.new('ShaderNodeTexImage') for _ in images]
    for t, image in zip(tex, images): t.image = image
    split = nodes.new('ShaderNodeSeparateColor'); normal_map = nodes.new('ShaderNodeNormalMap')
    links.new(tex[0].outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex[1].outputs['Color'], split.inputs['Color'])
    links.new(split.outputs['Green'], bsdf.inputs['Roughness']); links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
    links.new(tex[2].outputs['Color'], normal_map.inputs['Color']); links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    mat.diffuse_color = (*base, 1)
    return mat


# --- Geometry -------------------------------------------------------------------------------------
def component(name):
    global current
    current = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(current)
    current['component'] = name
    current['units'] = 'metres'
    current['authorship'] = 'Original Blender board structure for Imperium, fitted to the rules cell'
    roots.append(current)
    return current


def finish(obj, mat, bevel=0., scale=1 / CELL):
    obj.name = current.name + '_' + mat
    obj.parent = current
    obj.data.materials.append(materials[mat])
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new('Worn arris', 'BEVEL'); mod.width = bevel; mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Box projection in metres, one texture repeat to a cell: joins between cells line up.
    uv = obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
    world = obj.matrix_world
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda k: abs(poly.normal[k]))
        axes = [(1, 2), (0, 2), (0, 1)][axis]
        for loop in poly.loop_indices:
            co = world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (co[axes[0]] * scale, co[axes[1]] * scale)
    obj.select_set(False)
    return obj


def box(x, y, z, w, d, h, mat, bevel=.02, rot=0.):
    """A box centred on (x, y) standing from z to z + h; w along X, d along Y."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + h / 2))
    obj = bpy.context.object; obj.scale = (w, d, h); obj.rotation_euler.z = rot
    return finish(obj, mat, bevel if min(w, d, h) > bevel * 4 else 0)


def beam(a, b, r, mat, sides=8):
    av, bv = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=(bv - av).length, location=(av + bv) / 2)
    obj = bpy.context.object; obj.rotation_euler = (bv - av).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, mat)


def stake(x, y, z, h, r, mat):
    beam((x, y, z), (x, y, z + h), r, mat)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r, radius2=0, depth=r * 3, location=(x, y, z + h + r * 1.5))
    finish(bpy.context.object, mat)


# --- Pieces -------------------------------------------------------------------------------------
def wall_block(family, far=False):
    height, kind = FAMILIES[family][0], FAMILIES[family][1]
    box(0, 0, 0, CELL, CELL, height, 'masonry', 0 if far else .03)
    if family == 'timber':
        # A timber-faced earth bank: its palisade of pointed stakes on the face edge.
        if far:
            box(1.05, 0, height, .22, CELL, 1.0, 'timber', 0); return
        for i in range(12):
            stake(1.08, -CELL / 2 + (i + .5) * CELL / 12, height - .05, .95 + (i % 3) * .05, .1, 'timber')
        box(1.0, 0, height + .35, .1, CELL, .14, 'timber')
        for y in (-.85, .85): box(-.2, y, height - .02, 1.6, .2, .06, 'timber', 0)
        return
    if far:
        box(1.0, 0, height, .5, CELL, .45, 'masonry', 0)
        for y in (-.85, 0, .85): box(1.0, y, height + .45, .5, .55, .55, 'masonry', 0)
        return
    box(1.2, 0, 0, .3, CELL, .5, 'masonry', .03)          # battered plinth on the face
    box(1.27, 0, height - .22, .08, CELL, .12, 'masonry')  # string course below the parapet
    box(1.0, 0, height, .5, CELL, .45, 'masonry', .03)     # parapet to breast height
    if family == 'mudbrick':
        # Stepped merlons, as on the eastern frontier.
        for y in (-.85, 0, .85):
            box(1.0, y, height + .45, .5, .62, .3, 'masonry', .04)
            box(1.0, y, height + .75, .5, .34, .28, 'masonry', .04)
    else:
        for y in (-.85, 0, .85): box(1.0, y, height + .45, .5, .55, .62, 'masonry', .03)
    box(-1.1, 0, height, .3, CELL, .25, 'masonry', .02)    # the walk's inner kerb


def tower(family, far=False):
    if far:
        box(0, 0, 0, CELL, CELL, DECK, 'masonry' if family != 'timber' else 'timber', 0)
        for x, y, w, d in ((1.1, 0, .3, CELL), (0, 1.1, CELL, .3), (0, -1.1, CELL, .3)): box(x, y, DECK, w, d, .9, 'masonry' if family != 'timber' else 'timber', 0)
        return
    if family == 'timber':
        for x in (-1.1, 1.1):
            for y in (-1.1, 1.1): box(x, y, 0, .28, .28, DECK + 1.15, 'timber', .02)
        for side, (w, d, x, y) in enumerate(((CELL, .14, 0, 1.16), (CELL, .14, 0, -1.16), (.14, CELL, 1.16, 0), (.14, CELL, -1.16, 0))):
            box(x, y, 0, w, d, DECK, 'masonry', 0)
        box(0, 0, DECK - .12, CELL, CELL, .12, 'timber', 0)
        for x, y, w, d in ((1.1, 0, .1, CELL), (0, 1.1, CELL, .1), (0, -1.1, CELL, .1)): box(x, y, DECK, w, d, .95, 'timber', 0)
        for y in (-.6, .6): beam((1.16, y, DECK + .5), (1.16, y, DECK + .95), .04, 'iron')
        return
    box(0, 0, 0, CELL, CELL, DECK, 'masonry', .03)
    box(0, 0, 0, CELL + .1, CELL + .1, .55, 'masonry', .04)  # plinth, within a hand's breadth of the cell
    box(0, 0, DECK - .2, CELL + .12, CELL + .12, .14, 'masonry')  # string course
    for x, y, w, d in ((1.1, 0, .3, CELL), (0, 1.1, CELL, .3), (0, -1.1, CELL, .3)): box(x, y, DECK, w, d, .45, 'masonry', .02)
    for x, y in ((1.1, 1.1), (1.1, -1.1), (-1.1, 1.1), (-1.1, -1.1), (1.1, 0)): box(x, y, DECK + .45, .45, .45, .6, 'masonry', .03)
    box(-1.27, 0, DECK - 2.4, .06, 1.1, 2.0, 'timber', 0)  # a door in the stair's face, its lintel in stone
    box(-1.3, 0, DECK - .4, .12, 1.4, .22, 'masonry')


def tower_stair(family, far=False):
    mat = 'timber' if family == 'timber' else 'masonry'
    if far:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, DECK / 2)); obj = bpy.context.object
        obj.scale = (CELL, 1.8, DECK); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for v in obj.data.vertices:
            if v.co.z > 0 and v.co.x < 0: v.co.z = 0.05 - DECK / 2
        finish(obj, mat); return
    for i in range(10):
        h = (i + 1) * DECK / 10
        if family == 'timber':
            box(-CELL / 2 + (i + .5) * .25, 0, h - .08, .25, 1.7, .08, 'timber', 0)
        else:
            box(-CELL / 2 + (i + .5) * .25, 0, 0, .26, 1.8, h, 'masonry', .015)
    if family != 'timber': return
    # A timber stair: stringers under the treads, and a handrail on posts.
    for y in (-.95, .95):
        beam((-1.25, y * .9, 0), (1.25, y * .9, DECK), .09, 'timber')
        for x in (-1.1, 0, 1.1): beam((x, y, (x + 1.25) / CELL * DECK), (x, y, (x + 1.25) / CELL * DECK + .95), .045, 'timber')
        beam((-1.1, y, .9 + .15 / CELL * DECK), (1.1, y, 2.35 / CELL * DECK + .9), .035, 'timber')


def gate_frame(family, far=False):
    pier = 'timber' if family == 'timber' else 'masonry'
    if far:
        for y in (-1.15, 1.15): box(0, y, 0, .5, .3, 3.3, pier, 0)
        box(0, 0, 3.0, .55, CELL + .3, .35, 'timber', 0); return
    for y in (-1.15, 1.15):
        box(0, y, 0, .55 if pier == 'masonry' else .34, .3, 3.15, pier, .03)
        if pier == 'masonry': box(0, y, 3.15, .65, .4, .18, 'masonry')
    box(0, 0, 3.0, .45, CELL + .3, .32, 'timber', .02)
    box(0, 0, 3.32, .7, CELL + .6, .12, 'timber', .01)
    for y in (-1.1, 1.1):
        for z in (.5, 2.3): beam((0, y, z), (0, y, z + .22), .045, 'iron')


def leaves(state):
    """The two leaves: shut, shut and barred, swung open (toward +X), or battered."""
    for side in (-1, 1):
        hinge = side * 1.1
        planks = 5
        for i in range(planks):
            y = hinge - side * (i + .5) * .22
            if state == 'battered' and (i, side) in ((3, -1), (4, 1), (1, 1)):
                # Split planks: shorter, out of line.
                p = box(.0, y, .2, .11, .2, 1.6, 'timber', 0); p.rotation_euler.x = side * .12; continue
            if state == 'open':
                x = (i + .5) * .22
                box(x, hinge - side * .06, 0, .2, .11, 2.6, 'timber', 0)
            else:
                box(0, y, 0, .11, .2, 2.6, 'timber', 0)
        for z in (.55, 2.0):
            if state == 'open': box(.55, hinge - side * .12, z, 1.1, .03, .1, 'iron', 0)
            else: box(.07, hinge - side * .55, z, .03, 1.1, .1, 'iron', 0)
    if state == 'barred':
        box(-.15, 0, 1.25, .2, CELL - .1, .2, 'timber', .02)
        for y in (-1.05, 1.05): box(-.12, y, 1.15, .14, .12, .4, 'iron', 0)
    if state == 'battered':
        for i in range(7):
            p = box(.4 + rng.uniform(0, .9), rng.uniform(-1, 1), 0, .6, .09, .05, 'timber', 0); p.rotation_euler.z = rng.uniform(0, 3)


def gate_leaves(state):
    def build(family, far=False):
        if far:
            if state == 'open':
                for side in (-1, 1): box(.55, side * 1.05, 0, 1.1, .12, 2.6, 'timber', 0)
            else:
                box(0, 0, 0, .14, CELL - .1, 2.6 if state != 'battered' else 2.0, 'timber', 0)
            return
        leaves(state)
    return build


def gate_panel(family, far=False):
    """A shut gate line's other cells: a planked barrier between posts."""
    if far:
        box(0, 0, 0, .2, CELL, 2.6, 'timber', 0); return
    for y in (-1.15, 1.15): box(0, y, 0, .26, .26, 2.9, 'timber', .02)
    for i in range(10): box(0, -1.05 + (i + .5) * .21, 0, .1, .19, 2.55, 'timber', 0)
    for z in (.6, 1.9): box(-.08, 0, z, .07, CELL - .2, .14, 'timber', 0)


def breach_rubble(family, far=False):
    mat = 'timber' if family == 'timber' else 'masonry'
    count = 4 if far else 16
    for i in range(count):
        s = rng.uniform(.22, .48)
        p = box(rng.uniform(-1.05, 1.05), rng.uniform(-1.05, 1.05), 0, s * 1.4 if mat == 'timber' else s, s * (.3 if mat == 'timber' else 1), min(.34, s * .7), mat, 0 if far else .04)
        p.rotation_euler.z = rng.uniform(0, math.tau)


def bridge(state):
    def build(family, far=False):
        if state == 'stumps':
            for x in (-1.0, 1.0):
                for y in (-.7, .7): box(x, y, -1.2, .2, .2, rng.uniform(1.0, 1.4), 'timber', 0)
            return
        if far:
            box(0, 0, -.1, CELL, 1.5, .12, 'timber', 0)
            for y in (-.8, .8): box(0, y, 0, CELL, .08, .8, 'timber', 0)
            return
        for y in (-.62, .62): box(0, y, -.32, CELL, .2, .2, 'timber', .01)
        for i in range(11):
            if state == 'damaged' and 4 <= i <= 6: continue
            box(-CELL / 2 + (i + .5) * CELL / 11, 0, -.12, CELL / 11 - .02, 1.55, .09, 'timber', 0)
        if state == 'damaged':
            p = box(.1, .35, -.45, .5, .22, .07, 'timber', 0); p.rotation_euler.y = .5
        for y in (-.82, .82):
            for x in (-1.1, 0, 1.1): box(x, y, -.12, .09, .09, 1.0, 'timber', 0)
            box(0, y, .78, CELL, .07, .07, 'timber', 0)
            for x in (-1.1, 1.1): beam((x, y * .9, -1.4), (x, y * .9, -.12), .1, 'timber')
    return build


def breastwork(family, far=False):
    if far:
        box(1.1, 0, 0, .14, CELL, .5, 'timber', 0); return
    for i in range(4): box(1.1, -1.05 + i * .7, 0, .08, .08, .66, 'timber', 0)
    for z in range(4): box(1.1 + (.03 if z % 2 else -.03), 0, .05 + z * .12, .07, CELL, .1, 'timber', 0)


PIECES = [('wall_block', wall_block), ('tower', tower), ('tower_stair', tower_stair), ('gate_frame', gate_frame),
          ('gate_closed', gate_leaves('closed')), ('gate_barred', gate_leaves('barred')), ('gate_open', gate_leaves('open')),
          ('gate_battered', gate_leaves('battered')), ('gate_panel', gate_panel), ('breach_rubble', breach_rubble),
          ('bridge_deck', bridge('deck')), ('bridge_damaged', bridge('damaged')), ('bridge_stumps', bridge('stumps')),
          ('breastwork', breastwork)]


def export(family):
    reports = []
    for root in roots:
        # One mesh per material in each piece: the runtime instances each.
        for name, mat in materials.items():
            chosen = [o for o in list(root.children) if o.type == 'MESH' and o.data.materials[0] == mat]
            if not chosen: continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in chosen: o.select_set(True)
            bpy.context.view_layer.objects.active = chosen[0]; bpy.ops.object.join()
            obj = bpy.context.object; obj.name = root.name + '_' + name; obj.parent = root
            bpy.context.scene.cursor.location = (0, 0, 0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); obj.select_set(False)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
        lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
        tris = sum(len(p.vertices) - 2 for o in root.children for p in o.data.polygons)
        # Blender x, y, z maps to glTF x, z, -y: bounds below are runtime coordinates.
        reports.append({'name': root.name, 'triangles': tris, 'materials': sorted(o.data.materials[0].name for o in root.children),
                        'bounds': {'min': [lo[0], lo[2], -hi[1]], 'max': [hi[0], hi[2], -lo[1]]}})
    bpy.context.scene.unit_settings.system = 'METRIC'; bpy.context.scene.unit_settings.scale_length = 1
    path = os.path.join(PROCESSED, f'board-kit-{family}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=False, export_extras=True,
                              export_image_format='AUTO', export_materials='EXPORT', export_normals=True, export_texcoords=True, export_tangents=False)
    for i, root in enumerate(roots): root.location = ((i % 7) * 4, (i // 7) * 4, 0)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE, f'board-kit-{family}.blend'))
    with open(path, 'rb') as f: raw = f.read()
    report = {'version': 1, 'id': f'board-kit-{family}', 'generator': 'scripts/assets/build-board-kit.py', 'seed': 4024, 'family': family,
              'cell': CELL, 'curtain': FAMILIES[family][0], 'deck': DECK, 'stair': STAIR,
              'authorship': 'Original Blender-authored geometry and original deterministic surface bakes; no external images',
              'licence': 'Created for the Imperium project; no third-party source assets', 'components': reports,
              'materials': [{'name': m.name, 'size': 512, 'channels': ['baseColor', 'metallicRoughness', 'normal'],
                             'authorship': 'Original deterministic procedural bake'} for m in materials.values()],
              'output': {'path': f'art-source/models/processed/board-kit-{family}.glb', 'bytes': len(raw),
                         'sha256': hashlib.sha256(raw).hexdigest(), 'triangles': sum(r['triangles'] for r in reports)},
              'runtimePath': f'assets/models/scenery/board-kit-{family}.glb'}
    with open(os.path.join(PROCESSED, f'board-kit-{family}.json'), 'w', encoding='utf-8') as f: json.dump(report, f, indent=2); f.write('\n')
    print(json.dumps(report['output']))
    return report


reports = []
for family, (height, kind, masonry, timber) in FAMILIES.items():
    if opts.only and opts.only != family: continue
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0: block.remove(item)
    rng = random.Random(4024); roots = []; current = None
    materials = {'masonry': bake(f'Board {family} masonry', kind, masonry), 'timber': bake(f'Board {family} timber', 'planks', timber),
                 'iron': bake(f'Board {family} iron', 'iron', (.2, .2, .21), 256)}
    for name, build in PIECES:
        for far in (False, True):
            component(name + ('_far' if far else '')); build(family, far)
    reports.append(export(family))

if not opts.only:
    bounds = {r['id']: {c['name']: {'min': [round(v, 3) for v in c['bounds']['min']], 'max': [round(v, 3) for v in c['bounds']['max']]}
                        for c in r['components']} for r in reports}
    with open(os.path.join(REPO, 'src', 'showcase', 'board-kit-components.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/assets/build-board-kit.py: each piece\'s runtime bounds in metres\n')
        f.write('// (x east, y up, z south), its cell centred at the origin and its face toward +x.\n')
        f.write('export const BOARD_KIT_COMPONENTS = ' + json.dumps(bounds, indent=2) + ';\n')
        f.write('for (const kit of Object.values(BOARD_KIT_COMPONENTS)) { for (const box of Object.values(kit)) { Object.freeze(box.min); Object.freeze(box.max); Object.freeze(box); } Object.freeze(kit); }\nObject.freeze(BOARD_KIT_COMPONENTS);\n')
