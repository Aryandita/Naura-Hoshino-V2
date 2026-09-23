/**
 * parts/leftLeg.js - Pengendali Kaki Kiri (Left Leg Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Paha atas kiri (leftUpperLeg) - titik tumpuan beban utama tubuh.
 * 2. Lutut kiri (leftLowerLeg) - fleksi lutut ringan pose contrapposto.
 * 3. Telapak kaki kiri (leftFoot) - plantar / dorsi flexion penyeimbang.
 *
 * Batas sudut: kaki kiri adalah kaki tumpuan utama (stance leg) pada pose contrapposto.
 * Isolasi penuh: error di file ini TIDAK mempengaruhi kaki kanan.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";

const LEFT_LEG_KEYS = ["leftUpperLeg", "leftLowerLeg", "leftFoot"];

// Alias VRM humanoid -> nama kunci umum (GLB bisa berbeda nama)
const LEFT_LEG_ALIASES = {
  leftUpperLeg: ["leftUpperLeg", "leftUpLeg"],
  leftLowerLeg: ["leftLowerLeg", "leftLeg"],
  leftFoot: ["leftFoot"],
};

export class LeftLegController {
  constructor(options = {}) {
    this.options = options;
    this.bones = {};
    this.currentRotations = {};
    for (const k of LEFT_LEG_KEYS) {
      this.currentRotations[k] = [0, 0, 0];
    }
  }

  /**
   * Inisialisasi referensi bone dari peta humanoidBones.
   * Mendukung nama alias VRM (leftUpLeg / leftUpperLeg) secara otomatis.
   * @param {Record<string, THREE.Object3D>} humanoidBones
   */
  init(humanoidBones = {}) {
    for (const k of LEFT_LEG_KEYS) {
      let bone = null;
      for (const alias of LEFT_LEG_ALIASES[k] || [k]) {
        if (humanoidBones[alias]) {
          bone = humanoidBones[alias];
          break;
        }
      }
      this.bones[k] = bone;
      this.currentRotations[k] = [0, 0, 0];
    }
  }

  /**
   * Update loop per frame: lerp kaki kiri menuju target keyframe.
   * @param {number} delta
   * @param {number} elapsed
   * @param {{ targetBones: Record<string,number[]> }} context
   */
  update(delta, elapsed, context = {}) {
    const targetBones = context.targetBones || {};
    const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);

    for (const key of LEFT_LEG_KEYS) {
      try {
        const bone = this.bones[key];
        if (!bone) continue;

        // Coba nama kunci langsung + alias (leftUpLeg vs leftUpperLeg)
        let base = targetBones[key];
        if (!base) {
          for (const alias of LEFT_LEG_ALIASES[key] || []) {
            if (targetBones[alias]) {
              base = targetBones[alias];
              break;
            }
          }
        }
        base = base || [0, 0, 0];
        const current = this.currentRotations[key];
        const target = [base[0], base[1], base[2]];

        // Batas paha atas kiri: kaki tumpuan utama - fleksi wajar untuk contrapposto
        if (key === "leftUpperLeg") {
          target[0] = THREE.MathUtils.clamp(target[0], -0.6, 0.8);
          target[1] = THREE.MathUtils.clamp(target[1], -0.35, 0.35);
          target[2] = THREE.MathUtils.clamp(target[2], -0.25, 0.25);
        }

        // Batas lutut kiri: hanya fleksi (tidak boleh hyperextend ke depan)
        if (key === "leftLowerLeg") {
          target[0] = THREE.MathUtils.clamp(target[0], -0.05, 1.6);
          target[2] = THREE.MathUtils.clamp(target[2], -0.15, 0.15);
        }

        slerpBoneDirect(bone, target, lerpSpeed);

        current[0] += (target[0] - current[0]) * lerpSpeed;
        current[1] += (target[1] - current[1]) * lerpSpeed;
        current[2] += (target[2] - current[2]) * lerpSpeed;
      } catch (err) {
        console.warn(
          `[NauraAnimation:LeftLeg] Error updating ${key}:`,
          err.message,
        );
      }
    }
  }

  reset() {
    for (const k of LEFT_LEG_KEYS) {
      this.currentRotations[k] = [0, 0, 0];
      if (this.bones[k]) this.bones[k].rotation.set(0, 0, 0);
    }
  }

  destroy() {
    this.reset();
    this.bones = {};
  }
}
