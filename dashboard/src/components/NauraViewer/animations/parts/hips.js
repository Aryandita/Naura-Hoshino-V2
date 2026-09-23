/**
 * parts/hips.js - Pengendali Pelvis / Pinggul (Hips & Pelvic Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Rotasi sendi hips (hips) - titik gravitasi dan pusat massa tubuh.
 * 2. Pelvic sway contrapposto (miring ringan berlawanan arah torso).
 * 3. Getaran ritme pernafasan: hips bergerak ringan dengan napas.
 *
 * Gerak tambahan dihitung dalam sumbu VRM lalu dikonversi ke sumbu rig GLB (vrmToRig).
 * Batas sudut ketat: hips adalah akar tulang belakang, over-rotation di sini
 * akan merusak seluruh postur. Batas aman: +/- 0.06 rad roll & pitch, +/- 0.08 yaw.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";
import { vrmToRig } from "../core/rigProfile.js";

export class HipsController {
  constructor(options = {}) {
    this.options = options;
    this.bone = null;
    this.currentRotation = [0, 0, 0];
    this.breathingRate = 0.35;
  }

  /**
   * Inisialisasi referensi bone dari peta humanoidBones.
   * @param {Record<string, THREE.Object3D>} humanoidBones
   */
  init(humanoidBones = {}) {
    this.bone = humanoidBones.hips || null;
    this.reset();
  }

  /**
   * Update loop per frame: lerp rotasi pinggul menuju target + sway contrapposto.
   * @param {number} delta
   * @param {number} elapsed
   * @param {{ targetBones: Record<string,number[]>, isIdle: boolean }} context
   */
  update(delta, elapsed, context = {}) {
    if (!this.bone) return;

    try {
      const targetBones = context.targetBones || {};
      const isIdle = context.isIdle ?? true;
      const lerpSpeed = 1.0 - Math.exp(-7.0 * delta);

      const base = targetBones.hips || [0, 0, 0];

      // Pelvic contrapposto sway: hips miring ringan berlawanan arah torso
      const swayWeight = isIdle ? 1.0 : 0.4;
      const swayRoll =
        Math.sin(elapsed * Math.PI * 2 * 0.15) * 0.018 * swayWeight;

      // Napas menyentuh hips: getaran micro-bounce
      const breathPitch =
        Math.sin(elapsed * Math.PI * 2 * this.breathingRate) *
        0.006 *
        swayWeight;

      // [pitch, yaw, roll] (VRM) -> [roll, yaw, pitch] (rig)
      const extra = vrmToRig([breathPitch, 0, swayRoll]);

      const target = [
        THREE.MathUtils.clamp(base[0] + extra[0], -0.06, 0.06), // roll
        THREE.MathUtils.clamp(base[1] + extra[1], -0.08, 0.08), // yaw
        THREE.MathUtils.clamp(base[2] + extra[2], -0.06, 0.06), // pitch
      ];

      slerpBoneDirect(this.bone, target, lerpSpeed);

      this.currentRotation[0] +=
        (target[0] - this.currentRotation[0]) * lerpSpeed;
      this.currentRotation[1] +=
        (target[1] - this.currentRotation[1]) * lerpSpeed;
      this.currentRotation[2] +=
        (target[2] - this.currentRotation[2]) * lerpSpeed;
    } catch (err) {
      console.warn(
        "[NauraAnimation:Hips] Error updating hips kinematics:",
        err.message,
      );
    }
  }

  reset() {
    this.currentRotation = [0, 0, 0];
    if (this.bone) this.bone.rotation.set(0, 0, 0);
  }

  destroy() {
    this.reset();
    this.bone = null;
  }
}
