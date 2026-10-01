/**
 * OrbitalMeshFactory
 * Factory for creating 3D WebGL meshes of orbitals, teardrop lobes,
 * VSEPR geometric arrangement envelopes, and nodal surfaces.
 */
import { COLOR_POS_PHASE, COLOR_NEG_PHASE } from '../../constants/Orbitals.js';

export class OrbitalMeshFactory {
  constructor() {
    // Shared geometry caches using teardrop profile
    this.cachedHybridLobeGeom = this.createTeardropLobeGeometry(1.65, 0.62, 1.45);
    this.cachedPLobeGeom = this.createTeardropLobeGeometry(1.55, 0.58, 1.35);
    this.cachedDLobeGeom = this.createTeardropLobeGeometry(1.50, 0.54, 1.40);
    this.cachedMinorLobeGeom = this.createTeardropLobeGeometry(0.42, 0.20, 1.35);
    this.cachedUnhybridPGeom = this.createTeardropLobeGeometry(1.50, 0.50, 1.35);
  }

  createTeardropLobeGeometry(length = 1.65, maxRadius = 0.62, stemPower = 1.45, segments = 36) {
    const points = [];
    const steps = 40;
    const rCap = maxRadius; // Radius of spherical dome cap
    const stemLen = Math.max(0.15, length - rCap);

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps; // 0 to 1
      const y = frac * length;
      let r = 0;

      if (y <= stemLen) {
        // Tapered stem: pinched neck at nucleus (y = 0), smoothly widening outwards
        const u = y / stemLen; // 0 to 1
        r = maxRadius * Math.pow(u, stemPower);
      } else {
        // Hemispherical dome cap: perfectly rounded outer head (no cone tip!)
        const s = Math.min(1, (y - stemLen) / rCap); // 0 to 1
        r = maxRadius * Math.sqrt(Math.max(0, 1 - s * s));
      }

      points.push(new THREE.Vector2(Math.max(0, r), y));
    }

    return new THREE.LatheGeometry(points, segments);
  }

  createOrbitalMaterial(color, opacity, wireframe = false) {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.2,
      ior: 1.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      wireframe: wireframe
    });
  }

  buildOrientedLobe(dir, isPositivePhase = true, lobeKind = 'hybrid', opacity = 0.15, customScale = 1.0) {
    let geom = this.cachedHybridLobeGeom;
    if (lobeKind === 'p') geom = this.cachedPLobeGeom;
    else if (lobeKind === 'd') geom = this.cachedDLobeGeom;
    else if (lobeKind === 'minor') geom = this.cachedMinorLobeGeom;
    else if (lobeKind === 'unhybrid') geom = this.cachedUnhybridPGeom;

    const color = isPositivePhase ? COLOR_POS_PHASE : COLOR_NEG_PHASE;
    const mat = this.createOrbitalMaterial(color, opacity);
    const mesh = new THREE.Mesh(geom, mat);

    // Orient from default +Y axis to `dir`
    const normalizedDir = dir.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
    mesh.quaternion.copy(quaternion);

    if (customScale !== 1.0) {
      mesh.scale.setScalar(customScale);
    }

    // Quick Build attachment metadata
    mesh.userData.isLobe = true;
    mesh.userData.localDir = normalizedDir.clone();
    mesh.userData.lobeKind = lobeKind;
    mesh.userData.phase = isPositivePhase ? 1 : -1;

    return mesh;
  }

  createPlanarNodalSurface(normalDir, size = 3.6) {
    const planeGroup = new THREE.Group();
    planeGroup.name = "planar-nodal-surface";

    const planeGeom = new THREE.PlaneGeometry(size, size);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeGroup.add(planeMesh);

    // Clean perimeter border edge lines
    const edgesGeom = new THREE.EdgesGeometry(planeGeom);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65
    });
    const edgesMesh = new THREE.LineSegments(edgesGeom, edgesMat);
    planeGroup.add(edgesMesh);

    // Orient normal: PlaneGeometry default normal is (0, 0, 1)
    const norm = normalDir.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
    planeGroup.quaternion.copy(quat);

    return planeGroup;
  }

  createDz2NodalCones(height = 1.6) {
    const coneGroup = new THREE.Group();
    coneGroup.name = "dz2-conical-nodal-surfaces";

    const radius = height * Math.SQRT2;
    const radialSegs = 48;

    // Apex at (0,0,0), base at (0,-height,0)
    const coneGeom = new THREE.ConeGeometry(radius, height, radialSegs, 1, true);
    coneGeom.translate(0, -height / 2, 0);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Rim circle wire geometry around base at y = -height
    const rimGeom = new THREE.BufferGeometry();
    const rimPts = [];
    for (let i = 0; i <= radialSegs; i++) {
      const th = (i / radialSegs) * Math.PI * 2;
      rimPts.push(new THREE.Vector3(Math.cos(th) * radius, -height, Math.sin(th) * radius));
    }
    rimGeom.setFromPoints(rimPts);
    const rimMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65
    });

    // Top Cone: apex at origin, opens along +Z
    const topCone = new THREE.Group();
    topCone.add(new THREE.Mesh(coneGeom, coneMat));
    topCone.add(new THREE.Line(rimGeom, rimMat));
    topCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1));
    coneGroup.add(topCone);

    // Bottom Cone: apex at origin, opens along -Z
    const bottomCone = new THREE.Group();
    bottomCone.add(new THREE.Mesh(coneGeom, coneMat));
    bottomCone.add(new THREE.Line(rimGeom, rimMat));
    bottomCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));
    coneGroup.add(bottomCone);

    return coneGroup;
  }

  createArrangementOutline(orbitalType) {
    const outlineGroup = new THREE.Group();
    outlineGroup.name = "arrangement-outline-group";

    const lobeLen = 1.65;
    const edgeColor = 0x84cc16; // Chartreuse / light green dashed lines
    const faceColor = 0xfbbf24; // Amber / golden warm translucent face fill
    const faceOpacity = 0.16;

    const dashedMat = new THREE.LineDashedMaterial({
      color: edgeColor,
      dashSize: 0.14,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.95
    });

    const faceMat = new THREE.MeshBasicMaterial({
      color: faceColor,
      transparent: true,
      opacity: faceOpacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    function addDashedEdges(edges, vertices) {
      const pts = [];
      edges.forEach(([i, j]) => {
        pts.push(vertices[i], vertices[j]);
      });
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineSegs = new THREE.LineSegments(geom, dashedMat);
      lineSegs.computeLineDistances();
      outlineGroup.add(lineSegs);
    }

    function addFaceMesh(faceIndices, vertices) {
      const positions = [];
      faceIndices.forEach(([i, j, k]) => {
        positions.push(
          vertices[i].x, vertices[i].y, vertices[i].z,
          vertices[j].x, vertices[j].y, vertices[j].z,
          vertices[k].x, vertices[k].y, vertices[k].z
        );
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();
      outlineGroup.add(new THREE.Mesh(geom, faceMat));
    }

    function addVertexDots(vertices) {
      const dotGeom = new THREE.SphereGeometry(0.045, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: edgeColor });
      vertices.forEach(v => {
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.copy(v);
        outlineGroup.add(dot);
      });
    }

    if (orbitalType === 'sp') {
      const v0 = new THREE.Vector3( lobeLen, 0, 0);
      const v1 = new THREE.Vector3(-lobeLen, 0, 0);
      const vertices = [v0, v1];
      addDashedEdges([[0, 1]], vertices);
      addVertexDots(vertices);
    } else if (orbitalType === 'sp2') {
      const v0 = new THREE.Vector3(Math.cos(0) * lobeLen, Math.sin(0) * lobeLen, 0);
      const v1 = new THREE.Vector3(Math.cos(2 * Math.PI / 3) * lobeLen, Math.sin(2 * Math.PI / 3) * lobeLen, 0);
      const v2 = new THREE.Vector3(Math.cos(4 * Math.PI / 3) * lobeLen, Math.sin(4 * Math.PI / 3) * lobeLen, 0);
      const vertices = [v0, v1, v2];

      addDashedEdges([[0, 1], [1, 2], [2, 0]], vertices);
      addFaceMesh([[0, 1, 2]], vertices);
      addVertexDots(vertices);
    } else if (orbitalType === 'sp3') {
      const tetraDirs = [
        new THREE.Vector3( 1,  1,  1).normalize(),
        new THREE.Vector3(-1, -1,  1).normalize(),
        new THREE.Vector3(-1,  1, -1).normalize(),
        new THREE.Vector3( 1, -1, -1).normalize()
      ];
      const vertices = tetraDirs.map(d => d.clone().multiplyScalar(lobeLen));
      const edges = [
        [0, 1], [0, 2], [0, 3],
        [1, 2], [2, 3], [3, 1]
      ];
      const faces = [
        [0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]
      ];

      addDashedEdges(edges, vertices);
      addFaceMesh(faces, vertices);
      addVertexDots(vertices);
    } else if (orbitalType === 'sp3d') {
      const vertices = [
        new THREE.Vector3(Math.cos(0) * lobeLen, Math.sin(0) * lobeLen, 0),
        new THREE.Vector3(Math.cos(2 * Math.PI / 3) * lobeLen, Math.sin(2 * Math.PI / 3) * lobeLen, 0),
        new THREE.Vector3(Math.cos(4 * Math.PI / 3) * lobeLen, Math.sin(4 * Math.PI / 3) * lobeLen, 0),
        new THREE.Vector3(0, 0,  lobeLen), // 3: Top (+Z)
        new THREE.Vector3(0, 0, -lobeLen)  // 4: Bottom (-Z)
      ];
      const edges = [
        [0, 1], [1, 2], [2, 0],
        [3, 0], [3, 1], [3, 2],
        [4, 0], [4, 1], [4, 2]
      ];
      const faces = [
        [3, 0, 1], [3, 1, 2], [3, 2, 0],
        [4, 1, 0], [4, 2, 1], [4, 0, 2]
      ];

      addDashedEdges(edges, vertices);
      addFaceMesh(faces, vertices);
      addVertexDots(vertices);
    } else if (orbitalType === 'sp3d2') {
      const vertices = [
        new THREE.Vector3( lobeLen, 0, 0),
        new THREE.Vector3(-lobeLen, 0, 0),
        new THREE.Vector3(0,  lobeLen, 0),
        new THREE.Vector3(0, -lobeLen, 0),
        new THREE.Vector3(0, 0,  lobeLen),
        new THREE.Vector3(0, 0, -lobeLen)
      ];
      const edges = [
        [0, 2], [2, 1], [1, 3], [3, 0],
        [4, 0], [4, 2], [4, 1], [4, 3],
        [5, 0], [5, 2], [5, 1], [5, 3]
      ];
      const faces = [
        [4, 0, 2], [4, 2, 1], [4, 1, 3], [4, 3, 0],
        [5, 2, 0], [5, 1, 2], [5, 3, 1], [5, 0, 3]
      ];

      addDashedEdges(edges, vertices);
      addFaceMesh(faces, vertices);
      addVertexDots(vertices);
    }

    return outlineGroup;
  }

  generateOrbitalObject(orbitalType, showArrangement = false, showNodalPlanes = false, options = {}) {
    const opacity = options.orbitalOpacity !== undefined ? options.orbitalOpacity : 0.15;
    const scale = options.orbitalScale !== undefined ? options.orbitalScale : 1.0;
    const showBackLobes = options.showBackLobes !== undefined ? options.showBackLobes : false;
    const showUnhybridP = options.showUnhybridP !== undefined ? options.showUnhybridP : true;

    const group = new THREE.Group();
    group.name = "orbital-mesh-group";

    if (orbitalType === 'none') {
      return group;
    }

    // --- s orbital ---
    if (orbitalType === 's') {
      const radius = 0.68;
      const geom = new THREE.SphereGeometry(radius, 36, 36);
      const mat = this.createOrbitalMaterial(COLOR_POS_PHASE, opacity);
      const sphere = new THREE.Mesh(geom, mat);
      group.add(sphere);
    }

    // --- p orbitals (px, py, pz, p_all) ---
    else if (orbitalType === 'px' || orbitalType === 'py' || orbitalType === 'pz' || orbitalType === 'p_all') {
      const axes = [];
      if (orbitalType === 'px' || orbitalType === 'p_all') axes.push({ dir: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(1, 0, 0) });
      if (orbitalType === 'py' || orbitalType === 'p_all') axes.push({ dir: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3(0, 1, 0) });
      if (orbitalType === 'pz' || orbitalType === 'p_all') axes.push({ dir: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(0, 0, 1) });

      axes.forEach(axis => {
        group.add(this.buildOrientedLobe(axis.dir, true, 'p', opacity));
        group.add(this.buildOrientedLobe(axis.dir.clone().negate(), false, 'p', opacity));

        if (showNodalPlanes) {
          group.add(this.createPlanarNodalSurface(axis.normal));
        }
      });
    }

    // --- sp Hybridization ---
    else if (orbitalType === 'sp') {
      const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
      dirs.forEach((d) => {
        group.add(this.buildOrientedLobe(d, true, 'hybrid', opacity));
        if (showBackLobes) {
          group.add(this.buildOrientedLobe(d.clone().negate(), false, 'minor', opacity));
        }
      });

      if (showUnhybridP) {
        [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].forEach(pDir => {
          const pGroup = new THREE.Group();
          const pMatPos = this.createOrbitalMaterial(COLOR_POS_PHASE, Math.max(0.20, opacity * 1.5));
          const pMatNeg = this.createOrbitalMaterial(COLOR_NEG_PHASE, Math.max(0.20, opacity * 1.5));
          const m1 = new THREE.Mesh(this.cachedUnhybridPGeom, pMatPos);
          const m2 = new THREE.Mesh(this.cachedUnhybridPGeom, pMatNeg);
          m1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir);
          m2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir.clone().negate());
          m1.userData.isLobe = true;
          m1.userData.localDir = pDir.clone();
          m1.userData.phase = 1;
          m1.userData.lobeKind = 'unhybrid';
          m2.userData.isLobe = true;
          m2.userData.localDir = pDir.clone().negate();
          m2.userData.phase = -1;
          m2.userData.lobeKind = 'unhybrid';
          pGroup.add(m1);
          pGroup.add(m2);
          group.add(pGroup);
        });
      }
    }

    // --- sp² Hybridization ---
    else if (orbitalType === 'sp2') {
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      angles.forEach(ang => {
        const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
        group.add(this.buildOrientedLobe(dir, true, 'hybrid', opacity));
        if (showBackLobes) {
          group.add(this.buildOrientedLobe(dir.clone().negate(), false, 'minor', opacity));
        }
      });

      if (showUnhybridP) {
        const pDir = new THREE.Vector3(0, 0, 1);
        const pMatPos = this.createOrbitalMaterial(COLOR_POS_PHASE, Math.max(0.22, opacity * 1.5));
        const pMatNeg = this.createOrbitalMaterial(COLOR_NEG_PHASE, Math.max(0.22, opacity * 1.5));
        const m1 = new THREE.Mesh(this.cachedUnhybridPGeom, pMatPos);
        const m2 = new THREE.Mesh(this.cachedUnhybridPGeom, pMatNeg);
        m1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir);
        m2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir.clone().negate());
        m1.userData.isLobe = true;
        m1.userData.localDir = pDir.clone();
        m1.userData.phase = 1;
        m1.userData.lobeKind = 'unhybrid';
        m2.userData.isLobe = true;
        m2.userData.localDir = pDir.clone().negate();
        m2.userData.phase = -1;
        m2.userData.lobeKind = 'unhybrid';
        group.add(m1);
        group.add(m2);
      }
    }

    // --- sp³ Hybridization ---
    else if (orbitalType === 'sp3') {
      const tetraDirs = [
        new THREE.Vector3( 1,  1,  1).normalize(),
        new THREE.Vector3(-1, -1,  1).normalize(),
        new THREE.Vector3(-1,  1, -1).normalize(),
        new THREE.Vector3( 1, -1, -1).normalize()
      ];

      tetraDirs.forEach(dir => {
        group.add(this.buildOrientedLobe(dir, true, 'hybrid', opacity));
        if (showBackLobes) {
          group.add(this.buildOrientedLobe(dir.clone().negate(), false, 'minor', opacity));
        }
      });
    }

    // --- sp³d Hybridization ---
    else if (orbitalType === 'sp3d') {
      [0, (2*Math.PI)/3, (4*Math.PI)/3].forEach(ang => {
        const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
        group.add(this.buildOrientedLobe(dir, true, 'hybrid', opacity));
      });
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, 0, 1), true, 'hybrid', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, 0, -1), true, 'hybrid', opacity));
    }

    // --- sp³d² Hybridization ---
    else if (orbitalType === 'sp3d2') {
      [
        new THREE.Vector3( 1, 0, 0), new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3( 0, 1, 0), new THREE.Vector3( 0,-1, 0),
        new THREE.Vector3( 0, 0, 1), new THREE.Vector3( 0, 0,-1)
      ].forEach(dir => {
        group.add(this.buildOrientedLobe(dir, true, 'hybrid', opacity));
      });
    }

    // --- dxy Orbital ---
    else if (orbitalType === 'dxy') {
      const invSqrt2 = 1 / Math.SQRT2;
      group.add(this.buildOrientedLobe(new THREE.Vector3( invSqrt2,  invSqrt2, 0), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(-invSqrt2, -invSqrt2, 0), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(-invSqrt2,  invSqrt2, 0), false, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3( invSqrt2, -invSqrt2, 0), false, 'd', opacity));

      if (showNodalPlanes) {
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(0, 1, 0)));
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(1, 0, 0)));
      }
    }

    // --- dxz Orbital ---
    else if (orbitalType === 'dxz') {
      const invSqrt2 = 1 / Math.SQRT2;
      group.add(this.buildOrientedLobe(new THREE.Vector3( invSqrt2, 0,  invSqrt2), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(-invSqrt2, 0, -invSqrt2), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(-invSqrt2, 0,  invSqrt2), false, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3( invSqrt2, 0, -invSqrt2), false, 'd', opacity));

      if (showNodalPlanes) {
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(0, 0, 1)));
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(1, 0, 0)));
      }
    }

    // --- dyz Orbital ---
    else if (orbitalType === 'dyz') {
      const invSqrt2 = 1 / Math.SQRT2;
      group.add(this.buildOrientedLobe(new THREE.Vector3(0,  invSqrt2,  invSqrt2), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, -invSqrt2, -invSqrt2), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, -invSqrt2,  invSqrt2), false, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(0,  invSqrt2, -invSqrt2), false, 'd', opacity));

      if (showNodalPlanes) {
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(0, 0, 1)));
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(0, 1, 0)));
      }
    }

    // --- dx2y2 Orbital ---
    else if (orbitalType === 'dx2y2') {
      group.add(this.buildOrientedLobe(new THREE.Vector3( 1,  0, 0), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(-1,  0, 0), true, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3( 0,  1, 0), false, 'd', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3( 0, -1, 0), false, 'd', opacity));

      if (showNodalPlanes) {
        const invSqrt2 = 1 / Math.SQRT2;
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(invSqrt2,  invSqrt2, 0)));
        group.add(this.createPlanarNodalSurface(new THREE.Vector3(invSqrt2, -invSqrt2, 0)));
      }
    }

    // --- dz2 Orbital ---
    else if (orbitalType === 'dz2') {
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, 0, 1), true, 'p', opacity));
      group.add(this.buildOrientedLobe(new THREE.Vector3(0, 0, -1), true, 'p', opacity));

      const torusGeom = new THREE.TorusGeometry(0.65, 0.18, 24, 40);
      const torusMat = this.createOrbitalMaterial(COLOR_NEG_PHASE, opacity);
      const torusMesh = new THREE.Mesh(torusGeom, torusMat);
      group.add(torusMesh);

      if (showNodalPlanes) {
        group.add(this.createDz2NodalCones(1.55));
      }
    }

    // Add Geometric Arrangement Outline if enabled
    if (showArrangement) {
      const outlineMesh = this.createArrangementOutline(orbitalType);
      if (outlineMesh && outlineMesh.children.length > 0) {
        group.add(outlineMesh);
      }
    }

    // Apply scale
    group.scale.setScalar(scale);
    return group;
  }
}
