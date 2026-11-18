"""Check that each distributed GLB is self-contained and has the intended animated anatomy."""
import json
from pathlib import Path
import struct

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
ANIMALS = {
    'chital': ('Axis axis', {'Chital neck'}),
    'tiger': ('Panthera tigris tigris', {'Tiger head', 'Tiger tail'}),
    'mugger': ('Crocodylus palustris', {'Mugger jaw', 'Mugger tail'}),
}


def inspect(name):
    data = (ASSETS / (name + '.glb')).read_bytes()
    magic, version, total, length, kind = struct.unpack_from('<4sIIII', data)
    assert (magic, version, total, kind) == (b'glTF', 2, len(data), 0x4e4f534a), name
    model = json.loads(data[20:20+length])
    binary_size, binary_tag = struct.unpack_from('<II', data, 20 + length)
    assert binary_tag == 0x004e4942 and binary_size == len(data)-28-length
    assert model['meshes'] and model['images'] and all('bufferView' in im for im in model['images'])
    assert all('uri' not in buf for buf in model['buffers'])
    clip, = model['animations']
    nodes = model['nodes']
    moving = {nodes[c['target']['node']]['name'] for c in clip['channels'] if c['target']['path']=='rotation'}
    animals = [n['extras']['scientificName'] for n in nodes if 'scientificName' in n.get('extras', {})]
    return nodes, moving, sorted(animals)


if __name__ == '__main__':
    for key, (species, expected) in ANIMALS.items():
        _, moving, animals = inspect(key)
        assert moving == expected and animals == [species], (key, moving, animals)
    nodes, moving, animals = inspect('rapti-floodplain')
    assert animals == sorted([s for s, _ in ANIMALS.values()] + ['Axis axis'])
    assert {'Floodplain ground and riverbed', 'Jade channel'} <= {n['name'] for n in nodes}
    assert len(moving) == 6 and set.union(*(j for _,j in ANIMALS.values())) <= moving
    print('通过：四份 GLB 均内嵌贴图，三种动物和全景的循环动作齐全。')
