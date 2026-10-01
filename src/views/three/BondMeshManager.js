/**
 * BondMeshManager
 * Manages Three.js 3D cylinder meshes connecting covalently bonded atoms.
 */

export class BondMeshManager {
  constructor(scene) {
    this.scene = scene;
    this.covalentBondsGroup = new THREE.Group();
    this.covalentBondsGroup.name = "covalent-bonds-group";
    this.scene.add(this.covalentBondsGroup);

    this.cachedBondCylinderGeom = new THREE.CylinderGeometry(0.045, 0.045, 1, 16, 1);
    this.cachedBondCylinderGeom.translate(0, 0.5, 0);

    this.defaultBondMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.2
    });

    this.bondMeshes = new Map(); // bondId -> { bondModel, mesh }
  }

  addBondMesh(bondModel, atomA, atomB) {
    if (!atomA || !atomB) return null;

    const mat = bondModel.customColor
      ? new THREE.MeshStandardMaterial({ color: bondModel.customColor, roughness: 0.35, metalness: 0.2 })
      : this.defaultBondMaterial;

    const mesh = new THREE.Mesh(this.cachedBondCylinderGeom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.covalentBondsGroup.add(mesh);

    const record = { bondModel, mesh };
    this.bondMeshes.set(bondModel.id, record);
    this.updateBondMesh(bondModel.id, atomA, atomB);
    return record;
  }

  updateBondMesh(bondId, atomA, atomB) {
    const record = this.bondMeshes.get(bondId);
    if (!record) return false;

    if (!atomA || !atomB) {
      record.mesh.visible = false;
      return false;
    }

    const pA = atomA.position;
    const pB = atomB.position;
    const dir = pB.clone().sub(pA);
    const dist = dir.length();

    if (dist < 0.001) {
      record.mesh.visible = false;
      return true;
    }

    record.mesh.visible = true;
    record.mesh.position.copy(pA);
    record.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    record.mesh.scale.set(1, dist, 1);
    return true;
  }

  updateAllBonds(bonds, getAtomFn) {
    bonds.forEach(bond => {
      const atomA = getAtomFn(bond.atomAId);
      const atomB = getAtomFn(bond.atomBId);
      if (!this.bondMeshes.has(bond.id)) {
        this.addBondMesh(bond, atomA, atomB);
      } else {
        this.updateBondMesh(bond.id, atomA, atomB);
      }
    });

    // Remove any orphaned meshes
    const currentBondIds = new Set(bonds.map(b => b.id));
    this.bondMeshes.forEach((record, id) => {
      if (!currentBondIds.has(id)) {
        this.removeBondMesh(id);
      }
    });
  }

  removeBondMesh(bondId) {
    const record = this.bondMeshes.get(bondId);
    if (!record) return;
    this.covalentBondsGroup.remove(record.mesh);
    this.bondMeshes.delete(bondId);
  }

  clearAll() {
    while (this.covalentBondsGroup.children.length > 0) {
      this.covalentBondsGroup.remove(this.covalentBondsGroup.children[0]);
    }
    this.bondMeshes.clear();
  }
}
