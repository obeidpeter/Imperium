"""Turn a generated model (for example a Tripo GLB) into a game-ready GLB.

Development tool. It needs Blender: either Blender's Python module (`pip install
bpy`, which needs the matching Python version) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/process-model.py --input raw.glb --output out.glb [options]
  blender --background --python scripts/assets/process-model.py -- --input raw.glb --output out.glb [options]

Steps: import; for a static prop, drop cameras, lights, rigs, morphs and
animation; bake every transform into the meshes; merge duplicate vertices;
decimate every part by the same ratio to meet the triangle budget (parts
stay separate: each material is its own draw either way, and joining would
drop differently named colour attributes); mark sharp edges by angle; scale to
a height in metres if one is given; stand the model on its base at the origin;
shrink textures to the size budget; export one GLB with WebP textures (glTF
EXT_texture_webp, which three.js reads natively). --keep-skin keeps the
armature, skin weights, morphs and clips for a character instead, and changes
only scale and textures; ask the generator for the triangle budget. The file's
default pose becomes the bind pose, so a skinned part can move a few
centimetres: check the preview.

A JSON report records the input and output digests, every setting, triangle
counts, bounds in metres and texture sizes. Use it in the asset manifest.
"""
import argparse
import hashlib
import json
import math
import os
import sys

import bpy  # Blender's Python module provides bmesh and mathutils once bpy is loaded.
import bmesh
from mathutils import Matrix, Vector


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--input', required=True, help='source .glb or .gltf')
    p.add_argument('--output', required=True, help='processed .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--triangles', type=int, default=8000, help='triangle budget after decimation')
    p.add_argument('--texture', type=int, default=1024, help='longest texture edge in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--height', type=float, help='scale uniformly to this height in metres')
    p.add_argument('--sharp-angle', type=float, default=35.0, help='edges sharper than this stay hard, in degrees')
    p.add_argument('--merge-distance', type=float, default=0.0001, help='weld vertices closer than this, in metres')
    p.add_argument('--keep-skin', action='store_true', help='keep armature, skin weights, morphs and animation')
    a = p.parse_args(argv)
    if a.triangles < 12 or not 16 <= a.texture <= 8192 or not 1 <= a.quality <= 100:
        p.error('budgets out of range')
    if a.height is not None and not 0.01 <= a.height <= 500:
        p.error('height out of range')
    return a


REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def shown(path):
    """Repository-relative inside the repository, absolute elsewhere."""
    rel = os.path.relpath(path, REPO)
    return path if rel.startswith('..') else rel.replace(os.sep, '/')


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def triangles():
    return sum(len(p.vertices) - 2 for o in meshes() for p in o.data.polygons)


def bounds():
    lo, hi = Vector((math.inf,) * 3), Vector((-math.inf,) * 3)
    for o in meshes():
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def apply_modifiers(o):
    """Bake the evaluated mesh (all modifiers) into the object's own data."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph)
    old = o.data
    o.modifiers.clear()
    o.data = baked
    if old.users == 0:
        bpy.data.meshes.remove(old)


def flatten_static():
    """One static mesh: no rig, morphs, animation, cameras or lights.

    The armature is baked, not removed: parts carried by bones (a shield, a
    spear, a head) stay where the rig places them instead of collapsing to
    their bones' origins. Imported without guessing a bind pose, the rest
    pose is the file's default pose (what three.js shows), so it is baked
    there rather than at a frame of whichever clip the importer made active."""
    for rig in [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']:
        rig.animation_data_clear()
        rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    for o in meshes():
        o.shape_key_clear()
        apply_modifiers(o)
        world = o.matrix_world.copy()
        o.parent = None
        o.data.transform(world)
        o.matrix_world = Matrix.Identity(4)
    for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    return meshes()


def weld_and_shade(o, merge_distance, sharp_angle):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge_distance)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    limit = math.radians(sharp_angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not (e.is_boundary or not e.is_manifold or (len(e.link_faces) == 2 and e.calc_face_angle(0) > limit))
    bm.to_mesh(o.data)
    bm.free()
    # Imported custom normals no longer match the welded, decimated surface.
    if o.data.has_custom_normals:
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()


def decimate(parts, budget, floor=64):
    """One collapse ratio for every part; parts this small are left whole."""
    for _ in range(4):
        total = triangles()
        if total <= budget:
            return
        fixed = sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons if len(o.data.polygons) <= floor)
        ratio = max(0.001, (budget - fixed) / max(1, total - fixed) * 0.98)
        for o in parts:
            if len(o.data.polygons) > floor:
                m = o.modifiers.new('budget', 'DECIMATE')
                m.decimate_type = 'COLLAPSE'
                m.ratio = ratio
                m.use_collapse_triangulate = True
                apply_modifiers(o)


def stand_on_origin(height):
    lo, hi = bounds()
    if not math.isfinite(lo.x):
        raise SystemExit('The model has no geometry.')
    scale = height / (hi.z - lo.z) if height else 1.0
    centre = Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for o in meshes():
        o.data.transform(Matrix.Scale(scale, 4) @ centre @ o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    return scale


def shrink_textures(limit):
    sizes = []
    for image in bpy.data.images:
        if image.users == 0 or image.size[0] == 0:
            continue
        w, h = image.size
        if max(w, h) > limit:
            k = limit / max(w, h)
            image.scale(max(1, round(w * k)), max(1, round(h * k)))
        sizes.append({'name': image.name, 'width': image.size[0], 'height': image.size[1]})
    return sizes


def main():
    a = parse_args()
    source = os.path.abspath(a.input)
    output = os.path.abspath(a.output)
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # No bone display shape: the importer would add a hidden icosphere mesh.
    bpy.ops.import_scene.gltf(filepath=source, import_pack_images=True, disable_bone_shape=True,
                              guess_original_bind_pose=False)
    for helper in [o for c in bpy.data.collections if c.name.startswith('glTF_not_exported') for o in c.objects]:
        bpy.data.objects.remove(helper, do_unlink=True)
    before = triangles()
    if a.keep_skin:
        for o in meshes():
            for m in [m for m in o.modifiers if m.type != 'ARMATURE']:
                o.modifiers.remove(m)
        rig = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
        if rig is None:
            raise SystemExit('--keep-skin needs a rigged input.')
        # The skinned surface, its weights and morphs stay exactly as delivered:
        # ask the generator for the triangle budget. Only scale and textures change.
        scale = 1.0
        if a.height:
            lo, hi = bounds()
            scale = a.height / (hi.z - lo.z)
            rig.scale *= scale
    else:
        parts = flatten_static()
        if not parts:
            raise SystemExit('The model has no meshes.')
        for o in parts:
            weld_and_shade(o, a.merge_distance, a.sharp_angle)
        decimate(parts, a.triangles)
        scale = stand_on_origin(a.height)
    after = triangles()
    textures = shrink_textures(a.texture)
    bpy.data.orphans_purge(do_recursive=True)
    lo, hi = bounds()
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', export_image_format='WEBP', export_image_quality=a.quality,
        export_apply=True, export_yup=True, export_tangents=False, export_cameras=False, export_lights=False,
        export_extras=False, export_animations=a.keep_skin, export_skins=a.keep_skin, export_morph=a.keep_skin)
    report = {
        'tool': 'scripts/assets/process-model.py',
        'blender': bpy.app.version_string,
        'input': {'path': shown(source), 'bytes': os.path.getsize(source), 'sha256': digest(source), 'triangles': before},
        'output': {'path': shown(output), 'bytes': os.path.getsize(output), 'sha256': digest(output), 'triangles': after},
        'settings': {'triangles': a.triangles, 'texture': a.texture, 'webpQuality': a.quality, 'height': a.height,
                     'sharpAngle': a.sharp_angle, 'mergeDistance': a.merge_distance, 'keepSkin': a.keep_skin},
        'scale': scale,
        # Blender is Z-up; the exported glTF is Y-up: width x, height y, depth z.
        'sizeMetres': {'width': round(hi.x - lo.x, 4), 'height': round(hi.z - lo.z, 4), 'depth': round(hi.y - lo.y, 4)},
        'materials': len([m for m in bpy.data.materials if m.users]),
        'textures': textures,
    }
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'sizeMetres', 'materials')}))


main()
