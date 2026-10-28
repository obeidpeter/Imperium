"""Skin a generated horse to the game's horse skeleton and export a GLB.

Development tool. Like bind-character.py, it needs Blender: either Blender's Python
module (`pip install bpy`) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/bind-horse.py --input horse.glb --output horse-body.glb [options]
  blender --background --python scripts/assets/bind-horse.py -- --input horse.glb --output horse-body.glb [options]

The game animates every horse with one skeleton (src/showcase/actor-horse.js): a root;
the body, with the neck, head, ears and tail on it; and four legs hung from the root at the
body's height, each with a knee and a fetlock joint below it. The code-built horse hangs
each leg straight, its knee 0.53 m below the top and the fetlock 0.53 m below that; a
generated horse keeps its own legs' shape, so its joints are where its own are, and the
game turns each leg from the rest pose this file records. The source is an unrigged Tripo
text-to-model GLB of a horse standing square.

Steps: import and join; turn the horse to face +Z (glTF), its back up; scale it so its
back meets the game's saddle; centre it along its body between its legs; follow each leg's
centre line up from its hoof and put its joints on it: the fetlock joint at the top of the
hoof, the knee at the carpus or the hock, and the top of the leg at the body's height;
mark where each hoof stands (fore-right-sole and so on); find the tail where it hangs at
the middle across at the rear and put the tail joint at its root; weight every vertex to
the skeleton by where it lies: each leg within its own width of its line, by segment, its
hoof rigid, blended into the body below the belly; the neck and head ahead of the withers;
the tail; the rest to the body. It is decimated to the triangle budget, unwrapped afresh
and given its colour, normals and roughness baked from the full-detail mesh, and exported
as one GLB whose skin uses the game's joint names (fore-right-knee and so on: the game's
own rig repeats horse-knee and horse-fetlock on every leg, and maps these onto them), plus
an overview level of detail with baked vertex colours. A JSON report records digests,
settings, the fit and counts.
"""
import argparse
import importlib.util
import json
import math
import os
import sys

import bpy  # Blender's Python module provides mathutils once bpy is loaded.
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


character, maps = _load('bind_character', 'bind-character.py'), _load('bake_maps', 'bake-maps.py')
gltf_to_blender, blender_to_gltf, triangles, digest, shown = (
    character.gltf_to_blender, character.blender_to_gltf, character.triangles, character.digest, character.shown)

# The game's horse skeleton in glTF metres (+Y up, +Z forward, the legs named as the game
# names them: its fore-right leg stands on +X), from actor-horse.js: a root; the body, with
# the neck, head, ears and tail on it; and on the root four legs, each with a knee and a
# fetlock joint below it. The code-built horse hangs each leg straight at LEG_X, LEG_Z, its
# knee SEGMENT below the top and its fetlock SEGMENT below that; a generated horse's joints
# are its own (anatomy): the game turns each leg from the rest pose this file records.
LEGS = ('fore-right', 'fore-left', 'hind-right', 'hind-left')
LEG_X, LEG_Z, BODY_Y, SEGMENT = 0.235, 0.54, 1.04, 0.53
# Heights above the ground, in the scaled horse, of its leg joints: the top of the hoof (the
# fetlock joint carries the hoof), the fore leg's carpus and the hind leg's hock. The top of
# each leg hangs at the body's height a little behind the leg's own line there (the elbow's
# and the stifle's), where the forearm and the gaskin turn.
CORONET, CARPUS, HOCK, TOP_BACK, KNEE_AHEAD = 0.12, 0.47, 0.54, 0.035, 0.015
LINE = [round(0.02 + 0.02 * i, 2) for i in range(40)]


def horse_joints(legs, tail=(0.0, 1.08, -0.78)):
    joints = {
        'horse': (0.0, 0.0, 0.0),
        'horse-body': (0.0, BODY_Y, 0.0),
        'horse-neck': (0.0, BODY_Y, 0.0),
        'horse-head': (0.0, 1.76, 0.87),
        'horse-left-ear': (-0.067, 1.904, 0.881),
        'horse-right-ear': (0.067, 1.904, 0.881),
        'horse-tail': tuple(round(v, 4) for v in tail),
    }
    for leg in LEGS:
        j = legs[leg]
        joints.update({f'{leg}-leg': j['pivot'], f'{leg}-knee': j['knee'], f'{leg}-fetlock': j['coronet']})
    return joints


HORSE_PARENTS = {'horse': None, 'horse-body': 'horse', 'horse-neck': 'horse-body', 'horse-head': 'horse-neck',
                 'horse-left-ear': 'horse-head', 'horse-right-ear': 'horse-head', 'horse-tail': 'horse-body'}
for leg in LEGS:
    HORSE_PARENTS.update({f'{leg}-leg': 'horse', f'{leg}-knee': f'{leg}-leg', f'{leg}-fetlock': f'{leg}-knee'})
# The code-built barrel's top under the saddle (actor-horse.js: the body joint at 1.04 m
# and the trunk's vertical radius there), which the generated back is scaled to meet.
SADDLE_Z, BACK_Y = -0.10, BODY_Y + 0.372
# A first scale, to the ear tips of a horse about 1.45 m at the withers with its head up.
FIRST_HEIGHT = 1.95


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--input', required=True, help='Tripo text-to-model horse .glb')
    p.add_argument('--output', required=True, help='skinned .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--triangles', type=int, default=9000, help='triangle budget of the near mesh')
    p.add_argument('--overview-triangles', type=int, default=1800, help='triangle budget of the overview mesh')
    p.add_argument('--texture', type=int, default=1024, help='longest edge of the colour map in pixels')
    p.add_argument('--detail-texture', type=int, default=512, help='longest edge of the normal and roughness/metal maps in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--sharp-angle', type=float, default=60.0, help='edges sharper than this stay hard, in degrees')
    a = p.parse_args(argv)
    if a.triangles < 500 or a.overview_triangles < 100 or not 16 <= a.texture <= 8192 or not 16 <= a.detail_texture <= 8192 or not 1 <= a.quality <= 100:
        p.error('budgets out of range')
    return a


def load(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source, import_pack_images=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        sys.exit('No mesh in ' + source)
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    # One object, every transform applied: the fit works in world coordinates.
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    horse = bpy.context.view_layer.objects.active
    # Not 'horse': the skeleton's root joint has that name, and loaders rename a node that repeats it.
    horse.name = horse.data.name = 'horse-coat'
    return horse


def coords(o):
    import numpy as np
    co = np.empty(len(o.data.vertices) * 3, dtype=np.float64)
    o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def store(o, co):
    o.data.vertices.foreach_set('co', co.ravel())
    o.data.update()


def orient(o):
    """Head to +Z (glTF), i.e. -Y in Blender; centred; hooves on the ground; and a first
    scale by height, refined under the saddle once the legs are found (fit_back)."""
    import numpy as np
    co = coords(o)
    # The body's long axis is the wider horizontal extent; the head is the end that rises higher.
    span = co.max(0) - co.min(0)
    long_axis = 0 if span[0] > span[1] else 1
    lo, hi = co[:, long_axis].min(), co[:, long_axis].max()
    top = lambda near: co[np.abs(co[:, long_axis] - near) < (hi - lo) * 0.15][:, 2].max()
    head = 1 if top(hi) > top(lo) else -1
    # A turn about the vertical that carries the head onto Blender -Y.
    turn = {(0, 1): -90, (0, -1): 90, (1, 1): 180, (1, -1): 0}[(long_axis, head)]
    x, y = co[:, 0].copy(), co[:, 1].copy()
    if turn == -90:
        co[:, 0], co[:, 1] = y, -x
    elif turn == 90:
        co[:, 0], co[:, 1] = -y, x
    elif turn == 180:
        co[:, 0], co[:, 1] = -x, -y
    co[:, 0] -= (co[:, 0].max() + co[:, 0].min()) / 2
    co[:, 1] -= (co[:, 1].max() + co[:, 1].min()) / 2
    co[:, 2] -= co[:, 2].min()
    scale = FIRST_HEIGHT / co[:, 2].max()
    co *= scale
    store(o, co)
    return turn, scale


def fit_back(o, columns, also=()):
    """Scale about the ground so the back under the saddle meets the code-built horse's.
    The saddle stands between the legs where the game's does, 41% of the way from the hind
    legs to the fore."""
    import numpy as np
    co = coords(o)
    leg_y = {leg: float(np.mean([s[2] for s in samples])) for leg, samples in columns.items()}
    fore, hind = (leg_y['fore-right'] + leg_y['fore-left']) / 2, (leg_y['hind-right'] + leg_y['hind-left']) / 2
    share = (SADDLE_Z + LEG_Z) / (2 * LEG_Z)
    saddle = hind + share * (fore - hind)
    pick = co[(np.abs(co[:, 1] - saddle) < 0.05) & (np.abs(co[:, 0]) < 0.06)]
    scale = BACK_Y / pick[:, 2].max()
    for target in (o, *also):
        store(target, coords(target) * scale)
    return scale, {'saddle': round(-saddle * scale, 4)}


def leg_columns(co):
    """Each leg's centre line, sampled up the leg, from the vertices below the belly."""
    import numpy as np
    mid = (co[:, 1].max() + co[:, 1].min()) / 2
    columns = {}
    for leg in LEGS:
        fore, right = leg.startswith('fore'), leg.endswith('right')
        # Blender -Y is forward; the game's right legs stand on glTF +X, Blender +X.
        side = (co[:, 0] > 0) if right else (co[:, 0] < 0)
        end = (co[:, 1] < mid) if fore else (co[:, 1] > mid)
        samples = []
        for y in (0.08, 0.2, 0.35, 0.5, 0.65):
            pick = co[side & end & (np.abs(co[:, 2] - y) < 0.04)]
            if len(pick) < 4:
                continue
            samples.append((y, float(np.median(pick[:, 0])), float(np.median(pick[:, 1]))))
        if len(samples) < 3:
            sys.exit(f'Could not find the {leg} leg')
        columns[leg] = samples
    return columns


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def belly_line(co):
    """The underline: the lowest point of the body at the middle across, along its length."""
    import numpy as np
    middle = co[np.abs(co[:, 0]) < 0.07]
    edges = np.linspace(co[:, 1].min(), co[:, 1].max(), 41)
    line = []
    for a, b in zip(edges, edges[1:]):
        pick = middle[(middle[:, 1] >= a) & (middle[:, 1] < b) & (middle[:, 2] > 0.45)]
        if len(pick):
            line.append(((a + b) / 2, float(pick[:, 2].min())))
    return line


def belly_at(line, y):
    if not line:
        return 0.75
    best = min(line, key=lambda item: abs(item[0] - y))
    return best[1]


def centre_legs(o, columns, also=()):
    """Move the horse along its body so its fore and hind legs stand evenly either side of
    the middle: half their distance apart is this horse's leg spacing."""
    import numpy as np
    leg_y = {leg: float(np.mean([s[2] for s in samples])) for leg, samples in columns.items()}
    fore, hind = (leg_y['fore-right'] + leg_y['fore-left']) / 2, (leg_y['hind-right'] + leg_y['hind-left']) / 2
    for target in (o, *also):
        co = coords(target)
        co[:, 1] -= (fore + hind) / 2
        store(target, co)
    return (hind - fore) / 2


def leg_lines(co):
    """Each leg's centre line up from its hoof every 2 cm, with its half-width there: the
    middle of what lies about the line's previous point, so it follows the leg's own bends
    (the hind hock behind, the hoof ahead of the fetlock). The hind legs' inner faces lie
    wider than the tail, which hangs between them."""
    import numpy as np
    mid = (co[:, 1].max() + co[:, 1].min()) / 2
    lines = {}
    for leg in LEGS:
        fore, right = leg.startswith('fore'), leg.endswith('right')
        inner = 0.04 if fore else 0.11
        pool = co[((co[:, 0] > inner) if right else (co[:, 0] < -inner)) & ((co[:, 1] < mid) if fore else (co[:, 1] > mid))]
        hoof = pool[pool[:, 2] < 0.05]
        if len(hoof) < 4:
            sys.exit(f'Could not find the {leg} hoof')
        centre = (hoof[:, :2].min(0) + hoof[:, :2].max(0)) / 2
        line = []
        for h in LINE:
            near = pool[(np.abs(pool[:, 2] - h) < 0.015) & (np.hypot(pool[:, 0] - centre[0], pool[:, 1] - centre[1]) < (0.15 if h < 0.5 else 0.2))]
            if len(near) < 3:
                continue
            centre = (near[:, :2].min(0) + near[:, :2].max(0)) / 2
            line.append([h, float(centre[0]), float(centre[1]), float(np.hypot(near[:, 0] - centre[0], near[:, 1] - centre[1]).max())])
        if len(line) < 20:
            sys.exit(f'Could not follow the {leg} leg')
        # Three samples' average steadies it; the ends keep their own.
        steady = [line[0]] + [[line[i][0]] + [sum(line[i + k][c] for k in (-1, 0, 1)) / 3 for c in (1, 2, 3)]
                              for i in range(1, len(line) - 1)] + [line[-1]]
        lines[leg] = steady
    return lines


def line_at(line, h):
    """A leg's centre (x, Blender y) and half-width at height h, between its samples."""
    if h <= line[0][0]:
        return line[0][1:]
    for p0, p1 in zip(line, line[1:]):
        if h <= p1[0]:
            t = (h - p0[0]) / (p1[0] - p0[0])
            return [a + (b - a) * t for a, b in zip(p0[1:], p1[1:])]
    return line[-1][1:]


def anatomy(lines):
    """Each leg's joints in glTF metres from its centre line: the sole under the hoof on the
    ground, the coronet at the top of the hoof, the knee at the carpus or the hock, and the
    top at the body's height."""
    legs = {}
    for leg, line in lines.items():
        fore = leg.startswith('fore')

        def point(h, height=None):
            x, y, _ = line_at(line, h)
            return (round(x, 4), round(h if height is None else height, 4), round(-y, 4))
        top = point(0.62 if fore else 0.74, BODY_Y)
        pivot, coronet, knee = (top[0], top[1], round(top[2] - TOP_BACK, 4)), point(CORONET), point(CARPUS if fore else HOCK)
        if fore:
            # The game bends a fore knee forward, as a carpus folds: its joint stands just ahead
            # of the line from the top of the leg to the fetlock joint, never behind it.
            t = (pivot[1] - knee[1]) / (pivot[1] - coronet[1])
            ahead = pivot[2] + (coronet[2] - pivot[2]) * t + KNEE_AHEAD
            knee = (knee[0], knee[1], round(max(knee[2], ahead), 4))
        legs[leg] = {'sole': point(0.03, 0.0), 'coronet': coronet, 'knee': knee, 'pivot': pivot}
    return legs


def nearest_on_leg(v, j):
    """The nearest point to v (glTF) on a leg's line sole - coronet - knee - top: its
    distance, and how far along the line from the sole it lies."""
    import numpy as np
    points = [np.array(j[k], dtype=float) for k in ('sole', 'coronet', 'knee', 'pivot')]
    best, along_line, start = None, 0.0, 0.0
    for p, q in zip(points, points[1:]):
        d = q - p
        length = float(np.linalg.norm(d))
        t = min(1.0, max(0.0, float(np.dot(v - p, d) / (length * length))))
        distance = float(np.linalg.norm(v - (p + d * t)))
        if best is None or distance < best:
            best, along_line = distance, start + t * length
        start += length
    return best, along_line


def leg_marks(j):
    """How far along a leg's line from the sole its coronet and knee lie."""
    import numpy as np
    sole, coronet, knee = (np.array(j[k], dtype=float) for k in ('sole', 'coronet', 'knee'))
    first = float(np.linalg.norm(coronet - sole))
    return first, first + float(np.linalg.norm(knee - coronet))


def find_tail(o):
    """The tail's root, where the tail joint goes: a little inside the highest point of what
    hangs at the middle across in the horse's last 10 cm (weights() takes the whole tail)."""
    import numpy as np
    co = coords(o)
    forward, height, across = -co[:, 1], co[:, 2], np.abs(co[:, 0])
    rear = float(forward.min())
    strand = np.nonzero((across < 0.07) & (forward < rear + 0.1))[0]
    if not len(strand):
        sys.exit('Could not find the tail')
    top = strand[np.argmax(height[strand])]
    root = (0.0, float(height[top]) - 0.03, float(forward[top]) + 0.02)
    return {'root': root, 'rear': rear, 'vertices': int(len(strand))}


def weights(o, lines, legs, belly, tail):
    """Every vertex's joints and weights by where it lies. A leg takes what lies within its
    own half-width of its line, below the belly: the hoof, the cannon and pastern below the
    knee, and above it the forearm or gaskin, blending into the body. The head and ears ride
    with the neck: the game turns neither on its own, and this horse's are not where its
    joints are."""
    import numpy as np
    co = coords(o)
    mid = (co[:, 1].max() + co[:, 1].min()) / 2
    root = tail['root']
    marks = {leg: leg_marks(j) for leg, j in legs.items()}
    neck_from = legs['fore-right']['sole'][2] - 0.15
    result = []
    for x, y, z in co:
        w = {}
        v = np.array((x, z, -y))
        forward = -y  # glTF z
        leg = ('fore' if y < mid else 'hind') + ('-right' if x > 0 else '-left')
        distance, along_line = nearest_on_leg(v, legs[leg])
        share = (1 - smooth((distance - line_at(lines[leg], z)[2] - 0.015) / 0.05)) * smooth((belly_at(belly, y) + 0.05 - z) / 0.2)
        # The tail: near the middle across in the last quarter metre, below the root, and
        # clear of the hind legs. It hangs below the belly within reach of the hind legs and
        # must not follow them; it is a thick mass, some 18 cm across.
        clear = min(nearest_on_leg(v, legs[h])[0] - line_at(lines[h], z)[2] for h in ('hind-right', 'hind-left'))
        hanging = ((1 - smooth((abs(x) - 0.11) / 0.03)) * (1 - smooth((forward - tail['rear'] - 0.25) / 0.04))
                   * (1 - smooth((z - root[1]) / 0.05)) * smooth((clear + 0.01) / 0.04))
        # The middle line between a pair of legs (chest, belly, groin) stays with the body,
        # so the legs do not pull it apart as they swing.
        share *= (1 - hanging) * smooth((abs(x) - 0.03) / 0.04)
        if share > 0:
            coronet, knee = marks[leg]
            lower = smooth((knee + 0.04 - along_line) / 0.08)
            hoof = smooth((coronet + 0.025 - along_line) / 0.05)
            w[f'{leg}-leg'] = share * (1 - lower)
            w[f'{leg}-knee'] = share * lower * (1 - hoof)
            w[f'{leg}-fetlock'] = share * lower * hoof
        rest = 1 - share
        if rest > 0:
            # Ahead of the withers and above the chest: the neck.
            neck = smooth((forward - neck_from) / 0.3) * smooth((z - 1.12) / 0.2)
            w['horse-body'] = w.get('horse-body', 0) + rest * (1 - max(neck, hanging))
            w['horse-neck'] = rest * neck * (1 - hanging)
            w['horse-tail'] = rest * hanging * (1 - neck)
        top = sorted(((j, value) for j, value in w.items() if value > 1e-4), key=lambda item: -item[1])[:4]
        total = sum(value for _, value in top) or 1
        result.append([(j, value / total) for j, value in top] or [('horse-body', 1.0)])
    return result


def assign(o, folded, joints):
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {name: o.vertex_groups.new(name=name) for name in joints}
    for i, ws in enumerate(folded):
        for joint, v in ws:
            groups[joint].add([i], v, 'REPLACE')


def game_horse(joints, soles):
    """The horse's joints at rest: bones point up with no roll, so every joint exports
    unrotated, and the game binds at its rest pose. Beside them, a point for where each
    hoof stands (fore-right-sole and so on), which the game's legs reach for."""
    data = bpy.data.armatures.new('game-horse')
    rig = bpy.data.objects.new('game-horse', data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, p in joints.items():
        bone = data.edit_bones.new(name)
        bone.head = gltf_to_blender(p)
        bone.tail = bone.head + Vector((0, 0, 0.08))
        bone.roll = 0
    for name, parent in HORSE_PARENTS.items():
        if parent:
            data.edit_bones[name].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for leg, p in soles.items():
        mark = bpy.data.objects.new(f'{leg}-sole', None)
        bpy.context.scene.collection.objects.link(mark)
        mark.parent = rig
        mark.location = gltf_to_blender(p)
    return rig


def main():
    a = parse_args()
    source, output = os.path.abspath(a.input), os.path.abspath(a.output)
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    horse = load(source)
    before = triangles([horse])
    turn, first = orient(horse)
    character.weld_and_shade(horse, a.sharp_angle)
    # The generated mesh at full detail, kept to bake from: a decimation this deep pulls
    # faces across its texture's many islands.
    detailed = horse.copy()
    detailed.data = horse.data.copy()
    detailed.name = detailed.data.name = 'horse-detailed'
    bpy.context.scene.collection.objects.link(detailed)
    character.decimate([horse], a.triangles)
    rescale, stance = fit_back(horse, leg_columns(coords(horse)), also=(detailed,))
    scale = first * rescale
    leg_z = centre_legs(horse, leg_columns(coords(horse)), also=(detailed,))
    # Wider islands than a head needs: the decimated coat is all broad, gently curved surfaces.
    maps.unwrap(horse, angle=85, margin=0.008)
    maps.bake_maps(horse, detailed, 'horse', colour=a.texture, detail=a.detail_texture, cage=0.02, distance=0.05)
    bpy.data.objects.remove(detailed, do_unlink=True)
    lines = leg_lines(coords(horse))
    legs = anatomy(lines)
    tail = find_tail(horse)
    joints = horse_joints(legs, tail['root'])
    folded = weights(horse, lines, legs, belly_line(coords(horse)), tail)
    assign(horse, folded, joints)
    overview = horse.copy()
    overview.data = horse.data.copy()
    overview.name = overview.data.name = 'horse-coat-overview'
    bpy.context.scene.collection.objects.link(overview)
    character.decimate([overview], a.overview_triangles)
    rig = game_horse(joints, {leg: j['sole'] for leg, j in legs.items()})
    for o in (horse, overview):
        character.skin(o, rig)
    textures = character.shrink_textures(a.texture, a.detail_texture)
    coloured = character.bake_vertex_colours(overview)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', export_image_format='WEBP', export_image_quality=a.quality,
        export_yup=True, export_tangents=False, export_cameras=False, export_lights=False, export_extras=False,
        export_animations=False, export_skins=True, export_morph=False, export_def_bones=False,
        export_rest_position_armature=True, export_vertex_color='ACTIVE')
    counts = {}
    for ws in folded:
        for joint, v in ws:
            if v >= 0.5:
                counts[joint] = counts.get(joint, 0) + 1
    report = {
        'tool': 'scripts/assets/bind-horse.py',
        'blender': bpy.app.version_string,
        'input': {'path': shown(source), 'bytes': os.path.getsize(source), 'sha256': digest(source), 'triangles': before},
        'output': {'path': shown(output), 'bytes': os.path.getsize(output), 'sha256': digest(output),
                   'triangles': triangles([horse]), 'overviewTriangles': triangles([overview])},
        'settings': {'triangles': a.triangles, 'overviewTriangles': a.overview_triangles, 'texture': a.texture,
                     'detailTexture': a.detail_texture, 'webpQuality': a.quality, 'sharpAngle': a.sharp_angle},
        'fit': {'turnDegrees': turn, 'scale': round(scale, 5), **stance, 'legSpacing': round(2 * leg_z, 4), 'legZ': round(leg_z, 4), 'bakedFromFullDetail': True,
                'legs': legs,
                'legLines': {leg: [[round(v, 4) for v in sample] for sample in line[::4]] for leg, line in lines.items()},
                'tailRoot': [round(v, 4) for v in tail['root']], 'tailVertices': tail['vertices'],
                'joints': {name: list(p) for name, p in joints.items()},
                'verticesByJoint': counts, 'overviewVertexColours': coloured},
        'bounds': character.bounds([horse]),
        'textures': textures,
    }
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'fit')}, indent=1))


if __name__ == '__main__':
    main()
