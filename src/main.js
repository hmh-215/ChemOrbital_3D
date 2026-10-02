/**
 * main.js
 * Application entry point for ChemOrbital 3D.
 * Bootstraps MVVM architecture: Model, ViewModel, ThreeSceneView, and UIController.
 */
import { MoleculeViewModel } from './viewmodels/MoleculeViewModel.js';
import { ThreeSceneView } from './views/three/ThreeSceneView.js';
import { UIController } from './views/ui/UIController.js';

function init() {
  const container = document.getElementById('viewport-container');
  const marquee = document.getElementById('selection-marquee');

  // 1. Initialize ViewModel
  const viewModel = new MoleculeViewModel();

  // 2. Initialize Views
  const threeScene = new ThreeSceneView(container, marquee, viewModel);
  const uiController = new UIController(viewModel);

  // Expose global reference for testing and browser console
  window.__app = {
    viewModel,
    threeScene,
    uiController,
    vm: viewModel
  };
  window.app = window.__app;
  window.vm = viewModel;

  // 3. Initialize default state: Atom with no orbital showing at first
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

  // 4. URL query parameter support for presets
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const presetParam = urlParams.get('preset') || urlParams.get('demo');
    if (presetParam) {
      if (presetParam === 'c2h4' || presetParam === 'sp2-c2h4') {
        viewModel.loadPreset('preset-sp2-c2h4');
      } else if (presetParam === 'c2h2' || presetParam === 'sp-c2h2') {
        viewModel.loadPreset('preset-sp-c2h2');
      } else if (presetParam === 'benzene') {
        viewModel.loadPreset('preset-benzene');
      } else if (presetParam === 'ch4' || presetParam === 'sp3-ch4') {
        viewModel.loadPreset('preset-sp3-ch4');
      } else if (presetParam === 'd-orbitals' || presetParam === 'd') {
        viewModel.loadPreset('preset-d-orbitals');
      } else if (presetParam === 'so2' || presetParam === 'preset-so2') {
        viewModel.loadPreset('preset-so2');
      } else if (presetParam === 'antibonding') {
        viewModel.loadPreset('preset-sp2-c2h4');
        viewModel.clearBridges();
        const c2 = viewModel.atoms.find(a => a.name === 'C2');
        if (c2) {
          viewModel.rotateSelectedAtomsAxisDelta('x', 180);
        }
        viewModel.bridgeSelectedOrbitals();
      }
    }

    const modeParam = urlParams.get('mode');
    if (modeParam && ['orbit', 'build', 'box'].includes(modeParam)) {
      viewModel.setInteractionMode(modeParam);
    }
  } catch (err) {
    console.warn('URL preset parse error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
