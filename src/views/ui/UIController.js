/**
 * UIController
 * Attaches DOM event listeners and delegates actions to MoleculeViewModel,
 * synchronizing SidebarView and HudView with ViewModel events.
 */
import { SidebarView } from './SidebarView.js';
import { HudView } from './HudView.js';
import { MODiagramView } from './MODiagramView.js';
import { ELEMENT_DEFAULTS } from '../../constants/Elements.js';
import { parseElementFromName } from '../../models/ChemistryMath.js';

export class UIController {
  constructor(viewModel, threeScene = null) {
    this.vm = viewModel;
    this.threeScene = threeScene;
    this.sidebar = new SidebarView();
    this.hud = new HudView();

    this.manualShowOutline = false;
    this.manualShowNodal = false;

    const moContainer = document.getElementById('mo-panel');
    if (moContainer) {
      this.moView = new MODiagramView(moContainer, this.vm);
    } else {
      this.moView = null;
    }

    this.prevSliderPosX = 0;
    this.prevSliderPosY = 0;
    this.prevSliderPosZ = 0;
    this.currentSnapPoints = { x: [], y: [], z: [] };

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
    this.updateRotationSliderSnapTracks(selected);
  }

  /**
   * Coalesce bursts of ViewModel events (a batch edit emits one 'atomUpdated' per atom)
   * into a single DOM refresh per animation frame.
   */
  scheduleRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this.render();
    });
  }

  _subscribeViewModel() {
    this.vm.on('atomAdded', () => this.scheduleRender());
    this.vm.on('atomRemoved', () => this.scheduleRender());
    this.vm.on('atomUpdated', () => this.scheduleRender());
    this.vm.on('selectionChanged', () => this.scheduleRender());
    this.vm.on('bondAdded', () => this.scheduleRender());
    this.vm.on('bondRemoved', () => this.scheduleRender());
    this.vm.on('bondsUpdated', () => this.scheduleRender());
    this.vm.on('bridgeAdded', () => this.scheduleRender());
    this.vm.on('bridgesCleared', () => this.scheduleRender());
    this.vm.on('moleculeReset', () => this.scheduleRender());
    this.vm.on('moleculeRestored', () => this.scheduleRender());
    this.vm.on('chargeChanged', () => this.scheduleRender());
    this.vm.on('formulaUpdated', (info) => this.hud.updateFormula(info));
    this.vm.on('toast', ({ message, icon }) => this.hud.showToast(message, icon));

    this.vm.on('modeChanged', (mode) => {
      this.hud.updateMode(mode);
    });

    this.vm.on('themeChanged', (isLight) => {
      this.hud.updateTheme(isLight);
    });

    this.vm.on('historyChanged', ({ canUndo, canRedo }) => {
      const undoBtn = document.getElementById('undo-btn');
      const redoBtn = document.getElementById('redo-btn');
      if (undoBtn) {
        undoBtn.disabled = !canUndo;
        undoBtn.title = canUndo ? `Undo (Ctrl+Z) [${this.vm.undoStack.length}/3]` : 'Undo (Ctrl+Z)';
      }
      if (redoBtn) {
        redoBtn.disabled = !canRedo;
        redoBtn.title = canRedo ? `Redo (Ctrl+Y) [${this.vm.redoStack.length}/3]` : 'Redo (Ctrl+Y)';
      }
    });

    this.vm.on('quickBuildChanged', ({ elem, orbital }) => {
      this.sidebar.updateQuickBuildButton(elem, orbital);
      this.sidebar.setActiveQuickBuildButton(elem);
      this.sidebar.updateQuickBuildStatus(this.vm);
    });

    this.vm.on('moViewToggled', (isOpen) => {
      const panel = document.getElementById('mo-panel');
      const toggleBtn = document.getElementById('mo-toggle-btn');
      const hudMoBtn = document.getElementById('hud-mo-btn');
      if (panel) {
        if (isOpen) {
          panel.classList.remove('collapsed');
          if (toggleBtn) {
            toggleBtn.classList.add('active');
            toggleBtn.style.background = 'rgba(56, 189, 248, 0.2)';
            toggleBtn.style.color = '#38bdf8';
            toggleBtn.style.borderColor = 'var(--accent-cyan)';
          }
          if (hudMoBtn) {
            hudMoBtn.classList.add('active');
            hudMoBtn.style.background = '';
            hudMoBtn.style.color = '';
          }
          if (this.moView) {
            this.moView.render(this.vm.getMODiagramData());
          }
        } else {
          panel.classList.add('collapsed');
          if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.style.background = '';
            toggleBtn.style.color = '';
            toggleBtn.style.borderColor = '';
          }
          if (hudMoBtn) {
            hudMoBtn.classList.remove('active');
            hudMoBtn.style.background = '';
            hudMoBtn.style.color = '';
          }
        }
        window.dispatchEvent(new Event('resize'));
      }
    });

    this.vm.on('moDiagramUpdated', (data) => {
      if (this.vm.isMOViewOpen && this.moView) {
        this.moView.render(data);
      }
    });
  }

  _bindDOMEvents() {
    // MO Panel Toggle Buttons (Sidebar & Top HUD)
    const moToggleBtn = document.getElementById('mo-toggle-btn');
    if (moToggleBtn) {
      moToggleBtn.addEventListener('click', () => {
        this.vm.toggleMOView();
      });
    }

    const hudMoBtn = document.getElementById('hud-mo-btn');
    if (hudMoBtn) {
      hudMoBtn.addEventListener('click', () => {
        this.vm.toggleMOView();
      });
    }

    // Undo / Redo buttons
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.vm.undo());
    }

    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.vm.redo());
    }

    // Sliders continuous change detection for undo grouping
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('pointerdown', () => this.vm.beginContinuousChange());
      slider.addEventListener('pointerup', () => this.vm.endContinuousChange());
      slider.addEventListener('change', () => this.vm.endContinuousChange());
    });

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
        if (this.threeScene) {
          this.threeScene.resetCamera();
        } else {
          this.vm.setCameraView(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, 0));
          this.vm.showToast('Camera centered', '⟲');
        }
      });
    }

    // Help Modal Toggle (Top Header Button & Modal Elements)
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = document.getElementById('help-modal-close');

    const toggleHelp = () => {
      if (!helpModal) return;
      const isVisible = helpModal.style.display !== 'none';
      helpModal.style.display = isVisible ? 'none' : 'flex';
    };

    if (helpBtn) helpBtn.addEventListener('click', toggleHelp);
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', () => {
      if (helpModal) helpModal.style.display = 'none';
    });
    if (helpModal) {
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
      });
    }

    // Virtual Trackball Controls (Bottom-Right Viewport)
    const tbUp = document.getElementById('tb-up');
    const tbDown = document.getElementById('tb-down');
    const tbLeft = document.getElementById('tb-left');
    const tbRight = document.getElementById('tb-right');
    const tbCenter = document.getElementById('tb-center');
    const tbDisc = document.getElementById('trackball-disc');

    const bindContinuousTrackball = (btn, deltaTheta, deltaPhi) => {
      if (!btn) return;
      let intervalId = null;

      btn.addEventListener('click', () => {
        this.threeScene?.orbitCameraDelta(deltaTheta, deltaPhi);
      });

      btn.addEventListener('pointerdown', (e) => {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
          this.threeScene?.orbitCameraDelta(deltaTheta * 0.4, deltaPhi * 0.4);
        }, 40);
      });

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    };

    bindContinuousTrackball(tbUp, 0, -0.15);
    bindContinuousTrackball(tbDown, 0, 0.15);
    bindContinuousTrackball(tbLeft, -0.15, 0);
    bindContinuousTrackball(tbRight, 0.15, 0);

    if (tbCenter) tbCenter.addEventListener('click', () => {
      if (this.threeScene) this.threeScene.resetCamera();
      else {
        this.vm.setCameraView(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, 0));
        this.vm.showToast('Camera centered', '⟲');
      }
    });

    if (tbDisc) {
      let isTbDragging = false;
      let prevTbX = 0;
      let prevTbY = 0;

      tbDisc.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('trackball-btn')) return;
        isTbDragging = true;
        prevTbX = e.clientX;
        prevTbY = e.clientY;
        tbDisc.setPointerCapture(e.pointerId);
      });

      tbDisc.addEventListener('pointermove', (e) => {
        if (!isTbDragging) return;
        const dx = e.clientX - prevTbX;
        const dy = e.clientY - prevTbY;
        prevTbX = e.clientX;
        prevTbY = e.clientY;
        if (this.threeScene) {
          this.threeScene.orbitCameraDelta(-dx * 0.025, -dy * 0.025);
        }
      });

      const endTbDrag = (e) => {
        if (isTbDragging) {
          isTbDragging = false;
          try { tbDisc.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      tbDisc.addEventListener('pointerup', endTbDrag);
      tbDisc.addEventListener('pointercancel', endTbDrag);
    }

    // Preset Buttons
    document.querySelectorAll('[id^="preset-"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.vm.loadPreset(btn.id);
      });
    });

    // Add Atom Button (header of Manual Atom Addition card)
    const addAtomBtn = document.getElementById('add-atom-btn');
    if (addAtomBtn) {
      addAtomBtn.addEventListener('click', () => {
        const manualCreateBtn = document.getElementById('manual-create-atom-btn');
        if (manualCreateBtn) {
          manualCreateBtn.click();
        }
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

    // Atom Charge Stepper
    const atomChargeMinusBtn = document.getElementById('atom-charge-minus-btn');
    if (atomChargeMinusBtn) {
      atomChargeMinusBtn.addEventListener('click', () => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) {
          const cur = selected.charge || 0;
          this.vm.setAtomCharge(selected.id, cur - 1);
        }
      });
    }

    const atomChargePlusBtn = document.getElementById('atom-charge-plus-btn');
    if (atomChargePlusBtn) {
      atomChargePlusBtn.addEventListener('click', () => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) {
          const cur = selected.charge || 0;
          this.vm.setAtomCharge(selected.id, cur + 1);
        }
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

    // Rotation Sliders with magnetic snap
    const setupRotSlider = (sliderId, axis) => {
      const slider = document.getElementById(sliderId);
      if (!slider) return;
      slider.addEventListener('input', (e) => {
        let deg = parseFloat(e.target.value);

        // Magnetic snap: if dragged within ±3° of an alignment step dot, snap into place
        const snaps = this.currentSnapPoints ? this.currentSnapPoints[axis] : null;
        if (snaps && snaps.length > 0) {
          for (const s of snaps) {
            if (Math.abs(deg - s.angle) <= 3) {
              deg = s.angle;
              slider.value = deg;
              break;
            }
          }
        }

        const rad = deg * (Math.PI / 180);
        this.vm.selectedAtoms.forEach(a => {
          if (axis === 'x') a.rotation.x = rad;
          if (axis === 'y') a.rotation.y = rad;
          if (axis === 'z') a.rotation.z = rad;
          this.vm.updateAtomRotation(a.id, a.rotation.x, a.rotation.y, a.rotation.z);
        });

        const valEl = document.getElementById(`rot-${axis}-val`);
        if (valEl) valEl.textContent = `${Math.round(deg)}°`;
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

    // Orbital Buttons (Applies to all selected atoms in batch, or primary atom)
    document.querySelectorAll('.orbital-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const orb = btn.dataset.orbital;
        if (this.vm.selectedIds.size > 1) {
          this.vm.batchUpdateOrbital(orb);
        } else {
          const selected = this.vm.primarySelectedAtom;
          if (selected) {
            this.vm.updateAtomProperty(selected.id, 'orbitalType', orb);
          }
        }
      });
    });

    // Multiple Selection / Configure Card Buttons
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
    if (multiAlignPBtn) multiAlignPBtn.addEventListener('click', () => this.vm.alignSelectedOrbitals());

    const clearBridgesBtn = document.getElementById('clear-bridges-btn');
    if (clearBridgesBtn) clearBridgesBtn.addEventListener('click', () => this.vm.clearBridges());

    const batchColorInput = document.getElementById('batch-color-input');
    if (batchColorInput) {
      batchColorInput.addEventListener('input', (e) => this.vm.batchUpdateColor(e.target.value));
    }

    // Batch Charge Stepper Buttons
    const batchChargeMinusBtn = document.getElementById('batch-charge-minus-btn');
    if (batchChargeMinusBtn) {
      batchChargeMinusBtn.addEventListener('click', () => {
        this.vm.batchUpdateCharge(-1, true);
      });
    }

    const batchChargePlusBtn = document.getElementById('batch-charge-plus-btn');
    if (batchChargePlusBtn) {
      batchChargePlusBtn.addEventListener('click', () => {
        this.vm.batchUpdateCharge(1, true);
      });
    }


    // Batch Radius Slider
    const batchRadiusSlider = document.getElementById('batch-radius-slider');
    if (batchRadiusSlider) {
      batchRadiusSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.vm.batchUpdateRadius(val);
        const valEl = document.getElementById('batch-radius-val');
        if (valEl) valEl.textContent = val.toFixed(2);
      });
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

    // Manual Build Outline and Nodal Toggle Buttons
    const manualOutlineBtn = document.getElementById('manual-outline-toggle-btn');
    if (manualOutlineBtn) {
      manualOutlineBtn.addEventListener('click', () => {
        this.manualShowOutline = !this.manualShowOutline;
        manualOutlineBtn.textContent = `📐 Outline: ${this.manualShowOutline ? 'ON' : 'OFF'}`;
        manualOutlineBtn.style.color = this.manualShowOutline ? '#84cc16' : '';
        manualOutlineBtn.style.borderColor = this.manualShowOutline ? '#84cc16' : '';
      });
    }

    const manualNodalBtn = document.getElementById('manual-nodal-toggle-btn');
    if (manualNodalBtn) {
      manualNodalBtn.addEventListener('click', () => {
        this.manualShowNodal = !this.manualShowNodal;
        manualNodalBtn.textContent = `⚪ Nodal: ${this.manualShowNodal ? 'ON' : 'OFF'}`;
        manualNodalBtn.style.color = this.manualShowNodal ? '#38bdf8' : '';
        manualNodalBtn.style.borderColor = this.manualShowNodal ? '#38bdf8' : '';
      });
    }

    // Manual Build Chips
    document.querySelectorAll('.elem-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        const color = chip.dataset.color;
        const manualName = document.getElementById('manual-atom-name');
        const manualColor = document.getElementById('manual-atom-color');
        const orbitalSelect = document.getElementById('manual-orbital-select');
        const radiusSlider = document.getElementById('manual-atom-radius');
        const radiusVal = document.getElementById('manual-atom-radius-val');

        if (manualName) manualName.value = this.vm.generateUniqueAtomName(name);
        if (manualColor) manualColor.value = color;

        // Auto-select standard orbital for this element
        if (orbitalSelect) {
          if (name === 'H') orbitalSelect.value = 's';
          else if (name === 'C' || name === 'N') orbitalSelect.value = 'sp3';
          else if (name === 'O') orbitalSelect.value = 'sp2';
          else if (name === 'S' || name === 'P') orbitalSelect.value = 'sp3d';
          else if (name === 'F' || name === 'Cl') orbitalSelect.value = 'pz';
        }

        const defaults = ELEMENT_DEFAULTS[name];
        if (defaults && radiusSlider) {
          radiusSlider.value = defaults.radius;
          if (radiusVal) radiusVal.textContent = defaults.radius.toFixed(2);
        }
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
        const chargeSelect = document.getElementById('manual-atom-charge');

        const rawName = nameInput ? nameInput.value.trim() : '';
        const elemVal = parseElementFromName(rawName || 'C');
        const nameVal = rawName || this.vm.generateUniqueAtomName(elemVal);
        const chargeVal = chargeSelect ? parseInt(chargeSelect.value, 10) : 0;
        const offset = (this.vm.atoms.length * 1.5) % 6;
        const newAtom = this.vm.addAtom({
          name: nameVal,
          element: elemVal,
          color: colorInput ? colorInput.value : (ELEMENT_DEFAULTS[elemVal]?.color || '#334155'),
          radius: radiusSlider ? parseFloat(radiusSlider.value) : (ELEMENT_DEFAULTS[elemVal]?.radius || 0.42),
          orbitalType: orbitalSelect ? orbitalSelect.value : (elemVal === 'H' ? 's' : 'none'),
          charge: chargeVal,
          showArrangement: this.manualShowOutline,
          showNodalPlanes: this.manualShowNodal,
          position: new THREE.Vector3(offset - 2, 0, 0)
        });
        this.vm.selectAtom(newAtom.id);

        // Auto-increment atom name in input for next creation
        if (nameInput) {
          nameInput.value = this.vm.generateUniqueAtomName(elemVal);
        }
      });
    }

    // Manual Charge Select: synchronize with selected atom if one is selected
    const manualChargeSelect = document.getElementById('manual-atom-charge');
    if (manualChargeSelect) {
      manualChargeSelect.addEventListener('change', (e) => {
        const selected = this.vm.primarySelectedAtom;
        if (selected) {
          this.vm.setAtomCharge(selected.id, parseInt(e.target.value, 10));
        }
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

    // Keyboard Shortcuts & Navigation
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isTextInput = (activeTag === 'input' && document.activeElement.type === 'text') || activeTag === 'textarea';

      if (e.key === 'Escape') {
        const helpModal = document.getElementById('help-modal');
        if (helpModal && helpModal.style.display !== 'none') {
          helpModal.style.display = 'none';
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && !isTextInput) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.vm.redo();
          } else {
            this.vm.undo();
          }
          return;
        }

        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          this.vm.redo();
          return;
        }
      }

      if (!isTextInput && activeTag !== 'select') {
        // Mode Switching Hotkeys
        if (e.key === '1' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          this.vm.setInteractionMode('orbit');
          return;
        }
        if (e.key === '2' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          this.vm.setInteractionMode('build');
          return;
        }
        if (e.key === '3' || e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          this.vm.setInteractionMode('box');
          return;
        }

        // MO Diagram Hotkey (4 or M)
        if (e.key === '4' || e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          this.vm.toggleMOView();
          return;
        }

        // Help Modal Hotkey
        if (e.key === 'h' || e.key === 'H' || e.key === '?') {
          e.preventDefault();
          toggleHelp();
          return;
        }

        // Center View
        if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          if (this.threeScene) {
            this.threeScene.resetCamera();
          } else {
            this.vm.setCameraView(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, 0));
            this.vm.showToast('Camera centered', '⟲');
          }
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTextInput || activeTag === 'select') {
          return;
        }
        if (this.vm.selectedIds.size > 0) {
          e.preventDefault();
          this.vm.removeSelectedAtoms();
        }
      }
    });
  }

  updateRotationSliderSnapTracks(atom) {
    const axes = ['x', 'y', 'z'];
    this.currentSnapPoints = { x: [], y: [], z: [] };

    axes.forEach(axis => {
      const track = document.getElementById(`rot-${axis}-snap-track`);
      if (track) track.innerHTML = '';
    });

    if (!atom) return;

    // Find all bonds and bridges connected to this atom
    const atomBonds = this.vm.bonds.filter(b => b.involves ? b.involves(atom.id) : (b.atomAId === atom.id || b.atomBId === atom.id));
    const atomBridges = this.vm.bridges.filter(br => (br.atomAId === atom.id || br.atomBId === atom.id));

    // Only render snap step points if bonds or bridges are already formed
    if (atomBonds.length === 0 && atomBridges.length === 0) return;

    const neighborIds = new Set();
    atomBonds.forEach(b => {
      const nbrId = (b.atomAId === atom.id) ? b.atomBId : b.atomAId;
      if (nbrId) neighborIds.add(nbrId);
    });
    atomBridges.forEach(br => {
      const nbrId = (br.atomAId === atom.id) ? br.atomBId : br.atomAId;
      if (nbrId) neighborIds.add(nbrId);
    });

    const normDeg = (d) => {
      let a = ((d % 360) + 360) % 360;
      if (a > 180) a -= 360;
      return Math.round(a);
    };

    neighborIds.forEach(nbrId => {
      const nbr = this.vm.getAtom(nbrId);
      if (!nbr) return;

      const dx = nbr.position.x - atom.position.x;
      const dy = nbr.position.y - atom.position.y;
      const dz = nbr.position.z - atom.position.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.001) return;

      // Base Euler bond direction angles in degrees
      const angleYZ = Math.round(Math.atan2(dy, dz) * 180 / Math.PI); // X-axis rotation
      const angleXZ = Math.round(Math.atan2(dx, dz) * 180 / Math.PI); // Y-axis rotation
      const angleXY = Math.round(Math.atan2(dy, dx) * 180 / Math.PI); // Z-axis rotation

      const axisMap = {
        x: angleYZ,
        y: angleXZ,
        z: angleXY
      };

      axes.forEach(axis => {
        const base = axisMap[axis];
        // Calculate key alignment angles: sigma (collinear 0° / 180°), pi (perpendicular ±90°)
        const candidates = [
          { angle: normDeg(base), type: 'sigma', desc: 'Direct σ overlap' },
          { angle: normDeg(base + 180), type: 'sigma', desc: 'Opposite σ* alignment' },
          { angle: normDeg(base + 90), type: 'pi', desc: 'Parallel π overlap (+90°)' },
          { angle: normDeg(base - 90), type: 'pi', desc: 'Parallel π overlap (-90°)' }
        ];

        // Also add hybrid trigonal planar step (120°) if applicable
        if (atom.orbitalType === 'sp2' || nbr.orbitalType === 'sp2') {
          candidates.push({ angle: normDeg(base + 120), type: 'hybrid', desc: 'Trigonal planar sp² (120°)' });
          candidates.push({ angle: normDeg(base - 120), type: 'hybrid', desc: 'Trigonal planar sp² (-120°)' });
        }

        candidates.forEach(cand => {
          // Avoid duplicate snap points within 3°
          const exists = this.currentSnapPoints[axis].some(sp => Math.abs(sp.angle - cand.angle) <= 3);
          if (!exists) {
            this.currentSnapPoints[axis].push({
              angle: cand.angle,
              type: cand.type,
              label: `${nbr.name}: ${cand.angle}° (${cand.desc})`
            });
          }
        });
      });
    });

    // Render snap dots into DOM
    axes.forEach(axis => {
      const track = document.getElementById(`rot-${axis}-snap-track`);
      const slider = document.getElementById(`rot-${axis}-slider`);
      if (!track || !slider) return;

      // Sort snap points by angle
      this.currentSnapPoints[axis].sort((a, b) => a.angle - b.angle);

      this.currentSnapPoints[axis].forEach(snap => {
        const pct = ((snap.angle + 180) / 360) * 100;
        const dot = document.createElement('div');
        dot.className = `slider-snap-dot dot-${snap.type}`;
        dot.style.left = `${pct}%`;
        dot.title = `Align with ${snap.label}`;

        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          slider.value = snap.angle;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          this.vm.showToast(`Snapped to ${snap.label}`, '🧲');
        });

        track.appendChild(dot);
      });
    });
  }
}
