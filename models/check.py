"""Check that each distributed GLB is self-contained and has the intended animated anatomy."""
from collections import Counter
import json
from pathlib import Path
import struct

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
ANIMALS = {
    'chital': ('Axis axis', {'Chital neck'}),
    'tiger': ('Panthera tigris tigris', {'Tiger head', 'Tiger tail'}),
    'mugger': ('Crocodylus palustris', {'Mugger jaw', 'Mugger tail'}),
}


def read_glb(name):
    data = (ASSETS / (name + '.glb')).read_bytes()
    magic, version, total, length, kind = struct.unpack_from('<4sIIII', data)
    assert (magic, version, total, kind) == (b'glTF', 2, len(data), 0x4e4f534a), name
    model = json.loads(data[20:20+length])
    binary_size, binary_tag = struct.unpack_from('<II', data, 20 + length)
    assert binary_tag == 0x004e4942 and binary_size == len(data)-28-length
    assert model['meshes'] and all('bufferView' in im for im in model.get('images', []))
    assert all('uri' not in buf for buf in model['buffers'])
    return model, memoryview(data)[28+length:]


def inspect(name):
    model, _ = read_glb(name)
    assert model['images'], name
    clip, = model['animations']
    nodes = model['nodes']
    moving = {nodes[c['target']['node']]['name'] for c in clip['channels'] if c['target']['path']=='rotation'}
    animals = [n['extras']['scientificName'] for n in nodes if 'scientificName' in n.get('extras', {})]
    return nodes, moving, sorted(animals)


def attribute(model, binary, index, width):
    a = model['accessors'][index]
    view = model['bufferViews'][a['bufferView']]
    fmt = '<' + {5126:'f', 5125:'I', 5123:'H', 5121:'B'}[a['componentType']] * width
    start = view.get('byteOffset',0) + a.get('byteOffset',0)
    stride = view.get('byteStride', struct.calcsize(fmt))
    return [struct.unpack_from(fmt,binary,start+i*stride) for i in range(a['count'])]


def check_shell(model, binary, part, points, weights):
    # UV islands can duplicate a vertex in glTF, but must agree on its articulation.
    at = dict(zip(points,weights))
    assert all(at[p] == w for p,w in zip(points,weights))
    edges = Counter()
    neighbors = {point:set() for point in at}
    indices = [i for i, in attribute(model,binary,part['indices'],1)]
    for i in range(0,len(indices),3):
        a,b,c = (points[j] for j in indices[i:i+3])
        for u,v in ((a,b),(b,c),(c,a)):
            edges[tuple(sorted((u,v)))] += 1
            neighbors[u].add(v)
            neighbors[v].add(u)
    assert all(n == 2 for n in edges.values()), 'open or non-manifold coat'
    stack = [next(iter(neighbors))]
    seen = set(stack)
    while stack:
        new = neighbors[stack.pop()] - seen
        seen.update(new)
        stack.extend(new)
    assert len(seen) == len(at), 'disconnected torso, neck or limb'


def check_live_coats():
    model, binary = read_glb('habitat-detail')
    checked = set()
    for root in model['nodes']:
        template = root.get('extras', {}).get('template', '')
        if not template.startswith(('Chital', 'Bengal')):
            continue
        species = 'chital' if template.startswith('Chital') else 'tiger'
        child, = root['children']
        mesh = model['meshes'][model['nodes'][child]['mesh']]
        areas = set()
        for part in mesh['primitives']:
            mat = model['materials'][part['material']]
            hair = mat['name'].startswith('Guard hair')
            if hair:
                image='fur'
                color = part['attributes']['COLOR_0']
                width = {'VEC3':3,'VEC4':4}[model['accessors'][color]['type']]
                pigment = attribute(model,binary,color,width)
                assert len({tuple(c[:3]) for c in pigment[::17]}) > 20, (template,'missing root pigment')
            else:
                tex = mat['pbrMetallicRoughness'].get('baseColorTexture')
                if not tex: continue
                image = model['images'][model['textures'][tex['index']]['source']]['name']
                if image not in (species+'-head', species+'-pelt'): continue
                assert 'TEXCOORD_0' in part['attributes']
            points = attribute(model,binary,part['attributes']['POSITION'],3)
            weights = [w for w, in attribute(model,binary,part['attributes']['_PART'],1)]
            if hair or image.endswith('-pelt'):
                legs = {(x>0,z>0) for (x,y,z),w in zip(points,weights) if w>.90 and y<.44}
                assert len(legs) == 4 and min(weights) < -.98, (template,image,legs)
                assert all(any(lo < w < hi for w in weights) for lo,hi in ((-.8,-.2),(.2,.8)))
            if hair or image.endswith('-head'):
                assert {2,7} <= set(weights), (template,image)
            if image.endswith('-pelt'):
                check_shell(model,binary,part,points,weights)
            areas.add(image)
        assert areas == {'fur',species+'-head',species+'-pelt'}, (template,areas)
        checked.add(template)
    assert checked == {'Chital stag','Chital doe','Bengal tiger'}
    coarse, binary = read_glb('habitat-map')
    for root in coarse['nodes']:
        if root.get('extras',{}).get('template') not in checked: continue
        child, = root['children']
        primitive, = coarse['meshes'][coarse['nodes'][child]['mesh']]['primitives']
        values = [w for w, in attribute(coarse,binary,primitive['attributes']['_PART'],1)]
        assert min(values) < -.9 and any(-.8<w<-.2 for w in values) and any(.2<w<.8 for w in values)



if __name__ == '__main__':
    for key, (species, expected) in ANIMALS.items():
        parts, moving, animals = inspect(key)
        roles = {p['extras']['furRole'] for p in parts if 'furRole' in p.get('extras', {})}
        assert roles == ({0,2,4,7} if key == 'tiger' else {0,2,7} if key == 'chital' else set()), (key, roles)
        if key != 'mugger':
            expected = expected | {'Pelt neck','Pelt trunk'}
            model,_ = read_glb(key)
            assert model['skins'] and sum('skin' in n for n in parts)==2
        assert moving == expected and animals == [species], (key, moving, animals)
    nodes, moving, animals = inspect('rapti-floodplain')
    assert animals == sorted([s for s, _ in ANIMALS.values()] + ['Axis axis'])
    assert {'Floodplain ground and riverbed', 'Jade channel'} <= {n['name'] for n in nodes}
    assert len(moving) == 8 and set.union(*(j for _,j in ANIMALS.values())) <= moving
    check_live_coats()
    print('通过：三种动物与全景的动作齐全，雄鹿、雌鹿与虎的主皮面各自连通且闭合，腿、颈、颌与毛束均有对应的动作权重。')
