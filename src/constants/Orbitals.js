/**
 * Orbital constants, color palettes, and textbook metadata
 */

export const COLOR_POS_PHASE = 0xef4444; // Red / Coral (+)
export const COLOR_NEG_PHASE = 0x3b82f6; // Blue (-)
export const COLOR_SELECTION_RING = 0x38bdf8;

// Chemical descriptions for Gen Chem 1 students
export const ORBITAL_DESCRIPTIONS = {
  none: "<strong>Nucleus only:</strong> No electron orbital displayed. Choose an orbital above to view its boundary surface.",
  s: "<strong>s Orbital (l = 0):</strong> Spherically symmetric. Has zero angular nodes. Probability of finding electron is uniform in all directions at distance r.",
  px: "<strong>p<sub>x</sub> Orbital (l = 1, m = ±1):</strong> Dumbbell-shaped oriented along the X-axis. Has 1 angular nodal plane (the YZ plane where ψ = 0). Opposite lobes have opposite mathematical phases (+ / −).",
  py: "<strong>p<sub>y</sub> Orbital (l = 1, m = ±1):</strong> Dumbbell-shaped oriented along the Y-axis. Nodal plane is the XZ plane.",
  pz: "<strong>p<sub>z</sub> Orbital (l = 1, m = 0):</strong> Dumbbell-shaped oriented along the Z-axis. Nodal plane is the XY plane.",
  p_all: "<strong>All 3 p Orbitals (p<sub>x</sub>, p<sub>y</sub>, p<sub>z</sub>):</strong> The degenerate set of 3 p orbitals orthogonal to each other. Combined together with 6 electrons, they form a spherically symmetric subshell.",
  sp: "<strong>sp Hybridization (Linear • 2 Regions):</strong> 2 equivalent hybrid lobes at <strong>180°</strong>. Mixes 1 s and 1 p orbital. Two unhybridized p orbitals remain ready for two π bonds (Acetylene C₂H₂). <em>Toggle 'Geometric Outline' to display the linear arrangement line.</em>",
  sp2: "<strong>sp² Hybridization (Trigonal Planar • 3 Regions):</strong> 3 hybrid lobes in a plane at <strong>120°</strong>. Mixes 1 s and 2 p orbitals. One unhybridized p<sub>z</sub> orbital remains perpendicular for a π bond (Ethylene C₂H₄). <em>Toggle 'Geometric Outline' to display the triangular envelope.</em>",
  sp3: "<strong>sp³ Hybridization (Tetrahedral • 4 Regions):</strong> 4 equivalent hybrid lobes pointing to corners of a regular tetrahedron at <strong>109.5°</strong>. Mixes 1 s and 3 p orbitals (Methane CH₄, Water H₂O). <em>Toggle 'Geometric Outline' to display the tetrahedral envelope.</em>",
  sp3d: "<strong>sp³d Hybridization (Trigonal Bipyramidal • 5 Regions):</strong> 5 hybrid orbitals: 3 equatorial at 120° and 2 axial at 90° (as in PCl₅). <em>Toggle 'Geometric Outline' to display the trigonal bipyramid envelope.</em>",
  sp3d2: "<strong>sp³d² Hybridization (Octahedral • 6 Regions):</strong> 6 equivalent hybrid orbitals pointing along ±X, ±Y, ±Z at 90° (as in SF₆). <em>Toggle 'Geometric Outline' to display the octahedral envelope.</em>",
  dxy: "<strong>d<sub>xy</sub> Orbital (l = 2, m = -2):</strong> 4 cloverleaf lobes lying in the XY plane between the X and Y axes. Has <strong>2 perpendicular nodal planes</strong>: the XZ plane (y = 0) and the YZ plane (x = 0). Opposite quadrants have opposite phases (+ / −).",
  dxz: "<strong>d<sub>xz</sub> Orbital (l = 2, m = +1):</strong> 4 cloverleaf lobes lying in the XZ plane between the X and Z axes. Has <strong>2 perpendicular nodal planes</strong>: the XY plane (z = 0) and the YZ plane (x = 0).",
  dyz: "<strong>d<sub>yz</sub> Orbital (l = 2, m = -1):</strong> 4 cloverleaf lobes lying in the YZ plane between the Y and Z axes. Has <strong>2 perpendicular nodal planes</strong>: the XY plane (z = 0) and the XZ plane (y = 0).",
  dx2y2: "<strong>d<sub>x²-y²</sub> Orbital (l = 2, m = +2):</strong> 4 cloverleaf lobes lying directly ALONG the X and Y coordinate axes. Has <strong>2 perpendicular nodal planes</strong> oriented at 45° bisecting the axes (planes x = y and x = -y).",
  dz2: "<strong>d<sub>z²</sub> Orbital (l = 2, m = 0):</strong> Two dumbbell lobes along the Z axis (+) surrounded by an equatorial donut torus (-) in the XY plane. Has <strong>2 conical nodal surfaces</strong> meeting at the nucleus with half-angle θ = 54.74° (where 3cos²θ - 1 = 0)."
};

// Metadata for Angular Nodal Surfaces (Textbook-Accurate Planes & Cones)
export const NODAL_INFO = {
  px: { count: 1, type: '1 Nodal Plane (YZ)', desc: 'YZ plane (x = 0)' },
  py: { count: 1, type: '1 Nodal Plane (XZ)', desc: 'XZ plane (y = 0)' },
  pz: { count: 1, type: '1 Nodal Plane (XY)', desc: 'XY plane (z = 0)' },
  p_all: { count: 3, type: '3 Nodal Planes', desc: 'XY, YZ, XZ coordinate planes' },
  dxy: { count: 2, type: '2 Nodal Planes', desc: 'XZ (y=0) & YZ (x=0) planes' },
  dxz: { count: 2, type: '2 Nodal Planes', desc: 'XY (z=0) & YZ (x=0) planes' },
  dyz: { count: 2, type: '2 Nodal Planes', desc: 'XY (z=0) & XZ (y=0) planes' },
  dx2y2: { count: 2, type: '2 Nodal Planes', desc: 'Planes at 45° (x±y=0)' },
  dz2: { count: 2, type: '2 Conical Surfaces', desc: 'Cones at θ = 54.74° (3cos²θ - 1 = 0)' }
};

// Metadata for Hybridization & VSEPR Geometric Arrangements
export const ARRANGEMENT_INFO = {
  sp: { name: 'Linear', regions: 2, angle: '180°', desc: 'Linear arrangement connecting 2 lobe tips' },
  sp2: { name: 'Trigonal Planar', regions: 3, angle: '120°', desc: 'Equilateral triangle connecting 3 lobe tips' },
  sp3: { name: 'Tetrahedral', regions: 4, angle: '109.5°', desc: 'Regular tetrahedron connecting 4 lobe tips' },
  sp3d: { name: 'Trigonal Bipyramidal', regions: 5, angle: '90° & 120°', desc: 'Trigonal bipyramid connecting 3 equatorial and 2 axial tips' },
  sp3d2: { name: 'Octahedral', regions: 6, angle: '90°', desc: 'Regular octahedron connecting 6 lobe tips' }
};
