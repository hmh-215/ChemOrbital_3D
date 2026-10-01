/**
 * BondModel
 * Pure domain model representing a covalent bond between two atoms.
 */

export class BondModel {
  constructor(atomAId, atomBId, customColor = null, id = null) {
    this.id = id || ('bond_' + atomAId + '_' + atomBId + '_' + Math.random().toString(36).substr(2, 5));
    this.atomAId = atomAId;
    this.atomBId = atomBId;
    this.customColor = customColor;
  }

  connects(atomId1, atomId2) {
    return (this.atomAId === atomId1 && this.atomBId === atomId2) ||
           (this.atomAId === atomId2 && this.atomBId === atomId1);
  }

  involves(atomId) {
    return this.atomAId === atomId || this.atomBId === atomId;
  }

  getOtherAtomId(atomId) {
    if (this.atomAId === atomId) return this.atomBId;
    if (this.atomBId === atomId) return this.atomAId;
    return null;
  }
}
