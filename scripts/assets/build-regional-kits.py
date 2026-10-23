"""Author five original modular regional architecture kits for Imperium.

Run with Blender --background --python-exit-code 1 --python this.py -- --repo .
Runtime GLBs preserve twelve named component roots at the local ground origin.
Each saved .blend spreads its catalogue for editing. All shapes and 512px
periodic material bakes are original, deterministic work; no source images.
"""
import argparse
import hashlib
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--repo', default=os.path.join(os.path.dirname(__file__), '..', '..'))
parser.add_argument('--only', default='')
opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REPO = os.path.abspath(opts.repo)
SOURCE = os.path.join(REPO, 'art-source', 'models')
PROCESSED = os.path.join(SOURCE, 'processed')
os.makedirs(PROCESSED, exist_ok=True)
FAMILIES = {
    'timber': ('Weathered cedar grain', (.25, .19, .13), .88, 'timber'),
    'canvas': ('Dusty flax canvas weave', (.64, .57, .43), .97, 'canvas'),
    'ochre': ('Worn ochre gypsum and brick', (.56, .39, .24), .96, 'plaster'),
    'stone': ('River-worn grey limestone', (.43, .46, .43), .94, 'stone'),
    'lime': ('Weathered ivory lime render', (.73, .69, .57), .94, 'plaster'),
    'tile': ('Oxide red fired clay tile', (.43, .19, .115), .87, 'clay'),
    'travertine': ('Pitted pale travertine', (.72, .65, .48), .90, 'stone'),
}
KITS = [
    ('danube-military', ['stone', 'lime', 'tile', 'timber'], [1, 3, 4]),
    ('river-wetlands', ['stone', 'ochre', 'canvas', 'timber'], [2, 8]),
    ('italian-marching', ['lime', 'canvas', 'tile', 'timber'], [6, 7]),
    ('provincial-civic', ['stone', 'lime', 'tile', 'timber'], [10]),
    ('roman-monumental', ['travertine', 'lime', 'tile', 'timber'], [11, 12]),
]
materials = {}
roots = []
current = None


def surface(key):
    name, base, roughness, kind = FAMILIES[key]
    size = 512
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    u, v = x / size, y / size
    broad = (np.sin(u * math.tau * 3 + np.sin(v * math.tau * 2)) +
             np.cos(v * math.tau * 5 + np.sin(u * math.tau))) / 4
    medium = np.sin(u * math.tau * 17) * np.cos(v * math.tau * 13)
    field = broad * .08 + medium * .017
    if kind == 'timber':
        field += np.sin(u * math.tau * 31 + np.sin(v * math.tau * 2)) * .045
        field -= np.cos(u * math.tau * 3 + np.cos(v * math.tau)) ** 24 * .065
    elif kind == 'canvas':
        field -= ((x % 8 < 1) | (y % 8 < 1)) * .027
    elif kind == 'plaster':
        field -= (broad + medium * .14 > .34) * .055
    elif kind == 'clay':
        field += np.sin(v * math.tau * 29 + np.sin(u * math.tau * 3)) * .021
    else:
        field -= (np.sin(u * 97) * np.cos(v * 113) > .97) * .07
    pixels = np.ones((size, size, 4), dtype=np.float32)
    for c in range(3):
        pixels[:, :, c] = np.clip(base[c] + field * (1 if c == 0 else .85), .02, .95)
    image = bpy.data.images.new(name + '_colour_original', width=size, height=size)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    orm = np.ones_like(pixels)
    orm[:, :, 1] = np.clip(roughness + broad * .045, .3, 1)
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
    colour = nodes.new('ShaderNodeTexImage'); colour.image = image
    data = nodes.new('ShaderNodeTexImage'); data.image = rough
    split = nodes.new('ShaderNodeSeparateColor')
    mat.node_tree.links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(data.outputs['Color'], split.inputs['Color'])
    mat.node_tree.links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    mat.diffuse_color = (*base, 1)
    materials[key] = mat


def component(name):
    global current
    current = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(current)
    current['component'] = name
    current['units'] = 'metres'
    current['authorship'] = 'Original fictional third-century regional architecture for Imperium'
    roots.append(current)


def finish(obj, name, mat, bevel=0):
    obj.name = current.name + '_' + name
    obj.parent = current
    obj.data.materials.append(materials[mat])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft worn edge', 'BEVEL')
        mod.width = bevel; mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    uv = obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda k: abs(poly.normal[k]))
        axes = [(1, 2), (0, 2), (0, 1)][axis]
        for loop in poly.loop_indices:
            co = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (co[axes[0]] * .6, co[axes[1]] * .6)
    obj.select_set(False)
    return obj


def box(name, x, y, z, w, d, h, mat='timber', bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.object; obj.scale = (w, d, h)
    return finish(obj, name, mat, bevel)


def mesh(name, vertices, faces, mat='timber', bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, bevel)


def beam(name, a, b, w=.15, mat='timber', d=None):
    av, bv = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(av + bv) / 2)
    obj = bpy.context.object; obj.scale = (w, d or w, (bv - av).length)
    obj.rotation_euler = (bv - av).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, name, mat)


def cylinder(name, x, y, z, radius, h, mat='timber', sides=12, radius2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius,
        radius2=radius if radius2 is None else radius2, depth=h, location=(x, y, z))
    return finish(bpy.context.object, name, mat)


def footing(w, d, mat='stone', z=.16):
    box('footing', 0, 0, z / 2, w, d, z, mat, .025)


def gable_roof(w=5.4, d=5.6, eave=2.8, rise=1.35, mat='tile'):
    # The two pitched slopes, exposed timber ridge and staggered tile ridges
    # give a legible roof silhouette without thousands of individual tiles.
    for side in [-1, 1]:
        verts = [(0, -d/2, eave+rise), (side*w/2, -d/2, eave),
                 (side*w/2, d/2, eave), (0, d/2, eave+rise)]
        if side < 0: verts.reverse()
        roof = mesh('pitched_roof', verts, [(0, 1, 2, 3)], mat)
        solid = roof.modifiers.new('Roof thickness', 'SOLIDIFY'); solid.thickness = .075
        bpy.context.view_layer.objects.active = roof; bpy.ops.object.modifier_apply(modifier=solid.name)
        for k in range(1, 6):
            t = k/6
            beam('tile_course', (side*w/2*t, -d/2, eave+rise*(1-t)+.035),
                 (side*w/2*t, d/2, eave+rise*(1-t)+.035), .055, mat)
        for j in range(8):
            y = -d/2+(j+.5)*d/8
            beam('tile_roll', (0,y,eave+rise+.045), (side*w/2,y,eave+.045), .043, mat)
    beam('ridge', (0,-d/2-.08,eave+rise), (0,d/2+.08,eave+rise), .17, mat)
    for y in [-d/2, d/2]:
        for side in [-1,1]:
            beam('barge_board', (0,y,eave+rise-.06), (side*w/2,y,eave-.06), .13)


def walls(w=5, d=5, h=2.65, mat='lime', base=.16):
    # Open door and slit windows are real gaps, not painted black rectangles.
    box('back_wall',0,d/2,h/2+base,w,.26,h,mat,.02)
    for side in [-1,1]:
        box('side_wall',side*w/2,0,h/2+base,.26,d,h,mat,.02)
        box('door_jamb',side*(w+1.05)/4,-d/2,h/2+base,(w-1.05)/2,.28,h,mat,.02)
    box('door_lintel',0,-d/2,h-.20+base,1.1,.31,.4,mat,.025)
    for y in [-d/2,d/2]:
        obj=mesh('gable_infill',[(-w/2,y,h+base),(w/2,y,h+base),(0,y,h+1.35+base)],[(0,1,2) if y<0 else (2,1,0)],mat)
        solid=obj.modifiers.new('Gable thickness','SOLIDIFY');solid.thickness=.06
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)


def posts(w=4,d=3,h=2.5,base=0):
    for x in [-w/2,w/2]:
        for y in [-d/2,d/2]:
            beam('upright',(x,y,base),(x,y,h+base),.18)
            beam('knee_brace',(x,y,h-.65+base),(x+(.65 if x<0 else -.65),y,h+base),.12)
    for y in [-d/2,d/2]: beam('header',(-w/2-.12,y,h+base),(w/2+.12,y,h+base),.2)


def canvas(w=4.5,d=3.8,h=2.65,rise=.3):
    vertices=[]; faces=[]
    for j in range(7):
        for i in range(9):
            u,v=i/8,j/6
            vertices.append(((u-.5)*w,(v-.5)*d,h+rise*(1-abs(u*2-1))-.13*math.sin(u*math.pi)*math.sin(v*math.pi)))
            if i<8 and j<6:
                n=j*9+i;faces.append((n,n+1,n+10,n+9))
    obj=mesh('woven_canopy',vertices,faces,'canvas')
    solid=obj.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.012
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)


def deck(w=3,d=5,z=.45):
    n=math.ceil(d/.3)
    for j in range(n): box('deck_board',0,(j-(n-1)/2)*d/n,z,w,d/n-.025,.12)
    for x in [-w*.4,w*.4]:
        beam('deck_binder',(x,-d/2,z-.16),(x,d/2,z-.16),.20)
        for y in [-d*.4,d*.4]:beam('deck_pile',(x,y,0),(x,y,z+.6),.18)


def arch(w=3.0,h=3.0,depth=.75,mat='travertine'):
    r=w/2; thick=.42; spring=h-r
    for side in [-1,1]:
        box('arch_pier',side*(r+thick/2),0,spring/2,thick,depth,spring,mat,.018)
        box('pier_foot',side*(r+thick/2),0,.12,thick+.2,depth+.18,.24,mat,.018)
    for i in range(11):
        a,b=i*math.pi/11+.008,(i+1)*math.pi/11-.008
        v=[]
        for y in [-depth/2,depth/2]:
            for radius,t in [(r,a),(r+thick,a),(r+thick,b),(r,b)]:
                v.append((radius*math.cos(t),y,spring+radius*math.sin(t)))
        mesh('arch_voussoir',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,.01)


def column(x,y,h=3.4,mat='travertine',base=0):
    box('column_plinth',x,y,base+.12,.66,.66,.24,mat,.02)
    cylinder('column_base',x,y,base+.31,.31,.15,mat)
    cylinder('tapered_shaft',x,y,base+.43+(h-.85)/2,.235,h-.85,mat,12,.195)
    cylinder('capital_cushion',x,y,base+h-.29,.29,.16,mat)
    box('capital_abacus',x,y,base+h-.12,.62,.62,.24,mat,.02)


def stairs(w=3,depth=3,height=1.2,mat='stone',steps=6):
    for i in range(steps):
        ht=height*(i+1)/steps
        box('tread',0,-depth/2+(i+.5)*depth/steps,ht/2,w,depth/steps+.015,ht,mat,.012)


def danube():
    component('barrack_gable');footing(5.5,6.3);walls(5,5.8);gable_roof(5.6,6.4,2.82)
    for x in [-2.05,2.05]:box('door_post',x,-2.98,1.45,.18,.18,2.6)
    component('storehouse_raised');footing(5.6,5.5)
    for x in [-2,0,2]:
        for y in [-1.9,1.9]:box('vented_pier',x,y,.6,.6,.6,1.2,'stone',.02)
    box('raised_floor',0,0,1.2,5,4.8,.2);walls(4.7,4.5,2.15,base=1.3);gable_roof(5.4,5.2,3.45,1.15)
    for i in range(4):box('loading_step',0,-2.8+i*.22,(i+1)*.3/2,1.5,.25,(i+1)*.3,'stone')
    component('timber_gate');posts(5,2.6,3.2)
    for x in [-2.5,2.5]:
        for i in range(6):box('flanking_planks',x,-.35+i*.3,1.3,.25,.27,2.6)
    gable_roof(6,3.5,3.3,.9);beam('gate_lintel',(-2.8,-1.3,2.6),(2.8,-1.3,2.6),.25)
    component('palisade_bay')
    for i in range(13):
        x=(i-6)*.31;cylinder('hewn_post',x,0,1.4,.175,2.8,sides=7)
        cylinder('point',x,0,2.95,.175,.3,sides=7,radius2=.015)
    for z in [.7,2.05]:beam('back_binder',(-2.1,.2,z),(2.1,.2,z),.16)
    component('watch_platform');posts(2.8,2.8,4);deck(3.25,3.25,4);gable_roof(3.7,3.7,6.2,.7)
    for x in [-1.4,1.4]:
        for y in [-1.4,1.4]:beam('upper_post',(x,y,4),(x,y,6.25),.15)
        beam('diagonal',(x,-1.4,.2),(x,1.4,3.9),.14)
    for i in range(12):beam('ladder_rung',(-.4,-1.8,i*.33+.2),(.4,-1.8,i*.33+.2),.07)
    for x in [-.48,.48]:beam('ladder_rail',(x,-1.8,0),(x,-1.8,4.2),.1)
    component('tiled_portico');posts(5.4,2.5,2.8);gable_roof(6,3.2,2.9,.7);footing(6,3.2)
    component('granary_vent');footing(3.8,1.5)
    for i in range(6):
        x=(i-2.5)*.57;box('pier',x,0,.75,.34,1.25,1.5,'stone',.02)
    box('sill',0,0,1.55,3.7,1.4,.2,'stone',.02)
    component('ditch_bridge');deck(3.5,5,.65)
    for x in [-1.6,1.6]:beam('handrail',(x,-2.45,1.45),(x,2.45,1.45),.1)
    component('forge_shelter');posts(4.2,3,2.5);gable_roof(4.8,3.7,2.6,.65)
    box('forge_hearth',0,.65,.5,1.5,1.1,1,'stone',.04);box('chimney',0,1.0,2.1,.65,.65,2.6,'lime',.02)
    component('stone_well')
    ring('well_ring',1.0,.72,.95,'stone');posts(2.2,.7,2.5);gable_roof(2.8,2.1,2.55,.7)
    beam('winding_axle',(-1.25,0,1.9),(1.25,0,1.9),.12)
    component('signal_beacon');footing(1.8,1.8)
    for x,y in [(-.55,-.55),(.55,-.55),(.55,.55),(-.55,.55)]:beam('beacon_leg',(x,y,0),(x*.6,y*.6,2.6),.15)
    box('beacon_brazier',0,0,2.65,1.2,1.2,.3,'stone',.04)
    component('milestone_base');footing(1.3,1.3);cylinder('milestone',0,0,1.0,.35,1.8,'stone',12)


def ring(name,outer,inner,h,mat,z=0,sides=16):
    v=[]
    for level in [z,z+h]:
        for radius in [outer,inner]:
            for i in range(sides):v.append((radius*math.cos(i*math.tau/sides),radius*math.sin(i*math.tau/sides),level))
    faces=[]
    for i in range(sides):
        j=(i+1)%sides
        faces += [(i,j,j+2*sides,i+2*sides),(i+sides,i+3*sides,j+3*sides,j+sides),
                  (i+2*sides,j+2*sides,j+3*sides,i+3*sides),(i,i+sides,j+sides,j)]
    return mesh(name,v,faces,mat,.015)


def wetlands():
    component('duckboard_straight');deck(2.5,5,.35)
    component('duckboard_corner');deck(3.4,3.4,.35)
    for y in [-1.5,1.5]:beam('corner_rail',(-1.5,y,.95),(1.5,y,.95),.1)
    component('landing_steps');stairs(3,3.6,1.4,'timber',7)
    for x in [-1.5,1.5]:beam('step_rail',(x,-1.8,1),(x,1.8,2.4),.1)
    component('mooring_jetty');deck(3.4,6,.6)
    for x in [-1.4,1.4]:
        for y in [-2.5,2.5]:cylinder('bollard',x,y,.8,.16,1.6,sides=8)
    component('reed_screen')
    for i in range(25):
        x=(i-12)*.15;cylinder('reed_bundle',x,0,1+.06*math.sin(i),.065,2+.12*math.sin(i),'ochre',5)
    for z in [.45,1.5]:beam('woven_binder',(-1.95,-.09,z),(1.95,-.09,z),.07)
    component('stilt_store');deck(4,4.4,1.25);posts(3.7,4.1,3.7);gable_roof(4.7,4.9,3.7,1.1,'timber')
    for x in [-1.85,1.85]:
        for j in range(10):box('slat_wall',x,(j-4.5)*.4,2.45,.12,.36,2.2)
    for i in range(9):box('rear_slats',(i-4)*.41,2.05,2.45,.37,.12,2.2)
    component('fish_drying_rack');posts(3.6,1.8,2.35)
    for i in range(9):beam('drying_spar',((i-4)*.4,-1,2.4),((i-4)*.4,1,2.4),.07)
    for z in [.8,1.55]:beam('cross_spar',(-1.8,0,z),(1.8,0,z),.09)
    component('flood_revetment')
    for row in range(5):
        for i in range(7):box('riverstone',(i-3)*.58+(row%2)*.07,row*.07,(row+.5)*.28,.55,.85-row*.06,.26,'stone',.045)
    component('ferry_shelter');posts(4.5,3.2,2.5);canvas(5,3.9,2.7,.3)
    box('waiting_bench',0,.7,.52,3.6,.48,.15);box('bench_foot',-1.4,.7,.25,.2,.45,.5);box('bench_foot',1.4,.7,.25,.2,.45,.5)
    component('rope_bollards')
    for x in [-1.25,1.25]:
        cylinder('mooring_pile',x,0,.65,.22,1.3,sides=10)
        for z in [.65,.75,.85]:
            bpy.ops.mesh.primitive_torus_add(major_radius=.235,minor_radius=.035,major_segments=12,minor_segments=4,location=(x,0,z));finish(bpy.context.object,'rope_turn','canvas')
    beam('rope_between',(-1.25,0,.75),(1.25,0,.75),.045,'canvas')
    component('levee_stair');stairs(2.2,3,1.5,'stone',6)
    component('bridge_trestle');deck(5.5,2.3,2)
    for x in [-2.2,2.2]:
        beam('splayed_leg',(x,-1.25,0),(x,-.8,2),.24);beam('splayed_leg',(x,1.25,0),(x,.8,2),.24)
        beam('cross_brace',(x,-1.2,.2),(x,.9,1.9),.14)


def italian():
    component('command_pavilion');posts(5.8,4.3,2.65);canvas(6.6,5.1,2.85,1.1)
    for x in [-2.9,2.9]:box('side_curtain',x,.1,1.35,.025,4,2.4,'canvas')
    for side in [-1,1]:beam('guy_rope',(side*3.25,-2.5,2.8),(side*3.8,-3.1,.1),.026,'canvas')
    component('ridge_tent')
    v=[(-1.8,-2,0),(1.8,-2,0),(0,-2,2.5),(-1.8,2,0),(1.8,2,0),(0,2,2.5)]
    obj=mesh('pitched_canvas',v,[(0,3,5,2),(2,5,4,1),(3,4,5)],'canvas')
    solid=obj.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.012;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)
    for y in [-2,2]:beam('ridge_support',(0,y,0),(0,y,2.55),.095)
    beam('ridge_pole',(0,-2.1,2.5),(0,2.1,2.5),.12)
    component('officers_awning');posts(3.8,3.1,2.5);canvas(4.3,3.7,2.7,.25)
    box('map_table',0,0,1,2,.9,.12)
    for x in [-.8,.8]:beam('table_leg',(x,0,0),(x,0,1),.12)
    component('wagon_shed');posts(5.6,4.4,3.2);gable_roof(6.3,5.2,3.3,1.0)
    for x in [-2.8,2.8]:beam('side_brace',(x,-2.2,.2),(x,2.2,3.1),.15)
    component('roadside_shrine');footing(2.4,2.0,'lime');walls(1.9,1.5,1.75,'lime');gable_roof(2.5,2.15,1.92,.7)
    box('offering_shelf',0,-1.05,.65,1.25,.55,.18,'lime',.02)
    component('marching_gate');posts(5,.8,3.2);beam('crossbar',(-2.85,0,3.15),(2.85,0,3.15),.25)
    for x in [-2.5,2.5]:beam('gate_strut',(x*1.3,0,0),(x,0,2.4),.13)
    component('field_kitchen');posts(3.8,3,2.5);canvas(4.3,3.5,2.65,.2)
    ring('clay_oven',.8,.5,.65,'lime');box('preparation_slab',1.1,.5,.75,1.2,.8,.12)
    for x in [.65,1.55]:beam('bench_leg',(x,.5,0),(x,.5,.75),.13)
    component('baggage_rack');posts(3.4,1.5,2)
    for z in [.55,1.25,2]:
        for i in range(5):box('rack_shelf',0,(i-2)*.28,z,3.6,.24,.08)
    component('drainage_crossing');footing(3.6,2.8,'lime')
    for x in [-1.5,1.5]:box('culvert_side',x,0,.4,.35,2.8,.8,'lime',.025)
    for i in range(7):box('crossing_slab',(i-3)*.5,0,.88,.48,2.9,.2,'lime',.025)
    component('vine_pergola');posts(5,3,2.6)
    for i in range(9):beam('pergola_rafter',((i-4)*.65,-1.85,2.7),((i-4)*.65,1.85,2.7),.1)
    for x in [-2.5,2.5]:
        for i in range(7):beam('vine_lattice',(x,-1.5,i*.28+.35),(x,1.5,i*.28+.35),.035)
    component('road_marker');footing(1.3,1.2,'lime');cylinder('mile_marker',0,0,1.15,.33,2.1,'lime',12)
    component('canvas_windbreak');posts(4,.5,1.9)
    obj=mesh('stretched_canvas',[(-2,0,.2),(2,0,.2),(2,0,1.9),(-2,0,1.9)],[(0,1,2,3)],'canvas')
    solid=obj.modifiers.new('Two-sided cloth thickness','SOLIDIFY');solid.thickness=.012
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)


def provincial():
    component('raised_granary');footing(6,5.6)
    for x in [-2.2,0,2.2]:
        for y in [-2,0,2]:box('stone_pier',x,y,.6,.55,.55,1.2,'stone',.02)
    box('suspended_floor',0,0,1.25,5.5,5,.22);walls(5.1,4.7,2.3,base=1.36);gable_roof(5.8,5.5,3.66,1.25)
    component('tribunal_portico');footing(6,3.7,'lime',.4);posts(5.2,2.8,3.1,.4);gable_roof(6,3.8,3.6,1.05)
    box('tribunal_back',0,1.5,1.9,5.7,.25,3,'lime',.03);box('raised_bench',0,.4,.85,3,.65,.65,'lime',.02)
    component('farm_courtyard_wall');footing(5.2,.8)
    for row in range(5):
        for i in range(8):box('fieldstone',(i-3.5)*.63,.03*(row%2),(row+.5)*.36,.6,.57,.34,'stone',.025)
    box('tile_coping',0,0,1.92,5.25,.8,.19,'tile',.025)
    component('tile_roof_store');footing(4.8,4.7);walls(4.3,4.2,2.4);gable_roof(5.0,4.9,2.57,1.1)
    component('market_stall');posts(3.6,2.5,2.4);gable_roof(4.2,3.2,2.5,.6)
    box('stall_counter',0,-.7,.95,3.4,.8,.15)
    for x in [-1.4,1.4]:box('counter_leg',x,-.7,.45,.16,.65,.9)
    component('olive_press_frame');footing(3,2.5)
    for x in [-1.1,1.1]:beam('press_upright',(x,0,0),(x,0,2.9),.27)
    beam('press_header',(-1.45,0,2.8),(1.45,0,2.8),.3);cylinder('press_screw',0,0,1.9,.13,1.7,sides=10)
    cylinder('press_disk',0,0,1.1,.8,.2,sides=16);ring('press_basin',1.0,.85,.28,'stone')
    beam('press_handle',(-.8,0,2.45),(.8,0,2.45),.08)
    component('irrigation_sluice')
    for x in [-.85,.85]:box('channel_bank',x,0,.4,.45,3.3,.8,'stone',.03)
    box('channel_bed',0,0,.06,1.4,3.3,.12,'stone')
    for x in [-.6,.6]:beam('sluice_post',(x,0,.05),(x,0,1.6),.16)
    box('sluice_gate',0,0,.68,1.1,.13,1.15);beam('lifting_bar',(-.8,0,1.55),(.8,0,1.55),.14)
    component('pergola_arcade');posts(5.8,3.2,2.8)
    for i in range(10):beam('vine_rafter',((i-4.5)*.65,-1.9,2.9),((i-4.5)*.65,1.9,2.9),.11)
    for x in [-2.9,0,2.9]:beam('center_post',(x,1.6,0),(x,1.6,2.8),.18)
    component('boundary_cairn')
    for row in range(4):
        for i in range(5-row):box('cairn_stone',(i-(4-row)/2)*.38,0,(row+.5)*.3,.4,.65-row*.1,.29,'stone',.06)
    component('public_fountain');ring('basin',1.5,1.25,.6,'stone');cylinder('central_plinth',0,0,.85,.35,1.7,'lime',12)
    box('spout',0,-.4,1.45,.19,.4,.16,'stone',.02)
    component('tally_counter');footing(3.2,2.1,'lime');box('ledger_counter',0,0,.85,2.8,1.5,.2)
    for x in [-1.15,1.15]:box('counter_pier',x,0,.4,.3,1.15,.8,'lime',.02)
    box('ledger_slot',0,.5,1.15,2.6,.08,.45)
    component('produce_store');posts(3.6,3.2,2.4);gable_roof(4.3,3.9,2.5,.9)
    for side in [-1,1]:
        for j in range(7):box('slatted_side',side*1.8,(j-3)*.45,1.2,.1,.38,2.2)
    for i in range(7):box('rear_lath',(i-3)*.52,1.6,1.2,.45,.1,2.2)


def roman():
    component('apsidal_hall');footing(7.2,7.4,'travertine',.35)
    # Open-front basilical room and semicircular apse, rather than a cuboid.
    for side in [-1,1]:box('nave_side',side*3,0,2.2,.35,5.8,3.7,'lime',.025)
    for i in range(12):
        a,b=i*math.pi/12,(i+1)*math.pi/12
        v=[]
        for z in [.35,4.05]:
            for r,t in [(2.65,a),(3.0,a),(3.0,b),(2.65,b)]:v.append((r*math.cos(t),2.85+r*math.sin(t),z))
        mesh('apse_wall',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'lime')
    gable_roof(6.7,6.3,4.12,1.5)
    vertices=[(0,2.85,5.62)]+[(3.3*math.cos(i*math.pi/16),2.85+3.3*math.sin(i*math.pi/16),4.12) for i in range(17)]
    obj=mesh('apse_half_cone_roof',vertices,[(0,i+1,i+2) for i in range(16)],'tile')
    solid=obj.modifiers.new('Apse roof thickness','SOLIDIFY');solid.thickness=.075
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)
    for i in range(9):
        t=i*math.pi/8
        beam('apse_roof_roll',(0,2.85,5.65),(3.3*math.cos(t),2.85+3.3*math.sin(t),4.15),.045,'tile')
    for x in [-2.8,2.8]:column(x,-2.85,3.8,'travertine',.35)
    component('colonnade_bay');footing(5.4,2,'travertine',.25)
    for x in [-2.2,0,2.2]:column(x,0,3.5,'travertine',.25)
    box('architrave',0,0,3.95,5.4,.8,.4,'travertine',.025);box('cornice',0,0,4.23,5.6,1.05,.18,'travertine',.02)
    component('archive_stalls');footing(5.7,2.4,'travertine',.2);box('archive_wall',0,1,1.8,5.4,.25,3.2,'lime',.02)
    for x in [-2.5,-.85,.85,2.5]:box('shelf_upright',x,0,1.5,.12,1.5,2.7)
    for z in [.35,1,1.65,2.3,2.95]:box('shelf_board',0,0,z,5.2,1.5,.09)
    for x in [-1.68,0,1.68]:
        for z in [.65,1.3,1.95,2.6]:
            for j in range(5):cylinder('scroll_case',x+(j-2)*.24,.2,z,.08,.45,'timber',8)
    component('checkpoint_arch');arch(3.6,4.2,1.3)
    box('attic_band',0,0,4.8,5.1,1.6,.55,'lime',.025);box('attic_cornice',0,0,5.12,5.45,1.8,.16,'travertine',.025)
    component('tribunal_dais');footing(5.7,3.8,'travertine',.28)
    box('dais',0,.45,.65,5.4,2.7,.75,'travertine',.02)
    for i in range(3):box('dais_step',0,-1.65+i*.3,.15*(i+1),3.6,.33,.3*(i+1),'travertine',.015)
    box('rear_screen',0,1.6,1.55,5.4,.25,1.1,'lime',.025)
    component('monumental_stair');stairs(5.5,4,2,'travertine',8)
    for x in [-2.85,2.85]:beam('sloped_cheek',(x,-2,.45),(x,2,2.45),.35,'travertine',.45)
    component('garden_exedra')
    for i in range(13):
        a,b=i*math.pi/13,(i+1)*math.pi/13
        v=[]
        for z in [0,.75]:
            for r,t in [(2.1,a),(2.75,a),(2.75,b),(2.1,b)]:v.append((r*math.cos(t),r*math.sin(t)-1.2,z))
        mesh('curved_bench',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'travertine',.015)
    component('civic_fountain');ring('basin',2.0,1.7,.65,'travertine',sides=20)
    cylinder('fountain_stem',0,0,1.0,.32,2,'travertine',12);ring('upper_bowl',.95,.73,.26,'travertine',1.9,16)
    component('screen_wall');footing(5.6,.8,'travertine',.22);box('render_wall',0,0,1.6,5.3,.35,2.8,'lime',.02)
    for x in [-2.6,0,2.6]:box('pilaster',x,-.12,1.6,.42,.48,2.8,'travertine',.015)
    box('coping',0,0,3.1,5.7,.7,.22,'travertine',.02)
    component('vaulted_entry');arch(2.8,3.4,3.0)
    for side in [-1,1]:box('vault_cheek',side*1.75,0,1.7,.35,3.1,3.4,'lime',.02)
    component('administrative_portico');footing(6.8,3.8,'travertine',.35)
    for x in [-2.8,0,2.8]:
        for y in [-1.35,1.35]:column(x,y,3.6,'travertine',.35)
    gable_roof(7.1,4.1,4.05,1.2);box('entablature',0,-1.35,4.03,6.6,.75,.33,'travertine',.02)
    component('statue_plinth');footing(2.5,2.5,'travertine',.22)
    box('moulded_base',0,0,.42,2.05,2.05,.3,'travertine',.025);box('plinth_shaft',0,0,1.23,1.7,1.7,1.35,'lime',.025)
    box('plinth_cap',0,0,1.98,2.12,2.12,.22,'travertine',.025)


def export_kit(kit_id, family_keys, chapters):
    reports=[]
    assert len(roots)==12, (kit_id,len(roots))
    for root in roots:
        for mat in materials.values():
            chosen=[o for o in list(root.children) if o.type=='MESH' and o.data.materials[0]==mat]
            if not chosen:continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in chosen:obj.select_set(True)
            bpy.context.view_layer.objects.active=chosen[0];bpy.ops.object.join()
            obj=bpy.context.object;obj.name=root.name+'_'+mat.name.split()[0];obj.parent=root
            bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');obj.select_set(False)
        bpy.context.view_layer.update()
        pts=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
        lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
        # Centre the complete silhouette in plan, and sit every component on ground.
        shift=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]))
        for obj in root.children:obj.location-=shift
        lo=[lo[i]-shift[i] for i in range(3)];hi=[hi[i]-shift[i] for i in range(3)]
        tris=sum(len(p.vertices)-2 for obj in root.children for p in obj.data.polygons)
        # Blender x,y,z maps to glTF x,z,-y. Bounds below are runtime coordinates.
        runtime_lo=[lo[0],lo[2],-hi[1]];runtime_hi=[hi[0],hi[2],-lo[1]]
        reports.append({'name':root.name,'triangles':tris,'boundsBlender':{'min':lo,'max':hi},
            'bounds':{'min':runtime_lo,'max':runtime_hi},'dimensions':{'width':hi[0]-lo[0],'height':hi[2]-lo[2],'depth':hi[1]-lo[1]},
            'materials':len(root.children),'materialFamilies':[obj.data.materials[0].name for obj in root.children]})
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    path=os.path.join(PROCESSED,kit_id+'-kit.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',export_yup=True,export_animations=False,
        export_extras=True,export_image_format='AUTO',export_materials='EXPORT',export_normals=True,export_texcoords=True)
    for i,root in enumerate(roots):root.location=((i%4)*12,(i//4)*12,0)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,kit_id+'-kit.blend'))
    with open(path,'rb') as file:raw=file.read()
    report={'version':1,'id':kit_id,'generator':'scripts/assets/build-regional-kits.py','chapters':chapters,
        'authorship':'Original Blender-authored geometry and original deterministic surface bakes; no external images',
        'licence':'Created for the Imperium project; no third-party source assets','components':reports,
        'materials':[{'family':FAMILIES[k][0],'size':512,'authorship':'Original deterministic procedural bake','channels':['baseColor','roughness']} for k in family_keys],
        'output':{'path':'art-source/models/processed/'+kit_id+'-kit.glb','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':sum(r['triangles'] for r in reports)},
        'runtimePath':'assets/models/scenery/'+kit_id+'-kit.glb'}
    with open(os.path.join(PROCESSED,kit_id+'-kit.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(report['output']))
    return report


reports=[]
builders=[danube,wetlands,italian,provincial,roman]
for (kit_id,keys,chapters),build in zip(KITS,builders):
    if opts.only and opts.only!=kit_id:continue
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.meshes,bpy.data.materials,bpy.data.images]:
        for item in list(block):
            if item.users==0:block.remove(item)
    materials={};roots=[];current=None
    for key in keys:surface(key)
    build();reports.append(export_kit(kit_id,keys,chapters))
if not opts.only:
    with open(os.path.join(PROCESSED,'regional-kits.json'),'w',encoding='utf-8') as file:
        json.dump({'version':1,'generator':'scripts/assets/build-regional-kits.py','componentCount':sum(len(r['components']) for r in reports),
            'materialFamilies':sorted({m['family'] for r in reports for m in r['materials']}),'kits':reports},file,indent=2);file.write('\n')
    bounds={r['id']+'-kit':{c['name']:[math.ceil(c['dimensions'][axis]*1000)/1000 for axis in ['width','height','depth']]
        for c in r['components']} for r in reports}
    with open(os.path.join(REPO,'src','showcase','regional-kit-components.js'),'w',encoding='utf-8') as file:
        file.write('// Generated from the full authored silhouettes by scripts/assets/build-regional-kits.py.\n')
        file.write('// Metres [width, height, depth], conservatively rounded up. Roots are centred at ground zero.\n')
        file.write('export const REGIONAL_KIT_COMPONENTS = '+json.dumps(bounds,indent=2)+';\n')
        file.write('for (const kit of Object.values(REGIONAL_KIT_COMPONENTS)) {\n  for (const dimensions of Object.values(kit)) Object.freeze(dimensions);\n  Object.freeze(kit);\n}\nObject.freeze(REGIONAL_KIT_COMPONENTS);\n')
