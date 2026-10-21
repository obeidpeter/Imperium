"""Bind a Tripo-rigged character to the game's skeleton and export a skinned GLB.

Development tool. It needs Blender: either Blender's Python module (`pip install
bpy`, which needs the matching Python version) or the Blender application.

  "$BLENDER_PYTHON" scripts/assets/bind-character.py --input rigged.glb --output body.glb [options]
  blender --background --python scripts/assets/bind-character.py -- --input rigged.glb --output body.glb [options]

The game animates every figure with one compact skeleton (hips, torso, head,
shoulder, elbow and hand on each arm, thigh, knee and ankle on each leg) whose
bind pose stands straight with the arms hanging at the sides and every joint
unrotated. The source is a GLB from Tripo's biped auto-rig: a T-posed mesh
with 41 joints and skin weights.

Steps: import; turn the figure to face +Z (glTF) with its left side on +X;
scale it so its hip joint stands at the game's hip height; pose Tripo's own
rig into the game's bind pose (arms straight down, legs straight, feet flat),
which deforms the mesh with Tripo's weights; fold Tripo's joints onto the
game's (spine and clavicles into the torso, twist joints into their limb,
toes into the ankle); fit the mesh to the game's joint positions; decimate to
the triangle budget; shrink textures; export one GLB whose skin uses the
game's joint names, plus an overview level of detail when asked. A JSON report
records digests, settings, the joint fit and counts.
"""
import argparse
import hashlib
import json
import math
import os
import sys

import bpy  # Blender's Python module provides mathutils once bpy is loaded.
from mathutils import Matrix, Vector

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# The game's bind pose in glTF metres (+Y up, +Z forward, the figure's left on +X),
# measured from the skin of the exported production characters.
GAME_JOINTS = {
    'hips': (0.0, 0.910, 0.0),
    'torso': (0.0, 0.910, 0.0),
    'head': (0.0, 1.485, 0.0),
    'right-shoulder': (-0.240, 1.329, 0.0), 'right-elbow': (-0.240, 1.029, 0.0), 'right-hand': (-0.240, 0.771, 0.0),
    'left-shoulder': (0.240, 1.329, 0.0), 'left-elbow': (0.240, 1.029, 0.0), 'left-hand': (0.240, 0.771, 0.0),
    'right-thigh': (-0.104, 0.910, 0.0), 'right-knee': (-0.104, 0.480, 0.0), 'right-ankle': (-0.104, 0.050, 0.0),
    'left-thigh': (0.104, 0.910, 0.0), 'left-knee': (0.104, 0.480, 0.0), 'left-ankle': (0.104, 0.050, 0.0),
}
GAME_PARENTS = {
    'hips': None, 'torso': 'hips', 'head': 'torso',
    'right-shoulder': 'torso', 'right-elbow': 'right-shoulder', 'right-hand': 'right-elbow',
    'left-shoulder': 'torso', 'left-elbow': 'left-shoulder', 'left-hand': 'left-elbow',
    'right-thigh': 'hips', 'right-knee': 'right-thigh', 'right-ankle': 'right-knee',
    'left-thigh': 'hips', 'left-knee': 'left-thigh', 'left-ankle': 'left-knee',
}
# Tripo's biped joints folded onto the game's.
FOLD = {
    'Root': 'hips', 'Hip': 'hips', 'Pelvis': 'hips',
    'Waist': 'torso', 'Spine01': 'torso', 'Spine02': 'torso', 'NeckTwist01': 'torso',
    'L_Clavicle': 'torso', 'R_Clavicle': 'torso',
    'NeckTwist02': 'head', 'Head': 'head',
}
for tripo_side, game_side in (('L', 'left'), ('R', 'right')):
    FOLD.update({
        f'{tripo_side}_Upperarm': f'{game_side}-shoulder', f'{tripo_side}_UpperarmTwist01': f'{game_side}-shoulder', f'{tripo_side}_UpperarmTwist02': f'{game_side}-shoulder',
        f'{tripo_side}_Forearm': f'{game_side}-elbow', f'{tripo_side}_ForearmTwist01': f'{game_side}-elbow', f'{tripo_side}_ForearmTwist02': f'{game_side}-elbow',
        f'{tripo_side}_Hand': f'{game_side}-hand',
        f'{tripo_side}_Thigh': f'{game_side}-thigh', f'{tripo_side}_ThighTwist01': f'{game_side}-thigh', f'{tripo_side}_ThighTwist02': f'{game_side}-thigh',
        f'{tripo_side}_Calf': f'{game_side}-knee', f'{tripo_side}_CalfTwist01': f'{game_side}-knee', f'{tripo_side}_CalfTwist02': f'{game_side}-knee',
        f'{tripo_side}_Foot': f'{game_side}-ankle', f'{tripo_side}_ToeBase': f'{game_side}-ankle',
    })
# The Tripo joint whose head lands on each game joint.
ANCHOR = {
    'hips': 'Hip', 'torso': 'Hip', 'head': 'Head',
    'right-shoulder': 'R_Upperarm', 'right-elbow': 'R_Forearm', 'right-hand': 'R_Hand',
    'left-shoulder': 'L_Upperarm', 'left-elbow': 'L_Forearm', 'left-hand': 'L_Hand',
    'right-thigh': 'R_Thigh', 'right-knee': 'R_Calf', 'right-ankle': 'R_Foot',
    'left-thigh': 'L_Thigh', 'left-knee': 'L_Calf', 'left-ankle': 'L_Foot',
}


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--input', required=True, help='Tripo-rigged .glb')
    p.add_argument('--output', required=True, help='bound .glb')
    p.add_argument('--report', help='JSON report path (default: output with .json)')
    p.add_argument('--triangles', type=int, default=12000, help='triangle budget of the near mesh')
    p.add_argument('--overview-triangles', type=int, default=0, help='also export an overview mesh with this budget')
    p.add_argument('--texture', type=int, default=1024, help='longest edge of the colour map in pixels')
    p.add_argument('--detail-texture', type=int, default=512, help='longest edge of the normal and roughness/metal maps in pixels')
    p.add_argument('--quality', type=int, default=80, help='WebP quality, 1-100')
    p.add_argument('--clavicle', type=float, default=10.0, help='share of the arm drop taken by the clavicle, in degrees')
    p.add_argument('--sharp-angle', type=float, default=60.0, help='edges sharper than this stay hard, in degrees')
    a = p.parse_args(argv)
    if a.triangles < 500 or a.overview_triangles < 0 or not 16 <= a.texture <= 8192 or not 16 <= a.detail_texture <= 8192 or not 1 <= a.quality <= 100:
        p.error('budgets out of range')
    return a


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def shown(path):
    path = os.path.abspath(path)
    return os.path.relpath(path, REPO).replace(os.sep, '/') if path.startswith(REPO + os.sep) else path


def gltf_to_blender(v):
    x, y, z = v
    return Vector((x, -z, y))


def blender_to_gltf(v):
    return (round(v.x, 5), round(v.z, 5), round(-v.y, 5))


def triangles(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


def load(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source, import_pack_images=True, disable_bone_shape=True, guess_original_bind_pose=False)
    for helper in [o for c in bpy.data.collections if c.name.startswith('glTF_not_exported') for o in c.objects]:
        bpy.data.objects.remove(helper, do_unlink=True)
    rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    if len(rigs) != 1 or not meshes:
        sys.exit(f'Expected one armature and a skinned mesh, found {len(rigs)} armatures and {len(meshes)} skinned meshes.')
    missing = [name for name in FOLD if name not in rigs[0].data.bones]
    if missing:
        sys.exit('Not a Tripo biped rig; missing joints: ' + ', '.join(missing))
    for o in list(bpy.data.objects):
        if o not in rigs and o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    return rigs[0], meshes


def head(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].head


def orient_and_scale(rig):
    """Face +Z (glTF), i.e. -Y in Blender, with the left side on +X; hips at the game's height."""
    left, right = head(rig, 'L_Upperarm'), head(rig, 'R_Upperarm')
    across = (left - right)
    across.z = 0
    # Rotate about Blender Z so that the left side points along +X.
    turn = -math.atan2(across.y, across.x)
    rig.matrix_world = Matrix.Rotation(turn, 4, 'Z') @ rig.matrix_world
    bpy.context.view_layer.update()
    scale = GAME_JOINTS['hips'][1] / (head(rig, 'Hip').z - min(head(rig, 'L_Foot').z, head(rig, 'R_Foot').z) + GAME_JOINTS['left-ankle'][1])
    rig.matrix_world = Matrix.Diagonal((scale, scale, scale, 1)) @ rig.matrix_world
    bpy.context.view_layer.update()
    # Stand the ankles at the game's ankle height, centred over the origin.
    hip = head(rig, 'Hip')
    feet = min(head(rig, 'L_Foot').z, head(rig, 'R_Foot').z)
    rig.matrix_world = Matrix.Translation((-hip.x, -hip.y, GAME_JOINTS['left-ankle'][1] - feet)) @ rig.matrix_world
    bpy.context.view_layer.update()
    return math.degrees(turn), scale


def rotate_about_head(rig, name, rotation):
    bone = rig.pose.bones[name]
    world = rig.matrix_world @ bone.matrix
    pivot = world.translation.copy()
    world = Matrix.Translation(pivot) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ world
    bone.matrix = rig.matrix_world.inverted() @ world
    bpy.context.view_layer.update()


def aim(rig, name, child, target):
    """Turn a bone about its head so that the direction to its child's head becomes target."""
    current = (head(rig, child) - head(rig, name)).normalized()
    rotate_about_head(rig, name, current.rotation_difference(target.normalized()))


def pose_to_game_bind(rig, clavicle_degrees):
    """Arms straight down, legs straight, feet pointing forward at their own slope.
    Each hand keeps its relation to the forearm."""
    down = Vector((0, 0, -1))
    for side in ('L', 'R'):
        # The clavicle takes a small share of the drop, as a real shoulder does.
        arm = (head(rig, f'{side}_Forearm') - head(rig, f'{side}_Upperarm')).normalized()
        drop = math.degrees(arm.angle(down))
        if drop > 0.1 and clavicle_degrees:
            share = math.radians(min(clavicle_degrees, drop / 3))
            rotate_about_head(rig, f'{side}_Clavicle', Matrix.Rotation(share, 3, arm.cross(down).normalized()).to_quaternion())
        aim(rig, f'{side}_Upperarm', f'{side}_Forearm', down)
        aim(rig, f'{side}_Forearm', f'{side}_Hand', down)
        foot = head(rig, f'{side}_ToeBase') - head(rig, f'{side}_Foot')
        slope = foot.z / max(foot.length, 1e-6)
        aim(rig, f'{side}_Thigh', f'{side}_Calf', down)
        aim(rig, f'{side}_Calf', f'{side}_Foot', down)
        aim(rig, f'{side}_Foot', f'{side}_ToeBase', Vector((0, -math.sqrt(max(0.0, 1 - slope * slope)), slope)))
    return {name: blender_to_gltf(head(rig, ANCHOR[name])) for name in GAME_JOINTS}


def bake_pose(rig, meshes):
    """Apply the posed rig to the meshes; their vertex groups stay."""
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for m in [m for m in o.modifiers if m.type == 'ARMATURE']:
            bpy.ops.object.modifier_apply(modifier=m.name)
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def weld_and_shade(o, sharp_angle, merge_distance=0.0001):
    """The importer splits vertices along texture seams; decimating those pieces apart would
    open hairline cracks, so they are welded first. Duplicates share their skin weights."""
    import bmesh
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


def decimate(meshes, budget):
    total = triangles(meshes)
    if total <= budget:
        return
    ratio = budget / total
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)


def fold_weights(o):
    """Replace Tripo's vertex groups with the game's, summing folded joints; at most four per vertex."""
    names = {g.index: FOLD.get(g.name) for g in o.vertex_groups}
    folded = []
    for v in o.data.vertices:
        sums = {}
        for g in v.groups:
            joint = names.get(g.group)
            if joint and g.weight > 0:
                sums[joint] = sums.get(joint, 0.0) + g.weight
        top = sorted(sums.items(), key=lambda item: -item[1])[:4]
        total = sum(w for _, w in top)
        folded.append([(j, w / total) for j, w in top] if total > 0 else [('hips', 1.0)])
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {name: o.vertex_groups.new(name=name) for name in GAME_JOINTS}
    for i, weights in enumerate(folded):
        for joint, w in weights:
            groups[joint].add([i], w, 'REPLACE')
    return folded


SEGMENTS = {
    'torso': 'head',
    'right-shoulder': 'right-elbow', 'right-elbow': 'right-hand',
    'left-shoulder': 'left-elbow', 'left-elbow': 'left-hand',
    'right-thigh': 'right-knee', 'right-knee': 'right-ankle',
    'left-thigh': 'left-knee', 'left-knee': 'left-ankle',
}


SOLE_DEPTH = 0.07  # the game's boot sole lies this far below the ankle joint (actor-extremities.js)


def feet_follow_ankles(meshes, folded_by_mesh, source, ramp=0.02):
    """Below the ankle joint everything is foot. Auto-rigs often give the heel to the
    shin, which would stretch it under the sole and drag it with the calf; its shin
    weight moves to the ankle, fully below the joint and in part over the last 2 cm."""
    moved = 0
    for o, folded in zip(meshes, folded_by_mesh):
        group, changed = {g.name: g for g in o.vertex_groups}, []
        for k, (vertex, weights) in enumerate(zip(o.data.vertices, folded)):
            side = 'left' if vertex.co.x > 0 else 'right'
            knee, ankle = f'{side}-knee', f'{side}-ankle'
            share = min(1.0, max(0.0, (source[ankle].z + ramp - vertex.co.z) / ramp))
            w = dict(weights)
            if share <= 0 or w.get(knee, 0) <= 0:
                continue
            shift = w[knee] * share
            w[knee] -= shift
            w[ankle] = w.get(ankle, 0) + shift
            folded[k] = [(j, v) for j, v in sorted(w.items(), key=lambda item: -item[1]) if v > 0][:4]
            changed.append(k)
        for k in changed:
            for g in group.values():
                g.remove([k])
            for joint, v in folded[k]:
                group[joint].add([k], v, 'REPLACE')
        moved += len(changed)
    return moved


def sole_offset(meshes, folded_by_mesh, source):
    """How far each foot must drop so its sole meets the game's sole plane."""
    drop = {}
    for side in ('left', 'right'):
        joint = f'{side}-ankle'
        lowest = min((v.co.z for o, folded in zip(meshes, folded_by_mesh) for v, w in zip(o.data.vertices, folded)
                      if dict(w).get(joint, 0) >= 0.5), default=source[joint].z - SOLE_DEPTH)
        drop[joint] = max(0.0, SOLE_DEPTH - (source[joint].z - lowest))
    return drop


def fit_to_game(meshes, folded_by_mesh, source):
    """Move every joint onto the game's: each joint's vertices follow an affine map that
    carries its segment (to the next joint) onto the game's segment, blended by the
    folded weights. Limb segments stretch along their length only. Feet also drop
    until their soles meet the game's sole plane; the shins stretch to follow."""
    target = {name: gltf_to_blender(p) for name, p in GAME_JOINTS.items()}
    drop = sole_offset(meshes, folded_by_mesh, source)
    target.update({joint: target[joint] - Vector((0, 0, d)) for joint, d in drop.items()})
    maps = {}
    for joint in GAME_JOINTS:
        p, q = source[joint], target[joint]
        child = SEGMENTS.get(joint)
        if child:
            a, b = source[child] - p, target[child] - q
            axis, stretch = a.normalized(), b.length / max(a.length, 1e-6)
            turn = a.normalized().rotation_difference(b.normalized()).to_matrix()
            maps[joint] = (p, q, turn, axis, stretch)
        else:
            maps[joint] = (p, q, Matrix.Identity(3), None, 1.0)

    def carry(joint, v):
        p, q, turn, axis, stretch = maps[joint]
        d = v - p
        if axis is not None:
            d = d + axis * ((stretch - 1.0) * d.dot(axis))
        return q + turn @ d

    for o, folded in zip(meshes, folded_by_mesh):
        for vertex, weights in zip(o.data.vertices, folded):
            co = vertex.co.copy()
            vertex.co = sum((carry(joint, co) * w for joint, w in weights), Vector())
        o.data.update()
    return {joint: round(d, 4) for joint, d in drop.items()}


def remove_hands(meshes, folded_by_mesh):
    """The game draws its own gripping hands on the hand joints; drop the generated ones."""
    import bmesh
    removed = 0
    for i, (o, folded) in enumerate(zip(meshes, folded_by_mesh)):
        doomed = {k for k, w in enumerate(folded) if sum(v for j, v in w if j.endswith('-hand')) >= 0.5}
        if not doomed:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[k] for k in doomed], context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
        folded_by_mesh[i] = [w for k, w in enumerate(folded) if k not in doomed]
        removed += len(doomed)
    return removed


def bake_vertex_colours(o):
    """Average base colour under each vertex, for views that draw without textures
    (the game's fallen bodies). The material ignores it."""
    import numpy as np
    image = next((n.image for m in o.data.materials if m and m.node_tree for n in m.node_tree.nodes
                  if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB'), None)
    if image is None or not o.data.uv_layers:
        return False
    w, h = image.size
    pixels = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)
    uv = o.data.uv_layers.active.data
    sums = np.zeros((len(o.data.vertices), 3))
    counts = np.zeros(len(o.data.vertices))
    for loop in o.data.loops:
        u, v = uv[loop.index].uv
        x, y = min(w - 1, max(0, int(u % 1.0 * w))), min(h - 1, max(0, int(v % 1.0 * h)))
        sums[loop.vertex_index] += pixels[y, x, :3]
        counts[loop.vertex_index] += 1
    srgb = sums / np.maximum(counts, 1)[:, None]
    # Colour attributes are linear; the texture is sRGB.
    colours = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    attribute = o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    flat = np.concatenate([colours, np.ones((len(colours), 1))], axis=1).astype(np.float32).ravel()
    attribute.data.foreach_set('color', flat)
    o.data.color_attributes.active_color = attribute
    return True


def game_armature():
    """The game's joints in their bind pose: bones point up with no roll, so every
    joint exports unrotated, as the game's own skeleton is."""
    data = bpy.data.armatures.new('game-skeleton')
    rig = bpy.data.objects.new('game-skeleton', data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, p in GAME_JOINTS.items():
        bone = data.edit_bones.new(name)
        bone.head = gltf_to_blender(p)
        bone.tail = bone.head + Vector((0, 0, 0.08))
        bone.roll = 0
    for name, parent in GAME_PARENTS.items():
        if parent:
            data.edit_bones[name].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def skin(o, rig):
    o.parent = rig
    mod = o.modifiers.new('skin', 'ARMATURE')
    mod.object = rig


def shrink_textures(limit, detail_limit):
    """Colour keeps the larger edge; the normal and roughness/metal maps (non-colour data),
    which matter least at game distance, take the smaller one and half the GPU memory."""
    sizes = []
    for image in bpy.data.images:
        if image.users == 0 or image.size[0] == 0:
            continue
        w, h = image.size
        edge = limit if image.colorspace_settings.name == 'sRGB' else detail_limit
        if max(w, h) > edge:
            k = edge / max(w, h)
            image.scale(max(1, round(w * k)), max(1, round(h * k)))
        sizes.append({'name': image.name, 'width': image.size[0], 'height': image.size[1]})
    return sizes



def bounds(meshes):
    points = [blender_to_gltf(o.matrix_world @ v.co) for o in meshes for v in o.data.vertices]
    return {'min': [min(p[i] for p in points) for i in range(3)], 'max': [max(p[i] for p in points) for i in range(3)]}


def main():
    a = parse_args()
    source, output = os.path.abspath(a.input), os.path.abspath(a.output)
    report_path = os.path.abspath(a.report or os.path.splitext(output)[0] + '.json')
    rig, meshes = load(source)
    before = triangles(meshes)
    turn, scale = orient_and_scale(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    posed = pose_to_game_bind(rig, a.clavicle)
    joints = {name: head(rig, ANCHOR[name]) for name in GAME_JOINTS}
    bpy.ops.object.mode_set(mode='OBJECT')
    bake_pose(rig, meshes)
    bpy.data.objects.remove(rig, do_unlink=True)
    for o in meshes:
        weld_and_shade(o, a.sharp_angle)
    decimate(meshes, a.triangles)
    folded = [fold_weights(o) for o in meshes]
    hands = remove_hands(meshes, folded)
    heels = feet_follow_ankles(meshes, folded, joints)
    soles = fit_to_game(meshes, folded, joints)
    for i, o in enumerate(meshes):
        o.name = o.data.name = 'body' if len(meshes) == 1 else f'body-{i}'
    lods = []
    if a.overview_triangles:
        for o in meshes:
            copy = o.copy()
            copy.data = o.data.copy()
            copy.name = copy.data.name = o.name.replace('body', 'body-overview')
            bpy.context.scene.collection.objects.link(copy)
            lods.append(copy)
        decimate(lods, a.overview_triangles)
    skeleton = game_armature()
    for o in meshes + lods:
        skin(o, skeleton)
    textures = shrink_textures(a.texture, a.detail_texture)
    coloured = [bake_vertex_colours(o) for o in lods]
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', export_image_format='WEBP', export_image_quality=a.quality,
        export_yup=True, export_tangents=False, export_cameras=False, export_lights=False, export_extras=False,
        export_animations=False, export_skins=True, export_morph=False, export_def_bones=False,
        export_rest_position_armature=True, export_vertex_color='ACTIVE')
    report = {
        'tool': 'scripts/assets/bind-character.py',
        'blender': bpy.app.version_string,
        'input': {'path': shown(source), 'bytes': os.path.getsize(source), 'sha256': digest(source), 'triangles': before},
        'output': {'path': shown(output), 'bytes': os.path.getsize(output), 'sha256': digest(output),
                   'triangles': triangles(meshes), 'overviewTriangles': triangles(lods) if lods else None},
        'settings': {'triangles': a.triangles, 'overviewTriangles': a.overview_triangles, 'texture': a.texture, 'detailTexture': a.detail_texture,
                     'webpQuality': a.quality, 'clavicleDegrees': a.clavicle, 'sharpAngle': a.sharp_angle},
        'fit': {'turnDegrees': round(turn, 2), 'scale': round(scale, 5), 'posedJoints': posed,
                'gameJoints': {name: list(p) for name, p in GAME_JOINTS.items()}, 'soleDrop': soles,
                'handVerticesRemoved': hands, 'heelVerticesToAnkles': heels, 'overviewVertexColours': all(coloured) if coloured else None},
        'bounds': bounds(meshes),
        'textures': textures,
    }
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps({k: report[k] for k in ('output', 'fit')}, indent=1))


if __name__ == '__main__':
    main()
