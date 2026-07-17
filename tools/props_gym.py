# props_gym.py — hand-built stylized gym set for the Sarathi Twin stage.
# Blender headless: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/props_gym.py
#
# Prop-artist approach, no AI anywhere:
#   blocking with primitives → soft chamfers everywhere (the Pixar "chunky toy"
#   read comes from generous bevels + slightly exaggerated proportions) →
#   PBR materials tuned to the app's obsidian/gold stage → three-point light
#   rig for the beauty renders → GLB export for three.js.
#
# Outputs:
#   web/public/models/gym-props.glb   (Bench, DumbbellL, DumbbellR, Mat — named nodes)
#   <scratch>/render_hero.png, render_dumbbell.png, render_bench.png
import bpy
import math
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(REPO, 'web', 'public', 'models', 'gym-props.glb')
SCRATCH = os.environ.get('PROPS_OUT', '/tmp')

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

col_props = bpy.data.collections.new('GymProps')
scene.collection.children.link(col_props)


def link(obj):
    col_props.objects.link(obj)
    return obj


def mesh_obj(name, mesh):
    o = bpy.data.objects.new(name, mesh)
    return link(o)


# ---------------------------------------------------------------- materials
def pbr(name, base, metallic=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    return m


MAT_PAD = pbr('PadLeather', (0.028, 0.033, 0.045), 0.0, 0.52)   # deep navy-charcoal leather
MAT_STEEL = pbr('FrameSteel', (0.09, 0.10, 0.12), 0.92, 0.32)   # dark satin steel
MAT_GOLD = pbr('SarathiGold', (0.83, 0.55, 0.18), 1.0, 0.24)    # brand gold accents
MAT_RUBBER = pbr('PlateRubber', (0.02, 0.02, 0.025), 0.05, 0.62)  # matte black rubber
MAT_MAT = pbr('YogaMat', (0.10, 0.32, 0.55), 0.0, 0.70)         # brand blue rubber
MAT_KNURL = pbr('KnurlSteel', (0.55, 0.56, 0.58), 0.95, 0.42)   # brighter grip steel


# ---------------------------------------------------------------- helpers
def rounded_box(name, size, bevel=0.02, mat=None, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    # primitive lands in the master collection; move it to ours
    for c in o.users_collection:
        c.objects.unlink(o)
    link(o)
    o.name = name
    # bake the size straight into the mesh (no ops, no selection dependence)
    from mathutils import Matrix
    o.data.transform(Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    b = o.modifiers.new('bevel', 'BEVEL')
    b.width = bevel
    b.segments = segments
    b.limit_method = 'ANGLE'
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, r, depth, mat=None, bevel=0.008, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    o = bpy.context.object
    for c in o.users_collection:
        c.objects.unlink(o)
    link(o)
    o.name = name
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 3
        b.limit_method = 'ANGLE'
    if mat:
        o.data.materials.append(mat)
    return o


def smooth(o, angle=52):
    for p in o.data.polygons:
        p.use_smooth = True
    if hasattr(o.data, 'set_sharp_from_angle'):       # Blender 4.1+
        o.data.set_sharp_from_angle(angle=math.radians(angle))


def join(objs, name):
    # Bake each part's modifiers (the bevels!) into real geometry first —
    # join keeps only the active object's modifier stack and drops the rest.
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in objs:
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
        ob.modifiers.clear()
        ob.data = me
    # Real selection-based join — operator context overrides fail silently in -b.
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]
    o.name = name
    # bake the pivot's transform into the mesh so later loc/rot assignments
    # move the WHOLE prop from a clean identity, world-origin pivot
    from mathutils import Matrix
    o.data.transform(o.matrix_basis)
    o.matrix_basis = Matrix.Identity(4)
    return o


# ---------------------------------------------------------------- BENCH
# Chunky adjustable bench: H-frame in dark steel, two generous pads (seat +
# inclined back), gold end-caps. Proportions pushed slightly wide = toy charm.
def build_bench():
    parts = []

    # frame: front foot, rear foot, spine
    front = rounded_box('b_footF', (0.62, 0.10, 0.07), 0.02, MAT_STEEL)
    front.location = (0, 0.52, 0.035)
    rear = rounded_box('b_footR', (0.62, 0.10, 0.07), 0.02, MAT_STEEL)
    rear.location = (0, -0.42, 0.035)
    spine = rounded_box('b_spine', (0.09, 1.06, 0.07), 0.02, MAT_STEEL)
    spine.location = (0, 0.04, 0.10)
    # angled strut runs parallel under the back pad — the pad must SIT on it
    strut = rounded_box('b_strut', (0.09, 0.09, 0.42), 0.015, MAT_STEEL)
    strut.rotation_euler = (math.radians(38), 0, 0)
    strut.location = (0, 0.09, 0.32)
    postR = rounded_box('b_postR', (0.10, 0.10, 0.32), 0.015, MAT_STEEL)
    postR.location = (0, -0.24, 0.22)
    parts += [front, rear, spine, strut, postR]

    # gold end caps on the feet
    for i, y in enumerate((0.52, -0.42)):
        for j, x in enumerate((-0.30, 0.30)):
            cap = cyl(f'b_cap{i}{j}', 0.036, 0.028, MAT_GOLD, verts=24)
            cap.rotation_euler = (0, math.pi / 2, 0)
            cap.location = (x, y, 0.035)
            parts.append(cap)

    # seat pad (flat) + back pad (inclined) — fat, rounded, inviting
    seat = rounded_box('b_seat', (0.34, 0.42, 0.10), 0.035, MAT_PAD)
    seat.location = (0, -0.24, 0.42)
    back = rounded_box('b_back', (0.34, 0.62, 0.10), 0.035, MAT_PAD)
    back.rotation_euler = (math.radians(38), 0, 0)
    back.location = (0, 0.28, 0.55)
    parts += [seat, back]

    bench = join(parts, 'Bench')
    smooth(bench)
    return bench


# ---------------------------------------------------------------- DUMBBELL
# Round rubber plates, knurled steel grip, gold ring inset on each plate face.
def build_dumbbell(name):
    parts = []
    grip = cyl(f'{name}_grip', 0.028, 0.30, MAT_KNURL)
    grip.rotation_euler = (0, math.pi / 2, 0)
    parts.append(grip)
    for side in (-1, 1):
        x0 = side * 0.115
        for k, (r, w) in enumerate(((0.085, 0.055), (0.070, 0.040))):
            p = cyl(f'{name}_p{side}{k}', r, w, MAT_RUBBER, bevel=0.012)
            p.rotation_euler = (0, math.pi / 2, 0)
            p.location = (x0 + side * k * 0.05, 0, 0)
            parts.append(p)
        ring = cyl(f'{name}_ring{side}', 0.032, 0.062, MAT_GOLD, bevel=0.004, verts=24)
        ring.rotation_euler = (0, math.pi / 2, 0)
        ring.location = (x0 + side * 0.05, 0, 0)
        parts.append(ring)
    d = join(parts, name)
    smooth(d)
    return d


# ---------------------------------------------------------------- YOGA MAT
def build_mat():
    m = rounded_box('Mat', (0.62, 1.70, 0.035), 0.017, MAT_MAT, segments=4)
    m.location = (0, 0, 0.017)
    smooth(m)
    return m


bench = build_bench()
bench.location = (0.55, -0.15, 0)
bench.rotation_euler = (0, 0, math.radians(-24))

dl = build_dumbbell('DumbbellL')
dl.location = (-0.42, 0.28, 0.085)
dl.rotation_euler = (0, 0, math.radians(18))

dr = build_dumbbell('DumbbellR')
dr.location = (-0.55, -0.05, 0.085)
dr.rotation_euler = (0, 0, math.radians(-31))

mat = build_mat()
mat.location = (-0.45, 0.1, 0)
mat.rotation_euler = (0, 0, math.radians(8))

# ---------------------------------------------------------------- stage & light
floor = rounded_box('Floor', (8, 8, 0.05), 0.01)
floor.location = (0, 0, -0.028)
floor.data.materials.append(pbr('FloorObsidian', (0.012, 0.016, 0.024), 0.6, 0.35))

def light(name, kind, energy, color, loc, rot=(0, 0, 0), size=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'AREA':
        ld.size = size
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = rot
    scene.collection.objects.link(lo)
    return lo

light('Key', 'AREA', 420, (1.0, 0.92, 0.82), (1.6, 1.8, 2.2), (math.radians(-38), math.radians(28), 0), size=2.4)
light('Rim', 'AREA', 260, (1.0, 0.72, 0.35), (-1.8, -2.0, 1.4), (math.radians(55), math.radians(-32), 0), size=1.6)
light('Fill', 'AREA', 90, (0.55, 0.68, 1.0), (-1.4, 1.6, 1.0), (math.radians(-25), math.radians(-30), 0), size=3.0)

world = bpy.data.worlds.new('W')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.008, 0.010, 0.016, 1)

# ---------------------------------------------------------------- cameras & render
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 960
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium High Contrast'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
except Exception:
    pass  # CPU fallback is fine for this scene


def shoot(name, loc, look_at):
    cd = bpy.data.cameras.new(name)
    cd.lens = 52
    cam = bpy.data.objects.new(name, cd)
    scene.collection.objects.link(cam)
    cam.location = loc
    direction = (look_at[0] - loc[0], look_at[1] - loc[1], look_at[2] - loc[2])
    rot_quat = __import__('mathutils').Vector(direction).to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(SCRATCH, f'render_{name}.png')
    bpy.ops.render.render(write_still=True)


shoot('hero', (1.9, 1.5, 1.15), (0.05, 0.0, 0.28))
shoot('dumbbell', (-0.15, 0.95, 0.55), (-0.48, 0.1, 0.09))
shoot('bench', (1.7, -1.35, 0.95), (0.5, -0.1, 0.32))

# ---------------------------------------------------------------- GLB export
# Only the props — floor, lights, cameras stay home.
for o in list(scene.collection.objects):
    if o.name not in ('Bench', 'DumbbellL', 'DumbbellR', 'Mat'):
        o.select_set(False)
for o in col_props.objects:
    o.select_set(True)
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, use_selection=True, export_apply=True)
print('EXPORTED', OUT_GLB, os.path.getsize(OUT_GLB), 'bytes')
