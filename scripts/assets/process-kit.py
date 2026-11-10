"""Turn a generated item model (an inventory Tripo GLB) into kit a figure carries.

Development tool. Like bind-character.py, it needs Blender: either Blender's Python
module (`pip install bpy`) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/process-kit.py --input item.glb --output kit.glb --kind sword --length 0.62 [options]

Steps: import and join; weld the importer's seam splits. A weapon's longest axis is laid
along +Y (glTF), the flat of its blade or its axe head across X and its thickness along Z.
Its grip end goes down: a sword's or a knife's guard, its widest section, sits just above
the grip, while an axe's head, its widest part, is at the far end from it and points to +X.
It is scaled to --length and its origin put at the middle of its grip, where the figure's
hand holds it. A standard (--kind standard) is laid out as a weapon, its ornament or cloth, its widest
part, at the top and across X; it is scaled to its height (--length) and held a tenth of the way up
its pole, where the code-built standard it replaces is carried, its pole set upright (a heavy ornament
can tip the longest axis off it) and turned about it by --turn degrees so its face looks along +Z. A helmet loses any display stand under its rim (everything below the lowest
section half as wide as the widest), is turned about the vertical by --turn degrees so its
face looks along +Z, scaled to --height and stood on the origin, centred. Then the near level is
decimated to --triangles (a collapse can stop short of it where Tripo's surfaces cross; the
report says where); a copy drawn together on the finest grid that fits --overview-triangles
takes the texture's colours into its vertices, for the figure's overview level, which draws
without textures;
the maps are shrunk (--texture colour, --detail-texture normal and roughness/metal); and
one GLB is exported with two meshes, `near` and `overview`. A JSON report records digests,
settings, the orientation found and counts.
"""
import argparse
import importlib.util
import json
import math
import os
import sys

import bpy  # Blender's Python module provides mathutils once bpy is loaded.
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


character = _load('bind_character', 'bind-character.py')
weld_and_shade, triangles, digest, shown = (
    character.weld_and_shade, character.triangles, character.digest, character.shown)
bake_vertex_colours, shrink_textures = character.bake_vertex_colours, character.shrink_textures

KINDS = ('sword', 'axe', 'helmet', 'standard')
# A standard is held a tenth of the way up its pole, where the figure's standard joint carries the
# code-built pole it replaces (actors.js: its foot 0.14 m below the joint, its top 1.28 m above).
STANDARD_GRIP = 0.1
SLICES = 48


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--input', required=True, help='Tripo text-to-model item .glb')
    p.add_argument('--output', required=True, help='kit .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--kind', required=True, choices=KINDS, help='sword (and knife), axe, helmet or standard (a pole with its ornament or cloth at the top)')
    p.add_argument('--length', type=float, help='a weapon\'s length from grip end to tip, or a standard\'s height from foot to top, in metres')
    p.add_argument('--height', type=float, help='a helmet\'s height, in metres')
    p.add_argument('--turn', type=float, default=0.0, help='a helmet\'s or a standard\'s turn about the vertical, in degrees, so it faces +Z')
    p.add_argument('--triangles', type=int, default=1200, help='triangle budget of the near level')
    p.add_argument('--overview-triangles', type=int, default=160, help='triangle budget of the overview level')
    p.add_argument('--texture', type=int, default=256, help='longest edge of the colour map in pixels')
    p.add_argument('--detail-texture', type=int, default=256, help='longest edge of the normal and roughness/metal maps in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--sharp-angle', type=float, default=45.0, help='edges sharper than this stay hard, in degrees')
    a = p.parse_args(argv)
    weapon = a.kind != 'helmet'
    if weapon and not (a.length and a.length > 0):
        p.error('a weapon needs --length')
    if not weapon and not (a.height and a.height > 0):
        p.error('a helmet needs --height')
    if a.triangles < 100 or not 16 <= a.overview_triangles < a.triangles or not 16 <= a.texture <= 4096 \
            or not 16 <= a.detail_texture <= 4096 or not 1 <= a.quality <= 100:
        p.error('budgets out of range')
    return a


def load(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source, import_pack_images=True, disable_bone_shape=True, guess_original_bind_pose=False)
    for o in [o for o in bpy.data.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    parts = [o for o in bpy.data.objects if o.type == 'MESH']
    if not parts:
        sys.exit('No mesh in ' + source)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(parts) > 1:
        bpy.ops.object.join()
    item = bpy.context.view_layer.objects.active
    item.name = item.data.name = 'near'
    return item


def decimate(o, budget):
    """Collapse toward the budget in up to four passes. Tripo's surfaces cross one another, and a
    collapse leaves alone the edges that three or more faces share, so a piece can stop short of
    its budget; the report records where it stopped."""
    for _ in range(4):
        total = triangles([o])
        if total <= budget * 1.05:
            break
        character.decimate([o], budget)
        if triangles([o]) > 0.95 * total:
            break
    return triangles([o])


def cluster(o, budget):
    """The overview level: the near level's vertices drawn together on a grid, each cell's at
    their mean, on the finest grid whose triangles fit the budget, as the game's own overview
    simplifier does. A collapse this far would tear the crossing surfaces apart; a grid keeps
    the piece's outline closed. Where the two faces of a thin plate meet, one is kept."""
    import bmesh
    import numpy as np
    source = o.data.copy()
    co = points(o)
    low = co.min(axis=0)
    size = float((co.max(axis=0) - low).max())

    def build(cell):
        bm = bmesh.new()
        bm.from_mesh(source)
        bm.verts.ensure_lookup_table()
        groups = {}
        for i, key in enumerate(map(tuple, np.floor((co - low) / cell).astype(np.int64))):
            groups.setdefault(key, []).append(i)
        targets = {}
        for members in groups.values():
            first = bm.verts[members[0]]
            first.co = co[members].mean(axis=0)
            for i in members[1:]:
                targets[bm.verts[i]] = first
        bmesh.ops.weld_verts(bm, targetmap=targets)
        seen, twins = set(), []
        for f in bm.faces:
            key = frozenset(f.verts)
            if len(key) < 3 or key in seen:
                twins.append(f)
            seen.add(key)
        bmesh.ops.delete(bm, geom=twins, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bmesh.ops.triangulate(bm, faces=bm.faces)
        return bm

    fine, coarse, best = size / 400, size / 3, None
    for _ in range(16):
        cell = (fine * coarse) ** 0.5
        bm = build(cell)
        if len(bm.faces) <= budget:
            if best:
                best[1].free()
            best, coarse = (cell, bm), cell
        else:
            bm.free()
            fine = cell
    if best is None:
        best = (coarse, build(coarse))
    cell, bm = best
    bm.to_mesh(o.data)
    bm.free()
    bpy.data.meshes.remove(source)
    o.data.update()
    return round(cell, 5)


def points(o):
    import numpy as np
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def transform(o, matrix):
    o.data.transform(matrix)
    o.data.update()


def widths(co):
    """The X extent of each slice along Z, bottom to top: where a guard or a head is."""
    import numpy as np
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    index = np.minimum(SLICES - 1, ((co[:, 2] - z0) / max(z1 - z0, 1e-9) * SLICES).astype(int))
    out = np.zeros(SLICES)
    for i in range(SLICES):
        x = co[index == i, 0]
        if len(x):
            out[i] = x.max() - x.min()
    return out


def orient_weapon(o, kind, length):
    """Longest axis up (Blender +Z, glTF +Y), the blade's flat across X; the grip end down."""
    import numpy as np
    co = points(o)
    centre = co.mean(axis=0)
    values, vectors = np.linalg.eigh(np.cov((co - centre).T))
    up, across, thick = (vectors[:, i] for i in np.argsort(values)[::-1])
    rows = np.array([across, thick, up])
    if np.linalg.det(rows) < 0:
        rows[1] = -rows[1]
    turn = Matrix([list(rows[0]) + [0], list(rows[1]) + [0], list(rows[2]) + [0], [0, 0, 0, 1]])
    transform(o, turn @ Matrix.Translation(-centre))
    profile = widths(points(o))
    widest = int(np.argmax(profile))
    # A guard sits low, just above the grip; an axe's head and a standard's ornament or cloth sit high,
    # away from it.
    flipped = widest > SLICES / 2 if kind == 'sword' else widest < SLICES / 2
    if flipped:
        transform(o, Matrix.Rotation(math.pi, 4, 'X'))
        profile = profile[::-1]
        widest = SLICES - 1 - widest
    lean = upright_pole(o) if kind == 'standard' else None
    co = points(o)
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    if kind == 'axe':
        top = co[co[:, 2] > z0 + (z1 - z0) * 0.65]
        if top[:, 0].mean() < 0:
            transform(o, Matrix.Rotation(math.pi, 4, 'Z'))
            co = points(o)
    scale = length / (z1 - z0)
    span = z1 - z0
    # The hand holds a sword between its pommel and its guard, an axe near the end of its haft, and a
    # standard's pole a tenth of the way up.
    grip = z0 + (widest / SLICES * span) / 2 if kind == 'sword' else z0 + (STANDARD_GRIP if kind == 'standard' else 0.16) * span
    low = co[co[:, 2] < grip + 0.05 * span]
    centre = ((low[:, 0].max() + low[:, 0].min()) / 2, (low[:, 1].max() + low[:, 1].min()) / 2, grip)
    transform(o, Matrix.Scale(scale, 4) @ Matrix.Translation([-c for c in centre]))
    return {'flipped': bool(flipped), 'widestSlice': widest, 'slices': SLICES,
            'gripFromEnd': round((grip - z0) / span, 4), 'scale': round(scale, 6),
            **({'poleLeanDegrees': lean} if lean is not None else {}),
            'widthProfile': [round(float(w), 4) for w in profile]}


def upright_pole(o):
    """A standard's longest axis leans where its ornament or cloth is heavier on one side: its pole is set
    upright, by the line through the centres of its bare lower slices (from a twentieth to two fifths of
    its height, below any ornament or cloth). Returns the lean taken out, in degrees."""
    import numpy as np
    co = points(o)
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    span = z1 - z0
    centres = []
    for i in range(8):
        lo, hi = z0 + span * (0.05 + 0.35 * i / 8), z0 + span * (0.05 + 0.35 * (i + 1) / 8)
        band = co[(co[:, 2] >= lo) & (co[:, 2] < hi)]
        if len(band):
            centres.append(((band[:, 0].max() + band[:, 0].min()) / 2, (band[:, 1].max() + band[:, 1].min()) / 2, (lo + hi) / 2))
    if len(centres) < 3:
        return 0.0
    c = np.array(centres)
    dx, dy = np.polyfit(c[:, 2], c[:, 0], 1)[0], np.polyfit(c[:, 2], c[:, 1], 1)[0]
    axis = np.array([dx, dy, 1.0]) / math.sqrt(dx * dx + dy * dy + 1)
    lean = math.degrees(math.acos(max(-1.0, min(1.0, axis[2]))))
    if lean > 1e-3:
        from mathutils import Vector
        transform(o, Vector(axis.tolist()).rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4())
    return round(lean, 3)


def strip_stand(o):
    """A display stand under a helmet (a narrow post below the rim) goes: everything below the
    lowest section at least half as wide as the widest."""
    import bmesh
    import numpy as np
    profile = widths(points(o))
    rim = int(np.argmax(profile >= 0.5 * profile.max()))
    if rim == 0:
        return 0.0
    co = points(o)
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    cut = z0 + rim / SLICES * (z1 - z0)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    doomed = [f for f in bm.faces if all(v.co.z < cut for v in f.verts)]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return round(rim / SLICES, 4)


def stand_helmet(o, turn, height):
    import numpy as np
    stand = strip_stand(o)
    transform(o, Matrix.Rotation(math.radians(turn), 4, 'Z'))
    co = points(o)
    lo, hi = co.min(axis=0), co.max(axis=0)
    scale = height / (hi[2] - lo[2])
    transform(o, Matrix.Scale(scale, 4) @ Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))
    return {'turnDegrees': turn, 'scale': round(scale, 6), 'standCutBelow': stand}


def bounds(o):
    co = points(o)
    lo, hi = co.min(axis=0), co.max(axis=0)
    # Blender is Z-up; the exported glTF is Y-up: x, y (up), z (forward) = x, z, -y.
    return {'min': [round(float(lo[0]), 4), round(float(lo[2]), 4), round(float(-hi[1]), 4)],
            'max': [round(float(hi[0]), 4), round(float(hi[2]), 4), round(float(-lo[1]), 4)]}


def main():
    a = parse_args()
    source = os.path.abspath(a.input)
    output = os.path.abspath(a.output)
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    item = load(source)
    before = triangles([item])
    weld_and_shade(item, a.sharp_angle)
    fit = orient_weapon(item, a.kind, a.length) if a.kind != 'helmet' else stand_helmet(item, a.turn, a.height)
    if a.kind == 'standard':
        # Which way a standard's ornament looks is not in its outline: --turn faces it to +Z, where the
        # figure that carries it on its back looks.
        transform(item, Matrix.Rotation(math.radians(a.turn), 4, 'Z'))
        fit['turnDegrees'] = a.turn
    decimate(item, a.triangles)
    overview = item.copy()
    overview.data = item.data.copy()
    overview.name = overview.data.name = 'overview'
    bpy.context.scene.collection.objects.link(overview)
    cell = cluster(overview, a.overview_triangles)
    textures = shrink_textures(a.texture, a.detail_texture)
    coloured = bake_vertex_colours(overview)
    if not coloured:
        sys.exit('The model has no colour map to bake into its overview level.')
    bpy.data.orphans_purge(do_recursive=True)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', export_image_format='WEBP', export_image_quality=a.quality,
        export_apply=True, export_yup=True, export_tangents=False, export_cameras=False, export_lights=False,
        export_extras=False, export_animations=False, export_skins=False, export_morph=False, export_vertex_color='ACTIVE')
    report = {
        'tool': 'scripts/assets/process-kit.py',
        'blender': bpy.app.version_string,
        'input': {'path': shown(source), 'bytes': os.path.getsize(source), 'sha256': digest(source), 'triangles': before},
        'output': {'path': shown(output), 'bytes': os.path.getsize(output), 'sha256': digest(output),
                   'triangles': triangles([item]), 'overviewTriangles': triangles([overview])},
        'settings': {'kind': a.kind, 'length': a.length, 'height': a.height, 'turn': a.turn, 'triangles': a.triangles,
                     'overviewTriangles': a.overview_triangles, 'texture': a.texture, 'detailTexture': a.detail_texture,
                     'webpQuality': a.quality, 'sharpAngle': a.sharp_angle},
        'fit': fit,
        'overviewCell': cell,
        'bounds': bounds(item),
        'textures': textures,
    }
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'bounds')}))


if __name__ == '__main__':
    main()
