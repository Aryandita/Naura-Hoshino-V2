/**
 * parts/eyes.js - Pengendali Bola Mata & Arah Pandang (Eye Gaze & LookAt).
 *
 * Mengendalikan:
 * 1. VRM LookAt (mengikuti kursor secara presisi).
 * 2. Micro-saccades (gerakan mikroskopik bola mata alami manusia).
 * 3. Blendshape arah mata fallback (LookLeft, LookRight, LookUp, LookDown).
 * 4. Isolasi error total: jika ada kegagalan kalkulasi pandang, bagian tubuh lain tidak terdampak.
 */

import * as THREE from "three";

export class EyeController {
  constructor(options = {}) {
    this.vrm = null;
    this.options = options;
    this.target = new THREE.Vector3(0, 0.22, 1.2);
    this.currentGaze = new THREE.Vector2(0, 0);
    this.saccadeTimer = 0;
    this.saccadeOffset = new THREE.Vector2(0, 0);
    this.lookAtEnabled = options.lookAtCursor ?? true;
  }

  init(vrm, modelScene) {
    this.vrm = vrm;
    if (this.vrm?.lookAt) {
      // Konfigurasi target LookAt pada VRM jika tersedia
      this.vrm.lookAt.autoUpdate = false;
    }
  }

  /**
   * Set posisi kursor ternormalisasi (-1 s/d 1)
   */
  setCursor(x, y) {
    this.currentGaze.x = THREE.MathUtils.clamp(x, -1, 1);
    this.currentGaze.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  update(delta, elapsed, context = {}) {
    try {
      if (!this.vrm || !this.lookAtEnabled) return;

      // Micro-saccades acak setiap 1.5 - 3 detik
      this.saccadeTimer += delta;
      if (this.saccadeTimer >= 2.0 + Math.random()) {
        this.saccadeTimer = 0;
        this.saccadeOffset.x = (Math.random() - 0.5) * 0.04;
        this.saccadeOffset.y = (Math.random() - 0.5) * 0.03;
      }

      const gazeX = this.currentGaze.x + this.saccadeOffset.x;
      const gazeY = this.currentGaze.y + this.saccadeOffset.y;

      // Hitung target 3D di depan wajah model
      this.target.set(gazeX * 0.35, 0.22 + gazeY * 0.25, 1.2);

      if (this.vrm.lookAt) {
        if (typeof this.vrm.lookAt.lookAt === "function") {
          this.vrm.lookAt.lookAt(this.target);
        }
      } else {
        // Fallback blendshapes pupil mata
        this._applyPupilMorphs(gazeX, gazeY);
      }
    } catch (err) {
      console.warn(
        "[NauraAnimation:Eyes] Error updating eye gaze:",
        err.message,
      );
    }
  }

  _applyPupilMorphs(x, y) {
    if (!this.vrm) return;
    const lookLeft = Math.max(0, -x);
    const lookRight = Math.max(0, x);
    const lookUp = Math.max(0, y);
    const lookDown = Math.max(0, -y);

    if (this.vrm.blendShapeProxy) {
      this.vrm.blendShapeProxy.setValue("LookLeft", lookLeft);
      this.vrm.blendShapeProxy.setValue("LookRight", lookRight);
      this.vrm.blendShapeProxy.setValue("LookUp", lookUp);
      this.vrm.blendShapeProxy.setValue("LookDown", lookDown);
    } else if (this.vrm.expressionManager) {
      this.vrm.expressionManager.setValue("lookLeft", lookLeft);
      this.vrm.expressionManager.setValue("lookRight", lookRight);
      this.vrm.expressionManager.setValue("lookUp", lookUp);
      this.vrm.expressionManager.setValue("lookDown", lookDown);
    }
  }

  reset() {
    this.currentGaze.set(0, 0);
    this.saccadeOffset.set(0, 0);
  }

  destroy() {
    this.vrm = null;
  }
}
