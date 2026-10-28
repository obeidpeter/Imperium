"""Wrap the game's own head onto a named man's generated head, beside his generated body.

Development tool. Like bind-character.py, it needs Blender: either Blender's Python
module (`pip install bpy`) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/wrap-cast-head.py --body cast.glb --donor recruit.glb --output cast-body.glb [options]

The head's paint comes from --paint when given: the same body bound again with larger maps
(bind-character.py --texture 2048), as his body ships with a 1,024-pixel map that gives his
face only a corner of it.

The game's named men share one head, the recruit's, cut at the neck: it carries their
blinks and expressions as morph targets placed at its features (generated-identity.js).
A cast member's own generated head has his shape and paint but none of that. This tool
gives the shared head his: it finds the painted eyes on both heads; scales his head so
his eyes stand as far apart as the shared head's, and moves it so they stand where its
eyes do; fits his mouth to its lip line; carries every vertex of the shared head above
the neck onto his surface, the seam and the skin weights unchanged and the scalp kept
within reach of a helmet; unwraps it afresh and bakes his colour, normals and roughness
onto it in Cycles, keeping the shared head's own paint inside its eyes, which its lids
and blinks were made for (--eyes his keeps his). The result ships beside his body, both
bound by bind-character.py to the game's skeleton: body and body-overview (his own body,
cut above the neck) and cast-head and cast-head-overview (the shared head in his shape
and paint; named apart from the skeleton's head joint, as a glTF loader renames a node
that repeats another's name). A JSON report records the landmarks, the fit and the
counts, with a picture of each face as the eye finder saw it.
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
# The shared head's own eyes: within this half-width and half-height of each of its painted
# eyes (metres, on the shared head before the wrap), the head keeps the shared head's paint,
# which its lids and blinks were made for; his own paint has taken over at EYE_FEATHER times
# that. Positions are baked with this offset, as an emission bake keeps no negative values.
EYE_HALF, EYE_FEATHER, ORIGIN_OFFSET = (0.015, 0.0075), 1.6, (0.5, 0.5, -1.0)
# The eye finder, in half-heights and half-widths of millimetres: the dark spot that finds
# an eye's height and its surround; the dark opening, as wide as an eye, that finds its
# middle on that line, and its surround; and how far from the line the opening may lie.
EYE_SPOT, EYE_SPOT_SURROUND, EYE_BOX, EYE_SURROUND, EYE_ROWS = (2, 3), (6, 9), (2, 7), (7, 15), 0.003
# The bake's rays start this far outside the wrapped head and reach this far, as a bald
# head may lie well inside the scalp held near the shared head's; and the share of the
# head's map they may leave unpainted.
CAGE, REACH, UNPAINTED = 0.05, 0.12, 0.002


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--body', required=True, help='his body, bound by bind-character.py (uncompressed .glb)')
    p.add_argument('--donor', required=True, help='the shared head\'s body, bound the same way (uncompressed .glb)')
    p.add_argument('--output', required=True, help='skinned .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--paint', help='his body bound again with larger maps, to bake his head\'s paint from (default: --body)')
    p.add_argument('--texture', type=int, default=1024, help='edge of the head\'s baked colour map in pixels')
    p.add_argument('--detail-texture', type=int, default=512, help='edge of the head\'s baked normal and roughness maps in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--reach', type=float, default=0.03, help='farthest a vertex may move onto his surface, in metres')
    p.add_argument('--scalp-out', type=float, default=0.008, help='farthest the scalp may rise above the shared head\'s, in metres')
    p.add_argument('--scalp-in', type=float, default=0.006, help='farthest the scalp may sink below it, in metres')
    p.add_argument('--max-scale', type=float, default=0.15, help='largest change of his head\'s size, as a fraction')
    p.add_argument('--samples', type=int, default=4, help='Cycles samples per bake')
    p.add_argument('--max-unpainted', type=float, default=UNPAINTED, help='largest share of the head\'s map the bake may leave unpainted')
    p.add_argument('--eyes', choices=('shared', 'his'), default='shared',
                   help='paint inside the eyes: the shared head\'s own (made for its lids and blinks) or his')
    a = p.parse_args(argv)
    if not 64 <= a.texture <= 2048 or not 64 <= a.detail_texture <= 2048 or not 1 <= a.quality <= 100 or not 0 < a.reach <= 0.1:
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
    # The eyes in two looks. First the line they share: the row where each side's darkest
    # spot against its surround (the surround's mean includes the centre) scores best for
    # both together, which a brow, or a shadow under one eye, does not outscore. Then each
    # eye's middle: the dark opening, as wide as an eye, on that line, which a shadowed
    # corner does not pass for.
    def means(a, hi, hj):
        """box() at every point at once."""
        n, m = a.shape
        total = np.zeros((n + 1, m + 1))
        total[1:, 1:] = a.cumsum(0).cumsum(1)
        i0, i1 = np.clip(np.arange(n) - hi, 0, n), np.clip(np.arange(n) + hi + 1, 0, n)
        j0, j1 = np.clip(np.arange(m) - hj, 0, m), np.clip(np.arange(m) + hj + 1, 0, m)
        area = (i1 - i0)[:, None] * (j1 - j0)[None, :]
        return (total[i1][:, j1] - total[i0][:, j1] - total[i1][:, j0] + total[i0][:, j0]) / area
    spot = means(filled, *EYE_SPOT_SURROUND) - means(filled, *EYE_SPOT)
    opening = means(filled, *EYE_SURROUND) - means(filled, *EYE_BOX)
    rows = (zs >= nose.z + 0.012) & (zs <= nose.z + 0.10)
    sides = {side: (sign * (xs - cx) >= 0.016) & (sign * (xs - cx) <= 0.052) for side, sign in (('right', -1), ('left', 1))}
    pair = sum(np.where(sides[side][None, :], spot, -np.inf).max(axis=1) for side in sides)
    line_row = int(np.argmax(np.where(rows, pair, -np.inf)))
    near = np.abs(zs - zs[line_row]) <= EYE_ROWS
    eyes = {}
    for side in ('right', 'left'):
        score = np.where(near[:, None] & sides[side][None, :], opening, -np.inf)
        i, j = np.unravel_index(int(np.argmax(score)), score.shape)
        eyes[side] = {'x': round(float(xs[j]), 4), 'height': round(float(zs[i]), 4), 'depth': round(float(depth[i, j]), 4), 'contrast': round(float(score[i, j]), 4)}
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


def fit_mouth(o, his, shared, limit=0.2):
    """Bring his mouth to the shared head's lip line, where its jaw opens and its lips
    meet (generated-identity.js HEAD_FEATURES): his face between his eyes and his mouth
    is shortened or lengthened to fit, and below his mouth the move fades out by the neck.
    His eyes, brows and scalp stay where the alignment put them. Returns the factor."""
    eye, mouth, target = his['eyeLine'], his['mouth']['height'], shared['mouth']['height']
    k = (eye - target) / (eye - mouth)
    if abs(k - 1) > limit:
        sys.exit(f'His mouth would move by {round((target - mouth) * 1000)} mm: the landmarks disagree (see the report pictures)')
    for v in o.data.vertices:
        z = v.co.z
        if z >= eye:
            continue
        if z >= mouth:
            v.co.z = eye - (eye - z) * k
        else:
            v.co.z = z + (target - mouth) * smooth((z - NECK) / (mouth - NECK))
    o.data.update()
    return k


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


def remember(o):
    """Keep the shared head's own unwrap (as 'donor') and each vertex's place before the wrap
    (as the 'origin' attribute), for the eyes' paint."""
    o.data.uv_layers.active.name = 'donor'
    origin = o.data.color_attributes.new('origin', 'FLOAT_COLOR', 'POINT')
    flat = []
    for v in o.data.vertices:
        flat += [v.co.x + ORIGIN_OFFSET[0], v.co.y + ORIGIN_OFFSET[1], v.co.z + ORIGIN_OFFSET[2], 1.0]
    origin.data.foreach_set('color', flat)


def emission_bake(o, image, source_socket, margin=None):
    """Bake an emission shader onto the target alone (not selected to active) into image:
    source_socket(nodes) returns the colour it emits. A margin given replaces the scene's
    for this bake."""
    material = bpy.data.materials.new('eyes-bake')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    out, emit = nodes.new('ShaderNodeOutputMaterial'), nodes.new('ShaderNodeEmission')
    links.new(source_socket(nodes, links), emit.inputs['Color'])
    links.new(emit.outputs['Emission'], out.inputs['Surface'])
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    nodes.active = node
    saved = list(o.data.materials)
    o.data.materials.clear()
    o.data.materials.append(material)
    bake = bpy.context.scene.render.bake
    bake.use_selected_to_active = False
    kept_margin = bake.margin
    if margin is not None:
        bake.margin = margin
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='EMIT')
    bake.margin = kept_margin
    o.data.materials.clear()
    for m in saved:
        o.data.materials.append(m)
    bpy.data.materials.remove(material)


def finish_colour(head, material, donor_image, eyes, samples, shared, picture, limit):
    """Check the bake painted the whole head, then (with shared) put the shared head's own
    paint inside each eye in place of his, blended out over the feather and matched in
    tone to his where they meet. Returns what was found and changed."""
    import numpy as np
    bpy.context.scene.cycles.samples = samples
    colour = material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
    w, h = colour.size
    def origin_place(nodes, links):
        attribute = nodes.new('ShaderNodeAttribute')
        attribute.attribute_type, attribute.attribute_name = 'GEOMETRY', 'origin'
        return attribute.outputs['Color']
    # Each texel's place on the shared head: once with the bake's margin, for the eyes, and
    # once without, which marks the texels the head itself shows.
    origin, inside = (bpy.data.images.new(name, w, h, alpha=False, float_buffer=True) for name in ('eyes-origin', 'head-inside'))
    for image, margin in ((origin, None), (inside, 0)):
        image.colorspace_settings.name = 'Non-Color'
        emission_bake(head, image, origin_place, margin)

    def read(image):
        pixels = np.empty(w * h * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        return pixels.reshape(h, w, 4)
    his, place = read(colour), read(origin)
    # A texel the head shows that his paint left black is one no ray brought back from him.
    # Below the wrap the neck is the shared head's and hidden by his collar; his own is cut
    # there too, so rays near the cut find nothing.
    seen = read(inside)
    covered, shown_texels = place[..., 0] > 0.01, (seen[..., 0] > 0.01) & (seen[..., 2] - ORIGIN_OFFSET[2] >= WRAP_FROM)
    holes = shown_texels & (his[..., :3].sum(axis=2) < 0.003)
    unpainted = float(holes.sum() / max(1, shown_texels.sum()))
    if unpainted > limit:
        shown = np.where(holes[..., None], [1.0, 0.0, 1.0, 1.0], his).astype(np.float32)
        out = bpy.data.images.new('unpainted', w, h, alpha=False)
        out.pixels.foreach_set(shown.ravel())
        out.filepath_raw, out.file_format = picture, 'PNG'
        out.save()
        sys.exit(f'The bake left {round(unpainted * 100, 2)}% of his head unpainted: his surface lies beyond the rays\' reach (see the report pictures)')
    result = {'unpainted': round(unpainted, 5)}
    if shared:
        donor = bpy.data.images.new('eyes-donor', w, h, alpha=False)

        def donor_paint(nodes, links):
            uv, tex = nodes.new('ShaderNodeUVMap'), nodes.new('ShaderNodeTexImage')
            uv.uv_map, tex.image = 'donor', donor_image
            links.new(uv.outputs['UV'], tex.inputs['Vector'])
            return tex.outputs['Color']
        emission_bake(head, donor, donor_paint)
        theirs = read(donor)
        x, y, z = (place[..., i] - ORIGIN_OFFSET[i] for i in range(3))
        mask = np.zeros((h, w), dtype=np.float32)
        for e in eyes.values():
            d = np.hypot((x - e['x']) / EYE_HALF[0], (z - e['height']) / EYE_HALF[1])
            t = np.clip((d - 1) / (EYE_FEATHER - 1), 0, 1)
            front = -y > e['depth'] - 0.03
            mask = np.maximum(mask, np.where(front & covered, 1 - t * t * (3 - 2 * t), 0))
        ring = (mask > 0.05) & (mask < 0.6)
        gain = np.clip(his[ring, :3].mean(axis=0) / np.maximum(theirs[ring, :3].mean(axis=0), 1e-3), 0.75, 1.33) if ring.any() else np.ones(3)
        blended = his.copy()
        blended[..., :3] = his[..., :3] * (1 - mask[..., None]) + np.clip(theirs[..., :3] * gain, 0, 1) * mask[..., None]
        colour.pixels.foreach_set(blended.ravel())
        colour.update()
        colour.pack()
        bpy.data.images.remove(donor)
        result['sharedEyes'] = {'changed': round(float((mask > 0.01).mean()), 4), 'toneGain': [round(float(g), 3) for g in gain]}
    for image in (origin, inside):
        bpy.data.images.remove(image)
    return result


def bake_head(head, source, size, detail, samples):
    """A fresh unwrap of the wrapped head, and his colour, normals and roughness baked onto
    it, from rays that start CAGE outside it: his hair may stand that far off the scalp held
    near the shared head's, and a bald scalp lie well inside it."""
    maps.unwrap(head, keep=('donor',))
    return maps.bake_maps(head, source, 'head', colour=size, detail=detail, samples=samples, cage=CAGE, distance=REACH)


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
    paint_path = os.path.abspath(a.paint) if a.paint else body_path
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    pictures = os.path.splitext(report_path)[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    his = import_glb(body_path, 'his')
    shared = import_glb(donor_path, 'shared')
    # His generated head, above the neck: what the shared head takes its shape and paint from.
    paint = import_glb(paint_path, 'paint') if a.paint else his
    source = copy_of(paint['body'], 'his:head')
    cut(source, HEAD_FROM, keep_above=True)
    found = {'his': landmarks(Surface(source), pictures + '-his-face.png'),
             'shared': landmarks(Surface(shared['body']), pictures + '-shared-face.png')}
    scale = align(source, found['his'], found['shared'], a.max_scale)
    mouth = fit_mouth(source, landmarks(Surface(source)), found['shared'])
    found['hisAligned'] = landmarks(Surface(source), pictures + '-his-aligned-face.png')
    heads, fits = {}, {}
    for level, mesh_name in (('cast-head', 'body'), ('cast-head-overview', 'body-overview')):
        head = copy_of(shared[mesh_name], level)
        cut(head, HEAD_FROM, keep_above=True)
        weld(head)
        if level == 'cast-head':
            donor_image = colour_image(head)
            remember(head)
        fits[level] = wrap(head, source, a.reach, a.scalp_out, a.scalp_in)
        heads[level] = head
    material = bake_head(heads['cast-head'], source, a.texture, a.detail_texture, a.samples)
    finish = finish_colour(heads['cast-head'], material, donor_image, found['shared']['eyes'], a.samples, a.eyes == 'shared', pictures + '-unpainted.png', a.max_unpainted)
    near = heads['cast-head'].data
    near.uv_layers.remove(near.uv_layers['donor'])
    near.color_attributes.remove(near.color_attributes['origin'])
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
        'paint': {'path': character.shown(paint_path), 'sha256': character.digest(paint_path)},
        'output': {'path': character.shown(output), 'bytes': os.path.getsize(output), 'sha256': character.digest(output),
                   'triangles': {o.name: character.triangles([o]) for o in (his['body'], his['body-overview'], heads['cast-head'], heads['cast-head-overview'])}},
        'settings': {'texture': a.texture, 'detailTexture': a.detail_texture, 'webpQuality': a.quality, 'reach': a.reach, 'scalpOut': a.scalp_out, 'scalpIn': a.scalp_in,
                     'maxScale': a.max_scale, 'samples': a.samples, 'bakeCage': CAGE, 'bakeReach': REACH, 'eyes': a.eyes, 'eyeHalf': EYE_HALF, 'eyeFeather': EYE_FEATHER,
                     'eyeFinder': {'spot': EYE_SPOT, 'spotSurround': EYE_SPOT_SURROUND, 'opening': EYE_BOX, 'openingSurround': EYE_SURROUND, 'rows': EYE_ROWS}, 'neck': NECK, 'headFrom': HEAD_FROM, 'bodyTo': BODY_TO,
                     'wrapFrom': WRAP_FROM, 'wrapFull': WRAP_FULL, 'scalp': SCALP},
        'landmarks': found,
        'fit': {'scale': round(scale, 4), 'mouthFit': round(mouth, 4), **fits, **finish},
        'pictures': [character.shown(pictures + f'-{k}-face.png') for k in ('his', 'shared', 'his-aligned', 'wrapped')],
    }
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'fit', 'landmarks')}, indent=1))


if __name__ == '__main__':
    main()
