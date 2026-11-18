"""Small mesh-building primitives. Blender Z is up, animal noses point to +X."""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def linear(hex_color):
    rgb = bytes.fromhex(hex_color)
    return tuple(v / 3294.6 if v < 11 else ((v / 255 + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, texture=None, vertex=False, roughness=.88):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    if texture:
        image = nodes.new("ShaderNodeTexImage")
        image.image = bpy.data.images.load(str(ROOT / "textures" / texture), check_existing=True)
        image.image.pack()
        output = image.outputs["Color"]
    if vertex:
        color = nodes.new("ShaderNodeVertexColor")
        color.layer_name = "Pigment"
        if texture:
            mix = nodes.new("ShaderNodeMixRGB")
            mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = 1
            links.new(output, mix.inputs[1])
            links.new(color.outputs["Color"], mix.inputs[2])
            output = mix.outputs["Color"]
        else:
            output = color.outputs["Color"]
    links.new(output, shader.inputs["Base Color"])
    return mat


def group(name, parent=None, pos=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    ob.location = pos
    ob.empty_display_size = .1
    return ob


class Form:
    def __init__(self):
        self.verts, self.faces, self.colors, self.uvs = [], [], [], []

    def point(self, p, tint, uv=None):
        self.verts.append(tuple(p))
        self.colors.append(tint)
        self.uvs.append(uv)
        return len(self.verts) - 1

    def face(self, indices):
        self.faces.append(tuple(indices))

    def finish(self, name, parent, mat, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update()
        mesh.materials.append(mat)
        col = mesh.color_attributes.new(name='Pigment', type='BYTE_COLOR', domain='POINT')
        palette = {c: (*linear(c), 1) for c in set(self.colors)}
        col.data.foreach_set('color', [v for c in self.colors for v in palette[c]])
        uv = mesh.uv_layers.new(name='Paint')
        coords = []
        for poly in mesh.polygons:
            poly.use_smooth = smooth
            axis = max(range(3), key=lambda i: abs(poly.normal[i]))
            for idx in poly.vertices:
                p = self.verts[idx]
                atlas = self.uvs[idx]
                coords.extend(atlas if atlas is not None else (p[(axis+1)%3] * .7, p[(axis+2)%3] * .7))
        uv.data.foreach_set('uv', coords)
        ob = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(ob)
        ob.parent = parent
        return ob

    def loft(self, rings, tint, sides=24):
        """Body rings (x, y, z, half width, half height), from rump toward nose."""
        start = len(self.verts)
        for i, (x, y, z, w, h) in enumerate(rings):
            for j in range(sides):
                a = math.tau*j/sides
                self.point((x, y+w*math.cos(a), z+h*math.sin(a)), tint,
                           (i/(len(rings)-1), .5+math.asin(math.sin(a))/math.pi*.98))
            if i:
                self.bridge(start+(i-1)*sides, sides)
        self.caps(start, len(rings), sides)

    def bridge(self, lo, n):
        for j in range(n):
            a, b = lo+j, lo+(j+1)%n
            self.face((a, b, b+n, a+n))

    def caps(self, start, count, n):
        self.face(reversed(range(start, start+n)))
        self.face(range(start+(count-1)*n, start+count*n))

    def tube(self, path, radii, tint, n=10):
        pts = [Vector(p) for p in path]
        start = len(self.verts)
        across = None
        for i, (p, r) in enumerate(zip(pts, radii, strict=True)):
            axis = (pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
            if across is None:
                across = axis.cross(Vector((0,1,0)) if abs(axis.y)<.85 else Vector((1,0,0))).normalized()
            else:
                across = (across-axis*across.dot(axis)).normalized()
            up = axis.cross(across)
            rw, rh = r if isinstance(r, tuple) else (r, r)
            for j in range(n):
                a = math.tau*j/n
                self.point(p + rw*math.cos(a)*across + rh*math.sin(a)*up, tint)
            if i:
                self.bridge(start+(i-1)*n, n)
        self.caps(start,len(pts),n)

    def oval(self, pos, size, tint, n=14, lat=8):
        x,y,z = pos
        sx,sy,sz = size
        # Tiny end caps keep a single closed shell without coincident pole vertices.
        self.loft([(x+sx*math.sin(a), y, z, sy*math.cos(a), sz*math.cos(a))
                   for a in [-1.56 + 3.12*i/lat for i in range(lat+1)]], tint,n)

    def leaf(self, base, length, width, bend, tint):
        p, f, w = map(Vector, (base,length,width))
        mid=p+f*.52
        pts=(p, mid+w, mid+Vector((0,0,bend)), p+f, mid-w)
        a,b,c,d,e=[self.point(v,tint) for v in pts]
        self.faces.extend([(a,c,b),(b,c,d),(c,e,d),(a,e,c)])


def sway(pivot, axis, degrees, frames=(1, 37, 73, 109, 145)):
    for frame, value in zip(frames, degrees, strict=True):
        pivot.rotation_euler[axis] = math.radians(value)
        pivot.keyframe_insert(data_path='rotation_euler', frame=frame)
    pivot.animation_data.action.name = pivot.name + " · idle"
