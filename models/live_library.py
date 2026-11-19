"""Blender -b assets/rapti-floodplain.blend -P models/live_library.py (exports only)."""
from array import array
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

out = Path(__file__).resolve().parents[1] / 'assets'
subjects = ['Chital stag','Chital doe','Bengal tiger','Marsh mugger','Sal · broadleaf']
pixels = {}
plain = bpy.data.materials.new('Overview pigment')
plain.use_nodes = True
tint = plain.node_tree.nodes.new('ShaderNodeVertexColor')
tint.layer_name = 'Pigment'
plain.node_tree.links.new(tint.outputs[0],next(n for n in plain.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])

def role(name):
    if name.startswith(('Neck,','Masked face','Broad snout','Broad scaled')): return 2
    if name.startswith('Lower jaw'): return 3
    if name.startswith(('Ringed tail','Scaled tail','Tapered crested')): return 4
    if name.startswith(('Spotted shoulders','Striped shoulders','Paws','Cleft hooves','Osteoderms')): return 1
    return 0

def paint(mesh):
    image = next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
    if image.name not in pixels:
        buf=array('f',[0])*len(image.pixels)
        image.pixels.foreach_get(buf)
        pixels[image.name]=buf
    buf=pixels[image.name]; w,h=image.size
    colors=mesh.color_attributes['Pigment']
    uv=mesh.uv_layers.active.data
    for loop in mesh.loops:
        u,v=uv[loop.index].uv
        offset=4*(int(v%1*h)*w+int(u%1*w))
        vertex=colors.data[loop.vertex_index]
        # Pigment.jpg is a nearly white detail map; its vertex pigments already carry the hue.
        if image.name!='pigment.jpg': vertex.color=(*buf[offset:offset+3],1)
    mesh.materials.clear()
    mesh.materials.append(plain)

for detail in (False, True):
    export=[]
    for name in subjects:
        source=bpy.data.objects[name]
        if detail and name.startswith('Sal'): continue
        root=bpy.data.objects.new('Live '+name,None)
        bpy.context.collection.objects.link(root)
        for k in source.keys(): root[k]=source[k]
        root['template']=name
        export.append(root)
        children=[]
        for src in source.children_recursive:
            if src.type!='MESH': continue
            part=src.copy();part.data=src.data.copy()
            bpy.context.collection.objects.link(part)
            transform=src.matrix_local.copy()
            parent=src.parent
            while parent!=source:
                # Animated pivots contribute their bind translation, not the captured idle pose.
                transform=Matrix.Translation(parent.location) @ transform
                parent=parent.parent
            part.parent=root;part.matrix_local=Matrix.Identity(4);part.data.transform(transform)
            mesh=part.data
            r=role(src.name)
            if not detail: paint(mesh)
            attr=mesh.attributes.new('_part','FLOAT','POINT')
            roles=[float(r)]*len(mesh.vertices)
            if r==2 and name!='Marsh mugger':
                # The lower muzzle is a separate connected shell in the original authored head.
                bm=bmesh.new();bm.from_mesh(src.data)
                target=Vector((.409,0,-.054) if name=='Bengal tiger' else (.471,0,.428))
                unseen=set(bm.verts)
                while unseen:
                    stack=[unseen.pop()];island=[]
                    while stack:
                        v=stack.pop();island.append(v)
                        for edge in v.link_edges:
                            other=edge.other_vert(v)
                            if other in unseen: unseen.remove(other);stack.append(other)
                    center=sum((v.co for v in island),Vector())/len(island)
                    if (center-target).length<.007:
                        for v in island: roles[v.index]=7.
                bm.free()
                assert 7. in roles,src.name
            attr.data.foreach_set('value',roles)
            if not detail:
                mod=part.modifiers.new('Distance silhouette','DECIMATE')
                mod.ratio=max(.035,min(1,18/max(1,len(mesh.polygons))))
                bpy.context.view_layer.objects.active=part
                bpy.ops.object.modifier_apply(modifier=mod.name)
            children.append(part)
        if name=='Bengal tiger' and detail:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6)
            tongue=bpy.context.object;tongue.name='Lapping tongue';tongue.parent=root
            for v in tongue.data.vertices:
                v.co=Vector((1.141+v.co.x*.068,.030*v.co.y,.935+v.co.z*.016))
            tongue.data.materials.append(plain)
            col=tongue.data.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='POINT')
            for c in col.data: c.color=(.49,.14,.15,1)
            attr=tongue.data.attributes.new('_part','FLOAT','POINT')
            attr.data.foreach_set('value',[6.0]*len(tongue.data.vertices))
            children.append(tongue)
        bpy.ops.object.select_all(action='DESELECT')
        for part in children: part.select_set(True)
        bpy.context.view_layer.objects.active=children[0]
        bpy.ops.object.join()
        export.append(children[0])
    bpy.ops.object.select_all(action='DESELECT')
    for ob in export: ob.select_set(True)
    file='habitat-detail.glb' if detail else 'habitat-map.glb'
    bpy.ops.export_scene.gltf(filepath=str(out/file),use_selection=True,export_animations=False,
        export_format='GLB',export_attributes=True,export_vertex_color='ACTIVE',export_extras=True)
