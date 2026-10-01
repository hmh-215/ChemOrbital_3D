/**
 * UIController
 * Attaches DOM event listeners and delegates actions to MoleculeViewModel,
 * synchronizing SidebarView and HudView with ViewModel events.
 */
import { SidebarView } from './SidebarView.js';
import { HudView } from './HudView.js';
import { ELEMENT_DEFAULTS } from '../../constants/Elements.js';

export class UIController {
  constructor(viewModel) {
    this.vm = viewModel;
    this.sidebar = new SidebarView();
    this.hud = new HudView();

    this.prevSliderPosX = 0;
    this.prevSliderPosY = 0;
    this.prevSliderPosZ = 0;

    this._bindDOMEvents();
    this._subscribeViewModel();

    // Initial render
    this.render();
    this.hud.updateMode(this.vm.interactionMode);
    this.hud.updateTheme(this.vm.isLight);
  }

  render() {
    this.sidebar.render(
      this.vm,
      (atomId, isCtrl) => this.vm.selectAtom(atomId, isCtrl),
      (element, isCtrl) => this.vm.selectAtomsByType(element, isCtrl),
      (position, name) => {
        this.vm.setCameraView(null, position);
        this.vm.showToast(`Focused camera on ${name}`, '🔍');
      }
    );

    // Update Top HUD text
    const selected = this.vm.primarySelectedAtom;
    const selectedIds = this.vm.selectedIds;
    if (selected) {
      const toDeg = 180 / Math.PI;
      const degX = Math.round(selected.rotation.x * toDeg);
      const degY = Math.round(selected.rotation.y * toDeg);
      const degZ = Math.round(selected.rotation.z * toDeg);

      if (selectedIds.size > 1) {
        this.hud.updateHudSelectionText(`${selectedIds.size} Atoms Selected • Adjust position, rotation & size in batch`);
      } else {
        this.hud.updateHudSelectionText(
          `${selected.name} • Orbital: [${selected.orbitalType.toUpperCase()}] • Pos: (${selected.position.x.toFixed(1)}, ${selected.position.y.toFixed(1)}, ${selected.position.z.toFixed(1)}) • Rot: (${degX}°, ${degY}°, ${degZ}°)`
        );
      }
    } else {
      this.hud.updateHudSelectionText('No atom selected (Click an atom in 3D)');
    }

    this.hud.updateFormula(this.vm.getMolecularFormulaInfo());
  }

  _subscribeViewModel() {
    this.vm.on('atomAdded', () => this.render());
    this.vm.on('atomRemoved', () => this.render());
    this.vm.on('atomUpdated', () => this.render());
    this.vm.on('selectionChanged', () => this.render());
    this.vm.on('bondAdded', () => this.render());
    this.vm.on('bondRemoved', () => this.render());
    this.vm.on('bondsUpdated', () => this.render());
    this.vm.on('bridgeAdded', () => this.render());
    this.vm.on('bridgesCleared', () => this.render());
    this.vm.on('moleculeReset', () => this.render());
    this.vm.on('formulaUpdated', (info) => this.hud.updateFormula(info));
    this.vm.on('toast', ({ message, icon }) => this.hud.showToast(message, icon));

    this.vm.on('modeChanged', (mode) => {
      this.hud.updateMode(mode);
    });

    this.vm.on('themeChanged', (isLight) => {
      this.hud.updateTheme(isLight);
    });

    this.vm.on('quickBuildChanged', ({ elem, orbital }) => {
      this.sidebar.updateQuickBuildButton(elem, orbital);
      this.sidebar.setActiveQuickBuildButton(elem);
      this.sidebar.updateQuickBuildStatus(this.vm);
    });
  }

  _bindDOMEvents() {
    // Mode switcher buttons
    const modeOrbitBtn = document.getElementById('mode-orbit-btn');
    const modeBuildBtn = document.getElementById('mode-build-btn');
    const modeBoxBtn = document.getElementById('mode-box-btn');

    if (modeOrbitBtn) modeOrbitBtn.addEventListener('click', () => this.vm.setInteractionMode('orbit'));
    if (modeBuildBtn) modeBuildBtn.addEventListener('click', () => this.vm.setInteractionMode('build'));
    if (modeBoxBtn) modeBoxBtn.addEventListener('click', () => this.vm.setInteractionMode('box'));

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.vm.toggleTheme());
    }

    // Camera Center
    const resetCamBtn = document.getElementById('reset-cam-btn');
    if (resetCamBtn) {
      resetCamBtn.addEventListener('click', () => {
        this.vm.setCameraView(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, 0));
        this.vm.showToast('Camera centered', '⟲');
      });
    }

    // Preset Buttons
    document.querySelectorAll('[id^="preset-"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.vm.loadPreset(btn.id);
      });
    });

    // Add Atom Button
    const addAtomBtn = document.getElementById('add-atom-btn');
    if (addAtomBtn) {
      addAtomBtn.addEventListener('click', () => {
        const offset = (this.vm.atoms.length * 1.5) % 6;
        const newAtom = this.vm.addAtom({
          name: 'C' + (this.vm.atoms.length + 1),
          element: 'C',
          color: '#334155',
          radius: 0.42,
          orbitalType: 'none',
          position: new THREE.Vector3(offset - 2, 0, 0)
        });
        this.vm.selectAtom(newAtom.id);
      });
    }

    // Delete Atom Button
    const delAtomBtn = document.getElementById('del-atom-btn');
    if (delAtomBtn) {
      delAtomBtn.addEventListener('click', () => this.vm.removeSelectedAtoms());
    }

    // Duplicate Atom Button
    const dupAtomBtn = document.getElementById('dup-atom-btn');
    if (dupAtomBtn) {
      dupAtomBtn.addEventListener('click', () => this.vm.duplicateSelectedAtom());
    }

    // Clear All Atoms
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.vm.clearAll();
        this.vm.showToast('Cleared canvas', '🧹');
      });
    }

    // Atom Inspector Inputs
    const atomNameInput = document.getElementById('atom-name-input');
    if (atomNameInput) {
      atomNameInput.addEventListener('input', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'name', e.target.value);
      });
    }

    const atomColorInput = document.getElementById('atom-color-input');
    if (atomColorInput) {
      atomColorInput.addEventListener('input', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'color', e.target.value);
      });
    }

    const atomRadiusSlider = document.getElementById('atom-radius-slider');
    if (atomRadiusSlider) {
      atomRadiusSlider.addEventListener('input', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'radius', e.target.value);
      });
    }

    // Position Sliders
    const setupPosSlider = (sliderId, axis) => {
      const slider = document.getElementById(sliderId);
      if (!slider) return;
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const selected = this.vm.primarySelectedAtom;
        if (!selected) return;

        if (this.vm.selectedIds.size === 1) {
          if (axis === 'x') selected.position.x = val;
          if (axis === 'y') selected.position.y = val;
          if (axis === 'z') selected.position.z = val;
          this.vm.updateAtomPosition(selected.id, selected.position.x, selected.position.y, selected.position.z);
        } else {
          // Batch translate
          const prev = (axis === 'x') ? this.prevSliderPosX : (axis === 'y') ? this.prevSliderPosY : this.prevSliderPosZ;
          const delta = val - prev;
          this.vm.selectedAtoms.forEach(a => {
            if (axis === 'x') a.position.x += delta;
            if (axis === 'y') a.position.y += delta;
            if (axis === 'z') a.position.z += delta;
            this.vm.updateAtomPosition(a.id, a.position.x, a.position.y, a.position.z);
          });
          if (axis === 'x') this.prevSliderPosX = val;
          if (axis === 'y') this.prevSliderPosY = val;
          if (axis === 'z') this.prevSliderPosZ = val;
        }
      });
    };
    setupPosSlider('pos-x-slider', 'x');
    setupPosSlider('pos-y-slider', 'y');
    setupPosSlider('pos-z-slider', 'z');

    // Rotation Sliders
    const setupRotSlider = (sliderId, axis) => {
      const slider = document.getElementById(sliderId);
      if (!slider) return;
      slider.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        const rad = deg * (Math.PI / 180);
        this.vm.selectedAtoms.forEach(a => {
          if (axis === 'x') a.rotation.x = rad;
          if (axis === 'y') a.rotation.y = rad;
          if (axis === 'z') a.rotation.z = rad;
          this.vm.updateAtomRotation(a.id, a.rotation.x, a.rotation.y, a.rotation.z);
        });
      });
    };
    setupRotSlider('rot-x-slider', 'x');
    setupRotSlider('rot-y-slider', 'y');
    setupRotSlider('rot-z-slider', 'z');

    // Step Rotation Buttons
    document.querySelectorAll('.rot-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const axis = btn.dataset.axis;
        const deg = parseFloat(btn.dataset.deg);
        this.vm.rotateSelectedAtomsAxisDelta(axis, deg);
      });
    });

    // Checkboxes (Arrangement and Nodal)
    const atomArrangementCheck = document.getElementById('atom-arrangement-check');
    if (atomArrangementCheck) {
      atomArrangementCheck.addEventListener('change', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'showArrangement', e.target.checked);
      });
    }

    const showSelectedOutlineCheck = document.getElementById('show-selected-outline-check');
    if (showSelectedOutlineCheck) {
      showSelectedOutlineCheck.addEventListener('change', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'showArrangement', e.target.checked);
      });
    }

    const atomNodalCheck = document.getElementById('atom-nodal-check');
    if (atomNodalCheck) {
      atomNodalCheck.addEventListener('change', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'showNodalPlanes', e.target.checked);
      });
    }

    const showSelectedNodalCheck = document.getElementById('show-selected-nodal-check');
    if (showSelectedNodalCheck) {
      showSelectedNodalCheck.addEventListener('change', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) this.vm.updateAtomProperty(selected.id, 'showNodalPlanes', e.target.checked);
      });
    }

    // Orbital Buttons
    document.querySelectorAll('.orbital-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const orb = btn.dataset.orbital;
        const selected = this.vm.primarySelectedAtom;
        if (selected) {
          this.vm.updateAtomProperty(selected.id, 'orbitalType', orb);
        }
      });
    });

    // Multiple Selection Card Buttons
    const multiSelectAllBtn = document.getElementById('multi-select-all-btn');
    if (multiSelectAllBtn) multiSelectAllBtn.addEventListener('click', () => this.vm.selectAllAtoms());

    const multiDeselectAllBtn = document.getElementById('multi-deselect-all-btn');
    if (multiDeselectAllBtn) multiDeselectAllBtn.addEventListener('click', () => this.vm.deselectAllAtoms());

    const multiFormCovalentBtn = document.getElementById('multi-form-covalent-btn');
    if (multiFormCovalentBtn) multiFormCovalentBtn.addEventListener('click', () => this.vm.formCovalentBondsForSelected());

    const multiRemoveCovalentBtn = document.getElementById('multi-remove-covalent-btn');
    if (multiRemoveCovalentBtn) multiRemoveCovalentBtn.addEventListener('click', () => this.vm.removeCovalentBondsForSelected());

    const bridgeOrbitalsBtn = document.getElementById('bridge-orbitals-btn');
    if (bridgeOrbitalsBtn) bridgeOrbitalsBtn.addEventListener('click', () => this.vm.bridgeSelectedOrbitals());

    const multiAlignPBtn = document.getElementById('multi-align-p-btn');
    if (multiAlignPBtn) multiAlignPBtn.addEventListener('click', () => this.vm.alignSelectedPOrbitals());

    const clearBridgesBtn = document.getElementById('clear-bridges-btn');
    if (clearBridgesBtn) clearBridgesBtn.addEventListener('click', () => this.vm.clearBridges());

    const batchColorInput = document.getElementById('batch-color-input');
    if (batchColorInput) {
      batchColorInput.addEventListener('input', (e) => this.vm.batchUpdateColor(e.target.value));
    }

    document.querySelectorAll('.batch-orb-btn').forEach(btn => {
      btn.addEventListener('click', () => this.vm.batchUpdateOrbital(btn.dataset.orbital));
    });

    const batchOutlineToggleBtn = document.getElementById('batch-outline-toggle-btn');
    if (batchOutlineToggleBtn) batchOutlineToggleBtn.addEventListener('click', () => this.vm.batchToggleArrangement());

    const batchNodalToggleBtn = document.getElementById('batch-nodal-toggle-btn');
    if (batchNodalToggleBtn) batchNodalToggleBtn.addEventListener('click', () => this.vm.batchToggleNodalPlanes());

    const batchDuplicateBtn = document.getElementById('batch-duplicate-btn');
    if (batchDuplicateBtn) batchDuplicateBtn.addEventListener('click', () => this.vm.duplicateSelectedAtoms());

    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) batchDeleteBtn.addEventListener('click', () => this.vm.removeSelectedAtoms());

    // Quick Build Toolbar Elements
    document.querySelectorAll('.quick-attach-btn').forEach(btn => {
      const elem = btn.dataset.elem;
      btn.addEventListener('click', () => {
        this.vm.cycleQuickBuildElement(elem);
        this.vm.setInteractionMode('build');
      });
    });

    // Manual Build Chips
    document.querySelectorAll('.elem-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        const color = chip.dataset.color;
        const manualName = document.getElementById('manual-atom-name');
        const manualColor = document.getElementById('manual-atom-color');
        if (manualName) manualName.value = name + (this.vm.atoms.length + 1);
        if (manualColor) manualColor.value = color;
      });
    });

    // Manual Build Create Atom Button
    const manualCreateBtn = document.getElementById('manual-create-atom-btn');
    if (manualCreateBtn) {
      manualCreateBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('manual-atom-name');
        const colorInput = document.getElementById('manual-atom-color');
        const radiusSlider = document.getElementById('manual-atom-radius');
        const orbitalSelect = document.getElementById('manual-orbital-select');

        const offset = (this.vm.atoms.length * 1.5) % 6;
        const newAtom = this.vm.addAtom({
          name: nameInput ? nameInput.value : ('C' + (this.vm.atoms.length + 1)),
          color: colorInput ? colorInput.value : '#334155',
          radius: radiusSlider ? parseFloat(radiusSlider.value) : 0.42,
          orbitalType: orbitalSelect ? orbitalSelect.value : 'none',
          position: new THREE.Vector3(offset - 2, 0, 0)
        });
        this.vm.selectAtom(newAtom.id);
      });
    }

    // Orbital Styling Sliders
    const orbScaleSlider = document.getElementById('orbital-scale-slider');
    if (orbScaleSlider) {
      orbScaleSlider.addEventListener('input', (e) => {
        this.vm.setOrbitalScale(e.target.value);
        const valEl = document.getElementById('orbital-scale-val');
        if (valEl) valEl.textContent = parseFloat(e.target.value).toFixed(2);
      });
    }

    const orbOpacitySlider = document.getElementById('orbital-opacity-slider');
    if (orbOpacitySlider) {
      orbOpacitySlider.addEventListener('input', (e) => {
        this.vm.setOrbitalOpacity(e.target.value);
        const valEl = document.getElementById('orbital-opacity-val');
        if (valEl) valEl.textContent = parseFloat(e.target.value).toFixed(2);
      });
    }

    const backLobesCheck = document.getElementById('show-back-lobes-check');
    if (backLobesCheck) {
      backLobesCheck.addEventListener('change', (e) => this.vm.setShowBackLobes(e.target.checked));
    }

    const unhybridPCheck = document.getElementById('show-unhybrid-p-check');
    if (unhybridPCheck) {
      unhybridPCheck.addEventListener('change', (e) => this.vm.setShowUnhybridP(e.target.checked));
    }

    // Keyboard Shortcuts (Delete/Backspace)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          return;
        }
        if (this.vm.selectedIds.size > 0) {
          e.preventDefault();
          this.vm.removeSelectedAtoms();
        }
      }
    });
  }
}
