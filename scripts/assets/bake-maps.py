"""A fresh unwrap of one model and another's colour, normals and roughness baked onto it in
Cycles: shared by wrap-cast-head.py and bind-horse.py, which load it. Not a command.

A model decimated far below its source loses its texture seams (collapsed edges carry one
side's coordinates into the other's islands); one wrapped onto another's surface has none of
its paint. Both take a fresh unwrap and maps baked from the source, selected to active.
"""
import math

import bpy  # Blender's Python module.


def unwrap(target, angle=66, margin=0.02):
    """A fresh unwrap of the target in place of its own coordinates; returns its layer's name."""
    old = [layer.name for layer in target.data.uv_layers]
    # Names, not references: adding a layer reallocates the collection. And the name Blender
    # gives back: another of the mesh's names may already hold 'baked'.
    baked = target.data.uv_layers.new(name='baked').name
    target.data.uv_layers.active = target.data.uv_layers[baked]
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in old:
        target.data.uv_layers.remove(target.data.uv_layers[name])
    target.data.uv_layers.active = target.data.uv_layers[baked]
    return baked


def bake_maps(target, source, name, colour=512, detail=None, samples=4, cage=0.04, distance=0.08, margin=16):
    """Bake the source's colour, normals and roughness onto the target's active coordinates,
    selected to active: rays start `cage` metres outside the target and reach `distance`.
    The target gets a new material with the three maps, unmetallic, as the game's bodies are."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.cage_extrusion = cage
    bake.max_ray_distance = distance
    bake.margin = margin
    # The margin fills across the unwrap's seams from the faces beside them.
    bake.margin_type = 'ADJACENT_FACES'
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Metallic'].default_value = 0.0
    target.data.materials.clear()
    target.data.materials.append(material)
    images = {}
    for kind, bake_type, size, srgb in (('colour', 'DIFFUSE', colour, True), ('normal', 'NORMAL', detail or colour, False),
                                         ('roughness', 'ROUGHNESS', detail or colour, False)):
        image = bpy.data.images.new(f'{name}-{kind}', size, size, alpha=False)
        if not srgb:
            image.colorspace_settings.name = 'Non-Color'
        node = nodes.new('ShaderNodeTexImage')
        node.image = image
        nodes.active = node
        bpy.ops.object.select_all(action='DESELECT')
        source.select_set(True)
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.bake(type=bake_type, **({'pass_filter': {'COLOR'}} if bake_type == 'DIFFUSE' else {}))
        image.pack()
        images[kind] = node
    links.new(images['colour'].outputs['Color'], shader.inputs['Base Color'])
    links.new(images['roughness'].outputs['Color'], shader.inputs['Roughness'])
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(images['normal'].outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    return material
