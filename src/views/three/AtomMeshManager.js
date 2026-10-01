/**
 * AtomMeshManager
 * Manages Three.js 3D meshes for all atoms: nucleus sphere, selection ring,
 * orbital mesh cloud, and the local axes helper for the selected atom.
 */
import { COLOR_SELECTION_RING } from '../../constants/Orbitals.js';

export class AtomMeshManager {
  constructor(scene, orbitalFactory) {
    this.scene = scene;
    this.orbitalFactory = orbitalFactory;
    this.atomMeshes = new Map(); // atomId -> { group, nucleusMesh, selectionRing, orbitalGroup, atomModel }

    // Selected atom local coordinate axes helper
    this.selectedAtomAxes = this._createAxesHelper();
    this.scene.add(this.selectedAtomAxes);
  }

  _createAxesHelper() {
    const group = new THREE.Group();
    group.name = "selected-atom-axes-group";
    group.visible = false;

    const axisLength = 1.85;
    const arrowHeadLen = 0.35;
    const arrowHeadWid = 0.16;

    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), axisLength, 0xef4444, arrowHeadLen, arrowHeadWid);
    const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), axisLength, 0x10b981, arrowHeadLen, arrowHeadWid);
    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), axisLength, 0x38bdf8, arrowHeadLen, arrowHeadWid);

    function makeAxisLabelSprite(text, color) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 36px "JetBrains Mono", sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 32);
      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.35, 0.35, 1);
      return sprite;
    }

    const labelX = makeAxisLabelSprite('+X', '#ef4444');
    labelX.position.set(axisLength + 0.22, 0, 0);
    const labelY = makeAxisLabelSprite('+Y', '#10b981');
    labelY.position.set(0, axisLength + 0.22, 0);
    const labelZ = makeAxisLabelSprite('+Z', '#38bdf8');
    labelZ.position.set(0, 0, axisLength + 0.22);

    group.add(arrowX);
    group.add(arrowY);
    group.add(arrowZ);
    group.add(labelX);
    group.add(labelY);
    group.add(labelZ);

    return group;
  }

  addAtomMesh(atomModel, options = {}) {
    const group = new THREE.Group();
    group.name = `atom-group-${atomModel.id}`;
    group.position.copy(atomModel.position);
    group.rotation.copy(atomModel.rotation);
    group.userData.atomId = atomModel.id;
    group.userData.atomModel = atomModel;

    // 1. Nucleus Mesh
    const nucleusGeom = new THREE.SphereGeometry(atomModel.radius, 32, 32);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(atomModel.color),
      roughness: 0.35,
      metalness: 0.15
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeom, nucleusMat);
    nucleusMesh.castShadow = true;
    nucleusMesh.receiveShadow = true;
    nucleusMesh.userData.isNucleus = true;
    nucleusMesh.userData.atomId = atomModel.id;
    group.add(nucleusMesh);

    // 2. Selection Ring
    const ringGeom = new THREE.RingGeometry(atomModel.radius * 1.3, atomModel.radius * 1.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLOR_SELECTION_RING,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const selectionRing = new THREE.Mesh(ringGeom, ringMat);
    selectionRing.visible = atomModel.isSelected;
    group.add(selectionRing);

    // 3. Orbital Cloud Mesh Group
    const orbitalGroup = this.orbitalFactory.generateOrbitalObject(
      atomModel.orbitalType,
      atomModel.showArrangement,
      atomModel.showNodalPlanes,
      options
    );
    group.add(orbitalGroup);

    this.scene.add(group);

    const record = {
      group,
      nucleusMesh,
      selectionRing,
      orbitalGroup,
      atomModel
    };
    this.atomMeshes.set(atomModel.id, record);
    return record;
  }

  updateAtomMesh(atomModel, options = {}) {
    const record = this.atomMeshes.get(atomModel.id);
    if (!record) return this.addAtomMesh(atomModel, options);

    // Update transform
    record.group.position.copy(atomModel.position);
    record.group.rotation.copy(atomModel.rotation);

    // Update color
    record.nucleusMesh.material.color.set(atomModel.color);

    // Update radius
    if (record.nucleusMesh.geometry.parameters.radius !== atomModel.radius) {
      record.nucleusMesh.geometry.dispose();
      record.nucleusMesh.geometry = new THREE.SphereGeometry(atomModel.radius, 32, 32);

      record.selectionRing.geometry.dispose();
      record.selectionRing.geometry = new THREE.RingGeometry(atomModel.radius * 1.3, atomModel.radius * 1.45, 32);
    }

    // Update selection
    record.selectionRing.visible = atomModel.isSelected;

    // Rebuild orbital mesh
    record.group.remove(record.orbitalGroup);
    record.orbitalGroup = this.orbitalFactory.generateOrbitalObject(
      atomModel.orbitalType,
      atomModel.showArrangement,
      atomModel.showNodalPlanes,
      options
    );
    record.group.add(record.orbitalGroup);
  }

  removeAtomMesh(atomId) {
    const record = this.atomMeshes.get(atomId);
    if (!record) return;

    this.scene.remove(record.group);
    record.nucleusMesh.geometry.dispose();
    record.nucleusMesh.material.dispose();
    record.selectionRing.geometry.dispose();
    record.selectionRing.material.dispose();
    this.atomMeshes.delete(atomId);
  }

  updateSelection(selectedIds, primaryAtom) {
    this.atomMeshes.forEach((record, id) => {
      record.selectionRing.visible = selectedIds.has(id);
    });

    if (primaryAtom) {
      this.selectedAtomAxes.visible = true;
      this.selectedAtomAxes.position.copy(primaryAtom.position);
      this.selectedAtomAxes.rotation.copy(primaryAtom.rotation);
    } else {
      this.selectedAtomAxes.visible = false;
    }
  }

  rebuildAllOrbitals(options = {}) {
    this.atomMeshes.forEach((record) => {
      record.group.remove(record.orbitalGroup);
      record.orbitalGroup = this.orbitalFactory.generateOrbitalObject(
        record.atomModel.orbitalType,
        record.atomModel.showArrangement,
        record.atomModel.showNodalPlanes,
        options
      );
      record.group.add(record.orbitalGroup);
    });
  }

  getAtomFromMesh(mesh) {
    let curr = mesh;
    while (curr) {
      if (curr.userData && curr.userData.atomModel) {
        return curr.userData.atomModel;
      }
      if (curr.userData && curr.userData.atomId) {
        const rec = this.atomMeshes.get(curr.userData.atomId);
        if (rec) return rec.atomModel;
      }
      curr = curr.parent;
    }
    return null;
  }

  getAllLobeMeshes() {
    const lobes = [];
    this.atomMeshes.forEach(record => {
      record.group.traverse(child => {
        if (child.isMesh && child.userData && child.userData.isLobe) {
          lobes.push(child);
        }
      });
    });
    return lobes;
  }

  getAllNucleusMeshes() {
    const nucleuses = [];
    this.atomMeshes.forEach(record => {
      nucleuses.push(record.nucleusMesh);
    });
    return nucleuses;
  }

  clearAll() {
    this.atomMeshes.forEach((record) => {
      this.scene.remove(record.group);
    });
    this.atomMeshes.clear();
    this.selectedAtomAxes.visible = false;
  }
}
