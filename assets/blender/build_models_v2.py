"""
Night Reveal field models, v2 ("digital twin" pass).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      --python assets/blender/build_models_v2.py -- <repo_root> <raw_glb_dir> [only,names]

Same file names, units (scene world units, 1 unit = 1 m in the file), scale,
origin (base centre) and orientation (+Y up, flowline stubs along +X) as v1.

Per model:
  1. Detailed geometry: bevelled hard edges, flanges with bolts, handwheels,
     ladders with cages, handrails, platforms, insulation bands, saddles,
     skids with grating, ribbed roof and wall sheeting, guy wires, nameplates.
  2. Procedural PBR surfaces (painted steel with chipped edges, rust streaks,
     galvanised spangle and white rust, aluminium cladding, concrete with
     cracks, grating, sand and dust at the base), all on one mesh.
  3. Cycles bakes into one atlas: baseColor, ORM (AO, roughness, metallic)
     and a tangent space normal map (bevel node rounded edges + bump).
     No tangents are exported; three.js derives the tangent frame per pixel.
  4. Emissive parts stay separate named nodes with flat Emit_* materials and
     their pivot at their own base centre, so timeline code can scale and
     recolour them (InletValve_1-3, Flame_Core, Flame_Tip, Pilot, Beacon,
     ValveLight, StatusRing, AviationLights, MastLights, GasLights, ...).
  5. GLB export (WebP textures) to <raw_glb_dir>; meshopt
     compression is applied afterwards with gltf-transform.
  6. 800x600 Eevee preview with a night setup, bloom and cyan / gold rims.
"""
import bpy, bmesh, math, os, sys, json, random, time
import numpy as np
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
RAW = os.path.abspath(argv[1] if len(argv) > 1 else os.path.join(ROOT, "public", "models"))
ONLY = set(argv[2].split(",")) if len(argv) > 2 and argv[2] else None
SRC = os.path.join(ROOT, "assets", "blender")
TEX = os.path.join(SRC, "textures_v2")
PREV = os.path.join(SRC, "previews", "v2")
for d in (RAW, SRC, TEX, PREV):
    os.makedirs(d, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(7)

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def rgba(h):
    return (*srgb(h), 1.0)

# ================================================================ palette
CYAN, GOLD, RED = "#4dd0e1", "#ffb300", "#ff3333"
EMIT = {  # name: (hex, strength, alpha)
    "Emit_Cyan": (CYAN, 4.0, 1), "Emit_Gold": (GOLD, 4.0, 1), "Emit_GoldRing": (GOLD, 3.0, 1),
    "Emit_Red": (RED, 5.0, 1), "Emit_Valve": (RED, 4.0, 1),
    "Emit_Warm": ("#ffd2a0", 3.0, 1), "Emit_White": ("#e6f2ff", 3.0, 1),
    "Emit_FlameCore": ("#ff7a1a", 6.0, 0.9), "Emit_FlameTip": ("#ffe2a0", 8.0, 0.9),
    "Emit_Pilot": ("#ff8a3a", 5.0, 1), "Emit_FlowGlow": (CYAN, 3.0, 1),
}
_EM = {}
def emit_mat(name):
    if name in _EM:
        return _EM[name]
    hx, s, a = EMIT[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba(hx)
    b.inputs["Roughness"].default_value = 0.4
    b.inputs["Emission Color"].default_value = rgba(hx)
    b.inputs["Emission Strength"].default_value = s
    if a < 1:
        b.inputs["Alpha"].default_value = a
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try: setattr(m, attr, val)
            except Exception: pass
    _EM[name] = m
    return m

# Surfaces (procedural, baked). Base colours tuned for low key night light.
SURF = {
    "paint_grey":  dict(base="#aeb3b8", rough=0.52, wear=0.35, rust=0.25, dust=0.6, grime=0.5),
    "paint_white": dict(base="#d3d6d8", rough=0.48, wear=0.25, rust=0.30, dust=0.7, grime=0.6),
    "paint_yellow": dict(base="#c29a2e", rough=0.50, wear=0.50, rust=0.20, dust=0.6, grime=0.4),
    "paint_red":   dict(base="#8a1d16", rough=0.45, wear=0.45, rust=0.20, dust=0.4, grime=0.4),
    "steel_dark":  dict(base="#4b5157", rough=0.58, wear=0.40, rust=0.40, dust=0.6, grime=0.5),
    "rack":        dict(base="#5c5244", rough=0.62, wear=0.40, rust=0.60, dust=0.7, grime=0.6),
    "galv":        dict(base="#a3a9ae", rough=0.40, metal=0.9, pattern="spangle", rust=0.15, dust=0.5, grime=0.4),
    "cladding":    dict(base="#c0c5c9", rough=0.36, metal=0.85, pattern="bands", rust=0.05, dust=0.5, grime=0.3),
    "concrete":    dict(base="#77736b", rough=0.90, pattern="concrete", rust=0.10, dust=0.8, grime=0.6),
    "grating":     dict(base="#6a6e71", rough=0.55, metal=0.6, pattern="grating", rust=0.30, dust=0.5, grime=0.4),
    "roof":        dict(base="#33475c", rough=0.50, metal=0.3, pattern="ribs_y", wear=0.2, rust=0.3, dust=0.3, grime=0.5),
    "wall":        dict(base="#8a9198", rough=0.55, metal=0.3, pattern="ribs_v", wear=0.2, rust=0.3, dust=0.8, grime=0.5),
    "plate":       dict(base="#cfd1cb", rough=0.35, metal=0.5, pattern="plate", wear=0.1, dust=0.2),
    "gauge":       dict(base="#e8e8e2", rough=0.25, pattern="plate", dust=0.1),
    "glass":       dict(base="#1d2a33", rough=0.10, metal=0.2, dust=0.2),
}
DUST_H = 0.35

class NB:
    """Tiny node builder."""
    def __init__(s, mat):
        s.nt = mat.node_tree; s.N = s.nt.nodes; s.L = s.nt.links
    def new(s, t, **kw):
        n = s.N.new(t)
        for k, v in kw.items():
            setattr(n, k, v)
        return n
    def put(s, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            s.L.new(v, sock)
        elif v is not None:
            sock.default_value = v
    def sock(s, socks, name, typ=None):
        for x in socks:
            if x.name == name and (typ is None or x.type == typ) and x.enabled:
                return x
        for x in socks:
            if x.name == name and (typ is None or x.type == typ):
                return x
        raise KeyError(name)
    def math(s, op, a, b=None, clamp=False, name=None):
        n = s.new("ShaderNodeMath", operation=op, use_clamp=clamp)
        if name: n.name = name
        s.put(n.inputs[0], a)
        if b is not None: s.put(n.inputs[1], b)
        return n.outputs[0]
    def vmath(s, op, a, b=None):
        n = s.new("ShaderNodeVectorMath", operation=op)
        s.put(n.inputs[0], a)
        if b is not None: s.put(n.inputs[1], b)
        return n.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs["Vector"]
    def mrange(s, v, a, b, c=0.0, d=1.0):
        n = s.new("ShaderNodeMapRange")
        s.put(n.inputs["Value"], v); n.inputs["From Min"].default_value = a
        n.inputs["From Max"].default_value = b; n.inputs["To Min"].default_value = c
        n.inputs["To Max"].default_value = d
        return n.outputs["Result"]
    def noise(s, vec, scale, detail=4.0, rough=0.55, w=None):
        n = s.new("ShaderNodeTexNoise")
        if w is not None:
            n.noise_dimensions = "4D"; s.put(n.inputs["W"], w)
        s.put(n.inputs["Vector"], vec); n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail; n.inputs["Roughness"].default_value = rough
        return n.outputs["Fac"]
    def voronoi(s, vec, scale, feature="F1", out="Distance"):
        n = s.new("ShaderNodeTexVoronoi", feature=feature)
        s.put(n.inputs["Vector"], vec); n.inputs["Scale"].default_value = scale
        return n.outputs[out]
    def mix(s, fac, a, b, blend="MIX", name=None):
        n = s.new("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_factor=True)
        if name: n.name = name
        s.put(s.sock(n.inputs, "Factor", "VALUE"), fac)
        s.put(s.sock(n.inputs, "A", "RGBA"), a)
        s.put(s.sock(n.inputs, "B", "RGBA"), b)
        return s.sock(n.outputs, "Result", "RGBA")
    def xyz(s, vec):
        n = s.new("ShaderNodeSeparateXYZ"); s.put(n.inputs[0], vec)
        return n.outputs["X"], n.outputs["Y"], n.outputs["Z"]

def surface_mat(key):
    """Weathered PBR surface. Exposes OUT_COLOR / OUT_ROUGH / OUT_METAL nodes for baking."""
    p = dict(metal=0.0, wear=0.0, rust=0.0, dust=0.0, grime=0.0, pattern=None)
    p.update(SURF[key])
    m = bpy.data.materials.new("S_" + key)
    m.use_nodes = True
    m.use_fake_user = True
    g = NB(m)
    bsdf = g.N["Principled BSDF"]
    co = g.new("ShaderNodeTexCoord").outputs["Object"]
    x, y, z = g.xyz(co)
    n_big = g.noise(co, 1.6, 5, 0.6)
    n_mid = g.noise(co, 7.0, 4, 0.55)
    n_fine = g.noise(co, 38.0, 3, 0.5)
    geo = g.new("ShaderNodeNewGeometry")
    bev = g.new("ShaderNodeBevel"); bev.samples = 8; bev.inputs["Radius"].default_value = 0.005
    dot = g.vmath("DOT_PRODUCT", bev.outputs["Normal"], geo.outputs["Normal"])
    edge = g.math("MULTIPLY", g.math("SUBTRACT", 1.0, dot), 9.0, clamp=True)
    _, _, nz = g.xyz(geo.outputs["Normal"])
    if p["wear"] > 0:  # chipped paint on edges
        t = g.math("ADD", g.math("MULTIPLY", edge, 0.9), g.math("MULTIPLY", g.math("SUBTRACT", n_fine, 0.5), 0.7))
        thr = 0.85 - p["wear"] * 0.55
        chip = g.mrange(t, thr, thr + 0.08)
    else:
        chip = 0.0
    # rust streaks run down (noise stretched in Z), plus rust in chips
    streak_vec = g.vmath("MULTIPLY", co, (16.0, 16.0, 1.3))
    streak = g.mrange(g.noise(streak_vec, 1.0, 3, 0.5), 0.60, 0.74)
    streak = g.math("MULTIPLY", streak, g.mrange(n_big, 0.35, 0.65))
    rustm = g.math("MULTIPLY", streak, p["rust"])
    if p["wear"] > 0:
        rustm = g.math("MAXIMUM", rustm, g.math("MULTIPLY", chip, p["rust"] * 0.8))
    # dust and sand at the base and on up facing surfaces
    dust_base = g.math("MULTIPLY", g.mrange(z, 0.0, DUST_H, 1.0, 0.0), g.math("ADD", 0.35, g.math("MULTIPLY", n_mid, 0.65)))
    dust_top = g.math("MULTIPLY", g.mrange(nz, 0.75, 0.95), g.math("MULTIPLY", g.mrange(n_mid, 0.4, 0.7), 0.35))
    dust = g.math("MULTIPLY", g.math("MAXIMUM", dust_base, dust_top), p["dust"], clamp=True)
    grime = g.math("MULTIPLY", g.mrange(n_big, 0.35, 0.75), p["grime"])

    base = rgba(p["base"])
    col = g.mix(g.math("MULTIPLY", g.math("SUBTRACT", n_mid, 0.5), 0.5), base, (base[0] * 0.8, base[1] * 0.8, base[2] * 0.8, 1))
    rough_extra = 0.0
    metal_v = p["metal"]
    height = g.math("MULTIPLY", n_fine, 0.25)
    pat = p["pattern"]
    if pat == "spangle":
        v = g.voronoi(co, 26.0, out="Color")
        vx, _, _ = g.xyz(v)
        col = g.mix(g.math("MULTIPLY", vx, 0.35), col, (0.32, 0.34, 0.36, 1))
        ox = g.mrange(n_big, 0.55, 0.72)
        col = g.mix(g.math("MULTIPLY", ox, 0.6), col, rgba("#d2d4ce"))
        rough_extra = g.math("ADD", g.math("MULTIPLY", vx, 0.12), g.math("MULTIPLY", ox, 0.35))
        metal_v = g.math("SUBTRACT", p["metal"], g.math("MULTIPLY", ox, 0.5))
    elif pat == "bands":
        band = g.mrange(g.math("ABSOLUTE", g.math("SINE", g.math("MULTIPLY", z, math.pi / 0.45))), 0.96, 1.0)
        col = g.mix(g.math("MULTIPLY", band, 0.5), col, (0.25, 0.26, 0.27, 1))
        dents = g.mrange(g.noise(co, 9.0, 2, 0.5), 0.55, 0.8)
        height = g.math("ADD", g.math("MULTIPLY", band, -0.8), g.math("MULTIPLY", dents, 0.25))
    elif pat == "concrete":
        warp = g.vmath("MULTIPLY", g.new("ShaderNodeTexNoise").outputs["Color"], (0.15, 0.15, 0.15))
        crack = g.mrange(g.voronoi(g.vmath("ADD", co, warp), 2.5, "DISTANCE_TO_EDGE"), 0.0, 0.015, 1.0, 0.0)
        pits = g.mrange(g.noise(co, 90.0, 2, 0.5), 0.68, 0.78)
        col = g.mix(g.math("MULTIPLY", crack, 0.7), col, (0.05, 0.05, 0.05, 1))
        col = g.mix(g.math("MULTIPLY", pits, 0.4), col, (0.08, 0.08, 0.075, 1))
        col = g.mix(g.math("MULTIPLY", edge, 0.35), col, (0.55, 0.53, 0.5, 1))  # worn bright edges
        height = g.math("SUBTRACT", g.math("MULTIPLY", n_fine, 0.4), g.math("ADD", g.math("MULTIPLY", crack, 0.8), g.math("MULTIPLY", pits, 0.4)))
    elif pat == "grating":
        def bars(c, pitch):
            return g.mrange(g.math("ABSOLUTE", g.math("SINE", g.math("MULTIPLY", c, math.pi / pitch))), 0.0, 0.35, 1.0, 0.0)
        holes = g.math("MULTIPLY", g.math("SUBTRACT", 1.0, bars(x, 0.035)), g.math("SUBTRACT", 1.0, bars(y, 0.09)))
        col = g.mix(holes, col, (0.012, 0.013, 0.015, 1))
        rough_extra = g.math("MULTIPLY", holes, 0.3)
        height = g.math("SUBTRACT", 1.0, holes)
    elif pat == "ribs_y":
        r = g.math("ADD", 0.5, g.math("MULTIPLY", g.math("SINE", g.math("MULTIPLY", y, 2 * math.pi / 0.11)), 0.5))
        height = g.math("ADD", g.math("MULTIPLY", r, 1.0), g.math("MULTIPLY", n_fine, 0.15))
        col = g.mix(g.math("MULTIPLY", r, 0.15), col, (base[0] * 1.3, base[1] * 1.3, base[2] * 1.3, 1))
    elif pat == "ribs_v":
        r = g.math("ADD", 0.5, g.math("MULTIPLY", g.math("SINE", g.math("MULTIPLY", g.math("ADD", x, y), 2 * math.pi / 0.09)), 0.5))
        height = g.math("ADD", g.math("MULTIPLY", r, 0.9), g.math("MULTIPLY", n_fine, 0.15))
    elif pat == "plate":
        rows = g.mrange(g.math("ABSOLUTE", g.math("SINE", g.math("MULTIPLY", z, math.pi / 0.018))), 0.85, 1.0)
        cols = g.mrange(g.noise(g.vmath("MULTIPLY", co, (60.0, 60.0, 4.0)), 1.0, 1, 0.5), 0.45, 0.55)
        txt = g.math("MULTIPLY", g.math("MULTIPLY", rows, cols), g.mrange(edge, 0.2, 0.0))
        col = g.mix(g.math("MULTIPLY", txt, 0.8), col, (0.03, 0.04, 0.05, 1))
    # layering: grime, chips, rust, dust
    col = g.mix(g.math("MULTIPLY", grime, 0.55), col, (0.5, 0.48, 0.45, 1), blend="MULTIPLY")
    if p["wear"] > 0:
        col = g.mix(chip, col, rgba("#55595d"))
    col = g.mix(g.math("MULTIPLY", rustm, 0.8), col, rgba("#6a381c"))
    col = g.mix(dust, col, rgba("#9b8869"), name="OUT_COLOR")
    rough = g.math("ADD", p["rough"], g.math("MULTIPLY", g.math("SUBTRACT", n_fine, 0.5), 0.12))
    if p["wear"] > 0:
        rough = g.math("ADD", rough, g.math("MULTIPLY", chip, 0.42 - p["rough"]))
    rough = g.math("ADD", rough, rough_extra)
    rough = g.math("ADD", rough, g.math("MULTIPLY", rustm, 0.35))
    rough = g.math("ADD", rough, g.math("MULTIPLY", dust, 0.5), clamp=True, name="OUT_ROUGH")
    metal = metal_v
    if p["wear"] > 0:
        metal = g.math("ADD", metal, g.math("MULTIPLY", chip, 0.85 - p["metal"]))
    metal = g.math("MULTIPLY", metal, g.math("SUBTRACT", 1.0, g.math("MULTIPLY", rustm, 0.8)))
    metal = g.math("MULTIPLY", metal, g.math("SUBTRACT", 1.0, g.math("MULTIPLY", dust, 0.9)), clamp=True, name="OUT_METAL")
    if p["wear"] > 0:
        height = g.math("ADD", height, g.math("MULTIPLY", chip, -0.6))
    height = g.math("ADD", height, g.math("MULTIPLY", rustm, 0.3))
    bump = g.new("ShaderNodeBump"); bump.name = "OUT_BUMP"
    bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.004
    g.put(bump.inputs["Height"], height)
    g.put(bump.inputs["Normal"], bev.outputs["Normal"])
    g.put(bsdf.inputs["Base Color"], col)
    g.put(bsdf.inputs["Roughness"], rough)
    g.put(bsdf.inputs["Metallic"], metal)
    g.put(bsdf.inputs["Normal"], bump.outputs["Normal"])
    return m

_SM = {}
def smat(key):
    if key not in _SM:
        _SM[key] = surface_mat(key)
    return _SM[key]

# ================================================================ primitives
CURRENT = []

def _take(o, surf, node=None, bevel="auto", segs=None):
    o.data.materials.clear()
    o.data.materials.append(emit_mat(surf) if surf.startswith("Emit_") else smat(surf))
    o["node"] = node or ""
    if bevel and not surf.startswith("Emit_"):
        bpy.context.view_layer.update()
        if isinstance(bevel, float):
            w = bevel
        else:
            dims = sorted(o.dimensions)
            w = max(0.002, min(0.02, dims[0] * 0.07, dims[1] * 0.07))
        if w >= 0.0015:
            mod = o.modifiers.new("Bevel", "BEVEL")
            mod.width = w
            mod.segments = segs or 1
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(50)
            mod.use_clamp_overlap = True
    CURRENT.append(o)
    return o

AX = {"X": Euler((0, math.pi / 2, 0)), "Y": Euler((math.pi / 2, 0, 0)), "Z": Euler((0, 0, 0))}

def cyl(r, h, loc, segs=16, surf="paint_grey", node=None, r2=None, cap=True, bevel="auto"):
    """Vertical cylinder (or cone), base at loc."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=h, end_fill_type="NGON" if cap else "NOTHING")
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r, radius2=r2, depth=h, end_fill_type="NGON" if cap else "NOTHING")
    o = bpy.context.active_object
    o.data.transform(Matrix.Translation((0, 0, h / 2)))
    o.location = loc
    return _take(o, surf, node, bevel if cap else None)

def acyl(r, length, center, axis="X", segs=16, surf="paint_grey", node=None, cap=True, bevel="auto"):
    """Cylinder centred at center along axis X / Y / Z."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=length, end_fill_type="NGON" if cap else "NOTHING")
    o = bpy.context.active_object
    o.rotation_euler = AX[axis]
    o.location = center
    return _take(o, surf, node, bevel if cap else None)

def box(size, loc, surf="paint_grey", node=None, base=True, rotz=0.0, bevel="auto"):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.data.transform(Matrix.Diagonal((*size, 1)))
    if base:
        o.data.transform(Matrix.Translation((0, 0, size[2] / 2)))
    o.rotation_euler = (0, 0, rotz)
    o.location = loc
    return _take(o, surf, node, bevel)

def ball(r, loc, surf="Emit_Warm", node=None, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return _take(bpy.context.active_object, surf, node, None)

def uvsphere(r, loc, surf="paint_white", segs=32, rings=16, node=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=r, location=loc)
    return _take(bpy.context.active_object, surf, node, None)

def dome(r, loc, surf="paint_white", segs=24, rings=4, frac=1.0, node=None, squash=1.0, rot=(0, 0, 0)):
    """Upper cap of a sphere (frac=1: hemisphere), base at loc, optionally squashed (2:1 heads)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings * 2, radius=r)
    o = bpy.context.active_object
    bm = bmesh.new(); bm.from_mesh(o.data)
    cut = r * (1 - frac)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut - 1e-4], context="VERTS")
    for v in bm.verts:
        v.co.z = (v.co.z - cut) * squash
    bm.to_mesh(o.data); bm.free()
    o.rotation_euler = rot
    o.location = loc
    return _take(o, surf, node, None)

def torus(R, r, loc, axis="Z", surf="paint_red", node=None, seg=16, mseg=6, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg)
    o = bpy.context.active_object
    o.rotation_euler = rot if rot is not None else AX[axis]
    o.location = loc
    return _take(o, surf, node, None)

def strut(a, b, r=0.012, surf="steel_dark", segs=6, node=None):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=max(d.length, 1e-4),
                                        end_fill_type="NOTHING" if r < 0.009 else "NGON")
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (a + b) / 2
    return _take(o, surf, node, None)

def bar(a, b, w=0.02, h=None, surf="rack"):
    """Rectangular section member from a to b (w across, h in the 'up' direction)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.data.transform(Matrix.Diagonal((w, h or w, d.length, 1)))
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (a + b) / 2
    return _take(o, surf, None, None if min(w, h or w) < 0.03 else "auto")

def bmesh_fix_normals(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()

def annulus(r_in, r_out, z, thick, x=0.0, y=0.0, segs=32, surf="grating", arc=2 * math.pi, start=0.0, node=None):
    bm = bmesh.new()
    full = abs(arc - 2 * math.pi) < 1e-6
    cnt = segs if full else segs + 1
    ring = []
    for i in range(cnt):
        a = start + arc * i / segs
        c, s = math.cos(a), math.sin(a)
        ring.append([bm.verts.new((x + c * r, y + s * r, zz)) for r, zz in
                     ((r_in, z), (r_out, z), (r_out, z + thick), (r_in, z + thick))])
    for i in range(cnt if full else cnt - 1):
        A, B = ring[i], ring[(i + 1) % cnt]
        for k in range(4):
            bm.faces.new((A[k], B[k], B[(k + 1) % 4], A[(k + 1) % 4]))
    if not full:
        bm.faces.new(ring[0][::-1]); bm.faces.new(ring[-1])
    me = bpy.data.meshes.new("annulus"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("annulus", me)
    scene.collection.objects.link(o)
    bmesh_fix_normals(o)
    return _take(o, surf, node, None)

def ring_flat(r_in, r_out, loc, surf="Emit_GoldRing", node=None, segs=48):
    o = annulus(r_in, r_out, 0, 0.012, segs=segs, surf=surf, node=node)
    o.location = loc
    return o

def prism_roof(w, d, h, loc, surf="roof", overhang=0.06):
    """Gable roof: ridge along Y, slopes face +-X."""
    w2, d2 = w / 2 + overhang, d / 2 + overhang
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w2, -d2, 0), (w2, -d2, 0), (0, -d2, h), (-w2, d2, 0), (w2, d2, 0), (0, d2, h))]
    for f in ((0, 1, 2), (5, 4, 3), (0, 2, 5, 3), (1, 4, 5, 2), (0, 3, 4, 1)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("roof"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("roof", me); scene.collection.objects.link(o)
    o.location = loc
    return _take(o, surf, None, 0.01)

# ---------------------------------------------------------------- detail kit
def _frame(axis):
    a = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}[axis]
    u = Vector((0, 0, 1)) if axis != "Z" else Vector((1, 0, 0))
    v = a.cross(u)
    return a, u, v

def flange(center, axis, r_pipe, bolts=8, surf="paint_grey", thick=None):
    """Flange pair with a bolt ring (studs through both)."""
    c = Vector(center)
    R = r_pipe * 1.75
    t = thick or max(0.012, r_pipe * 0.35)
    acyl(R, t * 2, c, axis, segs=16, surf=surf)
    acyl(r_pipe * 1.2, t * 4, c, axis, segs=12, surf=surf, bevel=None, cap=False)
    bolts = min(bolts, 4 if r_pipe < 0.05 else 8)
    if bolts:
        a, u, v = _frame(axis)
        br = max(0.004, r_pipe * 0.13)
        for i in range(bolts):
            ang = 2 * math.pi * (i + 0.5) / bolts
            p = c + (u * math.cos(ang) + v * math.sin(ang)) * R * 0.78
            acyl(br, t * 2 + br * 3.2, p, axis, segs=6, surf="steel_dark", bevel=None, cap=False)

def handwheel(center, axis, R, surf="paint_red", spokes=3):
    c = Vector(center)
    torus(R, R * 0.12, c, axis=axis, surf=surf, seg=18, mseg=4)
    a, u, v = _frame(axis)
    for i in range(spokes):
        ang = 2 * math.pi * i / spokes
        strut(c, c + (u * math.cos(ang) + v * math.sin(ang)) * R, r=R * 0.07, surf=surf, segs=6)
    acyl(R * 0.22, R * 0.35, c, axis, segs=10, surf="steel_dark", bevel=None)

def _axis_of(vec):
    v = Vector(vec)
    return "Z" if abs(v.z) > 0.5 else ("X" if abs(v.x) > 0.5 else "Y")

def gate_valve(center, axis, r, surf="paint_red", stem_dir=(0, 0, 1), bolts=8):
    """Flanged gate valve body with bonnet, stem and handwheel."""
    c = Vector(center)
    L = r * 2.6
    a, _, _ = _frame(axis)
    acyl(r * 1.05, L, c, axis, segs=16, surf=surf)
    for s in (-1, 1):
        flange(c + a * (s * L / 2), axis, r * 0.8, bolts=bolts, surf=surf)
    sd = Vector(stem_dir).normalized()
    bon = c + sd * r * 1.25
    acyl(r * 0.75, r * 1.3, bon, _axis_of(sd), segs=12, surf=surf)
    top = c + sd * r * 2.6
    strut(bon, top, r=r * 0.14, surf="galv", segs=8)
    handwheel(top, _axis_of(sd), r * 1.3, surf=surf)

def ladder(base, h, normal, width=0.14, rung=0.09, cage=True, surf="paint_yellow", offset=0.0):
    """Vertical rung ladder standing off a surface along normal, with a safety cage."""
    b = Vector(base); n = Vector((normal[0], normal[1], 0)).normalized()
    t = Vector((-n.y, n.x, 0))
    o = b + n * offset
    for s in (-1, 1):
        p = o + t * (s * width / 2)
        bar(p, p + Vector((0, 0, h + (0.25 if cage else 0))), w=0.012, surf=surf)
    k = 1
    while k * rung < h:
        z = Vector((0, 0, k * rung))
        strut(o - t * width / 2 + z, o + t * width / 2 + z, r=0.005, surf=surf, segs=4)
        k += 1
    if cage and h > 0.8:
        cr = width * 0.75
        cc = o + n * cr
        z = 0.55
        while z < h + 0.2:
            torus(cr, 0.006, cc + Vector((0, 0, z)), axis="Z", surf=surf, seg=12, mseg=3)
            z += 0.32
        for ang in (-60, 0, 60):
            a = math.radians(ang)
            p = cc + (n * math.cos(a) + t * math.sin(a)) * cr
            strut(p + Vector((0, 0, 0.55)), p + Vector((0, 0, h + 0.15)), r=0.005, surf=surf, segs=4)
    zz = 0.3
    while zz < h and offset > 0:
        strut(b + Vector((0, 0, zz)), o + Vector((0, 0, zz)), r=0.006, surf=surf, segs=4)
        zz += 0.6

def handrail_ring(x, y, z, r, posts=12, surf="paint_yellow", height=0.11, arc=2 * math.pi, start=0.0):
    full = abs(arc - 2 * math.pi) < 1e-6
    for i in range(posts if full else posts + 1):
        a = start + arc * i / posts
        p = Vector((x + math.cos(a) * r, y + math.sin(a) * r, z))
        strut(p, p + Vector((0, 0, height)), r=0.006, surf=surf, segs=4)
    for hh in (height, height * 0.5):
        if full:
            torus(r, 0.006, (x, y, z + hh), axis="Z", surf=surf, seg=max(16, posts * 2), mseg=3)
        else:
            steps = posts
            for i in range(steps):
                a0, a1 = start + arc * i / steps, start + arc * (i + 1) / steps
                strut((x + math.cos(a0) * r, y + math.sin(a0) * r, z + hh),
                      (x + math.cos(a1) * r, y + math.sin(a1) * r, z + hh), r=0.006, surf=surf, segs=4)

def nameplate(loc, w, h, rotz=0.0):
    box((w, 0.008, h), loc, surf="plate", base=False, rotz=rotz, bevel=0.002)

def pipe_shoe(x, y, z, r, axis="X"):
    """Shoe under a pipe whose bottom sits at height z, plus a U bolt around it."""
    if axis == "X":
        box((0.05, r * 1.6, 0.025), (x, y, z - 0.025), surf="steel_dark", bevel=None)
        torus(r * 1.05, 0.004, (x, y, z + r), rot=(0, math.pi / 2, 0), surf="galv", seg=12, mseg=3)
    else:
        box((r * 1.6, 0.05, 0.025), (x, y, z - 0.025), surf="steel_dark", bevel=None)
        torus(r * 1.05, 0.004, (x, y, z + r), rot=(math.pi / 2, 0, 0), surf="galv", seg=12, mseg=3)

def ibeam(a, b, h=0.08, w=0.06, surf="rack"):
    """I section (web + two flanges) between a and b."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    side = d.cross(ref).normalized()
    up = side.cross(d).normalized()
    for off in (-1, 1):
        p = up * (off * (h / 2 - 0.006))
        _flat(a + p, b + p, side, w, 0.012, surf)
    _flat(a, b, side, 0.01, h, surf)

def _flat(a, b, side, w, t, surf):
    """Box from a to b, width w along 'side', thickness t."""
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    up = side.cross(d.normalized()).normalized()
    M = Matrix((side * w, up * t, d)).transposed()  # columns: x->side*w, y->up*t, z->d
    o.data.transform(M.to_4x4())
    o.location = (a + b) / 2
    return _take(o, surf, None, None)

def light_mast(x, y, h, base_z=0.15, node="MastLights"):
    box((0.16, 0.16, 0.06), (x, y, base_z), surf="concrete")
    cyl(0.03, h, (x, y, base_z + 0.06), segs=10, r2=0.022, surf="galv")
    box((0.22, 0.07, 0.05), (x, y, base_z + 0.06 + h), surf="steel_dark")
    box((0.18, 0.05, 0.012), (x, y - 0.01, base_z + 0.05 + h), surf="Emit_White", node=node, bevel=None)
    box((0.05, 0.03, 0.12), (x, y + 0.03, base_z + 0.5), surf="steel_dark")

def skid(x, y, w, d, z=0.0, h=0.06, surf="paint_yellow"):
    for s in (-1, 1):
        box((w, 0.04, h), (x, y + s * (d / 2 - 0.02), z), surf=surf)
    box((w - 0.02, d - 0.08, 0.015), (x, y, z + h - 0.02), surf="grating", bevel=None)

# ---------------------------------------------------------------- finalize
def finalize(name):
    """One baked '<name>_Body' mesh for all static parts + one node per emissive group."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    root = bpy.data.objects.new(name, None); col.objects.link(root)
    groups = {}
    for o in CURRENT:
        groups.setdefault(o["node"] or "__body__", []).append(o)
    made = {}
    for key, objs in groups.items():
        bm = bmesh.new(); mats = []
        for o in objs:
            m = o.data.materials[0]
            if m not in mats: mats.append(m)
            me_eval = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            me_eval.transform(o.matrix_world)
            for poly in me_eval.polygons: poly.material_index = mats.index(m)
            bm.from_mesh(me_eval); bpy.data.meshes.remove(me_eval)
        oname = name + "_Body" if key == "__body__" else key
        me = bpy.data.meshes.new(oname); bm.to_mesh(me); bm.free()
        for m in mats: me.materials.append(m)
        for p in me.polygons: p.use_smooth = True
        ob = bpy.data.objects.new(oname, me); col.objects.link(ob); ob.parent = root
        if key != "__body__":
            # pivot at the group's own base centre (the timeline scales flames in Y from the base)
            vs = [v.co for v in me.vertices]
            mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
            mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
            piv = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
            me.transform(Matrix.Translation(-piv)); ob.location = piv
        else:
            try: me.set_sharp_from_angle(angle=math.radians(40))
            except Exception as e: print("sharp:", e)
            wn = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL"); wn.keep_sharp = True; wn.weight = 50
        tri = ob.modifiers.new("Triangulate", "TRIANGULATE")
        try: tri.keep_custom_normals = True
        except Exception: pass
        made[key] = ob
    for o in CURRENT:
        bpy.data.objects.remove(o, do_unlink=True)
    CURRENT.clear()
    return col, made.get("__body__")

# ================================================================ MODELS
def tree(beacon, valve_light):
    """Wellhead + christmas tree, ~1.1 m tall, flowline stub along +X (as v1)."""
    cyl(0.62, 0.08, (0, 0, 0), segs=8, surf="concrete")
    box((0.56, 0.56, 0.02), (0, 0, 0.08), surf="concrete")
    box((0.48, 0.48, 0.012), (0, 0, 0.1), surf="grating", bevel=None)
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        cyl(0.012, 0.03, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.1), segs=6, surf="steel_dark", bevel=None)
    cyl(0.13, 0.12, (0, 0, 0.1), segs=20, surf="paint_grey")                          # casing head
    for sx in (-1, 1):                                                                # casing outlets
        acyl(0.025, 0.12, (sx * 0.18, 0, 0.16), "X", segs=10, surf="paint_grey")
        flange((sx * 0.24, 0, 0.16), "X", 0.025, bolts=4)
    flange((0, 0, 0.235), "Z", 0.1, bolts=8)
    gate_valve((0, 0, 0.34), "Z", 0.075, stem_dir=(0, 1, 0))                          # lower master
    flange((0, 0, 0.44), "Z", 0.08, bolts=8)
    gate_valve((0, 0, 0.55), "Z", 0.07, stem_dir=(0, -1, 0))                          # upper master
    box((0.19, 0.19, 0.15), (0, 0, 0.66), surf="paint_grey")                          # studded cross
    for sx in (-1, 1):
        flange((sx * 0.11, 0, 0.735), "X", 0.055, bolts=8)
        gate_valve((sx * 0.2, 0, 0.735), "X", 0.055, stem_dir=(0, 0, 1))              # wing valves
        flange((sx * 0.29, 0, 0.735), "X", 0.05, bolts=6)
    box((0.08, 0.08, 0.09), (0.36, 0, 0.69), surf="paint_grey")                       # choke
    cyl(0.025, 0.08, (0.36, 0, 0.78), segs=10, surf="steel_dark")
    acyl(0.04, 0.48, (0.62, 0, 0.735), "X", segs=14, surf="galv")                     # flowline stub
    flange((0.86, 0, 0.735), "X", 0.04, bolts=6)
    box((0.08, 0.1, 0.70), (0.8, 0, 0.0), surf="steel_dark")
    torus(0.044, 0.005, (0.8, 0, 0.735), rot=(0, math.pi / 2, 0), surf="galv", seg=12, mseg=3)
    acyl(0.03, 0.14, (-0.38, 0, 0.735), "X", segs=10, surf="paint_grey")              # kill line
    flange((0, 0, 0.82), "Z", 0.06, bolts=8)
    gate_valve((0, 0, 0.9), "Z", 0.055, stem_dir=(0, 1, 0), bolts=6)                  # swab
    cyl(0.08, 0.05, (0, 0, 0.98), segs=16, surf="paint_grey")                         # tree cap
    torus(0.03, 0.007, (0, 0, 1.05), axis="X", surf="steel_dark", seg=10, mseg=4)
    acyl(0.006, 0.05, (0.06, 0.06, 0.8), "Y", segs=6, surf="steel_dark", bevel=None)  # gauge
    acyl(0.03, 0.012, (0.06, 0.09, 0.8), "Y", segs=14, surf="gauge", bevel=None)
    ball(0.035, (0, 0, 1.12), surf=valve_light, node="ValveLight")
    cyl(0.04, 0.03, (-0.45, -0.38, 0.08), segs=8, surf="steel_dark")                  # beacon mast
    cyl(0.022, 0.88, (-0.45, -0.38, 0.11), segs=10, surf="galv")
    nameplate((-0.45, -0.405, 0.55), 0.12, 0.08)
    torus(0.07, 0.006, (-0.45, -0.38, 1.0), surf="steel_dark", seg=12, mseg=3)
    cyl(0.07, 0.09, (-0.45, -0.38, 0.99), segs=16, surf=beacon, node="Beacon")
    cyl(0.075, 0.015, (-0.45, -0.38, 1.08), segs=16, surf="steel_dark")
    for a in (0.3, 2.4, 4.1):                                                          # bollards
        cyl(0.03, 0.18, (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.08), segs=10, surf="paint_yellow")

def build_wellhead():
    tree("Emit_Cyan", "Emit_Cyan")
    return finalize("wellhead")

def build_wellhead_agup():
    tree("Emit_Gold", "Emit_Gold")
    skid(0.2, 0.44, 0.38, 0.28, z=0.08)                                               # ESP / VSD skid
    box((0.3, 0.17, 0.36), (0.2, 0.44, 0.14), surf="paint_white")
    box((0.32, 0.19, 0.02), (0.2, 0.44, 0.5), surf="paint_grey")
    for k in range(4):
        box((0.08, 0.008, 0.01), (0.31, 0.352, 0.2 + k * 0.025), surf="steel_dark", bevel=None)
    box((0.004, 0.006, 0.28), (0.2, 0.352, 0.18), surf="steel_dark", bevel=None)
    box((0.008, 0.012, 0.05), (0.18, 0.348, 0.3), surf="steel_dark", bevel=None)
    nameplate((0.12, 0.352, 0.42), 0.07, 0.04)
    box((0.12, 0.006, 0.035), (0.12, 0.351, 0.36), surf="Emit_Gold", node="PanelLight", base=False, bevel=None)
    strut((0.08, 0.36, 0.16), (0.04, 0.1, 0.16), r=0.012, surf="galv", segs=8)
    strut((0.04, 0.1, 0.16), (0.04, 0.1, 0.25), r=0.012, surf="galv", segs=8)
    ring_flat(0.72, 0.82, (0, 0, 0.09), node="StatusRing")
    return finalize("wellhead_agup")

def tank(x, y, r=1.05, h=1.25, z0=0.15):
    cyl(r * 1.04, 0.05, (x, y, z0), segs=32, surf="concrete")
    cyl(r, h, (x, y, z0 + 0.05), segs=32, surf="paint_white", bevel=0.01)
    for k in range(1, 4):                                                              # shell courses
        cyl(r * 1.004, 0.01, (x, y, z0 + 0.05 + k * h / 4), segs=32, surf="paint_white", cap=False)
    zt = z0 + 0.05 + h
    dome(r, (x, y, zt), surf="paint_white", segs=32, rings=3, frac=0.3)
    cyl(r * 1.035, 0.035, (x, y, zt - 0.08), segs=32, surf="paint_grey", cap=False)    # wind girder
    handrail_ring(x, y, zt, r * 0.98, posts=16, arc=math.pi * 0.7, start=-math.pi * 0.35)
    n = 10                                                                             # stair treads
    for i in range(n):
        a = -math.pi * 0.45 + (math.pi * 0.42) * i / n
        zz = z0 + 0.05 + h * (i + 1) / n
        p = Vector((x + math.cos(a) * (r + 0.07), y + math.sin(a) * (r + 0.07), zz))
        box((0.12, 0.06, 0.012), p, surf="grating", rotz=a, bevel=None)
        q = Vector((x + math.cos(a) * (r + 0.13), y + math.sin(a) * (r + 0.13), zz))
        strut(q, q + Vector((0, 0, 0.11)), r=0.005, surf="paint_yellow", segs=4)
    a0, a1 = -math.pi * 0.45, -math.pi * 0.03
    strut((x + math.cos(a0) * (r + 0.13), y + math.sin(a0) * (r + 0.13), z0 + 0.16),
          (x + math.cos(a1) * (r + 0.13), y + math.sin(a1) * (r + 0.13), zt + 0.11), r=0.006, surf="paint_yellow", segs=4)
    cyl(0.07, 0.12, (x + r * 0.35, y + r * 0.2, zt + 0.05), segs=12, surf="paint_grey")  # roof vent
    dome(0.09, (x + r * 0.35, y + r * 0.2, zt + 0.17), surf="paint_grey", segs=12, rings=2)
    acyl(0.13, 0.06, (x - r - 0.02, y, z0 + 0.35), "X", segs=16, surf="paint_white")   # manway
    flange((x - r - 0.06, y, z0 + 0.35), "X", 0.1, bolts=12)
    for dx in (-0.4, 0.4):
        acyl(0.05, 0.18, (x + dx, y - r - 0.08, z0 + 0.2), "Y", segs=12, surf="paint_white")
        flange((x + dx, y - r - 0.17, z0 + 0.2), "Y", 0.05, bolts=8)
    nameplate((x + math.cos(-0.9) * (r + 0.005), y + math.sin(-0.9) * (r + 0.005), z0 + 0.8), 0.28, 0.14, rotz=-0.9 + math.pi / 2)
    ball(0.035, (x + r * 1.04, y, zt + 0.02), surf="Emit_Warm", node="TankLights")

def h_vessel(x, y, z, r, L, surf="paint_white"):
    """Horizontal separator: 2:1 heads, saddles, nozzles with flanges, manway, nameplate."""
    acyl(r, L, (x, y, z), "X", segs=28, surf=surf, cap=False)
    for s in (-1, 1):
        dome(r, (x + s * L / 2, y, z), surf=surf, segs=28, rings=4, squash=0.5, rot=(0, s * math.pi / 2, 0))
        acyl(r * 1.006, 0.014, (x + s * (L / 2 - 0.04), y, z), "X", segs=28, surf="paint_grey", cap=False)
    for xx in (x - L * 0.32, x + L * 0.32):
        box((0.1, r * 1.5, z - r * 0.55 - 0.15), (xx, y, 0.15), surf="paint_grey")
        box((0.16, r * 1.7, 0.03), (xx, y, 0.15), surf="steel_dark", bevel=None)
    for xx in (x - L * 0.25, x + L * 0.05, x + L * 0.3):
        cyl(r * 0.16, r * 0.45, (xx, y, z + r * 0.85), segs=12, surf=surf)
        flange((xx, y, z + r * 1.3), "Z", r * 0.16, bolts=8)
    acyl(r * 0.3, 0.08, (x - L / 2 - r * 0.45, y, z), "X", segs=16, surf=surf)
    flange((x - L / 2 - r * 0.5, y, z), "X", r * 0.28, bolts=12)
    nameplate((x, y - r - 0.006, z), 0.22, 0.1)

def process_module(x, y, w, d, h, z0=0.15):
    skid(x, y, w + 0.1, d + 0.1, z=z0, h=0.05, surf="steel_dark")
    box((w, d, h), (x, y, z0 + 0.05), surf="wall")
    box((w * 1.03, d * 1.03, 0.05), (x, y, z0 + 0.05 + h), surf="roof")
    for f in (-0.3, 0, 0.3):
        box((w * 0.17, 0.012, h * 0.2), (x + f * w, y - d / 2 - 0.006, z0 + 0.05 + h * 0.55), surf="Emit_Warm", node="WindowLights", base=False, bevel=None)
    box((0.14, 0.012, 0.3), (x - w * 0.42, y - d / 2 - 0.006, z0 + 0.05), surf="steel_dark", bevel=None)
    box((0.3, 0.22, 0.12), (x + w * 0.2, y + d * 0.1, z0 + 0.1 + h), surf="paint_grey")
    cyl(0.07, 0.012, (x + w * 0.2, y + d * 0.1, z0 + 0.22 + h), segs=14, surf="grating", bevel=None)
    nameplate((x + w * 0.38, y - d / 2 - 0.006, z0 + 0.05 + h * 0.8), 0.16, 0.07)

def column(x, y, r, h, z0=0.15, ladder_dir=(1, -1)):
    cyl(r * 1.5, 0.12, (x, y, z0), segs=20, surf="concrete")
    cyl(r * 1.05, 0.45, (x, y, z0 + 0.12), segs=24, surf="paint_grey")                 # skirt
    for i in range(8):
        a = 2 * math.pi * i / 8
        cyl(0.008, 0.04, (x + math.cos(a) * r * 1.25, y + math.sin(a) * r * 1.25, z0 + 0.12), segs=6, surf="steel_dark", bevel=None)
    cyl(r, h - 0.45, (x, y, z0 + 0.57), segs=24, surf="cladding", bevel=0.006)
    dome(r, (x, y, z0 + 0.12 + h), surf="cladding", segs=24, rings=3, squash=0.6)
    nd = Vector((ladder_dir[0], ladder_dir[1], 0)).normalized()
    a0 = math.atan2(nd.y, nd.x)
    zz = z0 + 1.1
    while zz < z0 + h - 0.2:
        annulus(r + 0.01, r + 0.22, zz, 0.02, x, y, segs=24, arc=math.pi * 1.2, start=a0 - math.pi * 0.6)
        handrail_ring(x, y, zz + 0.02, r + 0.21, posts=10, arc=math.pi * 1.2, start=a0 - math.pi * 0.6)
        for k in (-0.5, 0.0, 0.5):
            a = a0 + k
            strut((x + math.cos(a) * r, y + math.sin(a) * r, zz - 0.12), (x + math.cos(a) * (r + 0.2), y + math.sin(a) * (r + 0.2), zz), r=0.006, surf="paint_yellow", segs=4)
        zz += 1.1
    ladder(Vector((x, y, z0 + 0.12)) + nd * r, h - 0.2, nd, offset=0.06)
    for zf, ang in ((0.35, 2.4), (0.6, 3.6), (0.85, 1.4)):
        p = Vector((x + math.cos(ang) * r, y + math.sin(ang) * r, z0 + h * zf))
        tip = Vector((x + math.cos(ang) * (r + 0.12), y + math.sin(ang) * (r + 0.12), z0 + h * zf))
        strut(p, tip, r=0.045, surf="paint_grey", segs=12)
        flange(tip, "X" if abs(math.cos(ang)) > abs(math.sin(ang)) else "Y", 0.045, bolts=8)
    top = z0 + 0.12 + h + r * 0.6
    strut((x + r * 0.6, y, top - 0.1), (x + r * 0.6, y, top + 0.35), r=0.012, surf="paint_yellow", segs=6)
    strut((x + r * 0.6, y, top + 0.35), (x + r * 0.6 + 0.3, y, top + 0.35), r=0.01, surf="paint_yellow", segs=6)
    nameplate((x, y - r - 0.005, z0 + 0.4), 0.16, 0.08)
    ball(0.05, (x, y, top + 0.02), surf="Emit_Red", node="AviationLights")

def flare_stack(x, y, h, s=1.0, base=0.0):
    box((0.6 * s, 0.6 * s, 0.1 * s), (x, y, base), surf="concrete")
    for i in range(3):                                                                 # tapered sections
        z0 = base + 0.1 * s + h * i / 3
        r0 = (0.1 - 0.015 * i) * s
        cyl(r0, h / 3, (x, y, z0), segs=14, r2=r0 - 0.015 * s, surf="steel_dark")
        if i:
            flange((x, y, z0), "Z", r0 * 0.9, bolts=10)
    top = base + 0.1 * s + h
    annulus(0.08 * s, 0.32 * s, top - 0.35 * s, 0.02, x, y, segs=20)
    handrail_ring(x, y, top - 0.33 * s, 0.31 * s, posts=10)
    ladder((x + 0.07 * s, y, base + 0.1 * s), h - 0.35 * s, (1, 0, 0), width=0.1, offset=0.04)
    cyl(0.09 * s, 0.25 * s, (x, y, top), segs=16, r2=0.11 * s, surf="steel_dark")      # tip
    for k in range(6):                                                                 # windshield
        a = k * math.pi / 3
        box((0.05 * s, 0.012, 0.18 * s), (x + math.cos(a) * 0.12 * s, y + math.sin(a) * 0.12 * s, top + 0.06 * s), rotz=a + math.pi / 2, surf="steel_dark", bevel=None)
    strut((x - 0.07 * s, y + 0.07 * s, base + 0.2 * s), (x - 0.07 * s, y + 0.07 * s, top + 0.1 * s), r=0.012, surf="galv", segs=6)
    for lvl in (0.45, 0.8):                                                            # guy wires
        for k in range(3):
            a = k * 2 * math.pi / 3 + 0.4
            gx, gy = x + math.cos(a) * h * 0.5, y + math.sin(a) * h * 0.5
            strut((x, y, base + h * lvl), (gx, gy, base + 0.06), r=0.004 + 0.002 * s, surf="galv", segs=4)
            if lvl == 0.45:
                box((0.18 * s, 0.18 * s, 0.08 * s), (gx, gy, base), surf="concrete")
                torus(0.03, 0.006, (gx, gy, base + 0.1 * s), axis="X", surf="galv", seg=8, mseg=3)
    t2 = top + 0.25 * s
    cyl(0.28 * s, 1.3 * s, (x, y, t2), r2=0.02 * s, segs=20, surf="Emit_FlameCore", node="Flame_Core", cap=False)
    cyl(0.12 * s, 0.7 * s, (x, y, t2), r2=0.01 * s, segs=14, surf="Emit_FlameTip", node="Flame_Tip", cap=False)
    ball(0.03 * s, (x + 0.12 * s, y, t2), surf="Emit_Pilot", node="Pilot")
    ball(0.04 * s, (x + 0.11 * s, y, base + h * 0.55), surf="Emit_Red", node="AviationLights")

def rack(x0, y, length, z, pipes, width=0.7, bay=2.4, axis="X", glow=None):
    """Pipe rack: I-beam portals, knee braces, stringers, pipes on shoes with end flanges, cable tray."""
    def P(a, b, zz):
        return Vector((a, y + b, zz)) if axis == "X" else Vector((y + b, a, zz))
    n = max(1, int(round(length / bay)))
    stations = [x0 + length * i / n for i in range(n + 1)]
    for a in stations:
        for s in (-1, 1):
            ibeam(P(a, s * width / 2, 0.15), P(a, s * width / 2, z), h=0.07, w=0.06)
            box((0.12, 0.12, 0.02), P(a, s * width / 2, 0.15), surf="steel_dark", bevel=None)
            strut(P(a, s * width / 2, z - 0.25), P(a, s * (width / 2 - 0.2), z), r=0.01, surf="rack", segs=4)
        ibeam(P(a, -width / 2 - 0.04, z), P(a, width / 2 + 0.04, z), h=0.07, w=0.06)
    for s in (-1, 1):
        ibeam(P(x0, s * width / 2, z), P(x0 + length, s * width / 2, z), h=0.06, w=0.05)
    k = len(pipes)
    for i, (sf, r) in enumerate(pipes):
        off = (i - (k - 1) / 2) * (width * 0.82 / max(1, k - 1))
        acyl(r, length + 0.2, P(x0 + length / 2, off, z + 0.06 + r), axis, segs=14, surf=sf)
        for a in stations:
            pp = P(a, off, z + 0.06)
            pipe_shoe(pp.x, pp.y, pp.z, r, axis=axis)
        for a in (x0 - 0.1, x0 + length + 0.1):
            flange(P(a, off, z + 0.06 + r), axis, r, bolts=8 if r > 0.04 else 6)
        if glow is not None and i == glow:
            acyl(0.006, length + 0.2, P(x0 + length / 2, off, z + 0.06 + 2 * r + 0.004), axis, segs=6, surf="Emit_FlowGlow", node="FlowGlow", bevel=None)
    sz = (length, 0.14, 0.03) if axis == "X" else (0.14, length, 0.03)
    box(sz, P(x0 + length / 2, width / 2 + 0.1, z - 0.12), surf="galv", bevel=None)     # cable tray

def build_cpf1():
    box((14, 11, 0.15), (0, 0, 0), surf="concrete", bevel=0.02)
    for (bx, by, bw, bd) in ((-4.05, 4.95, 5.4, 0.12), (-4.05, -0.15, 5.4, 0.12), (-6.7, 2.4, 0.12, 5.2), (-1.4, 2.4, 0.12, 5.2)):
        box((bw, bd, 0.28), (bx, by, 0.15), surf="concrete")                             # bund walls
    for (x, z) in ((-5.3, -3.6), (-2.8, -3.6), (-5.3, -1.1), (-2.8, -1.1)):
        tank(x, -z)
    for i, z in enumerate((1.6, 2.6, 3.6)):
        y = -z
        h_vessel(-3.6, y, 0.65, 0.32, 2.2)
        acyl(0.05, 0.55, (-5.0, y, 0.5), "X", segs=12, surf="galv")
        gate_valve((-5.4, y, 0.5), "X", 0.06, stem_dir=(0, 0, 1))
        ball(0.2, (-5.4, y, 1.15), surf="Emit_Valve", node=f"InletValve_{i + 1}")
    skid(-3.6, -2.6, 3.0, 3.0, z=0.15, h=0.04, surf="steel_dark")
    for x, z, w, h, d in ((0.3, -3.5, 1.6, 0.9, 1.2), (2.2, -3.5, 1.6, 1.1, 1.2),
                          (0.3, -1.6, 1.6, 0.8, 1.2), (2.2, -1.6, 1.6, 1.3, 1.2), (4.4, -2.6, 1.8, 1.6, 2.6)):
        process_module(x, -z, w, d, h)
    for x, z, r, h in ((0.8, 1.6, 0.26, 3.4), (1.8, 1.9, 0.2, 2.6), (2.6, 1.3, 0.3, 4.2)):
        column(x, -z, r, h)
    box((1.2, 0.9, 0.75), (4.85, -1.4, 0.15), surf="wall")                              # fired heater
    box((1.25, 0.95, 0.04), (4.85, -1.4, 0.9), surf="roof")
    for (sx, sy, sr, sh) in ((4.6, -1.2, 0.16, 3.6), (5.1, -1.6, 0.12, 3.1)):
        cyl(sr, sh, (sx, sy, 0.15), segs=16, surf="steel_dark")
        for k in range(1, 4):
            cyl(sr * 1.12, 0.03, (sx, sy, 0.15 + sh * k / 4), segs=16, surf="paint_grey", cap=False)
        cyl(sr * 1.2, 0.05, (sx, sy, 0.15 + sh - 0.05), segs=16, surf="paint_grey", cap=False)
    box((2.4, 1.4, 0.7), (4.5, -4.1, 0.15), surf="paint_white")                         # control building
    box((2.5, 1.5, 0.06), (4.5, -4.1, 0.85), surf="roof")
    for f in (-0.3, 0, 0.3):
        box((0.35, 0.012, 0.16), (4.5 + f * 2.4, -4.1 + 0.706, 0.53), surf="Emit_Warm", node="WindowLights", base=False, bevel=None)
    box((0.2, 0.012, 0.42), (5.4, -4.1 + 0.706, 0.15), surf="steel_dark", bevel=None)
    for k in (-0.6, 0.6):
        box((0.3, 0.2, 0.14), (4.5 + k, -4.1, 0.91), surf="paint_grey")
    nameplate((3.6, -4.1 + 0.708, 0.75), 0.4, 0.1)
    box((1.6, 1.0, 0.5), (1.8, -4.3, 0.15), surf="wall")                                 # MCC
    box((1.65, 1.05, 0.04), (1.8, -4.3, 0.65), surf="roof")
    for k in range(3):
        box((0.12, 0.08, 0.3), (1.3 + k * 0.4, -4.3 + 0.54, 0.15), surf="paint_grey")
    rack(-1.6, 0.4, 7.2, 0.95, (("galv", 0.06), ("paint_yellow", 0.05), ("galv", 0.045), ("steel_dark", 0.035)))
    rack(-0.6, -1.4, 3.6, 0.95, (("galv", 0.05), ("paint_yellow", 0.04)), axis="Y", width=0.6)
    for x, z in ((-6.6, -5.2), (6.6, -5.2), (-6.6, 5.2), (6.6, 5.2)):
        light_mast(x, -z, 2.2)
    flare_stack(-6.4, -4.6, 5.6, s=1.0, base=0.15)
    return finalize("cpf1")

def compressor_shed(x, y, w=2.0, d=2.6, h=1.0, z0=0.15):
    box((w, d, h), (x, y, z0), surf="wall")
    prism_roof(w, d, 0.35, (x, y, z0 + h), surf="roof")
    box((0.12, d + 0.1, 0.05), (x, y, z0 + h + 0.33), surf="paint_grey")                # ridge vent
    box((0.9, 0.015, 0.75), (x, y - d / 2 - 0.008, z0), surf="steel_dark", bevel=None)   # roller door
    for k in range(9):
        box((0.9, 0.018, 0.006), (x, y - d / 2 - 0.01, z0 + 0.05 + k * 0.08), surf="galv", bevel=None)
    box((0.2, 0.015, 0.42), (x + 0.7, y - d / 2 - 0.008, z0), surf="paint_grey", bevel=None)
    box((1.3, 0.012, 0.11), (x, y - d / 2 - 0.007, z0 + 0.82), surf="Emit_Warm", node="GasLights", base=False, bevel=None)
    for k in range(3):
        for s in (-1, 1):
            box((0.012, 0.35, 0.15), (x + s * (w / 2 + 0.006), y - 0.6 + k * 0.6, z0 + 0.5), surf="steel_dark", bevel=None)
    for k in (-0.55, 0.55):                                                              # exhausts
        cyl(0.11, 0.7, (x + k, y + 0.6, z0 + h + 0.1), segs=14, surf="steel_dark")
        cyl(0.14, 0.03, (x + k, y + 0.6, z0 + h + 0.85), segs=14, surf="steel_dark")
        for j in range(3):
            a = j * 2 * math.pi / 3
            strut((x + k + math.cos(a) * 0.11, y + 0.6 + math.sin(a) * 0.11, z0 + h + 0.78),
                  (x + k + math.cos(a) * 0.11, y + 0.6 + math.sin(a) * 0.11, z0 + h + 0.86), r=0.005, segs=4)
    nameplate((x - 0.7, y - d / 2 - 0.009, z0 + 0.65), 0.3, 0.12)

def sphere_tank(x, y, r=0.75, zc=1.25):
    uvsphere(r, (x, y, zc), surf="paint_white", segs=28, rings=14)
    acyl(r * 1.003, 0.02, (x, y, zc), "Z", segs=36, surf="paint_grey", cap=False)
    for i in range(6):
        a = 2 * math.pi * i / 6
        px, py = x + math.cos(a) * r * 0.98, y + math.sin(a) * r * 0.98
        cyl(0.045, zc - 0.15, (px, py, 0.15), segs=10, surf="paint_grey")
        box((0.12, 0.12, 0.02), (px, py, 0.15), surf="steel_dark", bevel=None)
        b = 2 * math.pi * (i + 1) / 6
        qx, qy = x + math.cos(b) * r * 0.98, y + math.sin(b) * r * 0.98
        strut((px, py, 0.3), (qx, qy, zc - 0.1), r=0.008, surf="galv", segs=4)
        strut((qx, qy, 0.3), (px, py, zc - 0.1), r=0.008, surf="galv", segs=4)
    annulus(0.0, 0.22, zc + r - 0.02, 0.02, x, y, segs=16)
    handrail_ring(x, y, zc + r, 0.21, posts=8)
    ladder((x + r * 0.7, y - r * 0.7, 0.15), zc + r - 0.15, (0.7, -0.7), width=0.12, offset=0.25)
    cyl(0.05, 0.12, (x - 0.1, y, zc + r - 0.02), segs=12, surf="paint_white")
    flange((x - 0.1, y, zc + r + 0.1), "Z", 0.05, bolts=8)
    acyl(0.04, 0.4, (x, y, zc - r - 0.05), "Y", segs=12, surf="galv")
    nameplate((x, y - r * 0.98 - 0.02, 0.6), 0.2, 0.09)

def cooler(x, y, z0=0.15):
    for sx in (-0.45, 0.45):
        for sy in (-0.45, 0.45):
            ibeam((x + sx, y + sy, z0), (x + sx, y + sy, z0 + 0.4), h=0.05, w=0.04)
    box((1.05, 1.05, 0.14), (x, y, z0 + 0.4), surf="galv")
    for k in range(5):
        box((1.07, 0.02, 0.02), (x, y - 0.4 + k * 0.2, z0 + 0.46), surf="steel_dark", bevel=None)
    box((1.05, 1.05, 0.06), (x, y, z0 + 0.54), surf="paint_grey")
    annulus(0.36, 0.42, z0 + 0.6, 0.08, x, y, segs=28, surf="paint_grey")
    box((0.68, 0.02, 0.01), (x, y, z0 + 0.62), surf="grating", rotz=0.4, bevel=None)
    box((0.68, 0.02, 0.01), (x, y, z0 + 0.62), surf="grating", rotz=-0.8, bevel=None)
    cyl(0.06, 0.04, (x, y, z0 + 0.6), segs=12, surf="steel_dark")
    for s in (-1, 1):
        acyl(0.05, 1.1, (x, y + s * 0.55, z0 + 0.42), "X", segs=12, surf="galv")

def build_ag25():
    box((10, 7.5, 0.15), (0, 0, 0), surf="concrete", bevel=0.02)
    for x in (-2.6, -0.2):
        compressor_shed(x, -1.6)
    for x in (2.6, 4.1):
        sphere_tank(x, -2.0)
        ball(0.045, (x, -2.0, 2.15), surf="Emit_Warm", node="GasLights")
    for x, y, r, h in ((-3.2, 1.6, 0.3, 4.6), (-2.2, 1.9, 0.22, 3.6)):
        column(x, y, r, h, ladder_dir=(1, 1))
    for i in range(6):
        cooler(0.5 + (i % 3) * 1.15, -(-2.2 + (i // 3) * 1.15))
    rack(-4.4, 0.2, 8.4, 0.85, (("paint_yellow", 0.06), ("galv", 0.05), ("paint_yellow", 0.04), ("steel_dark", 0.035)))
    skid(-0.9, 2.6, 0.8, 0.8, z=0.15)                                                   # scrubber skid
    cyl(0.22, 1.4, (-0.9, 2.6, 0.21), segs=20, surf="paint_white")
    dome(0.22, (-0.9, 2.6, 1.61), surf="paint_white", segs=20, rings=3, squash=0.5)
    flange((-0.9, 2.6, 1.75), "Z", 0.06, bolts=8)
    gate_valve((-0.5, 2.6, 0.6), "X", 0.05, stem_dir=(0, 0, 1))
    for x, z in ((-4.7, -3.4), (4.7, -3.4), (-4.7, 3.4), (4.7, 3.4)):
        light_mast(x, -z, 2.0)
    flare_stack(4.4, 3.0, 4.2, s=0.7, base=0.15)
    return finalize("ag25")

def build_pipeline_segment():
    L, zc, r = 4.0, 0.32, 0.06
    acyl(r, L - 0.06, (0, 0, zc), "X", segs=20, surf="steel_dark")
    for xx in (-1.0, 0.0, 1.0):                                                           # girth welds
        acyl(r * 1.04, 0.015, (xx, 0, zc), "X", segs=20, surf="galv", cap=False)
    for s in (-1, 1):
        flange((s * (L / 2 - 0.03), 0, zc), "X", r, bolts=8)
    for xx in (-1.0, 1.0):
        box((0.18, 0.5, 0.12), (xx, 0, 0), surf="concrete")
        box((0.08, 0.08, 0.14), (xx, 0, 0.12), surf="steel_dark")
        box((0.16, 0.18, 0.02), (xx, 0, 0.24), surf="steel_dark")
        pipe_shoe(xx, 0, zc - r, r, axis="X")
        for s in (-1, 1):
            cyl(0.01, 0.025, (xx + s * 0.05, 0.2, 0.12), segs=6, surf="steel_dark", bevel=None)
    nameplate((1.6, -r - 0.006, zc), 0.12, 0.05)
    acyl(0.006, L - 0.2, (0, 0, zc + r + 0.004), "X", segs=6, surf="Emit_FlowGlow", node="FlowGlow", bevel=None)
    return finalize("pipeline_segment")

def build_pipe_rack():
    rack(-2.0, 0.0, 4.0, 1.0, (("galv", 0.07), ("paint_yellow", 0.06), ("galv", 0.05), ("steel_dark", 0.04)), width=0.9, bay=4.0, glow=1)
    for xx in (-2.0, 2.0):
        for s in (-1, 1):
            box((0.26, 0.26, 0.15), (xx, s * 0.45, 0), surf="concrete")
            for bx in (-1, 1):
                for by in (-1, 1):
                    cyl(0.008, 0.03, (xx + bx * 0.04, s * 0.45 + by * 0.04, 0.17), segs=6, surf="steel_dark", bevel=None)
    nameplate((-2.0, -0.49, 0.6), 0.1, 0.06)
    return finalize("pipe_rack")

def build_export_marker():
    box((0.5, 0.5, 0.12), (0, 0, 0), surf="concrete", bevel=0.015)
    box((0.14, 0.14, 0.02), (0, 0, 0.12), surf="steel_dark", bevel=None)
    for bx in (-1, 1):
        for by in (-1, 1):
            cyl(0.007, 0.025, (bx * 0.05, by * 0.05, 0.14), segs=6, surf="steel_dark", bevel=None)
    cyl(0.05, 1.7, (0, 0, 0.14), segs=16, surf="paint_yellow")
    for k in range(4):                                                                     # hazard bands
        cyl(0.051, 0.05, (0, 0, 0.3 + k * 0.12), segs=16, surf="paint_red", cap=False)
    box((0.5, 0.03, 0.32), (0, -0.07, 1.2), surf="plate")
    box((0.5, 0.032, 0.08), (0, -0.07, 1.44), surf="paint_red", bevel=0.004)
    for s in (-1, 1):
        box((0.04, 0.05, 0.03), (s * 0.18, -0.03, 1.25), surf="steel_dark", bevel=None)
    box((0.16, 0.12, 0.12), (0, 0.08, 0.9), surf="paint_grey")                            # battery box
    box((0.32, 0.22, 0.015), (0, 0.12, 1.62), surf="glass")                                # solar panel
    strut((0, 0.03, 1.55), (0, 0.12, 1.62), r=0.01, surf="galv", segs=6)
    cyl(0.07, 0.03, (0, 0, 1.84), segs=16, surf="steel_dark")
    cyl(0.06, 0.14, (0, 0, 1.87), segs=16, surf="Emit_Red", node="Beacon")
    for k in range(4):                                                                     # lens cage
        a = k * math.pi / 2 + math.pi / 4
        strut((math.cos(a) * 0.065, math.sin(a) * 0.065, 1.87), (math.cos(a) * 0.065, math.sin(a) * 0.065, 2.02), r=0.004, segs=4)
    cyl(0.07, 0.015, (0, 0, 2.02), segs=16, surf="steel_dark")
    cyl(0.06, 0.4, (0.45, 0.15, 0), segs=12, surf="paint_yellow")                         # CP test station
    cyl(0.075, 0.06, (0.45, 0.15, 0.4), segs=12, surf="steel_dark")
    nameplate((0.45, 0.088, 0.3), 0.06, 0.05)
    return finalize("export_marker")

def build_flare():
    box((1.2, 1.2, 0.1), (0, 0, 0), surf="concrete", bevel=0.015)
    flare_stack(0, 0, 5.6, s=1.0, base=0.1)
    h_vessel(-1.3, 0.9, 0.45, 0.28, 1.3)                                                   # knockout drum
    acyl(0.05, 0.5, (-0.45, 0.9, 0.45), "X", segs=12, surf="paint_yellow")
    strut((-0.2, 0.9, 0.45), (0, 0, 0.35), r=0.05, surf="paint_yellow", segs=12)
    flange((-0.2, 0.9, 0.45), "X", 0.05, bolts=8)
    gate_valve((-1.3, 0.55, 0.2), "Y", 0.04, stem_dir=(0, 0, 1))
    return finalize("flare")

def terrain_mat():
    """Tileable desert sand (4D noise on a torus of the UVs) + contour line mask from height."""
    m = bpy.data.materials.new("S_terrain"); m.use_nodes = True; m.use_fake_user = True
    g = NB(m); bsdf = g.N["Principled BSDF"]
    tc = g.new("ShaderNodeTexCoord")
    ux, uy, _ = g.xyz(tc.outputs["UV"])
    _, _, z = g.xyz(tc.outputs["Object"])
    au, av = g.math("MULTIPLY", ux, 2 * math.pi), g.math("MULTIPLY", uy, 2 * math.pi)
    def torus_noise(R, detail=5, rough=0.55):
        c = g.new("ShaderNodeCombineXYZ")
        g.put(c.inputs[0], g.math("MULTIPLY", g.math("COSINE", au), R))
        g.put(c.inputs[1], g.math("MULTIPLY", g.math("SINE", au), R))
        g.put(c.inputs[2], g.math("MULTIPLY", g.math("COSINE", av), R))
        return g.noise(c.outputs[0], 1.0, detail, rough, w=g.math("MULTIPLY", g.math("SINE", av), R))
    n_big, n_mid, n_fine = torus_noise(1.5), torus_noise(6.0), torus_noise(40.0, 3)
    # wind ripples; integer frequencies keep the tile seamless
    ph = g.math("ADD", g.math("MULTIPLY", g.math("ADD", g.math("MULTIPLY", ux, 160.0), g.math("MULTIPLY", uy, 48.0)), 2 * math.pi), g.math("MULTIPLY", n_mid, 6.0))
    ripple = g.math("MULTIPLY", g.math("ADD", g.math("SINE", ph), 1.0), 0.5)
    pebbles = g.mrange(torus_noise(90.0, 2), 0.66, 0.74)
    col = g.mix(g.mrange(n_big, 0.3, 0.7), rgba("#4f463b"), rgba("#6f6352"))
    col = g.mix(g.math("MULTIPLY", g.mrange(n_mid, 0.5, 0.8), 0.6), col, rgba("#8a7b63"))
    col = g.mix(g.math("MULTIPLY", pebbles, 0.6), col, rgba("#2e2a25"))
    col = g.mix(g.math("MULTIPLY", ripple, 0.12), col, rgba("#9a8a70"), name="OUT_COLOR")
    rough = g.math("ADD", 0.88, g.math("MULTIPLY", g.math("SUBTRACT", n_fine, 0.5), 0.12), clamp=True, name="OUT_ROUGH")
    metal = g.math("MULTIPLY", 0.0, 0.0, name="OUT_METAL")
    height = g.math("ADD", g.math("MULTIPLY", ripple, 0.5), g.math("ADD", g.math("MULTIPLY", n_fine, 0.4), g.math("MULTIPLY", pebbles, 0.6)))
    bump = g.new("ShaderNodeBump"); bump.name = "OUT_BUMP"
    bump.inputs["Strength"].default_value = 0.5; bump.inputs["Distance"].default_value = 0.02
    g.put(bump.inputs["Height"], height)
    def lines(spacing, width):  # contour lines from height
        f = g.math("FRACT", g.math("DIVIDE", z, spacing))
        d = g.math("MINIMUM", f, g.math("SUBTRACT", 1.0, f))
        return g.mrange(d, 0.0, width, 1.0, 0.0)
    contour = g.math("MAXIMUM", g.math("MULTIPLY", lines(0.06, 0.07), 0.45), lines(0.30, 0.025))
    emc = g.mix(contour, (0, 0, 0, 1), rgba(CYAN), name="OUT_EMIT")
    g.put(bsdf.inputs["Base Color"], col); g.put(bsdf.inputs["Roughness"], rough)
    g.put(bsdf.inputs["Metallic"], metal); g.put(bsdf.inputs["Normal"], bump.outputs["Normal"])
    g.put(bsdf.inputs["Emission Color"], emc); bsdf.inputs["Emission Strength"].default_value = 0.18
    return m

def build_terrain_tile():
    S, N = 40.0, 64
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=N, y_subdivisions=N, size=S)
    o = bpy.context.active_object
    for v in o.data.vertices:
        x, y = v.co.x, v.co.y
        u, w = 2 * math.pi * x / S, 2 * math.pi * y / S          # periodic => tileable
        h = (0.35 * math.sin(u) * math.cos(w) + 0.18 * math.sin(2 * u + 1.3) * math.sin(3 * w + 0.4)
             + 0.08 * math.cos(5 * u + 2 * w) + 0.035 * math.sin(9 * u - 4 * w + 0.7) + 0.02 * math.cos(13 * w + 3 * u))
        v.co.z = 0.6 + h
    o.data.materials.append(terrain_mat())
    o.modifiers.new("Triangulate", "TRIANGULATE")
    for p in o.data.polygons: p.use_smooth = True
    col = bpy.data.collections.new("terrain_tile"); scene.collection.children.link(col)
    root = bpy.data.objects.new("terrain_tile", None); col.objects.link(root)
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o); o.name = "terrain_tile_Body"; o.data.name = o.name; o.parent = root
    return col, o

BUILDERS = [
    ("wellhead", build_wellhead, 1024), ("wellhead_agup", build_wellhead_agup, 1024),
    ("cpf1", build_cpf1, 1024), ("ag25", build_ag25, 1024),
    ("pipeline_segment", build_pipeline_segment, 512), ("pipe_rack", build_pipe_rack, 512),
    ("export_marker", build_export_marker, 512), ("flare", build_flare, 512),
    ("terrain_tile", build_terrain_tile, 1024),
]

# ================================================================ bake
def setup_cycles():
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("GPU setup failed, CPU bake:", e)
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 6
    scene.render.bake.use_clear = True

def gltf_output_group():
    ng = bpy.data.node_groups.get("glTF Material Output")
    if ng: return ng
    ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    ng.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    ng.nodes.new("NodeGroupInput")
    return ng

def select_only(ob):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)

def unwrap(ob):
    select_only(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    except Exception as e:
        print("pack:", e)
    bpy.ops.object.mode_set(mode="OBJECT")

def bake_body(name, ob, size, is_terrain):
    if not is_terrain:
        unwrap(ob)
    select_only(ob)
    imgs = {}
    def img(key, noncolor):
        im = bpy.data.images.new(f"{name}_{key}", size, size, alpha=False)
        im.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
        imgs[key] = im
        return im
    targets = []
    for m in ob.data.materials:
        t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.name = "BAKE_TARGET"
        targets.append((m, t))
    def set_target(im):
        for m, t in targets:
            t.image = im; m.node_tree.nodes.active = t; t.select = True
    def emit_pass(src_name, im):
        set_target(im)
        saved = []
        for m, _ in targets:
            nt = m.node_tree; out = nt.nodes["Material Output"]; src = nt.nodes[src_name]
            sock = NB(m).sock(src.outputs, "Result", "RGBA") if src.bl_idname == "ShaderNodeMix" else src.outputs[0]
            em = nt.nodes.new("ShaderNodeEmission"); nt.links.new(sock, em.inputs["Color"])
            nt.links.new(em.outputs[0], out.inputs["Surface"]); saved.append((m, em))
        scene.cycles.samples = 8
        t0 = time.time(); bpy.ops.object.bake(type="EMIT"); print(f"  bake {src_name} {time.time() - t0:.1f}s", flush=True)
        for m, em in saved:
            nt = m.node_tree
            nt.links.new(nt.nodes["Principled BSDF"].outputs[0], nt.nodes["Material Output"].inputs["Surface"])
            nt.nodes.remove(em)
    emit_pass("OUT_COLOR", img("baseColor", False))
    emit_pass("OUT_ROUGH", img("rough", True))
    emit_pass("OUT_METAL", img("metal", True))
    if is_terrain:
        emit_pass("OUT_EMIT", img("emissive", False))
    set_target(img("normal", True))
    scene.cycles.samples = 8
    t0 = time.time(); bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT"); print(f"  bake normal {time.time() - t0:.1f}s", flush=True)
    set_target(img("ao", True))
    scene.cycles.samples = 32
    t0 = time.time(); bpy.ops.object.bake(type="AO"); print(f"  bake ao {time.time() - t0:.1f}s", flush=True)

    def px(im):
        a = np.empty(size * size * 4, np.float32); im.pixels.foreach_get(a); return a.reshape(-1, 4)
    ao, ro, me = px(imgs["ao"]), px(imgs["rough"]), px(imgs["metal"])
    orm = np.stack([np.clip(0.3 + 0.7 * ao[:, 0], 0, 1), ro[:, 0], me[:, 0], np.ones(len(ao), np.float32)], 1)
    im_orm = img("orm", True); im_orm.pixels.foreach_set(orm.ravel())
    saved = {}
    for key in ("baseColor", "orm", "normal") + (("emissive",) if is_terrain else ()):
        im = imgs[key]
        path = os.path.join(TEX, f"{name}_{key}.webp")
        im.filepath_raw = path; im.file_format = "WEBP"
        try:
            im.save(filepath=path, quality=90)
        except TypeError:
            im.save()
        saved[key] = im
    for k in ("ao", "rough", "metal"):
        bpy.data.images.remove(imgs[k])
    for m, t in targets:
        m.node_tree.nodes.remove(t)

    # final glTF ready material: baseColor + ORM (occlusion R, roughness G, metallic B) + normal
    bm = bpy.data.materials.new("DesertSand" if is_terrain else f"{name}_PBR")
    bm.use_nodes = True
    nt = bm.node_tree; N = nt.nodes; L = nt.links
    b = N["Principled BSDF"]
    t_col = N.new("ShaderNodeTexImage"); t_col.image = saved["baseColor"]
    t_orm = N.new("ShaderNodeTexImage"); t_orm.image = saved["orm"]
    t_nor = N.new("ShaderNodeTexImage"); t_nor.image = saved["normal"]
    sep = N.new("ShaderNodeSeparateColor")
    nmap = N.new("ShaderNodeNormalMap")
    L.new(t_col.outputs["Color"], b.inputs["Base Color"])
    L.new(t_orm.outputs["Color"], sep.inputs[0])
    L.new(sep.outputs[1], b.inputs["Roughness"]); L.new(sep.outputs[2], b.inputs["Metallic"])
    L.new(t_nor.outputs["Color"], nmap.inputs["Color"]); L.new(nmap.outputs[0], b.inputs["Normal"])
    gout = N.new("ShaderNodeGroup"); gout.node_tree = gltf_output_group()
    L.new(sep.outputs[0], gout.inputs["Occlusion"])
    if is_terrain:
        t_em = N.new("ShaderNodeTexImage"); t_em.image = saved["emissive"]
        L.new(t_em.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 0.18   # keeps it a lit PBR material in fieldModels.ts
    ob.data.materials.clear(); ob.data.materials.append(bm)
    for p in ob.data.polygons: p.material_index = 0
    return bm

# ================================================================ export + stats
def tri_count(col):
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in col.objects:
        if o.type == "MESH":
            eo = o.evaluated_get(dg); me = eo.to_mesh(); me.calc_loop_triangles(); n += len(me.loop_triangles)
            eo.to_mesh_clear()
    return n

def bbox(col):
    pts = [o.matrix_world @ Vector(c) for o in col.objects if o.type == "MESH" for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

def export(col, name):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in col.objects: o.select_set(True)
    path = os.path.join(RAW, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_tangents=False, export_image_format="WEBP",
                              export_image_quality=80, export_materials="EXPORT", export_extras=False,
                              export_cameras=False, export_lights=False)
    return path

def only_layer(col):
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = not (lc.collection is col)

# ================================================================ preview
def setup_bloom():
    try:
        scene.render.use_compositing = True
        if hasattr(scene, "compositing_node_group"):
            ng = bpy.data.node_groups.new("NightBloom", "CompositorNodeTree")
            ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
            rl = ng.nodes.new("CompositorNodeRLayers"); gl = ng.nodes.new("CompositorNodeGlare"); out = ng.nodes.new("NodeGroupOutput")
            scene.compositing_node_group = ng
        else:
            scene.use_nodes = True; ng = scene.node_tree
            rl = ng.nodes.get("Render Layers") or ng.nodes.new("CompositorNodeRLayers")
            out = ng.nodes.get("Composite") or ng.nodes.new("CompositorNodeComposite")
            gl = ng.nodes.new("CompositorNodeGlare")
        for attr, val in (("glare_type", "BLOOM"), ("glare_type", "FOG_GLOW")):
            try: setattr(gl, attr, val); break
            except Exception: pass
        for nm, val in (("Type", "Bloom"), ("Threshold", 0.9), ("Strength", 0.6), ("Size", 0.55), ("Quality", "High")):
            s = gl.inputs.get(nm)
            if s is not None:
                try: s.default_value = val
                except Exception as e: print("glare input", nm, e)
        for attr, val in (("threshold", 0.9), ("size", 7), ("quality", "HIGH")):
            try: setattr(gl, attr, val)
            except Exception: pass
        ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
        ng.links.new(gl.outputs["Image"], out.inputs[0])
        print("BLOOM ok", [(i.name, getattr(i, "default_value", None)) for i in gl.inputs if i.name != "Image"])
    except Exception as e:
        print("BLOOM_FAIL", e)

def setup_preview():
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try: scene.render.engine = eng; break
        except TypeError: continue
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = 800, 600, 100
    r.image_settings.file_format = "PNG"
    for attr, val in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)):
        try: setattr(scene.eevee, attr, val)
        except Exception: pass
    try:
        scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception: pass
    world = bpy.data.worlds.new("NavyNight"); world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = rgba("#0a0b10"); bg.inputs["Strength"].default_value = 1.0
    scene.world = world
    stage = bpy.data.collections.new("_preview_stage"); scene.collection.children.link(stage)
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 0, -0.004))
    gp = bpy.context.active_object
    gm = bpy.data.materials.new("PreviewGround"); gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]; gb.inputs["Base Color"].default_value = rgba("#1a1a20"); gb.inputs["Roughness"].default_value = 0.7
    gp.data.materials.append(gm)
    def light(nm, kind, energy, color, rot=None):
        Ld = bpy.data.lights.new(nm, kind); Ld.energy = energy; Ld.color = srgb(color)
        o = bpy.data.objects.new(nm, Ld)
        if rot: o.rotation_euler = rot
        return o
    moon = light("Moon", "SUN", 1.4, "#b9cdf0", rot=(math.radians(55), 0, math.radians(30)))
    rim_c = light("RimCyan", "AREA", 1, CYAN)
    rim_g = light("RimGold", "AREA", 1, GOLD)
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam")); cam.data.lens = 50
    target = bpy.data.objects.new("CamTarget", None)
    for o in (gp, moon, rim_c, rim_g, cam, target):
        for c in list(o.users_collection): c.objects.unlink(o)
        stage.objects.link(o)
    for rl in (rim_c, rim_g):
        tc = rl.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
    t = cam.constraints.new("TRACK_TO"); t.target = target; t.track_axis, t.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    scene.camera = cam
    setup_bloom()
    return dict(cam=cam, target=target, gp=gp, rim_c=rim_c, rim_g=rim_g, stage=stage)

def render_preview(col, name, st):
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = not (lc.collection is col or lc.collection is st["stage"])
    st["gp"].hide_render = name == "terrain_tile"
    mn, mx = bbox(col)
    c = (mn + mx) / 2; rad = (mx - mn).length / 2
    cam = st["cam"]
    dist = rad / math.sin(cam.data.angle_y / 2) * 0.8
    d = Vector((1.0, -1.25, 0.75)).normalized()
    st["target"].location = c; cam.location = c + d * dist; cam.data.clip_end = dist * 20
    e = 12 * rad * rad
    st["rim_c"].location = c + Vector((-1.1, 1.0, 0.6)) * rad * 1.6; st["rim_c"].data.energy = e * 3; st["rim_c"].data.size = rad
    st["rim_g"].location = c + Vector((1.2, 1.1, 0.4)) * rad * 1.6; st["rim_g"].data.energy = e * 2; st["rim_g"].data.size = rad
    path = os.path.join(PREV, name + ".png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path

# ================================================================ main
stats, cols = {}, {}
for name, fn, size in BUILDERS:
    if ONLY and name not in ONLY:
        continue
    t_model = time.time()
    col, body = fn()
    print("GEOMETRY", name, f"{time.time() - t_model:.1f}s", flush=True)
    cols[name] = col
    only_layer(col)
    setup_cycles()
    bake_body(name, body, size, name == "terrain_tile")
    mn, mx = bbox(col)
    glb = export(col, name)
    stats[name] = dict(triangles=tri_count(col), raw_bytes=os.path.getsize(glb), texture_px=size,
                       size_m=[round(mx.x - mn.x, 2), round(mx.z - mn.z, 2), round(mx.y - mn.y, 2)],
                       nodes=sorted(o.name for o in col.objects if o.type == "MESH"))
    print("BUILT", name, stats[name]["triangles"], "tris", stats[name]["raw_bytes"], "bytes", flush=True)
    for o in col.objects:   # free the clean node names for the next model
        o.name = f"{name}:{o.name}"
        if o.data is not None: o.data.name = o.name

st = setup_preview()
for name, col in cols.items():
    p = render_preview(col, name, st)
    stats[name]["preview"] = os.path.relpath(p, ROOT)
    print("RENDERED", p, flush=True)
for lc in bpy.context.view_layer.layer_collection.children:
    lc.exclude = False
with open(os.path.join(SRC, "model_stats_v2_raw.json" if not ONLY else "model_stats_v2_partial.json"), "w") as f:
    json.dump(stats, f, indent=2)
if not ONLY:
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, "night_reveal_models_v2.blend"), compress=True, relative_remap=True)
print("DONE")
