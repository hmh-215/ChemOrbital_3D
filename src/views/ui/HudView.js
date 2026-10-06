/**
 * HudView
 * Handles DOM elements for the top HUD bar, mode selector, molecular formula card,
 * and floating toast notifications.
 */

export class HudView {
  constructor() {
    this.hudSelectedText = document.getElementById('hud-selected-text');
    this.modeOrbitBtn = document.getElementById('mode-orbit-btn');
    this.modeBuildBtn = document.getElementById('mode-build-btn');
    this.modeBoxBtn = document.getElementById('mode-box-btn');
    this.sidebarModeBanner = document.getElementById('sidebar-mode-banner');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.toastEl = document.getElementById('toast-notification');
    this.formulaEl = document.getElementById('hud-formula-text');
    this.formulaNameEl = document.getElementById('hud-formula-name');
    this.formulaCountEl = document.getElementById('hud-formula-count');

    this.toastTimeout = null;
  }

  updateMode(mode) {
    const isOrbit = (mode === 'orbit' || mode === 'demos');
    const isBuild = (mode === 'build');
    const isBox = (mode === 'box' || mode === 'configure');

    if (this.modeOrbitBtn) this.modeOrbitBtn.classList.toggle('active', isOrbit);
    if (this.modeBuildBtn) this.modeBuildBtn.classList.toggle('active', isBuild);
    if (this.modeBoxBtn) this.modeBoxBtn.classList.toggle('active', isBox);

    document.body.classList.remove('mode-orbit', 'mode-demos', 'mode-build', 'mode-box', 'mode-configure');
    document.body.classList.add(isOrbit ? 'mode-orbit' : isBuild ? 'mode-build' : 'mode-box');

    if (this.sidebarModeBanner) {
      if (isOrbit) {
        this.sidebarModeBanner.innerHTML = '<span>🧪</span><div><strong>Demos Mode:</strong> Explore textbook organic, inorganic, and orbital gallery models.</div>';
      } else if (isBuild) {
        this.sidebarModeBanner.innerHTML = '<span>🔨</span><div><strong>Build Mode:</strong> Quick-attach to orbital lobes, add atoms manually & form bonds. Hold & drag to box-select.</div>';
      } else if (isBox) {
        this.sidebarModeBanner.innerHTML = '<span>⚙️</span><div><strong>Configure Mode:</strong> Select 1 or multiple atoms to customize properties and orbital states in batch.</div>';
      }
    }
  }

  updateTheme(isLight) {
    document.body.classList.toggle('theme-light', isLight);
    if (this.themeToggleBtn) {
      this.themeToggleBtn.textContent = isLight ? '🌙 Dark' : '☀️ Light';
      this.themeToggleBtn.title = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    }
  }

  updateHudSelectionText(text) {
    if (this.hudSelectedText) {
      this.hudSelectedText.textContent = text;
    }
  }

  updateFormula(formulaInfo) {
    if (this.formulaEl) this.formulaEl.textContent = formulaInfo.formula;
    if (this.formulaNameEl) this.formulaNameEl.textContent = formulaInfo.title;
    if (this.formulaCountEl) this.formulaCountEl.textContent = formulaInfo.atomCountText;
  }

  showToast(message, icon = '✨') {
    if (!this.toastEl) return;
    this.toastEl.replaceChildren();
    const iconEl = document.createElement('span');
    iconEl.style.fontSize = '15px';
    iconEl.textContent = icon;
    const msgEl = document.createElement('span');
    msgEl.textContent = message;
    this.toastEl.append(iconEl, msgEl);
    this.toastEl.classList.add('show');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
  }
}
