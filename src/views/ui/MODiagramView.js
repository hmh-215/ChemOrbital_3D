/**
 * MODiagramView.js
 * Interactive SVG-based Molecular Orbital (MO) Energy Diagram View.
 * Renders:
 * - Left AOs (Atomic Orbitals / Central Atom)
 * - Right AOs / Ligand SALCs (Symmetry Adapted Linear Combinations)
 * - Center MOs with dashed correlation lines
 * - Electron spin arrows (↿ ⇂) adhering to Hund's rule & Pauli exclusion
 * - Badges for HOMO, LUMO, Bond Order, Magnetism
 * - Interactive Charge controls (+ / -) to test H2 vs H2(2-) and radical ions
 * - Educational explanation box linking orbital phases (+ Red / - Blue) to bonding vs antibonding
 */
import { getMOExplanationText } from '../../models/MolecularOrbitalEngine.js';

export class MODiagramView {
  constructor(panelContainerEl, viewModel) {
    this.panelEl = panelContainerEl;
    this.vm = viewModel;
    this.selectedLevelId = null;

    this._initDOM();
    this._bindEvents();
  }

  _initDOM() {
    this.panelEl.innerHTML = `
      <div class="mo-header">
        <div class="mo-header-title-row">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">📊</span>
            <div>
              <h2 class="mo-title" id="mo-title">MO Energy Diagram</h2>
              <div class="mo-subtitle" id="mo-subtitle">Molecular Orbital Theory</div>
            </div>
          </div>
          <button class="btn mo-close-btn" id="mo-close-btn" title="Close MO Diagram Panel">✕</button>
        </div>

        <!-- Mode & View Switcher -->
        <div class="mo-mode-bar" id="mo-mode-bar">
          <button class="btn mo-mode-tab active" data-mode="auto" id="mo-mode-auto-btn">Auto / SALC</button>
          <button class="btn mo-mode-tab" data-mode="localized" id="mo-mode-loc-btn">Localized Bond</button>
        </div>
      </div>

      <div class="mo-scroll-content">
        <!-- Molecular Charge & Electron Controls -->
        <div class="mo-card mo-controls-card">
          <div class="mo-card-header">
            <span>⚡ Molecular Charge & Electrons</span>
            <span id="mo-electrons-badge" class="badge badge-cyan">0 e⁻</span>
          </div>

          <div class="mo-charge-stepper-row">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">Net Charge:</span>
            <div class="mo-stepper-group">
              <button class="btn stepper-btn" id="mo-charge-minus-btn" title="Add electron (More negative, e.g. -1, -2)">−</button>
              <div class="charge-display-pill" id="mo-charge-val">0</div>
              <button class="btn stepper-btn" id="mo-charge-plus-btn" title="Remove electron (More positive, e.g. +1, +2)">+</button>
              <button class="btn reset-charge-btn" id="mo-charge-reset-btn" title="Reset Charge to Neutral (0)">Reset</button>
            </div>
          </div>

          <!-- Quick Test Presets for Charge -->
          <div class="mo-quick-charge-group">
            <button class="btn quick-charge-btn" data-charge="0" title="Neutral ground state">Ground (0)</button>
            <button class="btn quick-charge-btn" data-charge="-2" title="Test H2(2-) antibonding dissociation (-2)">H₂²⁻ (-2 e⁻)</button>
            <button class="btn quick-charge-btn" data-charge="-1" title="Radical anion (-1)">Anion (-1)</button>
            <button class="btn quick-charge-btn" data-charge="1" title="Cation (+1)">Cation (+1)</button>
          </div>

          <!-- Key MO Metrics: Bond Order, Magnetism, Frontier -->
          <div class="mo-metrics-grid">
            <div class="mo-metric-item">
              <span class="label">Bond Order:</span>
              <span class="value" id="mo-bond-order-val" style="color: #10b981;">1.0</span>
            </div>
            <div class="mo-metric-item">
              <span class="label">Magnetism:</span>
              <span class="value" id="mo-magnetism-val" style="color: #38bdf8;">Diamagnetic</span>
            </div>
            <div class="mo-metric-item">
              <span class="label">HOMO:</span>
              <span class="value" id="mo-homo-val" style="color: #a855f7;">σ(1s)</span>
            </div>
            <div class="mo-metric-item">
              <span class="label">LUMO:</span>
              <span class="value" id="mo-lumo-val" style="color: #f472b6;">σ*(1s)</span>
            </div>
          </div>
        </div>

        <!-- SVG Energy Diagram Canvas -->
        <div class="mo-card mo-diagram-card">
          <div class="mo-diagram-header">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Energy Levels (Aufbau & Pauli)</span>
            <span style="font-size: 10px; color: var(--text-muted);">Click level for details</span>
          </div>

          <div class="mo-svg-container" id="mo-svg-container">
            <!-- Rendered dynamically -->
          </div>

          <!-- Diagram Legend -->
          <div class="mo-diagram-legend">
            <div class="legend-item"><span class="legend-dot" style="background: #10b981;"></span><span>Bonding (σ, π)</span></div>
            <div class="legend-item"><span class="legend-dot" style="background: #f59e0b;"></span><span>Nonbonding (n)</span></div>
            <div class="legend-item"><span class="legend-dot" style="background: #ef4444;"></span><span>Antibonding (σ*, π*)</span></div>
          </div>
        </div>

        <!-- Selected Orbital Level Inspector -->
        <div class="mo-card mo-level-details-card" id="mo-level-details-card">
          <div class="mo-card-header">
            <span id="mo-detail-name">Selected Level Details</span>
            <span id="mo-detail-type-badge" class="badge badge-green">Bonding</span>
          </div>
          <div id="mo-detail-desc" style="font-size: 11px; color: var(--text-muted); line-height: 1.45;">
            Click any horizontal molecular orbital rung in the diagram above to inspect its symmetry, quantum numbers, and nodal surfaces.
          </div>
        </div>

        <!-- Theoretical Chem Explanation Callout -->
        <div class="mo-card mo-theory-card">
          <div class="mo-card-header">
            <span>🔬 Quantum MO Explanation</span>
            <span>💡</span>
          </div>
          <div id="mo-theory-text" style="font-size: 11px; color: var(--text-main); line-height: 1.5;">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>
    `;

    this.titleEl = this.panelEl.querySelector('#mo-title');
    this.subtitleEl = this.panelEl.querySelector('#mo-subtitle');
    this.closeBtn = this.panelEl.querySelector('#mo-close-btn');
    this.electronsBadge = this.panelEl.querySelector('#mo-electrons-badge');
    this.chargeValEl = this.panelEl.querySelector('#mo-charge-val');
    this.chargeMinusBtn = this.panelEl.querySelector('#mo-charge-minus-btn');
    this.chargePlusBtn = this.panelEl.querySelector('#mo-charge-plus-btn');
    this.chargeResetBtn = this.panelEl.querySelector('#mo-charge-reset-btn');
    this.bondOrderValEl = this.panelEl.querySelector('#mo-bond-order-val');
    this.magnetismValEl = this.panelEl.querySelector('#mo-magnetism-val');
    this.homoValEl = this.panelEl.querySelector('#mo-homo-val');
    this.lumoValEl = this.panelEl.querySelector('#mo-lumo-val');
    this.svgContainer = this.panelEl.querySelector('#mo-svg-container');
    this.detailNameEl = this.panelEl.querySelector('#mo-detail-name');
    this.detailTypeBadge = this.panelEl.querySelector('#mo-detail-type-badge');
    this.detailDescEl = this.panelEl.querySelector('#mo-detail-desc');
    this.theoryTextEl = this.panelEl.querySelector('#mo-theory-text');
  }

  _bindEvents() {
    this.closeBtn.addEventListener('click', () => {
      this.vm.toggleMOView(false);
    });

    this.chargeMinusBtn.addEventListener('click', () => {
      // Net charge -1 means +1 electron added
      this.vm.setMolecularCharge(-1, true);
    });

    this.chargePlusBtn.addEventListener('click', () => {
      // Net charge +1 means 1 electron removed
      this.vm.setMolecularCharge(1, true);
    });

    this.chargeResetBtn.addEventListener('click', () => {
      this.vm.resetMolecularCharge();
    });

    // Quick charge presets
    this.panelEl.querySelectorAll('.quick-charge-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = parseInt(btn.dataset.charge, 10);
        this.vm.setMolecularCharge(c, false);
      });
    });

    // Mode bar buttons
    const autoBtn = this.panelEl.querySelector('#mo-mode-auto-btn');
    const locBtn = this.panelEl.querySelector('#mo-mode-loc-btn');

    autoBtn.addEventListener('click', () => {
      autoBtn.classList.add('active');
      locBtn.classList.remove('active');
      this.vm.setMOViewMode('auto');
    });

    locBtn.addEventListener('click', () => {
      locBtn.classList.add('active');
      autoBtn.classList.remove('active');
      this.vm.setMOViewMode('localized');
    });

    // Real-time live synchronization with ViewModel events
    this.vm.on('chargeChanged', () => {
      if (this.vm.isMOViewOpen) {
        this.render(this.vm.getMODiagramData());
      }
    });

    this.vm.on('atomUpdated', () => {
      if (this.vm.isMOViewOpen) {
        this.render(this.vm.getMODiagramData());
      }
    });

    this.vm.on('selectionChanged', () => {
      if (this.vm.isMOViewOpen) {
        this.render(this.vm.getMODiagramData());
      }
    });

    this.vm.on('bondsUpdated', () => {
      if (this.vm.isMOViewOpen) {
        this.render(this.vm.getMODiagramData());
      }
    });

    this.vm.on('moDiagramUpdated', (data) => {
      if (this.vm.isMOViewOpen) {
        this.render(data);
      }
    });
  }

  render(data) {
    if (!data) return;

    // 1. Update Titles & Status
    this.titleEl.textContent = data.title || 'Molecular Orbital Diagram';
    this.subtitleEl.textContent = data.subtitle || '';
    this.electronsBadge.textContent = `${data.totalElectrons} Valence e⁻`;

    const charge = this.vm.molecularCharge;
    this.chargeValEl.textContent = charge > 0 ? `+${charge}` : `${charge}`;
    this.chargeValEl.style.color = charge === 0 ? 'var(--text-main)' : (charge < 0 ? '#38bdf8' : '#f59e0b');

    // 2. Metrics
    if (data.systemType === 'atomic_ao') {
      this.bondOrderValEl.textContent = 'N/A (Isolated)';
      this.bondOrderValEl.style.color = 'var(--text-muted)';
    } else {
      const bo = data.bondOrder;
      let boText = bo.toFixed(1);
      if (bo === 1) boText += ' (Single)';
      else if (bo === 2) boText += ' (Double)';
      else if (bo === 3) boText += ' (Triple)';
      else if (bo === 0) boText += ' (Dissociated)';
      this.bondOrderValEl.textContent = boText;
      this.bondOrderValEl.style.color = bo > 0 ? '#10b981' : '#ef4444';
    }

    this.magnetismValEl.textContent = data.isParamagnetic
      ? `Paramagnetic (${data.unpairedElectrons} e⁻)`
      : 'Diamagnetic';
    this.magnetismValEl.style.color = data.isParamagnetic ? '#f59e0b' : '#38bdf8';

    this.homoValEl.textContent = data.homo ? data.homo.label : 'None';
    this.lumoValEl.textContent = data.lumo ? data.lumo.label : 'None';

    // 3. Render SVG Diagram
    this._renderSVGDiagram(data);

    // 4. Update Theoretical explanation
    this.theoryTextEl.innerHTML = getMOExplanationText(data);

    // 5. Update level detail if a level is selected
    if (this.selectedLevelId) {
      const selected = data.levels.find(l => l.id === this.selectedLevelId);
      if (selected) {
        this._updateLevelDetails(selected);
      }
    } else if (data.homo) {
      this._updateLevelDetails(data.homo);
    }
  }

  _updateLevelDetails(level) {
    this.selectedLevelId = level.id;
    this.detailNameEl.textContent = `${level.label} (${level.symmetry || ''})`;

    let typeColor = '#10b981';
    let typeName = 'Bonding';
    if (level.type === 'antibonding') {
      typeColor = '#ef4444';
      typeName = 'Antibonding (Nodal Plane)';
    } else if (level.type === 'nonbonding') {
      typeColor = '#f59e0b';
      typeName = 'Nonbonding Lone Pair';
    }

    this.detailTypeBadge.textContent = typeName;
    this.detailTypeBadge.style.background = typeColor;
    this.detailTypeBadge.style.color = '#fff';

    const eCount = level.totalElectrons || 0;
    const maxCapacity = level.orbitals.length * 2;
    const occDesc = eCount === 0 ? 'Empty (0 e⁻)' : (eCount === maxCapacity ? `Fully Occupied (${eCount}/${maxCapacity} e⁻)` : `Partially Occupied (${eCount}/${maxCapacity} e⁻)`);

    this.detailDescEl.innerHTML = `
      <div style="margin-bottom: 4px;"><strong>Occupancy:</strong> <span style="color: #38bdf8;">${occDesc}</span></div>
      <div style="margin-bottom: 4px;"><strong>Origin:</strong> Linear combination of <em>${level.sourceLeft || 'AOs'}</em> and <em>${level.sourceRight || 'AOs'}</em>.</div>
      <div><strong>Quantum Character:</strong> ${level.desc || ''}</div>
    `;
  }

  _renderSVGDiagram(data) {
    const width = 360;
    const height = 380;
    const padding = { top: 35, bottom: 40, left: 35, right: 35 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Compute energy scaling
    let minE = 0;
    let maxE = 6.2;
    data.levels.forEach(lvl => {
      if (lvl.energy > maxE) maxE = lvl.energy + 0.5;
    });

    const scaleY = (energy) => {
      const frac = (energy - minE) / (maxE - minE);
      return padding.top + plotHeight * (1 - frac);
    };

    const leftX = padding.left + 25;
    const centerX = padding.left + plotWidth / 2;
    const rightX = width - padding.right - 25;

    let svgHtml = `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="mo-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="energy-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
          </marker>
          <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#10b981" flood-opacity="0.6"/>
          </filter>
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#ef4444" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- Vertical Energy Axis -->
        <line x1="${padding.left - 10}" y1="${height - padding.bottom}" x2="${padding.left - 10}" y2="${padding.top - 10}" stroke="#475569" stroke-width="1.5" marker-end="url(#energy-arrow)" />
        <text x="${padding.left - 14}" y="${padding.top - 12}" fill="#94a3b8" font-size="9" font-family="'JetBrains Mono', monospace" text-anchor="middle" font-weight="700">E</text>

        <!-- Column Header Labels -->
        <text x="${leftX}" y="20" fill="#94a3b8" font-size="9.5" font-weight="600" text-anchor="middle">${data.leftLabel || 'Atom A'}</text>
        <text x="${centerX}" y="20" fill="#38bdf8" font-size="10.5" font-weight="700" text-anchor="middle">${data.systemType === 'atomic_ao' ? 'Atomic Orbitals' : 'Molecular Orbitals'}</text>
        <text x="${rightX}" y="20" fill="#94a3b8" font-size="9.5" font-weight="600" text-anchor="middle">${data.rightLabel || 'Atom B / SALCs'}</text>
    `;

    // 1. Draw Left Atomic Orbitals
    (data.leftAOs || []).forEach(ao => {
      const y = scaleY(ao.energy);
      const w = 32;
      svgHtml += `
        <g class="ao-rung">
          <line x1="${leftX - w/2}" y1="${y}" x2="${leftX + w/2}" y2="${y}" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
          <text x="${leftX}" y="${y - 5}" fill="#cbd5e1" font-size="8.5" font-family="'JetBrains Mono', monospace" text-anchor="middle">${ao.label}</text>
        </g>
      `;
    });

    // 2. Draw Right Atomic Orbitals / SALCs
    (data.rightAOs || []).forEach(ao => {
      const y = scaleY(ao.energy);
      const w = 32;
      svgHtml += `
        <g class="ao-rung">
          <line x1="${rightX - w/2}" y1="${y}" x2="${rightX + w/2}" y2="${y}" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
          <text x="${rightX}" y="${y - 5}" fill="#cbd5e1" font-size="8.5" font-family="'JetBrains Mono', monospace" text-anchor="middle">${ao.label}</text>
        </g>
      `;
    });

    // 3. Draw Center Molecular Orbitals and Connecting Correlation Dashed Lines
    data.levels.forEach((level) => {
      const y = scaleY(level.energy);
      const isSelected = this.selectedLevelId === level.id;
      const isHomo = data.homo && data.homo.id === level.id;
      const isLumo = data.lumo && data.lumo.id === level.id;

      // Color scheme based on orbital type
      let strokeColor = '#10b981'; // bonding
      let glowFilter = '';
      if (level.type === 'antibonding') {
        strokeColor = '#ef4444'; // antibonding
        if (level.totalElectrons > 0) glowFilter = 'filter="url(#glow-red)"';
      } else if (level.type === 'nonbonding') {
        strokeColor = '#f59e0b'; // nonbonding
      } else {
        if (level.totalElectrons > 0) glowFilter = 'filter="url(#glow-green)"';
      }

      // Dashed interaction correlation lines to nearest AOs
      const leftY = data.leftAOs && data.leftAOs.length > 0 ? scaleY(data.leftAOs[0].energy) : y;
      const rightY = data.rightAOs && data.rightAOs.length > 0 ? scaleY(data.rightAOs[0].energy) : y;

      svgHtml += `
        <!-- Correlation dashed lines -->
        <line x1="${leftX + 16}" y1="${leftY}" x2="${centerX - 45}" y2="${y}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="${rightX - 16}" y1="${rightY}" x2="${centerX + 45}" y2="${y}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3,3" />
      `;

      // Render orbitals in this level (could be degenerate: 1, 2, or 3)
      const numOrbs = level.orbitals.length;
      const rungWidth = 28;
      const gap = 8;
      const totalWidth = numOrbs * rungWidth + (numOrbs - 1) * gap;
      const startX = centerX - totalWidth / 2;

      svgHtml += `<g class="mo-level-group ${isSelected ? 'selected' : ''}" data-level-id="${level.id}" style="cursor: pointer;">`;

      // Level Label & Symmetry
      const labelX = centerX - totalWidth / 2 - 8;
      svgHtml += `
        <text x="${labelX}" y="${y + 3}" fill="${strokeColor}" font-size="9" font-family="'JetBrains Mono', monospace" text-anchor="end" font-weight="${isSelected ? '700' : '500'}">
          ${level.label}
        </text>
      `;

      // HOMO / LUMO Tag
      if (isHomo || isLumo) {
        const tagText = isHomo ? 'HOMO' : 'LUMO';
        const tagColor = isHomo ? '#a855f7' : '#f472b6';
        svgHtml += `
          <rect x="${centerX + totalWidth / 2 + 6}" y="${y - 8}" width="32" height="14" rx="3" fill="${tagColor}" fill-opacity="0.22" stroke="${tagColor}" stroke-width="0.8"/>
          <text x="${centerX + totalWidth / 2 + 22}" y="${y + 2.5}" fill="${tagColor}" font-size="8" font-family="'JetBrains Mono', monospace" text-anchor="middle" font-weight="700">${tagText}</text>
        `;
      }

      // Draw each orbital rung with its electron spins
      level.orbitals.forEach((orb, orbIdx) => {
        const ox = startX + orbIdx * (rungWidth + gap);

        svgHtml += `
          <!-- Orbital horizontal line -->
          <line x1="${ox}" y1="${y}" x2="${ox + rungWidth}" y2="${y}" stroke="${strokeColor}" stroke-width="${isSelected ? 3.5 : 2.5}" stroke-linecap="round" ${glowFilter}/>
        `;

        // Render electron spin arrows (↿ ⇂)
        const midX = ox + rungWidth / 2;
        if (orb.electrons === 1) {
          // Single spin up electron
          svgHtml += `
            <g class="spin-arrow">
              <line x1="${midX}" y1="${y + 7}" x2="${midX}" y2="${y - 7}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M${midX},${y - 7} L${midX - 3},${y - 3}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            </g>
          `;
        } else if (orb.electrons === 2) {
          // Paired spin up + spin down electrons
          svgHtml += `
            <!-- Spin Up (Left) -->
            <g class="spin-arrow">
              <line x1="${midX - 4}" y1="${y + 7}" x2="${midX - 4}" y2="${y - 7}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M${midX - 4},${y - 7} L${midX - 7},${y - 3}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            </g>
            <!-- Spin Down (Right) -->
            <g class="spin-arrow">
              <line x1="${midX + 4}" y1="${y - 7}" x2="${midX + 4}" y2="${y + 7}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M${midX + 4},${y + 7} L${midX + 7},${y + 3}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            </g>
          `;
        }
      });

      svgHtml += `</g>`;
    });

    svgHtml += `</svg>`;
    this.svgContainer.innerHTML = svgHtml;

    // Attach click listeners to level groups
    this.svgContainer.querySelectorAll('.mo-level-group').forEach(grp => {
      grp.addEventListener('click', () => {
        const id = grp.dataset.levelId;
        const lvl = data.levels.find(l => l.id === id);
        if (lvl) {
          this._updateLevelDetails(lvl);
          this.vm.selectMOLevel(id);
          this.render(data);
        }
      });
    });
  }
}
