/**
 * BridgeMeshManager
 * Manages 3D representations of pi-bond bridges (bonding tubes, antibonding nodal planes,
 * aromatic delocalized torus rings, and billboard text sprites).
 */
import { COLOR_POS_PHASE, COLOR_NEG_PHASE } from '../../constants/Orbitals.js';

export class BridgeMeshManager {
  constructor(scene, orbitalFactory) {
    this.scene = scene;
    this.orbitalFactory = orbitalFactory;
    this.bridgeGroup = new THREE.Group();
    this.bridgeGroup.name = "pi-bonds-bridge-group";
    this.scene.add(this.bridgeGroup);
  }

  makeTextSprite(message, color = '#84cc16') {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(8, 8, 364, 64, 12);
    } else {
      ctx.rect(8, 8, 364, 64);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 21px "JetBrains Mono", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, 190, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.9, 0.40, 1);
    return sprite;
  }

  createPiBridgePair(atomA, atomB, axisVector = new THREE.Vector3(0, 0, 1), labelText = 'π (Bonding)', opacity = 0.15) {
    if (!atomA || !atomB) return;
    const pA = atomA.position.clone();
    const pB = atomB.position.clone();
    const dist = pA.distanceTo(pB);
    if (dist < 0.2 || dist > 6.0) return;

    const norm = axisVector.clone().normalize();
    const hPeak = 1.05; // Center of demi-sphere lobe head

    // 1. Top Lobe Bridge (+ phase, Red)
    const topA = pA.clone().add(norm.clone().multiplyScalar(hPeak));
    const topB = pB.clone().add(norm.clone().multiplyScalar(hPeak));
    const topMid = topA.clone().add(topB).multiplyScalar(0.5).add(norm.clone().multiplyScalar(0.18));

    const topCurve = new THREE.CatmullRomCurve3([topA, topMid, topB]);
    const topTubeGeom = new THREE.TubeGeometry(topCurve, 24, 0.36, 16, false);
    const topTubeMat = this.orbitalFactory.createOrbitalMaterial(COLOR_POS_PHASE, Math.max(0.22, opacity * 1.4));
    const topTubeMesh = new THREE.Mesh(topTubeGeom, topTubeMat);
    this.bridgeGroup.add(topTubeMesh);

    // 2. Bottom Lobe Bridge (- phase, Blue)
    const botA = pA.clone().sub(norm.clone().multiplyScalar(hPeak));
    const botB = pB.clone().sub(norm.clone().multiplyScalar(hPeak));
    const botMid = botA.clone().add(botB).multiplyScalar(0.5).sub(norm.clone().multiplyScalar(0.18));

    const botCurve = new THREE.CatmullRomCurve3([botA, botMid, botB]);
    const botTubeGeom = new THREE.TubeGeometry(botCurve, 24, 0.36, 16, false);
    const botTubeMat = this.orbitalFactory.createOrbitalMaterial(COLOR_NEG_PHASE, Math.max(0.22, opacity * 1.4));
    const botTubeMesh = new THREE.Mesh(botTubeGeom, botTubeMat);
    this.bridgeGroup.add(botTubeMesh);

    // 3. Central Axis Dashed Guide Lines (Green)
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0x84cc16,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.95
    });

    const topDashedGeom = new THREE.BufferGeometry().setFromPoints([topA, topB]);
    const topDashedLine = new THREE.Line(topDashedGeom, dashedMat);
    topDashedLine.computeLineDistances();
    this.bridgeGroup.add(topDashedLine);

    const botDashedGeom = new THREE.BufferGeometry().setFromPoints([botA, botB]);
    const botDashedLine = new THREE.Line(botDashedGeom, dashedMat);
    botDashedLine.computeLineDistances();
    this.bridgeGroup.add(botDashedLine);

    // 4. Billboard π Label Sprite
    if (labelText) {
      const sprite = this.makeTextSprite(labelText, '#84cc16');
      sprite.position.copy(topMid.clone().add(norm.clone().multiplyScalar(0.35)));
      this.bridgeGroup.add(sprite);
    }
  }

  createAntibondingNodalPair(atomA, atomB, axisVector = new THREE.Vector3(0, 0, 1), labelText = 'π* (Antibonding)') {
    if (!atomA || !atomB) return;
    const pA = atomA.position.clone();
    const pB = atomB.position.clone();
    const dist = pA.distanceTo(pB);
    if (dist < 0.2 || dist > 6.0) return;

    const norm = axisVector.clone().normalize();
    const bondDir = pB.clone().sub(pA).normalize();
    const midPoint = pA.clone().add(pB).multiplyScalar(0.5);

    // 1. Vertical Nodal Plane (Pink translucent sheet)
    const vertPlaneGeom = new THREE.PlaneGeometry(3.0, 3.4);
    const vertPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const vertPlaneMesh = new THREE.Mesh(vertPlaneGeom, vertPlaneMat);
    vertPlaneMesh.position.copy(midPoint);
    vertPlaneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bondDir);
    this.bridgeGroup.add(vertPlaneMesh);

    const vertEdgesGeom = new THREE.EdgesGeometry(vertPlaneGeom);
    const vertEdgesMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85 });
    vertPlaneMesh.add(new THREE.LineSegments(vertEdgesGeom, vertEdgesMat));

    // 2. Billboard π* Label Sprite
    if (labelText) {
      const sprite = this.makeTextSprite(labelText, '#f43f5e');
      sprite.position.copy(midPoint.clone().add(norm.clone().multiplyScalar(1.95)));
      this.bridgeGroup.add(sprite);
    }
  }

  createAromaticDelocalizedRing(centerPos, radius = 1.95, zHeight = 1.15, opacity = 0.15) {
    const pos = centerPos || new THREE.Vector3(0, 0, 0);

    const upperTorusGeom = new THREE.TorusGeometry(radius, 0.38, 24, 48);
    const upperTorusMat = this.orbitalFactory.createOrbitalMaterial(COLOR_POS_PHASE, Math.max(0.20, opacity * 1.4));
    const upperTorusMesh = new THREE.Mesh(upperTorusGeom, upperTorusMat);
    upperTorusMesh.position.copy(pos).add(new THREE.Vector3(0, 0, zHeight));
    this.bridgeGroup.add(upperTorusMesh);

    const lowerTorusGeom = new THREE.TorusGeometry(radius, 0.38, 24, 48);
    const lowerTorusMat = this.orbitalFactory.createOrbitalMaterial(COLOR_NEG_PHASE, Math.max(0.20, opacity * 1.4));
    const lowerTorusMesh = new THREE.Mesh(lowerTorusGeom, lowerTorusMat);
    lowerTorusMesh.position.copy(pos).add(new THREE.Vector3(0, 0, -zHeight));
    this.bridgeGroup.add(lowerTorusMesh);

    const sprite = this.makeTextSprite('Delocalized π-Ring (6 e⁻)', '#38bdf8');
    sprite.position.copy(pos).add(new THREE.Vector3(0, 0, zHeight + 0.65));
    this.bridgeGroup.add(sprite);
  }

  drawBondLine(p1, p2, color = 0x64748b, dashed = false) {
    const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    let line;
    if (dashed) {
      const mat = new THREE.LineDashedMaterial({ color: color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.85 });
      line = new THREE.Line(geom, mat);
      line.computeLineDistances();
    } else {
      const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.75, linewidth: 2 });
      line = new THREE.Line(geom, mat);
    }
    this.bridgeGroup.add(line);
    return line;
  }

  renderBridges(bridges, getAtomFn, opacity = 0.15) {
    this.clearAll();

    bridges.forEach(b => {
      if (b.type === 'delocalized_ring') {
        this.createAromaticDelocalizedRing(b.centerPos, b.radius, b.zHeight, opacity);
      } else {
        const atomA = getAtomFn(b.atomAId);
        const atomB = getAtomFn(b.atomBId);
        if (!atomA || !atomB) return;

        if (b.type === 'bonding') {
          this.createPiBridgePair(atomA, atomB, b.normDir, b.labelText, opacity);
        } else if (b.type === 'antibonding') {
          this.createAntibondingNodalPair(atomA, atomB, b.normDir, b.labelText);
        }
      }
    });
  }

  clearAll() {
    while (this.bridgeGroup.children.length > 0) {
      const obj = this.bridgeGroup.children[0];
      this.bridgeGroup.remove(obj);
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
  }
}
