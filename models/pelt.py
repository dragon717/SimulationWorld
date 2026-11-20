"""Build a single deformable outer coat; keep the eyes, ears and moving jaw independent."""
import math

import bpy
import bmesh
import numpy as np
import openvdb
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

from forms import ROOT, material

def smooth(lo, hi, x):
    t = np.clip((x-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)


def source_geometry(obj, root):
    mesh = obj.data
    mesh.calc_loop_triangles()
    offset = Vector((0, 0, 0))
    parent = obj.parent
    while parent != root:
        offset += parent.location
        parent = parent.parent
    points = np.array([v.co+offset for v in mesh.vertices], dtype=np.float32)
    faces = np.array([list(t.vertices) for t in mesh.loop_triangles], dtype=np.uint32)
    return points, faces


def face_islands(faces):
    # The neck, skull, cheeks and muzzle are closed sculpting forms in one source mesh.
    parent = list(range(int(faces.max())+1))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for a, b, c in faces.tolist():
        parent[root(b)] = parent[root(c)] = root(a)
    chunks = {}
    for face in faces.tolist():
        chunks.setdefault(root(face[0]), []).append(face)
    return [np.asarray(chunk, dtype=np.uint32) for chunk in chunks.values()]


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def exterior(root, parts):
    voxel = .010
    band = .18
    geometry = {key:source_geometry(ob,root) for key,ob in parts.items()}
    points = np.concatenate([verts for verts,_ in geometry.values()])
    origin = np.floor(points.min(axis=0)/voxel).astype(int)-5
    shape = tuple(np.ceil(points.max(axis=0)/voxel).astype(int)+6-origin)
    transform = openvdb.createLinearTransform(voxel)
    def rounded_union(a, b, radius):
        if a is None:
            return b
        overlap = np.maximum(radius-np.abs(a-b), 0)
        return np.minimum(a,b)-overlap*overlap/(4*radius)
    surface = None
    for key,(verts,faces) in geometry.items():
        local = None
        for shell in face_islands(faces) if key=='head' else [faces]:
            grid = openvdb.FloatGrid.createLevelSetFromPolygons(verts, shell, transform=transform, halfWidth=band/voxel)
            distance = np.empty(shape, dtype=np.float32)
            grid.copyToArray(distance, tuple(origin))
            local = rounded_union(local, distance, .058)
        surface = rounded_union(surface, local, .038 if key=='paws' else .14)
    grid = openvdb.FloatGrid(band)
    grid.transform = transform
    grid.copyFromArray(surface, tuple(origin))
    verts,tris,quads = grid.convertToPolygons(adaptivity=.035)
    mesh = bpy.data.meshes.new('Continuous pelt')
    mesh.from_pydata(verts.tolist(), [], tris.tolist()+quads.tolist())
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('Continuous pelt',mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    select_only(obj)
    decimate = obj.modifiers.new('Retain the rounded silhouette','DECIMATE')
    decimate.ratio = min(1, 6400/len(mesh.polygons))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons))
    return obj


def projected_uv(obj, points):
    mesh = obj.data
    mesh.calc_loop_triangles()
    verts = [v.co.copy() for v in mesh.vertices]
    tris = [tuple(t.vertices) for t in mesh.loop_triangles]
    tree = BVHTree.FromPolygons(verts,tris,all_triangles=True)
    uv = mesh.uv_layers.active.data
    result = []
    for p in points:
        hit, _, i, _ = tree.find_nearest(Vector(p))
        corners = [Vector((*uv[k].uv,0)) for k in mesh.loop_triangles[i].loops]
        value = barycentric_transform(hit,*(verts[j] for j in tris[i]),*corners)
        result.append((value.x,value.y))
    return np.array(result)


def ring_uv(x, y, z, rings):
    xs, centers, widths, heights = np.array(rings).T
    u = np.interp(x,xs,np.linspace(0,1,len(xs)))
    angle = np.arctan2((z-np.interp(x,xs,centers))/np.interp(x,xs,heights),
                       np.abs(y)/np.interp(x,xs,widths))
    return np.column_stack((np.clip(u,.003,.997),.5+.98*angle/math.pi))


def bake_coat(obj, parts, rings, skull, tiger):
    mesh = obj.data
    points = np.array([v.co[:] for v in mesh.vertices])
    x,y,z = points.T
    front,rear = (.53,-.71) if tiger else (.38,-.55)
    near_leg = 1-smooth(.14,.38,np.minimum(abs(x-front),abs(x-rear)))
    leg = (1-smooth(.36,.80 if tiger else .88,z))*(1-smooth(.38,.61,z)*(1-near_leg))
    # Rings perpendicular to the neck share a bend parameter. Rigid facial details follow its tip.
    if tiger:
        neck = np.clip(.5+((x-.62)*.996+(z-.957)*.087)/.32,0,1)*smooth(.61,.81,z)
    else:
        neck = np.clip(.5+((x-.42)*.45+(z-1.035)*.893)/.28,0,1)*smooth(.19,.435,x)

    pivot = parts['head'].parent.location
    head_rings = [(cx+pivot.x,cz+pivot.z,width,height) for cx,_,cz,width,height in skull]
    head_uv = ring_uv(x,y,z,head_rings)*[.976,.964]+[.012,.018]
    if tiger:
        muzzle = smooth(.985,1.095,x)*(1-smooth(.975,1.055,z))
        muzzle_uv = np.column_stack((.70+.28*np.clip((x-.98)/.19,0,1),
                                     .02+.21*np.clip((z-.88)/.17,0,1)))
        head_paint = smooth(.43,.84,x)*smooth(.62,.83,z)
    else:
        # Along the rising neck, dorsal and ventral fur follow the sloping centreline.
        # Its longitudinal coordinate continues through the crown to the nose.
        throat = 1-smooth(1.32,1.52,z)
        head_uv[:,0] = np.clip((x-.43+.23*(z-1.04))/.61,.012,.988)
        dorsal = -.89*(x-.42)+.46*(z-1.035)
        throat_v = .5+.93*np.arctan2(dorsal,np.maximum(abs(y),.012))/math.pi
        head_uv[:,1] = head_uv[:,1]*(1-throat)+throat_v*throat
        head_paint = smooth(1.035,1.29,z)*smooth(.17,.44,x)
        muzzle = smooth(.82,.94,x)*(1-smooth(1.47,1.53,z))
        muzzle_uv = np.column_stack((.67+.29*np.clip((x-.8)/.16,0,1),
                                     .035+.22*np.clip((z-1.41)/.14,0,1)))
    leg_uv = projected_uv(parts['legs'],points)
    paw = np.zeros_like(x)
    if tiger:
        paw = 1-smooth(.06,.18,z)
        along = x-(np.where(x>0,.595,-.773)+.105*np.sign(y))
        paw_uv = np.column_stack((.48+1.6*(abs(y)-.21)+.32*along, .13+.40*z-.46*along))
        paw_uv = np.clip(paw_uv,.008,.985)

    # Unwrap the finished surface once; the overlapping source maps exist only during this bake.
    select_only(obj)
    mesh.uv_layers.new(name='Paint')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(72),island_margin=.004,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    loop_verts = np.array([loop.vertex_index for loop in mesh.loops])
    weights = mesh.color_attributes.new(name='Coat mix', type='FLOAT_COLOR', domain='POINT')
    weights.data.foreach_set('color',np.column_stack((leg,head_paint,muzzle,paw)).astype('f').ravel())
    blend = bpy.data.materials.new('Coat bake')
    blend.use_nodes = True
    mesh.materials.append(blend)
    nodes, links = blend.node_tree.nodes, blend.node_tree.links
    colors = nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Coat mix'
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(colors.outputs['Color'],channels.inputs['Color'])
    signal = None
    chest = list(rings)
    for j,extra in zip((-2,-1),(.04,.14 if tiger else .18)):
        chest[j] = (chest[j][0]+extra,*chest[j][1:])
    samples = [('body',ring_uv(x,y,z,chest)),('legs',leg_uv),('head',head_uv),('muzzle',muzzle_uv)]
    if tiger:
        samples.append(('paw',paw_uv))
    for i,(key,coords) in enumerate(samples):
        layer = mesh.uv_layers.new(name=key)
        layer.data.foreach_set('uv',coords[loop_verts].astype('f').ravel())
        sampler = nodes.new('ShaderNodeTexImage')
        source = parts[{'muzzle':'head','paw':'legs'}.get(key,key)].data.materials[0]
        sampler.image = next(n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE')
        uv = nodes.new('ShaderNodeUVMap')
        uv.uv_map = key
        links.new(uv.outputs['UV'],sampler.inputs['Vector'])
        if signal is None:
            signal = sampler.outputs['Color']
        else:
            mix = nodes.new('ShaderNodeMixRGB')
            links.new(colors.outputs['Alpha'] if key=='paw' else channels.outputs[i-1],mix.inputs[0])
            links.new(signal,mix.inputs[1])
            links.new(sampler.outputs['Color'],mix.inputs[2])
            signal = mix.outputs[0]
    emit = nodes.new('ShaderNodeEmission')
    links.new(signal,emit.inputs['Color'])
    links.new(emit.outputs[0],next(n for n in nodes if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
    species = 'tiger' if tiger else 'chital'
    name = species+'-pelt.jpg'
    target = bpy.data.images.new(species+' bake',2048,2048,alpha=False)
    dest = nodes.new('ShaderNodeTexImage')
    dest.image = target
    nodes.active = dest
    mesh.uv_layers.active = mesh.uv_layers['Paint']
    mesh.uv_layers.active.active_render = True
    bpy.ops.object.bake(type='EMIT',margin=8,margin_type='EXTEND',uv_layer='Paint')
    target.filepath_raw = str(ROOT/'textures'/name)
    target.file_format = 'JPEG'
    target.save()
    mesh.materials.clear()
    bpy.data.materials.remove(blend)
    bpy.data.images.remove(target)
    mesh.materials.append(material(species+' · continuous coat',name))
    for key,_ in samples:
        mesh.uv_layers.remove(mesh.uv_layers[key])
    mesh.color_attributes.remove(mesh.color_attributes['Coat mix'])
    white = mesh.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='POINT')
    white.data.foreach_set('color',np.ones(len(points)*4,dtype='f'))
    mesh.color_attributes.active_color_name = mesh.color_attributes.default_color_name = 'Pigment'
    # Existing 0/1 remain trunk/leg. Negative values follow the neck by that fraction.
    mesh.attributes.new('_part','FLOAT','POINT').data.foreach_set('value',(leg-neck).astype('f'))


def continuous_coat(root, rings, skull, tiger):
    parts = {}
    for part in root.children_recursive:
        for key,prefix in [('body',('Dappled flank','Striped torso')),('legs',('Spotted shoulders','Striped shoulders')),
                           ('head',('Neck,','Masked face')),('paws',('Paws',))]:
            if part.name.startswith(prefix): parts[key] = part
    name = ('Bengal' if tiger else 'Chital')+' continuous pelt'
    existing = bpy.data.meshes.get(name)
    if existing is None:
        obj = exterior(root,parts)
        bake_coat(obj,parts,rings,skull,tiger)
        obj.data.name = name
    else:
        obj = bpy.data.objects.new('Continuous pelt',existing.copy())
        bpy.context.collection.objects.link(obj)
        obj.parent = root
    for part in parts.values():
        bpy.data.objects.remove(part,do_unlink=True)


def bind_neck(root):
    """Drive the editable and standalone skins from the same animated head pivot as the ears and jaw."""
    pivot = next(c for c in root.children if c.name.startswith(('Chital neck','Tiger head')))
    armature = bpy.data.armatures.new('Pelt skin')
    rig = bpy.data.objects.new('Pelt skin',armature)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    select_only(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    spine = armature.edit_bones.new('Pelt trunk')
    spine.head,spine.tail = (0,0,0),(0,.2,0)
    neck = armature.edit_bones.new('Pelt neck')
    neck.head,neck.tail = pivot.location,pivot.location+Vector((0,.2,0))
    neck.parent = spine
    bpy.ops.object.mode_set(mode='OBJECT')
    rotation = rig.pose.bones['Pelt neck'].constraints.new('COPY_ROTATION')
    rotation.target = pivot
    rotation.target_space = rotation.owner_space = 'LOCAL'
    for part in root.children[:]:
        if part.type!='MESH' or '_part' not in part.data.attributes: continue
        # Keep the mesh under its armature so the glTF skin has an unambiguous bind space.
        part.parent = rig
        body = part.vertex_groups.new(name='Pelt trunk')
        head = part.vertex_groups.new(name='Pelt neck')
        for i,a in enumerate(part.data.attributes['_part'].data):
            weight = max(0.,-a.value)
            if weight<1: body.add([i],1-weight,'REPLACE')
            if weight>0: head.add([i],weight,'REPLACE')
        mod = part.modifiers.new('Neck articulation','ARMATURE')
        mod.object = rig
