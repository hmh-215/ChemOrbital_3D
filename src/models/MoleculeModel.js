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

  // --- Snapshot Serialization & Restoration for Undo/Redo ---
  getSnapshot() {
    return {
      atoms: this.atoms.map(a => ({
        id: a.id,
        name: a.name,
        element: a.element,
        color: a.color,
        radius: a.radius,
        orbitalType: a.orbitalType,
        showArrangement: a.showArrangement,
        showNodalPlanes: a.showNodalPlanes,
        isSelected: a.isSelected,
        position: { x: a.position.x, y: a.position.y, z: a.position.z },
        rotation: { x: a.rotation.x, y: a.rotation.y, z: a.rotation.z, order: a.rotation.order }
      })),
      bonds: this.bonds.map(b => ({
        id: b.id,
        atomAId: b.atomAId,
        atomBId: b.atomBId,
        customColor: b.customColor
      })),
      bridges: this.bridges.map(br => ({
        id: br.id,
        type: br.type,
        atomAId: br.atomAId,
        atomBId: br.atomBId,
        normDir: br.normDir ? { x: br.normDir.x, y: br.normDir.y, z: br.normDir.z } : null,
        labelText: br.labelText,
        lobePairs: br.lobePairs ? br.lobePairs.map(lp => ({
          posA: { x: lp.posA.x, y: lp.posA.y, z: lp.posA.z },
          posB: { x: lp.posB.x, y: lp.posB.y, z: lp.posB.z },
          phase: lp.phase
        })) : null,
        deltaNorms: br.deltaNorms ? {
          norm1: { x: br.deltaNorms.norm1.x, y: br.deltaNorms.norm1.y, z: br.deltaNorms.norm1.z },
          norm2: { x: br.deltaNorms.norm2.x, y: br.deltaNorms.norm2.y, z: br.deltaNorms.norm2.z }
        } : null,
        centerPos: br.centerPos ? { x: br.centerPos.x, y: br.centerPos.y, z: br.centerPos.z } : null,
        radius: br.radius,
        zHeight: br.zHeight
      })),
      selectedIds: Array.from(this.selectedIds),
      nextId: this.nextId
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.clearAll();
    this.nextId = snapshot.nextId || (snapshot.atoms ? snapshot.atoms.length + 1 : 1);

    if (Array.isArray(snapshot.atoms)) {
      snapshot.atoms.forEach(data => {
        const atom = new AtomModel({
          id: data.id,
          name: data.name,
          element: data.element,
          color: data.color,
          radius: data.radius,
          orbitalType: data.orbitalType,
          showArrangement: data.showArrangement,
          showNodalPlanes: data.showNodalPlanes,
          isSelected: data.isSelected,
          position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
          rotation: new THREE.Euler(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.order || 'XYZ')
        });
        this.atoms.push(atom);
      });
    }

    if (Array.isArray(snapshot.bonds)) {
      snapshot.bonds.forEach(data => {
        this.bonds.push(new BondModel(data.atomAId, data.atomBId, data.customColor, data.id));
      });
    }

    if (Array.isArray(snapshot.bridges)) {
      snapshot.bridges.forEach(data => {
        this.bridges.push(new BridgeModel({
          id: data.id,
          type: data.type,
          atomAId: data.atomAId,
          atomBId: data.atomBId,
          normDir: data.normDir ? new THREE.Vector3(data.normDir.x, data.normDir.y, data.normDir.z) : new THREE.Vector3(0, 0, 1),
          labelText: data.labelText,
          lobePairs: data.lobePairs ? data.lobePairs.map(lp => ({
            posA: new THREE.Vector3(lp.posA.x, lp.posA.y, lp.posA.z),
            posB: new THREE.Vector3(lp.posB.x, lp.posB.y, lp.posB.z),
            phase: lp.phase
          })) : null,
          deltaNorms: data.deltaNorms ? {
            norm1: new THREE.Vector3(data.deltaNorms.norm1.x, data.deltaNorms.norm1.y, data.deltaNorms.norm1.z),
            norm2: new THREE.Vector3(data.deltaNorms.norm2.x, data.deltaNorms.norm2.y, data.deltaNorms.norm2.z)
          } : null,
          centerPos: data.centerPos ? new THREE.Vector3(data.centerPos.x, data.centerPos.y, data.centerPos.z) : null,
          radius: data.radius,
          zHeight: data.zHeight
        }));
      });
    }

    this.selectedIds = new Set(snapshot.selectedIds || []);
  }
}

