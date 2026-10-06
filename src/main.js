/**
 * main.js
 * Application entry point for ChemOrbital 3D.
 * Bootstraps MVVM architecture: Model, ViewModel, ThreeSceneView, and UIController.
 */
import { MoleculeViewModel } from './viewmodels/MoleculeViewModel.js';
import { ThreeSceneView } from './views/three/ThreeSceneView.js';
import { UIController } from './views/ui/UIController.js';

import * as ChemistryMath from './models/ChemistryMath.js';

// ?preset=<alias> -> preset key understood by MoleculeViewModel.loadPreset()
const URL_PRESET_ALIASES = {
  'c2h4': 'preset-sp2-c2h4', 'sp2-c2h4': 'preset-sp2-c2h4',
  'c2h2': 'preset-sp-c2h2', 'sp-c2h2': 'preset-sp-c2h2',
  'benzene': 'preset-benzene',
  'ch4': 'preset-sp3-ch4', 'sp3-ch4': 'preset-sp3-ch4',
  'd': 'preset-d-orbitals', 'd-orbitals': 'preset-d-orbitals',
  'so2': 'preset-so2', 'preset-so2': 'preset-so2'
};
const VALID_MODES = ['orbit', 'build', 'box'];

function applyUrlParameters(viewModel) {
  try {
    const params = new URLSearchParams(window.location.search);
    const presetParam = params.get('preset') || params.get('demo');

    if (presetParam === 'antibonding') {
      viewModel.loadPreset('preset-sp2-c2h4');
      viewModel.clearBridges();
      viewModel.rotateSelectedAtomsAxisDelta('x', 180);
      viewModel.bridgeSelectedOrbitals();
    } else if (presetParam && URL_PRESET_ALIASES[presetParam]) {
      viewModel.loadPreset(URL_PRESET_ALIASES[presetParam]);
    }

    const modeParam = params.get('mode');
    if (VALID_MODES.includes(modeParam)) {
      viewModel.setInteractionMode(modeParam);
    }

    // ?theme=dark|light overrides the (light) default
    const themeParam = params.get('theme');
    if (themeParam === 'dark' || themeParam === 'light') {
      viewModel.setTheme(themeParam === 'light');
    }
  } catch (err) {
    console.warn('URL parameter parse error:', err);
  }
}

function init() {
  const container = document.getElementById('viewport-container');
  const marquee = document.getElementById('selection-marquee');

  // 1. ViewModel (owns the Model)
  const viewModel = new MoleculeViewModel();

  // 2. Views
  const threeScene = new ThreeSceneView(container, marquee, viewModel);
  const uiController = new UIController(viewModel, threeScene);

  // Expose global references for testing and the browser console
  window.__app = { viewModel, threeScene, uiController, vm: viewModel, ChemistryMath };
  window.app = window.__app;
  window.vm = viewModel;
  window.ChemistryMath = ChemistryMath;

  // 3. Default state: a single carbon atom with no orbital shown yet
  const defaultAtom = viewModel.addAtom({
    name: 'C1',
    element: 'C',
    color: '#334155',
    radius: 0.42,
    orbitalType: 'none',
    position: new THREE.Vector3(0, 0, 0)
  });
  viewModel.selectAtom(defaultAtom.id);
  viewModel.setInteractionMode('orbit');

  // 4. URL query parameters (presets, mode, theme)
  applyUrlParameters(viewModel);

  // 5. Explicitly synchronize initial theme across 3D scene and UI
  viewModel.emit('themeChanged', viewModel.isLight);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
