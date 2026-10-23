"""Offline neutral-light silhouette/contact sheets of the original regional kits.

Blender --background --python-exit-code 1 --python this.py -- --repo . --output review
This does not modify the source .blend files or game assets.
"""
import argparse
import math
import os
import sys
import bpy
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('--repo',required=True)
parser.add_argument('--output',required=True)
opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
os.makedirs(opts.output,exist_ok=True)
for kit in ['danube-military','river-wetlands','italian-marching','provincial-civic','roman-monumental']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(opts.repo,'art-source','models',kit+'-kit.blend'))
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.render.resolution_x=2100;scene.render.resolution_y=1700;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    shading=scene.display.shading
    shading.light='STUDIO';shading.studiolight_rotate_z=.45
    shading.color_type='MATERIAL';shading.show_shadows=True;shading.show_cavity=True
    shading.cavity_type='BOTH';shading.curvature_ridge_factor=1.3;shading.curvature_valley_factor=1.0
    shading.show_specular_highlight=True;shading.background_type='WORLD'
    scene.world.color=(.7,.72,.72)
    for root in [obj for obj in scene.objects if obj.type=='EMPTY']:
        bpy.ops.object.text_add(location=(root.location.x,root.location.y-4.7,.02))
        text=bpy.context.object;text.data.body=root.name.replace('_',' ');text.data.align_x='CENTER';text.data.size=.47
        ink=bpy.data.materials.get('Review ink') or bpy.data.materials.new('Review ink');ink.diffuse_color=(.045,.055,.06,1)
        text.data.materials.append(ink)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(18,12,-.04))
    ground=bpy.context.object
    mat=bpy.data.materials.new('Review ground');mat.diffuse_color=(.65,.68,.67,1);ground.data.materials.append(mat)
    bpy.ops.object.camera_add(location=(38,-39,49))
    camera=bpy.context.object;camera.rotation_euler=(Vector((18,11,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=56;scene.camera=camera
    scene.render.filepath=os.path.join(opts.output,kit+'-kit-sheet.png')
    bpy.ops.render.render(write_still=True)
