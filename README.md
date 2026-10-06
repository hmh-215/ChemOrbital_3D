# ChemOrbital 3D - Interactive Chemistry Orbital Visualizer

<p align="center">
  <img src="docs/screenshots/demo_CO2.png" alt="ChemOrbital 3D - Interactive Chemistry Orbital Visualizer" width="860" style="border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />
</p>

<p align="center">
  <strong>An interactive 3D web application designed for General Chemistry students and instructors to visualize atomic and hybridized orbitals, electron phase lobes, VSEPR arrangement envelopes, covalent bonding, and molecular orbital assembly.</strong>
</p>

<p align="center">
  <a href="https://hmh-215.github.io/ChemOrbital_3D/"><img src="https://img.shields.io/badge/Live_Demo-GitHub_Pages-22c55e?style=for-the-badge&logo=githubpages&logoColor=white" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/Architecture-Modular_MVVM-8b5cf6?style=for-the-badge" alt="MVVM Architecture" />
  <img src="https://img.shields.io/badge/JavaScript-ES6_Modules-f59e0b?style=for-the-badge&logo=javascript&logoColor=white" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Three.js-r128_Bundled-0284c7?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
</p>

## 🔬 Scope & Educational Approach

> [!NOTE]
> **A Note on Physical & Mathematical Modeling:**  
> A fully rigorous quantum chemical calculation of electron densities, molecular conformations, and true nodal wavefunctions requires solving the Schrödinger equation via *ab initio* or DFT methods, accounting for electron point probability distributions, electron-electron repulsions, and spin states. Such computations are beyond the scope of this lightweight mini-project.  
> 
> Instead, **ChemOrbital 3D** focuses on **pedagogical visualization**: it provides pre-rendered geometric conformations, analytical orbital lobe shapes, and spatial alignment tools that allow students to interactively "assemble" molecules, visualize hybridizations, and grasp 3D symmetry concepts taught in General Chemistry 1.

---

## 🖱️ Controls Reference

| Action | Control / Shortcut |
| :--- | :--- |
| **Switch Modes** | Press **1** (Demos), **2** (Build), **3** (Configure), or click HUD buttons |
| **Toggle MO Diagram Panel** | Press **4** or click **📊 MO Diagram** |
| **Help & Controls Guide** | Press **H** or **?** or click **❓ Help** in top bar |
| **Undo Last Change** | **Ctrl + Z** (or Cmd + Z, up to 3 reversals) |
| **Redo Undone Change** | **Ctrl + Y** (or Ctrl + Shift + Z / Cmd + Y) |
| **Select Atom** | **Left Click** on atom nucleus |
| **Select All of Same Element** | **Shift + Double Click** on atom or roster badge (e.g. all H, all C, all O) |
| **Toggle Selection (Atom-by-Atom)** | **Ctrl + Left Click** (or Cmd + Click) |
| **Marquee Box Multi-Select** | **Left Drag** on canvas in Build/Configure modes |
| **Delete Selected Atom(s)** | **Delete** or **Backspace** key (or click 🗑️ Delete Atom) |
| **Center / Focus Camera** | **Space** / **R** or click **⟲ Center** in top bar |
| **Interactive 3D Rotation Gizmo** | Drag or click axes rings (+X, +Y, +Z) on bottom-right orientation gizmo |
| **Keyboard Navigation** | **Arrow Keys** to orbit; hold **Right Arrow** to shift scene smoothly |
| **Toggle Theme** | Click **☀️ Light** / **🌙 Dark** in top bar (starts in light mode on boot) |
| **Quick Build Atom Attachment** | In Build Mode, click any orbital lobe, dotted bond line, or ghost green sphere |
| **Cycle Quick Build Orbitals** | **Click active element button again** in Quick Build toolbar (e.g. $sp^3 \to sp^2 \to sp$) |
| **Form Covalent Bond(s)** | Select $\ge 2$ atoms and click **➕ Form Bond(s)** |
| **Remove Covalent Bond(s)** | Select $\ge 2$ atoms and click **➖ Remove Bond(s)** |
| **Overlap / Bridge $\pi$-Orbitals** | Select $\ge 2$ bonded atoms and click **🔗 Form π-Bond Overlap** |
| **Per-Axis Rotation Step & Snap** | Click snap step dots or use slider in Configure mode (snaps to bonding alignment) |
| **Toggle Arrangement Outline** | Click **📐 Geometric Outline** in Manual Add or Configure mode |
| **Toggle Nodal Surfaces** | Click **⚪ Nodal Surfaces** in Manual Add or Configure mode |
| **Pan Camera** | **Right Drag** (or Middle Click Drag) |
| **Zoom In / Out** | **Mouse Scroll Wheel** |

---

## 🎛️ Detailed Panel Functionality

The interface is structured into dedicated panels and interaction modes to keep controls intuitive and organized. Click on any section below to expand details:

<details>
<summary><strong>1. 🧭 Top-Right Mode Switcher & Theme Control</strong></summary>

<br>

- **🔄 Orbit Mode (Default):** A clean observation mode. Sliders, builders, and orbital palettes are hidden so students and instructors can rotate, pan, and zoom around 3D molecules without clutter.
- **🔨 Build Mode:** Displays the full manual and quick-build sidebar panels for adding, transforming, and styling atoms, orbitals, and covalent bonds.
- **⬚ Multiple Selection Mode:** Displays marquee selection controls, batch atom inspector (group position, rotation, and radius sliders), manual covalent bond tools (`➕ Form Bond(s)` / `➖ Remove Bond(s)`), and phase-accurate orbital overlap bridging tools.
- **☀️ Light / 🌙 Dark Mode Toggle (light is the default; append `?theme=dark` to the URL to start in dark):** Seamlessly switch between dark mode (deep space navy `#0b0f19`) and high-contrast light mode (`#f8fafc` with crisp `#0f172a` black text) optimized for classroom projectors and printed handouts.

</details>

<details>
<summary><strong>2. 📚 Teaching Quick-Demos (Visible in Orbit Mode)</strong></summary>

<br>

One-click access to standard textbook molecules and advanced carbon conformations with pre-rendered covalent bonds and orbitals:
- **$CH_4$ (Methane):** Central $sp^3$ Carbon with 4 Hydrogens showing regular tetrahedral $109.5^\circ$ geometry and calibrated $1s$ spheres (Formula: `CH₄`).
- **$C_2H_4$ (Ethylene):** Planar $sp^2$ backbone with parallel $p_z$ orbitals connected by a volumetric $\pi$-bond electron cloud; all four $\text{C}-\text{H}$ covalent bonds pass directly through the axes of the $sp^2$ lobes at $120^\circ$ (Formula: `CH₂=CH₂`).
- **$C_2H_2$ (Acetylene):** Linear $sp$ backbone ($180^\circ$) with two mutually perpendicular in-phase $\pi$ bonds ($\pi_{py}$ and $\pi_{pz}$); hybrid lobes and $\pi$-tubes lie strictly along Cartesian axes (Formula: `HC≡CH`).
- **$\text{SO}_2$ (Sulfur Dioxide):** Bent $120^\circ$ geometry ($sp^2$) featuring simultaneous $p\pi - p\pi$ and $p\pi - d\pi$ resonance back-bonding bridges (Formula: `SO₂`).
- **Benzene ($C_6H_6$):** Planar $sp^2$ hexagonal ring with 3D covalent C-C & C-H bonds, plus continuous delocalized toroidal $\pi$-electron clouds above and below the carbon ring (Formula: `C₆H₆`).
- **Cyclohexane (Chair & Boat):** Visualizes the strain-free $109.5^\circ$ chair conformation (axial vs. equatorial C-H bonds) and the higher-energy boat conformation showing flagpole steric clash (Formula: `C₆H₁₂`).
- **Graphene (3-Layer Honeycomb):** Multilayer hexagonal $sp^2$ lattice with in-plane covalent bonds and vertical dashed interlayer van der Waals coupling lines.
- **$PCl_5$ & $SF_6$:** Demonstrates expanded octets with trigonal bipyramidal ($sp^3d$) and octahedral ($sp^3d^2$) arrangement envelopes.
- **$H_2O$ (Water):** Bent geometry ($104.5^\circ$) showing bonded Hydrogens and lone pair hybrid lobes (Formula: `H₂O`).
- **All 5 $d$-Orbitals:** Side-by-side array of $3d_{xy}, 3d_{xz}, 3d_{yz}, 3d_{x^2-y^2}$, and $3d_{z^2}$ with active coordinate nodal planes and cones.

</details>

<details>
<summary><strong>3. 🧪 Live Molecular Formula HUD (Bottom-Right Viewport)</strong></summary>

<br>

A real-time floating card at the bottom-right corner of the canvas dynamically computes and displays the chemical identity of the structure currently on screen:
- **Structural Chemical Formulas:** Automatically recognizes assembled molecules such as `CO₂` (Carbon Dioxide), `NO₂` (Nitrogen Dioxide), `CH₂=CH₂` (Ethylene), `HC≡CH` (Acetylene), `CH₃–CH₃` (Ethane), `CH₄` (Methane), `C₆H₆` (Benzene), `C₆H₁₂` (Cyclohexane), `H₂O` (Water), `NH₃` (Ammonia), `PCl₅`, and `SF₆`.
- **Hill System Formulation:** Automatically parses any custom user-built molecule into standard Hill notation (Carbon first, Hydrogen second, then alphabetical order) with formatted Unicode subscripts ($₀, ₁, ₂, ₃, \dots$).
- **Interaction Summary:** Reports the active count of covalent bonds, $\pi$-bonding bridges, and antibonding $\pi^*$ nodal planes.

</details>

<details>
<summary><strong>4. 🔨 Build Mode Panels (Quick Build, Manual Atom Tools & Orbital Palette)</strong></summary>

<br>

#### A. ⚡ Quick Build Tool with Multi-Orbital Cycling
- **8 Element Buttons with Live Badges:** Clean toolbar containing one button per element (**H, C, O, N, S, P, F, Cl**) to eliminate clutter.
- **Click-to-Cycle Orbitals:** Repeatedly clicking an active element button cycles through its chemically meaningful orbital selections with live badge and status bar updates:
  - **Carbon (C):** $sp^3 \to sp^2 \to sp \to sp^3$
  - **Oxygen (O):** $sp^3 \to sp^2 \to sp \to sp^3$
  - **Nitrogen (N):** $sp^3 \to sp^2 \to sp \to sp^3$
  - **Sulfur (S):** $sp^3d^2 \to sp^3 \to sp^2 \to sp^3d \to sp^3d^2$
  - **Phosphorus (P):** $sp^3d \to sp^3 \to sp^3d$
  - **Hydrogen (H):** $1s$
  - **Fluorine / Chlorine (F / Cl):** $p$
- **Lobe-Click Attachment:** Left-click directly on any orbital lobe in 3D to instantly attach a bonding atom at the proper covalent distance along that lobe's vector.
- **Auto-Aligned $p$-Orbitals:** Attaching $sp^2$ or $sp$ atoms automatically calculates orientation so unhybridized $p$-orbitals are parallel and in-phase with the parent atom.
- **Automatic 3D Covalent Bonds:** Automatically connects parent and attached atoms with standard 3D cylindrical covalent bonds.

#### B. ➕ Manual Atom Addition
- **+ Add Atom:** Spawns a new atom in the scene with **no orbital displayed (`none`)** by default, allowing students to pick an orbital type later.
- **Element Chips:** Quick presets for Carbon, Hydrogen, Oxygen, Nitrogen, Sulfur, Phosphorus, Fluorine, and Chlorine that set standard CPK colors and atom radii.

#### C. ⚙️ Selected Atom Properties & Dynamic Local Coordinate Axes
- **Dynamic Local Axes Helper:** When an atom is selected, an RGB 3D local coordinate axes helper (Red=+X, Green=+Y, Blue=+Z) attaches directly to and rotates with that atom in real time.
- **Position Sliders (X, Y, Z):** Smooth translation along coordinate axes with live bond updates.
- **Rotation Sliders (X, Y, Z):** Fine-grained rotation from $0^\circ$ to $360^\circ$ around the atom's local axes.
- **Per-Axis Step Rotation Buttons:** Dedicated 3-row grid for precise transformations:
  - **Axis X:** `+90°` | `−90°` | `180°`
  - **Axis Y:** `+90°` | `−90°` | `180°`
  - **Axis Z:** `+90°` | `−90°` | `180°`
  - **Reset Button:** `⟲ Reset (0°)`
  - **Align Button:** `🔄 Align p` (auto-aligns unhybridized $p$-orbital parallel to bonded neighbor)
- **Nucleus Radius Slider:** Adjusts the CPK sphere size.
- **Name & Color Pickers:** Customize individual atom names and display colors.

#### D. 🌐 Atomic & Hybrid Orbital Palette
- **Atomic Orbitals:** `none`, `s` (sized for realistic bond overlap), `px`, `py`, `pz`, `all p`, and all 5 $d$-orbitals.
- **Hybrid Orbitals:** `sp` (Linear, 180°), `sp²` (Trigonal Planar, 120°), `sp³` (Tetrahedral, 109.5°), `sp³d` (Trigonal Bipyramidal), and `sp³d²` (Octahedral).
- **Auto Parallel $p$-Orbital Alignment on Switch:** Switching an atom's orbital to $sp^2$ or $sp$ automatically projects bonded neighbors' orbital vectors and aligns $p$-orbitals strictly parallel and in-phase.
- **VSEPR Geometric Arrangement Outlines:** Toggleable per-atom wireframe dashed edges and translucent facets (tetrahedral, triangular, bipyramidal, octahedral envelopes).
- **Nodal Surfaces:** Toggleable per-atom coordinate nodal planes where $\psi = 0$ (including the conical nodal surfaces for $d_{z^2}$).

</details>

<details>
<summary><strong>5. ⬚ Multiple Selection Mode Panel (Batch Editing, Covalent Bonds & π-Overlap)</strong></summary>

<br>

#### A. Selection Tools
- **Shift + Left Drag:** Draw a 2D rectangular marquee box on the canvas to select multiple atoms.
- **Ctrl + Left Click:** Add or remove atoms from selection one by one.
- **Shift + Double Click:** Automatically selects all atoms in the scene belonging to the same element (e.g. all Hydrogens or all Carbons).

#### B. Manual Covalent Bonding (σ-Bonds)
- **`➕ Form Bond(s)`:** Instantly creates 3D cylindrical covalent bonds between selected atoms (or connects adjacent atoms within bonding distance).
- **`➖ Remove Bond(s)`:** Removes existing covalent bonds between the selected atoms.
- **Live Bond Counter:** Displays the number of active covalent bonds between selected atoms.

#### C. Multi-Atom Inspector & Batch Properties
- When multiple atoms are selected, the Property Inspector remains active:
  - **Group Translations (X, Y, Z):** Moving sliders applies delta offsets $(\Delta X, \Delta Y, \Delta Z)$ to all selected atoms, preserving relative distances and bond lengths.
  - **Group Rotations:** Rotation sliders and the $+90^\circ / -90^\circ / 180^\circ$ step buttons rotate all selected atoms together around their shared center.
  - **Batch Nucleus Sizing & Color:** Scales radii or changes colors of all selected atoms simultaneously.
  - **Batch Hybridization & Outlines:** Apply orbital types, geometric envelopes, or nodal planes in batch.

#### D. ⚡ Phase-Accurate π, p–d, and d–d Overlap & Bridging
- Connects parallel $p$, $d$, or hybrid unhybridized lobes between adjacent bonded atoms:
  - **Positive Phase ($+$):** Red (`#ef4444`)
  - **Negative Phase ($-$):** Blue (`#3b82f6`)
- **`🔄 Align p` Button:** Automatically aligns unhybridized $p$-orbitals and interaction planes of all selected atoms parallel and in-phase.
- **`🔗 Form π-Bond Overlap` Button:**
  - **Physically Realistic Sigma-Bond Adjacency Check:** Only adjacent atoms connected by a covalent $\sigma$-bond form $\pi$-bridges (or adjacent pairs in non-bonded sets), completely preventing unphysical cross-ring chord crossings.
  - **$p - p$ Overlap:** Red-to-Red and Blue-to-Blue connect into continuous volumetric bonding $\pi$-electron clouds (`π(p - p) Bonding`). Opposite phases form an **Antibonding $\pi^*$ state** with a **vertical planar nodal sheet** midway between the nuclei where $\psi^2 = 0$.
  - **$p - d$ Overlap ($p\pi - d\pi$):** Lateral overlap between $d$-orbitals (e.g. $d_{xz}, d_{yz}, d_{xy}$) and $p$-orbitals (or unhybridized $sp/sp^2$ lobes) with curves anchored directly on lobe peaks (`π(d - p) Bonding` / `π*(d - p) Antibonding`). Models resonance in hypervalent species like $\text{SO}_2$.
  - **$d - d$ Overlap:** Detects face-to-face 4-lobe overlap forming quadruplet $\delta$-bond clouds (`δ(d - d) Bonding` / `δ*(d - d) Antibonding`) and in-plane lateral $\pi(d - d)$ overlaps.

</details>

---

## 💻 Tech Stack & Architecture

- **Architecture:** Clean **Model-View-ViewModel (MVVM)** pattern with zero-build native ES6 modules:
  - `src/models/`: Pure chemistry domain state & mathematical algorithms (Hill formula generator, unhybridized $p$-axis extraction, parallel $p$-orbital alignment, VSEPR geometries, bond/bridge topology).
  - `src/viewmodels/`: Reactive mediator (`MoleculeViewModel`) emitting decoupled events for selections, batch modifications, preset loading, and topological transformations.
  - `src/views/`: 3D WebGL managers (`ThreeSceneView`, `AtomMeshManager`, `OrbitalMeshFactory`, `BondMeshManager`, `BridgeMeshManager`) and 2D DOM managers (`UIController`, `SidebarView`, `HudView`).
  - `css/`: Modular stylesheets (`main.css`, `sidebar.css`, `hud.css`, `theme.css`).
  - `lib/`: Vendored local Three.js r128 & OrbitControls for instantaneous 100% offline capability.
- **Zero Build Step:** Runs natively in any modern browser and GitHub Pages without requiring Node.js, npm, bundlers, or compilation steps.
