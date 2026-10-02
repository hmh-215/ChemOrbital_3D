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
  detectOrbitalOverlaps
} from '../models/ChemistryMath.js';
import {
  ELEMENT_DEFAULTS,
  ELEMENT_ORBITAL_OPTIONS,
  ELEMENT_ORBITAL_INDEX,
  ORBITAL_DISPLAY_LABELS
} from '../constants/Elements.js';
import { ARRANGEMENT_INFO, NODAL_INFO } from '../constants/Orbitals.js';
import { PRESET_DEFINITIONS } from '../constants/Presets.js';

export class MoleculeViewModel extends EventEmitter {
  constructor() {
    super();
    this.model = new MoleculeModel();

    // Application state
    this.interactionMode = 'orbit'; // 'orbit', 'build', 'box'
    this.isLight = false;
    this.quickBuildElem = 'H';
    this.quickBuildOrbital = 's';
    this.orbitalScale = 1.0;
    this.orbitalOpacity = 0.15;
    this.showBackLobes = false;
    this.showUnhybridP = true;
    this.elementOrbitalIndex = { ...ELEMENT_ORBITAL_INDEX };

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

  // --- Mode and Theme ---
  setInteractionMode(mode) {
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
      showArrangement: options.showArrangement || false,
      showNodalPlanes: options.showNodalPlanes || false,
      position,
      rotation
    };

    const atom = this.model.addAtom(atomData);
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

  duplicateSelectedAtom() {
    const selected = this.primarySelectedAtom;
    if (!selected) return;

    this.pushUndoSnapshot();
    const dupPos = selected.position.clone().add(new THREE.Vector3(1.5, 0, 0));
    const dupRot = calculateRepulsionOptimizedRotation({
      newPos: dupPos,
      orbitalType: selected.orbitalType,
      existingAtoms: this.model.atoms
    });

    const copy = this.addAtom({
      name: selected.name + '_copy',
      element: selected.element,
      color: selected.color,
      radius: selected.radius,
      orbitalType: selected.orbitalType,
      showArrangement: selected.showArrangement,
      showNodalPlanes: selected.showNodalPlanes,
      rotation: dupRot,
      position: dupPos
    });
    this.selectAtom(copy.id);
    this.showToast(`Duplicated ${selected.name}`, '📋');
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

        this.addAtom({
          name: s.name + '_copy',
          element: s.element,
          color: s.color,
          radius: s.radius,
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
  }

  selectAtomsByType(element, addToSelection = false) {
    this.model.selectAtomsByType(element, addToSelection);
    this.emit('selectionChanged', this.model.selectedIds);
  }

  selectAllAtoms() {
    this.model.selectAll();
    this.emit('selectionChanged', this.model.selectedIds);
  }

  deselectAllAtoms() {
    this.model.deselectAll();
    this.emit('selectionChanged', this.model.selectedIds);
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
    }

    this.emit('atomUpdated', atom);
    this._onStateMutated();
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
    const selected = this.model.getSelectedAtoms();
    if (selected.length < 2) {
      alert('Please select 2 or more atoms to form covalent bond(s)!');
      return;
    }

    this.pushUndoSnapshot();
    this._isContinuousChange = true;
    let addedCount = 0;

    try {
      if (selected.length === 2) {
        const a = selected[0];
        const b = selected[1];
        if (!this.model.hasBond(a.id, b.id)) {
          this.addBond(a.id, b.id);
          addedCount++;
        }
      } else {
        // Connect nearby pairs within 3.5 units
        for (let i = 0; i < selected.length; i++) {
          for (let j = i + 1; j < selected.length; j++) {
            const a = selected[i];
            const b = selected[j];
            const dist = a.position.distanceTo(b.position);
            if (dist > 0.4 && dist < 3.5 && !this.model.hasBond(a.id, b.id)) {
              this.addBond(a.id, b.id);
              addedCount++;
            }
          }
        }
      }
    } finally {
      this._isContinuousChange = false;
    }

    if (addedCount > 0) {
      this.showToast(`Formed ${addedCount} Covalent σ-Bond(s)!`, '🔗');
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

  alignSelectedPOrbitals() {
    const selected = this.model.getSelectedAtoms();
    if (selected.length === 0) {
      this.showToast('Select atoms to align their unhybridized p-orbitals', 'ℹ️');
      return;
    }

    this.pushUndoSnapshot();
    let alignedCount = 0;
    selected.forEach(atom => {
      if (atom.orbitalType === 'sp2' || atom.orbitalType === 'sp') {
        const ok = this.alignAtomWithBondedNeighbors(atom);
        if (ok) alignedCount++;
      }
    });

    if (alignedCount > 0) {
      this.showToast(`Aligned p-orbitals parallel for ${alignedCount} atom(s)`, '🔄');
      this._onStateMutated();
    } else {
      this.showToast('Ensure atoms are bonded and have sp or sp² orbitals to align', '⚠️');
    }
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
    const selected = this.model.getSelectedAtoms();
    if (selected.length < 2) {
      alert('Please select 2 or more atoms (using Box Marquee or Ctrl+Click) to test orbital overlap & form π, p-d, or d-d bonds!');
      return;
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

    try {
      for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
          const a = selected[i];
          const b = selected[j];
          const dist = a.position.distanceTo(b.position);
          if (dist <= 0.4 || dist > 4.5) continue;

          const isBonded = this.model.hasBond(a.id, b.id);
          if (anyCovalentBondInSelection && !isBonded) {
            continue; // Skip non-bonded pairs (e.g. C1-C4 across benzene ring)
          } else if (!anyCovalentBondInSelection && selected.length > 2 && dist > 2.5) {
            continue;
          }

          const overlaps = detectOrbitalOverlaps(a, b, isBonded);
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

            if (ov.type === 'bonding') bondingCount++;
            else if (ov.type === 'antibonding') antibondingCount++;
            else if (ov.type === 'delta_bonding') deltaBondingCount++;
            else if (ov.type === 'delta_antibonding') deltaAntibondingCount++;
          });
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
      alert('Could not form π or δ bonds. Ensure selected atoms are within 4.5 units, have p or d orbitals (or sp/sp²), and their orbital lobes are aligned for lateral (π) or face-to-face (δ) overlap.');
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
      try {
        presetFn(this);
      } finally {
        this._isContinuousChange = false;
      }
      this.showToast(`Loaded ${presetKey.replace('preset-', '').replace('-', ' ').toUpperCase()}`, '🧪');
    }
  }

  setCameraView(pos, target) {
    this.emit('cameraRequested', { position: pos, target: target });
  }

  clearAll() {
    this.pushUndoSnapshot();
    this.model.clearAll();
    this.emit('moleculeReset');
    this._onStateMutated();
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
    this.emit('renderNeeded');
  }
}
