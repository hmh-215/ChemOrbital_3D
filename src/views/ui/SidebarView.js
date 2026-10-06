/**
 * SidebarView
 * Handles DOM rendering for the left sidebar panels: presets, multiple selection card,
 * quick build card, manual build card, atom inspector, and atoms roster.
 */
import { ARRANGEMENT_INFO, NODAL_INFO, ORBITAL_DESCRIPTIONS } from '../../constants/Orbitals.js';
import { ELEMENT_DEFAULTS, ORBITAL_DISPLAY_LABELS } from '../../constants/Elements.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class SidebarView {
  constructor() {
    this.atomCountEl = document.getElementById('atom-count');
    this.atomBadgesListEl = document.getElementById('atom-roster-list');
    this.selectedAtomLabelEl = document.getElementById('selected-atom-label');
    this.atomActionsGroupEl = document.getElementById('atom-actions-group');

    // Inspector inputs
    this.atomColorInput = document.getElementById('atom-color-input');
    this.atomNameInput = document.getElementById('atom-name-input');
    this.atomRadiusSlider = document.getElementById('atom-radius-slider');
    this.atomRadiusVal = document.getElementById('atom-radius-val');

    // Sliders
    this.posXSlider = document.getElementById('pos-x-slider');
    this.posYSlider = document.getElementById('pos-y-slider');
    this.posZSlider = document.getElementById('pos-z-slider');
    this.posXVal = document.getElementById('pos-x-val');
    this.posYVal = document.getElementById('pos-y-val');
    this.posZVal = document.getElementById('pos-z-val');

    this.rotXSlider = document.getElementById('rot-x-slider');
    this.rotYSlider = document.getElementById('rot-y-slider');
    this.rotZSlider = document.getElementById('rot-z-slider');
    this.rotXVal = document.getElementById('rot-x-val');
    this.rotYVal = document.getElementById('rot-y-val');
    this.rotZVal = document.getElementById('rot-z-val');

    // Arrangement and Nodal checkboxes
    this.atomArrangementCheck = document.getElementById('atom-arrangement-check');
    this.atomArrangementType = document.getElementById('atom-arrangement-type');
    this.atomNodalCheck = document.getElementById('atom-nodal-check');
    this.atomNodalType = document.getElementById('atom-nodal-type');
    this.atomChargeVal = document.getElementById('atom-charge-val');
    this.showSelectedOutlineCheck = document.getElementById('show-selected-outline-check');
    this.selectedOutlineSyncDesc = document.getElementById('selected-outline-sync-desc');
    this.showSelectedNodalCheck = document.getElementById('show-selected-nodal-check');
    this.selectedNodalSyncDesc = document.getElementById('selected-nodal-sync-desc');

    this.orbitalDescBox = document.getElementById('orbital-desc-box');

    // Multi-selection badges
    this.multiCountBadge = document.getElementById('multi-select-count-badge');
    this.multiBondCountBadge = document.getElementById('multi-bond-count-badge');

    // Quick build
    this.quickBuildCurrentText = document.getElementById('quick-build-current-text');
  }

  render(vm, onSelectAtom, onSelectByType, onFocusCamera) {
    const atoms = vm.atoms;
    const selectedIds = vm.selectedIds;
    const selected = vm.primarySelectedAtom;

    if (this.atomCountEl) {
      this.atomCountEl.textContent = atoms.length;
    }

    const isMulti = (selectedIds.size > 1) || (vm.interactionMode === 'box') || (vm.interactionMode === 'configure');
    document.body.classList.toggle('has-multi-selection', isMulti);

    const multiCard = document.getElementById('multi-select-card');
    if (multiCard) {
      multiCard.style.display = '';
    }

    if (this.multiCountBadge) {
      this.multiCountBadge.textContent = `${selectedIds.size} Selected`;
    }

    if (this.multiBondCountBadge) {
      let bondCount = 0;
      vm.bonds.forEach(b => {
        if (selectedIds.has(b.atomAId) && selectedIds.has(b.atomBId)) bondCount++;
      });
      this.multiBondCountBadge.textContent = `${bondCount} Bond${bondCount === 1 ? '' : 's'}`;
    }

    // Render Atom Roster Badges
    if (this.atomBadgesListEl) {
      this.atomBadgesListEl.innerHTML = '';
      atoms.forEach(atom => {
        const badge = document.createElement('div');
        badge.className = 'atom-badge' + (selectedIds.has(atom.id) ? ' selected' : '');
        const arrInfo = ARRANGEMENT_INFO[atom.orbitalType];
        const outlineIcon = (atom.showArrangement && arrInfo) ? ` <span title="Outline: ${arrInfo.name} active" style="color: #84cc16; font-size: 10px; margin-left: 2px;">📐</span>` : '';
        const nodInfo = NODAL_INFO[atom.orbitalType];
        const nodalIcon = (atom.showNodalPlanes && nodInfo) ? ` <span title="Nodal: ${nodInfo.type} active" style="color: #38bdf8; font-size: 10px; margin-left: 2px;">⚪</span>` : '';
        const chargeSign = atom.charge > 0 ? `+${atom.charge}` : `${atom.charge}`;
        const chargeBadge = atom.charge !== 0
          ? `<sup style="color: ${atom.charge < 0 ? '#38bdf8' : '#f59e0b'}; font-weight: 700; margin-left: 2px;">${chargeSign}</sup>`
          : '';

        badge.innerHTML = `
          <span class="badge-color-dot" style="background:${atom.color}"></span>
          <span>${escapeHtml(atom.name)}${chargeBadge}</span>
          <span style="font-size: 9px; color: var(--accent-cyan)">[${atom.orbitalType}]</span>
          ${outlineIcon}${nodalIcon}
        `;

        badge.addEventListener('click', (e) => {
          const isCtrl = e.ctrlKey || e.metaKey;
          onSelectAtom(atom.id, isCtrl);
        });

        badge.title = `Click to select • Shift + Double Click to select all ${atom.element} • Double Click to focus`;
        badge.addEventListener('dblclick', (e) => {
          if (e.shiftKey) {
            e.preventDefault();
            onSelectByType(atom.element, e.ctrlKey || e.metaKey);
          } else {
            onFocusCamera(atom.position, atom.name);
          }
        });

        this.atomBadgesListEl.appendChild(badge);
      });
    }

    // Update Atom Inspector
    if (selected) {
      let avgX = 0, avgY = 0, avgZ = 0;
      let count = 0;
      selectedIds.forEach(id => {
        const a = vm.getAtom(id);
        if (a) {
          avgX += a.position.x;
          avgY += a.position.y;
          avgZ += a.position.z;
          count++;
        }
      });
      if (count > 0) {
        avgX /= count;
        avgY /= count;
        avgZ /= count;
      }

      if (this.posXSlider) this.posXSlider.value = avgX;
      if (this.posYSlider) this.posYSlider.value = avgY;
      if (this.posZSlider) this.posZSlider.value = avgZ;
      if (this.posXVal) this.posXVal.textContent = avgX.toFixed(1);
      if (this.posYVal) this.posYVal.textContent = avgY.toFixed(1);
      if (this.posZVal) this.posZVal.textContent = avgZ.toFixed(1);

      const toDeg = 180 / Math.PI;
      const degX = Math.round(selected.rotation.x * toDeg);
      const degY = Math.round(selected.rotation.y * toDeg);
      const degZ = Math.round(selected.rotation.z * toDeg);

      if (this.rotXSlider) this.rotXSlider.value = degX;
      if (this.rotYSlider) this.rotYSlider.value = degY;
      if (this.rotZSlider) this.rotZSlider.value = degZ;
      if (this.rotXVal) this.rotXVal.textContent = degX + '°';
      if (this.rotYVal) this.rotYVal.textContent = degY + '°';
      if (this.rotZVal) this.rotZVal.textContent = degZ + '°';

      if (this.selectedAtomLabelEl) {
        if (selectedIds.size > 1) {
          this.selectedAtomLabelEl.textContent = `${selectedIds.size} Atoms Selected`;
        } else {
          this.selectedAtomLabelEl.textContent = selected.name;
        }
      }

      if (this.atomActionsGroupEl) this.atomActionsGroupEl.style.display = 'grid';
      if (this.atomColorInput) this.atomColorInput.value = selected.color;
      if (this.atomNameInput) this.atomNameInput.value = selected.name;

      if (this.atomRadiusSlider) this.atomRadiusSlider.value = selected.radius;
      if (this.atomRadiusVal) this.atomRadiusVal.textContent = selected.radius.toFixed(2);

      if (this.atomChargeVal) {
        const c = selected.charge || 0;
        this.atomChargeVal.textContent = c > 0 ? `+${c}` : `${c}`;
        this.atomChargeVal.style.color = c === 0 ? 'var(--text-main)' : (c < 0 ? '#38bdf8' : '#f59e0b');
        const manualChargeEl = document.getElementById('manual-atom-charge');
        if (manualChargeEl && document.activeElement !== manualChargeEl) {
          manualChargeEl.value = String(c);
        }
      }

      const arrInfo = ARRANGEMENT_INFO[selected.orbitalType];
      const nodInfo = NODAL_INFO[selected.orbitalType];

      // Arrangement Checkbox
      if (arrInfo) {
        if (this.atomArrangementCheck) {
          this.atomArrangementCheck.disabled = false;
          this.atomArrangementCheck.checked = !!selected.showArrangement;
        }
        if (this.atomArrangementType) {
          this.atomArrangementType.textContent = `[${arrInfo.name} • ${arrInfo.regions} regions]`;
          this.atomArrangementType.style.color = 'var(--accent-cyan)';
        }
        if (this.showSelectedOutlineCheck) {
          this.showSelectedOutlineCheck.disabled = false;
          this.showSelectedOutlineCheck.checked = !!selected.showArrangement;
        }
        if (this.selectedOutlineSyncDesc) {
          this.selectedOutlineSyncDesc.textContent = `${arrInfo.name} (${selected.name})`;
        }
      } else {
        if (this.atomArrangementCheck) {
          this.atomArrangementCheck.disabled = true;
          this.atomArrangementCheck.checked = false;
        }
        if (this.atomArrangementType) {
          this.atomArrangementType.textContent = '[N/A for atomic s/p/d]';
          this.atomArrangementType.style.color = 'var(--text-dim)';
        }
        if (this.showSelectedOutlineCheck) {
          this.showSelectedOutlineCheck.disabled = true;
          this.showSelectedOutlineCheck.checked = false;
        }
        if (this.selectedOutlineSyncDesc) {
          this.selectedOutlineSyncDesc.textContent = 'Select hybrid atom';
        }
      }

      // Nodal Surfaces Checkbox
      if (nodInfo) {
        if (this.atomNodalCheck) {
          this.atomNodalCheck.disabled = false;
          this.atomNodalCheck.checked = !!selected.showNodalPlanes;
        }
        if (this.atomNodalType) {
          this.atomNodalType.textContent = `[${nodInfo.type}]`;
          this.atomNodalType.style.color = 'var(--accent-cyan)';
        }
        if (this.showSelectedNodalCheck) {
          this.showSelectedNodalCheck.disabled = false;
          this.showSelectedNodalCheck.checked = !!selected.showNodalPlanes;
        }
        if (this.selectedNodalSyncDesc) {
          this.selectedNodalSyncDesc.textContent = `${nodInfo.type} (${selected.name})`;
        }
      } else {
        if (this.atomNodalCheck) {
          this.atomNodalCheck.disabled = true;
          this.atomNodalCheck.checked = false;
        }
        if (this.atomNodalType) {
          this.atomNodalType.textContent = '[N/A for hybrid/s]';
          this.atomNodalType.style.color = 'var(--text-dim)';
        }
        if (this.showSelectedNodalCheck) {
          this.showSelectedNodalCheck.disabled = true;
          this.showSelectedNodalCheck.checked = false;
        }
        if (this.selectedNodalSyncDesc) {
          this.selectedNodalSyncDesc.textContent = 'Select p/d orbital atom';
        }
      }

      // Orbital Buttons Highlight
      document.querySelectorAll('.orbital-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.orbital === selected.orbitalType);
      });

      if (this.orbitalDescBox) {
        this.orbitalDescBox.innerHTML = ORBITAL_DESCRIPTIONS[selected.orbitalType] || ORBITAL_DESCRIPTIONS.none;
      }
    } else {
      if (this.selectedAtomLabelEl) this.selectedAtomLabelEl.textContent = 'None';
      if (this.atomActionsGroupEl) this.atomActionsGroupEl.style.display = 'none';

      if (this.atomChargeVal) {
        this.atomChargeVal.textContent = '0';
        this.atomChargeVal.style.color = 'var(--text-dim)';
      }

      if (this.rotXSlider) this.rotXSlider.value = 0;
      if (this.rotYSlider) this.rotYSlider.value = 0;
      if (this.rotZSlider) this.rotZSlider.value = 0;
      if (this.rotXVal) this.rotXVal.textContent = '0°';
      if (this.rotYVal) this.rotYVal.textContent = '0°';
      if (this.rotZVal) this.rotZVal.textContent = '0°';

      if (this.atomArrangementCheck) {
        this.atomArrangementCheck.disabled = true;
        this.atomArrangementCheck.checked = false;
      }
      if (this.atomArrangementType) {
        this.atomArrangementType.textContent = '[Select an atom]';
        this.atomArrangementType.style.color = 'var(--text-dim)';
      }
      if (this.showSelectedOutlineCheck) {
        this.showSelectedOutlineCheck.disabled = true;
        this.showSelectedOutlineCheck.checked = false;
      }
      if (this.selectedOutlineSyncDesc) {
        this.selectedOutlineSyncDesc.textContent = 'Select an atom';
      }

      if (this.atomNodalCheck) {
        this.atomNodalCheck.disabled = true;
        this.atomNodalCheck.checked = false;
      }
      if (this.atomNodalType) {
        this.atomNodalType.textContent = '[Select an atom]';
        this.atomNodalType.style.color = 'var(--text-dim)';
      }
      if (this.showSelectedNodalCheck) {
        this.showSelectedNodalCheck.disabled = true;
        this.showSelectedNodalCheck.checked = false;
      }
      if (this.selectedNodalSyncDesc) {
        this.selectedNodalSyncDesc.textContent = 'Select an atom';
      }

      document.querySelectorAll('.orbital-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.orbital === 'none');
      });

      if (this.orbitalDescBox) {
        this.orbitalDescBox.innerHTML = ORBITAL_DESCRIPTIONS.none;
      }
    }

    // Quick Build Status
    this.updateQuickBuildStatus(vm);
  }

  updateQuickBuildStatus(vm) {
    if (!this.quickBuildCurrentText) return;
    const elem = vm.quickBuildElem || 'H';
    const orb = vm.quickBuildOrbital || 's';
    const defaults = ELEMENT_DEFAULTS[elem] || { color: '#ffffff' };
    const orbLabel = ORBITAL_DISPLAY_LABELS[orb] || orb;
    this.quickBuildCurrentText.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${defaults.color};margin-right:4px;"></span>${elem} (${orbLabel})`;
  }

  updateQuickBuildButton(elem, orb) {
    const btn = document.querySelector(`.quick-attach-btn[data-elem="${elem}"]`);
    if (!btn) return;
    const badge = btn.querySelector('.orb-badge');
    if (badge) {
      badge.textContent = ORBITAL_DISPLAY_LABELS[orb] || orb;
    }
  }

  setActiveQuickBuildButton(elem) {
    document.querySelectorAll('.quick-attach-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.elem === elem);
    });
  }
}
