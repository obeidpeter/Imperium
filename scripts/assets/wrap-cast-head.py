"""Wrap the game's own head onto a named man's generated head, beside his generated body.

Development tool. Like bind-character.py, it needs Blender: either Blender's Python
module (`pip install bpy`) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/wrap-cast-head.py --body cast.glb --donor recruit.glb --output cast-body.glb [options]

The game's named men share one head, the recruit's, cut at the neck: it carries their
blinks and expressions as morph targets placed at its features (generated-identity.js).
A cast member's own generated head has his shape and paint but none of that. This tool
gives the shared head his: it finds the painted eyes on both heads; scales his head so
his eyes stand as far apart as the shared head's, and moves it so they stand where its
eyes do; carries every vertex of the shared head above the neck onto his surface, the
seam and the skin weights unchanged and the scalp kept within reach of a helmet; unwraps
it afresh and bakes his colour, normals and roughness onto it in Cycles. The result ships beside his
body, both bound by bind-character.py to the game's skeleton: body and body-overview
(his own body, cut above the neck) and cast-head and cast-head-overview (the shared head in
his shape and paint; named apart from the skeleton's head joint, as a glTF loader renames
a node that repeats another's name). A JSON report records the landmarks, the fit and the counts, with a
picture of each face as the eye finder saw it.
"""
import argparse
import importlib.util
import json
import math
import os
import sys

import bpy  # Blender's Python module provides mathutils once bpy is loaded.
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


character, maps = _load('bind_character', 'bind-character.py'), _load('bake_maps', 'bake-maps.py')

# The game's neck cut (generated-identity.js IDENTITY_NECK_HEIGHT). The shared head is
# kept from a little below it, so the game's own cut makes the seam it always has; his
# body is kept to a little above it, for the same reason.
NECK = 1.50
HEAD_FROM, BODY_TO = 1.45, 1.55
# Where the wrap starts and finishes taking hold above the seam, and the scalp's height.
WRAP_FROM, WRAP_FULL, SCALP = 1.52, 1.57, 1.69


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--body', required=True, help='his body, bound by bind-character.py (uncompressed .glb)')
    p.add_argument('--donor', required=True, help='the shared head\'s body, bound the same way (uncompressed .glb)')
    p.add_argument('--output', required=True, help='skinned .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--texture', type=int, default=512, help='edge of the head\'s baked maps in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--reach', type=float, default=0.03, help='farthest a vertex may move onto his surface, in metres')
    p.add_argument('--scalp-out', type=float, default=0.008, help='farthest the scalp may rise above the shared head\'s, in metres')
    p.add_argument('--scalp-in', type=float, default=0.006, help='farthest the scalp may sink below it, in metres')
    p.add_argument('--max-scale', type=float, default=0.15, help='largest change of his head\'s size, as a fraction')
    p.add_argument('--samples', type=int, default=4, help='Cycles samples per bake')
    a = p.parse_args(argv)
    if not 64 <= a.texture <= 2048 or not 1 <= a.quality <= 100 or not 0 < a.reach <= 0.1:
        p.error('settings out of range')
    return a


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def import_glb(path, tag):
    """Import a bound body; its meshes come back unparented with every transform applied,
    named tag:<mesh>, their vertex groups kept. The imported skeleton is removed: the
    output gets the game's own (bind-character.py's game_armature)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, import_pack_images=True, disable_bone_shape=True, guess_original_bind_pose=False)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = {}
    for o in new:
        if o.type != 'MESH':
            continue
        world = o.matrix_world.copy()
        for m in list(o.modifiers):
            o.modifiers.remove(m)
        o.parent = None
        o.matrix_world = world
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        name = o.name.split('.')[0]
        o.name = o.data.name = f'{tag}:{name}'
        meshes[name] = o
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    if 'body' not in meshes or 'body-overview' not in meshes:
        sys.exit(f'{path} needs body and body-overview meshes (bind-character.py --overview-triangles)')
    return meshes


def cut(o, height, keep_above):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, height), plane_no=(0, 0, 1),
                           clear_inner=keep_above, clear_outer=not keep_above)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def weld(o, distance=1e-5):
    """One vertex where the importer split it along texture and normal seams, so the wrap
    moves both sides of a seam together; the skin weights stay."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=distance)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def copy_of(o, name):
    c = o.copy()
    c.data = o.data.copy()
    c.name = c.data.name = name
    bpy.context.scene.collection.objects.link(c)
    return c


def colour_image(o):
    return next((n.image for m in o.data.materials if m and m.node_tree for n in m.node_tree.nodes
                 if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB'), None)


class Surface:
    """Ray casts against a mesh in world space (its transforms applied), with the colour
    of its texture where a ray lands."""

    def __init__(self, o):
        import numpy as np
        self.bm = bmesh.new()
        self.bm.from_mesh(o.data)
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])
        self.bm.faces.ensure_lookup_table()
        self.uv = self.bm.loops.layers.uv.active
        self.bvh = BVHTree.FromBMesh(self.bm)
        image = colour_image(o)
        if image is None:
            sys.exit(f'{o.name} has no colour texture')
        w, h = image.size
        pixels = np.empty(w * h * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        self.pixels, self.size = pixels.reshape(h, w, 4), (w, h)

    def front(self, x, z):
        """The first point met by a ray from in front (Blender -Y) at (x, z), and its colour."""
        loc, _, index, _ = self.bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)), 2.0)
        if loc is None:
            return None, None
        face = self.bm.faces[index]
        a, b, c = (l.vert.co for l in face.loops)
        ua, ub, uc = (Vector((l[self.uv].uv.x, l[self.uv].uv.y, 0)) for l in face.loops)
        u, v, _ = barycentric_transform(loc, a, b, c, ua, ub, uc)
        w, h = self.size
        return loc, self.pixels[min(h - 1, max(0, int(v % 1.0 * h))), min(w - 1, max(0, int(u % 1.0 * w))), :3]


def landmarks(surface, picture=None):
    """The face's centre line and nose tip (its most forward point, 12 to 21 cm below the
    crown, which keeps a thick fringe out), and each painted eye: the darkest spot against
    its surround, either side of the nose, above its tip."""
    import numpy as np
    crown = max(v.co.z for v in surface.bm.verts)
    best = None
    for z in np.arange(crown - 0.21, crown - 0.12, 0.003):
        for x in np.arange(-0.07, 0.04, 0.003):
            loc, _ = surface.front(x, z)
            if loc is not None and (best is None or -loc.y > -best.y):
                best = loc
    cx, nose = best.x, best
    step = 0.001
    xs, zs = np.arange(cx - 0.065, cx + 0.065, step), np.arange(nose.z - 0.08, nose.z + 0.12, step)
    lum = np.full((len(zs), len(xs)), np.nan)
    depth = np.full((len(zs), len(xs)), np.nan)
    rgb = np.zeros((len(zs), len(xs), 3))
    for i, z in enumerate(zs):
        for j, x in enumerate(xs):
            loc, colour = surface.front(x, z)
            if loc is not None:
                rgb[i, j] = colour
                lum[i, j] = 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2]
                depth[i, j] = -loc.y
    filled = np.where(np.isnan(lum), np.nanmean(lum), lum)

    def box(a, i, j, hi, hj):
        return a[max(0, i - hi):i + hi + 1, max(0, j - hj):j + hj + 1].mean()
    eyes = {}
    for side, sign in (('right', -1), ('left', 1)):
        top = None
        for i in range(len(zs)):
            if not nose.z + 0.012 <= zs[i] <= nose.z + 0.10:
                continue
            for j in range(len(xs)):
                off = (xs[j] - cx) * sign
                if not 0.016 <= off <= 0.052:
                    continue
                centre, surround = box(filled, i, j, 2, 3), box(filled, i, j, 6, 9)
                # The surround's mean includes the centre; the score is the centre's darkness against it.
                score = surround - centre
                if top is None or score > top[0]:
                    top = (score, xs[j], zs[i], depth[i, j])
        eyes[side] = {'x': round(float(top[1]), 4), 'height': round(float(top[2]), 4), 'depth': round(float(top[3]), 4), 'contrast': round(float(top[0]), 4)}
    line = (eyes['left']['height'] + eyes['right']['height']) / 2
    # The brows: the darkest band a little above each eye; the mouth: the darkest line across
    # the centre between the nose and the chin.
    def band(lo, hi, offsets, half_height, half_width):
        top = None
        for i in range(len(zs)):
            if not lo <= zs[i] <= hi:
                continue
            for j in range(len(xs)):
                if not offsets(xs[j] - cx):
                    continue
                value = box(filled, i, j, half_height, half_width)
                if top is None or value < top[0]:
                    top = (value, xs[j], zs[i])
        return {'x': round(float(top[1]), 4), 'height': round(float(top[2]), 4)}
    brows = {side: band(line + 0.006, line + 0.035, lambda off, s=sign: 0.015 <= off * s <= 0.05, 1, 6) for side, sign in (('right', -1), ('left', 1))}
    mouth = band(nose.z - 0.07, nose.z - 0.012, lambda off: abs(off) <= 0.004, 1, 9)
    if picture:
        save_picture(picture, rgb, xs, zs, cx, nose, {**eyes, **{f'brow-{k}': v for k, v in brows.items()}, 'mouth': mouth})
    return {'centreX': round(float(cx), 4), 'crown': round(float(crown), 4), 'nose': [round(float(nose.z), 4), round(float(-nose.y), 4)], 'eyes': eyes,
            'eyeLine': round(line, 4), 'eyeDepth': round((eyes['left']['depth'] + eyes['right']['depth']) / 2, 4),
            'brows': brows, 'browLine': round((brows['left']['height'] + brows['right']['height']) / 2, 4), 'mouth': mouth,
            'eyeLevelGap': round(abs(eyes['left']['height'] - eyes['right']['height']), 4)}


def save_picture(path, rgb, xs, zs, cx, nose, eyes):
    """The face as the eye finder saw it, with the centre line, the nose tip and the eyes marked."""
    import numpy as np
    image = np.clip(rgb[::-1].copy(), 0, 1)
    h, w = image.shape[:2]

    def mark(x, z, colour):
        j, i = int(round((x - xs[0]) / (xs[1] - xs[0]))), h - 1 - int(round((z - zs[0]) / (zs[1] - zs[0])))
        for di in range(-2, 3):
            for dj in range(-2, 3):
                if 0 <= i + di < h and 0 <= j + dj < w and (abs(di) == 2 or abs(dj) == 2):
                    image[i + di, j + dj] = colour
    for i in range(h):
        j = int(round((cx - xs[0]) / (xs[1] - xs[0])))
        if 0 <= j < w and i % 4 < 2:
            image[i, j] = (0.2, 0.8, 1.0)
    mark(nose.x, nose.z, (1.0, 0.3, 0.2))
    for e in eyes.values():
        mark(e['x'], e['height'], (0.2, 1.0, 0.3))
    out = bpy.data.images.new('eye-finder', w, h, alpha=False)
    out.pixels.foreach_set(np.concatenate([image[::-1].reshape(-1, 3), np.ones((h * w, 1))], axis=1).astype(np.float32).ravel())
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)


def align(o, his, shared, max_scale):
    """Scale his head uniformly so his eyes stand as far apart as the shared head's (the
    steadiest of a face's measures: a long nose or chin stays his own), then move it so his
    eyes stand where the shared head's do, on its eye line and at its depth."""
    spacing = lambda found: abs(found['eyes']['left']['x'] - found['eyes']['right']['x'])
    s = spacing(shared) / spacing(his)
    if abs(s - 1) > max_scale:
        sys.exit(f'His head would change size by {round((s - 1) * 100)}%: the landmarks disagree (see the report pictures)')
    middle = lambda found: (found['eyes']['left']['x'] + found['eyes']['right']['x']) / 2
    pivot = Vector((middle(his), -his['eyeDepth'], his['eyeLine']))
    target = Vector((middle(shared), -shared['eyeDepth'], shared['eyeLine']))
    for v in o.data.vertices:
        v.co = target + (v.co - pivot) * s
    o.data.update()
    return s


def wrap(o, target, reach, scalp_out, scalp_in):
    """Carry the shared head's vertices onto his surface: the nearest point along each
    vertex's normal, either way, or failing that the nearest point within reach. The
    seam stays, the scalp is held near the shared head's, and the moves are smoothed."""
    surface = BVHTree.FromObject(target, bpy.context.evaluated_depsgraph_get())
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    moves, held, missed = [Vector() for _ in bm.verts], 0, 0
    for v in bm.verts:
        if v.co.z < WRAP_FROM:
            continue
        hit = None
        for d in (v.normal, -v.normal):
            loc, _, _, dist = surface.ray_cast(v.co, d, reach)
            if loc is not None and (hit is None or dist < hit[1]):
                hit = (loc, dist)
        if hit is None:
            loc, _, _, dist = surface.find_nearest(v.co, reach)
            hit = (loc, dist) if loc is not None else None
        if hit is None:
            missed += 1
            continue
        move = hit[0] - v.co
        if v.co.z > SCALP:
            along = move.dot(v.normal)
            limited = min(scalp_out, max(-scalp_in, along))
            if limited != along:
                held += 1
            move = move - v.normal * (along - limited)
        moves[v.index] = move
    # Two passes of neighbour averaging take out single-vertex spikes (ears, nostrils).
    for _ in range(2):
        moves = [(m * 2 + sum((moves[e.other_vert(v).index] for e in v.link_edges), Vector())) / (2 + len(v.link_edges)) if v.co.z >= WRAP_FROM else m
                 for v, m in zip(bm.verts, moves)]
    largest = 0.0
    for v, m in zip(bm.verts, moves):
        move = m * smooth((v.co.z - WRAP_FROM) / (WRAP_FULL - WRAP_FROM))
        largest = max(largest, move.length)
        v.co += move
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return {'scalpHeld': held, 'missed': missed, 'largestMove': round(largest, 4)}


def bake_head(head, source, size, samples):
    """A fresh unwrap of the wrapped head, and his colour, normals and roughness baked onto
    it. Rays start 4 cm out, since his hair may stand that far off the scalp held near the
    shared head's."""
    maps.unwrap(head)
    return maps.bake_maps(head, source, 'head', colour=size, samples=samples, cage=0.04, distance=0.08)


def transfer_uvs(target, source):
    """The overview takes the near head's unwrap, face corner by nearest face, into a
    layer of the same name."""
    name = source.data.uv_layers.active.name
    for layer in [layer.name for layer in target.data.uv_layers]:
        target.data.uv_layers.remove(target.data.uv_layers[layer])
    target.data.uv_layers.new(name=name)
    if target.data.uv_layers[0].name != name:
        sys.exit(f'Could not name the overview\'s unwrap {name}')
    mod = target.modifiers.new('uvs', 'DATA_TRANSFER')
    mod.object = source
    mod.use_loop_data = True
    mod.data_types_loops = {'UV'}
    mod.loop_mapping = 'POLYINTERP_NEAREST'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)


def main():
    a = parse_args()
    body_path, donor_path, output = (os.path.abspath(p) for p in (a.body, a.donor, a.output))
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    pictures = os.path.splitext(report_path)[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    his = import_glb(body_path, 'his')
    shared = import_glb(donor_path, 'shared')
    # His generated head, above the neck: what the shared head takes its shape and paint from.
    source = copy_of(his['body'], 'his:head')
    cut(source, HEAD_FROM, keep_above=True)
    found = {'his': landmarks(Surface(source), pictures + '-his-face.png'),
             'shared': landmarks(Surface(shared['body']), pictures + '-shared-face.png')}
    scale = align(source, found['his'], found['shared'], a.max_scale)
    found['hisAligned'] = landmarks(Surface(source), pictures + '-his-aligned-face.png')
    heads, fits = {}, {}
    for level, mesh_name in (('cast-head', 'body'), ('cast-head-overview', 'body-overview')):
        head = copy_of(shared[mesh_name], level)
        cut(head, HEAD_FROM, keep_above=True)
        weld(head)
        fits[level] = wrap(head, source, a.reach, a.scalp_out, a.scalp_in)
        heads[level] = head
    material = bake_head(heads['cast-head'], source, a.texture, a.samples)
    transfer_uvs(heads['cast-head-overview'], heads['cast-head'])
    heads['cast-head-overview'].data.materials.clear()
    heads['cast-head-overview'].data.materials.append(material)
    # The overview's colours, for views drawn without textures (the fallen), from his paint.
    for attribute in list(heads['cast-head-overview'].data.color_attributes):
        heads['cast-head-overview'].data.color_attributes.remove(attribute)
    character.bake_vertex_colours(heads['cast-head-overview'])
    found['wrapped'] = landmarks(Surface(heads['cast-head']), pictures + '-wrapped-face.png')
    # His body, from a little above the neck down.
    for name in ('body', 'body-overview'):
        cut(his[name], BODY_TO, keep_above=False)
        his[name].name = his[name].data.name = name
    for o in list(bpy.data.objects):
        if o not in (his['body'], his['body-overview'], heads['cast-head'], heads['cast-head-overview']):
            bpy.data.objects.remove(o, do_unlink=True)
    rig = character.game_armature()
    for o in (his['body'], his['body-overview'], heads['cast-head'], heads['cast-head-overview']):
        character.skin(o, rig)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', export_image_format='WEBP', export_image_quality=a.quality,
        export_yup=True, export_tangents=False, export_cameras=False, export_lights=False, export_extras=False,
        export_animations=False, export_skins=True, export_morph=False, export_def_bones=False,
        export_rest_position_armature=True, export_vertex_color='ACTIVE')
    report = {
        'tool': 'scripts/assets/wrap-cast-head.py',
        'blender': bpy.app.version_string,
        'body': {'path': character.shown(body_path), 'sha256': character.digest(body_path)},
        'donor': {'path': character.shown(donor_path), 'sha256': character.digest(donor_path)},
        'output': {'path': character.shown(output), 'bytes': os.path.getsize(output), 'sha256': character.digest(output),
                   'triangles': {o.name: character.triangles([o]) for o in (his['body'], his['body-overview'], heads['cast-head'], heads['cast-head-overview'])}},
        'settings': {'texture': a.texture, 'webpQuality': a.quality, 'reach': a.reach, 'scalpOut': a.scalp_out, 'scalpIn': a.scalp_in,
                     'maxScale': a.max_scale, 'samples': a.samples, 'neck': NECK, 'headFrom': HEAD_FROM, 'bodyTo': BODY_TO,
                     'wrapFrom': WRAP_FROM, 'wrapFull': WRAP_FULL, 'scalp': SCALP},
        'landmarks': found,
        'fit': {'scale': round(scale, 4), **fits},
        'pictures': [character.shown(pictures + f'-{k}-face.png') for k in ('his', 'shared', 'his-aligned', 'wrapped')],
    }
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'fit', 'landmarks')}, indent=1))


if __name__ == '__main__':
    main()
