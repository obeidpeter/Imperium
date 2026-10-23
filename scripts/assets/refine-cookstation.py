"""Add a grounded original iron support to the generated hanging cauldron.

Preserve the exact first processed input and report, then derive a frame from
the chain's actual uppermost vertices. No generated texture is repainted and
no further Tripo call is made. Run under Blender --python-exit-code 1.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import bpy
from mathutils import Matrix, Vector

parser=argparse.ArgumentParser()
parser.add_argument('--repo',default=os.path.join(os.path.dirname(__file__),'..','..'))
opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
repo=os.path.abspath(opts.repo)
asset='legionary-cookstation'
original=os.path.join(repo,'art-source','models','raw',asset+'-processed-before-support.glb')
processed=os.path.join(repo,'art-source','models','processed',asset+'.glb')
report_path=os.path.join(repo,'art-source','models','reports',asset+'.json')
original_report=os.path.join(repo,'art-source','models','reports',asset+'-pre-refinement.json')
if not os.path.exists(original):shutil.copyfile(processed,original)
if not os.path.exists(original_report):shutil.copyfile(report_path,original_report)
with open(original_report,encoding='utf-8') as file:prior=json.load(file)
def digest(path):
    with open(path,'rb') as file:return hashlib.sha256(file.read()).hexdigest()
assert digest(original)==prior['output']['sha256'],'The original processed model must match its retained report'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=original)
original_meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
for obj in original_meshes:
    transform=obj.matrix_world.copy();obj.parent=None;obj.data.transform(transform);obj.matrix_world=Matrix.Identity(4)
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
points=[vertex.co.copy() for obj in original_meshes for vertex in obj.data.vertices]
lo=Vector([min(point[i] for point in points) for i in range(3)])
hi=Vector([max(point[i] for point in points) for i in range(3)])
chain=[point for point in points if point.z>hi.z-.045]
top=Vector((sum(point.x for point in chain)/len(chain),sum(point.y for point in chain)/len(chain),hi.z))
assert top.z>1.25 and len(chain)>1,'The suspended chain must remain identifiable after processing'
iron=bpy.data.materials.new('Original forged iron cauldron support');iron.use_nodes=True
iron.diffuse_color=(.105,.087,.065,1)
bsdf=iron.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=iron.diffuse_color;bsdf.inputs['Metallic'].default_value=.65;bsdf.inputs['Roughness'].default_value=.8
frame=[]
def box(name,position,dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position)
    obj=bpy.context.object;obj.name=name;obj.scale=dimensions;obj.data.materials.append(iron)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);frame.append(obj);return obj
def bar(name,a,b,width=.055):
    av,bv=Vector(a),Vector(b)
    obj=box(name,(av+bv)/2,(width,width,(bv-av).length))
    obj.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
    return obj
# Legs sit beyond the entire hearth width. The crossbar's lower surface
# intersects the chain top by 15 mm, so it never hangs from empty air.
left,right=lo.x-.08,hi.x+.08
beam_bottom=top.z-.015;beam_height=.065;beam_centre=beam_bottom+beam_height/2
for side,x in [('left',left),('right',right)]:
    box('support_'+side+'_upright',(x,top.y,beam_centre/2),(.065,.065,beam_centre))
    box('support_'+side+'_foot',(x,top.y,.022),(.14,.34,.044))
    direction=1 if side=='left' else -1
    bar('support_'+side+'_knee',(x,top.y,beam_centre-.25),(x+direction*.25,top.y,beam_centre))
box('support_crossbeam',((left+right)/2,top.y,beam_centre),(right-left+.10,.075,beam_height))
bpy.ops.object.select_all(action='DESELECT')
for obj in frame:obj.select_set(True)
bpy.context.view_layer.objects.active=frame[0];bpy.ops.object.join();frame_obj=bpy.context.object
frame_obj.name='original_grounded_iron_support'
all_meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
bpy.context.view_layer.update()
points=[obj.matrix_world@vertex.co for obj in all_meshes for vertex in obj.data.vertices]
lo2=Vector([min(point[i] for point in points) for i in range(3)])
hi2=Vector([max(point[i] for point in points) for i in range(3)])
scale=1.3/(hi2.z-lo2.z);centre=Vector(((lo2.x+hi2.x)/2,(lo2.y+hi2.y)/2,lo2.z))
for obj in all_meshes:
    transform=obj.matrix_world.copy();obj.data.transform(transform);obj.matrix_world=Matrix.Identity(4)
    for vertex in obj.data.vertices:vertex.co=(vertex.co-centre)*scale
triangles=sum(len(poly.vertices)-2 for obj in all_meshes for poly in obj.data.polygons)
assert triangles<=6000,triangles
support_min=min(vertex.co.z for vertex in frame_obj.data.vertices)
assert abs(support_min)<.000001,'Both feet must rest on the ground'
assert beam_bottom<=top.z<=beam_bottom+beam_height,'The chain must touch the crossbeam'
bpy.context.scene.unit_settings.system='METRIC'
bpy.ops.export_scene.gltf(filepath=processed,export_format='GLB',export_yup=True,export_animations=False,
    export_extras=True,export_image_format='AUTO',export_materials='EXPORT',export_normals=True,export_texcoords=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(repo,'art-source','models',asset+'-supported.blend'))
refinement={'tool':'scripts/assets/refine-cookstation.py','authorship':'Original local Blender iron support frame added to the generated model',
    'reason':'The generated cauldron chain had no supporting overhead structure',
    'input':{'path':os.path.relpath(original,repo).replace(os.sep,'/'),'sha256':digest(original)},
    'originalProcessingReport':os.path.relpath(original_report,repo).replace(os.sep,'/'),
    'addedTriangles':triangles-prior['output']['triangles'],'chainTopBeforeBlender':list(top),
    'beamBottomBeforeNormalization':beam_bottom,'chainOverlapsCrossbeam':True,'frameGrounded':True,
    'normalizationScale':scale,'paidCalls':0}
report={**prior,'tool':'scripts/assets/refine-cookstation.py','refinement':refinement,
    'output':{'path':os.path.relpath(processed,repo).replace(os.sep,'/'),'bytes':os.path.getsize(processed),'sha256':digest(processed),'triangles':triangles},
    'sizeMetres':{'width':round((hi2.x-lo2.x)*scale,4),'height':1.3,'depth':round((hi2.y-lo2.y)*scale,4)},'materials':2}
with open(report_path,'w',encoding='utf-8') as file:json.dump(report,file,indent=2);file.write('\n')
with open(os.path.join(repo,'art-source','models','reports',asset+'-refinement.json'),'w',encoding='utf-8') as file:json.dump(refinement,file,indent=2);file.write('\n')
print(json.dumps(report['output']))
