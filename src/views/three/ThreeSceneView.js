/**
 * ThreeSceneView
 * 3D WebGL View managing Three.js scene, camera, renderer, orbit controls,
 * lights, raycasting, and delegation to Mesh Managers.
 */
import { OrbitalMeshFactory } from './OrbitalMeshFactory.js';
import { AtomMeshManager } from './AtomMeshManager.js';
import { BondMeshManager } from './BondMeshManager.js';
import { BridgeMeshManager } from './BridgeMeshManager.js';
import { ELEMENT_DEFAULTS } from '../../constants/Elements.js';
import { calculateAttachment } from '../../models/ChemistryMath.js';

export class ThreeSceneView {
  constructor(containerEl, marqueeEl, viewModel) {
    this.container = containerEl;
    this.marqueeEl = marqueeEl;
    this.vm = viewModel;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f19);
    this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.025);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 3, 10);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'webgl-canvas';
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 100;
    this.controls.minDistance = 1;

    // 5. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dirLight1.position.set(10, 15, 10);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    this.dirLight2.position.set(-10, -5, -10);
    this.scene.add(this.dirLight2);

    // 6. Sub-managers
    this.orbitalFactory = new OrbitalMeshFactory();
    this.atomManager = new AtomMeshManager(this.scene, this.orbitalFactory);
    this.bondManager = new BondMeshManager(this.scene);
    this.bridgeManager = new BridgeMeshManager(this.scene, this.orbitalFactory);

    // 7. Quick Build 3D Ghost/Preview Meshes
    this.quickBuildPreview = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.5, wireframe: true })
    );
    this.quickBuildPreview.visible = false;
    this.scene.add(this.quickBuildPreview);

    this.previewLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0x84cc16, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.85 })
    );
    this.previewLine.visible = false;
    this.scene.add(this.previewLine);

    // 8. Raycasting and Interaction State
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isMouseDown = false;
    this.isBoxSelecting = false;
    this.startScreenPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;
    this.lastPointerUpTime = 0;
    this.lastPointerUpPos = { x: 0, y: 0 };

    // 9. Bind methods & setup listeners
    this._bindEvents();
    this._subscribeViewModel();

    // 10. Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _subscribeViewModel() {
    this.vm.on('atomAdded', (atom) => {
      this.atomManager.addAtomMesh(atom, this._getOrbitalOptions());
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
    });

    this.vm.on('atomRemoved', (atomId) => {
      this.atomManager.removeAtomMesh(atomId);
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
      this.bridgeManager.renderBridges(this.vm.bridges, (id) => this.vm.model.getAtom(id), this.vm.orbitalOpacity);
    });

    this.vm.on('atomUpdated', (atom) => {
      this.atomManager.updateAtomMesh(atom, this._getOrbitalOptions());
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
    });

    this.vm.on('selectionChanged', (selectedIds) => {
      this.atomManager.updateSelection(selectedIds, this.vm.primarySelectedAtom);
    });

    this.vm.on('bondAdded', () => {
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
    });

    this.vm.on('bondRemoved', () => {
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
    });

    this.vm.on('bondsUpdated', () => {
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
    });

    this.vm.on('bridgeAdded', () => {
      this.bridgeManager.renderBridges(this.vm.bridges, (id) => this.vm.model.getAtom(id), this.vm.orbitalOpacity);
    });

    this.vm.on('bridgesCleared', () => {
      this.bridgeManager.clearAll();
    });

    this.vm.on('moleculeReset', () => {
      this.atomManager.clearAll();
      this.bondManager.clearAll();
      this.bridgeManager.clearAll();
    });

    this.vm.on('moleculeRestored', () => {
      this.atomManager.clearAll();
      this.bondManager.clearAll();
      this.bridgeManager.clearAll();
      this.vm.atoms.forEach(atom => {
        this.atomManager.addAtomMesh(atom, this._getOrbitalOptions());
      });
      this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.model.getAtom(id));
      this.bridgeManager.renderBridges(this.vm.bridges, (id) => this.vm.model.getAtom(id), this.vm.orbitalOpacity);
      this.atomManager.updateSelection(this.vm.selectedIds, this.vm.primarySelectedAtom);
    });

    this.vm.on('displaySettingsChanged', () => {
      this.atomManager.rebuildAllOrbitals(this._getOrbitalOptions());
      this.bridgeManager.renderBridges(this.vm.bridges, (id) => this.vm.model.getAtom(id), this.vm.orbitalOpacity);
    });

    this.vm.on('cameraRequested', ({ position, target }) => {
      if (position) this.camera.position.copy(position);
      if (target) this.controls.target.copy(target);
      this.controls.update();
    });

    this.vm.on('themeChanged', (isLight) => {
      const bgHex = isLight ? 0xf8fafc : 0x0b0f19;
      this.scene.background.setHex(bgHex);
      this.scene.fog.color.setHex(bgHex);
    });

    this.vm.on('modeChanged', (mode) => {
      this.controls.enabled = (mode === 'orbit' || mode === 'build');
      if (mode !== 'build') {
        this.quickBuildPreview.visible = false;
        this.previewLine.visible = false;
        this.renderer.domElement.style.cursor = 'default';
      }
    });
  }

  _getOrbitalOptions() {
    return {
      orbitalScale: this.vm.orbitalScale,
      orbitalOpacity: this.vm.orbitalOpacity,
      showBackLobes: this.vm.showBackLobes,
      showUnhybridP: this.vm.showUnhybridP
    };
  }

  _getCanvasRelativeCoords(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY
    };
  }

  _findHoveredLobe() {
    const lobeMeshes = this.atomManager.getAllLobeMeshes();
    if (lobeMeshes.length === 0) return null;
    const intersects = this.raycaster.intersectObjects(lobeMeshes, false);
    if (intersects.length > 0) {
      return intersects[0];
    }
    return null;
  }

  _bindEvents() {
    const dom = this.renderer.domElement;

    // Pointer move
    dom.addEventListener('pointermove', (e) => {
      if (this.isMouseDown) return;

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.vm.interactionMode === 'build') {
        const hitLobe = this._findHoveredLobe();
        if (hitLobe) {
          const parentAtom = this.atomManager.getAtomFromMesh(hitLobe.object);
          const distFromCenter = parentAtom ? hitLobe.point.distanceTo(parentAtom.position) : 0;
          if (parentAtom && distFromCenter >= parentAtom.radius * 0.85) {
            const attachInfo = calculateAttachment(
              parentAtom,
              hitLobe.object.userData.localDir,
              this.vm.quickBuildElem,
              this.vm.quickBuildOrbital
            );
            if (attachInfo) {
              this.quickBuildPreview.position.copy(attachInfo.attachPos);
              this.quickBuildPreview.visible = true;

              const linePts = [parentAtom.position.clone(), attachInfo.attachPos.clone()];
              this.previewLine.geometry.dispose();
              this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(linePts);
              this.previewLine.computeLineDistances();
              this.previewLine.visible = true;

              dom.style.cursor = 'crosshair';
              return;
            }
          }
        }
        this.quickBuildPreview.visible = false;
        this.previewLine.visible = false;
        dom.style.cursor = 'default';
      }
    });

    dom.addEventListener('pointerleave', () => {
      this.quickBuildPreview.visible = false;
      this.previewLine.visible = false;
    });

    // Pointer down
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      this.isMouseDown = true;
      this.pointerDownTime = performance.now();
      const coords = this._getCanvasRelativeCoords(e);
      this.startScreenPos = coords;

      if (this.vm.interactionMode === 'box' || e.shiftKey) {
        this.isBoxSelecting = true;
        this.controls.enabled = false;
        if (this.marqueeEl) {
          this.marqueeEl.style.left = coords.x + 'px';
          this.marqueeEl.style.top = coords.y + 'px';
          this.marqueeEl.style.width = '0px';
          this.marqueeEl.style.height = '0px';
          this.marqueeEl.style.display = 'block';
        }
      }
    });

    // Window pointer move for marquee box
    window.addEventListener('pointermove', (e) => {
      if (!this.isMouseDown) return;

      if (this.isBoxSelecting && this.marqueeEl) {
        const coords = this._getCanvasRelativeCoords(e);
        const minX = Math.min(this.startScreenPos.x, coords.x);
        const minY = Math.min(this.startScreenPos.y, coords.y);
        const width = Math.abs(coords.x - this.startScreenPos.x);
        const height = Math.abs(coords.y - this.startScreenPos.y);

        this.marqueeEl.style.left = minX + 'px';
        this.marqueeEl.style.top = minY + 'px';
        this.marqueeEl.style.width = width + 'px';
        this.marqueeEl.style.height = height + 'px';
      }
    });

    // Window pointer up
    window.addEventListener('pointerup', (e) => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;

      const duration = performance.now() - this.pointerDownTime;
      const coords = this._getCanvasRelativeCoords(e);
      const dragDist = Math.hypot(coords.x - this.startScreenPos.x, coords.y - this.startScreenPos.y);
      const isCtrl = e.ctrlKey || e.metaKey;

      this.isBoxSelecting = false;
      if (this.marqueeEl) this.marqueeEl.style.display = 'none';

      if (this.vm.interactionMode === 'orbit' || this.vm.interactionMode === 'build') {
        this.controls.enabled = true;
      }

      if (dragDist > 6) {
        // Multi-select atoms inside marquee box
        const rect = dom.getBoundingClientRect();
        const minX = Math.min(this.startScreenPos.x, coords.x);
        const maxX = Math.max(this.startScreenPos.x, coords.x);
        const minY = Math.min(this.startScreenPos.y, coords.y);
        const maxY = Math.max(this.startScreenPos.y, coords.y);

        if (!isCtrl) {
          this.vm.deselectAllAtoms();
        }

        this.vm.atoms.forEach(atom => {
          const projected = atom.position.clone().project(this.camera);
          const screenX = ((projected.x + 1) * rect.width) / 2;
          const screenY = ((-projected.y + 1) * rect.height) / 2;

          if (projected.z < 1 && screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
            this.vm.selectAtom(atom.id, true);
          }
        });
        return;
      }

      if (duration < 380) {
        const now = performance.now();
        const timeSinceLast = now - this.lastPointerUpTime;
        const distFromLast = Math.hypot(coords.x - this.lastPointerUpPos.x, coords.y - this.lastPointerUpPos.y);
        const isDblClick = (timeSinceLast < 400 && distFromLast < 14);

        this.lastPointerUpTime = now;
        this.lastPointerUpPos = { x: coords.x, y: coords.y };

        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Raycast atoms
        const nucleusMeshes = this.atomManager.getAllNucleusMeshes();
        const nucleusHits = this.raycaster.intersectObjects(nucleusMeshes, false);
        let hitAtom = null;

        if (nucleusHits.length > 0) {
          hitAtom = this.atomManager.getAtomFromMesh(nucleusHits[0].object);
        } else {
          const hitLobe = this._findHoveredLobe();
          if (hitLobe) {
            hitAtom = this.atomManager.getAtomFromMesh(hitLobe.object);
          }
        }

        // Shift + Double Click: select all atoms of same element
        if (isDblClick && e.shiftKey && hitAtom) {
          this.vm.selectAtomsByType(hitAtom.element, isCtrl);
          return;
        }

        // Double Click without Shift: center camera on atom
        if (isDblClick && !e.shiftKey && hitAtom) {
          this.controls.target.copy(hitAtom.position);
          this.controls.update();
          this.vm.showToast(`Focused camera on ${hitAtom.name}`, '🔍');
          return;
        }

        // Quick Build attachment when clicking lobe in build mode
        if (this.vm.interactionMode === 'build' && !isDblClick) {
          const hitLobe = this._findHoveredLobe();
          if (hitLobe) {
            const parentAtom = this.atomManager.getAtomFromMesh(hitLobe.object);
            const distFromCenter = parentAtom ? hitLobe.point.distanceTo(parentAtom.position) : 0;
            if (parentAtom && distFromCenter >= parentAtom.radius * 0.85) {
              this.vm.quickAttachAtom(parentAtom, hitLobe.object.userData.localDir);
              this.quickBuildPreview.visible = false;
              this.previewLine.visible = false;
              return;
            }
          }
        }

        // Single click atom selection
        if (hitAtom) {
          if (isCtrl) {
            this.vm.selectAtom(hitAtom.id, true);
          } else {
            this.vm.selectAtom(hitAtom.id, false);
          }
          return;
        }

        // Clicked empty space
        if (!isCtrl) {
          this.vm.selectAtom(null);
        }
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Make selection rings face camera
    this.atomManager.atomMeshes.forEach(record => {
      if (record.selectionRing && record.selectionRing.visible) {
        record.selectionRing.quaternion.copy(record.group.quaternion).invert().multiply(this.camera.quaternion);
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
