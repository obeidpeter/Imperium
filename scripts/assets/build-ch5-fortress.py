"""Build the original Chapter V modular fortress in Blender (metres, +Z up).

blender --background --python scripts/assets/build-ch5-fortress.py -- --repo .

Sixteen named component roots export at their local ground origin; the runtime
selects a component, never places the overlapping catalogue as one model.
The saved .blend arranges an inspectable contact sheet, with original packed
512px colour/roughness textures. Geometry and textures are deterministic.
"""
import argparse
import hashlib
import json
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
opts = parser.parse_args(args)
repo = os.path.abspath(opts.repo)
out = os.path.join(repo, 'art-source', 'models')
processed = os.path.join(out, 'processed')
os.makedirs(processed, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
rng = random.Random(5017)
materials = {}
texture_report = []


def surface(name, base, roughness, kind):
    """Original periodic fields, baked to colour + glTF ORM textures."""
    size = 512
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    u, v = x / size, y / size
    fine = (np.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1
    broad = (np.sin(u * math.tau * 3 + np.sin(v * math.tau * 2)) +
             np.cos(v * math.tau * 5 + np.sin(u * math.tau))) / 4
    medium = np.sin(u * math.tau * 17) * np.cos(v * math.tau * 13)
    field = broad * .12 + medium * .025 + (fine - .5) * .065
    if kind == 'timber':
        grain = np.sin(u * math.tau * 32 + np.sin(v * math.tau * 2) * 1.2)
        knots = np.cos(u * math.tau * 3 + np.cos(v * math.tau)) ** 24
        field += grain * .09 - knots * .13
    elif kind == 'canvas':
        field += ((x % 6 < 1) | (y % 6 < 1)) * -.055
        field += np.sin(v * math.tau * 6) * .025
    elif kind == 'plaster':
        chips = (broad + medium * .13 > .32)
        field -= chips * .16
    else:
        field -= (fine > .987) * .16
        field += np.sin(v * math.tau * 8 + np.sin(u * math.tau * 2)) * .02
    pixels = np.ones((size, size, 4), dtype=np.float32)
    for c in range(3):
        pixels[:, :, c] = np.clip(base[c] + field * (1 if c == 0 else .86), .015, .95)
    image = bpy.data.images.new(name + '_colour_original', width=size, height=size)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    orm = np.ones_like(pixels)
    orm[:, :, 1] = np.clip(roughness + field * .2, .3, 1)
    orm[:, :, 2] = 0
    rough = bpy.data.images.new(name + '_roughness_original', width=size, height=size)
    rough.colorspace_settings.name = 'Non-Color'
    rough.pixels.foreach_set(orm.ravel())
    rough.pack()
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = roughness
    colour = nodes.new('ShaderNodeTexImage')
    colour.image = image
    data = nodes.new('ShaderNodeTexImage')
    data.image = rough
    split = nodes.new('ShaderNodeSeparateColor')
    mat.node_tree.links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(data.outputs['Color'], split.inputs['Color'])
    mat.node_tree.links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    mat.diffuse_color = (*base, 1)
    materials[kind] = mat
    texture_report.append({'family': name, 'size': size, 'authorship': 'Original deterministic procedural bake', 'channels': ['baseColor', 'roughness']})


surface('Euphrates honey limestone', (.59, .51, .39), .92, 'stone')
surface('Worn ochre gypsum and brick', (.56, .39, .24), .96, 'plaster')
surface('Weathered cedar grain', (.25, .19, .13), .88, 'timber')
surface('Dusty flax canvas weave', (.64, .57, .43), .97, 'canvas')
roots = []
current = None


def component(name):
    global current
    current = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(current)
    current['component'] = name
    current['units'] = 'metres'
    current['authorship'] = 'Original Blender architecture for Imperium; fictional Euphrates fortress'
    roots.append(current)
    return current


def finish(obj, name, mat='stone', bevel=.025):
    obj.name = current.name + '_' + name
    obj.parent = current
    obj.data.materials.append(materials[mat])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Worn arris', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Box projection in object-local metres: consistent texel density at joins.
    uv = obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda k: abs(poly.normal[k]))
        axes = [(1, 2), (0, 2), (0, 1)][axis]
        for loop in poly.loop_indices:
            co = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (co[axes[0]] * .65, co[axes[1]] * .65)
    obj.select_set(False)
    return obj


def box(name, x, z, y, w, d, h, mat='stone', bevel=.025, rotate=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, z, y))
    obj = bpy.context.object
    obj.scale = (w, d, h)
    obj.rotation_euler.z = rotate
    return finish(obj, name, mat, bevel)


def beam(name, a, b, width=.16, mat='timber'):
    # Script coordinates use x, depth, height, matching Blender's x,y,z.
    av, bv = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(av + bv) / 2)
    obj = bpy.context.object
    obj.scale = (width, width, (bv-av).length)
    obj.rotation_euler = (bv-av).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, name, mat, .018)


def masonry(w=4, h=4.4, depth=.9, broken=False, x=0, z=0, base=.18):
    rows = math.ceil(h / .46)
    for row in range(rows):
        n = 5
        for col in range(n):
            px = (col - 2) * w/n + (w/n*.13 if row % 2 else 0)
            if broken and row > 3 + (col-1.1)**2 * .8:
                continue
            block = box('masonry', x+px, z, base+(row+.5)*h/rows, w/n-.025, depth, h/rows-.023,
                        'stone' if row < 2 else 'plaster', .025)
            if broken and row >= 3:
                block.rotation_euler.y = (rng.random()-.5)*.07


def coping(w=4, y=4.7, z=0):
    box('coping', 0, z, y, w+.18, 1.2, .20)
    for x in [-1.5, -.5, .5, 1.5]:
        box('merlon', x*w/4, z, y+.50, .55*w/4, .92, .78, 'plaster')


component('wall_bay')
box('battered_footing', 0, 0, .18, 4.2, 1.55, .36)
masonry()
coping()
box('drain_spout', .8, -.72, 3.85, .25, .65, .20)

component('wall_breached')
box('foundation', 0, 0, .18, 4.3, 1.6, .36)
masonry(broken=True)
for i in range(8):
    box('fallen_masonry', rng.uniform(-1.8, 1.8), rng.uniform(-1.1, .7), .18+rng.random()*.16,
        .38+rng.random()*.30, .42, .32, 'plaster', .04, rng.random()*2)

component('wall_return')
masonry(w=3.8, h=3.4)
for i in range(7):
    box('return', -1.5, 1.3, .25+i*.46, .9, 3.5, .43, 'plaster')
box('return_cap', -1.5, 1.3, 3.6, 1.15, 3.7, .25)


def tower(broken=False):
    width = 4.4
    top = 6.3 if broken else 7.1
    box('battered_foundation', 0, 0, .22, 4.9, 4.9, .44)
    for row in range(14 if broken else 15):
        y=.46+(row+.5)*.43
        for side in [-1, 1]:
            for col in range(5):
                if broken and side < 0 and row > 7 + col:
                    continue
                if not broken and side < 0 and row in [8, 9, 10] and col == 2:
                    continue
                box('face_course', (col-2)*.87, side*1.94, y, .845, .50, .408,
                    'stone' if row < 3 else 'plaster')
            box('side_course', side*1.94, 0, y, .50, 3.45, .408, 'stone' if row<3 else 'plaster')
    box('timber_upper_floor', 0, 0, 5.6 if broken else 6.7, 3.7, 3.7, .18, 'timber')
    if not broken:
        for side in [-1,1]:
            box('upper_string', 0, side*2.02, 6.98, 4.6, .72, .18)
            for i in range(4):
                box('tower_merlon', (i-1.5)*1.08, side*2.0, 7.5, .66, .72, .88, 'plaster')
            for z in [-1.05,0,1.05]:
                box('side_merlon', side*2.0, z, 7.5, .72, .66, .88, 'plaster')
        box('window_sill', 0, -2.26, 3.77, 1.12, .16, .12)
    else:
        beam('exposed_floor', (-1.8,-2.3,4.45),(1.7,-2.3,4.70),.20)
        beam('fractured_beam', (-.4,-2.2,5.25),(.4,-2.65,3.9),.18)
    for side in [-1,1]:
        for step in range(5):
            box('battered_buttress', side*1.87, -2.35+step*.07, .3+step*.55,
                .67-step*.05, .90-step*.10, .6)


component('tower_intact')
tower()
component('tower_broken')
tower(True)

component('gate_arch')
for side in [-1,1]:
    for row in range(6):
        box('jamb', side*2.35, 0, (row+.5)*.43, .72, 1.45, .412)
# An actual open semicircular voussoir ring, independently beveled blocks.
radius, outer, rise = 1.98, 2.75, 2.58
for i in range(13):
    a, b = i*math.pi/13+.008, (i+1)*math.pi/13-.008
    vertices=[]
    for z in [-.72,.72]:
        for r,t in [(radius,a),(outer,a),(outer,b),(radius,b)]:
            vertices.append((r*math.cos(t),z,rise+r*math.sin(t)))
    mesh=bpy.data.meshes.new('cut_arch_stone')
    mesh.from_pydata(vertices,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    obj=bpy.data.objects.new('voussoir',mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,'voussoir',bevel=.018)
box('inscription_band',0,0,5.43,6.1,1.62,.35,'plaster')
for side in [-1,1]:
    box('projecting_base',side*2.35,0,.16,1.0,1.82,.32)

component('buttress')
for i in range(7):
    box('course',0,i*.06,(i+.5)*.43,1.18-i*.07,1.68-i*.14,.405)
box('buttress_cap',0,.35,3.13,.85,.94,.23)

component('mine_frame')
for z in [-1.2,-.4,.4,1.2]:
    for x in [-1.12,1.12]:
        beam('pit_prop',(x,z,0),(x,z,2.2),.19)
    beam('crosshead',(-1.32,z,2.25),(1.32,z,2.25),.23)
for i in range(11):
    box('roof_lagging',(i-5)*.235,0,2.42,.22,2.85,.12,'timber',.01)
for side in [-1,1]:
    beam('diagonal_shore',(side*1.12,-1.22,.15),(side*1.12,-.42,2.05),.14)
    beam('roof_brace',(side*1.12,1.2,.3),(side*1.12,-.4,2.15),.13)

component('roof_gallery')
for x in [-2.6,0,2.6]:
    for z in [-1.65,1.65]:
        beam('column',(x,z,0),(x,z,3.05),.19)
        beam('braced_corner',(x,z,2.15),(x+.50 if x<=0 else x-.5,z,3.0),.13)
for z in [-1.65,1.65]:
    beam('long_binder',(-2.8,z,3.08),(2.8,z,3.08),.22)
for x in [-2.7,-1.35,0,1.35,2.7]:
    beam('rafter',(x,-1.9,3.1),(x,1.9,3.1),.14)
vertices=[]
faces=[]
for j in range(9):
    for i in range(15):
        x=(i/14-.5)*6; z=(j/8-.5)*4
        vertices.append((x,z,3.45-.20*math.sin(i/14*math.pi)*math.sin(j/8*math.pi)))
        if i<14 and j<8:
            n=j*15+i;faces.append((n,n+1,n+16,n+15))
mesh=bpy.data.meshes.new('sagging_canvas');mesh.from_pydata(vertices,[],faces)
obj=bpy.data.objects.new('canopy',mesh);bpy.context.collection.objects.link(obj)
finish(obj,'canvas_roof','canvas',0)
solid=obj.modifiers.new('Double face', 'SOLIDIFY');solid.thickness=.015
bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)

component('stair_flight')
for i in range(9):
    box('stair_tread',0,-1.8+i*.43,(i+1)*.22/2,2.1,.46,(i+1)*.22,'stone',.02)
for side in [-1,1]:
    beam('stair_rail',(side*1.12,-1.9,.95),(side*1.12,1.9,2.8),.065)

component('landing_deck')
for j in range(22):
    box('deck_board',0,(j-10.5)*.27,.48,3.8,.25,.15,'timber',.012)
for x in [-1.65,1.65]:
    beam('under_binder',(x,-2.95,.30),(x,2.95,.30),.22)
    for z in [-2.6,0,2.6]:
        beam('mooring_post',(x,z,0),(x,z,1.1),.20)

component('quay_revetment')
for row in range(4):
    for col in range(5):
        box('quay_course',(col-2)*.8,0,(row+.5)*.42,.78,1.4,.40,'stone',.04)
box('quay_cap',0,0,1.8,4.2,1.65,.26)

component('bluff_section')
# Layered, fractured cliff wedge: narrow at the crest, broad at the foot.
for row in range(5):
    for col in range(4):
        x=(col-1.5)*1.75+rng.uniform(-.12,.12)
        obj=box('limestone_bed',x, .25*row,(row+.5)*.72,1.85,.9+row*.25,.78,'stone',.16)
        obj.rotation_euler.z=rng.uniform(-.06,.06)

component('drain_channel')
for side in [-1,1]:
    box('drain_side',side*.8,0,.21,.28,4,.42)
for j in range(6):
    box('drain_bed',0,(j-2.5)*.65,.055,1.35,.63,.11,'stone',.015)

component('paved_threshold')
for row in range(4):
    for col in range(5):
        box('paving',(col-2)*.79,(row-1.5)*.74,.075+rng.uniform(-.008,.008),.76,.71,.15,'stone',.022)

component('plaster_repair')
# A wall panel with irregular exposed stone and an inset gypsum repair layer.
masonry(w=4,h=2.7)
for row in range(6):
    for col in range(7):
        if (row+col)%5==0 or (row==0 and col>3):
            continue
        box('gypsum_patch',(col-3)*.56,-.49,.5+row*.38,.58,.08,.40,'stone',.025)

assert len(roots)==16
# Join by material within each component: four material slots at most, with
# named component roots preserved for selective loading and shared geometry.
reports=[]
for root in roots:
    for mat in materials.values():
        chosen=[o for o in list(root.children) if o.type=='MESH' and o.data.materials[0]==mat]
        if not chosen:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in chosen:o.select_set(True)
        bpy.context.view_layer.objects.active=chosen[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=root.name+'_'+mat.name.split()[0]
        obj.parent=root
        bpy.context.scene.cursor.location=(0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        obj.select_set(False)
    bpy.context.view_layer.update()
    if root.name=='bluff_section':
        # Fractured geological bedding should not read as dressed wall blocks.
        # Deform coherently in metres, preserving the base and upper bounds.
        for obj in root.children:
            matrix=obj.matrix_world.copy();inverse=matrix.inverted()
            for v in obj.data.vertices:
                q=matrix@v.co
                x,y,z=q.x,q.y,q.z
                q.x+=.16*math.sin(z*3.1+y*1.2)
                q.y+=.28*math.sin(x*1.9+z*.8)+.08*math.sin(x*5+z*2)
                q.z+=.10*math.sin(x*2+y*1.5)*min(1,max(0,z/.4))*min(1,max(0,(3.7-z)/.5))
                v.co=inverse@q
            obj.data.update()
    points=[o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    for obj in root.children:obj.location.z-=lo[2]
    hi[2]-=lo[2]
    lo[2]=0
    tris=sum(len(p.vertices)-2 for o in root.children for p in o.data.polygons)
    reports.append({'name':root.name,'triangles':tris,'boundsBlender':{'min':lo,'max':hi},'materials':len(root.children)})

bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
glb=os.path.join(processed,'ch5-fortress-kit.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',export_yup=True,export_animations=False,export_extras=True,export_image_format='AUTO',export_materials='EXPORT',export_normals=True,export_texcoords=True)
# Saved Blender contact sheet is deliberately spread out for editing, while
# each runtime component exported above remains at its own local origin.
for i,root in enumerate(roots):root.location=((i%4)*11,(i//4)*11,0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ch5-fortress-kit.blend'))
with open(glb,'rb') as f:raw=f.read()
report={'version':1,'generator':'scripts/assets/build-ch5-fortress.py','seed':5017,'authorship':'Original Blender-authored geometry and original procedural surface bakes; no external images','licence':'Created for the Imperium project; no third-party source assets','components':reports,'materials':texture_report,'output':{'path':'art-source/models/processed/ch5-fortress-kit.glb','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':sum(r['triangles'] for r in reports)}}
with open(os.path.join(processed,'ch5-fortress-kit.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report['output']))
