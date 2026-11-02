# Reference-led interface and asset pass

The current direction follows the user's supplied game HUD reference: a full-viewport world behind weathered brass-framed, dark industrial overlays. A live survivor roster and colony need meters sit left; resource totals run across the top; contextual orders and inspections sit right; navigation and construction sit at the bottom. Panels do not resize the world canvas. I toggles the command panel and a fullscreen button requests browser fullscreen. Keyboard Tab remains normal focus navigation.

Two image-generated concepts explored Tidelight and Abyssal Brass. The supplied reference then became the primary layout direction. The concept board is preserved in `artifacts/concepts/tidelight-and-abyssal.png`; it is concept art, not a screenshot of implemented 3D graphics.

## Integrated generated assets

- `apps/web/public/art/crew-atlas.png`: three original cinematic portraits for Mara, Ivo, and Sera. Used in the survivor roster, crew inspector, and selection cards.
- `apps/web/public/art/buildings-atlas.png`: transparent 2×2 atlas for the tidal generator, fabricator, galley, and bunk. Used both by the live map renderer and the construction dock. The renderer retains vector fallbacks while images load.

Both atlases were generated with the image tool specifically for this game. CSS/canvas selects atlas cells at runtime; the source images remain intact. Lighting, aged teal metal, brass details, and amber highlights establish the intended asset style.

These assets improve the visual direction; they do not constitute a complete AAA production asset library. Terrain, vegetation, colonist movement sprites, effects, and most structural tiles remain procedural prototype art. Matching the cinematic reference fully requires a coherent environment asset set, lighting/effects work, animation, and performance tuning. The pump, water economy, injuries and other mechanics shown in the reference are not newly implemented by a UI pass.

The UI continues to expose real server values and existing commands. No fake pump controls, water counts, neighbor contracts, or research systems were added to imitate the reference screenshot.
