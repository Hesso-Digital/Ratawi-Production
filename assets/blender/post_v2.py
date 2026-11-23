"""Post-process v2 GLBs: meshopt compress (gltf-transform), validate, check node names,
build v1 vs v2 comparison images and write model_stats.json.
Usage: python3 assets/blender/post_v2.py <raw_dir> <tools_dir>"""
import json, os, struct, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.getcwd()
RAW, TOOLS = sys.argv[1], sys.argv[2]
OUT = os.path.join(ROOT, "public", "models")
SRC = os.path.join(ROOT, "assets", "blender")
PREV1, PREV2 = os.path.join(SRC, "previews"), os.path.join(SRC, "previews", "v2")
NAMES = ["wellhead", "wellhead_agup", "cpf1", "ag25", "pipeline_segment", "pipe_rack", "export_marker", "flare", "terrain_tile"]
REQUIRED = {
    "wellhead": ["Beacon", "ValveLight"], "wellhead_agup": ["Beacon", "ValveLight", "StatusRing", "PanelLight"],
    "cpf1": ["InletValve_1", "InletValve_2", "InletValve_3", "Flame_Core", "Flame_Tip", "Pilot", "AviationLights", "MastLights", "WindowLights", "TankLights"],
    "ag25": ["GasLights", "MastLights", "Flame_Core", "Flame_Tip", "Pilot", "AviationLights"],
    "export_marker": ["Beacon"], "flare": ["Flame_Core", "Flame_Tip", "Pilot", "AviationLights"],
    "pipeline_segment": [], "pipe_rack": [], "terrain_tile": [],
}

def gltf_json(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])

def run(cmd):
    r = subprocess.run(cmd, cwd=TOOLS, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout, r.stderr); raise SystemExit(f"failed: {' '.join(cmd)}")
    return r.stdout

raw_stats = json.load(open(os.path.join(SRC, "model_stats_v2_raw.json")))
v1_path = os.path.join(SRC, "model_stats.json")
v1_all = json.load(open(v1_path))
v1 = {k: (v["v1"] if "v1" in v else v) for k, v in v1_all.items()}

stats = {}
for n in NAMES:
    src, dst = os.path.join(RAW, n + ".glb"), os.path.join(OUT, n + ".glb")
    run(["npx", "gltf-transform", "meshopt", src, dst, "--level", "high"])
    rep_raw = json.loads(run(["node", "validate.js", src]))
    rep = json.loads(run(["node", "validate.js", dst]))
    j = gltf_json(dst)
    names = [x.get("name") for x in j["nodes"]]
    missing = [r for r in REQUIRED[n] if r not in names]
    imgs = [(im.get("mimeType"), j["bufferViews"][im["bufferView"]]["byteLength"]) for im in j.get("images", [])]
    tex_bytes = sum(b for _, b in imgs)
    mats = [m.get("name") for m in j.get("materials", [])]
    v2 = dict(raw_stats[n])
    v2.update(bytes=os.path.getsize(dst), texture_bytes=tex_bytes, images=[m for m, _ in imgs],
              materials=mats, validator=dict(errors=rep["errors"], warnings=rep["warnings"], infos=rep["infos"], raw_errors=rep_raw["errors"], raw_warnings=rep_raw["warnings"]),
              extensionsRequired=j.get("extensionsRequired", []), nodes=[x for x in names if x],
              preview=f"assets/blender/previews/v2/{n}.png", compare=f"assets/blender/previews/v2/{n}_v1_vs_v2.jpg")
    stats[n] = dict(v1=v1[n], v2=v2)
    print(f"{n:18s} v1 {v1[n]['triangles']:>6} tris {v1[n]['bytes'] / 1024:7.1f} KB | v2 {v2['triangles']:>6} tris "
          f"{v2['bytes'] / 1024:7.1f} KB (raw {v2['raw_bytes'] / 1024:.0f} KB, tex {tex_bytes / 1024:.0f} KB) "
          f"val E{rep['errors']} W{rep['warnings']} rawE{rep_raw['errors']} rawW{rep_raw['warnings']} missing={missing} req={v2['extensionsRequired']}")
    if rep["errors"] or rep["warnings"] or rep_raw["errors"] or rep_raw["warnings"] or missing:
        print("  ISSUES:", rep.get("messages", [])[:5], rep_raw.get("messages", [])[:5])

    # comparison image
    a = Image.open(os.path.join(PREV1, n + ".png")).convert("RGB")
    b = Image.open(os.path.join(PREV2, n + ".png")).convert("RGB")
    W, H = 800, 600
    im = Image.new("RGB", (W * 2 + 4, H + 44), (10, 11, 16))
    im.paste(a.resize((W, H)), (0, 44)); im.paste(b.resize((W, H)), (W + 4, 44))
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except Exception:
        f = ImageFont.load_default()
    d.text((14, 10), f"v1  {n}.glb  {v1[n]['triangles']:,} tris  {v1[n]['bytes'] / 1024:.0f} KB  flat colours", fill=(200, 205, 215), font=f)
    d.text((W + 18, 10), f"v2  {n}.glb  {v2['triangles']:,} tris  {v2['bytes'] / 1024:.0f} KB  baked PBR", fill=(77, 208, 225), font=f)
    im.save(os.path.join(PREV2, f"{n}_v1_vs_v2.jpg"), quality=90, optimize=True)

total = sum(s["v2"]["bytes"] for s in stats.values())
print(f"TOTAL v2 {total / 1024 / 1024:.2f} MB, {sum(s['v2']['triangles'] for s in stats.values()):,} tris")
json.dump(stats, open(v1_path, "w"), indent=2)
os.remove(os.path.join(SRC, "model_stats_v2_raw.json"))
