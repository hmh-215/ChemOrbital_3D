# Review notes (October 2026)

## Changes made (MVVM layout unchanged)
**Light mode default**
- `MoleculeViewModel.isLight = true`; WebGL background/fog read the VM state (`constants/Theme.js`) so the canvas and the DOM agree on first paint. `?theme=dark` URL override added.
- Light theme CSS gaps filled: MO panel, help modal (title was white-on-white). The MO energy diagram canvas deliberately stays dark.
- Things that were invisible on a light background: nodal planes/cones and the VSEPR outline are now theme-aware; hydrogen default colour `#ffffff` -> `#cbd5e1`; default orbital opacity 0.15 -> 0.25.

**Bugs**
- Undo/redo dropped atom `charge` and `phase` (snapshot omitted them).
- Duplicate atom used 2 of the 3 undo slots and lost `phase`.
- Local-axes helper did not follow an atom moved/rotated with the sliders.
- Arrow keys were swallowed while a slider/select was focused.
- `alert()` inside the ViewModel replaced by toasts; atom names were injected as raw HTML (sidebar badge, toast) -> escaped.

**Performance**
- Orbital materials cached per (colour, opacity) instead of one MeshPhysicalMaterial per lobe per rebuild; orbital groups, nuclei and rings are now disposed (previously GPU memory leaked on every edit).
- UI refresh coalesced to one per animation frame (a batch edit used to rebuild the sidebar once per atom).

**Structure**
- Views no longer reach into `vm.model` (`vm.getAtom()`); repeated bond/bridge sync calls in `ThreeSceneView` deduplicated; URL preset handling in `main.js` is table-driven; deprecated `substr` removed.

## Suggestions not applied
- `models/*` still depend on `THREE.Vector3/Euler` (pragmatic, but not a pure domain layer).
- `MoleculeViewModel` (~1400 lines) could split into history / selection / MO-diagram services; `ChemistryMath.js` (1400 lines) and `UIController.js` (950 lines) likewise.
- Render loop draws every frame; could render on demand (controls `change` + VM events).
- Google Fonts are loaded from the web, so the README's "100% offline" claim is not strictly true (fallback fonts work).
- `docs/screenshots` (~5 MB) and `scratch/` need not ship; the screenshots show the old dark UI.
- `renderNeeded` event is emitted but nobody listens.
