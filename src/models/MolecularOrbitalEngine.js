/**
 * MolecularOrbitalEngine.js
 * Physics and quantum chemistry calculation engine for Molecular Orbital (MO) theory.
 * Computes:
 * 1. Total valence electrons based on elements and net molecular charge: Ne = sum(Zval) - Charge
 * 2. Diatomic / Localized bond MO energy levels (sigma, sigma*, pi, pi*)
 * 3. Polyatomic MO diagrams via Symmetry-Adapted Linear Combinations (SALCs) / Ligand Group Orbitals (LGOs)
 * 4. Dynamic electron population via Aufbau principle, Pauli exclusion, and Hund's rule
 * 5. Bond order = (N_bonding - N_antibonding) / 2
 * 6. HOMO, LUMO, and magnetic properties (Diamagnetic vs. Paramagnetic)
 */

export const VALENCE_ELECTRONS = {
  H: 1, He: 2,
  Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8,
  K: 1, Ca: 2, Br: 7, I: 7
};

/**
 * Calculates total valence electrons for a collection of atoms and molecular charge.
 */
export function calculateValenceElectrons(atoms, charge = null) {
  let count = 0;
  let atomChargeSum = 0;
  for (const atom of atoms) {
    const elem = (atom.element || atom.name.replace(/[0-9]/g, '')).trim();
    count += (VALENCE_ELECTRONS[elem] || 4);
    atomChargeSum += (atom.charge || 0);
  }
  const effectiveCharge = (charge !== null && charge !== undefined && charge !== 0) ? charge : ((atomChargeSum !== 0) ? atomChargeSum : (charge || 0));
  return Math.max(0, count - effectiveCharge);
}

/**
 * Distributes electrons into molecular orbital levels following:
 * 1. Aufbau Principle (lowest energy to highest energy)
 * 2. Pauli Exclusion Principle (maximum 2 electrons per individual spatial orbital, opposite spins)
 * 3. Hund's Rule (for degenerate levels, occupy singly with parallel spins before pairing)
 */
export function populateElectrons(levels, totalElectrons) {
  let remaining = totalElectrons;

  // Clone levels to avoid mutating template
  const populated = levels.map(lvl => ({
    ...lvl,
    orbitals: Array.from({ length: lvl.degeneracy || 1 }, () => ({
      electrons: 0,
      spins: [] // 'up', 'down'
    }))
  }));

  for (const lvl of populated) {
    if (remaining <= 0) break;
    const numOrbs = lvl.orbitals.length;
    const maxCapacity = numOrbs * 2;
    const electronsToAdd = Math.min(remaining, maxCapacity);

    // Apply Hund's rule across degenerate orbitals
    // Step 1: Add first electron (spin up) to each orbital
    for (let i = 0; i < numOrbs && remaining > 0 && lvl.orbitals[i].electrons < 1; i++) {
      lvl.orbitals[i].electrons = 1;
      lvl.orbitals[i].spins.push('up');
      remaining--;
    }

    // Step 2: Add second electron (spin down) to pair up
    for (let i = 0; i < numOrbs && remaining > 0 && lvl.orbitals[i].electrons < 2; i++) {
      lvl.orbitals[i].electrons = 2;
      lvl.orbitals[i].spins.push('down');
      remaining--;
    }
  }

  // Calculate statistics
  let nBonding = 0;
  let nAntibonding = 0;
  let nNonbonding = 0;
  let unpairedElectrons = 0;
  let homoIndex = -1;
  let lumoIndex = -1;

  populated.forEach((lvl, idx) => {
    let lvlElectrons = 0;
    lvl.orbitals.forEach(orb => {
      lvlElectrons += orb.electrons;
      if (orb.electrons === 1) unpairedElectrons++;

      if (lvl.type === 'bonding') nBonding += orb.electrons;
      else if (lvl.type === 'antibonding') nAntibonding += orb.electrons;
      else nNonbonding += orb.electrons;
    });

    lvl.totalElectrons = lvlElectrons;
    lvl.isFull = lvlElectrons === lvl.orbitals.length * 2;
    lvl.isEmpty = lvlElectrons === 0;

    if (lvlElectrons > 0) {
      homoIndex = idx;
    }
  });

  // LUMO is the lowest level above or at HOMO that has room for electrons
  for (let i = 0; i < populated.length; i++) {
    const lvl = populated[i];
    if (lvl.totalElectrons < lvl.orbitals.length * 2 && i >= homoIndex) {
      lumoIndex = i;
      break;
    }
  }

  const bondOrder = Math.max(0, (nBonding - nAntibonding) / 2);

  return {
    levels: populated,
    totalElectrons,
    nBonding,
    nAntibonding,
    nNonbonding,
    bondOrder,
    unpairedElectrons,
    isParamagnetic: unpairedElectrons > 0,
    homo: homoIndex >= 0 ? populated[homoIndex] : null,
    lumo: lumoIndex >= 0 ? populated[lumoIndex] : null
  };
}

/**
 * Builds Atomic Orbital (AO) Energy Diagram for a single atom or isolated fragment.
 * Supports:
 * - H, He (1s valence level)
 * - 2nd row: C, N, O, F, B, Be, Li, Ne (2s, 2p levels)
 * - 3rd row: S, P, Cl, Si, Na, Mg, Al, Ar (3s, 3p, 3d levels)
 */
export function buildAtomicOrbitalDiagram(atom, charge = null) {
  const elem = (atom.element || atom.name.replace(/[0-9]/g, '')).trim();
  const effectiveCharge = (charge !== null && charge !== undefined) ? charge : (atom.charge || 0);
  const baseValence = VALENCE_ELECTRONS[elem] || 1;
  const totalElectrons = Math.max(0, baseValence - effectiveCharge);

  let levels = [];
  let leftAOs = [];
  let rightAOs = [];

  if (elem === 'H' || elem === 'He') {
    levels = [
      {
        id: '1s',
        label: '1s',
        symmetry: 'a₁g',
        type: 'bonding',
        energy: 1.5,
        degeneracy: 1,
        sourceLeft: `${elem} Nucleus`,
        sourceRight: 'Valence Shell',
        desc: `Spherical 1s atomic orbital of ${elem}. Electron capacity: 2.`
      }
    ];
    leftAOs = [
      { label: `${elem}(Core)`, energy: 0.5, type: 'ao' }
    ];
    rightAOs = [
      { label: 'Vacuum (E=0)', energy: 4.5, type: 'ao' }
    ];
  } else if (['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'].includes(elem)) {
    levels = [
      {
        id: '2s',
        label: '2s',
        symmetry: 'a₁g',
        type: 'bonding',
        energy: 1.2,
        degeneracy: 1,
        sourceLeft: `${elem} Core (1s²)`,
        sourceRight: 'Valence 2s',
        desc: `Valence 2s spherical atomic orbital of ${elem}.`
      },
      {
        id: '2p',
        label: '2p (px, py, pz)',
        symmetry: 't₁u',
        type: 'nonbonding',
        energy: 3.2,
        degeneracy: 3,
        sourceLeft: `${elem} Core`,
        sourceRight: 'Valence 2p',
        desc: `Triply degenerate 2p atomic orbitals (px, py, pz) of ${elem}.`
      }
    ];
    leftAOs = [
      { label: `${elem}(1s² Core)`, energy: 0.4, type: 'ao' }
    ];
    rightAOs = [
      { label: 'Vacuum (E=0)', energy: 5.0, type: 'ao' }
    ];
  } else {
    // 3rd row (S, P, Cl, etc.)
    levels = [
      {
        id: '3s',
        label: '3s',
        symmetry: 'a₁g',
        type: 'bonding',
        energy: 1.0,
        degeneracy: 1,
        sourceLeft: `${elem} [Ne] Core`,
        sourceRight: 'Valence 3s',
        desc: `Valence 3s atomic orbital of ${elem}.`
      },
      {
        id: '3p',
        label: '3p (px, py, pz)',
        symmetry: 't₁u',
        type: 'nonbonding',
        energy: 2.8,
        degeneracy: 3,
        sourceLeft: `${elem} [Ne] Core`,
        sourceRight: 'Valence 3p',
        desc: `Triply degenerate 3p atomic orbitals of ${elem}.`
      },
      {
        id: '3d',
        label: '3d (5× degenerate)',
        symmetry: 'eg + t₂g',
        type: 'antibonding',
        energy: 4.8,
        degeneracy: 5,
        sourceLeft: `${elem} [Ne] Core`,
        sourceRight: 'Empty 3d Shell',
        desc: `Fivefold degenerate 3d atomic orbitals accessible for expanded octets (sp³d, sp³d²).`
      }
    ];
    leftAOs = [
      { label: `${elem}([Ne] Core)`, energy: 0.3, type: 'ao' }
    ];
    rightAOs = [
      { label: 'Vacuum (E=0)', energy: 5.8, type: 'ao' }
    ];
  }

  const population = populateElectrons(levels, totalElectrons);
  const signStr = effectiveCharge !== 0 ? (effectiveCharge > 0 ? `⁺${effectiveCharge > 1 ? effectiveCharge : ''}` : `⁻${Math.abs(effectiveCharge) > 1 ? Math.abs(effectiveCharge) : ''}`) : '';

  return {
    title: `${elem}${signStr} Atomic Orbital Diagram`,
    subtitle: `Single Atom State • ${totalElectrons} Valence e⁻ (Charge: ${effectiveCharge >= 0 ? '+' + effectiveCharge : effectiveCharge})`,
    systemType: 'atomic_ao',
    atomElement: elem,
    atomCharge: effectiveCharge,
    leftLabel: `${elem} Core / Nucleus`,
    rightLabel: 'Energy Levels',
    leftAOs,
    rightAOs,
    bondOrder: 0.0,
    ...population
  };
}

/**
 * Builds MO diagram template for standard diatomic systems (H2, O2, N2, CO, NO, etc.)
 */
export function buildDiatomicMODiagram(atomA, atomB, charge = null) {
  const elemA = (atomA.element || atomA.name.replace(/[0-9]/g, '')).trim();
  const elemB = (atomB.element || atomB.name.replace(/[0-9]/g, '')).trim();

  const atomChargeSum = (atomA.charge || 0) + (atomB.charge || 0);
  const effectiveCharge = (charge !== null && charge !== undefined && charge !== 0) ? charge : ((atomChargeSum !== 0) ? atomChargeSum : (charge || 0));

  // Special Case 1: Pure Hydrogen / Helium (1s valence only)
  if ((elemA === 'H' || elemA === 'He') && (elemB === 'H' || elemB === 'He')) {
    const totalElectrons = Math.max(0, (VALENCE_ELECTRONS[elemA] || 1) + (VALENCE_ELECTRONS[elemB] || 1) - effectiveCharge);
    const levels = [
      {
        id: 'sigma_1s',
        label: 'σ(1s)',
        symmetry: 'σg',
        type: 'bonding',
        energy: 1.0,
        degeneracy: 1,
        sourceLeft: `${elemA}(1s)`,
        sourceRight: `${elemB}(1s)`,
        desc: 'In-phase constructive overlap of 1s orbitals. High electron probability between nuclei, lower potential energy.'
      },
      {
        id: 'sigma_star_1s',
        label: 'σ*(1s)',
        symmetry: 'σu*',
        type: 'antibonding',
        energy: 4.0,
        degeneracy: 1,
        sourceLeft: `${elemA}(1s)`,
        sourceRight: `${elemB}(1s)`,
        desc: 'Out-of-phase destructive interference with a nodal plane perpendicular to the internuclear axis. Higher energy.'
      }
    ];

    const leftAOs = [
      { label: `${elemA}(1s)`, energy: 2.2, type: 'ao' }
    ];
    const rightAOs = [
      { label: `${elemB}(1s)`, energy: 2.2, type: 'ao' }
    ];

    const population = populateElectrons(levels, totalElectrons);
    return {
      title: `${elemA}–${elemB} Diatomic MO Diagram`,
      subtitle: `${elemA}2 (Charge: ${effectiveCharge >= 0 ? '+' + effectiveCharge : effectiveCharge})`,
      systemType: 'diatomic_1s',
      leftLabel: `${elemA}${atomA.charge ? (atomA.charge > 0 ? '⁺' : '⁻') : ''} Atomic Orbital`,
      rightLabel: `${elemB}${atomB.charge ? (atomB.charge > 0 ? '⁺' : '⁻') : ''} Atomic Orbital`,
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // Special Case 2: Second row diatomics (O2, N2, F2, C2, etc.) or Heteronuclear (CO, NO, SO localized)
  const isOxygenOrFluorine = (elemA === 'O' || elemA === 'F' || elemB === 'O' || elemB === 'F');
  const isSulfurOrPhosphorus = (elemA === 'S' || elemA === 'P' || elemB === 'S' || elemB === 'P');

  const totalElectrons = Math.max(0, (VALENCE_ELECTRONS[elemA] || 4) + (VALENCE_ELECTRONS[elemB] || 4) - effectiveCharge);

  // Energy ordering: for O2, F2 (sigma_2p is below pi_2p due to large 2s-2p separation)
  // For B2, C2, N2 (pi_2p is below sigma_2p due to s-p mixing)
  const piBelowSigma = !isOxygenOrFluorine;

  const levels = [
    {
      id: 'sigma_2s',
      label: 'σ(2s)',
      symmetry: '2σg',
      type: 'bonding',
      energy: 0.8,
      degeneracy: 1,
      sourceLeft: '2s',
      sourceRight: '2s',
      desc: 'In-phase head-on constructive overlap of valence s-orbitals.'
    },
    {
      id: 'sigma_star_2s',
      label: 'σ*(2s)',
      symmetry: '2σu*',
      type: 'antibonding',
      energy: 1.8,
      degeneracy: 1,
      sourceLeft: '2s',
      sourceRight: '2s',
      desc: 'Out-of-phase overlap of 2s orbitals with a nodal plane.'
    },
    piBelowSigma
      ? {
          id: 'pi_2p',
          label: 'π(2p)',
          symmetry: '1πu',
          type: 'bonding',
          energy: 2.6,
          degeneracy: 2,
          sourceLeft: '2px, 2py',
          sourceRight: '2px, 2py',
          desc: 'Degenerate pair of lateral π-bonds (px-px and py-py) perpendicular to bond axis.'
        }
      : {
          id: 'sigma_2p',
          label: 'σ(2p)',
          symmetry: '3σg',
          type: 'bonding',
          energy: 2.5,
          degeneracy: 1,
          sourceLeft: '2pz',
          sourceRight: '2pz',
          desc: 'Head-on axial overlap of 2pz orbitals along internuclear axis.'
        },
    piBelowSigma
      ? {
          id: 'sigma_2p',
          label: 'σ(2p)',
          symmetry: '3σg',
          type: 'bonding',
          energy: 3.1,
          degeneracy: 1,
          sourceLeft: '2pz',
          sourceRight: '2pz',
          desc: 'Head-on axial overlap of 2pz orbitals along internuclear axis.'
        }
      : {
          id: 'pi_2p',
          label: 'π(2p)',
          symmetry: '1πu',
          type: 'bonding',
          energy: 3.0,
          degeneracy: 2,
          sourceLeft: '2px, 2py',
          sourceRight: '2px, 2py',
          desc: 'Degenerate pair of lateral π-bonds (px-px and py-py) perpendicular to bond axis.'
        },
    {
      id: 'pi_star_2p',
      label: 'π*(2p)',
      symmetry: '1πg*',
      type: 'antibonding',
      energy: 4.2,
      degeneracy: 2,
      sourceLeft: '2px, 2py',
      sourceRight: '2px, 2py',
      desc: 'Degenerate pair of lateral π* antibonding orbitals with two nodal planes.'
    },
    {
      id: 'sigma_star_2p',
      label: 'σ*(2p)',
      symmetry: '3σu*',
      type: 'antibonding',
      energy: 5.2,
      degeneracy: 1,
      sourceLeft: '2pz',
      sourceRight: '2pz',
      desc: 'Axial out-of-phase σ* antibonding orbital with high energy and internuclear node.'
    }
  ];

  // If Sulfur/d-orbital is involved, add dπ interaction levels
  if (isSulfurOrPhosphorus) {
    levels.push({
      id: 'pi_pd_res',
      label: 'π(pπ-dπ)*',
      symmetry: 'dπ*',
      type: 'antibonding',
      energy: 5.8,
      degeneracy: 1,
      sourceLeft: '3dπ',
      sourceRight: '2pπ',
      desc: 'Antibonding combination of empty sulfur 3d orbital and oxygen 2p lobe.'
    });
  }

  const leftAOs = [
    { label: `${elemA}(2s)`, energy: 1.3, type: 'ao' },
    { label: `${elemA}(2p)`, energy: 3.4, type: 'ao', count: 3 }
  ];
  const rightAOs = [
    { label: `${elemB}(2s)`, energy: 1.3, type: 'ao' },
    { label: `${elemB}(2p)`, energy: 3.4, type: 'ao', count: 3 }
  ];

  const population = populateElectrons(levels, totalElectrons);
  return {
    title: `${elemA}–${elemB} Localized / Diatomic MO Diagram`,
    subtitle: `${elemA}${elemB} (Valence e⁻: ${totalElectrons})`,
    systemType: 'diatomic_2p',
    leftLabel: `${elemA} Orbitals`,
    rightLabel: `${elemB} Orbitals`,
    leftAOs,
    rightAOs,
    ...population
  };
}

/**
 * Builds Polyatomic MO Diagrams using Symmetry Adapted Linear Combinations (SALCs)
 * Supported systems:
 * - H2O (Water, C2v)
 * - SO2 (Sulfur Dioxide, C2v, pπ-dπ resonance)
 * - CO2 (Carbon Dioxide, Dinf_h)
 * - C2H4 (Ethylene, D2h, π frontier)
 * - C2H2 (Acetylene, Dinf_h, 2π frontier)
 * - CH4 (Methane, Td)
 * - Benzene C6H6 (D6h aromatic π ring)
 */
export function buildPolyatomicMODiagram(moleculeType, atoms, charge = 0) {
  const totalElectrons = calculateValenceElectrons(atoms, charge);

  // 1. Water (H2O) - C2v Point Group
  if (moleculeType === 'h2o' || moleculeType === 'preset-h2o') {
    const levels = [
      {
        id: '2a1',
        label: '2a₁ (σ O-H)',
        symmetry: '2a₁',
        type: 'bonding',
        energy: 0.9,
        degeneracy: 1,
        sourceLeft: 'O(2s)',
        sourceRight: '2H SALC (a₁: s₁+s₂)',
        desc: 'Strongly bonding σ-orbital formed from O(2s) and symmetric in-phase 2H SALC (1s + 1s).'
      },
      {
        id: '1b2',
        label: '1b₂ (σ O-H)',
        symmetry: '1b₂',
        type: 'bonding',
        energy: 1.8,
        degeneracy: 1,
        sourceLeft: 'O(2py)',
        sourceRight: '2H SALC (b₂: s₁-s₂)',
        desc: 'Bonding σ-orbital from O(2py) and antisymmetric out-of-phase 2H SALC (1s - 1s).'
      },
      {
        id: '3a1',
        label: '3a₁ (n / lone pair)',
        symmetry: '3a₁',
        type: 'nonbonding',
        energy: 2.8,
        degeneracy: 1,
        sourceLeft: 'O(2pz)',
        sourceRight: '2H SALC (a₁)',
        desc: 'Weakly bonding / nonbonding lone pair orbital oriented along C₂ symmetry axis.'
      },
      {
        id: '1b1',
        label: '1b₁ (n / pure lone pair)',
        symmetry: '1b₁',
        type: 'nonbonding',
        energy: 3.5,
        degeneracy: 1,
        sourceLeft: 'O(2px)',
        sourceRight: 'None (no matching SALC)',
        desc: 'HOMO of H₂O: Pure nonbonding Oxygen 2px lone pair orbital perpendicular to molecular plane.'
      },
      {
        id: '4a1_star',
        label: '4a₁* (σ* O-H)',
        symmetry: '4a₁*',
        type: 'antibonding',
        energy: 4.6,
        degeneracy: 1,
        sourceLeft: 'O(2s, 2pz)',
        sourceRight: '2H SALC (a₁)',
        desc: 'LUMO of H₂O: Antibonding σ* orbital with nodes along O-H bonds.'
      },
      {
        id: '2b2_star',
        label: '2b₂* (σ* O-H)',
        symmetry: '2b₂*',
        type: 'antibonding',
        energy: 5.5,
        degeneracy: 1,
        sourceLeft: 'O(2py)',
        sourceRight: '2H SALC (b₂)',
        desc: 'High energy antibonding σ* orbital with multiple nodal planes.'
      }
    ];

    const leftAOs = [
      { label: 'O(2s)', energy: 1.1, type: 'ao' },
      { label: 'O(2p)', energy: 3.2, type: 'ao', count: 3 }
    ];
    const rightAOs = [
      { label: '2H SALC a₁ (s₁+s₂)', energy: 1.5, type: 'salc' },
      { label: '2H SALC b₂ (s₁-s₂)', energy: 2.1, type: 'salc' }
    ];

    const population = populateElectrons(levels, totalElectrons);
    return {
      title: 'Water (H₂O) SALC Molecular Orbital Diagram',
      subtitle: `C₂v Symmetry • 8 Valence e⁻ (Current: ${totalElectrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
      systemType: 'h2o',
      leftLabel: 'Oxygen AOs (Central)',
      rightLabel: '2H Ligand SALCs',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 2. Sulfur Dioxide (SO2) - C2v with 3-center delocalized π and pπ-dπ backbonding
  if (moleculeType === 'so2' || moleculeType === 'preset-so2') {
    const levels = [
      {
        id: '1a1_o2s',
        label: '1a₁ (O 2s)',
        symmetry: '1a₁',
        type: 'nonbonding',
        energy: 0.2,
        degeneracy: 1,
        sourceLeft: 'None',
        sourceRight: '2O SALC (s₁+s₂)',
        desc: 'Deep symmetric nonbonding combination of Oxygen 2s orbitals.'
      },
      {
        id: '1b2_o2s',
        label: '1b₂ (O 2s)',
        symmetry: '1b₂',
        type: 'nonbonding',
        energy: 0.4,
        degeneracy: 1,
        sourceLeft: 'None',
        sourceRight: '2O SALC (s₁-s₂)',
        desc: 'Deep antisymmetric nonbonding combination of Oxygen 2s orbitals.'
      },
      {
        id: '2a1_sigma',
        label: '2a₁ (σ S-O)',
        symmetry: '2a₁',
        type: 'bonding',
        energy: 0.9,
        degeneracy: 1,
        sourceLeft: 'S(3s)',
        sourceRight: '2O SALC (σ₁)',
        desc: 'Strongly bonding σ-framework from S(3s) and symmetric oxygen σ-SALC.'
      },
      {
        id: '2b2_sigma',
        label: '2b₂ (σ S-O)',
        symmetry: '2b₂',
        type: 'bonding',
        energy: 1.5,
        degeneracy: 1,
        sourceLeft: 'S(3py)',
        sourceRight: '2O SALC (σ₂)',
        desc: 'Bonding σ-framework from S(3py) and antisymmetric oxygen σ-SALC.'
      },
      {
        id: '3a1_sigma',
        label: '3a₁ (S lone pair)',
        symmetry: '3a₁',
        type: 'nonbonding',
        energy: 2.2,
        degeneracy: 1,
        sourceLeft: 'S(sp² hybrid)',
        sourceRight: '2O σ-SALC',
        desc: 'Sulfur nonbonding lone pair in sp² hybrid lobe pointing away from oxygens.'
      },
      {
        id: '1b1_pi',
        label: '1b₁ (π 3-center)',
        symmetry: '1b₁',
        type: 'bonding',
        energy: 2.8,
        degeneracy: 1,
        sourceLeft: 'S(3pz / 3d)',
        sourceRight: '2O π-SALC (+ +)',
        desc: 'Delocalized 3-center π bonding orbital: in-phase constructive overlap of O(2pz) - S(3pz/3d) - O(2pz).'
      },
      {
        id: 'n_oxygen',
        label: 'n_O (Oxygen lone pairs)',
        symmetry: '4a₁ + 3b₂',
        type: 'nonbonding',
        energy: 3.4,
        degeneracy: 2,
        sourceLeft: 'None',
        sourceRight: '2O in-plane 2p',
        desc: 'In-plane nonbonding lone pairs localized on terminal oxygen atoms.'
      },
      {
        id: '1a2_pi_nb',
        label: '1a₂ (π nonbonding)',
        symmetry: '1a₂',
        type: 'nonbonding',
        energy: 3.9,
        degeneracy: 1,
        sourceLeft: 'Nodal at S (0)',
        sourceRight: '2O π-SALC (+ -)',
        desc: 'HOMO of neutral SO₂: Terminal oxygen π nonbonding orbital with a nodal plane cutting through Sulfur.'
      },
      {
        id: '2b1_pi_star',
        label: '2b₁* (π* antibonding)',
        symmetry: '2b₁*',
        type: 'antibonding',
        energy: 4.8,
        degeneracy: 1,
        sourceLeft: 'S(3pz / 3d)',
        sourceRight: '2O π-SALC (- + -)',
        desc: 'LUMO of SO₂: Antibonding 3-center π* orbital. Populating this level (e.g. by adding charge) reduces S=O double bond character and causes bond elongation!'
      },
      {
        id: 'sigma_star_so',
        label: 'σ*(S-O)',
        symmetry: '5a₁* + 4b₂*',
        type: 'antibonding',
        energy: 5.7,
        degeneracy: 2,
        sourceLeft: 'S(3s, 3p)',
        sourceRight: '2O σ-SALC',
        desc: 'High-energy σ* antibonding levels with internuclear nodes along S-O bonds.'
      }
    ];

    const leftAOs = [
      { label: 'S(3s)', energy: 1.0, type: 'ao' },
      { label: 'S(3p)', energy: 2.8, type: 'ao', count: 3 },
      { label: 'S(3dπ)', energy: 4.2, type: 'ao', count: 1 }
    ];
    const rightAOs = [
      { label: '2O σ-SALCs (a₁+b₂)', energy: 1.2, type: 'salc', count: 2 },
      { label: '2O π-SALCs (b₁+a₂)', energy: 3.3, type: 'salc', count: 2 }
    ];

    const population = populateElectrons(levels, totalElectrons);
    return {
      title: 'Sulfur Dioxide (SO₂) Resonance MO Diagram',
      subtitle: `C₂v Symmetry • 18 Valence e⁻ (Current: ${totalElectrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
      systemType: 'so2',
      leftLabel: 'Sulfur AOs & 3d',
      rightLabel: '2O Ligand SALCs',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 3. Ethylene (C2H4) - Frontier Orbital Mixing of two CH2 fragments (SUNY Potsdam 13.02 & Image 2)
  if (moleculeType === 'c2h4' || moleculeType === 'preset-sp2-c2h4') {
    // 4 frontier electrons for C-C bond (1 from each sp², 1 from each p) minus charge
    const frontierElectrons = Math.max(0, 4 - charge);
    const levels = [
      {
        id: 'sigma_b_cc',
        label: 'σ_b (C-C)',
        symmetry: '1ag',
        type: 'bonding',
        energy: 0.8,
        degeneracy: 1,
        sourceLeft: 'sp²',
        sourceRight: 'sp²',
        desc: 'Strong axial head-on σ-bonding orbital formed by constructive overlap of C1(sp²) and C2(sp²).'
      },
      {
        id: 'pi_b_cc',
        label: 'π_b (C-C)',
        symmetry: '1b₃u',
        type: 'bonding',
        energy: 2.2,
        degeneracy: 1,
        sourceLeft: 'p',
        sourceRight: 'p',
        desc: 'HOMO of C₂H₄: Lateral in-phase π-bond formed by parallel 2pz lobes perpendicular to molecular plane.'
      },
      {
        id: 'pi_star_cc',
        label: 'π* (C-C)',
        symmetry: '1b₂g*',
        type: 'antibonding',
        energy: 4.2,
        degeneracy: 1,
        sourceLeft: 'p',
        sourceRight: 'p',
        desc: 'LUMO of C₂H₄: Lateral out-of-phase π* antibonding orbital with a nodal plane between carbons.'
      },
      {
        id: 'sigma_star_cc',
        label: 'σ* (C-C)',
        symmetry: '1b₁u*',
        type: 'antibonding',
        energy: 5.6,
        degeneracy: 1,
        sourceLeft: 'sp²',
        sourceRight: 'sp²',
        desc: 'High-energy σ* antibonding orbital formed by destructive out-of-phase interference of sp² hybrid lobes.'
      }
    ];

    const leftAOs = [
      { label: 'sp²', energy: 2.0, type: 'ao', count: 1 },
      { label: 'p', energy: 3.2, type: 'ao', count: 1 }
    ];
    const rightAOs = [
      { label: 'sp²', energy: 2.0, type: 'ao', count: 1 },
      { label: 'p', energy: 3.2, type: 'ao', count: 1 }
    ];

    const population = populateElectrons(levels, frontierElectrons);
    return {
      title: 'Ethylene (C₂H₄) C–C Frontier MO Diagram',
      subtitle: `Fragment Mixing (H₂C: + :CH₂) • Charge: ${charge >= 0 ? '+' + charge : charge}`,
      systemType: 'c2h4',
      leftLabel: 'H₂C: Fragment',
      rightLabel: ':CH₂ Fragment',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 4. Acetylene (C2H2) - Linear Dinf_h with degenerate 2π bonds
  if (moleculeType === 'c2h2' || moleculeType === 'preset-sp-c2h2') {
    const levels = [
      {
        id: 'sigma_cc_ch',
        label: 'σ(C-C) & σ(C-H)',
        symmetry: 'σg + σu',
        type: 'bonding',
        energy: 1.0,
        degeneracy: 3,
        sourceLeft: 'C(sp)',
        sourceRight: 'C(sp) + 2H(1s)',
        desc: 'Axial σ-bonds along the linear molecular axis.'
      },
      {
        id: 'pi_cc_deg',
        label: 'π(px, py)',
        symmetry: '1πu',
        type: 'bonding',
        energy: 2.9,
        degeneracy: 2,
        sourceLeft: 'C₁(2px, 2py)',
        sourceRight: 'C₂(2px, 2py)',
        desc: 'HOMO of C₂H₂: Two mutually perpendicular, degenerate π-bonding orbitals (px-px and py-py).'
      },
      {
        id: 'pi_star_cc_deg',
        label: 'π*(px, py)',
        symmetry: '1πg*',
        type: 'antibonding',
        energy: 4.5,
        degeneracy: 2,
        sourceLeft: 'C₁(2px, 2py)',
        sourceRight: 'C₂(2px, 2py)',
        desc: 'LUMO of C₂H₂: Two mutually perpendicular, degenerate π* antibonding orbitals.'
      },
      {
        id: 'sigma_star_cc',
        label: 'σ*(C-C)',
        symmetry: 'σu*',
        type: 'antibonding',
        energy: 5.8,
        degeneracy: 1,
        sourceLeft: 'C₁(sp)',
        sourceRight: 'C₂(sp)',
        desc: 'Axial out-of-phase σ* antibonding orbital.'
      }
    ];

    const leftAOs = [{ label: 'C₁(sp + 2p)', energy: 2.6, type: 'ao', count: 3 }];
    const rightAOs = [{ label: 'C₂(sp + 2p) + 2H', energy: 2.6, type: 'ao', count: 3 }];

    const population = populateElectrons(levels, totalElectrons);
    return {
      title: 'Acetylene (C₂H₂) Frontier MO Diagram',
      subtitle: `D∞h Symmetry • 10 Valence e⁻ (Current: ${totalElectrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
      systemType: 'c2h2',
      leftLabel: 'C₁ Unit',
      rightLabel: 'C₂ + 2H Unit',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 5. Carbon Dioxide (CO2) - Linear Triatomic D∞h with Orthogonal π-Bonds & 1πg Lone Pairs (HOMO)
  if (moleculeType === 'co2' || moleculeType === 'preset-co2') {
    const co2Electrons = Math.max(0, 16 - charge);
    const levels = [
      {
        id: '2sigma_g',
        label: '2σg (σ C-O)',
        symmetry: '2σg',
        type: 'bonding',
        energy: 0.7,
        degeneracy: 1,
        sourceLeft: 'C(2s)',
        sourceRight: '2O SALC (σg)',
        desc: 'In-phase symmetric σ-bonding orbital formed by C(2s) and terminal Oxygen σg SALC.'
      },
      {
        id: '1sigma_u',
        label: '1σu (σ C-O)',
        symmetry: '1σu',
        type: 'bonding',
        energy: 1.5,
        degeneracy: 1,
        sourceLeft: 'C(2pz)',
        sourceRight: '2O SALC (σu)',
        desc: 'Antisymmetric axial σ-bonding orbital formed by C(2pz) and terminal Oxygen σu SALC.'
      },
      {
        id: '1pi_u',
        label: '1πu (π C=O)',
        symmetry: '1πu',
        type: 'bonding',
        energy: 2.5,
        degeneracy: 2,
        sourceLeft: 'C(2px, 2py)',
        sourceRight: '2O SALC (πu)',
        desc: 'Degenerate pair of perpendicular delocalized π-bonding orbitals (px and py) spanning all 3 atoms.'
      },
      {
        id: '3sigma_g',
        label: '3σg (n_O σ lone pair)',
        symmetry: '3σg',
        type: 'nonbonding',
        energy: 3.4,
        degeneracy: 1,
        sourceLeft: 'C(2s)',
        sourceRight: '2O SALC (σg)',
        desc: 'Weakly bonding / nonbonding symmetric Oxygen lone pair orbital.'
      },
      {
        id: '2sigma_u',
        label: '2σu (n_O σ lone pair)',
        symmetry: '2sigma_u',
        type: 'nonbonding',
        energy: 3.8,
        degeneracy: 1,
        sourceLeft: 'C(2pz)',
        sourceRight: '2O SALC (σu)',
        desc: 'Weakly bonding / nonbonding antisymmetric Oxygen lone pair orbital.'
      },
      {
        id: '1pi_g',
        label: '1πg (n_O π lone pairs)',
        symmetry: '1πg',
        type: 'nonbonding',
        energy: 4.3,
        degeneracy: 2,
        sourceLeft: 'None (no matching C orbital)',
        sourceRight: '2O SALC (πg)',
        desc: 'HOMO of CO₂: Nonbonding terminal Oxygen lone pair orbitals (perpendicular px and py). Carbon has no πg orbital to mix with.'
      },
      {
        id: '2pi_u_star',
        label: '2πu* (π* C=O)',
        symmetry: '2πu*',
        type: 'antibonding',
        energy: 5.3,
        degeneracy: 2,
        sourceLeft: 'C(2px, 2py)',
        sourceRight: '2O SALC (πu)',
        desc: 'LUMO of CO₂: Degenerate pair of strongly antibonding π* orbitals with nodes between C and each O.'
      },
      {
        id: '4sigma_g_star',
        label: '4σg* (σ* C-O)',
        symmetry: '4σg*',
        type: 'antibonding',
        energy: 6.3,
        degeneracy: 1,
        sourceLeft: 'C(2s)',
        sourceRight: '2O SALC (σg)',
        desc: 'High-energy σ* antibonding orbital.'
      },
      {
        id: '3sigma_u_star',
        label: '3σu* (σ* C-O)',
        symmetry: '3σu*',
        type: 'antibonding',
        energy: 6.8,
        degeneracy: 1,
        sourceLeft: 'C(2pz)',
        sourceRight: '2O SALC (σu)',
        desc: 'Highest energy σ* antibonding orbital.'
      }
    ];

    const leftAOs = [
      { label: 'C(2s)', energy: 1.2, type: 'ao', count: 1 },
      { label: 'C(2p)', energy: 2.8, type: 'ao', count: 3 }
    ];
    const rightAOs = [
      { label: '2O σ-SALCs (σg + σu)', energy: 1.8, type: 'salc', count: 2 },
      { label: '2O π-SALCs (πu + πg)', energy: 3.5, type: 'salc', count: 4 }
    ];

    const population = populateElectrons(levels, co2Electrons);
    return {
      title: 'Carbon Dioxide (CO₂) Linear Triatomic MO Diagram',
      subtitle: `D∞h Symmetry • 16 Valence e⁻ (Current: ${co2Electrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
      systemType: 'co2',
      leftLabel: 'Carbon AOs (Central)',
      rightLabel: '2O Ligand SALCs',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 6. 1,3-Butadiene (C4H6) - Conjugated π-System (SUNY Potsdam 13.04)
  if (moleculeType === 'butadiene' || moleculeType === 'c4h6') {
    const piElectrons = Math.max(0, 4 - charge);
    const levels = [
      {
        id: 'psi_1',
        label: 'ψ₁ (0 nodes)',
        symmetry: '1bg',
        type: 'bonding',
        energy: 1.2,
        degeneracy: 1,
        sourceLeft: '2C(pz)',
        sourceRight: '2C(pz)',
        desc: 'Lowest energy conjugated π-orbital: all 4 carbon 2pz lobes are in-phase constructive overlap (+ + + +).'
      },
      {
        id: 'psi_2',
        label: 'ψ₂ (1 node)',
        symmetry: '1au',
        type: 'bonding',
        energy: 2.4,
        degeneracy: 1,
        sourceLeft: '2C(pz)',
        sourceRight: '2C(pz)',
        desc: 'HOMO of 1,3-butadiene: 1 central nodal plane. In-phase bonding between C1-C2 and C3-C4 (+ + - -).'
      },
      {
        id: 'psi_3_star',
        label: 'ψ₃* (2 nodes)',
        symmetry: '2bg*',
        type: 'antibonding',
        energy: 3.8,
        degeneracy: 1,
        sourceLeft: '2C(pz)',
        sourceRight: '2C(pz)',
        desc: 'LUMO of 1,3-butadiene: 2 nodal planes (+ - - +). Populated upon photoexcitation (π -> π*).'
      },
      {
        id: 'psi_4_star',
        label: 'ψ₄* (3 nodes)',
        symmetry: '2au*',
        type: 'antibonding',
        energy: 5.0,
        degeneracy: 1,
        sourceLeft: '2C(pz)',
        sourceRight: '2C(pz)',
        desc: 'Highest antibonding π* orbital: 3 nodal planes, alternating phases (+ - + -).'
      }
    ];

    const leftAOs = [
      { label: 'C₁-C₂ (2pz)', energy: 2.8, type: 'ao', count: 2 }
    ];
    const rightAOs = [
      { label: 'C₃-C₄ (2pz)', energy: 2.8, type: 'ao', count: 2 }
    ];

    const population = populateElectrons(levels, piElectrons);
    return {
      title: '1,3-Butadiene (C₄H₆) Conjugated π MO Diagram',
      subtitle: `Hückel Conjugated π-System • 4 π e⁻ (Current: ${piElectrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
      systemType: 'butadiene',
      leftLabel: 'C₁–C₂ π Fragment',
      rightLabel: 'C₃–C₄ π Fragment',
      leftAOs,
      rightAOs,
      ...population
    };
  }

  // 7. Default Fallback: Methane (CH4) or generic polyatomic
  const levels = [
    {
      id: 'a1_sigma',
      label: '1a₁ (σ C-H)',
      symmetry: '1a₁',
      type: 'bonding',
      energy: 1.0,
      degeneracy: 1,
      sourceLeft: 'C(2s)',
      sourceRight: '4H SALC (a₁)',
      desc: 'Totally symmetric spherical bonding MO constructed from C(2s) and in-phase 4H SALC.'
    },
    {
      id: 't2_sigma',
      label: '1t₂ (3× σ C-H)',
      symmetry: '1t₂',
      type: 'bonding',
      energy: 2.5,
      degeneracy: 3,
      sourceLeft: 'C(2px, 2py, 2pz)',
      sourceRight: '4H SALC (t₂)',
      desc: 'Triply degenerate bonding MOs formed from C(2p) orbitals and t₂ 4H SALCs.'
    },
    {
      id: 'a1_star',
      label: '2a₁* (σ*)',
      symmetry: '2a₁*',
      type: 'antibonding',
      energy: 4.8,
      degeneracy: 1,
      sourceLeft: 'C(2s)',
      sourceRight: '4H SALC (a₁)',
      desc: 'LUMO of CH₄: Antibonding σ* orbital.'
    },
    {
      id: 't2_star',
      label: '2t₂* (3× σ*)',
      symmetry: '2t₂*',
      type: 'antibonding',
      energy: 5.6,
      degeneracy: 3,
      sourceLeft: 'C(2p)',
      sourceRight: '4H SALC (t₂)',
      desc: 'Triply degenerate high energy antibonding orbitals.'
    }
  ];

  const leftAOs = [
    { label: 'Central Atom AOs', energy: 2.2, type: 'ao', count: 4 }
  ];
  const rightAOs = [
    { label: 'Ligand SALCs', energy: 2.2, type: 'salc', count: 4 }
  ];

  const population = populateElectrons(levels, totalElectrons);
  return {
    title: 'Tetrahedral (CH₄) SALC Molecular Orbital Diagram',
    subtitle: `Td Symmetry • 8 Valence e⁻ (Current: ${totalElectrons} e⁻, Charge: ${charge >= 0 ? '+' + charge : charge})`,
    systemType: 'ch4',
    leftLabel: 'Central Carbon AOs',
    rightLabel: '4H Ligand SALCs',
    leftAOs,
    rightAOs,
    ...population
  };
}

/**
 * Returns theoretical explanation text dynamically explaining bonding/antibonding
 * and why phase colors justify stability.
 */
export function getMOExplanationText(data) {
  const { totalElectrons, bondOrder, homo, lumo, unpairedElectrons, isParamagnetic, systemType } = data;

  let text = '';

  if (systemType === 'atomic_ao') {
    const elem = data.atomElement || 'Atom';
    const q = data.atomCharge !== undefined ? data.atomCharge : 0;
    if (elem === 'H') {
      if (q === -1 || totalElectrons === 2) {
        text = `<strong>H⁻ (Hydride Anion, 1s²):</strong> Net formal charge is <strong>-1</strong> with <strong>2 valence electrons</strong> completely filling the 1s atomic orbital (↿ ⇂, isoelectronic with Helium). When approaching another H⁻, attempting to form H₂²⁻ forces the 2 additional electrons into the higher-energy σ*(1s) antibonding orbital, creating a destructive interference nodal plane between nuclei, net Bond Order = 0.0, and immediate repulsive dissociation!`;
      } else if (q === 0 || totalElectrons === 1) {
        text = `<strong>H (Neutral Hydrogen Atom, 1s¹):</strong> Net formal charge is <strong>0</strong> with <strong>1 valence electron</strong> in the 1s orbital (↿, paramagnetic). When approaching another neutral H atom, both electrons undergo constructive in-phase wave overlap into the lower-energy σ(1s) bonding orbital, forming a stable H₂ molecule with Bond Order = 1.0.`;
      } else if (q >= 1 || totalElectrons === 0) {
        text = `<strong>H⁺ (Proton / Hydron, 1s⁰):</strong> Net formal charge is <strong>+1</strong> with 0 valence electrons (empty 1s atomic orbital).`;
      } else {
        text = `<strong>H Atom State:</strong> ${totalElectrons} valence electrons, net charge ${q}.`;
      }
    } else {
      text = `<strong>${elem} Atomic Orbital State:</strong> ${totalElectrons} valence electrons occupy the atomic energy levels according to the Aufbau principle, Pauli exclusion principle, and Hund's rule. Formal charge: ${q >= 0 ? '+' + q : q}.`;
    }
  } else if (systemType === 'diatomic_1s') {
    if (totalElectrons === 2 && bondOrder === 1) {
      text = `<strong>H₂ (Neutral Ground State):</strong> Both electrons occupy the lower-energy <em>σ(1s)</em> bonding orbital with opposite spins (<span style="color:#10b981;">Bond Order = 1.0</span>). Constructive wave interference (+ with +, Red-Red) creates high electron density between the nuclei, shielding nuclear repulsions and holding the atoms together.`;
    } else if (totalElectrons === 4 && bondOrder === 0) {
      text = `<strong>H₂²⁻ (Hydride Anion Pair, Charge -2):</strong> The 2 extra electrons are forced into the high-energy <em>σ*(1s)</em> antibonding orbital (<span style="color:#ef4444;">Bond Order = 0.0</span>). The antibonding nodal plane (destructive wave interference, + with −, Red meets Blue) cancels all stabilization. Electrostatic and Pauli repulsions cause immediate dissociation!`;
    } else if (totalElectrons === 1 && bondOrder === 0.5) {
      text = `<strong>H₂⁺ (Cation Radical, Charge +1):</strong> Only 1 electron occupies <em>σ(1s)</em> (<span style="color:#f59e0b;">Bond Order = 0.5</span>). It is weakly bound with an unpaired electron, making it paramagnetic.`;
    } else if (totalElectrons === 3 && bondOrder === 0.5) {
      text = `<strong>H₂⁻ (Radical Anion, Charge -1):</strong> Two electrons in <em>σ(1s)</em> and one electron in <em>σ*(1s)</em> (<span style="color:#f59e0b;">Bond Order = 0.5</span>). Weakly bound and paramagnetic.`;
    } else {
      text = `Total valence electrons: ${totalElectrons}. Calculated Bond Order = ${bondOrder.toFixed(1)}.`;
    }
  } else if (systemType === 'so2') {
    text = `<strong>SO₂ Resonance & pπ–dπ System:</strong> 18 valence electrons completely fill the σ-framework and populate the 3-center delocalized π bonding (1b₁) and nonbonding (1a₂) orbitals. The LUMO is the antibonding 2b₁* orbital. Adding electrons (negative charge) populates this π* level, reducing bond order and lengthening the S=O bonds!`;
  } else if (systemType === 'c2h4') {
    text = `<strong>C₂H₄ Frontier C–C System (SUNY Potsdam 13.02):</strong> Formed by mixing two ·CH₂ fragments. 4 frontier electrons populate the axial <em>σ_b(C-C)</em> and lateral <em>π_b(C-C)</em> (HOMO), yielding <span style="color:#10b981;">Bond Order = 2.0</span>. The LUMO is <em>π*(C-C)</em>. Populating π* (e.g. at charge -2) breaks the π bond and lowers the barrier to rotation!`;
  } else if (systemType === 'co2') {
    text = `<strong>CO₂ Linear Triatomic (D∞h, Eames Reference):</strong> 16 valence electrons populate the bonding σ-framework (2σg, 1σu) and degenerate orthogonal π-bonds (1πu). The HOMO consists of the nonbonding <em>1πg</em> terminal oxygen lone pairs (4 electrons), for which carbon has no matching symmetry orbital. The LUMO is the antibonding <em>2πu*</em> level.`;
  } else if (systemType === 'butadiene') {
    text = `<strong>1,3-Butadiene Conjugated π-System (SUNY Potsdam 13.04):</strong> 4 carbon 2pz orbitals combine into 4 delocalized molecular orbitals (ψ₁ to ψ₄*). 4 π electrons fill ψ₁ and ψ₂ (HOMO). Notice ψ₂ has 1 node in the middle, giving double bond character to C1-C2 and C3-C4 and partial single bond character to C2-C3.`;
  } else {
    text = `<strong>Molecular Orbital State:</strong> Populated with ${totalElectrons} valence electrons. Net Bond Order = ${bondOrder.toFixed(1)}. Frontier orbitals: HOMO = ${homo ? homo.label : 'None'}, LUMO = ${lumo ? lumo.label : 'None'}. Magnetic property: ${isParamagnetic ? `Paramagnetic (${unpairedElectrons} unpaired e⁻)` : 'Diamagnetic (all paired)'}.`;
  }

  return text;
}
