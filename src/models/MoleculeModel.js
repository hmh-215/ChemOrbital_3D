/**
 * MoleculeModel
 * Pure domain model managing collections of atoms, covalent bonds, and pi-bridges.
 */
import { AtomModel } from './AtomModel.js';
import { BondModel } from './BondModel.js';
import { BridgeModel } from './BridgeModel.js';

export class MoleculeModel {
  constructor() {
    this.atoms = [];
    this.bonds = [];
    this.bridges = [];
    this.selectedIds = new Set();
    this.nextId = 1;
  }

  // --- Atom Operations ---
  addAtom(options = {}) {
    let atom;
    if (options instanceof AtomModel) {
      atom = options;
    } else {
      if (!options.id) {
        options.id = 'atom_' + this.nextId++;
      }
      atom = new AtomModel(options);
    }
    this.atoms.push(atom);
    return atom;
  }

  removeAtom(atomId) {
    const idx = this.atoms.findIndex(a => a.id === atomId);
    if (idx === -1) return null;

    const removed = this.atoms.splice(idx, 1)[0];
    this.selectedIds.delete(atomId);
    this.removeBondsForAtom(atomId);
    this.removeBridgesForAtom(atomId);
    return removed;
  }

  getAtom(atomId) {
    return this.atoms.find(a => a.id === atomId) || null;
  }

  // --- Selection Operations ---
  selectAtom(atomId, addToSelection = false) {
    if (!addToSelection) {
      this.selectedIds.clear();
      this.atoms.forEach(a => a.setSelected(false));
    }

    if (atomId) {
      const atom = this.getAtom(atomId);
      if (atom) {
        if (addToSelection && this.selectedIds.has(atomId)) {
          this.selectedIds.delete(atomId);
          atom.setSelected(false);
        } else {
          this.selectedIds.add(atomId);
          atom.setSelected(true);
        }
      }
    }
  }

  selectAtomsByType(targetElement, addToSelection = false) {
    if (!addToSelection) {
      this.selectedIds.clear();
      this.atoms.forEach(a => a.setSelected(false));
    }
    const elemUpper = targetElement.toUpperCase();
    this.atoms.forEach(a => {
      if (a.element === elemUpper) {
        this.selectedIds.add(a.id);
        a.setSelected(true);
      }
    });
  }

  selectAll() {
    this.atoms.forEach(a => {
      this.selectedIds.add(a.id);
      a.setSelected(true);
    });
  }

  deselectAll() {
    this.selectedIds.clear();
    this.atoms.forEach(a => a.setSelected(false));
  }

  getPrimarySelectedAtom() {
    if (this.selectedIds.size === 0) return null;
    const firstId = Array.from(this.selectedIds)[0];
    return this.getAtom(firstId);
  }

  getSelectedAtoms() {
    return this.atoms.filter(a => this.selectedIds.has(a.id));
  }

  // --- Covalent Bond Operations ---
  hasBond(atomAId, atomBId) {
    return this.bonds.some(b => b.connects(atomAId, atomBId));
  }

  addBond(atomAId, atomBId, customColor = null) {
    if (atomAId === atomBId) return null;
    const existing = this.bonds.find(b => b.connects(atomAId, atomBId));
    if (existing) return existing;

    const bond = new BondModel(atomAId, atomBId, customColor);
    this.bonds.push(bond);
    return bond;
  }

  removeBond(atomAId, atomBId) {
    const idx = this.bonds.findIndex(b => b.connects(atomAId, atomBId));
    if (idx !== -1) {
      return this.bonds.splice(idx, 1)[0];
    }
    return null;
  }

  removeBondsForAtom(atomId) {
    this.bonds = this.bonds.filter(b => !b.involves(atomId));
  }

  clearAllBonds() {
    this.bonds = [];
  }

  getBondedNeighbors(atomOrId) {
    const atomId = typeof atomOrId === 'string' ? atomOrId : atomOrId.id;
    const neighbors = [];
    this.bonds.forEach(b => {
      if (b.involves(atomId)) {
        const otherId = b.getOtherAtomId(atomId);
        const neighborAtom = this.getAtom(otherId);
        if (neighborAtom) {
          neighbors.push({ bond: b, neighbor: neighborAtom });
        }
      }
    });
    return neighbors;
  }

  // --- Pi-Bridge Operations ---
  addBridge(options = {}) {
    let bridge;
    if (options instanceof BridgeModel) {
      bridge = options;
    } else {
      bridge = new BridgeModel(options);
    }
    this.bridges.push(bridge);
    return bridge;
  }

  removeBridgesForAtom(atomId) {
    this.bridges = this.bridges.filter(b => !b.involves(atomId));
  }

  clearBridges() {
    this.bridges = [];
  }

  // --- Reset Entire Molecule ---
  clearAll() {
    this.atoms = [];
    this.bonds = [];
    this.bridges = [];
    this.selectedIds.clear();
    this.nextId = 1;
  }
}
