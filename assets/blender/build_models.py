"""
Night Reveal 3D field assets for Ratawi Production (AGUP RFSU).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      --python assets/blender/build_models.py -- <repo_root>

Builds every model procedurally, exports one GLB per model to
public/models/, renders an 800x600 Eevee preview per model to
assets/blender/previews/, writes stats to assets/blender/model_stats.json
and saves the combined source as assets/blender/night_reveal_models.blend.

Conventions: Blender Z-up authoring, exported as glTF +Y up. 1 unit = 1 m
in the file, sized to match the scene's world units (src/scene/facilities/*,
src/scene/Wells.tsx) so the GLBs drop in at scale 1. Origin at base centre.
Static parts are merged per material; parts the scene animates are separate
named nodes (ValveLight, Beacon, StatusRing, InletValve_N, Flame_*, ...).
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
OUT_GLB = os.path.join(ROOT, "public", "models")
OUT_SRC = os.path.join(ROOT, "assets", "blender")
OUT_PREV = os.path.join(OUT_SRC, "previews")
for d in (OUT_GLB, OUT_SRC, OUT_PREV):
    os.makedirs(d, exist_ok=True)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def hex_rgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB -> linear
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

_MATS = {}
def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hex_rgb(color), 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*hex_rgb(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    _MATS[name] = m
    return m

# Palette mirrors src/scene/facilities/materials.ts and Wells.tsx
M = dict(
    steel=lambda: mat("Steel", "#c3c8cf", 0.75, 0.32),
    steelDark=lambda: mat("SteelDark", "#6c727b", 0.7, 0.45),
    white=lambda: mat("PaintWhite", "#dfe3e6", 0.2, 0.5),
    concrete=lambda: mat("Concrete", "#8b8780", 0.0, 0.9),
    building=lambda: mat("Cladding", "#9aa1a8", 0.3, 0.6),
    roofBlue=lambda: mat("RoofBlue", "#3d5b78", 0.4, 0.5),
    yellow=lambda: mat("PipeYellow", "#c9a443", 0.4, 0.45),
    rack=lambda: mat("RackSteel", "#7b6d55", 0.5, 0.5),
    valveRed=lambda: mat("ValveRed", "#8e1f17", 0.4, 0.45),
    sand=lambda: mat("DesertNight", "#4a4238", 0.0, 0.95),
    warmLight=lambda: mat("Emit_Warm", "#ffc98a", 0, 0.5, "#ffc98a", 3.0),
    whiteLight=lambda: mat("Emit_White", "#e8f4ff", 0, 0.5, "#e8f4ff", 3.0),
    redLight=lambda: mat("Emit_Red", "#ff3030", 0, 0.5, "#ff3030", 5.0),
    valveLight=lambda: mat("Emit_ValveLight", "#ff5a3c", 0, 0.5, "#ff5a3c", 4.0),
    oilBeacon=lambda: mat("Emit_OilBeacon", "#38d6ff", 0, 0.5, "#38d6ff", 4.0),
    agupBeacon=lambda: mat("Emit_AgupBeacon", "#ff9a2e", 0, 0.5, "#ff9a2e", 4.0),
    gold=lambda: mat("Emit_GoldRing", "#ffc247", 0, 0.5, "#ffc247", 3.0),
    flameCore=lambda: mat("Emit_FlameCore", "#ff7a1a", 0, 0.5, "#ff7a1a", 6.0, alpha=0.9),
    flameTip=lambda: mat("Emit_FlameTip", "#ffe2a0", 0, 0.5, "#ffe2a0", 8.0, alpha=0.9),
    pilot=lambda: mat("Emit_Pilot", "#ff8a3a", 0, 0.5, "#ff8a3a", 5.0),
)

# ---------------------------------------------------------------- primitives
CURRENT = []  # objects of the model being built

def _take(obj, material, node):
    obj.data.materials.clear()
    obj.data.materials.append(M[material]())
    obj["node"] = node or ""
    CURRENT.append(obj)
    return obj

def cyl(r, h, loc, segs=12, material="steel", node=None, r2=None, rot=(0, 0, 0), cap=True):
    """Cylinder with its base at loc (when unrotated)."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=h,
                                            end_fill_type="NGON" if cap else "NOTHING")
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r, radius2=r2, depth=h,
                                        end_fill_type="NGON" if cap else "NOTHING")
    o = bpy.context.active_object
    o.data.transform(Matrix.Translation((0, 0, h / 2)))
    o.rotation_euler = rot
    o.location = loc
    return _take(o, material, node)

def hcyl(r, length, loc, axis="X", segs=12, material="steel", node=None):
    """Horizontal cylinder centred at loc, along X or Y."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=length)
    o = bpy.context.active_object
    o.rotation_euler = (0, math.pi / 2, 0) if axis == "X" else (math.pi / 2, 0, 0)
    o.location = loc
    return _take(o, material, node)

def box(size, loc, material="building", node=None, base=True, rot=(0, 0, 0)):
    """Box; loc is base centre when base=True."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.data.transform(Matrix.Diagonal((*size, 1)))
    if base:
        o.data.transform(Matrix.Translation((0, 0, size[2] / 2)))
    o.rotation_euler = rot
    o.location = loc
    return _take(o, material, node)

def ball(r, loc, material="warmLight", node=None, subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return _take(bpy.context.active_object, material, node)

def dome(r, loc, material="white", node=None, segs=16, rings=4, frac=1.0):
    """Upper part of a sphere (frac=1 full hemisphere), base at loc."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings * 2, radius=r)
    o = bpy.context.active_object
    bm = bmesh.new(); bm.from_mesh(o.data)
    cut = r * (1 - frac)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut - 1e-4], context="VERTS")
    for v in bm.verts:
        v.co.z -= cut
    bm.to_mesh(o.data); bm.free()
    o.location = loc
    return _take(o, material, node)

def torus(R, r, loc, rot=(0, 0, 0), material="valveRed", node=None, seg=12, mseg=4):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=seg, minor_segments=mseg)
    o = bpy.context.active_object
    o.rotation_euler = rot
    o.location = loc
    return _take(o, material, node)

def ring_flat(r_in, r_out, loc, material="gold", node=None, segs=32):
    bpy.ops.mesh.primitive_circle_add(vertices=segs, radius=r_out, fill_type="NOTHING")
    o = bpy.context.active_object
    bm = bmesh.new(); bm.from_mesh(o.data)
    outer = list(bm.verts)
    inner = [bm.verts.new(v.co * (r_in / r_out)) for v in outer]
    n = len(outer)
    for i in range(n):
        bm.faces.new((outer[i], outer[(i + 1) % n], inner[(i + 1) % n], inner[i]))
    for e in [e for e in bm.edges if not e.link_faces]:
        bm.edges.remove(e)
    bm.to_mesh(o.data); bm.free()
    o.location = loc
    return _take(o, material, node)

def strut(a, b, r=0.02, material="steelDark", segs=6, node=None):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=d.length)
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (a + b) / 2
    return _take(o, material, node)

# ---------------------------------------------------------------- finalize
def finalize(name, smooth_angle=35):
    """Merge parts per (node or material), parent to a root empty, put in a collection."""
    bpy.context.view_layer.update()  # make matrix_world current
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    groups = {}
    for o in CURRENT:
        key = o["node"] or (name + "_" + o.data.materials[0].name)
        groups.setdefault(key, []).append(o)
    root = bpy.data.objects.new(name, None)
    root.empty_display_size = 0.5
    col.objects.link(root)
    for key, objs in groups.items():
        bm = bmesh.new()
        mats = []
        for o in objs:
            m = o.data.materials[0]
            if m not in mats:
                mats.append(m)
            tmp = bmesh.new(); tmp.from_mesh(o.data)
            bmesh.ops.transform(tmp, matrix=o.matrix_world, verts=tmp.verts)
            for f in tmp.faces:
                f.material_index = mats.index(m)
            me_tmp = bpy.data.meshes.new("tmp"); tmp.to_mesh(me_tmp); tmp.free()
            bm.from_mesh(me_tmp); bpy.data.meshes.remove(me_tmp)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(key)
        bm.to_mesh(me); bm.free()
        for m in mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        try:
            me.set_sharp_from_angle(angle=math.radians(smooth_angle))
        except Exception:
            pass
        ob = bpy.data.objects.new(key, me)
        col.objects.link(ob)
        ob.parent = root
    for o in CURRENT:
        bpy.data.objects.remove(o, do_unlink=True)
    CURRENT.clear()
    return col

# ================================================================ MODELS
def christmas_tree(beacon_mat):
    """Wellhead + christmas tree, ~1.0 m tall, matching Wells.tsx footprint."""
    cyl(0.62, 0.08, (0, 0, 0), segs=8, material="concrete")             # pad
    box((0.5, 0.5, 0.04), (0, 0, 0.08), material="steelDark")           # cellar grating
    cyl(0.13, 0.12, (0, 0, 0.12), segs=12, material="steelDark")        # casing head
    cyl(0.16, 0.03, (0, 0, 0.24), segs=12, material="steel")            # flange
    cyl(0.09, 0.22, (0, 0, 0.27), segs=10, material="steel")            # lower master
    torus(0.07, 0.012, (0, 0.13, 0.38), rot=(math.pi / 2, 0, 0))        # handwheel
    cyl(0.12, 0.03, (0, 0, 0.49), segs=12, material="steel")
    cyl(0.09, 0.18, (0, 0, 0.52), segs=10, material="valveRed")         # upper master
    box((0.2, 0.2, 0.14), (0, 0, 0.70), material="steel")               # cross
    hcyl(0.05, 0.62, (0, 0, 0.77), axis="X", segs=8, material="steel")  # wing arms
    for s in (-1, 1):
        cyl(0.07, 0.03, (s * 0.31, 0, 0.74), segs=10, material="steel")
        cyl(0.065, 0.12, (s * 0.2, 0, 0.71), segs=10, material="valveRed")   # wing valves
        torus(0.055, 0.01, (s * 0.2, 0, 0.86), material="valveRed")
    hcyl(0.04, 0.5, (0.55, 0, 0.77), axis="X", segs=8, material="steelDark")  # flowline stub
    box((0.08, 0.08, 0.77), (0.82, 0, 0), material="steelDark")         # flowline support
    cyl(0.07, 0.12, (0, 0, 0.84), segs=10, material="steel")            # swab valve
    cyl(0.1, 0.05, (0, 0, 0.96), segs=12, material="steel")             # tree cap
    ball(0.045, (0, 0, 1.06), material="valveLight", node="ValveLight") # valve status light
    cyl(0.025, 0.9, (-0.45, -0.38, 0.08), segs=6, material="steelDark") # beacon mast
    cyl(0.07, 0.09, (-0.45, -0.38, 0.98), segs=10, material=beacon_mat, node="Beacon")

def build_wellhead():
    christmas_tree("oilBeacon")
    return finalize("wellhead")

def build_wellhead_agup():
    christmas_tree("agupBeacon")
    # ESP / VSD control skid and junction box
    box((0.34, 0.22, 0.04), (0.2, 0.42, 0.08), material="concrete")
    box((0.28, 0.16, 0.36), (0.2, 0.42, 0.12), material="white")
    box((0.2, 0.01, 0.06), (0.2, 0.335, 0.36), material="warmLight", node="PanelLight", base=False)
    strut((0.2, 0.34, 0.15), (0.05, 0.08, 0.2), r=0.015, material="steelDark")  # cable tray
    ring_flat(0.72, 0.82, (0, 0, 0.09), material="gold", node="StatusRing", segs=32)
    return finalize("wellhead_agup")

def tank(x, y, r=1.05, h=1.25):
    cyl(r, h, (x, y, 0.15), segs=20, material="white")
    dome(r, (x, y, 0.15 + h), material="white", segs=20, rings=3, frac=0.3)
    cyl(r * 1.04, 0.04, (x, y, 0.15 + h * 0.98), segs=20, material="steelDark", cap=False)  # wind girder
    # stair: inclined strip + rail
    a = math.radians(-30)
    strut((x + r * math.cos(a), y + r * math.sin(a), 0.15), (x + r * 1.02, y + r * 0.4, 0.15 + h), r=0.03, material="yellow", segs=4)
    ball(0.035, (x + r * 1.03, y, 0.17 + h), material="warmLight", node="TankLights", subdiv=1)

def light_mast(x, y, h, material="whiteLight", node="MastLights"):
    cyl(0.03, h, (x, y, 0.15), segs=6, material="steelDark")
    box((0.18, 0.06, 0.05), (x, y, 0.15 + h), material="steelDark")
    ball(0.045, (x, y, 0.15 + h + 0.08), material=material, node=node)

def flare_parts(x, y, h, s=1.0, base=0.0, prefix=""):
    cyl(0.09 * s, h, (x, y, base), r2=0.06 * s, segs=10, material="steelDark")
    cyl(0.11 * s, 0.25 * s, (x, y, base + h), r2=0.09 * s, segs=10, material="steel")  # tip
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.4
        ax, ay = x + math.cos(a) * h * 0.45, y + math.sin(a) * h * 0.45
        strut((x, y, base + h * 0.75), (ax, ay, base), r=0.008 * s + 0.004, segs=4)
        box((0.15 * s, 0.15 * s, 0.08 * s), (ax, ay, base), material="concrete")
    top = base + h + 0.25 * s
    cyl(0.28 * s, 1.3 * s, (x, y, top), r2=0.02 * s, segs=14, material="flameCore", node=prefix + "Flame_Core", cap=False)
    cyl(0.12 * s, 0.7 * s, (x, y, top), r2=0.01 * s, segs=10, material="flameTip", node=prefix + "Flame_Tip", cap=False)
    ball(0.03 * s, (x + 0.12 * s, y, top), material="pilot", node=prefix + "Pilot")
    ball(0.04 * s, (x, y, base + h * 0.55), material="redLight", node="AviationLights")

def pipe_rack_bay(x0, y, length, z, pipes=(("steel", 0.06), ("yellow", 0.05), ("steel", 0.045)), axis="X", width=0.7):
    """Simple rack: portal frames at both ends, pipes on top, along X from x0."""
    for xx in (x0, x0 + length):
        for s in (-1, 1):
            if axis == "X":
                box((0.08, 0.08, z), (xx, y + s * width / 2, 0), material="rack")
            else:
                box((0.08, 0.08, z), (y + s * width / 2, xx, 0), material="rack")
        if axis == "X":
            box((0.08, width + 0.08, 0.08), (xx, y, z), material="rack")
        else:
            box((width + 0.08, 0.08, 0.08), (y, xx, z), material="rack")
    for s in (-1, 1):
        if axis == "X":
            box((length, 0.06, 0.06), (x0 + length / 2, y + s * width / 2, z), material="rack")
        else:
            box((0.06, length, 0.06), (y + s * width / 2, x0 + length / 2, z), material="rack")
    n = len(pipes)
    for i, (m, r) in enumerate(pipes):
        off = (i - (n - 1) / 2) * (width * 0.8 / max(1, n - 1))
        if axis == "X":
            hcyl(r, length, (x0 + length / 2, y + off, z + 0.08 + r), axis="X", segs=10, material=m)
        else:
            hcyl(r, length, (y + off, x0 + length / 2, z + 0.08 + r), axis="Y", segs=10, material=m)

def build_cpf1():
    # Layout follows src/scene/facilities/CPF1.tsx (x,z there -> x,-y here)
    box((14, 11, 0.15), (0, 0, 0), material="concrete")
    for x, z in ((-5.3, -3.6), (-2.8, -3.6), (-5.3, -1.1), (-2.8, -1.1)):
        tank(x, -z)
    box((5.2, 5.2, 0.25), (-4.05, 2.35, 0.15), material="concrete")   # bund wall slab
    for i, z in enumerate((1.6, 2.6, 3.6)):
        y = -z
        hcyl(0.32, 2.6, (-3.6, y, 0.65), axis="X", segs=14, material="steel")  # separators
        for xx in (-4.6, -2.6):
            box((0.12, 0.5, 0.35), (xx, y, 0.15), material="steelDark")         # saddles
        cyl(0.05, 0.5, (-5.4, y, 0.15), segs=8, material="steelDark")
        ball(0.2, (-5.4, y, 1.15 - 0.0), material="valveLight", node=f"InletValve_{i + 1}")
    for x, z, w, h, d in ((0.3, -3.5, 1.6, 0.9, 1.2), (2.2, -3.5, 1.6, 1.1, 1.2),
                          (0.3, -1.6, 1.6, 0.8, 1.2), (2.2, -1.6, 1.6, 1.3, 1.2), (4.4, -2.6, 1.8, 1.6, 2.6)):
        y = -z
        box((w, d, h), (x, y, 0.15), material="building")
        box((w * 1.02, d * 1.02, 0.06), (x, y, 0.15 + h), material="roofBlue")
        for f in (-0.3, 0, 0.3):
            box((w * 0.18, 0.01, h * 0.22), (x + f * w, y - d / 2 - 0.006, 0.15 + h * 0.55), material="warmLight", node="WindowLights")
    for x, z, r, h in ((0.8, 1.6, 0.26, 3.4), (1.8, 1.9, 0.2, 2.6), (2.6, 1.3, 0.3, 4.2)):
        y = -z
        cyl(r * 1.25, 0.2, (x, y, 0.15), segs=12, material="concrete")
        cyl(r, h, (x, y, 0.15), segs=14, material="steel")
        dome(r, (x, y, 0.15 + h), material="steel", segs=14, rings=2)
        for k in range(1, int(h // 1.1) + 1):
            cyl(r + 0.05, 0.04, (x, y, 0.15 + k * 1.1), segs=14, material="yellow", cap=False)  # platforms
        ball(0.05, (x, y, 0.15 + h + r + 0.05), material="redLight", node="AviationLights")
    cyl(0.16, 3.6, (4.6, -1.2, 0.15), segs=10, material="steelDark")   # heater stacks
    cyl(0.12, 3.1, (5.1, -1.6, 0.15), segs=10, material="steelDark")
    box((1.2, 0.9, 0.7), (4.85, -1.4, 0.15), material="building")      # fired heater box
    box((2.4, 1.4, 0.7), (4.5, -4.1, 0.15), material="white")          # control building
    box((2.46, 1.46, 0.06), (4.5, -4.1, 0.85), material="roofBlue")
    for f in (-0.3, 0, 0.3):
        box((0.35, 0.01, 0.16), (4.5 + f * 2.4, -4.1 + 0.705, 0.15 + 0.38), material="warmLight", node="WindowLights")
    box((1.6, 1.0, 0.5), (1.8, -4.3, 0.15), material="building")       # MCC / substation
    # Pipe racks: main E-W spine and a N-S branch to the tank farm
    pipe_rack_bay(-1.6, 0.4, 7.2, 0.95, axis="X")
    pipe_rack_bay(-0.6, -1.4, 3.6, 0.95, axis="Y", width=0.6,
                  pipes=(("steel", 0.05), ("yellow", 0.04)))
    for x, z in ((-6.6, -5.2), (6.6, -5.2), (-6.6, 5.2), (6.6, 5.2)):
        light_mast(x, -z, 2.2)
    flare_parts(-6.4, -4.6, 5.6, s=1.0, base=0.15)
    return finalize("cpf1")

def build_ag25():
    # Layout follows src/scene/facilities/AG25.tsx
    box((10, 7.5, 0.15), (0, 0, 0), material="concrete")
    for x in (-2.6, -0.2):                                              # compressor sheds
        y = -1.6
        box((2.0, 2.6, 1.0), (x, y, 0.15), material="building")
        # pitched roof
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.0, radius2=0, depth=0.35)
        o = bpy.context.active_object
        o.rotation_euler = (0, 0, math.pi / 4)
        o.scale = (1.5, 1.9, 1)  # stretched pyramid ~ hip roof
        o.location = (x, y, 1.15 + 0.175)
        _take(o, "roofBlue", None)
        box((0.8, 0.02, 0.7), (x, y - 1.31, 0.15), material="steelDark")   # roller door
        box((1.4, 0.01, 0.12), (x, y - 1.31, 0.95), material="warmLight", node="GasLights")
        for k in (-0.6, 0.6):
            cyl(0.12, 0.5, (x + k, y + 0.6, 1.25), segs=8, material="steelDark")   # exhaust
    for x in (2.6, 4.1):                                                # spheres
        y = -2.0
        for a in range(4):
            ang = a * math.pi / 2 + math.pi / 4
            box((0.06, 0.06, 0.9), (x + math.cos(ang) * 0.5, y + math.sin(ang) * 0.5, 0.15), material="steelDark")
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.75, location=(x, y, 1.25))
        _take(bpy.context.active_object, "white", None)
        ball(0.045, (x, y, 2.03), material="warmLight", node="GasLights")
    for x, y, r, h in ((-3.2, 1.6, 0.3, 4.6), (-2.2, 1.9, 0.22, 3.6)):  # contactor / dehydration
        cyl(r, h, (x, y, 0.15), segs=14, material="steel")
        dome(r, (x, y, 0.15 + h), material="steel", segs=14, rings=2)
        for k in range(1, int(h // 1.2) + 1):
            cyl(r + 0.05, 0.04, (x, y, 0.15 + k * 1.2), segs=14, material="yellow", cap=False)
        ball(0.05, (x, y, 0.15 + h + r + 0.05), material="redLight", node="AviationLights")
    for i in range(6):                                                  # fin-fan coolers
        x, y = 0.5 + (i % 3) * 1.15, -(-2.2 + (i // 3) * 1.15)
        box((1.05, 1.05, 0.55), (x, y, 0.15), material="steelDark")
        cyl(0.4, 0.04, (x, y, 0.7), segs=12, material="steel")         # fan shroud
    pipe_rack_bay(-4.4, 0.2, 8.4, 0.85, axis="X",
                  pipes=(("yellow", 0.06), ("steel", 0.05), ("yellow", 0.04)))
    for x, z in ((-4.7, -3.4), (4.7, -3.4), (-4.7, 3.4), (4.7, 3.4)):
        light_mast(x, -z, 2.0, node="MastLights")
    flare_parts(4.4, 3.0, 4.2, s=0.7, base=0.15)
    return finalize("ag25")

def build_pipeline_segment():
    L = 4.0
    hcyl(0.06, L, (0, 0, 0.32), axis="X", segs=10, material="steel")
    for x in (-L / 2 + 0.02, L / 2 - 0.02):
        hcyl(0.09, 0.04, (x, 0, 0.32), axis="X", segs=10, material="steelDark")   # flanges
    for x in (-1.0, 1.0):                                               # sleepers + shoes
        box((0.16, 0.5, 0.12), (x, 0, 0), material="concrete")
        box((0.06, 0.06, 0.14), (x, 0, 0.12), material="steelDark")
        box((0.14, 0.16, 0.03), (x, 0, 0.24), material="steelDark")
    return finalize("pipeline_segment")

def build_pipe_rack():
    pipe_rack_bay(-2.0, 0.0, 4.0, 1.0, axis="X", width=0.9,
                  pipes=(("steel", 0.07), ("yellow", 0.06), ("steel", 0.05), ("steelDark", 0.04)))
    for x in (-2.0, 2.0):
        for s in (-1, 1):
            box((0.24, 0.24, 0.06), (x, s * 0.45, 0), material="concrete")   # footings
            strut((x, s * 0.45, 0.6), (x + (0.5 if x < 0 else -0.5), s * 0.45, 1.0), r=0.02, material="rack", segs=4)
    return finalize("pipe_rack")

def build_export_marker():
    box((0.5, 0.5, 0.12), (0, 0, 0), material="concrete")
    cyl(0.05, 1.7, (0, 0, 0.12), segs=8, material="yellow")
    box((0.5, 0.04, 0.32), (0, 0, 1.2), material="white")               # sign plate
    box((0.5, 0.042, 0.08), (0, 0, 1.44), material="valveRed")          # red band
    cyl(0.07, 0.03, (0, 0, 1.82), segs=10, material="steelDark")
    cyl(0.06, 0.14, (0, 0, 1.85), segs=10, material="redLight", node="Beacon")
    # buried line test station + pig signaller stub beside the post
    cyl(0.06, 0.4, (0.45, 0.15, 0), segs=8, material="yellow")
    cyl(0.08, 0.05, (0.45, 0.15, 0.4), segs=8, material="steelDark")
    return finalize("export_marker")

def build_flare():
    box((1.2, 1.2, 0.1), (0, 0, 0), material="concrete")
    flare_parts(0, 0, 5.6, s=1.0, base=0.1)
    # knockout drum and inlet header
    hcyl(0.3, 1.6, (-1.3, 0.9, 0.45), axis="X", segs=14, material="steel")
    for xx in (-1.9, -0.7):
        box((0.12, 0.45, 0.2), (xx, 0.9, 0.0), material="concrete")
    strut((-0.5, 0.9, 0.45), (0, 0, 0.4), r=0.05, material="yellow", segs=8)
    return finalize("flare")

def build_terrain_tile():
    S, N = 40.0, 24
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=N, y_subdivisions=N, size=S)
    o = bpy.context.active_object
    for v in o.data.vertices:
        x, y = v.co.x, v.co.y
        u, w = 2 * math.pi * x / S, 2 * math.pi * y / S          # periodic => tileable
        h = (0.35 * math.sin(u) * math.cos(w) + 0.18 * math.sin(2 * u + 1.3) * math.sin(3 * w + 0.4)
             + 0.08 * math.cos(5 * u + 2 * w))
        v.co.z = 0.6 + h
    _take(o, "sand", None)
    o = finalize("terrain_tile", smooth_angle=80)
    return o

BUILDERS = [
    ("wellhead", build_wellhead),
    ("wellhead_agup", build_wellhead_agup),
    ("cpf1", build_cpf1),
    ("ag25", build_ag25),
    ("pipeline_segment", build_pipeline_segment),
    ("pipe_rack", build_pipe_rack),
    ("export_marker", build_export_marker),
    ("flare", build_flare),
    ("terrain_tile", build_terrain_tile),
]

# ---------------------------------------------------------------- export
def tri_count(col):
    n = 0
    for o in col.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n

def bbox(col):
    pts = [o.matrix_world @ Vector(c) for o in col.objects if o.type == "MESH" for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def export(col, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in col.objects:
        o.select_set(True)
    path = os.path.join(OUT_GLB, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_materials="EXPORT",
                              export_extras=False, export_cameras=False, export_lights=False)
    return path

# ---------------------------------------------------------------- preview stage
def setup_render():
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = 800, 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    try:
        scene.eevee.taa_render_samples = 32
    except Exception:
        pass
    for attr in ("use_bloom",):
        try:
            setattr(scene.eevee, attr, True)
        except Exception:
            pass
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    world = bpy.data.worlds.new("NightSky")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*hex_rgb("#0b1424"), 1)
    bg.inputs["Strength"].default_value = 0.6
    scene.world = world
    stage = bpy.data.collections.new("_preview_stage")
    scene.collection.children.link(stage)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.005))
    gp = bpy.context.active_object
    gp.data.materials.append(mat("PreviewGround", "#141a22", 0, 0.9))
    sun = bpy.data.objects.new("Moon", bpy.data.lights.new("Moon", "SUN"))
    sun.data.energy = 2.2
    sun.data.color = (0.75, 0.85, 1.0)
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    fill = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "SUN"))
    fill.data.energy = 0.8
    fill.data.color = (1.0, 0.8, 0.6)
    fill.rotation_euler = (math.radians(70), 0, math.radians(200))
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    cam.data.lens = 50
    target = bpy.data.objects.new("CamTarget", None)
    for o in (gp, sun, fill, cam, target):
        for c in o.users_collection:
            c.objects.unlink(o)
        stage.objects.link(o)
    t = cam.constraints.new("TRACK_TO")
    t.target = target
    t.track_axis, t.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    scene.camera = cam
    return stage, cam, target, gp

def render_preview(col, name, cam, target, gp):
    for c in scene.collection.children:
        if c.name not in ("_preview_stage",):
            c.hide_render = c is not col
    gp.hide_render = name == "terrain_tile"
    mn, mx = bbox(col)
    c = (mn + mx) / 2
    rad = (mx - mn).length / 2
    fov = cam.data.angle_y
    dist = rad / math.sin(fov / 2) * 0.78
    direction = Vector((1.0, -1.25, 0.75)).normalized()
    target.location = c
    cam.location = c + direction * dist
    cam.data.clip_end = dist * 10
    path = os.path.join(OUT_PREV, name + ".png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path

# ---------------------------------------------------------------- main
stats = {}
cols = {}
for name, fn in BUILDERS:
    col = fn()
    cols[name] = col
    mn, mx = bbox(col)
    glb = export(col, name)
    stats[name] = dict(
        triangles=tri_count(col),
        bytes=os.path.getsize(glb),
        size_m=[round(mx.x - mn.x, 2), round(mx.z - mn.z, 2), round(mx.y - mn.y, 2)],  # W x H x D (Y-up)
        nodes=sorted(o.name for o in col.objects if o.type == "MESH"),
    )
    print("BUILT", name, stats[name]["triangles"], "tris", stats[name]["bytes"], "bytes")
    # Free the clean node names for the next model (the GLB already has them);
    # inside the .blend they live on as "<model>:<node>".
    for o in col.objects:
        o.name = f"{name}:{o.name}"
        if o.data is not None:
            o.data.name = o.name

stage, cam, target, gp = setup_render()
for name, col in cols.items():
    p = render_preview(col, name, cam, target, gp)
    stats[name]["preview"] = os.path.relpath(p, ROOT)
    print("RENDERED", p)

for c in scene.collection.children:
    c.hide_render = False
with open(os.path.join(OUT_SRC, "model_stats.json"), "w") as f:
    json.dump(stats, f, indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_SRC, "night_reveal_models.blend"), compress=True)
print("DONE")
