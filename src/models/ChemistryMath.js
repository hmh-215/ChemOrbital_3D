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
  } else if (type === 'p_all') {
    axes.push({ local: new THREE.Vector3(0, 0, 1), name: 'pz' });
    axes.push({ local: new THREE.Vector3(0, 1, 0), name: 'py' });
    axes.push({ local: new THREE.Vector3(1, 0, 0), name: 'px' });
  }
  return axes.map(a => ({
    name: a.name,
    // World direction of positive (+/Red) lobe
    worldPosDir: a.local.clone().applyEuler(atom.rotation).normalize()
  }));
}

/**
 * Aligns an atom's unhybridized p-orbitals to be strictly parallel with bonded neighbors.
 * getBondedNeighborsFn: (atom) => [{ bond, neighbor }]
 */
export function alignAtomWithBondedNeighbors(atom, getBondedNeighborsFn) {
  if (!atom || (atom.orbitalType !== 'sp2' && atom.orbitalType !== 'sp')) return false;

  const neighbors = getBondedNeighborsFn(atom);
  if (neighbors.length === 0) return false;

  if (neighbors.length === 1) {
    // Single neighbor (terminal atom, e.g. Oxygen in NO2, or Carbon in C2H4/C2H2)
    const neighbor = neighbors[0].neighbor;
    const xLocal = neighbor.position.clone().sub(atom.position).normalize();

    // Target p-axis from neighbor
    let pTarget = null;
    const neighborAxes = getAtomUnhybridAxes(neighbor);
    if (neighborAxes.length > 0) {
      pTarget = neighborAxes[0].worldPosDir.clone();
    } else {
      // If neighbor has no p-orbital, check if neighbor has other bonds defining a plane
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

    // Project pTarget onto plane perpendicular to xLocal
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
    // 2 or more neighbors (central atom, e.g. Nitrogen in NO2, or Carbon in Benzene/Ethylene)
    // Sort neighbors so heavy/non-H atoms come first to align primary hybrid lobe along the C-C / principal bond
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

    // Match phase sign with existing neighbor p-orbitals if present
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
    let u0 = new THREE.Vector3(1, 0, 0);
    if (childOrbital === 'sp3') {
      u0 = new THREE.Vector3(1, 1, 1).normalize();
    } else if (childOrbital === 'dz2' || childOrbital === 'pz' || childOrbital === 'p' || childOrbital === 'sp3d' || childOrbital === 'sp3d2') {
      u0 = new THREE.Vector3(0, 0, 1);
    }

    const quat = new THREE.Quaternion().setFromUnitVectors(u0, targetDir);
    childRotation = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
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

  // 12. Graphene Sheet / Carbon Allotrope
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
