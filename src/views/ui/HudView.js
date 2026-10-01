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
    if (this.modeOrbitBtn) this.modeOrbitBtn.classList.toggle('active', mode === 'orbit');
    if (this.modeBuildBtn) this.modeBuildBtn.classList.toggle('active', mode === 'build');
    if (this.modeBoxBtn) this.modeBoxBtn.classList.toggle('active', mode === 'box');

    document.body.classList.remove('mode-orbit', 'mode-build', 'mode-box');
    document.body.classList.add(`mode-${mode}`);

    if (this.sidebarModeBanner) {
      if (mode === 'orbit') {
        this.sidebarModeBanner.innerHTML = '<span>🔄</span><div><strong>Orbit Mode:</strong> Inspect 3D orbitals & molecules. Use teaching demos below.</div>';
      } else if (mode === 'build') {
        this.sidebarModeBanner.innerHTML = '<span>⚡</span><div><strong>Build Mode:</strong> Click any orbital lobe in 3D to attach atoms & form bonds.</div>';
      } else if (mode === 'box') {
        this.sidebarModeBanner.innerHTML = '<span>⬚</span><div><strong>Box Select Mode:</strong> Drag on canvas to select multiple atoms and form π-bonds.</div>';
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
    this.toastEl.innerHTML = `<span style="font-size: 15px;">${icon}</span><span>${message}</span>`;
    this.toastEl.classList.add('show');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
  }
}
