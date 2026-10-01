/**
 * BridgeModel
 * Pure domain model representing a pi-bond bridge or delocalized aromatic ring.
 */

export class BridgeModel {
  constructor(options = {}) {
    this.id = options.id || ('bridge_' + Math.random().toString(36).substr(2, 9));
    this.type = options.type || 'bonding'; // 'bonding', 'antibonding', or 'delocalized_ring'
    this.atomAId = options.atomAId || null;
    this.atomBId = options.atomBId || null;
    this.normDir = options.normDir ? options.normDir.clone() : new THREE.Vector3(0, 0, 1);
    this.labelText = options.labelText || (this.type === 'bonding' ? 'π (Bonding)' : 'π* (Antibonding)');

    // Delocalized ring properties
    this.centerPos = options.centerPos ? options.centerPos.clone() : null;
    this.radius = options.radius || 1.95;
    this.zHeight = options.zHeight || 1.15;
  }

  connects(atomId1, atomId2) {
    if (this.type === 'delocalized_ring') return false;
    return (this.atomAId === atomId1 && this.atomBId === atomId2) ||
           (this.atomAId === atomId2 && this.atomBId === atomId1);
  }

  involves(atomId) {
    if (this.type === 'delocalized_ring') return false;
    return this.atomAId === atomId || this.atomBId === atomId;
  }
}
