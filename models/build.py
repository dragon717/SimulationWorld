"""Run with blender -b --python-exit-code 1 -P models/build.py."""
import math
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from forms import ROOT, material
from fauna import chital, mugger, tiger
from floodplain import channel, habitat, height, shore, width

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.frame_end = 145
scene.render.fps = 24
paint = material('Mineral pigment on paper', 'pigment.jpg', vertex=True)
water = material('River wash', 'pigment.jpg', vertex=True, roughness=.53)
coat = {key: material(key+' · painted coat', key+'.jpg') for key in ('chital','tiger','mugger','chital-leg','tiger-leg')}
out = ROOT/'assets'
previews = ROOT/'previews'
for folder in (out, previews):
    folder.mkdir(exist_ok=True)


def export(name, roots):
    bpy.ops.object.select_all(action='DESELECT')
    selected = [o for root in roots for o in [root, *root.children_recursive]]
    for ob in selected:
        ob.select_set(True)
    assert any(o.type=='MESH' for o in selected)
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')), export_format='GLB',
                              use_selection=True, export_animation_mode='SCENE', export_anim_scene_split_object=False, export_frame_range=True,
                              export_yup=True, export_extras=True,
                              export_vertex_color='ACTIVE', export_unused_images=False, export_image_format='AUTO')
    assert (out/(name+'.glb')).stat().st_size > 10000


def camera(pos, target, span):
    cam.location=Vector(pos)
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=span


def photograph(filename, resolution):
    scene.render.resolution_x,scene.render.resolution_y=resolution
    scene.render.filepath=str(previews/(filename+'.jpg'))
    bpy.ops.render.render(write_still=True)


scene.render.engine='CYCLES'
scene.cycles.samples=10
scene.cycles.use_denoising=True
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=90
scene.world=bpy.data.worlds.new('Warm daylight')
scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value=(.84,.90,.92,1)
bg.inputs['Strength'].default_value=.57
scene.view_settings.view_transform='AgX'
bpy.ops.object.light_add(type='SUN',location=(-6,-5,10))
sun=bpy.context.object
sun.name='Low warm sun'
sun.rotation_euler=Vector((.47,.64,-.88)).to_track_quat('-Z','Y').to_euler()
sun.data.energy=3.0
sun.data.color=(1,.91,.76)
sun.data.angle=math.radians(14)
bpy.ops.object.camera_add()
cam=bpy.context.object
cam.name='Field plate'
cam.data.type='ORTHO'
scene.camera=cam
bpy.ops.mesh.primitive_plane_add(size=200)
stage=bpy.context.object
stage.name='Studio backdrop · preview only'
paper=bpy.data.materials.new('Warm studio paper')
paper.use_nodes=True
paper.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.88,.817,.665,1)
stage.data.materials.append(paper)

stag=chital('Chital stag',paint,coat['chital'],coat['chital-leg'])
cat=tiger(paint,coat['tiger'],coat['tiger-leg'])
croc=mugger(paint,coat['mugger'])
doe=chital('Chital doe',paint,coat['chital'],coat['chital-leg'],antlers=False)
animals=[stag,cat,croc,doe]
for animal in animals:
    animal['habitat']='Chitwan-inspired Rapti floodplain'
    for obj in animal.children_recursive:
        if obj.type=='MESH':
            obj.hide_render=True
scene.frame_set(1)
for name,animal,scientific,span,target,eye in [
    ('chital',stag,'Axis axis',3.70,(.02,0,1.08),(2.35,-5.3,2.15)),
    ('tiger',cat,'Panthera tigris tigris',3.92,(-.16,0,.72),(2.05,-5.0,2.00)),
    ('mugger',croc,'Crocodylus palustris',4.60,(-.36,0,.26),(1.65,-5.7,3.47))]:
    animal['scientificName']=scientific
    meshes=[o for o in animal.children_recursive if o.type=='MESH']
    for ob in meshes:
        ob.hide_render=False
    export(name,[animal])
    camera(eye,target,span)
    photograph(name,(1050,710))
    for ob in meshes:
        ob.hide_render=True

doe['scientificName']='Axis axis'
locations=[(stag,-3.19,.92,-.18,1),(doe,-5.16,.13,.17,.93),(cat,3.25,3.89,3.48,1),
           (croc,1.12,channel(1.12)-width(1.12)+.48,.48,1)]
for animal,x,y,az,scale in locations:
    e=.04
    dx=(height(x+e,y)-height(x-e,y))/(2*e)
    dy=(height(x,y+e)-height(x,y-e))/(2*e)
    normal=Vector((-dx,-dy,1)).normalized()
    if animal is croc:
        # The mugger floats level with its eyes, nostrils and back breaking the shallow water.
        normal=Vector((0,0,1))
        animal.location=(x,y,-.233)
    else:
        animal.location=(x,y,height(x,y))
    # First follow the shore tangent plane; turn within the plane about local Z.
    align=Vector((0,0,1)).rotation_difference(normal)
    animal.rotation_euler=(align @ Quaternion((0,0,1),az)).to_euler()
    animal.scale=(scale,)*3
    for ob in animal.children_recursive:
        ob.hide_render=False
terrain=habitat(paint,water,[(x,y,1.10 if a==croc else .74) for a,x,y,ang,s in locations])
assert all((shore(x,y)<0) == (animal is croc) for animal,x,y,_,_ in locations)
export('rapti-floodplain',[terrain,*animals])
stage.location.z=-1.315
camera((5.3,-20.5,13.1),(0,.2,1.68),23.75)
scene.render.resolution_x,scene.render.resolution_y=1600,1024
scene.render.filepath='//../previews/rapti-floodplain.jpg'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'rapti-floodplain.blend'),compress=True)
photograph('rapti-floodplain',(1600,1024))
