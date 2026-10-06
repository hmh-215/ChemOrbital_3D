/**
 * MoleculeViewModel
 * Mediator between chemistry domain models (MoleculeModel, AtomModel, BondModel, BridgeModel)
 * and view components (ThreeSceneView, SidebarView, HudView).
 */
import { EventEmitter } from '../core/EventEmitter.js';
import { MoleculeModel } from '../models/MoleculeModel.js';
import { AtomModel } from '../models/AtomModel.js';
import {
  parseElementFromName,
  getAtomUnhybridAxes,
  alignAtomWithBondedNeighbors,
  calculateAttachment,
  calculateRepulsionOptimizedRotation,
  computeMolecularFormula,
  detectOrbitalOverlaps,
  alignOrbitalsForOverlap,
  getOrbitalOverlapCompatibility
} from '../models/ChemistryMath.js';
import {
  ELEMENT_DEFAULTS,
  ELEMENT_ORBITAL_OPTIONS,
  ELEMENT_ORBITAL_INDEX,
  ORBITAL_DISPLAY_LABELS
} from '../constants/Elements.js';
import { ARRANGEMENT_INFO, NODAL_INFO } from '../constants/Orbitals.js';
import { PRESET_DEFINITIONS } from '../constants/Presets.js';
import {
  calculateValenceElectrons,
  buildAtomicOrbitalDiagram,
  buildDiatomicMODiagram,
  buildPolyatomicMODiagram,
  getMOExplanationText
} from '../models/MolecularOrbitalEngine.js';

export class MoleculeViewModel extends EventEmitter {
  constructor() {
    super();
    this.model = new MoleculeModel();

    // Application state
    this.interactionMode = 'orbit'; // 'orbit', 'build', 'box'
    this.isLight = true; // light theme is the default (projector / handout friendly)
    this.quickBuildElem = 'H';
    this.quickBuildOrbital = 's';
    this.orbitalScale = 1.0;
    this.orbitalOpacity = 0.25; // a little denser than 0.15 so lobes read well on a light background
    this.showBackLobes = false;
    this.showUnhybridP = true;
    this.elementOrbitalIndex = { ...ELEMENT_ORBITAL_INDEX };

    // Molecular Orbital (MO) State & Charge
    this.molecularCharge = 0;
    this.isMOViewOpen = false;
    this.moViewMode = 'auto'; // 'auto', 'molecular', 'localized'
    this.activePresetKey = null;
    this.selectedMOLevelId = null;

    // Undo / Redo history stacks (up to 3 reversals)
    this.undoStack = [];
    this.redoStack = [];
    this._isRestoring = false;
    this._isContinuousChange = false;
  }

  // --- Undo / Redo System (Up to 3 Reversals) ---
  pushUndoSnapshot() {
    if (this._isRestoring || this._isContinuousChange) return;
    const snapshot = this.model.getSnapshot();
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 3) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.emit('historyChanged', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  beginContinuousChange() {
    if (this._isContinuousChange || this._isRestoring) return;
    this.pushUndoSnapshot();
    this._isContinuousChange = true;
  }

  endContinuousChange() {
    this._isContinuousChange = false;
    this.emit('historyChanged', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.showToast('No more actions to undo (max: 3 reversals)', 'ℹ️');
      return false;
    }

    const current = this.model.getSnapshot();
    const target = this.undoStack.pop();
    this.redoStack.push(current);
    if (this.redoStack.length > 3) {
      this.redoStack.shift();
    }

    this._isRestoring = true;
    this.model.restoreSnapshot(target);
    this._isRestoring = false;

    this.emit('moleculeRestored');
    this.emit('historyChanged', { canUndo: this.canUndo, canRedo: this.canRedo });
    this._onStateMutated();
    this.showToast(`Undid action (${this.undoStack.length}/3 remaining)`, '↩️');
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.showToast('No actions to redo', 'ℹ️');
      return false;
    }

    const current = this.model.getSnapshot();
    const target = this.redoStack.pop();
    this.undoStack.push(current);
    if (this.undoStack.length > 3) {
      this.undoStack.shift();
    }

    this._isRestoring = true;
    this.model.restoreSnapshot(target);
    this._isRestoring = false;

    this.emit('moleculeRestored');
    this.emit('historyChanged', { canUndo: this.canUndo, canRedo: this.canRedo });
    this._onStateMutated();
    this.showToast('Redid action', '↪️');
    return true;
  }

  // --- Getters ---
  get atoms() {
    return this.model.atoms;
  }

  get bonds() {
    return this.model.bonds;
  }

  get bridges() {
    return this.model.bridges;
  }

  get selectedIds() {
    return this.model.selectedIds;
  }

  get primarySelectedAtom() {
    return this.model.getPrimarySelectedAtom();
  }

  get selectedAtoms() {
    return this.model.getSelectedAtoms();
  }

  getAtom(atomId) {
    return this.model.getAtom(atomId);
  }

  // --- Mode and Theme ---
  setInteractionMode(mode) {
    if (mode === 'demos') mode = 'orbit';
    if (mode === 'configure') mode = 'box';
    if (this.interactionMode === mode) return;
    this.interactionMode = mode;
    this.emit('modeChanged', mode);
  }

  setTheme(isLight) {
    this.isLight = !!isLight;
    this.emit('themeChanged', this.isLight);
  }

  toggleTheme() {
    this.setTheme(!this.isLight);
  }

  // --- Atom CRUD ---
  addAtom(options = {}) {
    this.pushUndoSnapshot();

    const name = options.name || ('C' + (this.model.atoms.length + 1));
    const element = options.element || parseElementFromName(name);
    const defaults = ELEMENT_DEFAULTS[element] || { color: '#334155', radius: 0.42, defaultOrbital: 'none' };
    const orbitalType = options.orbitalType !== undefined ? options.orbitalType : 'none';
    const position = options.position ? options.position.clone() : new THREE.Vector3(0, 0, 0);

    // If rotation is not explicitly provided, calculate optimal rotation that minimizes electron-pair repulsion
    let rotation = options.rotation ? options.rotation.clone() : null;
    if (!rotation) {
      rotation = calculateRepulsionOptimizedRotation({
        newPos: position,
        orbitalType,
        existingAtoms: this.model.atoms
      });
    }

    const atomData = {
      name,
      element,
      color: options.color || defaults.color,
      radius: options.radius !== undefined ? options.radius : defaults.radius,
      orbitalType,
      charge: options.charge !== undefined ? options.charge : 0,
      phase: options.phase !== undefined ? options.phase : 1,
      showArrangement: options.showArrangement || false,
      showNodalPlanes: options.showNodalPlanes || false,
      position,
      rotation
    };

    const atom = this.model.addAtom(atomData);
    this._updateMolecularChargeFromAtoms();
    this.emit('atomAdded', atom);
    this._onStateMutated();
    return atom;
  }

  removeAtom(atomId) {
    this.pushUndoSnapshot();
    const removed = this.model.removeAtom(atomId);
    if (removed) {
      this.emit('atomRemoved', atomId);
      this._onStateMutated();
    }
    return removed;
  }

  removeSelectedAtoms() {
    const ids = Array.from(this.model.selectedIds);
    if (ids.length === 0) return;

    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    try {
      ids.forEach(id => {
        const removed = this.model.removeAtom(id);
        if (removed) this.emit('atomRemoved', id);
      });
      this._onStateMutated();
    } finally {
      this._isContinuousChange = false;
    }
    this.showToast(`Removed ${ids.length} atom(s)`, '🗑️');
  }

  generateUniqueAtomName(element) {
    const prefix = (element || 'X').toUpperCase();
    const existingNumbers = new Set();
    this.model.atoms.forEach(a => {
      if (a.element && a.element.toUpperCase() === prefix) {
        const match = a.name.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
        if (match) {
          existingNumbers.add(parseInt(match[1], 10));
        }
      }
    });
    let num = 1;
    while (existingNumbers.has(num)) {
      num++;
    }
    return `${prefix}${num}`;
  }

  duplicateSelectedAtom() {
    const selected = this.primarySelectedAtom;
    if (!selected) return;

    const dupPos = selected.position.clone().add(new THREE.Vector3(1.5, 0, 0));
    const dupRot = calculateRepulsionOptimizedRotation({
      newPos: dupPos,
      orbitalType: selected.orbitalType,
      existingAtoms: this.model.atoms
    });

    const newName = this.generateUniqueAtomName(selected.element);
    const copy = this.addAtom({
      name: newName,
      element: selected.element,
      color: selected.color,
      radius: selected.radius,
      charge: selected.charge || 0,
      phase: selected.phase || 1,
      orbitalType: selected.orbitalType,
      showArrangement: selected.showArrangement,
      showNodalPlanes: selected.showNodalPlanes,
      rotation: dupRot,
      position: dupPos
    });
    this.selectAtom(copy.id);
    this.showToast(`Duplicated ${selected.name} as ${newName}`, '📋');
  }

  duplicateSelectedAtoms() {
    const selected = this.selectedAtoms;
    if (selected.length === 0) return;

    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    try {
      selected.forEach(s => {
        const dupPos = s.position.clone().add(new THREE.Vector3(1.5, 0, 0));
        const dupRot = calculateRepulsionOptimizedRotation({
          newPos: dupPos,
          orbitalType: s.orbitalType,
          existingAtoms: this.model.atoms
        });

        const newName = this.generateUniqueAtomName(s.element);
        this.addAtom({
          name: newName,
          element: s.element,
          color: s.color,
          radius: s.radius,
          charge: s.charge || 0,
          phase: s.phase || 1,
          orbitalType: s.orbitalType,
          showArrangement: s.showArrangement,
          showNodalPlanes: s.showNodalPlanes,
          rotation: dupRot,
          position: dupPos
        });
      });
      this._onStateMutated();
    } finally {
      this._isContinuousChange = false;
    }
    this.showToast(`Duplicated ${selected.length} atom(s)`, '📋');
  }

  // --- Selection ---
  selectAtom(atomId, addToSelection = false) {
    this.model.selectAtom(atomId, addToSelection);
    this.emit('selectionChanged', this.model.selectedIds);
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  selectAtomsByType(element, addToSelection = false) {
    this.model.selectAtomsByType(element, addToSelection);
    this.emit('selectionChanged', this.model.selectedIds);
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  selectAllAtoms() {
    this.model.selectAll();
    this.emit('selectionChanged', this.model.selectedIds);
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  deselectAllAtoms() {
    this.model.deselectAll();
    this.emit('selectionChanged', this.model.selectedIds);
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  // --- Property Updates ---
  updateAtomProperty(atomId, prop, value) {
    const atom = this.model.getAtom(atomId);
    if (!atom) return;

    this.pushUndoSnapshot();

    if (prop === 'name') {
      atom.name = value;
      atom.element = parseElementFromName(value);
    } else if (prop === 'color') {
      atom.setColor(value);
    } else if (prop === 'radius') {
      atom.setRadius(parseFloat(value));
    } else if (prop === 'orbitalType') {
      atom.setOrbitalType(value);
      if (value === 'sp2' || value === 'sp') {
        this.alignAtomWithBondedNeighbors(atom);
        const neighbors = this.model.getBondedNeighbors(atom);
        neighbors.forEach(n => {
          if (n.neighbor.orbitalType === 'sp2' || n.neighbor.orbitalType === 'sp') {
            this.alignAtomWithBondedNeighbors(n.neighbor);
            this.emit('atomUpdated', n.neighbor);
          }
        });
      }
    } else if (prop === 'showArrangement') {
      atom.setShowArrangement(value);
    } else if (prop === 'showNodalPlanes') {
      atom.setShowNodalPlanes(value);
    } else if (prop === 'charge') {
      atom.setCharge(parseInt(value, 10) || 0);
      this._updateMolecularChargeFromAtoms();
      this._syncMOWith3D();
    }

    this.emit('atomUpdated', atom);
    this._onStateMutated();
  }

  setAtomCharge(atomId, charge) {
    const atom = this.model.getAtom(atomId);
    if (!atom) return;
    const clamped = Math.max(-3, Math.min(3, parseInt(charge, 10) || 0));
    if (atom.charge === clamped) return;

    this.pushUndoSnapshot();
    atom.setCharge(clamped);
    this._updateMolecularChargeFromAtoms();
    this.emit('atomUpdated', atom);
    this._syncMOWith3D();
    this._onStateMutated();

    const sign = clamped > 0 ? `+${clamped}` : `${clamped}`;
    this.showToast(`Atom ${atom.name} charge set to ${sign}`, '⚡');
  }

  setAtomPhase(atomId, phase) {
    const atom = this.model.getAtom(atomId);
    if (!atom) return;
    const p = phase >= 0 ? 1 : -1;
    if (atom.phase === p) return;

    this.pushUndoSnapshot();
    atom.setPhase(p);
    this.emit('atomUpdated', atom);
    this._syncMOWith3D();
    this._onStateMutated();

    this.showToast(`Atom ${atom.name} wave phase set to ${p > 0 ? '+ (Red)' : '− (Blue)'}`, '🎨');
  }

  _updateMolecularChargeFromAtoms() {
    let sum = 0;
    for (const a of this.model.atoms) {
      sum += (a.charge || 0);
    }
    this.molecularCharge = sum;
    this.emit('chargeChanged', this.molecularCharge);
  }

  updateAtomPosition(atomId, x, y, z) {
    const atom = this.model.getAtom(atomId);
    if (!atom) return;
    this.pushUndoSnapshot();
    atom.setPosition(x, y, z);
    this.emit('atomUpdated', atom);
    this.emit('bondsUpdated');
    this._onStateMutated();
  }

  updateAtomRotation(atomId, rx, ry, rz) {
    const atom = this.model.getAtom(atomId);
    if (!atom) return;
    this.pushUndoSnapshot();
    atom.setRotation(rx, ry, rz);
    this.emit('atomUpdated', atom);
    this._onStateMutated();
  }

  rotateSelectedAtomsAxisDelta(axis, deg) {
    this.pushUndoSnapshot();
    const rad = deg * (Math.PI / 180);
    this.model.getSelectedAtoms().forEach(atom => {
      if (axis === 'x') atom.rotation.x = (atom.rotation.x + rad) % (Math.PI * 2);
      if (axis === 'y') atom.rotation.y = (atom.rotation.y + rad) % (Math.PI * 2);
      if (axis === 'z') atom.rotation.z = (atom.rotation.z + rad) % (Math.PI * 2);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  // --- Batch Operations ---
  batchUpdateColor(colorHex) {
    this.pushUndoSnapshot();
    this.model.getSelectedAtoms().forEach(atom => {
      atom.setColor(colorHex);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  batchUpdateOrbital(orbitalType) {
    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    try {
      this.model.getSelectedAtoms().forEach(atom => {
        atom.setOrbitalType(orbitalType);
        if (orbitalType === 'sp2' || orbitalType === 'sp') {
          this.alignAtomWithBondedNeighbors(atom);
        }
        this.emit('atomUpdated', atom);
      });
      this._onStateMutated();
    } finally {
      this._isContinuousChange = false;
    }
  }

  batchToggleArrangement() {
    const selected = this.model.getSelectedAtoms();
    const anyOn = selected.some(a => a.showArrangement);
    const newState = !anyOn;
    this.pushUndoSnapshot();
    selected.forEach(atom => {
      if (ARRANGEMENT_INFO[atom.orbitalType]) {
        atom.setShowArrangement(newState);
        this.emit('atomUpdated', atom);
      }
    });
    this._onStateMutated();
  }

  batchToggleNodalPlanes() {
    const selected = this.model.getSelectedAtoms();
    const anyOn = selected.some(a => a.showNodalPlanes);
    const newState = !anyOn;
    this.pushUndoSnapshot();
    selected.forEach(atom => {
      if (NODAL_INFO[atom.orbitalType]) {
        atom.setShowNodalPlanes(newState);
        this.emit('atomUpdated', atom);
      }
    });
    this._onStateMutated();
  }

  batchUpdateRadius(radius) {
    const val = parseFloat(radius);
    if (isNaN(val)) return;
    this.pushUndoSnapshot();
    const targets = this.model.getSelectedAtoms();
    targets.forEach(atom => {
      atom.setRadius(val);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  batchUpdateCharge(chargeDeltaOrVal, isDelta = false) {
    this.pushUndoSnapshot();
    const targets = this.model.getSelectedAtoms();
    targets.forEach(atom => {
      const cur = atom.charge || 0;
      const next = isDelta ? (cur + chargeDeltaOrVal) : chargeDeltaOrVal;
      atom.setCharge(next);
      this.emit('atomUpdated', atom);
    });
    this._updateMolecularChargeFromAtoms();
    this._onStateMutated();
  }

  batchUpdatePhase(phase) {
    this.pushUndoSnapshot();
    const targets = this.model.getSelectedAtoms();
    targets.forEach(atom => {
      atom.setPhase(phase);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  batchSetArrangement(show) {
    this.pushUndoSnapshot();
    const targets = this.model.getSelectedAtoms();
    targets.forEach(atom => {
      atom.setShowArrangement(show);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  batchSetNodalPlanes(show) {
    this.pushUndoSnapshot();
    const targets = this.model.getSelectedAtoms();
    targets.forEach(atom => {
      atom.setShowNodalPlanes(show);
      this.emit('atomUpdated', atom);
    });
    this._onStateMutated();
  }

  // --- Covalent Bonding Operations ---
  addBond(atomAId, atomBId, customColor = null) {
    this.pushUndoSnapshot();
    const bond = this.model.addBond(atomAId, atomBId, customColor);
    if (bond) {
      this.emit('bondAdded', bond);
      this._onStateMutated();
    }
    return bond;
  }

  removeBond(atomAId, atomBId) {
    this.pushUndoSnapshot();
    const removed = this.model.removeBond(atomAId, atomBId);
    if (removed) {
      this.emit('bondRemoved', removed);
      this._onStateMutated();
    }
    return removed;
  }

  formCovalentBondsForSelected() {
    let selected = this.model.getSelectedAtoms();
    if (selected.length < 2) {
      if (this.atoms.length === 2) {
        selected = this.atoms;
        this.selectAtom(this.atoms[0].id, false);
        this.selectAtom(this.atoms[1].id, true);
      } else {
        this.showToast('Please select 2 or more atoms to form covalent bond(s)', 'ℹ️');
        return;
      }
    }

    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    let addedCount = 0;
    let antiBondingFormed = false;

    try {
      if (selected.length === 2) {
        const a = selected[0];
        const b = selected[1];
        let bond = this.model.getBond(a.id, b.id);
        if (!bond) {
          bond = this.addBond(a.id, b.id);
          addedCount++;
        }

        const mo = buildDiatomicMODiagram(a, b, this.molecularCharge);
        const isOppositePhase = (a.phase !== undefined && b.phase !== undefined && a.phase !== b.phase);
        if ((mo && mo.bondOrder <= 0.05) || isOppositePhase) {
          antiBondingFormed = true;
          if (bond) bond.setBroken(true);
        } else if (bond) {
          bond.setBroken(false);
        }
      } else {
        // Connect nearby pairs within 3.5 units
        for (let i = 0; i < selected.length; i++) {
          for (let j = i + 1; j < selected.length; j++) {
            const a = selected[i];
            const b = selected[j];
            const dist = a.position.distanceTo(b.position);
            if (dist > 0.4 && dist < 3.5) {
              let bond = this.model.getBond(a.id, b.id);
              if (!bond) {
                bond = this.addBond(a.id, b.id);
                addedCount++;
              }
              const mo = buildDiatomicMODiagram(a, b, this.molecularCharge);
              const isOppositePhase = (a.phase !== undefined && b.phase !== undefined && a.phase !== b.phase);
              if ((mo && mo.bondOrder <= 0.05) || isOppositePhase) {
                if (bond) bond.setBroken(true);
                antiBondingFormed = true;
              } else if (bond) {
                bond.setBroken(false);
              }
            }
          }
        }
      }
    } finally {
      this._isContinuousChange = false;
    }

    this._syncMOWith3D();
    this.emit('bondsUpdated');
    this._onStateMutated();

    if (antiBondingFormed) {
      this.showToast('⚡ Anti-Bonding Formed (BO = 0.0): Destructive wave interference creates a nodal plane and repulsive dissociation!', '💥');
    } else if (addedCount > 0 || (selected.length === 2 && this.bonds.length > 0)) {
      this.showToast('Formed Covalent σ-Bond(s)!', '🔗');
    } else {
      this.showToast('Selected atoms already bonded or distance too great (> 3.5 units)', 'ℹ️');
    }
  }

  removeCovalentBondsForSelected() {
    const selected = this.model.getSelectedAtoms();
    if (selected.length < 2) {
      this.showToast('Select 2 or more atoms to remove bonds', 'ℹ️');
      return;
    }

    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    let removedCount = 0;

    try {
      for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
          const removed = this.removeBond(selected[i].id, selected[j].id);
          if (removed) removedCount++;
        }
      }
    } finally {
      this._isContinuousChange = false;
    }

    if (removedCount > 0) {
      this.showToast(`Removed ${removedCount} Covalent Bond(s)`, '✂️');
    } else {
      this.showToast('No covalent bonds existed between selected atoms', 'ℹ️');
    }
  }

  // --- Unhybridized p-Orbital Alignment & Bridging ---
  alignAtomWithBondedNeighbors(atom) {
    const changed = alignAtomWithBondedNeighbors(atom, (a) => this.model.getBondedNeighbors(a));
    if (changed) {
      this.emit('atomUpdated', atom);
    }
    return changed;
  }

  alignSelectedOrbitals() {
    const selected = this.model.getSelectedAtoms();
    if (selected.length === 0) {
      this.showToast('Select atoms to align their unhybridized p or d orbitals', 'ℹ️');
      return;
    }

    this.pushUndoSnapshot();

    if (selected.length === 2) {
      const a = selected[0];
      const b = selected[1];
      const ok = alignOrbitalsForOverlap(a, b);
      if (ok) {
        this.emit('atomUpdated', a);
        this.emit('atomUpdated', b);
        this._onStateMutated();
        this.showToast(`✨ Aligned orbitals into π/δ symmetry for ${a.name} and ${b.name}!`, '🔄');
        return;
      }
    }

    // Fallback or multi-selection (> 2 atoms, e.g. rings, sheets):
    let alignedCount = 0;
    selected.forEach(atom => {
      const ok = this.alignAtomWithBondedNeighbors(atom);
      if (ok) alignedCount++;
    });

    if (alignedCount > 0) {
      this.showToast(`Aligned orbitals across ${alignedCount} atom(s)`, '🔄');
      this._onStateMutated();
    } else {
      this.showToast('Ensure selected atoms have p or d orbitals to align', '⚠️');
    }
  }

  // Backward compatibility alias for UI bindings
  alignSelectedPOrbitals() {
    this.alignSelectedOrbitals();
  }

  addBridge(bridgeOptions) {
    this.pushUndoSnapshot();
    const bridge = this.model.addBridge(bridgeOptions);
    this.emit('bridgeAdded', bridge);
    this._onStateMutated();
    return bridge;
  }

  clearBridges() {
    this.pushUndoSnapshot();
    this.model.clearBridges();
    this.emit('bridgesCleared');
    this._onStateMutated();
    this.showToast('Cleared all π-bond bridges & nodal planes', '🧹');
  }

  bridgeSelectedOrbitals() {
    let selected = this.model.getSelectedAtoms();
    if (selected.length < 2) {
      if (this.atoms.length === 2) {
        selected = this.atoms;
        this.selectAtom(this.atoms[0].id, false);
        this.selectAtom(this.atoms[1].id, true);
      } else {
        this.showToast('Please select 2 or more atoms to test orbital overlap', 'ℹ️');
        return;
      }
    }

    if (selected.length === 2) {
      const a = selected[0];
      const b = selected[1];
      if (a.orbitalType === 's' && b.orbitalType === 's') {
        this.formCovalentBondsForSelected();
        return;
      }
    }

    this.pushUndoSnapshot();
    this._isContinuousChange = true;

    // Check if any pairs among the selected set have covalent bonds
    let anyCovalentBondInSelection = false;
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        if (this.model.hasBond(selected[i].id, selected[j].id)) {
          anyCovalentBondInSelection = true;
          break;
        }
      }
      if (anyCovalentBondInSelection) break;
    }

    let bondingCount = 0;
    let antibondingCount = 0;
    let deltaBondingCount = 0;
    let deltaAntibondingCount = 0;

    const evaluateAndCreateBridges = () => {
      let created = 0;
      for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
          const a = selected[i];
          const b = selected[j];
          const dist = a.position.distanceTo(b.position);
          if (dist <= 0.4 || dist > 4.5) continue;

          const isBonded = this.model.hasBond(a.id, b.id);
          if (anyCovalentBondInSelection && !isBonded) {
            continue; // Skip non-bonded pairs across rings
          } else if (!anyCovalentBondInSelection && selected.length > 2 && dist > 2.5) {
            continue;
          }

          const existingBridges = this.model.bridges;
          const overlaps = detectOrbitalOverlaps(a, b, isBonded, existingBridges);
          overlaps.forEach(ov => {
            const displayLabel = (selected.length <= 4 || (bondingCount + deltaBondingCount === 0)) ? ov.labelText : '';
            this.addBridge({
              atomAId: a.id,
              atomBId: b.id,
              type: ov.type,
              normDir: ov.normDir,
              labelText: displayLabel,
              lobePairs: ov.lobePairs,
              deltaNorms: ov.deltaNorms
            });
            created++;

            if (ov.type === 'bonding') bondingCount++;
            else if (ov.type === 'antibonding') antibondingCount++;
            else if (ov.type === 'delta_bonding') deltaBondingCount++;
            else if (ov.type === 'delta_antibonding') deltaAntibondingCount++;
          });
        }
      }
      return created;
    };

    try {
      let formed = evaluateAndCreateBridges();

      // If no overlaps were detected with existing orientation, attempt smart quantum auto-alignment!
      if (formed === 0) {
        let autoAligned = false;

        if (selected.length === 2) {
          const a = selected[0];
          const b = selected[1];
          const compat = getOrbitalOverlapCompatibility(a, b);

          if (compat.compatible) {
            if (compat.overlapType === 's-s') {
              this._isContinuousChange = false;
              this.formCovalentBondsForSelected();
              return;
            }
            const ok = alignOrbitalsForOverlap(a, b);
            if (ok) {
              this.emit('atomUpdated', a);
              this.emit('atomUpdated', b);
              autoAligned = true;
              formed = evaluateAndCreateBridges();
            }
          } else {
            this._isContinuousChange = false;
            this.showToast(compat.reason, '⚠️');
            return;
          }
        } else {
          // Multi-atom selection: align bonded neighbors
          let alignedAny = false;
          selected.forEach(a => {
            if (this.alignAtomWithBondedNeighbors(a)) alignedAny = true;
          });
          if (alignedAny) {
            autoAligned = true;
            formed = evaluateAndCreateBridges();
          }
        }

        if (autoAligned && formed > 0) {
          this.showToast(`✨ Auto-aligned orbitals to π/δ symmetry & formed ${bondingCount + deltaBondingCount} bridge(s)!`, '✨');
          this._onStateMutated();
          return;
        }
      }
    } finally {
      this._isContinuousChange = false;
    }

    const totalBonds = bondingCount + deltaBondingCount;
    const totalAnti = antibondingCount + deltaAntibondingCount;

    if (totalBonds > 0 && totalAnti === 0) {
      const desc = [];
      if (bondingCount > 0) desc.push(`${bondingCount} π-Bond(s)`);
      if (deltaBondingCount > 0) desc.push(`${deltaBondingCount} δ-Bond(s)`);
      this.showToast(`✨ Formed ${desc.join(' & ')}! Overlaps connected.`, '✨');
    } else if (totalAnti > 0 && totalBonds === 0) {
      this.showToast(`⚠️ Out-of-Phase Overlap: Formed ${totalAnti} Antibonding (* / Nodal Plane)!`, '⚠️');
    } else if (totalBonds > 0 && totalAnti > 0) {
      this.showToast(`Formed ${totalBonds} Bonding and ${totalAnti} Antibonding states!`, 'ℹ️');
    } else {
      if (selected.length === 2) {
        const compat = getOrbitalOverlapCompatibility(selected[0], selected[1]);
        if (compat.overlapType === 's-s') {
          this.formCovalentBondsForSelected();
          return;
        }
        if (!compat.compatible) {
          this.showToast(compat.reason, '⚠️');
        } else {
          this.showToast('Could not form π or δ bonds. Ensure selected atoms are within 4.5 units, have p or d orbitals (or sp/sp²), and their orbital lobes are aligned for lateral (π) or face-to-face (δ) overlap.', '⚠️');
        }
      } else {
        this.showToast('Could not form π or δ bonds. Ensure selected atoms are within 4.5 units, have p or d orbitals (or sp/sp²), and their orbital lobes are aligned for lateral (π) or face-to-face (δ) overlap.', '⚠️');
      }
    }
  }

  // --- Quick Build Element & Cycling ---
  cycleQuickBuildElement(elem) {
    const isAlreadyActive = this.quickBuildElem === elem;
    const options = ELEMENT_ORBITAL_OPTIONS[elem] || ['s'];

    if (isAlreadyActive && options.length > 1) {
      this.elementOrbitalIndex[elem] = (this.elementOrbitalIndex[elem] + 1) % options.length;
      const newOrb = options[this.elementOrbitalIndex[elem]];
      this.quickBuildOrbital = newOrb;
      this.emit('quickBuildChanged', { elem, orbital: newOrb, cycled: true });
      this.showToast(`Cycled ${elem} orbital to ${ORBITAL_DISPLAY_LABELS[newOrb] || newOrb}`, '⟳');
    } else {
      this.quickBuildElem = elem;
      const currentOrb = options[this.elementOrbitalIndex[elem]] || options[0];
      this.quickBuildOrbital = currentOrb;
      this.emit('quickBuildChanged', { elem, orbital: currentOrb, cycled: false });
    }
  }

  quickAttachAtom(parentAtom, localDir) {
    const attachInfo = calculateAttachment(parentAtom, localDir, this.quickBuildElem, this.quickBuildOrbital);
    if (!attachInfo) return null;

    const elemData = ELEMENT_DEFAULTS[attachInfo.childElem] || { color: '#64748b', radius: 0.40 };

    const newAtom = this.addAtom({
      name: attachInfo.childElem + (this.model.atoms.length + 1),
      element: attachInfo.childElem,
      color: elemData.color,
      radius: elemData.radius,
      orbitalType: attachInfo.childOrbital,
      position: attachInfo.attachPos,
      rotation: attachInfo.childRotation
    });

    this.addBond(parentAtom.id, newAtom.id);
    this.selectAtom(newAtom.id);
    this.showToast(`Attached ${newAtom.name} with covalent bond`, '✨');
    return newAtom;
  }

  // --- Presets & Reset ---
  loadPreset(presetKey) {
    const presetFn = PRESET_DEFINITIONS[presetKey];
    if (presetFn) {
      this.pushUndoSnapshot();
      this._isContinuousChange = true;
      this.molecularCharge = 0;
      this.emit('nodalPlaneUpdated', { visible: false });
      try {
        presetFn(this);
      } finally {
        this._isContinuousChange = false;
        this.activePresetKey = presetKey;
      }
      this.showToast(`Loaded ${presetKey.replace('preset-', '').replace('-', ' ').toUpperCase()}`, '🧪');
      if (this.isMOViewOpen) {
        this.emit('moDiagramUpdated', this.getMODiagramData());
      }
    }
  }

  setCameraView(pos, target) {
    this.emit('cameraRequested', { position: pos, target: target });
  }

  clearAll() {
    this.pushUndoSnapshot();
    this.model.clearAll();
    if (!this._isContinuousChange) {
      this.activePresetKey = null;
    }
    this.molecularCharge = 0;
    this.emit('nodalPlaneUpdated', { visible: false });
    this.emit('moleculeReset');
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
    this._onStateMutated();
  }

  // --- Molecular Orbital (MO) Methods ---
  toggleMOView(forceState = null) {
    if (forceState !== null) {
      this.isMOViewOpen = !!forceState;
    } else {
      this.isMOViewOpen = !this.isMOViewOpen;
    }
    this.emit('moViewToggled', this.isMOViewOpen);
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  setMolecularCharge(valOrDelta, isDelta = false) {
    if (isDelta) {
      this.molecularCharge = Math.max(-4, Math.min(4, this.molecularCharge + valOrDelta));
    } else {
      this.molecularCharge = Math.max(-4, Math.min(4, parseInt(valOrDelta, 10) || 0));
    }

    const targetAtoms = this.selectedAtoms.length === 2 ? this.selectedAtoms : (this.atoms.length === 2 ? this.atoms : null);
    if (targetAtoms && targetAtoms.length === 2) {
      const q = this.molecularCharge;
      if (q === -2) { targetAtoms[0].charge = -1; targetAtoms[1].charge = -1; }
      else if (q === -1) { targetAtoms[0].charge = -1; targetAtoms[1].charge = 0; }
      else if (q === 0) { targetAtoms[0].charge = 0; targetAtoms[1].charge = 0; }
      else if (q === 1) { targetAtoms[0].charge = 1; targetAtoms[1].charge = 0; }
      else if (q === 2) { targetAtoms[0].charge = 1; targetAtoms[1].charge = 1; }
      else if (q === 3) { targetAtoms[0].charge = 2; targetAtoms[1].charge = 1; }
      else if (q === -3) { targetAtoms[0].charge = -2; targetAtoms[1].charge = -1; }
      else if (q >= 4) { targetAtoms[0].charge = 2; targetAtoms[1].charge = 2; }
      else if (q <= -4) { targetAtoms[0].charge = -2; targetAtoms[1].charge = -2; }
      this.emit('atomUpdated', targetAtoms[0]);
      this.emit('atomUpdated', targetAtoms[1]);
    } else if (this.atoms.length === 1) {
      this.atoms[0].charge = this.molecularCharge;
      this.emit('atomUpdated', this.atoms[0]);
    } else if (this.selectedAtoms.length === 1) {
      this.selectedAtoms[0].charge = this.molecularCharge;
      this.emit('atomUpdated', this.selectedAtoms[0]);
    }

    this.emit('chargeChanged', this.molecularCharge);
    this._syncMOWith3D();
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
    this.showToast(`Molecular Charge: ${this.molecularCharge >= 0 ? '+' + this.molecularCharge : this.molecularCharge}`, '⚡');
  }

  resetMolecularCharge() {
    this.molecularCharge = 0;
    const targetAtoms = this.selectedAtoms.length === 2 ? this.selectedAtoms : (this.atoms.length === 2 ? this.atoms : null);
    if (targetAtoms && targetAtoms.length === 2) {
      targetAtoms[0].charge = 0;
      targetAtoms[1].charge = 0;
      this.emit('atomUpdated', targetAtoms[0]);
      this.emit('atomUpdated', targetAtoms[1]);
    } else if (this.atoms.length === 1) {
      this.atoms[0].charge = 0;
      this.emit('atomUpdated', this.atoms[0]);
    } else if (this.selectedAtoms.length === 1) {
      this.selectedAtoms[0].charge = 0;
      this.emit('atomUpdated', this.selectedAtoms[0]);
    }
    this.emit('chargeChanged', this.molecularCharge);
    this._syncMOWith3D();
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  _syncMOWith3D() {
    const moData = this.getMODiagramData();
    if (!moData) return;

    const isBroken = (moData.bondOrder <= 0.05);

    // Diatomic or 2-atom system (e.g. H2, O2, or localized bond)
    let a1 = null;
    let a2 = null;
    if (this.atoms.length === 2) {
      a1 = this.atoms[0];
      a2 = this.atoms[1];
    } else if (this.selectedAtoms.length === 2) {
      a1 = this.selectedAtoms[0];
      a2 = this.selectedAtoms[1];
    }

    if (a1 && a2) {
      // 1. Update bond broken status
      this.bonds.forEach(b => {
        if ((b.atomAId === a1.id && b.atomBId === a2.id) || (b.atomAId === a2.id && b.atomBId === a1.id)) {
          b.setBroken(isBroken);
        }
      });

      // 2. Handle s-s diatomic (H2)
      if (a1.orbitalType === 's' && a2.orbitalType === 's') {
        if (isBroken) {
          this.bonds.forEach(b => {
            if ((b.atomAId === a1.id && b.atomBId === a2.id) || (b.atomAId === a2.id && b.atomBId === a1.id)) {
              b.setBroken(true);
            }
          });

          // Antibonding state:
          // Opposite phases: a1 is +1 (Red), a2 is -1 (Blue)
          a1.setPhase(1);
          a2.setPhase(-1);

          if (!a1._eqPos || !a2._eqPos) {
            const d = a1.position.distanceTo(a2.position);
            if (d >= 2.8) {
              const mid = a1.position.clone().add(a2.position).multiplyScalar(0.5);
              const dir = a2.position.clone().sub(a1.position).normalize();
              a1._eqPos = mid.clone().sub(dir.clone().multiplyScalar(0.75));
              a2._eqPos = mid.clone().add(dir.clone().multiplyScalar(0.75));
            } else {
              a1._eqPos = a1.position.clone();
              a2._eqPos = a2.position.clone();
            }
          }

          const bondDir = a2._eqPos.clone().sub(a1._eqPos).normalize();
          const midPoint = a1._eqPos.clone().add(a2._eqPos).multiplyScalar(0.5);

          // Repulsion: push outward to distance ~3.1
          a1.position.copy(midPoint.clone().sub(bondDir.clone().multiplyScalar(1.55)));
          a2.position.copy(midPoint.clone().add(bondDir.clone().multiplyScalar(1.55)));

          // Show vertical Nodal Plane (ψ = 0) at midpoint
          this.emit('nodalPlaneUpdated', {
            visible: true,
            position: midPoint,
            normal: bondDir,
            label: 'σ*(1s - 1s) Nodal Plane (ψ = 0)',
            color: '#38bdf8'
          });
        } else {
          // Bonding state (BO > 0):
          // Both positive phase (+1, Red)
          a1.setPhase(1);
          a2.setPhase(1);

          // Restore equilibrium distance
          if (a1._eqPos) a1.position.copy(a1._eqPos);
          if (a2._eqPos) a2.position.copy(a2._eqPos);

          // Hide Nodal Plane
          this.emit('nodalPlaneUpdated', { visible: false });
        }

        this.emit('atomUpdated', a1);
        this.emit('atomUpdated', a2);
        this.emit('bondsUpdated');
      } else {
        // General diatomic (e.g. O2)
        if (isBroken) {
          if (!a1._eqPos || !a2._eqPos) {
            const d = a1.position.distanceTo(a2.position);
            if (d >= 2.8) {
              const mid = a1.position.clone().add(a2.position).multiplyScalar(0.5);
              const dir = a2.position.clone().sub(a1.position).normalize();
              a1._eqPos = mid.clone().sub(dir.clone().multiplyScalar(0.8));
              a2._eqPos = mid.clone().add(dir.clone().multiplyScalar(0.8));
            } else {
              a1._eqPos = a1.position.clone();
              a2._eqPos = a2.position.clone();
            }
          }

          const bondDir = a2._eqPos.clone().sub(a1._eqPos).normalize();
          const midPoint = a1._eqPos.clone().add(a2._eqPos).multiplyScalar(0.5);

          a1.position.copy(midPoint.clone().sub(bondDir.clone().multiplyScalar(1.65)));
          a2.position.copy(midPoint.clone().add(bondDir.clone().multiplyScalar(1.65)));

          this.emit('nodalPlaneUpdated', {
            visible: true,
            position: midPoint,
            normal: bondDir,
            label: 'Antibonding Nodal Plane (BO = 0.0)',
            color: '#f472b6'
          });
        } else {
          if (a1._eqPos) a1.position.copy(a1._eqPos);
          if (a2._eqPos) a2.position.copy(a2._eqPos);
          this.emit('nodalPlaneUpdated', { visible: false });
        }

        this.emit('atomUpdated', a1);
        this.emit('atomUpdated', a2);
        this.emit('bondsUpdated');
      }
    }
  }

  setMOViewMode(mode) {
    this.moViewMode = mode;
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
  }

  selectMOLevel(levelId) {
    this.selectedMOLevelId = levelId;
    this.emit('moLevelSelected', levelId);
  }

  getMODiagramData() {
    // 0. If board is empty:
    if (this.atoms.length === 0) {
      return null;
    }

    // 1. If 1 atom is selected in localized mode, or only 1 atom exists on board:
    const selected = this.selectedAtoms;
    if (selected.length === 1 && (this.moViewMode === 'localized' || this.atoms.length === 1)) {
      const atom = selected[0];
      const effCharge = this.atoms.length === 1 ? this.molecularCharge : (atom.charge || 0);
      return buildAtomicOrbitalDiagram(atom, effCharge);
    }
    if (this.atoms.length === 1) {
      return buildAtomicOrbitalDiagram(this.atoms[0], this.molecularCharge);
    }

    // 2. If 2 atoms are selected, and mode is 'auto' or 'localized', compute localized bond MO!
    if (this.moViewMode === 'localized' || (this.moViewMode === 'auto' && selected.length === 2)) {
      if (selected.length >= 2) {
        return buildDiatomicMODiagram(selected[0], selected[1], this.molecularCharge);
      }
    }

    // 3. If active preset matches polyatomic SALC presets:
    if (this.activePresetKey) {
      const pKey = this.activePresetKey;
      if (pKey === 'preset-h2') {
        const hAtoms = this.atoms.filter(a => a.element === 'H' || a.name.startsWith('H'));
        if (hAtoms.length >= 2) {
          return buildDiatomicMODiagram(hAtoms[0], hAtoms[1], this.molecularCharge);
        }
      }
      if (pKey === 'preset-o2') {
        const oAtoms = this.atoms.filter(a => a.element === 'O' || a.name.startsWith('O'));
        if (oAtoms.length >= 2) {
          return buildDiatomicMODiagram(oAtoms[0], oAtoms[1], this.molecularCharge);
        }
      }
      if (pKey === 'preset-co2' || pKey === 'preset-so2' || pKey === 'preset-h2o' || pKey === 'preset-sp2-c2h4' || pKey === 'preset-sp-c2h2' || pKey === 'preset-sp3-ch4') {
        return buildPolyatomicMODiagram(pKey, this.atoms, this.molecularCharge);
      }
    }

    // 4. Automatic chemical formula composition detection:
    const elemCounts = {};
    for (const a of this.atoms) {
      const el = (a.element || a.name.replace(/[0-9]/g, '')).trim();
      elemCounts[el] = (elemCounts[el] || 0) + 1;
    }
    const numAtoms = this.atoms.length;

    if (elemCounts['H'] === 2 && numAtoms === 2) {
      return buildDiatomicMODiagram(this.atoms[0], this.atoms[1], this.molecularCharge);
    }
    if (elemCounts['O'] === 2 && numAtoms === 2) {
      return buildDiatomicMODiagram(this.atoms[0], this.atoms[1], this.molecularCharge);
    }
    if (elemCounts['C'] === 1 && elemCounts['O'] === 2 && numAtoms === 3) {
      return buildPolyatomicMODiagram('co2', this.atoms, this.molecularCharge);
    }
    if (elemCounts['C'] === 4 && elemCounts['H'] === 6 && numAtoms === 10) {
      return buildPolyatomicMODiagram('butadiene', this.atoms, this.molecularCharge);
    }
    if (elemCounts['S'] === 1 && elemCounts['O'] === 2 && numAtoms === 3) {
      return buildPolyatomicMODiagram('so2', this.atoms, this.molecularCharge);
    }
    if (elemCounts['O'] === 1 && elemCounts['H'] === 2 && numAtoms === 3) {
      return buildPolyatomicMODiagram('h2o', this.atoms, this.molecularCharge);
    }
    if (elemCounts['C'] === 2 && elemCounts['H'] === 4 && numAtoms === 6) {
      return buildPolyatomicMODiagram('c2h4', this.atoms, this.molecularCharge);
    }
    if (elemCounts['C'] === 2 && elemCounts['H'] === 2 && numAtoms === 4) {
      return buildPolyatomicMODiagram('c2h2', this.atoms, this.molecularCharge);
    }
    if (elemCounts['C'] === 1 && elemCounts['H'] === 4 && numAtoms === 5) {
      return buildPolyatomicMODiagram('ch4', this.atoms, this.molecularCharge);
    }

    // 5. Fallback: If 2 atoms exist in total, use diatomic
    if (this.atoms.length === 2) {
      return buildDiatomicMODiagram(this.atoms[0], this.atoms[1], this.molecularCharge);
    }

    // 6. Default: Polyatomic generic
    return buildPolyatomicMODiagram('ch4', this.atoms, this.molecularCharge);
  }

  // --- Orbital View Settings ---
  setOrbitalScale(scale) {
    this.orbitalScale = parseFloat(scale);
    this.emit('displaySettingsChanged');
  }

  setOrbitalOpacity(opacity) {
    this.orbitalOpacity = parseFloat(opacity);
    this.emit('displaySettingsChanged');
  }

  setShowBackLobes(show) {
    this.showBackLobes = !!show;
    this.emit('displaySettingsChanged');
  }

  setShowUnhybridP(show) {
    this.showUnhybridP = !!show;
    this.emit('displaySettingsChanged');
  }

  getMolecularFormulaInfo() {
    return computeMolecularFormula(this.model.atoms, this.model.bonds, this.model.bridges);
  }

  showToast(message, icon = '✨') {
    this.emit('toast', { message, icon });
  }

  _onStateMutated() {
    this.emit('formulaUpdated', this.getMolecularFormulaInfo());
    if (this.isMOViewOpen) {
      this.emit('moDiagramUpdated', this.getMODiagramData());
    }
    this.emit('renderNeeded');
  }
}
