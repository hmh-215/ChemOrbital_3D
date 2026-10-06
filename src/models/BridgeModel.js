/**
 * BridgeModel
 * Pure domain model representing a pi-bond bridge or delocalized aromatic ring.
 */

export class BridgeModel {
  constructor(options = {}) {
    this.id = options.id || ('bridge_' + Math.random().toString(36).slice(2, 11));
    this.type = options.type || 'bonding'; // 'bonding', 'antibonding', 'delta_bonding', 'delta_antibonding', or 'delocalized_ring'
    this.atomAId = options.atomAId || null;
    this.atomBId = options.atomBId || null;
    this.normDir = options.normDir ? options.normDir.clone() : new THREE.Vector3(0, 0, 1);
    this.labelText = options.labelText || (this.type === 'bonding' ? 'π (Bonding)' : 'π* (Antibonding)');

    // Specific lobe positions for precise p-p, p-d, and d-d tube rendering
    this.lobePairs = options.lobePairs ? options.lobePairs.map(lp => ({
      posA: lp.posA instanceof THREE.Vector3 ? lp.posA.clone() : new THREE.Vector3(lp.posA.x, lp.posA.y, lp.posA.z),
      posB: lp.posB instanceof THREE.Vector3 ? lp.posB.clone() : new THREE.Vector3(lp.posB.x, lp.posB.y, lp.posB.z),
      phase: lp.phase
    })) : null;

    this.deltaNorms = options.deltaNorms ? {
      norm1: options.deltaNorms.norm1 instanceof THREE.Vector3 ? options.deltaNorms.norm1.clone() : new THREE.Vector3(options.deltaNorms.norm1.x, options.deltaNorms.norm1.y, options.deltaNorms.norm1.z),
      norm2: options.deltaNorms.norm2 instanceof THREE.Vector3 ? options.deltaNorms.norm2.clone() : new THREE.Vector3(options.deltaNorms.norm2.x, options.deltaNorms.norm2.y, options.deltaNorms.norm2.z)
    } : null;

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
