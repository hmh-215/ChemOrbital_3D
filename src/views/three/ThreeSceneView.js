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
import { OrientationGizmo } from './OrientationGizmo.js';
import { sceneBackground, FOG_DENSITY } from '../../constants/Theme.js';

export class ThreeSceneView {
  constructor(containerEl, marqueeEl, viewModel) {
    this.container = containerEl;
    this.marqueeEl = marqueeEl;
    this.vm = viewModel;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    const bgHex = sceneBackground(this.vm.isLight);
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, FOG_DENSITY);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 3, 10);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(bgHex, 1.0);
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
    this.controls.enablePan = true;
    this.controls.panSpeed = 1.0;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

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
    this.orbitalFactory.setTheme(this.vm.isLight);
    this.atomManager = new AtomMeshManager(this.scene, this.orbitalFactory);
    this.bondManager = new BondMeshManager(this.scene);
    this.bridgeManager = new BridgeMeshManager(this.scene, this.orbitalFactory);

    // Dedicated Nodal Surface Group for bond dissociation & antibonding (ψ = 0)
    this.nodalPlaneGroup = new THREE.Group();
    this.nodalPlaneGroup.name = "mo-nodal-plane-group";
    this.scene.add(this.nodalPlaneGroup);

    // 7. Quick Build 3D Ghost/Preview Meshes & Hit Proxies
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

    // Invisible hit proxy cylinder along preview bond line to make clicking / hovering forgiving
    this.previewLineHitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.previewLineHitProxy.visible = false;
    this.scene.add(this.previewLineHitProxy);

    this.currentQuickBuildTarget = null;

    // 8. Raycasting and Interaction State
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isMouseDown = false;
    this.isBoxSelecting = false;
    this.startScreenPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;
    this.lastPointerUpTime = 0;
    this.lastPointerUpPos = { x: 0, y: 0 };
    this.activePanKeys = new Set();

    // 9. Bind methods & setup listeners
    this._bindEvents();
    this._subscribeViewModel();

    // 9b. Orientation Gizmo (Interactive 3D Rotation Axes)
    const gizmoCanvas = document.getElementById('orientation-gizmo-canvas');
    if (gizmoCanvas) {
      this.orientationGizmo = new OrientationGizmo(gizmoCanvas, this);
    }

    // 10. Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _subscribeViewModel() {
    this.vm.on('atomAdded', (atom) => {
      this.atomManager.addAtomMesh(atom, this._getOrbitalOptions());
      this._syncBonds();
    });

    this.vm.on('atomRemoved', (atomId) => {
      this.atomManager.removeAtomMesh(atomId);
      this._syncBonds();
      this._syncBridges();
    });

    this.vm.on('atomUpdated', (atom) => {
      this.atomManager.updateAtomMesh(atom, this._getOrbitalOptions());
      if (atom === this.vm.primarySelectedAtom) this.atomManager.syncAxes(atom);
      this._syncBonds();
    });

    this.vm.on('selectionChanged', (selectedIds) => {
      this.atomManager.updateSelection(selectedIds, this.vm.primarySelectedAtom);
    });

    this.vm.on('bondAdded', () => {
      this._syncBonds();
    });

    this.vm.on('bondRemoved', () => {
      this._syncBonds();
    });

    this.vm.on('bondsUpdated', () => {
      this._syncBonds();
    });

    this.vm.on('bridgeAdded', () => {
      this._syncBridges();
    });

    this.vm.on('bridgesCleared', () => {
      this.bridgeManager.clearAll();
    });

    this.vm.on('moleculeReset', () => {
      this.atomManager.clearAll();
      this.bondManager.clearAll();
      this.bridgeManager.clearAll();
      this.updateNodalPlane({ visible: false });
    });

    this.vm.on('moleculeRestored', () => {
      this.atomManager.clearAll();
      this.bondManager.clearAll();
      this.bridgeManager.clearAll();
      this.updateNodalPlane({ visible: false });
      this.vm.atoms.forEach(atom => {
        this.atomManager.addAtomMesh(atom, this._getOrbitalOptions());
      });
      this._syncBonds();
      this._syncBridges();
      this.atomManager.updateSelection(this.vm.selectedIds, this.vm.primarySelectedAtom);
    });

    this.vm.on('nodalPlaneUpdated', (data) => {
      this.updateNodalPlane(data);
    });

    this.vm.on('displaySettingsChanged', () => {
      this.atomManager.rebuildAllOrbitals(this._getOrbitalOptions());
      this._syncBridges();
    });

    this.vm.on('cameraRequested', ({ position, target }) => {
      if (position) this.camera.position.copy(position);
      if (target) this.controls.target.copy(target);
      this.controls.update();
    });

    this.vm.on('themeChanged', (isLight) => {
      const hex = sceneBackground(isLight);
      this.scene.background.setHex(hex);
      this.scene.fog.color.setHex(hex);
      this.renderer.setClearColor(hex, 1.0);
      // Nodal planes / outlines use theme-dependent colours -> rebuild orbital groups
      this.orbitalFactory.setTheme(isLight);
      this.atomManager.rebuildAllOrbitals(this._getOrbitalOptions());
    });

    this.vm.on('modeChanged', (mode) => {
      const isDemos = (mode === 'orbit' || mode === 'demos');
      this.controls.enableRotate = isDemos;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enabled = true;
      if (mode !== 'build') {
        this.currentQuickBuildTarget = null;
        this.quickBuildPreview.visible = false;
        this.previewLine.visible = false;
        if (this.previewLineHitProxy) this.previewLineHitProxy.visible = false;
        this.renderer.domElement.style.cursor = 'default';
      }
    });
  }

  _syncBonds() {
    this.bondManager.updateAllBonds(this.vm.bonds, (id) => this.vm.getAtom(id));
  }

  _syncBridges() {
    this.bridgeManager.renderBridges(this.vm.bridges, (id) => this.vm.getAtom(id), this.vm.orbitalOpacity);
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

  _updatePreviewLineHitProxy(p1, p2) {
    if (!this.previewLineHitProxy) return;
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.001) return;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    this.previewLineHitProxy.position.copy(mid);
    this.previewLineHitProxy.scale.set(1, len, 1);
    this.previewLineHitProxy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.previewLineHitProxy.updateMatrixWorld(true);
    this.previewLineHitProxy.visible = true;
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
              this.currentQuickBuildTarget = {
                parentAtom,
                localDir: hitLobe.object.userData.localDir,
                attachPos: attachInfo.attachPos.clone()
              };
              this.quickBuildPreview.position.copy(attachInfo.attachPos);
              this.quickBuildPreview.visible = true;

              const linePts = [parentAtom.position.clone(), attachInfo.attachPos.clone()];
              this.previewLine.geometry.dispose();
              this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(linePts);
              this.previewLine.computeLineDistances();
              this.previewLine.visible = true;

              this._updatePreviewLineHitProxy(parentAtom.position, attachInfo.attachPos);

              dom.style.cursor = 'crosshair';
              return;
            }
          }
        }

        // If not directly over a lobe, check if pointer is hovering over preview sphere or preview bond line
        if (this.currentQuickBuildTarget && this.quickBuildPreview.visible) {
          const sphereHits = this.raycaster.intersectObject(this.quickBuildPreview, false);
          const lineHits = this.previewLineHitProxy ? this.raycaster.intersectObject(this.previewLineHitProxy, false) : [];
          if (sphereHits.length > 0 || lineHits.length > 0) {
            dom.style.cursor = 'crosshair';
            return; // Maintain preview target so cursor can reach sphere and line!
          }
        }

        this.currentQuickBuildTarget = null;
        this.quickBuildPreview.visible = false;
        this.previewLine.visible = false;
        if (this.previewLineHitProxy) this.previewLineHitProxy.visible = false;
        dom.style.cursor = 'default';
      }
    });

    dom.addEventListener('pointerleave', () => {
      this.currentQuickBuildTarget = null;
      this.quickBuildPreview.visible = false;
      this.previewLine.visible = false;
      if (this.previewLineHitProxy) this.previewLineHitProxy.visible = false;
    });

    // Pointer down
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      this.isMouseDown = true;
      this.pointerDownTime = performance.now();
      const coords = this._getCanvasRelativeCoords(e);
      this.startScreenPos = coords;

      if (this.vm.interactionMode === 'box' || this.vm.interactionMode === 'configure' || this.vm.interactionMode === 'build' || e.shiftKey) {
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

      const coords = this._getCanvasRelativeCoords(e);
      const dragDist = Math.hypot(coords.x - this.startScreenPos.x, coords.y - this.startScreenPos.y);
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      this.isBoxSelecting = false;
      if (this.marqueeEl) this.marqueeEl.style.display = 'none';

      // Re-enable OrbitControls for right-click pan and wheel zoom
      this.controls.enabled = true;
      const isDemos = (this.vm.interactionMode === 'orbit' || this.vm.interactionMode === 'demos');
      this.controls.enableRotate = isDemos;

      if (dragDist > 6) {
        // Multi-select atoms inside marquee box
        const rect = dom.getBoundingClientRect();
        const minX = Math.min(this.startScreenPos.x, coords.x);
        const maxX = Math.max(this.startScreenPos.x, coords.x);
        const minY = Math.min(this.startScreenPos.y, coords.y);
        const maxY = Math.max(this.startScreenPos.y, coords.y);

        if (!isCtrl && !isShift) {
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

      // dragDist <= 6 is a direct click
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

      // 1. Raycast nuclei
      const nucleusMeshes = this.atomManager.getAllNucleusMeshes();
      const nucleusHits = this.raycaster.intersectObjects(nucleusMeshes, false);
      let hitAtom = null;

      if (nucleusHits.length > 0) {
        hitAtom = this.atomManager.getAtomFromMesh(nucleusHits[0].object);
      } else {
        // 2. Raycast orbital lobes
        const hitLobe = this._findHoveredLobe();
        if (hitLobe) {
          hitAtom = this.atomManager.getAtomFromMesh(hitLobe.object);
        }
      }

      // 3. Raycast covalent bonds (clicking a bond cylinder selects both connected atoms!)
      if (!hitAtom) {
        const bondHits = this.raycaster.intersectObjects(this.bondManager.covalentBondsGroup.children, false);
        if (bondHits.length > 0) {
          const hitMesh = bondHits[0].object;
          for (const [bondId, record] of this.bondManager.bondMeshes) {
            if (record.mesh === hitMesh) {
              if (!isCtrl && !isShift) {
                this.vm.deselectAllAtoms();
              }
              this.vm.selectAtom(record.bondModel.atomAId, true);
              this.vm.selectAtom(record.bondModel.atomBId, true);
              this.vm.showToast(`Selected bond ${record.bondModel.atomAId}—${record.bondModel.atomBId}`, '🔗');
              return;
            }
          }
        }
      }

      // Double Click without Shift: center camera on atom
      if (isDblClick && !isShift && hitAtom) {
        this.controls.target.copy(hitAtom.position);
        this.controls.update();
        this.vm.showToast(`Focused camera on ${hitAtom.name}`, '🔍');
        return;
      }

      // Shift + Double Click: select all atoms of same element
      if (isDblClick && isShift && hitAtom) {
        this.vm.selectAtomsByType(hitAtom.element, isCtrl);
        return;
      }

      // Quick Build attachment in build mode:
      // Triggered when clicking the ghost preview sphere, the dashed bond line, or clicking a lobe
      if (this.vm.interactionMode === 'build' && !isDblClick) {
        let shouldQuickAttach = false;
        if (this.currentQuickBuildTarget) {
          if (e.altKey) {
            shouldQuickAttach = true;
          } else {
            const previewHits = this.raycaster.intersectObject(this.quickBuildPreview, false);
            const lineHits = this.previewLineHitProxy ? this.raycaster.intersectObject(this.previewLineHitProxy, false) : [];
            const lobeHits = this._findHoveredLobe();
            if (previewHits.length > 0 || lineHits.length > 0 || lobeHits) {
              shouldQuickAttach = true;
            }
          }
        }

        if (shouldQuickAttach && this.currentQuickBuildTarget) {
          const { parentAtom, localDir } = this.currentQuickBuildTarget;
          this.vm.quickAttachAtom(parentAtom, localDir);
          this.currentQuickBuildTarget = null;
          this.quickBuildPreview.visible = false;
          this.previewLine.visible = false;
          if (this.previewLineHitProxy) this.previewLineHitProxy.visible = false;
          return;
        }
      }

      // Atom selection (Clicking an atom or its orbital lobe)
      if (hitAtom) {
        if (isCtrl || isShift) {
          this.vm.selectAtom(hitAtom.id, true);
        } else {
          this.vm.selectAtom(hitAtom.id, false);
        }
        return;
      }

      // Clicked empty space: deselect if not holding Ctrl or Shift
      if (!isCtrl && !isShift) {
        this.vm.deselectAllAtoms();
      }
    });

    // Resize (Window & Container Observer)
    const resizeHandler = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', resizeHandler);
    if (window.ResizeObserver) {
      new ResizeObserver(resizeHandler).observe(this.container);
    }

    // Smooth keyboard pan (screen shift) on arrow keys
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isTextInput = (activeTag === 'input' && document.activeElement.type === 'text') || activeTag === 'textarea';
      // Arrow keys belong to focused sliders / selects / number fields
      const isFormControl = isTextInput || activeTag === 'select' ||
        (activeTag === 'input' && ['range', 'number'].includes(document.activeElement.type));
      if (isFormControl) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.activePanKeys.add(e.key);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.activePanKeys.has(e.key)) {
        this.activePanKeys.delete(e.key);
      }
    });

    window.addEventListener('blur', () => {
      this.activePanKeys.clear();
    });
  }

  updateNodalPlane(options) {
    while (this.nodalPlaneGroup.children.length > 0) {
      this.nodalPlaneGroup.remove(this.nodalPlaneGroup.children[0]);
    }

    if (!options || !options.visible) {
      this.nodalPlaneGroup.visible = false;
      return;
    }

    this.nodalPlaneGroup.visible = true;
    const pos = options.position || new THREE.Vector3(0, 0, 0);
    const normal = (options.normal || new THREE.Vector3(1, 0, 0)).clone().normalize();
    const planeColor = options.color || '#38bdf8';

    // 1. Translucent Nodal Surface Plane (ψ = 0)
    const size = 3.2;
    const planeGeom = new THREE.PlaneGeometry(size, size);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.position.copy(pos);
    planeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.nodalPlaneGroup.add(planeMesh);

    // 2. Clear Perimeter Border Edges
    const edgesGeom = new THREE.EdgesGeometry(planeGeom);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    planeMesh.add(new THREE.LineSegments(edgesGeom, edgesMat));

    // 3. Billboard Text Sprite Label
    if (options.label) {
      const sprite = this.bridgeManager.makeTextSprite(options.label, '#38bdf8');
      let upDir = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.y) > 0.8) upDir = new THREE.Vector3(0, 0, 1);
      const perp = upDir.sub(normal.clone().multiplyScalar(upDir.dot(normal))).normalize();
      sprite.position.copy(pos.clone().add(perp.multiplyScalar(1.95)));
      this.nodalPlaneGroup.add(sprite);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Make selection rings face camera
    this.atomManager.atomMeshes.forEach(record => {
      if (record.selectionRing && record.selectionRing.visible) {
        record.selectionRing.quaternion.copy(record.group.quaternion).invert().multiply(this.camera.quaternion);
      }
    });

    // Handle continuous smooth 60fps pan while arrow keys are held
    if (this.activePanKeys && this.activePanKeys.size > 0) {
      let panX = 0;
      let panY = 0;
      if (this.activePanKeys.has('ArrowRight')) panX += 1;
      if (this.activePanKeys.has('ArrowLeft')) panX -= 1;
      if (this.activePanKeys.has('ArrowUp')) panY += 1;
      if (this.activePanKeys.has('ArrowDown')) panY -= 1;
      if (panX !== 0 || panY !== 0) {
        this.panCamera(panX * 0.15, panY * 0.15);
      }
    }

    this.controls.update();
    if (this.orientationGizmo) {
      this.orientationGizmo.update(this.camera);
    }
    this.renderer.render(this.scene, this.camera);
  }

  panCamera(deltaX, deltaY) {
    const vRight = new THREE.Vector3();
    this.camera.matrix.extractBasis(vRight, new THREE.Vector3(), new THREE.Vector3());
    vRight.normalize();

    const vUp = new THREE.Vector3();
    this.camera.matrix.extractBasis(new THREE.Vector3(), vUp, new THREE.Vector3());
    vUp.normalize();

    const dist = this.camera.position.distanceTo(this.controls.target);
    const speed = Math.max(0.12, dist * 0.035);

    const shift = vRight.multiplyScalar(deltaX * speed).add(vUp.multiplyScalar(deltaY * speed));
    this.camera.position.add(shift);
    this.controls.target.add(shift);
    this.controls.update();
  }

  orbitCameraDelta(deltaTheta, deltaPhi) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    let radius = offset.length();
    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

    theta += deltaTheta;
    phi = Math.max(0.04, Math.min(Math.PI - 0.04, phi + deltaPhi));

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);
    this.controls.update();
  }

  resetCamera() {
    this.camera.position.set(0, 3, 10);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.vm.showToast('Camera centered', '⟲');
  }
}

