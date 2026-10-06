/**
 * ChemistryMath
 * Domain chemistry mathematics and geometric alignment algorithms.
 */

/**
 * Parses the chemical element symbol from an atom name
 * (e.g. C1 -> C, H_ax1 -> H, Cl_eq2 -> Cl, 3d_xy -> D)
 */
export function parseElementFromName(name) {
  if (!name) return 'C';
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^\d+/, ''); // strip leading digits (e.g. '3d' -> 'd')

  // 1. Two-letter chemical symbols
  const twoLetter = stripped.match(/^(Cl|Br|Na|Mg|Si|Ca|Fe|Cu|Zn)\b/i)
                 || stripped.match(/^(Cl|Br|Na|Mg|Si|Ca|Fe|Cu|Zn)[_\d\s]/i)
                 || stripped.match(/^(Cl|Br|Na|Mg|Si|Ca|Fe|Cu|Zn)/i);
  if (twoLetter) {
    return twoLetter[1].charAt(0).toUpperCase() + twoLetter[1].slice(1).toLowerCase();
  }

  // 2. Single-letter chemical symbols (C, H, O, N, P, S, F, etc.)
  const singleMatch = stripped.match(/^([CHONPSFBIKD])\b/i)
                   || stripped.match(/^([CHONPSFBIKD])[_\d\s]/i)
                   || stripped.match(/^([CHONPSFBIKD])/i);
  if (singleMatch) {
    return singleMatch[1].toUpperCase();
  }

  // 3. Fallback: match leading alphabet string
  const alpha = stripped.match(/^([a-zA-Z]+)/);
  if (alpha) return alpha[1].toUpperCase();

  return 'ATOM';
}

/**
 * Extracts all p-orbital orientation axes in world space for an atom
 */
export function getAtomUnhybridAxes(atom) {
  const axes = [];
  const type = atom.orbitalType;
  if (type === 'sp2') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'pz' });
  } else if (type === 'sp') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'pz' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'py' });
  } else if (type === 'pz') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'pz' });
  } else if (type === 'py') {
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'py' });
  } else if (type === 'px') {
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'px' });
  } else if (type === 'p_all' || type === 'p') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'pz' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'py' });
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'px' });
  } else if (type === 'dxz') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'dxz_z' });
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'dxz_x' });
  } else if (type === 'dyz') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'dyz_z' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'dyz_y' });
  } else if (type === 'dxy') {
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'dxy_x' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'dxy_y' });
  } else if (type === 'dx2y2') {
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'dx2y2_x' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'dx2y2_y' });
  } else if (type === 'dz2') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'dz2_z' });
  } else if (type === 'sp3d' || type === 'sp3d2') {
    // Hypervalent valence d-orbitals for lateral pi-bonding
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'd_pi_z' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'd_pi_y' });
  }
  return axes.map(a => ({
    name: a.name,
    // World direction of positive (+/Red) lobe
    worldPosDir: a.local.clone().applyEuler(atom.rotation).normalize()
  }));
}

/**
 * Extracts directional electron lobes with phases, peak positions, and orbital types
 */
export function getAtomOrbitalLobes(atom) {
  if (!atom || !atom.orbitalType || atom.orbitalType === 'none' || atom.orbitalType === 's') {
    return [];
  }

  const type = atom.orbitalType;
  const rot = atom.rotation;
  const pAtom = atom.position;
  const hLobe = 1.05; // peak distance of lobe center

  const lobes = [];

  const addLobe = (localDir, phase, name, kind) => {
    const dirNorm = localDir.clone().normalize();
    const worldDir = dirNorm.clone().applyEuler(rot).normalize();
    const worldPeak = pAtom.clone().add(worldDir.clone().multiplyScalar(hLobe));
    lobes.push({
      localDir: dirNorm,
      worldDir,
      worldPeak,
      phase, // +1 (red) or -1 (blue)
      name,
      kind, // 'p', 'd', 'hybrid'
      orbitalType: type
    });
  };

  // p-orbitals
  if (type === 'px') {
    addLobe(new THREE.Vector3( 1, 0, 0),  1, 'px+', 'p');
    addLobe(new THREE.Vector3(-1, 0, 0), -1, 'px-', 'p');
  } else if (type === 'py') {
    addLobe(new THREE.Vector3(0,  1, 0),  1, 'py+', 'p');
    addLobe(new THREE.Vector3(0, -1, 0), -1, 'py-', 'p');
  } else if (type === 'pz') {
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'pz+', 'p');
    addLobe(new THREE.Vector3(0, 0, -1), -1, 'pz-', 'p');
  } else if (type === 'p' || type === 'p_all') {
    addLobe(new THREE.Vector3( 1, 0, 0),  1, 'px+', 'p');
    addLobe(new THREE.Vector3(-1, 0, 0), -1, 'px-', 'p');
    addLobe(new THREE.Vector3(0,  1, 0),  1, 'py+', 'p');
    addLobe(new THREE.Vector3(0, -1, 0), -1, 'py-', 'p');
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'pz+', 'p');
    addLobe(new THREE.Vector3(0, 0, -1), -1, 'pz-', 'p');
  } else if (type === 'sp') {
    // Unhybridized pz and py
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'pz+', 'p');
    addLobe(new THREE.Vector3(0, 0, -1), -1, 'pz-', 'p');
    addLobe(new THREE.Vector3(0,  1, 0),  1, 'py+', 'p');
    addLobe(new THREE.Vector3(0, -1, 0), -1, 'py-', 'p');
  } else if (type === 'sp2') {
    // Unhybridized pz
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'pz+', 'p');
    addLobe(new THREE.Vector3(0, 0, -1), -1, 'pz-', 'p');
    // Hypervalent Period 3+ elements have valence d-orbitals for lateral pi-bonding
    if (['S', 'P', 'Cl', 'As', 'Se', 'Br'].includes(atom.element)) {
      const s = Math.SQRT1_2;
      [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].forEach((ang, idx) => {
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        addLobe(new THREE.Vector3(s * cosA, s * sinA,  s),  1, `d_pi_eq${idx + 1}_fwd+`, 'd');
        addLobe(new THREE.Vector3(s * cosA, s * sinA, -s), -1, `d_pi_eq${idx + 1}_fwd-`, 'd');
        addLobe(new THREE.Vector3(-s * cosA, -s * sinA, -s),  1, `d_pi_eq${idx + 1}_back+`, 'd');
        addLobe(new THREE.Vector3(-s * cosA, -s * sinA,  s), -1, `d_pi_eq${idx + 1}_back-`, 'd');
      });
    }
  } else if (type === 'sp3') {
    const tetraDirs = [
      new THREE.Vector3( 1,  1,  1).normalize(),
      new THREE.Vector3(-1, -1,  1).normalize(),
      new THREE.Vector3(-1,  1, -1).normalize(),
      new THREE.Vector3( 1, -1, -1).normalize()
    ];
    tetraDirs.forEach((dir, idx) => {
      addLobe(dir, 1, `sp3_${idx + 1}`, 'hybrid');
    });
  } else if (type === 'sp3d') {
    // 5 hybrid lobes (3 equatorial at 120°, 2 axial at 90°)
    const eqAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    eqAngles.forEach((ang, idx) => {
      addLobe(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0), 1, `sp3d_eq${idx + 1}`, 'hybrid');
    });
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'sp3d_ax_top', 'hybrid');
    addLobe(new THREE.Vector3(0, 0, -1), -1, 'sp3d_ax_bot', 'hybrid');
    // Valence d-orbitals for lateral pi-bonding:
    // Degenerate (dxz, dyz) forms matching d-pi combinations along each equatorial hybrid axis
    const s = Math.SQRT1_2;
    eqAngles.forEach((ang, idx) => {
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      addLobe(new THREE.Vector3(s * cosA, s * sinA,  s),  1, `d_pi_eq${idx + 1}_fwd+`, 'd');
      addLobe(new THREE.Vector3(s * cosA, s * sinA, -s), -1, `d_pi_eq${idx + 1}_fwd-`, 'd');
      addLobe(new THREE.Vector3(-s * cosA, -s * sinA, -s),  1, `d_pi_eq${idx + 1}_back+`, 'd');
      addLobe(new THREE.Vector3(-s * cosA, -s * sinA,  s), -1, `d_pi_eq${idx + 1}_back-`, 'd');
    });
  } else if (type === 'sp3d2') {
    [
      { dir: new THREE.Vector3( 1, 0, 0), phase: 1 },
      { dir: new THREE.Vector3(-1, 0, 0), phase: 1 },
      { dir: new THREE.Vector3( 0, 1, 0), phase: 1 },
      { dir: new THREE.Vector3( 0,-1, 0), phase: 1 },
      { dir: new THREE.Vector3( 0, 0, 1), phase: 1 },
      { dir: new THREE.Vector3( 0, 0,-1), phase: -1 }
    ].forEach((l, idx) => {
      addLobe(l.dir, l.phase, `sp3d2_${idx + 1}`, 'hybrid');
    });
    const s = Math.SQRT1_2;
    const eqDirs = [
      new THREE.Vector3( 1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3( 0, 1, 0), new THREE.Vector3( 0,-1, 0)
    ];
    eqDirs.forEach((dir, idx) => {
      addLobe(new THREE.Vector3(s * dir.x, s * dir.y,  s),  1, `d_pi_eq${idx + 1}_fwd+`, 'd');
      addLobe(new THREE.Vector3(s * dir.x, s * dir.y, -s), -1, `d_pi_eq${idx + 1}_fwd-`, 'd');
      addLobe(new THREE.Vector3(-s * dir.x, -s * dir.y, -s),  1, `d_pi_eq${idx + 1}_back+`, 'd');
      addLobe(new THREE.Vector3(-s * dir.x, -s * dir.y,  s), -1, `d_pi_eq${idx + 1}_back-`, 'd');
    });
  }
  // d-orbitals
  else if (type === 'dxy') {
    const s = Math.SQRT1_2;
    addLobe(new THREE.Vector3( s,  s, 0),  1, 'dxy1+', 'd');
    addLobe(new THREE.Vector3(-s, -s, 0),  1, 'dxy2+', 'd');
    addLobe(new THREE.Vector3(-s,  s, 0), -1, 'dxy3-', 'd');
    addLobe(new THREE.Vector3( s, -s, 0), -1, 'dxy4-', 'd');
  } else if (type === 'dxz') {
    const s = Math.SQRT1_2;
    addLobe(new THREE.Vector3( s, 0,  s),  1, 'dxz1+', 'd');
    addLobe(new THREE.Vector3(-s, 0, -s),  1, 'dxz2+', 'd');
    addLobe(new THREE.Vector3(-s, 0,  s), -1, 'dxz3-', 'd');
    addLobe(new THREE.Vector3( s, 0, -s), -1, 'dxz4-', 'd');
  } else if (type === 'dyz') {
    const s = Math.SQRT1_2;
    addLobe(new THREE.Vector3(0,  s,  s),  1, 'dyz1+', 'd');
    addLobe(new THREE.Vector3(0, -s, -s),  1, 'dyz2+', 'd');
    addLobe(new THREE.Vector3(0, -s,  s), -1, 'dyz3-', 'd');
    addLobe(new THREE.Vector3(0,  s, -s), -1, 'dyz4-', 'd');
  } else if (type === 'dx2y2') {
    addLobe(new THREE.Vector3( 1,  0, 0),  1, 'dx2y2_1+', 'd');
    addLobe(new THREE.Vector3(-1,  0, 0),  1, 'dx2y2_2+', 'd');
    addLobe(new THREE.Vector3( 0,  1, 0), -1, 'dx2y2_3-', 'd');
    addLobe(new THREE.Vector3( 0, -1, 0), -1, 'dx2y2_4-', 'd');
  } else if (type === 'dz2') {
    addLobe(new THREE.Vector3(0, 0,  1),  1, 'dz2_top+', 'd');
    addLobe(new THREE.Vector3(0, 0, -1),  1, 'dz2_bot+', 'd');
  }

  return lobes;
}

/**
 * Detects orbital overlaps between two atoms:
 * - p - p (lateral π bonding & π* antibonding)
 * - p - d / d - p (lateral pπ - dπ bonding & antibonding)
 * - d - d (face-to-face δ bonding & lateral π bonding)
 */
export function detectOrbitalOverlaps(atomA, atomB, isBonded = false, existingBridges = []) {
  if (!atomA || !atomB) return [];
  const dist = atomA.position.distanceTo(atomB.position);
  if (dist <= 0.4 || dist > 4.5) return [];

  const lobesA = getAtomOrbitalLobes(atomA);
  const lobesB = getAtomOrbitalLobes(atomB);
  if (lobesA.length === 0 || lobesB.length === 0) return [];

  const bondDir = atomB.position.clone().sub(atomA.position).normalize();
  const overlaps = [];

  const hasDA = lobesA.some(l => l.kind === 'd');
  const hasDB = lobesB.some(l => l.kind === 'd');
  const hasPA = lobesA.some(l => l.kind === 'p');
  const hasPB = lobesB.some(l => l.kind === 'p');

  const canResonanceD = (atom) => {
    const elem = atom.element;
    const canExpand = ['S', 'P', 'Cl', 'As', 'Se', 'Br'].includes(elem);
    if (!canExpand) return false;
    if (atom.orbitalType === 'sp3d' || atom.orbitalType === 'sp3d2') return true;
    // Capable of valence d expansion if already involved in a pi-bridge with another atom
    return existingBridges.some(b => 
      (b.atomAId === atom.id && b.atomBId !== (atom === atomA ? atomB.id : atomA.id)) ||
      (b.atomBId === atom.id && b.atomAId !== (atom === atomA ? atomB.id : atomA.id))
    );
  };

  const isResonanceA = canResonanceD(atomA);
  const isResonanceB = canResonanceD(atomB);

  const formatOrbName = (type) => {
    const map = {
      sp: 'sp', sp2: 'sp²', sp3: 'sp³', sp3d: 'sp³d', sp3d2: 'sp³d²',
      px: 'px', py: 'py', pz: 'pz', p_all: 'p',
      dxy: 'dxy', dxz: 'dxz', dyz: 'dyz', dx2y2: 'dx²-y²', dz2: 'dz²'
    };
    return map[type] || type;
  };

  // -------------------------------------------------------------
  // Case 1: p - p Overlap (standard lateral π-bonding / antibonding)
  // -------------------------------------------------------------
  if (hasPA && hasPB && !hasDA && !hasDB && !isResonanceA && !isResonanceB) {
    const pAxesA = getAtomUnhybridAxes(atomA);
    const pAxesB = getAtomUnhybridAxes(atomB);
    const pairedB = new Set();

    pAxesA.forEach(axA => {
      let bestB = null;
      let bestDot = 0;
      let bestAbsDot = 0;

      pAxesB.forEach((axB, idxB) => {
        if (pairedB.has(idxB)) return;
        if (Math.abs(axA.worldPosDir.dot(bondDir)) > 0.65) return;
        if (Math.abs(axB.worldPosDir.dot(bondDir)) > 0.65) return;

        const dot = axA.worldPosDir.dot(axB.worldPosDir);
        if (Math.abs(dot) > bestAbsDot) {
          bestAbsDot = Math.abs(dot);
          bestDot = dot;
          bestB = { ax: axB, idx: idxB };
        }
      });

      if (bestB && bestAbsDot >= 0.65) {
        pairedB.add(bestB.idx);
        const nameA = axA.name;
        const nameB = bestB.ax.name;
        const labelBase = `${nameA} - ${nameB}`;

        const topA = atomA.position.clone().add(axA.worldPosDir.clone().multiplyScalar(1.05));
        const botA = atomA.position.clone().sub(axA.worldPosDir.clone().multiplyScalar(1.05));

        const topB = atomB.position.clone().add(bestB.ax.worldPosDir.clone().multiplyScalar(1.05));
        const botB = atomB.position.clone().sub(bestB.ax.worldPosDir.clone().multiplyScalar(1.05));

        if (bestDot >= 0.65) {
          const avgNorm = axA.worldPosDir.clone().add(bestB.ax.worldPosDir).normalize();
          overlaps.push({
            type: 'bonding',
            overlapType: 'p-p',
            normDir: avgNorm,
            labelText: `π(${labelBase}) Bonding`,
            lobePairs: [
              { posA: topA, posB: topB, phase: 1 },
              { posA: botA, posB: botB, phase: -1 }
            ]
          });
        } else {
          overlaps.push({
            type: 'antibonding',
            overlapType: 'p-p',
            normDir: axA.worldPosDir.clone(),
            labelText: `π*(${labelBase}) Antibonding`,
            lobePairs: [
              { posA: topA, posB: botB, phase: 1 },
              { posA: botA, posB: topB, phase: -1 }
            ]
          });
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Case 2: p - d Overlap (lateral pπ - dπ bonding / antibonding or hypervalent resonance)
  // -------------------------------------------------------------
  else if ((hasDA && hasPB) || (hasPA && hasDB) || ((hasPA && hasPB) && (isResonanceA || isResonanceB))) {
    // If resonance back-bonding in hybrid atom (e.g. S in SO2 with sp2)
    if ((hasPA && hasPB) && (isResonanceA || isResonanceB)) {
      const resAtom = isResonanceA ? atomA : atomB;
      const otherAtom = isResonanceA ? atomB : atomA;
      const axesRes = getAtomUnhybridAxes(resAtom);
      const axesOther = getAtomUnhybridAxes(otherAtom);

      if (axesRes.length > 0 && axesOther.length > 0) {
        const axR = axesRes[0];
        const axO = axesOther[0];
        const dot = axR.worldPosDir.dot(axO.worldPosDir);

        if (Math.abs(dot) >= 0.50) {
          const topA = atomA.position.clone().add(axR.worldPosDir.clone().multiplyScalar(1.05));
          const botA = atomA.position.clone().sub(axR.worldPosDir.clone().multiplyScalar(1.05));
          const topB = atomB.position.clone().add(axO.worldPosDir.clone().multiplyScalar(1.05));
          const botB = atomB.position.clone().sub(axO.worldPosDir.clone().multiplyScalar(1.05));

          overlaps.push({
            type: 'bonding',
            overlapType: 'p-d',
            normDir: axR.worldPosDir.clone(),
            labelText: 'π(pπ - dπ) Resonance',
            lobePairs: [
              { posA: topA, posB: topB, phase: 1 },
              { posA: botA, posB: botB, phase: -1 }
            ]
          });
        }
      }
    } else {
      const dAtom = hasDA ? atomA : atomB;
      const pAtom = hasDA ? atomB : atomA;
      const dLobes = hasDA ? lobesA : lobesB;
      const pLobes = hasDA ? lobesB : lobesA;
      const uDP = pAtom.position.clone().sub(dAtom.position).normalize();

      // In d-orbital: identify forward-facing lobes pointing towards pAtom (sorted by alignment with bond axis)
      const forwardDLobes = dLobes
        .filter(l => l.kind === 'd' && l.worldDir.dot(uDP) > 0.15)
        .sort((a, b) => b.worldDir.dot(uDP) - a.worldDir.dot(uDP));

      const posDLobe = forwardDLobes.find(l => l.phase === 1);
      const negDLobe = forwardDLobes.find(l => l.phase === -1);

      if (posDLobe && negDLobe) {
        const tPosD = posDLobe.worldDir.clone().sub(uDP.clone().multiplyScalar(posDLobe.worldDir.dot(uDP))).normalize();

        const lateralPLobes = pLobes.filter(l => (l.kind === 'p' || l.kind === 'unhybrid') && Math.abs(l.worldDir.dot(uDP)) < 0.65);
        const posPLobe = lateralPLobes.find(l => l.phase === 1);
        const negPLobe = lateralPLobes.find(l => l.phase === -1);

        if (posPLobe && negPLobe) {
          const dot = tPosD.dot(posPLobe.worldDir);
          if (Math.abs(dot) >= 0.50) {
            const dLabel = formatOrbName(dAtom.orbitalType);
            const pLabel = formatOrbName(pAtom.orbitalType);

            if (dot >= 0.50) {
              overlaps.push({
                type: 'bonding',
                overlapType: 'p-d',
                normDir: tPosD,
                labelText: `π(${dLabel} - ${pLabel}) Bonding`,
                lobePairs: hasDA ? [
                  { posA: posDLobe.worldPeak, posB: posPLobe.worldPeak, phase: 1 },
                  { posA: negDLobe.worldPeak, posB: negPLobe.worldPeak, phase: -1 }
                ] : [
                  { posA: posPLobe.worldPeak, posB: posDLobe.worldPeak, phase: 1 },
                  { posA: negPLobe.worldPeak, posB: negDLobe.worldPeak, phase: -1 }
                ]
              });
            } else {
              overlaps.push({
                type: 'antibonding',
                overlapType: 'p-d',
                normDir: tPosD,
                labelText: `π*(${dLabel} - ${pLabel}) Antibonding`,
                lobePairs: hasDA ? [
                  { posA: posDLobe.worldPeak, posB: negPLobe.worldPeak, phase: 1 },
                  { posA: negDLobe.worldPeak, posB: posPLobe.worldPeak, phase: -1 }
                ] : [
                  { posA: posPLobe.worldPeak, posB: negDLobe.worldPeak, phase: 1 },
                  { posA: negPLobe.worldPeak, posB: posDLobe.worldPeak, phase: -1 }
                ]
              });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Case 3: d - d Overlap (face-to-face δ or lateral π)
  // -------------------------------------------------------------
  else if (hasDA && hasDB) {
    const getDNormal = (atom) => {
      const type = atom.orbitalType;
      let localNorm = new THREE.Vector3(0, 0, 1);
      if (type === 'dxz') localNorm = new THREE.Vector3(0, 1, 0);
      else if (type === 'dyz') localNorm = new THREE.Vector3(1, 0, 0);
      return localNorm.applyEuler(atom.rotation).normalize();
    };

    const normA = getDNormal(atomA);
    const normB = getDNormal(atomB);

    const isFaceToFace = Math.abs(bondDir.dot(normA)) >= 0.65 && Math.abs(bondDir.dot(normB)) >= 0.65 && Math.abs(normA.dot(normB)) >= 0.65;

    const dLabelA = formatOrbName(atomA.orbitalType);
    const dLabelB = formatOrbName(atomB.orbitalType);

    if (isFaceToFace) {
      const matchedPairs = [];
      let inPhaseCount = 0;
      let outPhaseCount = 0;

      lobesA.filter(l => l.kind === 'd').forEach(lA => {
        let bestB = null;
        let bestDot = -1;
        lobesB.filter(l => l.kind === 'd').forEach(lB => {
          const dot = lA.worldDir.dot(lB.worldDir);
          if (dot > bestDot) {
            bestDot = dot;
            bestB = lB;
          }
        });

        if (bestB && bestDot >= 0.60) {
          matchedPairs.push({
            posA: lA.worldPeak,
            posB: bestB.worldPeak,
            phase: lA.phase
          });
          if (lA.phase === bestB.phase) inPhaseCount++;
          else outPhaseCount++;
        }
      });

      if (matchedPairs.length >= 4) {
        if (inPhaseCount >= 3) {
          overlaps.push({
            type: 'delta_bonding',
            overlapType: 'd-d',
            normDir: normA,
            labelText: `δ(${dLabelA} - ${dLabelB}) Bonding`,
            lobePairs: matchedPairs
          });
        } else if (outPhaseCount >= 3) {
          overlaps.push({
            type: 'delta_antibonding',
            overlapType: 'd-d',
            normDir: normA,
            labelText: `δ*(${dLabelA} - ${dLabelB}) Antibonding`,
            lobePairs: matchedPairs
          });
        }
      }
    } else {
      const fwdA = lobesA.filter(l => l.kind === 'd' && l.worldDir.dot(bondDir) > 0.15);
      const fwdB = lobesB.filter(l => l.kind === 'd' && l.worldDir.dot(bondDir.clone().negate()) > 0.15);

      const posA = fwdA.find(l => l.phase === 1);
      const negA = fwdA.find(l => l.phase === -1);
      const posB = fwdB.find(l => l.phase === 1);
      const negB = fwdB.find(l => l.phase === -1);

      if (posA && negA && posB && negB) {
        const tPosA = posA.worldDir.clone().sub(bondDir.clone().multiplyScalar(posA.worldDir.dot(bondDir))).normalize();
        const tPosB = posB.worldDir.clone().sub(bondDir.clone().multiplyScalar(posB.worldDir.dot(bondDir))).normalize();

        const dot = tPosA.dot(tPosB);
        if (Math.abs(dot) >= 0.55) {
          if (dot >= 0.55) {
            overlaps.push({
              type: 'bonding',
              overlapType: 'd-d',
              normDir: tPosA,
              labelText: `π(${dLabelA} - ${dLabelB}) Bonding`,
              lobePairs: [
                { posA: posA.worldPeak, posB: posB.worldPeak, phase: 1 },
                { posA: negA.worldPeak, posB: negB.worldPeak, phase: -1 }
              ]
            });
          } else {
            overlaps.push({
              type: 'antibonding',
              overlapType: 'd-d',
              normDir: tPosA,
              labelText: `π*(${dLabelA} - ${dLabelB}) Antibonding`,
              lobePairs: [
                { posA: posA.worldPeak, posB: negB.worldPeak, phase: 1 },
                { posA: negA.worldPeak, posB: posB.worldPeak, phase: -1 }
              ]
            });
          }
        }
      }
    }
  }

  return overlaps;
}

/**
 * Evaluates whether two atoms are quantum-chemically compatible to form
 * π or δ bonds based on orbital symmetry and internuclear distance.
 */
export function getOrbitalOverlapCompatibility(atomA, atomB) {
  if (!atomA || !atomB) return { compatible: false, reason: "Please select 2 atoms to test orbital overlap." };
  const dist = atomA.position.distanceTo(atomB.position);
  if (dist <= 0.4) return { compatible: false, reason: "Atoms are overlapping (distance ≤ 0.4 units)." };
  if (dist > 4.5) return { compatible: false, reason: "Distance too great for orbital overlap (> 4.5 units)." };

  const orbA = atomA.orbitalType || 'none';
  const orbB = atomB.orbitalType || 'none';

  if (orbA === 'none' || orbB === 'none') {
    return { compatible: false, reason: "One or both selected atoms have no active orbitals (set to None)." };
  }

  if (orbA === 's' || orbB === 's') {
    if (orbA === 's' && orbB === 's') {
      return {
        compatible: true,
        overlapType: 's-s',
        label: 's - s Overlap (Head-on σ / σ*)'
      };
    }
    return {
      compatible: false,
      reason: "Symmetry forbidden: s-orbitals have spherical σ-symmetry; their net overlap integral with lateral π or δ orbitals is zero (∫ψ_s · ψ_π dτ = 0)."
    };
  }

  if (orbA === 'sp3' || orbB === 'sp3') {
    return {
      compatible: false,
      reason: "Symmetry forbidden: sp³ hybridized atoms have no unhybridized p or d orbitals available for lateral π-bonding."
    };
  }

  const isD = (orb) => orb && (orb.startsWith('d') || orb === 'sp3d' || orb === 'sp3d2');
  const isP = (orb) => orb && (orb.startsWith('p') || orb === 'sp' || orb === 'sp2');
  const canResonanceD = (atom) => ['S', 'P', 'Cl', 'As', 'Se', 'Br'].includes(atom.element) && (atom.orbitalType === 'sp2' || atom.orbitalType === 'sp3d' || atom.orbitalType === 'sp3d2');

  const hasDA = isD(orbA) || canResonanceD(atomA);
  const hasDB = isD(orbB) || canResonanceD(atomB);
  const hasPA = isP(orbA);
  const hasPB = isP(orbB);

  if (hasDA && hasDB) {
    return { compatible: true, overlapType: 'd-d', label: 'd - d Overlap (π or δ)' };
  }
  if ((hasDA && hasPB) || (hasPA && hasDB)) {
    return { compatible: true, overlapType: 'p-d', label: 'p - d Overlap (pπ - dπ)' };
  }
  if (hasPA && hasPB) {
    return { compatible: true, overlapType: 'p-p', label: 'p - p Overlap (π)' };
  }

  return {
    compatible: false,
    reason: `Symmetry forbidden: Orbitals ${orbA} and ${orbB} cannot form lateral π or δ bonds by quantum symmetry.`
  };
}

/**
 * Orients a p-orbital atom (sp2, sp, pz, px, py, p) with its positive lobe along pNorm
 * and primary hybrid/bond direction along bondDir.
 */
function orientPOrbitalAtom(atom, bondDir, pNorm) {
  const type = atom.orbitalType;
  const bNorm = bondDir.clone().normalize();
  const pN = pNorm.clone().normalize();
  const pOrth = pN.clone().sub(bNorm.clone().multiplyScalar(pN.dot(bNorm))).normalize();
  const w = new THREE.Vector3().crossVectors(pOrth, bNorm).normalize();
  const rotMat = new THREE.Matrix4();

  if (type === 'sp2' || type === 'sp' || type === 'pz' || type === 'p' || type === 'p_all') {
    rotMat.makeBasis(bNorm, w, pOrth);
  } else if (type === 'px') {
    rotMat.makeBasis(pOrth, bNorm, w);
  } else if (type === 'py') {
    rotMat.makeBasis(bNorm, pOrth, w.clone().negate());
  } else {
    rotMat.makeBasis(bNorm, w, pOrth);
  }

  atom.rotation.setFromRotationMatrix(rotMat, 'XYZ');
}

/**
 * Orients a d-orbital atom (dxz, dxy, dyz, dx2y2, sp3d, sp3d2) for lateral pπ - dπ bonding:
 * - Internuclear vector uDP bisects the forward lobes
 * - Forward + lobe aligns with pNorm
 * - Forward - lobe aligns with -pNorm
 */
function orientDOrbitalForPi(dAtom, uDP, pNorm) {
  const type = dAtom.orbitalType;
  const u = uDP.clone().normalize();
  const p = pNorm.clone().normalize();
  const pOrth = p.clone().sub(u.clone().multiplyScalar(p.dot(u))).normalize();
  const w = new THREE.Vector3().crossVectors(pOrth, u).normalize();
  const rotMat = new THREE.Matrix4();

  if (type === 'dxz') {
    rotMat.makeBasis(u, w, pOrth);
  } else if (type === 'dxy') {
    rotMat.makeBasis(u, pOrth, w.clone().negate());
  } else if (type === 'dyz') {
    rotMat.makeBasis(w, u, pOrth);
  } else if (type === 'dx2y2') {
    const invSqrt2 = 1 / Math.SQRT2;
    const xCol = u.clone().multiplyScalar(invSqrt2).sub(pOrth.clone().multiplyScalar(invSqrt2));
    const yCol = u.clone().multiplyScalar(invSqrt2).add(pOrth.clone().multiplyScalar(invSqrt2));
    rotMat.makeBasis(xCol, yCol, w);
  } else if (type === 'sp3d' || type === 'sp3d2') {
    rotMat.makeBasis(u, w, pOrth);
  } else {
    rotMat.makeBasis(u, w, pOrth);
  }

  dAtom.rotation.setFromRotationMatrix(rotMat, 'XYZ');
}

/**
 * Orients a d-orbital atom for face-to-face δ-bonding (cloverleaf plane perpendicular to u).
 */
function orientDOrbitalForDelta(dAtom, u, n, w) {
  const type = dAtom.orbitalType;
  const rotMat = new THREE.Matrix4();

  if (type === 'dxy') {
    rotMat.makeBasis(n, w, u);
  } else if (type === 'dxz') {
    rotMat.makeBasis(n, u, w);
  } else if (type === 'dyz') {
    rotMat.makeBasis(u, n, w);
  } else {
    rotMat.makeBasis(n, w, u);
  }

  dAtom.rotation.setFromRotationMatrix(rotMat, 'XYZ');
}

/**
 * Universally aligns the orbitals of two atoms into optimal quantum-mechanical
 * overlap geometry (p-p π, p-d pπ-dπ, or d-d δ/π).
 */
export function alignOrbitalsForOverlap(atomA, atomB) {
  if (!atomA || !atomB) return false;
  const dist = atomA.position.distanceTo(atomB.position);
  if (dist < 0.2 || dist > 6.0) return false;

  const orbA = atomA.orbitalType;
  const orbB = atomB.orbitalType;
  const isD = (atom) => {
    if (!atom || !atom.orbitalType) return false;
    const o = atom.orbitalType;
    if (o.startsWith('d') || o === 'sp3d' || o === 'sp3d2') return true;
    if (['S', 'P', 'Cl', 'As', 'Se', 'Br'].includes(atom.element) && (o === 'sp2' || o === 'sp')) return true;
    return false;
  };
  const isP = (atom) => {
    if (!atom || !atom.orbitalType) return false;
    const o = atom.orbitalType;
    return o.startsWith('p') || o === 'sp' || o === 'sp2';
  };

  const u = atomB.position.clone().sub(atomA.position).normalize(); // A -> B

  // Case 1: p - p Overlap (both have p and neither is pure d or sp3d/sp3d2)
  if (isP(atomA) && isP(atomB) && !orbA.startsWith('d') && !orbB.startsWith('d') && orbA !== 'sp3d' && orbA !== 'sp3d2' && orbB !== 'sp3d' && orbB !== 'sp3d2') {
    let n = null;
    const axesA = getAtomUnhybridAxes(atomA);
    const axesB = getAtomUnhybridAxes(atomB);

    if (axesA.length > 0) {
      const proj = axesA[0].worldPosDir.clone().sub(u.clone().multiplyScalar(axesA[0].worldPosDir.dot(u)));
      if (proj.lengthSq() > 1e-3) n = proj.normalize();
    }
    if (!n && axesB.length > 0) {
      const proj = axesB[0].worldPosDir.clone().sub(u.clone().multiplyScalar(axesB[0].worldPosDir.dot(u)));
      if (proj.lengthSq() > 1e-3) n = proj.normalize();
    }
    if (!n) {
      const fallback = Math.abs(u.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      n = fallback.sub(u.clone().multiplyScalar(fallback.dot(u))).normalize();
    }

    orientPOrbitalAtom(atomA, u, n);
    orientPOrbitalAtom(atomB, u.clone().negate(), n);
    return true;
  }

  // Case 2: p - d Overlap
  if ((isD(atomA) && isP(atomB)) || (isP(atomA) && isD(atomB))) {
    const dAtom = (isD(atomA) && (!isD(atomB) || orbA === 'sp3d' || orbA === 'sp3d2' || orbA.startsWith('d'))) ? atomA : atomB;
    const pAtom = (dAtom === atomA) ? atomB : atomA;
    const uDP = pAtom.position.clone().sub(dAtom.position).normalize();

    let pNorm = null;
    if (dAtom.orbitalType === 'sp3d' || dAtom.orbitalType === 'sp3d2' || (['S', 'P', 'Cl', 'As', 'Se', 'Br'].includes(dAtom.element) && dAtom.orbitalType === 'sp2')) {
      const dAxial = new THREE.Vector3(0, 0, 1).applyEuler(dAtom.rotation).normalize();
      const proj = dAxial.clone().sub(uDP.clone().multiplyScalar(dAxial.dot(uDP)));
      if (proj.lengthSq() > 1e-3) pNorm = proj.normalize();
    }
    if (!pNorm) {
      const pAxes = getAtomUnhybridAxes(pAtom);
      if (pAxes.length > 0) {
        const proj = pAxes[0].worldPosDir.clone().sub(uDP.clone().multiplyScalar(pAxes[0].worldPosDir.dot(uDP)));
        if (proj.lengthSq() > 1e-3) pNorm = proj.normalize();
      }
    }
    if (!pNorm) {
      const fallback = Math.abs(uDP.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      pNorm = fallback.sub(uDP.clone().multiplyScalar(fallback.dot(uDP))).normalize();
    }

    orientPOrbitalAtom(pAtom, uDP.clone().negate(), pNorm);
    if (dAtom.orbitalType !== 'sp3d' && dAtom.orbitalType !== 'sp3d2') {
      orientDOrbitalForPi(dAtom, uDP, pNorm);
    }
    return true;
  }

  // Case 3: d - d Overlap
  if (isD(atomA) && isD(atomB)) {
    let n = Math.abs(u.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    n = n.sub(u.clone().multiplyScalar(n.dot(u))).normalize();
    const w = new THREE.Vector3().crossVectors(u, n).normalize();

    orientDOrbitalForDelta(atomA, u, n, w);
    orientDOrbitalForDelta(atomB, u.clone().negate(), n, w);
    return true;
  }

  return false;
}

/**
 * Aligns an atom's unhybridized p-orbitals or d-orbitals with bonded neighbors.
 * getBondedNeighborsFn: (atom) => [{ bond, neighbor }]
 */
export function alignAtomWithBondedNeighbors(atom, getBondedNeighborsFn) {
  if (!atom) return false;
  const type = atom.orbitalType;
  if (!type || type === 'none' || type === 's') return false;

  const neighbors = getBondedNeighborsFn(atom);
  if (neighbors.length === 0) return false;

  // If atom is d-orbital or sp3d/sp3d2 and neighbor has p or sp/sp2: use universal pair alignment
  if (type.startsWith('d') || type === 'sp3d' || type === 'sp3d2') {
    const pNeighbor = neighbors.find(n => {
      const o = n.neighbor.orbitalType;
      return o && (o.startsWith('p') || o === 'sp' || o === 'sp2');
    });
    if (pNeighbor) {
      return alignOrbitalsForOverlap(atom, pNeighbor.neighbor);
    }
  }

  // If atom is pure p (px, py, pz, p):
  if (type.startsWith('p') && type !== 'sp' && type !== 'sp2') {
    const firstNeighbor = neighbors[0].neighbor;
    return alignOrbitalsForOverlap(atom, firstNeighbor);
  }

  // If atom is sp2 or sp:
  if (neighbors.length === 1) {
    const neighbor = neighbors[0].neighbor;
    const xLocal = neighbor.position.clone().sub(atom.position).normalize();

    let pTarget = null;
    const neighborAxes = getAtomUnhybridAxes(neighbor);
    if (neighborAxes.length > 0) {
      pTarget = neighborAxes[0].worldPosDir.clone();
    } else {
      const secondNeighbors = getBondedNeighborsFn(neighbor).filter(n => n.neighbor.id !== atom.id);
      if (secondNeighbors.length > 0) {
        const v1 = atom.position.clone().sub(neighbor.position).normalize();
        const v2 = secondNeighbors[0].neighbor.position.clone().sub(neighbor.position).normalize();
        const normal = new THREE.Vector3().crossVectors(v1, v2);
        if (normal.lengthSq() > 1e-4) {
          pTarget = normal.normalize();
        }
      }
    }

    if (!pTarget) {
      pTarget = Math.abs(xLocal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    }

    let zLocal = pTarget.clone().sub(xLocal.clone().multiplyScalar(pTarget.dot(xLocal)));
    if (zLocal.lengthSq() < 1e-4) {
      const fallback = Math.abs(xLocal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      zLocal = fallback.sub(xLocal.clone().multiplyScalar(fallback.dot(xLocal))).normalize();
    } else {
      zLocal.normalize();
      if (zLocal.dot(pTarget) < 0) {
        zLocal.negate();
      }
    }

    const yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
    zLocal = new THREE.Vector3().crossVectors(xLocal, yLocal).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
    atom.rotation.setFromRotationMatrix(rotMat, 'XYZ');
    return true;
  } else {
    // 2 or more neighbors (central atom)
    const sorted = [...neighbors].sort((a, b) => {
      const aIsH = a.neighbor.element === 'H' || a.neighbor.name.startsWith('H');
      const bIsH = b.neighbor.element === 'H' || b.neighbor.name.startsWith('H');
      if (aIsH && !bIsH) return 1;
      if (!aIsH && bIsH) return -1;
      return 0;
    });

    const n1 = sorted[0].neighbor;
    const n2 = sorted[1].neighbor;
    const v1 = n1.position.clone().sub(atom.position).normalize();
    const v2 = n2.position.clone().sub(atom.position).normalize();

    let normal = new THREE.Vector3().crossVectors(v1, v2);
    if (normal.lengthSq() < 1e-4) {
      normal = Math.abs(v1.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    } else {
      normal.normalize();
    }

    let refP = null;
    for (let i = 0; i < neighbors.length; i++) {
      const ax = getAtomUnhybridAxes(neighbors[i].neighbor);
      if (ax.length > 0) {
        refP = ax[0].worldPosDir;
        break;
      }
    }
    if (refP && normal.dot(refP) < 0) {
      normal.negate();
    }

    let zLocal = normal;
    let xLocal = v1.clone();
    let yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
    zLocal = new THREE.Vector3().crossVectors(xLocal, yLocal).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
    atom.rotation.setFromRotationMatrix(rotMat, 'XYZ');
    return true;
  }
}

/**
 * Calculates the world attachment position and auto-rotation for a new atom
 * bonded to a clicked orbital lobe.
 */
export function calculateAttachment(parentAtom, localDir, childElem, childOrbital) {
  if (!parentAtom || !localDir) return null;

  // Transform lobe local direction vector to world coordinates using parent's rotation
  const worldDir = localDir.clone().applyEuler(parentAtom.rotation).normalize();

  let bondDist = 2.40;
  if (childElem === 'H') bondDist = 1.95;
  else if (childElem === 'F' || childElem === 'Cl') bondDist = 2.05;
  else if (childElem === 'S' || childElem === 'P') bondDist = 2.55;

  const attachPos = parentAtom.position.clone().add(worldDir.clone().multiplyScalar(bondDist));

  // Calculate auto-rotation for child atom
  let childRotation = new THREE.Euler(0, 0, 0, 'XYZ');
  const targetDir = worldDir.clone().negate().normalize(); // Point back to parent

  if (childOrbital === 'sp2' || childOrbital === 'sp') {
    // Make unhybridized p-orbitals strictly parallel with matching phase signs
    const xChild = targetDir.clone(); // Child local +X points towards parent

    // Retrieve parent's unhybridized pz positive lobe direction in world space
    const parentAxes = getAtomUnhybridAxes(parentAtom);
    const pzAxis = parentAxes.find(a => a.name === 'pz') || parentAxes[0];
    const parentPzWorld = pzAxis
      ? pzAxis.worldPosDir.clone()
      : new THREE.Vector3(0, 0, 1).applyEuler(parentAtom.rotation).normalize();

    // Project parentPzWorld onto the plane orthogonal to xChild
    let zChild = parentPzWorld.clone().sub(xChild.clone().multiplyScalar(parentPzWorld.dot(xChild)));
    if (zChild.lengthSq() < 1e-4) {
      const fallback = Math.abs(xChild.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      zChild = fallback.sub(xChild.clone().multiplyScalar(fallback.dot(xChild))).normalize();
    } else {
      zChild.normalize();
      // Ensure positive lobe points in same direction (+ to +, - to -)
      if (zChild.dot(parentPzWorld) < 0) {
        zChild.negate();
      }
    }

    const yChild = new THREE.Vector3().crossVectors(zChild, xChild).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(xChild, yChild, zChild);
    childRotation = new THREE.Euler().setFromRotationMatrix(rotMat, 'XYZ');
  } else if (childOrbital !== 's') {
    childRotation = calculateRepulsionOptimizedRotation({
      newPos: attachPos,
      orbitalType: childOrbital,
      existingAtoms: [parentAtom],
      bondedParentAtom: parentAtom,
      bondDir: targetDir
    });
  }

  return {
    parentAtom,
    worldDir,
    attachPos,
    childRotation,
    childElem,
    childOrbital
  };
}

/**
 * Returns an array of THREE.Vector3 local lobe unit vectors for an orbital type.
 */
export function getOrbitalLobeDirections(orbitalType) {
  if (!orbitalType || orbitalType === 'none' || orbitalType === 's') {
    return [];
  }

  if (orbitalType === 'px') {
    return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
  }
  if (orbitalType === 'py') {
    return [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
  }
  if (orbitalType === 'pz') {
    return [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
  }
  if (orbitalType === 'p' || orbitalType === 'p_all') {
    return [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
    ];
  }

  if (orbitalType === 'sp') {
    return [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
    ];
  }

  if (orbitalType === 'sp2') {
    return [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(Math.cos(2 * Math.PI / 3), Math.sin(2 * Math.PI / 3), 0),
      new THREE.Vector3(Math.cos(4 * Math.PI / 3), Math.sin(4 * Math.PI / 3), 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
  }

  if (orbitalType === 'sp3') {
    const s = 1 / Math.sqrt(3);
    return [
      new THREE.Vector3(s, s, s),
      new THREE.Vector3(-s, -s, s),
      new THREE.Vector3(-s, s, -s),
      new THREE.Vector3(s, -s, -s)
    ];
  }

  if (orbitalType === 'sp3d') {
    return [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(Math.cos(2 * Math.PI / 3), Math.sin(2 * Math.PI / 3), 0),
      new THREE.Vector3(Math.cos(4 * Math.PI / 3), Math.sin(4 * Math.PI / 3), 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
  }

  if (orbitalType === 'sp3d2') {
    return [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
    ];
  }

  if (orbitalType === 'dxy') {
    const s = Math.SQRT1_2;
    return [
      new THREE.Vector3(s, s, 0), new THREE.Vector3(-s, s, 0),
      new THREE.Vector3(-s, -s, 0), new THREE.Vector3(s, -s, 0)
    ];
  }
  if (orbitalType === 'dxz') {
    const s = Math.SQRT1_2;
    return [
      new THREE.Vector3(s, 0, s), new THREE.Vector3(-s, 0, s),
      new THREE.Vector3(-s, 0, -s), new THREE.Vector3(s, 0, -s)
    ];
  }
  if (orbitalType === 'dyz') {
    const s = Math.SQRT1_2;
    return [
      new THREE.Vector3(0, s, s), new THREE.Vector3(0, -s, s),
      new THREE.Vector3(0, -s, -s), new THREE.Vector3(0, s, -s)
    ];
  }
  if (orbitalType === 'dx2y2') {
    return [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)
    ];
  }
  if (orbitalType === 'dz2') {
    return [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
  }

  return [];
}

/**
 * Calculates the optimal rotation for a new atom to maximize distances between
 * its orbital electron lobes and neighboring atoms/lobes (VSEPR electron-pair repulsion minimization).
 */
export function calculateRepulsionOptimizedRotation({
  newPos,
  orbitalType,
  existingAtoms = [],
  bondedParentAtom = null,
  bondDir = null
}) {
  if (!orbitalType || orbitalType === 'none' || orbitalType === 's') {
    return new THREE.Euler(0, 0, 0, 'XYZ');
  }

  const localLobes = getOrbitalLobeDirections(orbitalType);
  if (localLobes.length === 0) {
    return new THREE.Euler(0, 0, 0, 'XYZ');
  }

  const L_LOBE = 1.35;

  // Gather repulsive centers from existing atoms (their nucleus and lobe tips)
  const repellers = [];
  existingAtoms.forEach(other => {
    if (!other || (bondedParentAtom && other.id === bondedParentAtom.id)) {
      return;
    }
    const dist = other.position.distanceTo(newPos);
    if (dist > 7.0) return; // Skip far atoms

    // Nucleus position
    repellers.push({ pos: other.position.clone(), weight: 1.2 });

    // Other atom's lobe tips
    const otherLobes = getOrbitalLobeDirections(other.orbitalType);
    otherLobes.forEach(dir => {
      const worldDir = dir.clone().applyEuler(other.rotation).normalize();
      const tip = other.position.clone().add(worldDir.multiplyScalar(L_LOBE));
      repellers.push({ pos: tip, weight: 1.8 });
    });
  });

  // If there's a bonded parent atom, add its nucleus and lobe tips with high weight
  if (bondedParentAtom) {
    repellers.push({ pos: bondedParentAtom.position.clone(), weight: 2.2 });
    const pLobes = getOrbitalLobeDirections(bondedParentAtom.orbitalType);
    pLobes.forEach(dir => {
      const worldDir = dir.clone().applyEuler(bondedParentAtom.rotation).normalize();
      const tip = bondedParentAtom.position.clone().add(worldDir.multiplyScalar(L_LOBE));
      repellers.push({ pos: tip, weight: 2.8 });
    });
  }

  // Energy evaluation function: lower energy = lobes are farther from repellers
  const evaluateRepulsion = (quat) => {
    let energy = 0;
    for (let i = 0; i < localLobes.length; i++) {
      const lobeWorldDir = localLobes[i].clone().applyQuaternion(quat);
      const lobeTip = newPos.clone().add(lobeWorldDir.multiplyScalar(L_LOBE));

      for (let r = 0; r < repellers.length; r++) {
        const dSq = lobeTip.distanceToSquared(repellers[r].pos);
        energy += repellers[r].weight / Math.max(0.04, dSq);
      }
    }
    return energy;
  };

  // Case 1: Bonded to a parent atom along bondDir
  if (bondedParentAtom && bondDir) {
    const targetDir = bondDir.clone().normalize(); // Points towards parent

    // Identify primary local lobe pointing towards bond
    let u0 = localLobes[0].clone();
    if (orbitalType === 'sp3') {
      u0 = new THREE.Vector3(1, 1, 1).normalize();
    } else if (orbitalType === 'sp2' || orbitalType === 'sp') {
      u0 = new THREE.Vector3(1, 0, 0);
    } else if (orbitalType === 'sp3d' || orbitalType === 'sp3d2' || orbitalType === 'pz' || orbitalType === 'dz2') {
      u0 = new THREE.Vector3(0, 0, 1);
    }

    // Base alignment quaternion from u0 to targetDir
    const baseQuat = new THREE.Quaternion().setFromUnitVectors(u0, targetDir);

    if (repellers.length === 0) {
      return new THREE.Euler().setFromQuaternion(baseQuat, 'XYZ');
    }

    // Optimize dihedral angle phi around targetDir (72 steps = 5° resolution)
    let minEnergy = Infinity;
    let bestQuat = baseQuat.clone();

    const nSteps = 72;
    for (let s = 0; s < nSteps; s++) {
      const phi = (s * 2 * Math.PI) / nSteps;
      const rotAroundBond = new THREE.Quaternion().setFromAxisAngle(targetDir, phi);
      const testQuat = rotAroundBond.clone().multiply(baseQuat);

      const energy = evaluateRepulsion(testQuat);
      if (energy < minEnergy) {
        minEnergy = energy;
        bestQuat = testQuat;
      }
    }

    return new THREE.Euler().setFromQuaternion(bestQuat, 'XYZ');
  }

  // Case 2: Free placement or manual add near existing atoms
  if (repellers.length === 0) {
    return new THREE.Euler(0, 0, 0, 'XYZ');
  }

  // Check if there is a close neighbor atom
  let closestNeighbor = null;
  let minNeighborDist = Infinity;
  existingAtoms.forEach(other => {
    if (!other) return;
    const d = other.position.distanceTo(newPos);
    if (d > 0.1 && d < 5.5 && d < minNeighborDist) {
      minNeighborDist = d;
      closestNeighbor = other;
    }
  });

  if (closestNeighbor && (orbitalType === 'sp' || orbitalType === 'sp2')) {
    const vToNeighbor = closestNeighbor.position.clone().sub(newPos).normalize();

    // Query neighbor's unhybridized or p axes
    const neighborAxes = getAtomUnhybridAxes(closestNeighbor);
    let pRef = neighborAxes.length > 0 ? neighborAxes[0].worldPosDir.clone() : null;

    if (orbitalType === 'sp') {
      // Linear hybrid axis along X
      const xLocal = vToNeighbor.clone();
      let zLocal = null;
      if (pRef) {
        zLocal = pRef.clone().sub(xLocal.clone().multiplyScalar(pRef.dot(xLocal)));
      }
      if (!zLocal || zLocal.lengthSq() < 1e-4) {
        const fallback = Math.abs(xLocal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        zLocal = fallback.sub(xLocal.clone().multiplyScalar(fallback.dot(xLocal))).normalize();
      } else {
        zLocal.normalize();
      }
      const yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
      zLocal = new THREE.Vector3().crossVectors(xLocal, yLocal).normalize();

      const rotMat = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
      return new THREE.Euler().setFromRotationMatrix(rotMat, 'XYZ');
    } else if (orbitalType === 'sp2') {
      // Trigonal planar: pz is normal to plane
      let zLocal = pRef ? pRef.clone() : (Math.abs(vToNeighbor.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
      let xLocal = vToNeighbor.clone().sub(zLocal.clone().multiplyScalar(vToNeighbor.dot(zLocal)));
      if (xLocal.lengthSq() < 1e-4) {
        const fallback = Math.abs(zLocal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        xLocal = fallback.sub(zLocal.clone().multiplyScalar(fallback.dot(zLocal))).normalize();
      } else {
        xLocal.normalize();
      }
      const yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
      zLocal = new THREE.Vector3().crossVectors(xLocal, yLocal).normalize();

      const rotMat = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
      return new THREE.Euler().setFromRotationMatrix(rotMat, 'XYZ');
    }
  }

  let u0 = localLobes[0].clone();
  if (orbitalType === 'sp3') u0 = new THREE.Vector3(1, 1, 1).normalize();
  else if (orbitalType === 'sp2' || orbitalType === 'sp') u0 = new THREE.Vector3(1, 0, 0);
  else if (orbitalType === 'sp3d' || orbitalType === 'sp3d2') u0 = new THREE.Vector3(0, 0, 1);

  // Sample 24 spherical directions using Fibonacci spiral + 8 roll angles
  let minEnergy = Infinity;
  let bestQuat = new THREE.Quaternion();

  const samples = 24;
  const phiGolden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phiGolden * i;
    const dir = new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize();

    const alignQuat = new THREE.Quaternion().setFromUnitVectors(u0, dir);

    for (let r = 0; r < 8; r++) {
      const roll = (r * 2 * Math.PI) / 8;
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(dir, roll);
      const testQuat = rollQuat.clone().multiply(alignQuat);

      const energy = evaluateRepulsion(testQuat);
      if (energy < minEnergy) {
        minEnergy = energy;
        bestQuat = testQuat;
      }
    }
  }

  return new THREE.Euler().setFromQuaternion(bestQuat, 'XYZ');
}

/**
 * Computes the molecular formula, title, and descriptive subtitle
 */
export function computeMolecularFormula(atoms = [], bonds = [], bridges = []) {
  const nAtoms = atoms.length;
  if (nAtoms === 0) {
    return {
      formula: '—',
      title: 'Empty Canvas',
      atomCountText: '0 atoms'
    };
  }

  const atomCountText = `${nAtoms} atom${nAtoms === 1 ? '' : 's'}`;

  // Count element frequencies
  const elemCounts = {};
  atoms.forEach(a => {
    const elem = (a.element || parseElementFromName(a.name) || 'X').trim();
    elemCounts[elem] = (elemCounts[elem] || 0) + 1;
  });

  const numC = elemCounts['C'] || 0;
  const numH = elemCounts['H'] || 0;
  const numO = elemCounts['O'] || 0;
  const numN = elemCounts['N'] || 0;
  const numP = elemCounts['P'] || 0;
  const numCl = elemCounts['Cl'] || 0;
  const numS = elemCounts['S'] || 0;
  const numF = elemCounts['F'] || 0;
  const totalElems = Object.keys(elemCounts).length;

  const sub = (n) => {
    if (n <= 1) return '';
    const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return String(n).split('').map(d => map[d] || d).join('');
  };

  // 1. Ethylene (C2H4: CH2=CH2)
  if (totalElems === 2 && numC === 2 && numH === 4) {
    return { formula: 'CH₂=CH₂', title: 'Ethylene (sp² + π-Bond)', atomCountText };
  }

  // 2. Acetylene (C2H2: HC≡CH)
  if (totalElems === 2 && numC === 2 && numH === 2) {
    return { formula: 'HC≡CH', title: 'Acetylene (sp + 2π-Bonds)', atomCountText };
  }

  // 3. Ethane (C2H6: CH3–CH3)
  if (totalElems === 2 && numC === 2 && numH === 6) {
    return { formula: 'CH₃–CH₃', title: 'Ethane (sp³ σ-Bond)', atomCountText };
  }

  // 4. Benzene (C6H6)
  if (totalElems === 2 && numC === 6 && numH === 6) {
    return { formula: 'C₆H₆', title: 'Benzene (Delocalized π-Ring)', atomCountText };
  }

  // 5. Cyclohexane (C6H12)
  if (totalElems === 2 && numC === 6 && numH === 12) {
    return { formula: 'C₆H₁₂', title: 'Cyclohexane (Conformation)', atomCountText };
  }

  // 6. Methane (CH4)
  if (totalElems === 2 && numC === 1 && numH === 4) {
    return { formula: 'CH₄', title: 'Methane (Tetrahedral)', atomCountText };
  }

  // 7. Water (H2O)
  if (totalElems === 2 && numH === 2 && numO === 1) {
    return { formula: 'H₂O', title: 'Water (Bent Lone Pairs)', atomCountText };
  }

  // 8. Ammonia (NH3)
  if (totalElems === 2 && numN === 1 && numH === 3) {
    return { formula: 'NH₃', title: 'Ammonia (Trigonal Pyramidal)', atomCountText };
  }

  // 9. PCl5
  if (totalElems === 2 && numP === 1 && numCl === 5) {
    return { formula: 'PCl₅', title: 'Phosphorus Pentachloride (sp³d)', atomCountText };
  }

  // 10. SF6
  if (totalElems === 2 && numS === 1 && numF === 6) {
    return { formula: 'SF₆', title: 'Sulfur Hexafluoride (sp³d²)', atomCountText };
  }

  // 11. Nitrogen Dioxide (NO2)
  if (totalElems === 2 && numN === 1 && numO === 2) {
    return { formula: 'NO₂', title: 'Nitrogen Dioxide (Radical / Conjugated π)', atomCountText };
  }

  // 12. Sulfur Dioxide (SO2)
  if (totalElems === 2 && numS === 1 && numO === 2) {
    return { formula: 'SO₂', title: 'Sulfur Dioxide (pπ–dπ & pπ–pπ Resonance)', atomCountText };
  }

  // 13. Carbon Dioxide (CO2)
  if (totalElems === 2 && numC === 1 && numO === 2) {
    return { formula: 'CO₂', title: 'Carbon Dioxide (Linear • 2π-Bonds)', atomCountText };
  }

  // 14. Graphene Sheet / Carbon Allotrope
  if (totalElems === 1 && numC >= 10) {
    return { formula: `C${sub(numC)}`, title: 'Graphene (sp² Honeycomb Sheet)', atomCountText };
  }

  // 13. Atomic Orbitals (e.g. 5 d-orbitals)
  if (atoms.every(a => a.orbitalType && (a.orbitalType.startsWith('d') || a.name.includes('3d') || a.name.startsWith('d')))) {
    return { formula: `${nAtoms} × d-Orbitals`, title: 'Atomic Orbitals + Nodal Surfaces', atomCountText };
  }

  // Standard Hill System:
  // If Carbon is present: C first, then H, then all other elements sorted alphabetically
  // If no Carbon: all elements sorted alphabetically
  let orderedElems = [];
  if ('C' in elemCounts) {
    orderedElems.push('C');
    if ('H' in elemCounts) orderedElems.push('H');
    const rest = Object.keys(elemCounts).filter(e => e !== 'C' && e !== 'H').sort();
    orderedElems = orderedElems.concat(rest);
  } else {
    orderedElems = Object.keys(elemCounts).sort();
  }

  const hillFormula = orderedElems.map(e => `${e}${sub(elemCounts[e])}`).join('');

  // Descriptive subtitle
  let title = '';
  if (Array.isArray(bridges) && bridges.length > 0) {
    const bondingCount = bridges.filter(b => b.type === 'bonding').length;
    const antibondingCount = bridges.filter(b => b.type === 'antibonding').length;
    if (antibondingCount > 0 && bondingCount > 0) {
      title = `${bondingCount} π-Bond(s), ${antibondingCount} π*-Nodal`;
    } else if (antibondingCount > 0) {
      title = `${antibondingCount} Antibonding π* Node(s)`;
    } else {
      title = `${bondingCount} π-Bond Bridge(s)`;
    }
  } else if (Array.isArray(bonds) && bonds.length > 0) {
    title = `${bonds.length} Covalent Bond${bonds.length === 1 ? '' : 's'}`;
  } else {
    title = `${nAtoms} Atom${nAtoms === 1 ? '' : 's'} on Canvas`;
  }

  return { formula: hillFormula, title, atomCountText };
}
