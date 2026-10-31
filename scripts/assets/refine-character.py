"""CPU-only Blender refinement of existing game-space meshes and vertex groups.

No image baking, material replacement, new asset generation or rig transforms.
Run: blender --background --factory-startup --python refine-character.py -- input.json output.json
The Node bridge checks the original source digest and every protected channel.
"""
import bpy, bmesh, json, math, sys
from collections import defaultdict
from mathutils import Vector


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x-a)/(b-a)))
    return t*t*(3-2*t)


def window(a, b, c, d, x):
    return smooth(a, b, x)*(1-smooth(c, d, x))


def subdivide_face(source, data):
    """Conforming edge splits: no T junctions, UV reprojection or new materials.

    Every original vertex keeps its index; new samples are exact edge midpoints.
    The bordering triangle is split whenever its neighbour splits their edge.
    """
    if source['id'] not in ('roman-recruit', 'cast-aelia') or data['mesh'] != 'body':
        return
    centre = -.0054 if source['id'] == 'cast-aelia' else -.018
    def inside(v):
        x, y, z = v
        return 1.54 < y < 1.679 and abs(x-centre) < .075 and z > .055
    selected = set()
    faces = [data['indices'][i:i+3] for i in range(0, len(data['indices']), 3)]
    data['sourceTriangles'] = len(faces)
    for face in faces:
        if all(inside(data['positions'][i]) for i in face):
            for k in range(3):
                selected.add(tuple(sorted((face[k], face[(k+1)%3]))))
    midpoints = {}
    data['subdivision'] = []
    for a, b in sorted(selected):
        midpoints[(a, b)] = len(data['positions'])
        data['subdivision'].append([a, b])
        for name in ('positions', 'normals'):
            data[name].append([(v+w)/2 for v, w in zip(data[name][a], data[name][b])])
        for rows in data['attributes'].values():
            rows.append([(v+w)/2 for v, w in zip(rows[a], rows[b])])
        weights = defaultdict(float)
        for parent in (a, b):
            for j, w in zip(data['joints'][parent], data['weights'][parent]):
                weights[j] += w*.5
        pairs = sorted(weights.items(), key=lambda p: (-p[1], p[0]))[:4]
        pairs += [(0, 0)]*(4-len(pairs))
        total = sum(w for _, w in pairs)
        data['joints'].append([j for j, _ in pairs])
        data['weights'].append([w/total for _, w in pairs])
    result = []
    for face in faces:
        a, b, c = face
        mids = [midpoints.get(tuple(sorted((face[k], face[(k+1)%3])))) for k in range(3)]
        count = sum(m is not None for m in mids)
        if count == 0:
            result += face
        elif count == 3:
            x, y, z = mids
            result += [a, x, z, x, b, y, z, y, c, x, y, z]
        else:
            # Rotate the existing winding until edge 0 is split and, when
            # two edges split, edge 1 is the second; rotation never flips it.
            while mids[0] is None or (count == 2 and mids[1] is None):
                face = face[1:]+face[:1]
                mids = mids[1:]+mids[:1]
            a, b, c = face
            x, y, z = mids
            result += [a, x, c, x, b, c] if count == 1 else [b, y, x, a, x, c, x, y, c]
    data['indices'] = result


def refine(source, data):
    subdivide_face(source, data)
    name = data['mesh']
    positions = data['positions']
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(positions, [], [data['indices'][i:i+3] for i in range(0, len(data['indices']), 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    groups = [obj.vertex_groups.new(name=n) for n in source['joints']]
    full = []
    for i, (js, ws) in enumerate(zip(data['joints'], data['weights'])):
        row = [0.0]*len(groups)
        for j, w in zip(js, ws):
            if w:
                groups[j].add([i], w, 'REPLACE')
                row[j] += w
        full.append(row)

    # UV and material splits remain split in the exported topology. Their
    # coincident positions share a neighbourhood only for fairing and weights.
    welded = defaultdict(list)
    for i, v in enumerate(positions):
        welded[tuple(round(c, 6) for c in v)].append(i)
    owner = {i: min(ids) for ids in welded.values() for i in ids}
    neighbours = defaultdict(set)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    for e in bm.edges:
        a, b = (owner[v.index] for v in e.verts)
        if a != b:
            neighbours[a].add(b)
            neighbours[b].add(a)

    aelia = source['id'] == 'cast-aelia'
    face_enabled = source['id'] in ('roman-recruit', 'cast-aelia') or (source['id'].startswith('cast-') and name.startswith('cast-head'))
    centre, eye, mouth, nose = (-.0054, 1.6197, 1.559, 1.589) if aelia else (-.018, 1.631, 1.568, 1.595)
    face_masks = []
    shoulder_masks = []
    for x, y, z in positions:
        # Fair cheeks, the temple and forehead; feature anchors retain the
        # existing eyelid/lip silhouette, nostril relief and painted identity.
        face = window(1.533, 1.55, 1.666, 1.688, y)*window(.035, .07, .21, .24, z)*(1-smooth(.065, .10, abs(x-centre)))
        eye_anchor = (1-smooth(.0025, .010, abs(y-eye)))*(1-smooth(.014, .026, abs(abs(x-centre)-.032)))
        lip_anchor = (1-smooth(.002, .010, abs(y-mouth)))*(1-smooth(.025, .045, abs(x-centre)))
        nose_anchor = (1-smooth(.010, .023, abs(x-centre)))*window(nose-.03, nose-.02, nose+.018, nose+.028, y)
        face_masks.append(face*(1-max(eye_anchor*(.45 if data.get('subdivision') else 1), lip_anchor, nose_anchor)) if face_enabled else 0)
        shoulder_masks.append(window(1.115, 1.20, 1.35, 1.435, y)*window(.125, .17, .285, .325, abs(x)))

    # Tangential identity/UV positions are fixed. A small bilateral relief
    # fairing removes isolated generated bumps without inflating the head.
    sculpt = [list(v) for v in positions]
    limit = .003 if data.get('subdivision') else .0015
    for _ in range(7 if data.get('subdivision') else 3):
        next_positions = [v[:] for v in sculpt]
        for i in range(len(positions)):
            mask = face_masks[i]
            if not mask:
                continue
            ids = neighbours[owner[i]]
            if not ids:
                continue
            weights = [(j, math.exp(-sum((positions[j][k]-positions[i][k])**2 for k in range(3))/.0003)) for j in ids]
            total = sum(w for _, w in weights)
            target = sum(sculpt[j][2]*w for j, w in weights)/total
            offset = (target-sculpt[i][2])*.30*mask
            next_positions[i][2] = max(positions[i][2]-limit, min(positions[i][2]+limit, sculpt[i][2]+offset))
        sculpt = next_positions
    # Preserve every exact X/Y coordinate and apply the sculpt in Blender.
    for i, v in enumerate(sculpt):
        bm.verts[i].co = v
    bm.normal_update()
    bm.to_mesh(mesh)
    mesh.update()

    normals = data['normals']
    for i, mask in enumerate(face_masks):
        if not mask:
            continue
        # Welded seam normals are angle-weighted across matching surface
        # normals, retaining genuine hard boundaries and isolated jewellery.
        n = Vector((0, 0, 0))
        old = Vector(normals[i]).normalized()
        for j in welded[tuple(round(c, 6) for c in positions[i])]:
            candidate = bm.verts[j].normal
            if candidate.dot(old) > .65:
                n += candidate
        if n.length:
            normals[i] = list(old.lerp(n.normalized(), mask*.8).normalized())

    skin = [w[:] for w in full]
    # Diffuse just the anatomical shoulder transition, with UV seams sharing
    # neighbours. Forearms, wrists, hands, neck and soles are exact anchors.
    for _ in range(4):
        next_skin = [w[:] for w in skin]
        for i, mask in enumerate(shoulder_masks):
            if not mask:
                continue
            ids = neighbours[owner[i]]
            if not ids:
                continue
            near = [(j, math.exp(-sum((positions[j][k]-positions[i][k])**2 for k in range(3))/.0012)) for j in ids]
            total = sum(w for _, w in near)
            for k in range(len(groups)):
                avg = sum(skin[j][k]*w for j, w in near)/total
                next_skin[i][k] = skin[i][k]+(avg-skin[i][k])*.32*mask
        skin = next_skin

    robe_vertices = 0
    if aelia:
        hips, left, right = (source['joints'].index(n) for n in ('hips', 'left-thigh', 'right-thigh'))
        lower = [source['joints'].index(n) for n in ('left-knee', 'right-knee', 'left-ankle', 'right-ankle')]
        arm = [i for i, n in enumerate(source['joints']) if any(s in n for s in ('shoulder', 'elbow', 'hand'))]
        robe_masks = [window(.125, .22, .74, .88, y)*(1-smooth(.145, .16, abs(x))) if sum(full[i][j] for j in arm) <= .01 else 0 for i, (x, y, z) in enumerate(positions)]
        for _ in range(6):
            next_skin = [w[:] for w in skin]
            for i, mask in enumerate(robe_masks):
                ids = neighbours[owner[i]]
                if not mask or not ids:
                    continue
                near = [(j, math.exp(-sum((positions[j][k]-positions[i][k])**2 for k in range(3))/.0012)) for j in ids]
                total = sum(w for _, w in near)
                for k in range(len(groups)):
                    avg = sum(skin[j][k]*w for j, w in near)/total
                    next_skin[i][k] = skin[i][k]+(avg-skin[i][k])*.4*mask
            skin = next_skin
        for i, (x, y, z) in enumerate(positions):
            mask = robe_masks[i]
            if not mask or sum(full[i][j] for j in arm) > .01:
                continue
            # Long cloth must bridge both legs near the centre. Knees/ankles
            # remain at the hem, but cannot pull the upper robe into a shin.
            transfer = sum(skin[i][j] for j in lower)*mask*.20
            for j in lower:
                skin[i][j] *= 1-mask*.20
            lateral = smooth(-.10, .10, x)
            skin[i][left] += transfer*lateral*.88
            skin[i][right] += transfer*(1-lateral)*.88
            skin[i][hips] += transfer*.12
            middle = (1-smooth(.025, .105, abs(x)))*mask*.10
            legs = skin[i][left]+skin[i][right]
            skin[i][left] = skin[i][left]*(1-middle)+legs*.5*middle
            skin[i][right] = skin[i][right]*(1-middle)+legs*.5*middle
            robe_vertices += 1

    changed_weights = 0
    for i, weights in enumerate(skin):
        if max(abs(a-b) for a, b in zip(weights, full[i])) <= 1e-12:
            continue
        pairs = sorted(enumerate(weights), key=lambda p: (-p[1], p[0]))[:4]
        total = sum(w for _, w in pairs)
        data['joints'][i] = [j for j, _ in pairs]
        data['weights'][i] = [w/total for _, w in pairs]
        for group in groups:
            group.remove([i])
        for j, w in zip(data['joints'][i], data['weights'][i]):
            if w:
                groups[j].add([i], w, 'REPLACE')
        changed_weights += 1
    data['positions'] = sculpt
    data['normals'] = normals
    data['metrics'] = {'facialVertices':sum(m>0 for m in face_masks), 'shoulderVertices':sum(m>0 for m in shoulder_masks), 'robeVertices':robe_vertices, 'weightVertices':changed_weights}
    bm.free()
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(mesh)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:]
    source = json.load(open(args[0], encoding='utf8'))
    for mesh in source['meshes']:
        refine(source, mesh)
    source['blenderVersion'] = bpy.app.version_string
    with open(args[1], 'w', encoding='utf8') as output:
        json.dump(source, output, separators=(',', ':'))
    print(json.dumps({'id':source['id'], 'meshes':[{'name':m['mesh'], **m['metrics']} for m in source['meshes']]}))
