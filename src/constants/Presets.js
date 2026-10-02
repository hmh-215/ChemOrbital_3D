/**
 * Presets.js
 * 11 Standard Textbook and Advanced Conformation Presets
 */

export const PRESET_DEFINITIONS = {
  // Preset 1: Methane (CH4) sp3
  'preset-sp3-ch4': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 2, 7.5), new THREE.Vector3(0, 0, 0));

    const c = vm.addAtom({
      name: 'C',
      color: '#334155',
      radius: 0.42,
      orbitalType: 'sp3',
      position: new THREE.Vector3(0, 0, 0)
    });

    const bondDist = 1.95;
    const tetraVectors = [
      new THREE.Vector3( 1,  1,  1).normalize(),
      new THREE.Vector3(-1, -1,  1).normalize(),
      new THREE.Vector3(-1,  1, -1).normalize(),
      new THREE.Vector3( 1, -1, -1).normalize()
    ];

    tetraVectors.forEach((v, idx) => {
      const h = vm.addAtom({
        name: 'H' + (idx + 1),
        color: '#ffffff',
        radius: 0.26,
        orbitalType: 's',
        position: v.clone().multiplyScalar(bondDist)
      });
      vm.addBond(c.id, h.id);
    });

    vm.selectAtom(c.id);
  },

  // Preset 2: Ethylene (C2H4) sp2 with π-Bond Bridge & 4 Hydrogens
  'preset-sp2-c2h4': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3, 9), new THREE.Vector3(0, 0, 0));

    const c1 = vm.addAtom({
      name: 'C1',
      color: '#334155',
      radius: 0.42,
      orbitalType: 'sp2',
      position: new THREE.Vector3(-1.2, 0, 0)
    });

    const c2 = vm.addAtom({
      name: 'C2',
      color: '#334155',
      radius: 0.42,
      orbitalType: 'sp2',
      position: new THREE.Vector3(1.2, 0, 0),
      rotation: new THREE.Euler(0, 0, Math.PI, 'XYZ')
    });

    vm.addBond(c1.id, c2.id);

    // 4 Hydrogens with small s-orbitals
    // In sp² trigonal planar geometry, all bond angles are strictly 120°!
    const hDist = 1.95;
    const cos60 = 0.5;
    const sin60 = Math.sin(Math.PI / 3); // Math.sqrt(3) / 2 ≈ 0.866025

    const h1 = vm.addAtom({ name: 'H1', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3(-1.2 - hDist * cos60,  hDist * sin60, 0) });
    const h2 = vm.addAtom({ name: 'H2', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3(-1.2 - hDist * cos60, -hDist * sin60, 0) });
    const h3 = vm.addAtom({ name: 'H3', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3( 1.2 + hDist * cos60,  hDist * sin60, 0) });
    const h4 = vm.addAtom({ name: 'H4', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3( 1.2 + hDist * cos60, -hDist * sin60, 0) });

    vm.addBond(c1.id, h1.id);
    vm.addBond(c1.id, h2.id);
    vm.addBond(c2.id, h3.id);
    vm.addBond(c2.id, h4.id);

    vm.addBridge({
      atomAId: c1.id,
      atomBId: c2.id,
      type: 'bonding',
      normDir: new THREE.Vector3(0, 0, 1),
      labelText: 'π(pz - pz)'
    });

    vm.selectAtom(c1.id);
  },

  // Preset 3: Acetylene (C2H2) sp with 2 π bonds
  'preset-sp-c2h2': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3, 9), new THREE.Vector3(0, 0, 0));

    const c1 = vm.addAtom({
      name: 'C1',
      color: '#334155',
      radius: 0.42,
      orbitalType: 'sp',
      rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
      position: new THREE.Vector3(-1.1, 0, 0)
    });

    const c2 = vm.addAtom({
      name: 'C2',
      color: '#334155',
      radius: 0.42,
      orbitalType: 'sp',
      rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
      position: new THREE.Vector3(1.1, 0, 0)
    });

    vm.addBond(c1.id, c2.id);

    const h1 = vm.addAtom({ name: 'H1', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3(-2.6, 0, 0) });
    const h2 = vm.addAtom({ name: 'H2', color: '#ffffff', radius: 0.26, orbitalType: 's', position: new THREE.Vector3(2.6, 0, 0) });

    vm.addBond(c1.id, h1.id);
    vm.addBond(c2.id, h2.id);

    // Create two perpendicular π bonds: one along Z (pz-pz), one along Y (py-py)
    vm.addBridge({ atomAId: c1.id, atomBId: c2.id, type: 'bonding', normDir: new THREE.Vector3(0, 0, 1), labelText: 'π(pz - pz)' });
    vm.addBridge({ atomAId: c1.id, atomBId: c2.id, type: 'bonding', normDir: new THREE.Vector3(0, 1, 0), labelText: 'π(py - py)' });

    vm.selectAtom(c1.id);
  },

  // Preset 4: Benzene (C6H6) Planar Aromatic Ring with Delocalized π-Cloud
  'preset-benzene': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 4.5, 9.5), new THREE.Vector3(0, 0, 0));

    const R_c = 1.95;
    const R_h = 3.25;
    const cAtoms = [];
    const hAtoms = [];

    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      const c = vm.addAtom({
        name: 'C' + (i + 1),
        color: '#334155',
        radius: 0.40,
        orbitalType: 'sp2',
        rotation: new THREE.Euler(0, 0, theta, 'XYZ'),
        position: new THREE.Vector3(Math.cos(theta) * R_c, Math.sin(theta) * R_c, 0)
      });
      cAtoms.push(c);

      const h = vm.addAtom({
        name: 'H' + (i + 1),
        color: '#ffffff',
        radius: 0.26,
        orbitalType: 's',
        position: new THREE.Vector3(Math.cos(theta) * R_h, Math.sin(theta) * R_h, 0)
      });
      hAtoms.push(h);
    }

    // Draw C-C ring bonds & C-H bonds
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      vm.addBond(cAtoms[i].id, cAtoms[next].id);
      vm.addBond(cAtoms[i].id, hAtoms[i].id);
    }

    // Continuous Delocalized π-Electron Ring above and below the carbon ring
    vm.addBridge({
      type: 'delocalized_ring',
      centerPos: new THREE.Vector3(0, 0, 0),
      radius: R_c,
      zHeight: 1.15
    });

    vm.selectAtom(cAtoms[0].id);
  },

  // Preset 5: Cyclohexane Chair Conformation (C6H12) - Strain-Free Tetrahedral Ring
  'preset-cyclohexane-chair': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3.8, 8.5), new THREE.Vector3(0, 0, 0));

    const R = 1.65;
    const cAtoms = [];
    const hAxAtoms = [];
    const hEqAtoms = [];

    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      const y = (i % 2 === 0) ? 0.38 : -0.38;
      const cPos = new THREE.Vector3(Math.cos(theta) * R, y, Math.sin(theta) * R);

      const c = vm.addAtom({
        name: 'C' + (i + 1),
        color: '#334155',
        radius: 0.40,
        orbitalType: 'sp3',
        showArrangement: true,
        position: cPos
      });
      cAtoms.push(c);

      // 1. Axial Hydrogen (Vertical)
      const isUp = (y > 0);
      const hAxPos = new THREE.Vector3(cPos.x, cPos.y + (isUp ? 1.25 : -1.25), cPos.z);
      const hAx = vm.addAtom({
        name: `H${i+1}_ax`,
        color: '#ffffff',
        radius: 0.24,
        orbitalType: 's',
        position: hAxPos
      });
      hAxAtoms.push(hAx);

      // 2. Equatorial Hydrogen (Radial outward around ring equator)
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const hEqPos = new THREE.Vector3(
        cPos.x + cosT * 1.20,
        cPos.y - (isUp ? 0.35 : -0.35),
        cPos.z + sinT * 1.20
      );
      const hEq = vm.addAtom({
        name: `H${i+1}_eq`,
        color: '#ffffff',
        radius: 0.24,
        orbitalType: 's',
        position: hEqPos
      });
      hEqAtoms.push(hEq);
    }

    // Draw C-C bonds and C-H bonds
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      vm.addBond(cAtoms[i].id, cAtoms[next].id);
      vm.addBond(cAtoms[i].id, hAxAtoms[i].id);
      vm.addBond(cAtoms[i].id, hEqAtoms[i].id);
    }

    vm.selectAtom(cAtoms[0].id);
  },

  // Preset 6: Cyclohexane Boat Conformation (C6H12) - Flagpole H...H Steric Clash
  'preset-cyclohexane-boat': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3.8, 8.5), new THREE.Vector3(0, 0, 0));

    const cPositions = [
      new THREE.Vector3( 1.75,  0.55,  0.00), // C0 (Prow)
      new THREE.Vector3( 1.15, -0.35,  0.95), // C1
      new THREE.Vector3(-1.15, -0.35,  0.95), // C2
      new THREE.Vector3(-1.75,  0.55,  0.00), // C3 (Stern)
      new THREE.Vector3(-1.15, -0.35, -0.95), // C4
      new THREE.Vector3( 1.15, -0.35, -0.95)  // C5
    ];

    const cAtoms = cPositions.map((pos, i) => vm.addAtom({
      name: 'C' + (i + 1),
      color: '#334155',
      radius: 0.40,
      orbitalType: 'sp3',
      showArrangement: true,
      position: pos
    }));

    // C-C Bonds
    for (let i = 0; i < 6; i++) {
      vm.addBond(cAtoms[i].id, cAtoms[(i + 1) % 6].id);
    }

    // Flagpole Hydrogens on C0 and C3
    const hFlag1Pos = new THREE.Vector3( 0.85, 1.45, 0.00);
    const hFlag2Pos = new THREE.Vector3(-0.85, 1.45, 0.00);

    const hFlag1 = vm.addAtom({ name: 'H_flag1', color: '#f87171', radius: 0.26, orbitalType: 's', position: hFlag1Pos });
    const hFlag2 = vm.addAtom({ name: 'H_flag2', color: '#f87171', radius: 0.26, orbitalType: 's', position: hFlag2Pos });
    vm.addBond(cAtoms[0].id, hFlag1.id, '#f87171');
    vm.addBond(cAtoms[3].id, hFlag2.id, '#f87171');

    // Outward hydrogens on C0 and C3
    const h0_out = new THREE.Vector3( 2.70, 0.85, 0.00);
    const h3_out = new THREE.Vector3(-2.70, 0.85, 0.00);
    const h1_out = vm.addAtom({ name: 'H1_out', color: '#ffffff', radius: 0.24, orbitalType: 's', position: h0_out });
    const h4_out = vm.addAtom({ name: 'H4_out', color: '#ffffff', radius: 0.24, orbitalType: 's', position: h3_out });
    vm.addBond(cAtoms[0].id, h1_out.id);
    vm.addBond(cAtoms[3].id, h4_out.id);

    // Hydrogens on base carbons C1, C2, C4, C5
    [
      { cIdx: 1, pos: new THREE.Vector3( 1.45, -0.65,  1.90) },
      { cIdx: 1, pos: new THREE.Vector3( 1.45, -1.35,  0.50) },
      { cIdx: 2, pos: new THREE.Vector3(-1.45, -0.65,  1.90) },
      { cIdx: 2, pos: new THREE.Vector3(-1.45, -1.35,  0.50) },
      { cIdx: 4, pos: new THREE.Vector3(-1.45, -0.65, -1.90) },
      { cIdx: 4, pos: new THREE.Vector3(-1.45, -1.35, -0.50) },
      { cIdx: 5, pos: new THREE.Vector3( 1.45, -0.65, -1.90) },
      { cIdx: 5, pos: new THREE.Vector3( 1.45, -1.35, -0.50) }
    ].forEach((hData, i) => {
      const hBase = vm.addAtom({ name: `H_base${i+1}`, color: '#ffffff', radius: 0.24, orbitalType: 's', position: hData.pos });
      vm.addBond(cAtoms[hData.cIdx].id, hBase.id);
    });

    vm.selectAtom(cAtoms[0].id);
  },

  // Preset 7: Graphene Sheets (Multilayer Honeycomb Lattice with 2D π-Conjugation)
  'preset-graphene': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 6.0, 13.0), new THREE.Vector3(0, 0, 0));

    const r = 1.35;
    const dx = r * Math.sqrt(3);

    const template = [
      new THREE.Vector3(0, 0,  r),
      new THREE.Vector3(0, 0, -r),
      new THREE.Vector3( r * Math.cos(Math.PI/6), 0,  r * 0.5),
      new THREE.Vector3(-r * Math.cos(Math.PI/6), 0,  r * 0.5),
      new THREE.Vector3( r * Math.cos(Math.PI/6), 0, -r * 0.5),
      new THREE.Vector3(-r * Math.cos(Math.PI/6), 0, -r * 0.5),
      new THREE.Vector3(dx, 0,  r),
      new THREE.Vector3(dx, 0, -r),
      new THREE.Vector3(dx + r * Math.cos(Math.PI/6), 0,  r * 0.5),
      new THREE.Vector3(dx + r * Math.cos(Math.PI/6), 0, -r * 0.5),
      new THREE.Vector3(-dx, 0,  r),
      new THREE.Vector3(-dx, 0, -r),
      new THREE.Vector3(-dx - r * Math.cos(Math.PI/6), 0,  r * 0.5),
      new THREE.Vector3(-dx - r * Math.cos(Math.PI/6), 0, -r * 0.5)
    ];

    // Interlayer spacing 2.8 units (avoids visual clipping of top/bottom pi-lobes)
    const layersY = [2.8, 0.0, -2.8];
    const sheetAtoms = [];

    layersY.forEach((yVal, lIdx) => {
      const layer = [];
      template.forEach((pt, pIdx) => {
        // In Graphene, each carbon is sp2 with unhybridized pz perpendicular to sheet (+Y/-Y)
        const atom = vm.addAtom({
          name: `C_L${lIdx+1}_${pIdx+1}`,
          color: '#334155',
          radius: 0.32,
          orbitalType: 'sp2',
          rotation: new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ'),
          position: new THREE.Vector3(pt.x, yVal, pt.z)
        });
        layer.push(atom);
      });
      sheetAtoms.push(layer);

      // C-C Covalent Bonds within the sheet
      for (let i = 0; i < layer.length; i++) {
        for (let j = i + 1; j < layer.length; j++) {
          const dist = layer[i].position.distanceTo(layer[j].position);
          if (dist > 0.5 && dist < r * 1.08) {
            vm.addBond(layer[i].id, layer[j].id);
          }
        }
      }

      // Align sp2 hybrid lobes in-plane with bonded neighbors
      layer.forEach(atom => {
        vm.alignAtomWithBondedNeighbors(atom);
      });

      // Delocalized 2D π-Bonding Honeycomb Bridges across the sheet
      let layerBridgeCount = 0;
      for (let i = 0; i < layer.length; i++) {
        for (let j = i + 1; j < layer.length; j++) {
          if (vm.model.hasBond(layer[i].id, layer[j].id)) {
            const isCenterLabel = (lIdx === 1 && layerBridgeCount === 0);
            vm.addBridge({
              atomAId: layer[i].id,
              atomBId: layer[j].id,
              type: 'bonding',
              normDir: new THREE.Vector3(0, 1, 0),
              labelText: isCenterLabel ? 'Delocalized π-Sheet (Conjugated)' : ''
            });
            layerBridgeCount++;
          }
        }
      }
    });

    vm.selectAtom(sheetAtoms[1][0].id);
  },

  // Preset 8: Phosphorus Pentachloride (PCl5) sp3d Trigonal Bipyramidal
  'preset-sp3d-pcl5': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3, 9.5), new THREE.Vector3(0, 0, 0));

    const p = vm.addAtom({
      name: 'P',
      color: '#f97316',
      radius: 0.48,
      orbitalType: 'sp3d',
      showArrangement: true,
      position: new THREE.Vector3(0, 0, 0)
    });

    const eqDist = 2.1;
    const axDist = 2.2;
    [0, (2*Math.PI)/3, (4*Math.PI)/3].forEach((ang, i) => {
      const cl = vm.addAtom({
        name: 'Cl_eq' + (i + 1),
        color: '#10b981',
        radius: 0.36,
        orbitalType: 'none',
        position: new THREE.Vector3(Math.cos(ang) * eqDist, Math.sin(ang) * eqDist, 0)
      });
      vm.addBond(p.id, cl.id);
    });

    const clAx1 = vm.addAtom({ name: 'Cl_ax1', color: '#10b981', radius: 0.36, orbitalType: 'none', position: new THREE.Vector3(0, 0, axDist) });
    const clAx2 = vm.addAtom({ name: 'Cl_ax2', color: '#10b981', radius: 0.36, orbitalType: 'none', position: new THREE.Vector3(0, 0, -axDist) });
    vm.addBond(p.id, clAx1.id);
    vm.addBond(p.id, clAx2.id);

    vm.selectAtom(p.id);
  },

  // Preset 9: Sulfur Hexafluoride (SF6) sp3d2 Octahedral
  'preset-sp3d2-sf6': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 3, 9.5), new THREE.Vector3(0, 0, 0));

    const s = vm.addAtom({
      name: 'S',
      color: '#eab308',
      radius: 0.48,
      orbitalType: 'sp3d2',
      showArrangement: true,
      position: new THREE.Vector3(0, 0, 0)
    });

    const fDist = 2.1;
    const fPositions = [
      new THREE.Vector3( fDist, 0, 0),
      new THREE.Vector3(-fDist, 0, 0),
      new THREE.Vector3(0,  fDist, 0),
      new THREE.Vector3(0, -fDist, 0),
      new THREE.Vector3(0, 0,  fDist),
      new THREE.Vector3(0, 0, -fDist)
    ];
    fPositions.forEach((pos, idx) => {
      const f = vm.addAtom({
        name: 'F' + (idx + 1),
        color: '#06b6d4',
        radius: 0.32,
        orbitalType: 'none',
        position: pos
      });
      vm.addBond(s.id, f.id);
    });

    vm.selectAtom(s.id);
  },

  // Preset 10: Water (H2O) sp3 Bent with 2 Lone Pairs
  'preset-h2o': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 1.5, 7.5), new THREE.Vector3(0, 0, 0));

    const o = vm.addAtom({
      name: 'O',
      color: '#ef4444',
      radius: 0.44,
      orbitalType: 'sp3',
      position: new THREE.Vector3(0, 0, 0)
    });

    const bondDist = 1.95;
    const vH1 = new THREE.Vector3(-1, -1,  1).normalize();
    const vH2 = new THREE.Vector3( 1, -1, -1).normalize();

    const h1 = vm.addAtom({ name: 'H1', color: '#ffffff', radius: 0.26, orbitalType: 's', position: vH1.clone().multiplyScalar(bondDist) });
    const h2 = vm.addAtom({ name: 'H2', color: '#ffffff', radius: 0.26, orbitalType: 's', position: vH2.clone().multiplyScalar(bondDist) });
    vm.addBond(o.id, h1.id);
    vm.addBond(o.id, h2.id);

    vm.selectAtom(o.id);
  },

  // Preset 11: All 5 d-orbitals side-by-side with textbook nodal surfaces
  'preset-d-orbitals': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 4.2, 14.5), new THREE.Vector3(0, 0, 0));

    const spacing = 3.6;
    const dOrbitalsData = [
      { name: '3d_xy', type: 'dxy', x: -2 * spacing },
      { name: '3d_xz', type: 'dxz', x: -1 * spacing },
      { name: '3d_yz', type: 'dyz', x: 0 },
      { name: '3d_x2y2', type: 'dx2y2', x: 1 * spacing },
      { name: '3d_z2', type: 'dz2', x: 2 * spacing }
    ];

    const createdAtoms = [];
    dOrbitalsData.forEach(data => {
      const atom = vm.addAtom({
        name: data.name,
        color: '#475569',
        radius: 0.38,
        orbitalType: data.type,
        rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
        showNodalPlanes: true,
        position: new THREE.Vector3(data.x, 0, 0)
      });
      createdAtoms.push(atom);
    });

    vm.selectAtom(createdAtoms[2].id);
  },

  // Preset 12: Sulfur Dioxide (SO2) - pπ-pπ & pπ-dπ Resonance
  'preset-so2': (vm) => {
    vm.clearAll();
    vm.setCameraView(new THREE.Vector3(0, 2.5, 8.5), new THREE.Vector3(0, 0, 0));

    // Sulfur in center: sp2 hybridized with 1 lone pair pointing up (+Y)
    // and 2 σ-bonds pointing towards bottom-left and bottom-right at 120°
    const s = vm.addAtom({
      name: 'S',
      color: '#eab308',
      radius: 0.48,
      orbitalType: 'sp2',
      rotation: new THREE.Euler(0, 0, Math.PI / 2, 'XYZ'),
      position: new THREE.Vector3(0, 0.5, 0)
    });

    const dist = 1.95;
    const sin60 = Math.sin(Math.PI / 3); // ~0.866
    const cos60 = 0.5;

    // O1 (Left Oxygen): sp2 hybridized with hybrid lobe pointing at S (angle +30° = π/6)
    const o1 = vm.addAtom({
      name: 'O1',
      color: '#ef4444',
      radius: 0.42,
      orbitalType: 'sp2',
      rotation: new THREE.Euler(0, 0, Math.PI / 6, 'XYZ'),
      position: new THREE.Vector3(-dist * sin60, 0.5 - dist * cos60, 0)
    });

    // O2 (Right Oxygen): sp2 hybridized with hybrid lobe pointing at S (angle 150° = 5π/6)
    const o2 = vm.addAtom({
      name: 'O2',
      color: '#ef4444',
      radius: 0.42,
      orbitalType: 'sp2',
      rotation: new THREE.Euler(0, 0, 5 * Math.PI / 6, 'XYZ'),
      position: new THREE.Vector3(dist * sin60, 0.5 - dist * cos60, 0)
    });

    vm.addBond(s.id, o1.id);
    vm.addBond(s.id, o2.id);

    // One bond features pπ - pπ overlap (perpendicular to molecular plane along Z)
    vm.addBridge({
      atomAId: s.id,
      atomBId: o1.id,
      type: 'bonding',
      normDir: new THREE.Vector3(0, 0, 1),
      labelText: 'π(pπ - pπ) Bonding'
    });

    // The other bond features pπ - dπ back-bonding resonance!
    vm.addBridge({
      atomAId: s.id,
      atomBId: o2.id,
      type: 'bonding',
      normDir: new THREE.Vector3(0, 0, 1),
      labelText: 'π(pπ - dπ) Resonance'
    });

    vm.selectAtom(s.id);
  }
};
