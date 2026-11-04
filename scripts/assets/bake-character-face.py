"""Bake a reviewed orthographic face projection into the unchanged character atlas.
The reference camera spans x [-.22,.18], y [1.40,1.80], looking along -Z.
Only front-facing skin/hair is repainted; the existing atlas supplies the rest.
blender --background --factory-startup --python this.py -- mesh.json base.png face.png out.png size
"""
import bpy, json, sys, os
args = sys.argv[sys.argv.index('--') + 1:]
args[:4] = [os.path.abspath(path) for path in args[:4]]
with open(args[0], encoding='utf8') as stream:
    data = json.load(stream)
record = next((m for m in data['meshes'] if m['name'] == 'cast-head'),
              next(m for m in data['meshes'] if m['name'] == 'body'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mesh = bpy.data.meshes.new('existing face surface')
mesh.from_pydata(record['positions'], [], [record['indices'][i:i+3] for i in range(0, len(record['indices']), 3)])
obj = bpy.data.objects.new('face paint bake', mesh)
bpy.context.collection.objects.link(obj)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
atlas = mesh.uv_layers.new(name='Atlas')
projection = mesh.uv_layers.new(name='Projection')
for loop in mesh.loops:
    i = loop.vertex_index
    u, v = record['uv'][i]
    x, y, z = record['positions'][i]
    atlas.data[loop.index].uv = (u, 1-v)
    projection.data[loop.index].uv = ((x+.22)/.4, (y-1.40)/.4)
mesh.uv_layers.active_index = 0
atlas.active_render = True
def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)
weights = mesh.color_attributes.new(name='ProjectionWeight', type='FLOAT_COLOR', domain='POINT')
for i, ((x,y,z), normal) in enumerate(zip(record['positions'], record['normals'])):
    # Generated eye sockets contain backwards vertex normals even on the front
    # surface. A normal-based mask exposes the old eye paint as triangular holes.
    # Position, depth and side falloff keep the projection off the back/ears.
    side = smooth(1.65, 1.70, y)
    width0, width1 = .045 + .04*side, .065 + .075*side
    weight = smooth(.005, .05, z) * smooth(1.475, 1.515, y) * (1-smooth(width0, width1, abs(x+.018)))
    weights.data[i].color = (weight, weight, weight, 1)
material = bpy.data.materials.new('face restoration')
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
base, face = [bpy.data.images.load(path, check_existing=False) for path in args[1:3]]
for image in (base, face): image.colorspace_settings.name = 'sRGB'
target = base.copy()
target.name = 'restored character atlas'
target.scale(int(args[4]), int(args[4]))
output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
mix = nodes.new('ShaderNodeMixRGB')
weight = nodes.new('ShaderNodeVertexColor'); weight.layer_name = 'ProjectionWeight'
links.new(weight.outputs['Color'], mix.inputs[0])
for index, (image, uv_name) in enumerate([(base,'Atlas'), (face,'Projection')]):
    uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = uv_name
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'EXTEND'
    links.new(uv.outputs['UV'], tex.inputs['Vector'])
    links.new(tex.outputs['Color'], mix.inputs[index+1])
links.new(mix.outputs['Color'], emission.inputs['Color'])
links.new(emission.outputs[0], output.inputs['Surface'])
bake = nodes.new('ShaderNodeTexImage'); bake.image = target
nodes.active = bake
mesh.materials.append(material)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.use_clear = False
scene.render.bake.margin = 8
bpy.ops.object.bake(type='EMIT')
target.filepath_raw = args[3]
target.file_format = 'PNG'
target.save()
print('Baked face projection without changing UV islands:', args[3])
