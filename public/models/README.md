# Night Reveal field models (GLB), v2

Digital twin pass of the nine field assets for the Night Reveal 3D scene, built in
Blender 5.3.0 by `assets/blender/build_models_v2.py` (source: `assets/blender/night_reveal_models_v2.blend`,
baked textures in `assets/blender/textures_v2/`, previews and v1 vs v2 comparisons in
`assets/blender/previews/v2/`). The v1 script, .blend and previews are kept for reference.

## Drop in contract (unchanged from v1)
- Same file names, glTF binary, +Y up, 1 unit = 1 m in the file, sized to the scene's world units
  (`src/scene/facilities/*`, `src/scene/Wells.tsx`), load at scale 1.
- Origin at base centre: place at `[x, heightAt(x, z), z]`. Wellhead flowline stubs still point along +X.
- Same emissive node names (`getObjectByName`), all with `Emit_*` materials so `fieldModels.ts`
  turns them into unlit `toneMapped: false` HDR materials for bloom.
- New in v2: each emissive node's pivot sits at its own base centre, so scaling `Flame_Core` /
  `Flame_Tip` in Y (the flicker) grows the flame up from the tip of the stack instead of squashing it to the ground.

## Loader requirements
- **Meshopt** (`EXT_meshopt_compression` + `KHR_mesh_quantization`, required): already on.
  `useFieldGLTF` passes `useMeshopt = true` to drei `useGLTF`, and the decoder is bundled (no network).
- **WebP textures** (`EXT_texture_webp`, required): handled natively by three's GLTFLoader, nothing to configure.
- **Draco: not used. KTX2/Basis: not used.** Blender cannot write KTX2, and the scene's KTX2 path depends on
  `public/decoders/basis` plus `registerRenderer`. WebP plus meshopt keeps every file loadable with no extra decoder files.
- No tangents are stored. three.js derives the tangent frame per pixel for the normal maps
  (the validator reports this as an informational warning).

## Materials
- One baked PBR material per model on a single `<model>_Body` mesh (one draw call; instancing friendly for the 32 wells):
  `baseColor` (sRGB WebP), `ORM` (R occlusion, G roughness, B metallic) and a tangent space `normal` map.
  1024 px atlases for the wellheads, CPF-1, AG-25 and terrain; 512 px for pipeline, rack, marker and flare.
- Baked from procedural Blender surfaces: painted steel with chipped edges exposing bare steel, rust streaks
  running down, galvanised spangle with white rust patches, aluminium insulation jackets with seams and dents,
  concrete with cracks, pits and worn edges, grating, ribbed roof and wall sheeting, nameplates and gauges,
  plus dust and sand at the base and on up facing surfaces. The normal map carries rounded edges
  (bevel shader) and the surface relief.
- Roughness and metalness stay in physical ranges (paint 0.45 to 0.6, galvanised 0.4 to 0.75, concrete and sand 0.9 or more)
  so they read under the dark navy, low key night light without blowing out under bloom.
- Holographic palette on the emissive parts: cyan `#4dd0e1` (wellhead beacon and valve light, `FlowGlow`),
  gold `#ffb300` (AGUP beacon, valve light, `PanelLight`, `StatusRing`), red `#ff3333` (aviation lights,
  export marker beacon, inlet valves before Step 1), warm and cool white for windows and masts, orange for flames.
- `terrain_tile`: tileable desert sand (seamless 4D noise, wind ripples, pebbles) with a cyan contour line
  emissive map (minor lines every 6 cm of height, brighter every 30 cm). The material is named `DesertSand` with an
  emissive strength of 0.18, so `fieldModels.ts` keeps it lit PBR rather than turning it unlit. Raise
  `material.emissiveIntensity` in code if the contours should bloom.

## Models

| File | v2 detail | Triangles v1 to v2 | Size v1 to v2 | Textures | Named nodes | Placement |
|---|---|---:|---:|---|---|---|
| `wellhead.glb` | Concrete pad with cellar grating and anchor bolts, casing head with outlets, bolted flanges, lower and upper master, wing and swab gate valves with bonnets, stems and handwheels, choke, gauge, flowline stub on a clamped support, kill line, tree cap with lifting eye, beacon mast with nameplate, bollards | 912 to 8,652 | 53 KB to 765 KB | 1024 | `ValveLight`, `Beacon` (cyan) | The 25 online wells (instanced) |
| `wellhead_agup.glb` | The same tree plus an ESP/VSD skid with grating, a cabinet with louvres, door seam, handle, nameplate and conduit | 1,032 to 9,408 | 62 KB to 787 KB | 1024 | `ValveLight`, `Beacon`, `PanelLight` (gold), `StatusRing` (gold) | The 7 AGUP wells |
| `cpf1.glb` | Bunded tank farm (tank shell courses, wind girders, roof handrails, stair treads, vents, manways and nozzles with bolted flanges, nameplates), 3 separators with 2:1 heads, saddles and nozzles, flanged inlet gate valves, process modules on skids with ribbed walls, roof HVAC and doors, 3 insulated columns with skirts, anchor bolts, platforms, handrails, caged ladders, nozzles and davits, fired heater and banded stacks, control building, MCC, two I-beam pipe racks with knee braces, pipe shoes, U-bolts, end flanges and a cable tray, light masts, guyed flare stack with platform and caged ladder | 3,034 to 45,936 | 195 KB to 1,451 KB | 1024 | `InletValve_1..3`, `WindowLights`, `TankLights`, `MastLights`, `AviationLights`, `Flame_Core`, `Flame_Tip`, `Pilot` | `CPF_WORLD` |
| `ag25.glb` | 2 compressor sheds with ribbed gable roofs, ridge vents, roller and personnel doors, louvres and capped exhausts, 2 spheres on braced legs with top platform, handrail and caged ladder, insulated contactor and dehydration columns, 6 fin fan coolers on I-beam legs with fan rings and headers, pipe rack, scrubber skid with valve, light masts, guyed flare stack | 2,600 to 31,716 | 140 KB to 1,210 KB | 1024 | `GasLights`, `MastLights`, `AviationLights`, `Flame_Core`, `Flame_Tip`, `Pilot` | `AG25_WORLD` |
| `pipeline_segment.glb` | 4 m coated line with girth welds, bolted flanges, concrete sleepers, shoes, U-bolts and anchor bolts, nameplate | 180 to 1,340 | 14 KB to 75 KB | 512 | `FlowGlow` (new, cyan strip on top, hide or animate) | Repeat along gathering and export routes |
| `pipe_rack.glb` | 4 m bay: I-beam portals and stringers, knee braces, base plates and footings with anchor bolts, 4 lines (one yellow gas) on shoes with U-bolts and end flanges, cable tray | 336 to 3,916 | 26 KB to 174 KB | 512 | `FlowGlow` (new, on the gas line) | Tile along X |
| `export_marker.glb` | Footing with base plate and bolts, banded post, sign with red band, solar panel and battery box, caged beacon, cathodic protection test station | 192 to 1,176 | 18 KB to 101 KB | 512 | `Beacon` (red) | Along `EXPORT_LINE_WORLD` |
| `flare.glb` | Three tapered stack sections with bolted joints, top platform with handrail, caged ladder, windshield tip, pilot line, two levels of guy wires to anchors, knockout drum with heads, saddles and nozzles, inlet header and valve | 348 to 7,052 | 30 KB to 267 KB | 512 | `Flame_Core`, `Flame_Tip`, `Pilot`, `AviationLights` | Remote flare beside CPF-1 |
| `terrain_tile.glb` | 40 x 40 m seamless tile (64 x 64 grid) with extra fine relief, sand textures and glowing contours | 1,152 to 8,192 | 28 KB to 435 KB | 1024 + emissive | none | Ground under facilities |

Total for all nine models: 117,388 triangles and 5.14 MB (v1: 9,786 triangles, 565 KB).
Wells are instanced: 25 x 8,652 plus 7 x 9,408 triangles is about 282k triangles for all 32 wellheads.
If the venue PC struggles, the quality profile can fall back to the procedural wells.

Validation (Khronos glTF validator): 0 errors on every file. Warnings, all expected:
`MESH_PRIMITIVE_GENERATED_TANGENT_SPACE` (tangents left out on purpose) and `IMAGE_FEATURES_UNSUPPORTED`
(the validator cannot fully inspect the WebP colour metadata).

## Rebuild

```
# 1. build, bake, export raw GLBs and render previews (about 3 to 5 min on an M5 Pro, Metal GPU)
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python assets/blender/build_models_v2.py -- "$PWD" /path/to/raw
# 2. meshopt compress into public/models, validate, write comparisons and model_stats.json
#    (tools dir: npm i @gltf-transform/cli@4 gltf-validator, and copy assets/blender/validate.js into it)
python3 assets/blender/post_v2.py /path/to/raw /path/to/tools
```
