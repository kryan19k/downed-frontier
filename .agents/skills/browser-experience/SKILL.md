---
name: browser-experience
description: Build readable browser rendering, controls, accessible UI, and connection feedback for Drowned Frontier.
---

# Browser experience

Use for map rendering, camera, selection, panels, controls, visual language, and accessibility.

1. Read the presentation direction in `docs/vision.md` and the relevant player flow.
2. Connect UI to authoritative state and pending/rejected command feedback. Interpolation may smooth presentation but never grant resources or ownership.
3. Separate terrain, structures, actors, effects, selection, and labels into manageable rendering layers. Release offscreen assets and event listeners appropriately.
4. Implement camera bounds, zoom-aware labels, clear selection, cost previews, and useful blocked-state explanations.
5. Put important controls and inspectable text in accessible DOM UI. Support keyboard actions, focus, contrast, reduced motion, and non-color danger cues.
6. Handle loading, disconnected, stale, rejected, and restored states visibly. Avoid presenting unsent orders as completed work.
7. Verify actual gameplay on the supported desktop browsers and target viewport sizes. Record visual inspection and input checks when a runnable client exists.

Output: usable player flow, screenshots or observed behavior where available, and known accessibility/browser gaps. Label placeholders; do not imply final art is complete.
