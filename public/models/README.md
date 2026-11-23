# Night Reveal field models (GLB)

Low poly, stylised realistic assets for the Night Reveal 3D field scene, built in
Blender 5.3.0 from `assets/blender/build_models.py` (source file:
`assets/blender/night_reveal_models.blend`, previews in `assets/blender/previews/`).
They are not wired into the scene yet; `src/scene/*` still draws everything procedurally.

Conventions
- glTF binary, +Y up, 1 unit = 1 m in the file, sized to the scene's world units
  (same footprints as `src/scene/facilities/*` and `src/scene/Wells.tsx`), so load at scale 1.
- Origin at base centre, so place each model at `[x, heightAt(x, z), z]`.
- PBR metal/rough materials, no textures. The palette mirrors `facilities/materials.ts`.
- Glowing parts use emissive materials (`KHR_materials_emissive_strength`). For the
  bloom look, swap them for the scene's `hdr()` MeshBasicMaterial with `toneMapped: false`.
- Static geometry is merged per material, so each model is a handful of draw calls.
  Parts the timeline drives are separate named nodes (use `getObjectByName`).
- All files pass the Khronos glTF validator with 0 errors and 0 warnings.

| File | Model | Triangles | Size | W x H x D (m) | Named nodes for the timeline | Intended placement |
|---|---|---:|---:|---|---|---|
| `wellhead.glb` | Producing wellhead: pad, casing head, christmas tree (master, wing and swab valves, handwheels), flowline stub, beacon mast | 912 | 53 KB | 1.48 x 1.10 x 1.24 | `ValveLight`, `Beacon` (cyan oil) | The 25 online wells in `WORLD_WELLS`. Instance it (InstancedMesh per merged mesh) |
| `wellhead_agup.glb` | AGUP well: the same tree plus an ESP/VSD control skid and a gold status ring | 1,032 | 62 KB | 1.68 x 1.10 x 1.64 | `ValveLight`, `Beacon` (amber), `StatusRing` (gold), `PanelLight` | The 7 AGUP wells; ring and beacon go amber to gold on Step 2 |
| `cpf1.glb` | CPF-1: 14 x 11 m pad, 4 crude tanks, 3 separators, inlet valves, process modules, 3 columns, heater stacks and box, control building, MCC, pipe racks, light masts, flare stack | 3,034 | 195 KB | 15.5 x 7.3 x 12.7 | `InletValve_1..3` (red to green on Step 1), `WindowLights`, `TankLights`, `MastLights`, `AviationLights`, `Flame_Core`, `Flame_Tip`, `Pilot` | `CPF_WORLD` (replaces `CPF1.tsx`) |
| `ag25.glb` | AG-25 gas plant: 10 x 7.5 m pad, 2 compressor sheds, 2 spheres, contactor and dehydration columns, 6 fin fan coolers, pipe rack, light masts, flare stack | 2,600 | 140 KB | 11.2 x 5.4 x 7.9 | `GasLights`, `MastLights`, `AviationLights`, `Flame_Core`, `Flame_Tip`, `Pilot` (dark until `gasFlow`) | `AG25_WORLD` (replaces `AG25.tsx`) |
| `pipeline_segment.glb` | 4 m flowline on concrete sleepers with flanged ends, along +X | 180 | 14 KB | 4.0 x 0.41 x 0.5 | none | Repeat along gathering and export routes (rotate to the path) |
| `pipe_rack.glb` | 4 m pipe rack bay: portal frames, knee braces, footings, 4 lines (one yellow gas), along +X | 336 | 26 KB | 4.24 x 1.22 x 1.14 | none | Tile along X for rack runs near CPF-1 and AG-25 |
| `export_marker.glb` | Export line marker post: footing, sign plate with red band, red beacon, test station stub | 192 | 18 KB | 0.78 x 1.99 x 0.5 | `Beacon` (red) | Points along `EXPORT_LINE_WORLD`, and the export tie in |
| `flare.glb` | Standalone 5.6 m flare: tapered guyed mast, tip, flame cones, pilot, knockout drum and inlet header | 348 | 30 KB | 4.5 x 7.25 x 4.17 | `Flame_Core`, `Flame_Tip`, `Pilot`, `AviationLights` | Remote flare beside CPF-1 (same height as `Flare.tsx`) |
| `terrain_tile.glb` | 40 x 40 m tileable desert ground tile (24 x 24 grid, periodic height) | 1,152 | 28 KB | 40 x 1.07 x 40 | none | Optional near field ground or detail patches under facilities |

Total for all nine models: 9,786 triangles and about 565 KB.

Rebuild everything (GLBs, previews, stats and .blend):

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python assets/blender/build_models.py -- "$PWD"
```

Per model stats are written to `assets/blender/model_stats.json`.
