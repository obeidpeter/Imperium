"""Shared helpers for Imperium's Blender-built kits (the Curia, the Aurelian Walls).

Imported by the build scripts beside it, which run under Blender's Python (the `bpy`
module that `npm run asset:setup` installs). Geometry is given in runtime metres
(x east, y up, z south) and gathered in one `bmesh` per component and material without
operators, which is fast and leaves no stray material slots; `export` makes one mesh of
each, box-projects its UVs in metres and writes the GLB, the editable .blend and a
JSON report. Surfaces are deterministic procedural bakes from seeded noise: a base
colour, a glTF roughness-metalness map and a tangent-space normal map. No source images.
"""
import hashlib
import json
import math
import os

import bpy
import bmesh  # after bpy, which puts Blender's own modules on the path
import numpy as np
from mathutils import Matrix, Vector

materials = {}
roots = []
parts = {}
current = None


def reset():
    """An empty scene and no pieces."""
    global current
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0: block.remove(item)
    materials.clear(); roots.clear(); parts.clear(); current = None


# --- Surfaces ---------------------------------------------------------------------------------
def periodic_noise(size, cells, seed):
    """Smooth value noise that tiles over the image."""
    r = np.random.default_rng(seed).random((cells, cells)).astype(np.float32)
    g = np.linspace(0, cells, size, endpoint=False)
    i0 = np.floor(g).astype(int); t = g - i0; t = t * t * (3 - 2 * t); i1 = (i0 + 1) % cells
    a = r[np.ix_(i0, i0)]; b = r[np.ix_(i0, i1)]; c = r[np.ix_(i1, i0)]; d = r[np.ix_(i1, i1)]
    tx = t[None, :]; ty = t[:, None]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(size, seed):
    out = sum(periodic_noise(size, cells, seed + i * 17) * amp for i, (cells, amp) in enumerate(((4, 1), (8, .5), (16, .25), (32, .125))))
    return out / 1.875


def grid(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    return x, y


def marble(size, seed, base, vein, strength, slope=(2, 1), width=1.):
    """A veined stone: warped periodic bands, faint clouding and a few hairline veins."""
    x, y = grid(size)
    n, cloud = fbm(size, seed), fbm(size, seed + 5) - .5
    band = np.abs(np.sin((x * slope[0] + y * slope[1]) * math.tau + n * 8))
    veins = np.exp(-(band / (.07 * width)) ** 2) * .55 + np.exp(-(band / (.016 * width)) ** 2) * .45
    hair = np.abs(np.sin((x * 3 - y * 2) * math.tau + fbm(size, seed + 9) * 11))
    veins = np.maximum(veins, np.exp(-(hair / .012) ** 2) * .35)
    k = veins[..., None] * strength
    return np.clip(np.array(base)[None, None] * (1 + cloud[..., None] * .12) * (1 - k) + np.array(vein)[None, None] * k, .01, .97)


def speckled(size, seed, base, speck, density):
    """Porphyry and serpentine: a dark ground with pale crystals."""
    x, y = grid(size)
    cloud = fbm(size, seed) - .5
    dots = (np.random.default_rng(seed).random((size, size)) > 1 - density).astype(np.float32)
    dots = np.maximum(dots, np.roll(dots, 1, 0) * .6)
    colour = np.array(base)[None, None] * (1 + cloud[..., None] * .18)
    return np.clip(colour * (1 - dots[..., None]) + np.array(speck)[None, None] * dots[..., None], .01, .97)


def joints(*distances, width=.0022):
    """1 on the face, falling to 0 in a cut joint (for the normal map)."""
    d = np.minimum.reduce([np.abs(v) for v in distances])
    return np.clip(d / width, 0, 1) ** .6


def bake(name, colour, height, rough, repeat, offset=0., metal=0.):
    """A textured material from a colour field, a height field (1 on the face, 0 in a cut
    joint) and a base roughness; `repeat` metres to one tile, `offset` lifting its foot."""
    size = colour.shape[0]
    rgba = np.ones((size, size, 4), np.float32); rgba[..., :3] = colour
    orm = np.ones((size, size, 4), np.float32)
    orm[..., 1] = np.clip(rough + (1 - height) * .25, .2, 1); orm[..., 2] = metal
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * size / 96
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * size / 96
    # Blender images run bottom-up: +v is up the image, as glTF's +Y tangent expects.
    nrm = np.dstack([-gx, gy, np.ones_like(gx)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    normal = np.ones((size, size, 4), np.float32); normal[..., :3] = nrm * .5 + .5
    images = []
    for suffix, pixels, data in (('colour', rgba, False), ('orm', orm, True), ('normal', normal, True)):
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
    mat.diffuse_color = (*colour.reshape(-1, 3).mean(0), 1)
    mat['uv_repeat'] = repeat; mat['uv_offset'] = offset
    return mat


def plain(name, base, metal, rough):
    """An untextured material: factors only (the game's normaliser gives it neutral maps)."""
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Metallic'].default_value = metal; bsdf.inputs['Roughness'].default_value = rough
    mat.diffuse_color = (*base, 1)
    mat['uv_repeat'] = 1.; mat['uv_offset'] = 0.
    return mat


# --- Geometry (runtime coordinates in, Blender out) ----------------------------------------------
def B(x, y, z):
    """Runtime (x east, y up, z south) to Blender (x east, y north, z up)."""
    return Vector((x, -z, y))


def take(bm, mat, smooth=False, bevel=0.):
    """Merge a finished piece into its component's mesh of that material. `smooth` shades
    every face smooth or flat; None keeps each face's own setting."""
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)
    target = parts.setdefault((current.name, mat), bmesh.new())
    bm.verts.index_update()
    new = [target.verts.new(v.co) for v in bm.verts]
    for f in bm.faces:
        face = target.faces.new([new[v.index] for v in f.verts]); face.smooth = f.smooth if smooth is None else smooth
    bm.free()


def cube_bm(x0, x1, y0, y1, z0, z1):
    x0, x1, y0, y1, z0, z1 = min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), None,
                                                                  Vector((x1 - x0, z1 - z0, y1 - y0))))
    return bm, min(x1 - x0, y1 - y0, z1 - z0)


def box(x0, x1, y0, y1, z0, z1, mat, bevel=0.):
    """An axis-aligned box by its runtime extents."""
    bm, least = cube_bm(x0, x1, y0, y1, z0, z1)
    take(bm, mat, bevel=bevel if least > bevel * 4 else 0)


def cone_bm(matrix, r, r2, depth, sides):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides, radius1=r, radius2=r2, depth=depth, matrix=matrix)
    # Smooth sides, flat caps.
    for f in bm.faces: f.smooth = len(f.verts) == 4
    return bm


def cylinder(x, z, y0, y1, r, mat, sides=14, r2=None):
    take(cone_bm(Matrix.Translation(B(x, (y0 + y1) / 2, z)), r, r if r2 is None else r2, y1 - y0, sides), mat, smooth=None)


def beam(a, b, r, mat, sides=6):
    av, bv = B(*a), B(*b)
    matrix = Matrix.Translation((av + bv) / 2) @ (bv - av).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    take(cone_bm(matrix, r, r, (bv - av).length, sides), mat, smooth=None)


def sphere(x, y, z, r, mat, segments=16, rings=8, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=r,
                              matrix=Matrix.LocRotScale(B(x, y, z), None, Vector((scale[0], scale[2], scale[1]))))
    take(bm, mat, smooth=True)


def torus(x, y, z, major, minor, mat, tilt=0., majors=18, minors=6):
    """A ring facing south (+z), tipped back by `tilt` radians."""
    bm = bmesh.new()
    rot = Matrix.Rotation(-tilt, 4, 'X')
    vs = []
    for i in range(majors):
        u = math.tau * i / majors
        for j in range(minors):
            v = math.tau * j / minors
            local = Vector(((major + minor * math.cos(v)) * math.cos(u), (major + minor * math.cos(v)) * math.sin(u), minor * math.sin(v)))
            # The ring's own plane is runtime x-y; its axis runs north-south.
            p = rot @ Vector((local.x, local.z, local.y))
            vs.append(bm.verts.new(B(x, y, z) + Vector((p.x, p.y, p.z))))
    for i in range(majors):
        for j in range(minors):
            a, b = i * minors + j, ((i + 1) % majors) * minors + j
            c, d = ((i + 1) % majors) * minors + (j + 1) % minors, i * minors + (j + 1) % minors
            bm.faces.new((vs[a], vs[b], vs[c], vs[d]))
    take(bm, mat, smooth=True)


def mesh(name, vertices, faces, mat, thickness=0., closed=False, smooth=False):
    bm = bmesh.new()
    vs = [bm.verts.new(B(*v)) for v in vertices]
    for f in faces: bm.faces.new([vs[i] for i in f])
    if thickness: bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thickness)
    if closed or thickness:
        # A closed shell's faces all point outward, whatever order its outline ran in.
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    take(bm, mat, smooth=smooth)


def prism(outline, axis, near, far, mat):
    """Extrude a closed outline of (u, y) points between two planes across `axis` ('x' or 'z');
    u runs along the other horizontal axis."""
    n = len(outline)
    put = (lambda u, y, w: (w, y, u)) if axis == 'x' else (lambda u, y, w: (u, y, w))
    vertices = [put(u, y, near) for u, y in outline] + [put(u, y, far) for u, y in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    mesh('prism', vertices, faces, mat, closed=True)


def scratch_object(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(obj)
    return obj


def component(name, authorship):
    """A new component root at the origin; the pieces that follow belong to it."""
    global current
    current = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(current)
    current['component'] = name
    current['units'] = 'metres'
    current['authorship'] = authorship
    roots.append(current)
    return current


def slab_with_openings(x0, x1, z0, z1, openings, across, height, mat='stucco', bottom=0.):
    """A wall's core, `across` the axis through its thickness, with openings
    (centre, bottom, width, top, arched): an arched one is round-headed above `top`.
    The openings are boolean differences, read from the evaluated mesh."""
    slab = scratch_object(cube_bm(x0, x1, bottom, height, z0, z1)[0], 'slab')
    thick = abs(z1 - z0) if across == 'z' else abs(x1 - x0)
    mid = (z0 + z1) / 2 if across == 'z' else (x0 + x1) / 2
    cutters = []
    for centre, low, width, top, arched in openings:
        if across == 'z': cutters.append(scratch_object(cube_bm(centre - width / 2, centre + width / 2, low, top, mid - thick, mid + thick)[0], 'cut'))
        else: cutters.append(scratch_object(cube_bm(mid - thick, mid + thick, low, top, centre - width / 2, centre + width / 2)[0], 'cut'))
        if arched:
            turn = Matrix.Rotation(math.pi / 2, 4, 'X') if across == 'z' else Matrix.Rotation(math.pi / 2, 4, 'Y')
            at = B(centre, top, mid) if across == 'z' else B(mid, top, centre)
            cutters.append(scratch_object(cone_bm(Matrix.Translation(at) @ turn, width / 2, width / 2, thick * 2, 32), 'cut'))
    for c in cutters:
        mod = slab.modifiers.new('Opening', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'; mod.object = c
    evaluated = slab.evaluated_get(bpy.context.evaluated_depsgraph_get())
    result = bpy.data.meshes.new_from_object(evaluated)
    bm = bmesh.new(); bm.from_mesh(result)
    # An arch's springing meets its jamb's top within rounding: weld such near-coincident
    # points, which would otherwise export as zero-area triangles.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    for obj in [slab] + cutters:
        data = obj.data; bpy.data.objects.remove(obj, do_unlink=True); bpy.data.meshes.remove(data)
    bpy.data.meshes.remove(result)
    for f in bm.faces: f.smooth = False
    take(bm, mat)


def plane(x0, x1, z0, z1, mat, y=0.):
    """A level quad facing up."""
    return mesh('floor', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 3, 2, 1)], mat)


# --- Export ----------------------------------------------------------------------------------------
def project_uvs(me, mat):
    """Box projection in metres from the kit's own frame: joins between pieces line up, and
    a material's `uv_offset` lifts its pattern's foot on walls."""
    repeat, offset = mat['uv_repeat'], mat['uv_offset']
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        axis = max(range(3), key=lambda k: abs(poly.normal[k]))
        a, b = [(1, 2), (0, 2), (0, 1)][axis]
        for loop in poly.loop_indices:
            co = me.vertices[me.loops[loop].vertex_index].co
            uv.data[loop].uv = (co[a] / repeat, (co[b] - (offset if axis != 2 else 0)) / repeat)


def export(kit, generator, chapters, processed, source, extra=None):
    """One mesh per component and material, then the GLB, the editable .blend and the
    JSON report (each component's triangles, materials and runtime bounds)."""
    reports = []
    for root in roots:
        for key, mat in materials.items():
            bm = parts.get((root.name, key))
            if not bm: continue
            me = bpy.data.meshes.new(root.name + '_' + key); bm.to_mesh(me); bm.free(); me.update()
            project_uvs(me, mat); me.materials.append(mat)
            obj = bpy.data.objects.new(root.name + '_' + key, me); bpy.context.collection.objects.link(obj); obj.parent = root
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
        lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
        tris = sum(len(p.vertices) - 2 for o in root.children for p in o.data.polygons)
        # Blender x, y, z maps to glTF x, z, -y: bounds below are runtime coordinates.
        reports.append({'name': root.name, 'triangles': tris, 'materials': len(root.children),
                        'materialFamilies': sorted(o.data.materials[0].name for o in root.children),
                        'bounds': {'min': [lo[0], lo[2], -hi[1]], 'max': [hi[0], hi[2], -lo[1]]}})
    bpy.context.scene.unit_settings.system = 'METRIC'; bpy.context.scene.unit_settings.scale_length = 1
    path = os.path.join(processed, kit + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=False, export_extras=True,
                              export_image_format='AUTO', export_materials='EXPORT', export_normals=True, export_texcoords=True, export_tangents=False)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source, kit + '.blend'))
    with open(path, 'rb') as f: raw = f.read()
    report = {'version': 1, 'id': kit, 'generator': generator, 'chapters': chapters, **(extra or {}),
              'authorship': 'Original Blender-authored geometry and original deterministic surface bakes; no external images',
              'licence': 'Created for the Imperium project; no third-party source assets', 'components': reports,
              'materials': [{'name': m.name, 'size': 512, 'channels': ['baseColor', 'metallicRoughness', 'normal'],
                             'authorship': 'Original deterministic procedural bake'} if m.node_tree.nodes.get('Image Texture') else
                            {'name': m.name, 'channels': ['factors'], 'authorship': 'Original material factors'} for m in materials.values()],
              'output': {'path': f'art-source/models/processed/{kit}.glb', 'bytes': len(raw),
                         'sha256': hashlib.sha256(raw).hexdigest(), 'triangles': sum(r['triangles'] for r in reports)},
              'runtimePath': f'assets/models/scenery/{kit}.glb'}
    with open(os.path.join(processed, kit + '.json'), 'w', encoding='utf-8') as f: json.dump(report, f, indent=2); f.write('\n')
    print(json.dumps(report['output']))
    return report


def bounds(report):
    """Each component's runtime bounds, rounded to the millimetre, for the game's JS."""
    return {r['name']: {'min': [round(v, 3) for v in r['bounds']['min']], 'max': [round(v, 3) for v in r['bounds']['max']]} for r in report['components']}
