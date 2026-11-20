"""Bake tapered guard hairs onto the authored pelt surfaces, in their animated parent space."""
from array import array
import random

import bpy
from mathutils import Vector


def groom(root, material):
    tiger = root.name.startswith('Bengal')
    rng = random.Random(541 if tiger else 937)
    images = {}
    # Blender exposes packed JPEG bytes as sRGB, while vertex pigments are scene-linear.
    srgb = [c/3294.6 if c < 11 else ((c/255+.055)/1.055)**2.4 for c in range(256)]
    total = 0
    for part in list(root.children_recursive):
        if part.type != 'MESH':
            continue
        mesh = part.data
        name = part.name
        continuous = name.startswith('Continuous pelt')
        joints = mesh.attributes.get('_part')
        paw = name.startswith('Paws')
        leg = paw or name.startswith(('Spotted shoulders', 'Striped shoulders'))
        ear = name.startswith('Furred ears')
        jaw = name.startswith('Furred jaw')
        head = ear or jaw or name.startswith(('Neck,', 'Masked face', 'Furred eye rims'))
        tail = name.startswith('Ringed tail')
        if not (continuous or leg or head or tail or name.startswith(('Dappled flank', 'Striped torso'))):
            continue
        mat = mesh.materials[0]
        image = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
        painted = image.name != 'pigment.jpg'
        if painted and image.name not in images:
            buf = array('f', [0]) * len(image.pixels)
            image.pixels.foreach_get(buf)
            images[image.name] = buf
        mesh.calc_loop_triangles()
        uv = mesh.uv_layers.active.data
        pigments = mesh.color_attributes['Pigment'].data
        verts, faces, colors, normals, hair_weights = [], [], [], [], []
        for tri in mesh.loop_triangles:
            a, b, c = (mesh.vertices[k] for k in tri.vertices)
            if paw and tri.normal.z < -.35:
                continue
            if continuous and tri.normal.z < -.45 and max(a.co.z,b.co.z,c.co.z)<.08:
                continue
            count = int(tri.area * (2800 if head else 1950 if leg else 2200) + rng.random())
            for _ in range(count):
                u, v = rng.random(), rng.random()
                if u + v > 1:
                    u, v = 1-u, 1-v
                w = 1-u-v
                p = w*a.co + u*b.co + v*c.co
                n = (w*a.normal + u*b.normal + v*c.normal).normalized()
                flow = Vector((-.25 if leg else -1, rng.uniform(-.18, .18), -1 if leg or head else -.34))
                length = rng.uniform(.014, .033)
                if paw:
                    flow.x, flow.z = 1, -.28
                    length *= .45
                elif ear:
                    flow.y += .8 if p.y > 0 else -.8
                    flow.z = .95
                    length *= .42
                elif jaw:
                    length *= .43
                elif head:
                    cheek = max(0, min(1, (.33-p.x)/.15))
                    length *= .24 + 1.35*cheek
                elif leg:
                    length *= .50 + .42*min(1, max(0,p.z))
                if continuous:
                    weight = sum(t*joints.data[k].value for t,k in zip((w,u,v),tri.vertices))
                    leg_flow, neck_flow = max(0.,weight), max(0.,-weight)
                    flow.x += .75*leg_flow
                    flow.z -= .66*(leg_flow+neck_flow)
                    length *= 1 - .42*leg_flow
                    if tiger and p.z < .14:
                        paw_flow = min(1.,(.14-p.z)/.07)
                        flow.x += 1.3*paw_flow
                        length *= 1-.35*paw_flow
                    front = max(0., min(1., (p.x-(.82 if tiger else .68))/.25))
                    length *= 1 + neck_flow*(.25-1.02*front)
                    hair_weights.extend((weight,)*3)
                tangent = (flow - n * flow.dot(n)).normalized()
                side = n.cross(tangent) * min(length*.085, rng.uniform(.0009, .0023))
                tip = p + length * (tangent + n*rng.uniform(.37, .72))
                start = len(verts)
                verts.extend((p-side, p+side, tip))
                faces.append((start+1, start, start+2))
                normals.extend((n,n,n))
                if painted:
                    at = sum((t * uv[k].uv for k,t in zip(tri.loops,(w,u,v))), Vector((0,0)))
                    iw, ih = image.size
                    j = 4*(int(at.y % 1 * ih)*iw + int(at.x % 1 * iw))
                    rgb = [srgb[round(255*x)] for x in images[image.name][j:j+3]]
                    if head:
                        colors_a, colors_b, colors_c = (pigments[k].color for k in tri.vertices)
                        rgb = [x*(w*colors_a[k]+u*colors_b[k]+v*colors_c[k]) for k,x in enumerate(rgb)]
                else:
                    rgb = pigments[a.index].color[:3]
                tone = rng.uniform(.83, 1.05)
                for shade in (.84, .90, 1.07):
                    colors.extend((*[min(1, x*tone*shade) for x in rgb], 1))
        if not verts:
            continue
        hair = bpy.data.meshes.new('Guard hairs')
        hair.from_pydata(verts, [], faces)
        hair.polygons.foreach_set('use_smooth', [True]*len(faces))
        hair.normals_split_custom_set_from_vertices(normals)
        hair.uv_layers.new(name='Paint')
        if continuous:
            hair.attributes.new('_part','FLOAT','POINT').data.foreach_set('value',hair_weights)
        hair.materials.append(material)
        hair.color_attributes.new(name='Pigment', type='BYTE_COLOR', domain='POINT').data.foreach_set('color', colors)
        obj = bpy.data.objects.new('Guard hairs · ' + name, hair)
        bpy.context.collection.objects.link(obj)
        obj.parent = part.parent
        obj.matrix_local = part.matrix_local
        obj['furRole'] = 7 if jaw else 2 if head else 1 if leg else 4 if tail else 0
        total += len(faces)
    assert total > 3000, (root.name, total)
