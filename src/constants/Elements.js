/**
 * Element definitions, orbital options, and default visual properties
 */

export const ELEMENT_DEFAULTS = {
  H: { color: '#ffffff', radius: 0.26, defaultOrbital: 's' },
  C: { color: '#334155', radius: 0.42, defaultOrbital: 'sp3' },
  O: { color: '#ef4444', radius: 0.44, defaultOrbital: 'sp3' },
  N: { color: '#3b82f6', radius: 0.40, defaultOrbital: 'sp3' },
  S: { color: '#eab308', radius: 0.48, defaultOrbital: 'sp3d2' },
  P: { color: '#f97316', radius: 0.48, defaultOrbital: 'sp3d' },
  F: { color: '#06b6d4', radius: 0.32, defaultOrbital: 'pz' },
  Cl: { color: '#10b981', radius: 0.36, defaultOrbital: 'pz' }
};

export const ELEMENT_ORBITAL_OPTIONS = {
  H: ['s'],
  C: ['sp3', 'sp2', 'sp'],
  O: ['sp3', 'sp2', 'sp'],
  N: ['sp3', 'sp2', 'sp'],
  S: ['sp3d2', 'sp3', 'sp2', 'sp3d', 'dxz', 'dxy', 'dyz'],
  P: ['sp3d', 'sp3'],
  F: ['pz'],
  Cl: ['pz']
};

export const ELEMENT_ORBITAL_INDEX = {
  H: 0,
  C: 0, // sp3
  O: 0, // sp3
  N: 0, // sp3
  S: 0, // sp3d2
  P: 0, // sp3d
  F: 0, // pz
  Cl: 0 // pz
};

export const ORBITAL_DISPLAY_LABELS = {
  none: 'None',
  s: '1s',
  sp: 'sp',
  sp2: 'sp²',
  sp3: 'sp³',
  sp3d: 'sp³d',
  sp3d2: 'sp³d²',
  px: 'px',
  py: 'py',
  pz: 'pz',
  p_all: 'All p',
  dxy: 'dxy',
  dxz: 'dxz',
  dyz: 'dyz',
  dx2y2: 'dx²-y²',
  dz2: 'dz²'
};
