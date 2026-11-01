"""Renders an item's picture for the inventory from its generated model (release 13).

One consistent look for every item: an orthographic three-quarter view on a transparent
background, a warm key light from the upper left, a cool fill and a rim light, rendered
with Cycles on the CPU. Long things (swords, spears) lie along the picture's diagonal,
hilt down at the lower left, as inventories draw them; belts are seen from above.
The model itself never ships: only the picture goes into the item atlas.

  BLENDER_PYTHON=… python render-item-pictures.py -- --input raw.glb --output item.png [--size 384] [--view upright|long|flat]
  (or Blender --background --python-exit-code 1 --python render-item-pictures.py -- …)
"""
import argparse
import math
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--size', type=int, default=384)
parser.add_argument('--view', choices=['upright', 'long', 'flat'], default='upright')
parser.add_argument('--samples', type=int, default=48)
parser.add_argument('--margin', type=float, default=1.08)
opts = parser.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=opts.input)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit(f'{opts.input}: no mesh to render')

# Gather the model under one root, centred on the origin.
root = bpy.data.objects.new('item', None)
bpy.context.scene.collection.objects.link(root)
for o in bpy.context.scene.objects:
    if o is not root and o.parent is None:
        o.parent = root
bpy.context.view_layer.update()


def world_points():
    for o in meshes:
        m = o.matrix_world
        for v in o.data.vertices:
            yield m @ v.co


def bounds():
    pts = list(world_points())
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


lo, hi = bounds()
root.location = -(lo + hi) / 2
bpy.context.view_layer.update()

lo, hi = bounds()
size = hi - lo

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = opts.samples
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = opts.size
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
# A soft grey studio: metal needs something bright to reflect, and it never shows (the film is transparent).
scene.world = bpy.data.worlds.new('studio')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes['Background']
background.inputs['Color'].default_value = (0.62, 0.60, 0.56, 1)
background.inputs['Strength'].default_value = 0.9

# The camera: front three-quarter view from a little above; flat things from above. A long thing is seen
# across its broad side, and the camera rolls so that its long axis runs from the lower left to the upper
# right with its wider end (a sword's hilt, a spear's butt) at the lower left.
camera_data = bpy.data.cameras.new('camera')
camera_data.type = 'ORTHO'
camera = bpy.data.objects.new('camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
distance = 10 * max(size)


def aim(azimuth, elevation, roll=0.0):
    direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    camera.location = direction * distance
    look = (-direction).to_track_quat('-Z', 'Y')
    camera.rotation_euler = (look @ Matrix.Rotation(roll, 4, 'Z').to_quaternion()).to_euler()
    bpy.context.view_layer.update()


def projected():
    inverse = camera.matrix_world.inverted()
    return [(q.x, q.y) for q in (inverse @ p for p in world_points())]


if opts.view == 'flat':
    aim(math.radians(-20), math.radians(62))
elif opts.view == 'long':
    # Look across the thinnest dimension, so the blade's flat faces the camera.
    thin = min(range(3), key=lambda i: size[i])
    if thin == 2:
        aim(0.0, math.radians(80))
    elif thin == 0:
        aim(math.radians(-90 + 10), math.radians(12))
    else:
        aim(math.radians(-10), math.radians(12))
    pts = projected()
    mx = sum(x for x, _ in pts) / len(pts)
    my = sum(y for _, y in pts) / len(pts)
    sxx = sum((x - mx) ** 2 for x, _ in pts)
    syy = sum((y - my) ** 2 for _, y in pts)
    sxy = sum((x - mx) * (y - my) for x, y in pts)
    angle = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(angle), math.sin(angle)
    along = [((x - mx) * ux + (y - my) * uy, abs(-(x - mx) * uy + (y - my) * ux)) for x, y in pts]
    low, high = min(a for a, _ in along), max(a for a, _ in along)
    span = high - low
    near_low = max((w for a, w in along if a < low + span * 0.3), default=0)
    near_high = max((w for a, w in along if a > high - span * 0.3), default=0)
    # Rolling the camera by r turns the picture by -r: bring the long axis to 45 degrees, wide end low.
    roll = angle - math.radians(45)
    if near_high > near_low:
        roll += math.pi
    camera.rotation_euler = (camera.rotation_euler.to_quaternion() @ Matrix.Rotation(roll, 4, 'Z').to_quaternion()).to_euler()
    bpy.context.view_layer.update()
else:
    aim(math.radians(-28), math.radians(14))

# Fit the orthographic frame to the model as the camera sees it.
inverse = camera.matrix_world.inverted()
xs, ys = [], []
for p in world_points():
    q = inverse @ p
    xs.append(q.x)
    ys.append(q.y)
extent = max(max(xs) - min(xs), max(ys) - min(ys))
camera_data.ortho_scale = extent * opts.margin
camera_data.shift_x = -((max(xs) + min(xs)) / 2) / camera_data.ortho_scale
camera_data.shift_y = -((max(ys) + min(ys)) / 2) / camera_data.ortho_scale
camera_data.clip_end = distance * 4


def light(name, kind, energy, colour, location, size=1.0):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = colour
    if kind == 'AREA':
        data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


reach = max(size) * 3
light('key', 'SUN', 3.2, (1.0, 0.93, 0.82), Vector((-0.6, -0.8, 1.0)) * reach)
light('softbox', 'AREA', 400 * max(size) ** 2, (1.0, 0.97, 0.92), Vector((-0.5, -1.0, 0.6)) * reach, size=max(size) * 3)
light('fill', 'AREA', 120 * max(size) ** 2, (0.78, 0.86, 1.0), Vector((1.0, -0.6, 0.25)) * reach, size=max(size) * 2)
light('rim', 'SUN', 2.2, (1.0, 0.97, 0.9), Vector((0.4, 1.0, 0.7)) * reach)

scene.render.filepath = opts.output
bpy.ops.render.render(write_still=True)
print(f'{opts.input} -> {opts.output} ({opts.view}, {opts.size}px)')
