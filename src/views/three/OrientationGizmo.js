/**
 * OrientationGizmo
 * Interactive 3D Rotation Axes Gizmo (matching CAD / Blender coordinate frame).
 * Renders +X (Red), +Y (Green), +Z (Blue) solid labeled spheres and
 * -X, -Y, -Z translucent circular rings.
 * Supports smooth 3D mouse drag rotation and click-to-snap orthogonal camera views.
 */
export class OrientationGizmo {
  constructor(canvas, threeScene) {
    this.canvas = canvas;
    this.threeScene = threeScene;
    this.ctx = canvas.getContext('2d');

    this.width = canvas.width || 130;
    this.height = canvas.height || 130;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.radius = 40; // Axis branch length

    this.axes = [
      { name: '+x', dir: [1, 0, 0], color: '#ef4444', darkColor: '#991b1b', label: 'X', isPositive: true },
      { name: '+y', dir: [0, 1, 0], color: '#22c55e', darkColor: '#166534', label: 'Y', isPositive: true },
      { name: '+z', dir: [0, 0, 1], color: '#3b82f6', darkColor: '#1e40af', label: 'Z', isPositive: true },
      { name: '-x', dir: [-1, 0, 0], color: '#ef4444', darkColor: 'rgba(239, 68, 68, 0.25)', label: '', isPositive: false },
      { name: '-y', dir: [0, -1, 0], color: '#22c55e', darkColor: 'rgba(34, 197, 94, 0.25)', label: '', isPositive: false },
      { name: '-z', dir: [0, 0, -1], color: '#3b82f6', darkColor: 'rgba(59, 130, 246, 0.25)', label: '', isPositive: false }
    ];

    this.hoveredAxis = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.lastPointer = { x: 0, y: 0 };
    this.potentialClickAxis = null;
    this.currentSnapAnim = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.potentialClickAxis = this.hoveredAxis;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this.canvas.style.cursor = 'grabbing';
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / (rect.width || 1);
      const scaleY = this.height / (rect.height || 1);
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      if (this.isDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };

        const totalDist = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
        if (totalDist > 4) {
          this.potentialClickAxis = null;
        }

        if (this.threeScene) {
          this.threeScene.orbitCameraDelta(-dx * 0.018, -dy * 0.018);
        }
      } else {
        this._updateHover(mouseX, mouseY);
      }
    });

    const endDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvas.style.cursor = this.hoveredAxis ? 'pointer' : 'grab';
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}

      // If clicked on an axis node without significant dragging, snap camera
      if (this.potentialClickAxis && this.threeScene) {
        this.snapToAxis(this.potentialClickAxis.name);
      }
      this.potentialClickAxis = null;
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.isDragging) {
        this.hoveredAxis = null;
        this.canvas.style.cursor = 'grab';
      }
    });
  }

  _updateHover(x, y) {
    let best = null;
    let minDist = 16; // Hit radius

    // Check front-to-back (most prominent axes first)
    const sorted = [...this.axes].sort((a, b) => (b.projZ || 0) - (a.projZ || 0));
    for (const axis of sorted) {
      if (axis.screenX !== undefined && axis.screenY !== undefined) {
        const d = Math.hypot(x - axis.screenX, y - axis.screenY);
        if (d < minDist) {
          best = axis;
          minDist = d;
        }
      }
    }

    if (this.hoveredAxis !== best) {
      this.hoveredAxis = best;
      this.canvas.style.cursor = best ? 'pointer' : 'grab';
    }
  }

  snapToAxis(axisName) {
    if (!this.threeScene || !this.threeScene.camera || !this.threeScene.controls) return;
    const THREE = window.THREE;
    if (!THREE) return;

    if (this.currentSnapAnim) {
      cancelAnimationFrame(this.currentSnapAnim);
      this.currentSnapAnim = null;
    }

    const target = this.threeScene.controls.target.clone();
    const dist = Math.max(5, this.threeScene.camera.position.distanceTo(target));

    let newOffset = new THREE.Vector3();
    let newUp = new THREE.Vector3(0, 1, 0);

    switch (axisName) {
      case '+x': newOffset.set(dist, 0, 0); break;
      case '-x': newOffset.set(-dist, 0, 0); break;
      case '+y': newOffset.set(0, dist, 0); newUp.set(0, 0, -1); break;
      case '-y': newOffset.set(0, -dist, 0); newUp.set(0, 0, 1); break;
      case '+z': newOffset.set(0, 0, dist); break;
      case '-z': newOffset.set(0, 0, -dist); break;
      default: return;
    }

    const startPos = this.threeScene.camera.position.clone();
    const endPos = target.clone().add(newOffset);
    const startUp = this.threeScene.camera.up.clone();
    const startTime = performance.now();
    const duration = 250; // ms smooth animation

    const animateSnap = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Ease in-out

      this.threeScene.camera.position.lerpVectors(startPos, endPos, ease);
      this.threeScene.camera.up.lerpVectors(startUp, newUp, ease).normalize();
      this.threeScene.camera.lookAt(target);
      this.threeScene.controls.update();

      if (t < 1) {
        this.currentSnapAnim = requestAnimationFrame(animateSnap);
      } else {
        this.currentSnapAnim = null;
        this.threeScene.camera.position.copy(endPos);
        this.threeScene.camera.up.copy(newUp);
        this.threeScene.camera.lookAt(target);
        this.threeScene.controls.update();
        if (this.threeScene.vm && typeof this.threeScene.vm.showToast === 'function') {
          this.threeScene.vm.showToast(`View aligned to ${axisName.toUpperCase()} axis`, '🎯');
        }
      }
    };
    this.currentSnapAnim = requestAnimationFrame(animateSnap);
  }

  update(camera) {
    if (!camera || !this.ctx) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Camera view rotation matrix (upper 3x3 of matrixWorldInverse)
    const m = camera.matrixWorldInverse.elements;

    // Project each axis
    this.axes.forEach(axis => {
      const [x, y, z] = axis.dir;
      // Camera-space coordinates
      const cx = m[0] * x + m[4] * y + m[8] * z;
      const cy = m[1] * x + m[5] * y + m[9] * z;
      const cz = m[2] * x + m[6] * y + m[10] * z;

      axis.projX = cx;
      axis.projY = cy;
      axis.projZ = cz; // Higher cz is closer to viewer in right-handed camera space

      axis.screenX = this.cx + cx * this.radius;
      axis.screenY = this.cy - cy * this.radius;
    });

    // Sort back-to-front by depth (projZ) so closer elements render on top
    const sorted = [...this.axes].sort((a, b) => a.projZ - b.projZ);

    // Draw central pivot base
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();

    // Render axes
    sorted.forEach(axis => {
      const isHover = (this.hoveredAxis === axis);
      const isPos = axis.isPositive;

      if (isPos) {
        // Draw solid colored axis rod for positive axes
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(axis.screenX, axis.screenY);
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 3D Shaded Sphere
        const sphereRadius = 14;
        ctx.beginPath();
        ctx.arc(axis.screenX, axis.screenY, sphereRadius, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(
          axis.screenX - sphereRadius * 0.3,
          axis.screenY - sphereRadius * 0.35,
          sphereRadius * 0.1,
          axis.screenX,
          axis.screenY,
          sphereRadius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, axis.color);
        grad.addColorStop(1, axis.darkColor);

        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle edge stroke
        ctx.strokeStyle = isHover ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = isHover ? 2.5 : 1.2;
        ctx.stroke();

        // Axis label letter
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 3;
        ctx.fillText(axis.label, axis.screenX, axis.screenY + 0.5);
        ctx.shadowBlur = 0;
      } else {
        // Negative axis: translucent hollow ring with colored border (matches CAD gizmo)
        const ringRadius = 11;
        ctx.beginPath();
        ctx.arc(axis.screenX, axis.screenY, ringRadius, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.65)';
        ctx.fill();
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.stroke();
      }

      // Glowing hover indicator
      if (isHover) {
        ctx.beginPath();
        ctx.arc(axis.screenX, axis.screenY, (isPos ? 14 : 11) + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
}
