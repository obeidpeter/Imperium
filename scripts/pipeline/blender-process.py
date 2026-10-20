# Headless Blender (bpy) 3D asset processor, skeleton binder, and procedural Roman model builder for Imperium.
# Usage:
#   blender --background --python scripts/pipeline/blender-process.py -- --preset roman-aquila-v029 --output assets/models/roman-aquila-v029.glb
#   blender --background --python scripts/pipeline/blender-process.py -- --input raw.glb --output assets/models/out.glb --rig standard3 --target-height 1.45 --max-tris 1800

import argparse
import hashlib
import json
import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Matrix


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_pbr_material(name, base_color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def build_roman_aquila_mesh():
    """Sculpts an ornate Roman Legionary Aquila standard in Blender (Z-up, exported as Y-up in glTF)."""
    bm = bmesh.new()

    # 1. Bronze-shod shaft (z = 0.0 to 1.12)
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=12,
        radius1=0.013,
        radius2=0.010,
        depth=1.12,
        matrix=Matrix.Translation((0.0, 0.0, 0.56)),
    )

    # 2. Three phalerae medallions along the shaft (z = 0.58, 0.74, 0.90)
    for z_pos in (0.58, 0.74, 0.90):
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=True,
            segments=14,
            radius1=0.026,
            radius2=0.024,
            depth=0.010,
            matrix=Matrix.Translation((0.0, -0.015, z_pos)) @ Matrix.Rotation(math.pi / 2.0, 4, "X"),
        )

    # 3. Transverse vexillum crossbar (z = 1.06)
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=10,
        radius1=0.008,
        radius2=0.008,
        depth=0.32,
        matrix=Matrix.Translation((0.0, 0.0, 1.06)) @ Matrix.Rotation(math.pi / 2.0, 4, "Y"),
    )

    # 4. Pedestal plinth & laurel wreath ring under the eagle (z = 1.13 to 1.18)
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=12,
        radius1=0.028,
        radius2=0.036,
        depth=0.045,
        matrix=Matrix.Translation((0.0, 0.0, 1.145)),
    )

    # 5. Aquila torso & breast (z = 1.22)
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=12,
        v_segments=8,
        radius=1.0,
        matrix=Matrix.Translation((0.0, -0.006, 1.225)) @ Matrix.Diagonal((0.032, 0.026, 0.052, 1.0)),
    )

    # 6. Aquila head & hooked beak (z = 1.29)
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=10,
        v_segments=6,
        radius=1.0,
        matrix=Matrix.Translation((0.0, -0.012, 1.288)) @ Matrix.Diagonal((0.020, 0.022, 0.022, 1.0)),
    )
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=8,
        radius1=0.010,
        radius2=0.001,
        depth=0.028,
        matrix=Matrix.Translation((0.0, -0.034, 1.282)) @ Matrix.Rotation(math.pi * 0.58, 4, "X"),
    )

    # 7. Outstretched feathered wings (left & right)
    for side in (-1.0, 1.0):
        for feather_idx in range(5):
            t = feather_idx / 4.0
            span_x = side * (0.042 + t * 0.115)
            lift_z = 1.235 + t * 0.065 - (t ** 2) * 0.018
            sweep_y = 0.006 + t * 0.014
            rot_y = side * (-0.42 - t * 0.25)
            bmesh.ops.create_cube(
                bm,
                size=1.0,
                matrix=(
                    Matrix.Translation((span_x, sweep_y, lift_z))
                    @ Matrix.Rotation(rot_y, 4, "Y")
                    @ Matrix.Diagonal((0.048, 0.008, 0.018 * (1.1 - t * 0.35), 1.0))
                ),
            )

    bmesh.ops.triangulate(bm, faces=bm.faces[:])

    # Ensure UV layer exists
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = ((co.x + 0.25) * 2.0, co.z / 1.45)

    mesh = bpy.data.meshes.new("roman-aquila-mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("imported-roman-aquila", mesh)
    bpy.context.collection.objects.link(obj)
    mat = make_pbr_material("gilded-bronze", (0.78, 0.62, 0.28, 1.0), metallic=0.88, roughness=0.28)
    mesh.materials.append(mat)
    return obj


def build_senate_curule_chair():
    bm = bmesh.new()
    for side_x in (-0.24, 0.24):
        for diag in (-1.0, 1.0):
            bmesh.ops.create_cube(
                bm,
                size=1.0,
                matrix=(
                    Matrix.Translation((side_x, 0.0, 0.24))
                    @ Matrix.Rotation(diag * 0.62, 4, "X")
                    @ Matrix.Diagonal((0.035, 0.035, 0.56, 1.0))
                ),
            )
    bmesh.ops.create_cube(
        bm,
        size=1.0,
        matrix=Matrix.Translation((0.0, 0.0, 0.46)) @ Matrix.Diagonal((0.54, 0.42, 0.05, 1.0)),
    )
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new("senate-curule-chair-mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("imported-senate-curule-chair", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(make_pbr_material("curule-ivory-bronze", (0.88, 0.84, 0.74, 1.0), metallic=0.15, roughness=0.42))
    return obj


def build_danube_brazier_tripod():
    bm = bmesh.new()
    for i in range(3):
        angle = i * (2.0 * math.pi / 3.0)
        x = math.cos(angle) * 0.18
        y = math.sin(angle) * 0.18
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=True,
            segments=8,
            radius1=0.018,
            radius2=0.012,
            depth=0.68,
            matrix=Matrix.Translation((x * 0.6, y * 0.6, 0.34)),
        )
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=14,
        radius1=0.14,
        radius2=0.24,
        depth=0.22,
        matrix=Matrix.Translation((0.0, 0.0, 0.68)),
    )
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new("danube-brazier-mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("imported-danube-brazier", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(make_pbr_material("forged-iron", (0.26, 0.25, 0.23, 1.0), metallic=0.78, roughness=0.48))
    return obj


def build_intercisa_helmet():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=18,
        v_segments=10,
        radius=0.13,
        matrix=Matrix.Translation((0.0, 0.0, 0.14)),
    )
    for v in list(bm.verts):
        if v.co.z < 0.11 and v.co.y < 0.02:
            bm.verts.remove(v)
    bmesh.ops.create_cube(
        bm,
        size=1.0,
        matrix=Matrix.Translation((0.0, 0.0, 0.22)) @ Matrix.Diagonal((0.018, 0.26, 0.09, 1.0)),
    )
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new("intercisa-helmet-mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("imported-intercisa-helmet", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(make_pbr_material("helmet-steel", (0.62, 0.64, 0.63, 1.0), metallic=0.85, roughness=0.35))
    return obj


def normalize_and_decimate(obj, target_height=1.45, max_tris=1800):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_x = min(v.x for v in bbox)
    max_x = max(v.x for v in bbox)
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)
    min_z = min(v.z for v in bbox)
    max_z = max(v.z for v in bbox)

    height = max(1e-4, max_z - min_z)
    scale = target_height / height if target_height > 0 else 1.0
    cx = 0.5 * (min_x + max_x)
    cy = 0.5 * (min_y + max_y)

    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) * scale
        v.co.y = (v.co.y - cy) * scale
        v.co.z = (v.co.z - min_z) * scale
    obj.data.update()

    tri_count = sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)
    if max_tris and tri_count > max_tris:
        mod = obj.modifiers.new(name="ImperiumDecimate", type="DECIMATE")
        mod.ratio = max(0.05, float(max_tris) / float(tri_count))
        bpy.ops.object.modifier_apply(modifier=mod.name)


def bind_skeleton(obj, rig_type="standard3"):
    if not rig_type or rig_type == "none":
        return []

    arm_data = bpy.data.armatures.new("ImperiumRig")
    arm_obj = bpy.data.objects.new("ImperiumArmature", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    bones_spec = []
    if rig_type == "human6":
        bones_spec = [
            ("torso", (0.0, 0.0, 0.91), (0.0, 0.0, 1.35), None),
            ("head", (0.0, 0.0, 1.485), (0.0, 0.0, 1.72), "torso"),
            ("right-shoulder", (-0.24, 0.0, 1.329), (-0.24, 0.0, 1.029), "torso"),
            ("right-elbow", (-0.24, 0.0, 1.029), (-0.24, 0.0, 0.77), "right-shoulder"),
            ("left-shoulder", (0.24, 0.0, 1.329), (0.24, 0.0, 1.029), "torso"),
            ("left-elbow", (0.24, 0.0, 1.029), (0.24, 0.0, 0.77), "left-shoulder"),
        ]
    else:
        bones_spec = [
            ("base", (0.0, 0.0, 0.0), (0.0, 0.0, 0.52), None),
            ("shaft", (0.0, 0.0, 0.52), (0.0, 0.0, 1.12), "base"),
            ("eagle", (0.0, 0.0, 1.12), (0.0, 0.0, 1.45), "shaft"),
        ]

    for b_name, head, tail, parent_name in bones_spec:
        eb = arm_data.edit_bones.new(b_name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        if parent_name and parent_name in arm_data.edit_bones:
            eb.parent = arm_data.edit_bones[parent_name]

    bpy.ops.object.mode_set(mode="OBJECT")

    obj.parent = arm_obj
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj

    bone_names = [b[0] for b in bones_spec]
    for b_name in bone_names:
        if b_name not in obj.vertex_groups:
            obj.vertex_groups.new(name=b_name)

    for v in obj.data.vertices:
        z = v.co.z
        if rig_type == "standard3":
            if z < 0.52:
                obj.vertex_groups["base"].add([v.index], 1.0, "REPLACE")
            elif z < 1.10:
                w = min(1.0, max(0.0, (z - 0.52) / 0.15))
                obj.vertex_groups["base"].add([v.index], 1.0 - w, "REPLACE")
                obj.vertex_groups["shaft"].add([v.index], w, "REPLACE")
            else:
                obj.vertex_groups["eagle"].add([v.index], 1.0, "REPLACE")
        else:
            obj.vertex_groups[bone_names[0]].add([v.index], 1.0, "REPLACE")

    return bone_names


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Imperium Headless Blender 3D Processor")
    parser.add_argument("--input", default="", help="Input GLB/OBJ path (e.g. from Tripo 3D)")
    parser.add_argument("--preset", default="roman-aquila-v029", help="Procedural preset id when --input is omitted")
    parser.add_argument("--output", required=True, help="Output GLB path")
    parser.add_argument("--rig", default="standard3", choices=["none", "standard3", "human6"])
    parser.add_argument("--target-height", type=float, default=1.45)
    parser.add_argument("--max-tris", type=int, default=1800)
    args = parser.parse_args(argv)

    clear_scene()

    if args.input and os.path.exists(args.input):
        ext = os.path.splitext(args.input)[1].lower()
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=args.input)
        elif ext == ".obj":
            bpy.ops.wm.obj_import(filepath=args.input)
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        if not meshes:
            raise RuntimeError(f"No mesh found in {args.input}")
        bpy.ops.object.select_all(action="DESELECT")
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        target_obj = bpy.context.view_layer.objects.active
        target_obj.name = f"imported-{args.preset}"
    else:
        builders = {
            "roman-aquila-v029": build_roman_aquila_mesh,
            "senate-curule-chair": build_senate_curule_chair,
            "danube-brazier-tripod": build_danube_brazier_tripod,
            "legionary-intercisa-helmet": build_intercisa_helmet,
        }
        builder = builders.get(args.preset, build_roman_aquila_mesh)
        target_obj = builder()

    normalize_and_decimate(target_obj, target_height=args.target_height, max_tris=args.max_tris)
    bones = bind_skeleton(target_obj, rig_type=args.rig)

    out_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_materials="EXPORT",
    )

    with open(out_path, "rb") as f:
        raw_bytes = f.read()

    vertices = len(target_obj.data.vertices)
    triangles = sum(max(0, len(p.vertices) - 2) for p in target_obj.data.polygons)
    report = {
        "preset": args.preset,
        "output": args.output,
        "blenderVersion": bpy.app.version_string,
        "vertices": vertices,
        "triangles": triangles,
        "bones": bones,
        "bytes": len(raw_bytes),
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
    }
    print("BLENDER_PIPELINE_REPORT:" + json.dumps(report))


if __name__ == "__main__":
    main()
