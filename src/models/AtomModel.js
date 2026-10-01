/**
 * AtomModel
 * Pure domain model representing a single atom and its orbital configuration.
 */

export class AtomModel {
  constructor(options = {}) {
    this.id = options.id || ('atom_' + Math.random().toString(36).substr(2, 9));
    this.name = options.name || 'C1';
    this.element = (options.element || 'C').toUpperCase();
    this.color = options.color || '#334155';
    this.radius = options.radius !== undefined ? options.radius : 0.45;
    this.orbitalType = options.orbitalType || 'none';
    this.showArrangement = options.showArrangement || false;
    this.showNodalPlanes = options.showNodalPlanes || false;
    this.isSelected = options.isSelected || false;

    // Vector3 and Euler for position & rotation
    this.position = options.position ? options.position.clone() : new THREE.Vector3(0, 0, 0);
    this.rotation = options.rotation ? options.rotation.clone() : new THREE.Euler(0, 0, 0, 'XYZ');
  }

  setPosition(x, y, z) {
    if (x instanceof THREE.Vector3) {
      this.position.copy(x);
    } else {
      this.position.set(x, y, z);
    }
  }

  setRotation(rx, ry, rz) {
    if (rx instanceof THREE.Euler) {
      this.rotation.copy(rx);
    } else {
      this.rotation.set(rx, ry, rz, 'XYZ');
    }
  }

  setRotationDegrees(dx, dy, dz) {
    const toRad = Math.PI / 180;
    this.setRotation(dx * toRad, dy * toRad, dz * toRad);
  }

  setColor(colorHex) {
    this.color = colorHex;
  }

  setRadius(r) {
    this.radius = Math.max(0.05, r);
  }

  setOrbitalType(type) {
    this.orbitalType = type;
  }

  setShowArrangement(show) {
    this.showArrangement = !!show;
  }

  setShowNodalPlanes(show) {
    this.showNodalPlanes = !!show;
  }

  setSelected(selected) {
    this.isSelected = !!selected;
  }

  clone() {
    return new AtomModel({
      id: 'atom_' + Math.random().toString(36).substr(2, 9),
      name: this.name,
      element: this.element,
      color: this.color,
      radius: this.radius,
      orbitalType: this.orbitalType,
      showArrangement: this.showArrangement,
      showNodalPlanes: this.showNodalPlanes,
      position: this.position.clone(),
      rotation: this.rotation.clone(),
      isSelected: false
    });
  }
}
