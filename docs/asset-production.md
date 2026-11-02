# Next asset-production direction

## Recommendation

Use Blender as the master source for coherent 3D assets, then render a 2.5D isometric/top-down sprite set for the browser game. This preserves the lightweight simulation/client foundation while improving the visual world. Keep the original Blender scenes so the same assets can later export as GLB models if a real 3D renderer becomes worthwhile.

Blender is the authoring tool; it does not automatically turn output into AAA-quality art. The production standard comes from a consistent style guide, deliberate modeling, materials, lighting, animation and in-game review. Image generation remains useful for concepts and material exploration, while Blender gives us controllable geometry, scale, camera and repeatable renders.

## First deliverable: one finished coastal outpost

Build a small cohesive vertical slice before producing hundreds of mismatched objects:

- Ocean, shallows, sand, coastal rock and vegetation terrain families, with repeatable edges and transitions.
- A modular dock kit: straight/corner/end pieces, supports, rails, ramps, ropes and mooring posts.
- Tidal generator, bilge pump, galley, fabricator, rain cistern and crew bunk.
- Resource crates, tools, lights, pipe segments, cables and salvage clutter.
- Three crew designs, consistent scale, walking/working/downed states and equipment silhouettes.
- A lighting/effects pass: water motion, shoreline foam, warm lamps, atmospheric haze and readable weather/flood changes.

Compare the assembled scene to the user's reference, including the gameplay zoom level. Review silhouettes and terrain readability before expanding the set.

## Asset contract

Use metric source scenes with consistent dimensions and world axes. Give modular structures reusable snap points. Keep naming stable (terrain_shore_sand, prop_dock_piling, building_bilge_pump) and do not change simulation/content IDs merely to replace an image.

For sprite export: lock orthographic camera, projection, lighting and object anchors across the entire pack; export transparent PNG/WebP atlases with metadata for cell bounds, ground anchor, scale, animation frames and directions. Include day/night or emissive layers where useful. Isometric assets require a matching projected map renderer and picking conversion; do not drop mismatched camera views into the current top-down grid.

For optional real 3D export: use GLB with shared PBR materials, controlled texture sizes, LODs, simple collision proxies and instancing-friendly meshes. A Three.js/Babylon renderer can consume the same authoritative game state, but needs a separately tested rendering/picking/performance pass.

## Quality gates

- All assets read clearly at the normal gameplay zoom and share a coherent scale, palette and lighting direction.
- Terrain transitions have no visible seams; buildings align with their occupied tiles and selection footprints.
- Transparent edges remain clean; atlases include padding; animations do not jitter around inconsistent anchors.
- Texture/mesh budgets are measured on the intended browser hardware before promising broad mobile support.
- No copyrighted third-party assets are imported without a suitable license. Generated concepts are documented separately from finished production assets.

## Current state

This is the proposed production workflow, not a claim that a Blender asset pack has been modeled or rendered. The game currently uses procedural terrain/crew art plus image-generated portraits and four building sprites. GitHub publication and Vercel deployment remain the active delivery task, with account access actions pending.
