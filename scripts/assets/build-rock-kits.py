"""Assemble the regional rock kits in Blender (worlds and gameplay plan, release 5).

  "$BLENDER_PYTHON" scripts/assets/build-rock-kits.py -- --repo . [--only arid]
  blender --background --python-exit-code 1 --python scripts/assets/build-rock-kits.py -- --repo .

One GLB per biome group from the four Tripo rocks processed for it (process-model.py:
art-source/models/processed/rock-<kit>-<name>.glb, each standing on its base at the origin):
  temperate  boulder, outcrop, river stones, slab        Chapters I-IV, VIII, X
  italy      outcrop, slab, travertine, tuff             Chapters VII, XI, XII
  arid       basalt, outcrop, sandstone, slab            Chapters V, VI, IX
Each rock comes twice, as named roots at its foot: `<rock>` near, as processed, and
`<rock>_far`, decimated toward a tenth of its triangles for the distance. Each keeps its own
material, with its colour and normal maps; the game gives it one roughness, so the
roughness-metalness map is left out. Writes art-source/models/processed/rocks-<kit>.glb and its report, and
src/showcase/rock-kit-components.js (each rock's bounds, so the runtime fits it to the
footprint the code-built stone would have had).
"""
import argparse
import hashlib
import json
import os
import sys

import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
parser.add_argument('--only', default='')
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
PROCESSED = os.path.join(REPO, 'art-source', 'models', 'processed')

KITS = {
    'temperate': {'chapters': [1, 2, 3, 4, 8, 10], 'rocks': ['boulder', 'outcrop', 'river-stones', 'slab']},
    'italy': {'chapters': [7, 11, 12], 'rocks': ['outcrop', 'slab', 'travertine', 'tuff']},
    'arid': {'chapters': [5, 6, 9], 'rocks': ['basalt', 'outcrop', 'sandstone', 'slab']},
}
FAR_RATIO = .1


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def import_rock(path):
    """The processed rock as one mesh object at the origin, its foot on z = 0."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o != obj and o.name in bpy.data.objects: bpy.data.objects.remove(o)
    return obj


def plain_surface(obj):
    """The rock's colour and normal maps only: the game draws it as its stone, with one roughness
    and no metal (environment-materials.js), so the roughness-metalness map is not shipped."""
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes: continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf: continue
        for name, value in (('Roughness', .9), ('Metallic', 0.)):
            for link in list(bsdf.inputs[name].links): mat.node_tree.links.remove(link)
            bsdf.inputs[name].default_value = value
        used = {l.from_node for l in mat.node_tree.links}
        for node in [n for n in mat.node_tree.nodes if n.type in ('TEX_IMAGE', 'SEPARATE_COLOR', 'SEPRGB') and n not in used]:
            mat.node_tree.nodes.remove(node)


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_kit(kit):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rocks, roots = [], []
    for name in KITS[kit]['rocks']:
        rid = f'rock-{kit}-{name}'
        src = os.path.join(PROCESSED, f'{rid}.glb')
        near = import_rock(src)
        near.name = f'{rid}_mesh'
        plain_surface(near)
        r = root(rid); near.parent = r; roots.append(r)
        far = near.copy(); far.data = near.data.copy(); far.name = f'{rid}_far_mesh'
        bpy.context.scene.collection.objects.link(far)
        # The decimation keeps the texture's seams, so a rock stops at 200-680 triangles.
        mod = far.modifiers.new('distance', 'DECIMATE'); mod.ratio = FAR_RATIO; mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = far
        bpy.ops.object.modifier_apply(modifier=mod.name)
        rf = root(f'{rid}_far'); far.parent = rf; roots.append(rf)
        xs, ys, zs = zip(*[tuple(v.co) for v in near.data.vertices])
        with open(src, 'rb') as f: digest = hashlib.sha256(f.read()).hexdigest()
        # Bounds in glTF axes (y up): Blender's x, z and -y.
        rocks.append({'id': rid, 'source': f'art-source/models/processed/{rid}.glb', 'sourceSha256': digest,
                      'min': [round(min(xs), 4), round(min(zs), 4), round(-max(ys), 4)],
                      'max': [round(max(xs), 4), round(max(zs), 4), round(-min(ys), 4)],
                      'triangles': {'near': tris(near), 'far': tris(far)}})
    path = os.path.join(PROCESSED, f'rocks-{kit}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=False, export_extras=True,
                              export_image_format='AUTO', export_materials='EXPORT', export_normals=True, export_texcoords=True, export_tangents=False)
    with open(path, 'rb') as f: raw = f.read()
    report = {'version': 1, 'id': f'rocks-{kit}', 'generator': 'scripts/assets/build-rock-kits.py', 'kit': kit, 'chapters': KITS[kit]['chapters'],
              'farRatio': FAR_RATIO, 'rocks': rocks,
              'output': {'path': f'art-source/models/processed/rocks-{kit}.glb', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                         'triangles': sum(r['triangles']['near'] + r['triangles']['far'] for r in rocks)},
              'runtimePath': f'assets/models/scenery/rocks-{kit}.glb'}
    with open(os.path.join(PROCESSED, f'rocks-{kit}.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2); f.write('\n')
    print(json.dumps(report['output']))
    return report


reports = [build_kit(kit) for kit in KITS if not opts.only or opts.only == kit]
if not opts.only:
    data = {r['kit']: {k['id']: {'min': k['min'], 'max': k['max']} for k in r['rocks']} for r in reports}
    with open(os.path.join(REPO, 'src', 'showcase', 'rock-kit-components.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/assets/build-rock-kits.py: each kit rock\'s bounds in metres, its foot at the origin (glTF axes).\n')
        f.write('export const ROCK_KIT_COMPONENTS = ' + json.dumps(data, indent=2) + ';\n')
        f.write('for (const kit of Object.values(ROCK_KIT_COMPONENTS)) { for (const r of Object.values(kit)) Object.freeze(r); Object.freeze(kit); }\nObject.freeze(ROCK_KIT_COMPONENTS);\n')
