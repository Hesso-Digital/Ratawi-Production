"""
CPF-1 and AG-25 finishing pass (v3) for the hall scene, after the PA concept
closeups (polished steel tanks, railings, walkways, perimeter pipe runs and
warm sodium lighting).

Headless:
  blender -b --factory-startup --python scripts/blender/finish_v3.py -- <repo_root> <raw_glb_dir>
then
  node scripts/blender/post_v3.mjs <raw_glb_dir> <gltf_tools_dir>   (meshopt + validation)

It opens assets/blender/night_reveal_models_v2.blend (the baked v2 models,
unchanged), adds a dressing layer to the cpf1 and ag25 collections and
exports them again with the same contract: same file names, origin at base
centre, +Y up, scale 1, every v2 node name kept. New nodes:
  <name>_Dressing   lit PBR parts (polished steel, galvanised rails, grating),
                    with ambient occlusion baked into COLOR_0
  SodiumLights      warm lamp heads (Emit_Sodium), recoloured by the scene
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
RAW = os.path.abspath(argv[1] if len(argv) > 1 else "/tmp/ratawi_v3_raw")
os.makedirs(RAW, exist_ok=True)
BLEND = os.path.join(ROOT, "assets", "blender", "night_reveal_models_v2.blend")
PREV = os.path.join(ROOT, "assets", "blender", "previews", "v3")
os.makedirs(PREV, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


# ------------------------------------------------------------------ materials
def pbr(name, hexcol, metal, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    # Multiply base colour by the baked AO colour attribute (exported as COLOR_0).
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "AO"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = (*srgb(hexcol), 1)
    nt.links.new(attr.outputs["Color"], mix.inputs[7])
    return m


def emit(name, hexcol, strength):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Emission Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


MATS = {
    "steel": pbr("Steel_Polished", "#d9dde2", 1.0, 0.24),
    "steel_dark": pbr("Steel_Dark", "#5d636b", 1.0, 0.32),
    "galv": pbr("Galvanised", "#a9afb5", 1.0, 0.38),
    "grating": pbr("Grating", "#4a4f55", 0.9, 0.55),
    "rail": pbr("Rail_Yellow", "#d9a21b", 0.2, 0.42),
}
SODIUM = emit("Emit_Sodium", "#ffae42", 5.0)


# ------------------------------------------------------------------ kit
class Kit:
    """Accumulates bmesh parts per material, then builds one mesh per group."""

    def __init__(self):
        self.bms = {}

    def bm(self, key):
        if key not in self.bms:
            self.bms[key] = bmesh.new()
        return self.bms[key]

    def cyl(self, r, h, loc, key="steel", segs=24, r2=None, cap=True):
        """Vertical cylinder, base at loc.z."""
        bm = self.bm(key)
        M = Matrix.Translation(Vector(loc) + Vector((0, 0, h / 2)))
        bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r,
                              radius2=r if r2 is None else r2, depth=h, matrix=M)

    def tube(self, a, b, r, key="galv", segs=6):
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        if L < 1e-5:
            return
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        M = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.create_cone(self.bm(key), cap_ends=True, segments=segs, radius1=r, radius2=r, depth=L, matrix=M)

    def box(self, size, loc, key="grating", rotz=0.0):
        """Box with its base centre at loc."""
        sx, sy, sz = size
        M = (Matrix.Translation(Vector(loc) + Vector((0, 0, sz / 2))) @ Matrix.Rotation(rotz, 4, "Z")
             @ Matrix.Diagonal((sx, sy, sz, 1)))
        bmesh.ops.create_cube(self.bm(key), size=1.0, matrix=M)

    def sphere(self, r, loc, key="steel", segs=32, rings=16):
        bmesh.ops.create_uvsphere(self.bm(key), u_segments=segs, v_segments=rings, radius=r,
                                  matrix=Matrix.Translation(Vector(loc)))

    def ring_rail(self, x, y, z, r, posts=16, height=0.16, key="rail"):
        n = max(posts * 2, 24)
        pts = [Vector((x + math.cos(2 * math.pi * i / n) * r, y + math.sin(2 * math.pi * i / n) * r, 0)) for i in range(n + 1)]
        for hh in (height, height * 0.5):
            for i in range(n):
                self.tube(pts[i] + Vector((0, 0, z + hh)), pts[i + 1] + Vector((0, 0, z + hh)), 0.007, key, 4)
        for i in range(posts):
            a = 2 * math.pi * i / posts
            p = Vector((x + math.cos(a) * r, y + math.sin(a) * r, z))
            self.tube(p, p + Vector((0, 0, height)), 0.007, key, 4)

    def line_rail(self, a, b, z, height=0.16, step=0.45, key="rail"):
        a, b = Vector((a[0], a[1], z)), Vector((b[0], b[1], z))
        n = max(1, int((b - a).length / step))
        for hh in (height, height * 0.5):
            self.tube(a + Vector((0, 0, hh)), b + Vector((0, 0, hh)), 0.007, key, 4)
        for i in range(n + 1):
            p = a.lerp(b, i / n)
            self.tube(p, p + Vector((0, 0, height)), 0.007, key, 4)

    def walkway(self, a, b, z, w=0.26):
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        ang = math.atan2(d.y, d.x)
        mid = (a + b) / 2
        self.box((L, w, 0.025), (mid.x, mid.y, z), "grating", rotz=ang)
        n = Vector((-d.y, d.x, 0)).normalized() * (w / 2)
        for s in (1, -1):
            self.line_rail((a + n * s).to_2d(), (b + n * s).to_2d(), z + 0.025)

    def pipe_run(self, a, b, z, radii=(0.055, 0.045, 0.035), gap=0.16, sleeper=1.2):
        """Parallel polished pipes on concrete sleepers, ground level (the concept's perimeter runs)."""
        a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = (b - a)
        L = d.length
        u = d.normalized()
        n = Vector((-u.y, u.x, 0))
        for i, r in enumerate(radii):
            off = n * ((i - (len(radii) - 1) / 2) * gap)
            self.tube(a + off + Vector((0, 0, z + r)), b + off + Vector((0, 0, z + r)), r, "steel", 14)
            for t in (0.0, 1.0):  # flanges at both ends
                p = a.lerp(b, t) + off + Vector((0, 0, z + r))
                self.tube(p - u * 0.02, p + u * 0.02, r * 1.6, "steel_dark", 14)
        k = max(1, int(L / sleeper))
        for i in range(k + 1):
            p = a.lerp(b, i / k)
            self.box((0.1, gap * len(radii) + 0.1, z), (p.x, p.y, 0.15 - 0.0), "galv", rotz=math.atan2(u.y, u.x) + math.pi / 2 * 0)

    def lamp(self, x, y, h, lamps, facing=0.0):
        self.box((0.14, 0.14, 0.05), (x, y, 0.15), "galv")
        self.cyl(0.025, h, (x, y, 0.2), "galv", segs=8, r2=0.018)
        tip = Vector((x + math.cos(facing) * 0.28, y + math.sin(facing) * 0.28, 0.2 + h))
        self.tube((x, y, 0.2 + h - 0.02), tip, 0.012, "galv", 6)
        self.box((0.16, 0.09, 0.04), (tip.x, tip.y, tip.z - 0.02), "steel_dark", rotz=facing)
        lamps.box((0.13, 0.07, 0.012), (tip.x, tip.y, tip.z - 0.034), "sodium", rotz=facing)

    def build(self, name, col, parent, mats):
        out = []
        keys = [k for k in self.bms]
        bm_all = bmesh.new()
        me_mats = []
        for k in keys:
            bm = self.bms[k]
            me = bpy.data.meshes.new("tmp")
            bm.to_mesh(me)
            bm.free()
            idx = len(me_mats)
            me_mats.append(mats[k])
            for p in me.polygons:
                p.material_index = idx
            bm_all.from_mesh(me)
            bpy.data.meshes.remove(me)
        self.bms = {}
        me = bpy.data.meshes.new(name)
        bm_all.to_mesh(me)
        bm_all.free()
        for m in me_mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        try:
            me.set_sharp_from_angle(angle=math.radians(35))
        except Exception as e:  # noqa
            print("sharp:", e)
        ob = bpy.data.objects.new(name, me)
        col.objects.link(ob)
        ob.parent = parent
        return ob


def clad_tank(k, x, y, r, h, z0):
    """Polished steel shell over a v2 tank: bevelled shell, courses, cone roof, roof rail."""
    rr = r * 1.014
    zs, zt = z0 + 0.05, z0 + 0.05 + h
    k.cyl(rr, h, (x, y, zs), "steel", segs=40, cap=False)
    for f in (0.25, 0.5, 0.75):
        k.cyl(rr * 1.012, 0.022, (x, y, zs + h * f), "steel_dark", segs=40, cap=False)
    k.cyl(rr * 1.03, 0.04, (x, y, zt - 0.04), "steel_dark", segs=40)
    k.cyl(rr, 0.26, (x, y, zt), "steel", segs=40, r2=rr * 0.12)
    k.cyl(rr * 0.14, 0.05, (x, y, zt + 0.25), "steel_dark", segs=16)
    k.ring_rail(x, y, zt + 0.02, rr * 0.96, posts=18)


def clad_column(k, x, y, r, h, z0):
    k.cyl(r * 1.04, h - 0.57, (x, y, z0 + 0.57), "steel", segs=28, cap=False)
    k.cyl(r * 1.04, 0.0, (x, y, z0 + h), "steel", segs=28)
    for f in (0.45, 0.8):
        zz = z0 + h * f
        k.cyl(r * 1.9, 0.03, (x, y, zz), "grating", segs=28)
        k.ring_rail(x, y, zz + 0.03, r * 1.85, posts=12, height=0.14)


def fence(k, hw, hd, z=0.15, step=1.0, gate=None):
    pts = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd), (-hw, -hd)]
    for i in range(4):
        a, b = Vector(pts[i]), Vector(pts[i + 1])
        L = (b - a).length
        n = max(1, int(L / step))
        for j in range(n + 1):
            p = a.lerp(b, j / n)
            k.tube((p.x, p.y, z), (p.x, p.y, z + 0.42), 0.012, "galv", 5)
        for hh in (0.2, 0.4):
            k.tube((a.x, a.y, z + hh), (b.x, b.y, z + hh), 0.006, "galv", 4)


def dress_cpf1():
    col = bpy.data.collections["cpf1"]
    root = bpy.data.objects["cpf1:cpf1"]
    k, lamps = Kit(), Kit()
    tanks = [(-5.3, 3.6), (-2.8, 3.6), (-5.3, 1.1), (-2.8, 1.1)]
    for x, y in tanks:
        clad_tank(k, x, y, 1.05, 1.25, 0.15)
    zt = 0.15 + 0.05 + 1.25 + 0.1
    k.walkway((-4.2, 3.6, 0), (-3.9, 3.6, 0), zt)
    k.walkway((-4.2, 1.1, 0), (-3.9, 1.1, 0), zt)
    k.walkway((-4.05, 3.6, 0), (-4.05, 1.1, 0), zt)
    for x, y in ((-4.05, 4.4), (-4.05, 0.3)):
        k.tube((x, y, 0.15), (x, y, zt), 0.03, "galv", 8)
    for x, y, r, h in ((0.8, -1.6, 0.26, 3.4), (1.8, -1.9, 0.2, 2.6), (2.6, -1.3, 0.3, 4.2)):
        clad_column(k, x, y, r, h, 0.15)
    # Perimeter pipe runs, as in the concept closeup.
    k.pipe_run((-6.6, -5.05), (6.4, -5.05), 0.17)
    k.pipe_run((6.55, -4.9), (6.55, 4.9), 0.17)
    k.pipe_run((-1.0, 5.15), (6.4, 5.15), 0.17, radii=(0.05, 0.04))
    fence(k, 6.92, 5.42)
    for (x, y, f) in ((-6.75, 4.85, -0.8), (-1.25, 4.85, -2.3), (-6.75, -0.25, 0.8), (-1.25, -0.25, 2.3),
                      (-0.3, 3.0, 0.0), (3.3, 4.85, -1.57), (6.2, 0.9, 3.14), (-0.3, -2.9, 0.0), (3.4, -2.6, 1.57)):
        k.lamp(x, y, 1.3, lamps, facing=f)
    dressing = k.build("cpf1_Dressing", col, root, MATS)
    lights = lamps.build("SodiumLights", col, root, {"sodium": SODIUM})
    return col, dressing, lights


def dress_ag25():
    col = bpy.data.collections["ag25"]
    root = bpy.data.objects["ag25:ag25"]
    k, lamps = Kit(), Kit()
    for x in (2.6, 4.1):
        k.sphere(0.762, (x, -2.0, 1.25), "steel", segs=40, rings=20)
        k.cyl(0.775, 0.03, (x, -2.0, 1.235), "steel_dark", segs=40, cap=False)
        k.cyl(0.18, 0.05, (x, -2.0, 1.99), "steel_dark", segs=16)
    k.walkway((2.6, -2.0, 0), (4.1, -2.0, 0), 2.03, w=0.22)
    for x, y, r, h in ((-3.2, 1.6, 0.3, 4.6), (-2.2, 1.9, 0.22, 3.6)):
        clad_column(k, x, y, r, h, 0.15)
    k.cyl(0.226, 1.4, (-0.9, 2.6, 0.21), "steel", segs=24, cap=False)
    k.pipe_run((-4.6, 3.45), (4.0, 3.45), 0.17)
    k.pipe_run((-4.75, -3.3), (-4.75, 3.3), 0.17, radii=(0.05, 0.04))
    fence(k, 4.92, 3.67)
    for (x, y, f) in ((-4.6, -3.45, 0.8), (-1.2, -3.45, 1.57), (1.4, -3.45, 1.57), (4.6, -0.6, 3.14),
                      (-4.6, 3.4, -0.8), (1.4, 3.4, -1.57)):
        k.lamp(x, y, 1.15, lamps, facing=f)
    dressing = k.build("ag25_Dressing", col, root, MATS)
    lights = lamps.build("SodiumLights", col, root, {"sodium": SODIUM})
    return col, dressing, lights


def bake_ao(objs, body):
    """Ambient occlusion into a byte colour attribute 'AO' (COLOR_0 in the GLB), occluded by the baked body."""
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.bake.target = "VERTEX_COLORS"
    for ob in objs:
        me = ob.data
        if "AO" not in me.color_attributes:
            me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = me.color_attributes["AO"]
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        # Lift the floor a little: polished steel should not go black in creases.
        attr = me.color_attributes["AO"]
        for d in attr.data:
            c = d.color
            v = 0.5 + 0.5 * c[0]
            d.color = (v, v, v, 1.0)
        vals = [d.color[0] for d in attr.data]
        print(f"AO {ob.name}: min {min(vals):.2f} mean {sum(vals) / len(vals):.2f}")


def tri_count(col):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in col.objects:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


def export(col, name):
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = lc.collection is not col
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in col.objects:
        o.select_set(True)
    # The .blend keeps "<model>:<node>" object names (they are global); the GLB nodes carry the bare names.
    renamed = []
    for o in col.objects:
        if o.name.startswith(name + ":"):
            renamed.append((o, o.name))
            o.name = o.name[len(name) + 1:]
    path = os.path.join(RAW, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_tangents=False, export_image_format="WEBP",
                              export_image_quality=80, export_materials="EXPORT", export_extras=False,
                              export_cameras=False, export_lights=False, export_vertex_color="ACTIVE",
                              export_all_vertex_colors=False)
    for o, old in renamed:
        o.name = old
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = False
    return path


stats = {}
for fn, name in ((dress_cpf1, "cpf1"), (dress_ag25, "ag25")):
    col, dressing, lights = fn()
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = lc.collection is not col
    body = bpy.data.objects[f"{name}:{name}_Body"]
    # The v2 body has no AO colour attribute; give it a white one so ACTIVE export stays consistent.
    bake_ao([dressing], body)
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = False
    stats[name] = tri_count(col)
    export(col, name)
    # Object names are global in a .blend: prefix after export so the next model's lamps can be 'SodiumLights' too.
    lights.name = f"{name}:SodiumLights"
    print(f"V3 {name}: {stats[name]} tris total, dressing {len(dressing.data.polygons)} faces")

print("V3 DONE", stats)
