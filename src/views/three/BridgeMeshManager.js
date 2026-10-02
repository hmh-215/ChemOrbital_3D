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

  createPiBridgePair(atomA, atomB, axisVector = new THREE.Vector3(0, 0, 1), labelText = 'π (Bonding)', opacity = 0.15, lobePairs = null) {
    if (!atomA || !atomB) return;
    const pA = atomA.position.clone();
    const pB = atomB.position.clone();
    const dist = pA.distanceTo(pB);
    if (dist < 0.2 || dist > 6.5) return;

    const norm = axisVector ? axisVector.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const hPeak = 1.05; // Center of demi-sphere lobe head

    let topA, topB, botA, botB;

    if (lobePairs && lobePairs.length >= 2) {
      topA = lobePairs[0].posA.clone();
      topB = lobePairs[0].posB.clone();
      botA = lobePairs[1].posA.clone();
      botB = lobePairs[1].posB.clone();
    } else {
      topA = pA.clone().add(norm.clone().multiplyScalar(hPeak));
      topB = pB.clone().add(norm.clone().multiplyScalar(hPeak));
      botA = pA.clone().sub(norm.clone().multiplyScalar(hPeak));
      botB = pB.clone().sub(norm.clone().multiplyScalar(hPeak));
    }

    // 1. Top Lobe Bridge (+ phase, Red)
    const topMid = topA.clone().add(topB).multiplyScalar(0.5).add(norm.clone().multiplyScalar(0.18));
    const topCurve = new THREE.CatmullRomCurve3([topA, topMid, topB]);
    const topTubeGeom = new THREE.TubeGeometry(topCurve, 24, 0.36, 16, false);
    const topTubeMat = this.orbitalFactory.createOrbitalMaterial(COLOR_POS_PHASE, Math.max(0.22, opacity * 1.4));
    const topTubeMesh = new THREE.Mesh(topTubeGeom, topTubeMat);
    this.bridgeGroup.add(topTubeMesh);

    // 2. Bottom Lobe Bridge (- phase, Blue)
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
    if (dist < 0.2 || dist > 6.5) return;

    const norm = axisVector ? axisVector.clone().normalize() : new THREE.Vector3(0, 0, 1);
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

  createDeltaBridgeQuad(atomA, atomB, deltaNorms = null, labelText = 'δ (Bonding)', opacity = 0.15, lobePairs = null) {
    if (!atomA || !atomB) return;
    const pA = atomA.position.clone();
    const pB = atomB.position.clone();
    const dist = pA.distanceTo(pB);
    if (dist < 0.2 || dist > 6.5) return;

    const midPoint = pA.clone().add(pB).multiplyScalar(0.5);
    const bondDir = pB.clone().sub(pA).normalize();

    const dashedMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.95
    });

    if (lobePairs && lobePairs.length >= 4) {
      lobePairs.forEach(pair => {
        const ptA = pair.posA.clone();
        const ptB = pair.posB.clone();
        const radialA = ptA.clone().sub(pA);
        const radialB = ptB.clone().sub(pB);
        const radialAvg = radialA.add(radialB).multiplyScalar(0.5).normalize();
        const ptMid = ptA.clone().add(ptB).multiplyScalar(0.5).add(radialAvg.multiplyScalar(0.18));

        const curve = new THREE.CatmullRomCurve3([ptA, ptMid, ptB]);
        const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.32, 16, false);
        const color = pair.phase === 1 ? COLOR_POS_PHASE : COLOR_NEG_PHASE;
        const tubeMat = this.orbitalFactory.createOrbitalMaterial(color, Math.max(0.22, opacity * 1.4));
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        this.bridgeGroup.add(tubeMesh);

        const dashedGeom = new THREE.BufferGeometry().setFromPoints([ptA, ptB]);
        const dashedLine = new THREE.Line(dashedGeom, dashedMat);
        dashedLine.computeLineDistances();
        this.bridgeGroup.add(dashedLine);
      });
    }

    if (labelText) {
      const sprite = this.makeTextSprite(labelText, '#38bdf8');
      let upDir = new THREE.Vector3(0, 1, 0);
      if (Math.abs(bondDir.y) > 0.8) upDir = new THREE.Vector3(0, 0, 1);
      const perp = upDir.sub(bondDir.clone().multiplyScalar(upDir.dot(bondDir))).normalize();
      sprite.position.copy(midPoint.clone().add(perp.multiplyScalar(1.55)));
      this.bridgeGroup.add(sprite);
    }
  }

  createDeltaAntibondingNodalPair(atomA, atomB, deltaNorms = null, labelText = 'δ* (Antibonding)') {
    if (!atomA || !atomB) return;
    const pA = atomA.position.clone();
    const pB = atomB.position.clone();
    const midPoint = pA.clone().add(pB).multiplyScalar(0.5);
    const bondDir = pB.clone().sub(pA).normalize();

    // Plane 1: Transverse plane bisecting the internuclear bond
    const planeGeom = new THREE.PlaneGeometry(3.0, 3.0);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const plane1 = new THREE.Mesh(planeGeom, planeMat);
    plane1.position.copy(midPoint);
    plane1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bondDir);
    this.bridgeGroup.add(plane1);

    // Plane 2: Longitudinal plane containing the bond
    let upDir = new THREE.Vector3(0, 1, 0);
    if (Math.abs(bondDir.y) > 0.8) upDir = new THREE.Vector3(1, 0, 0);
    const longDir = upDir.sub(bondDir.clone().multiplyScalar(upDir.dot(bondDir))).normalize();

    const plane2 = new THREE.Mesh(planeGeom, planeMat);
    plane2.position.copy(midPoint);
    plane2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), longDir);
    this.bridgeGroup.add(plane2);

    if (labelText) {
      const sprite = this.makeTextSprite(labelText, '#f43f5e');
      sprite.position.copy(midPoint.clone().add(longDir.clone().multiplyScalar(1.85)));
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
          this.createPiBridgePair(atomA, atomB, b.normDir, b.labelText, opacity, b.lobePairs);
        } else if (b.type === 'antibonding') {
          this.createAntibondingNodalPair(atomA, atomB, b.normDir, b.labelText);
        } else if (b.type === 'delta_bonding') {
          this.createDeltaBridgeQuad(atomA, atomB, b.deltaNorms, b.labelText, opacity, b.lobePairs);
        } else if (b.type === 'delta_antibonding') {
          this.createDeltaAntibondingNodalPair(atomA, atomB, b.deltaNorms, b.labelText);
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
