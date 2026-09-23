/**
 * parts/rightLeg.js - Pengendali Kaki Kanan (Right Leg Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Paha atas kanan (rightUpperLeg) - kaki rileks pada pose contrapposto (free leg).
 * 2. Lutut kanan (rightLowerLeg) - fleksi lutut ringan pose santai anime.
 * 3. Telapak kaki kanan (rightFoot) - plantar flexion kaki bebas.
 *
 * Kaki kanan adalah "free leg" pada contrapposto: diperbolehkan sedikit tekukan lutut
 * yang memberikan kesan santai dan hidup pada karakter.
 * Isolasi penuh: error di file ini TIDAK mempengaruhi kaki kiri.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";

const RIGHT_LEG_KEYS = ["rightUpperLeg", "rightLowerLeg", "rightFoot"];

const RIGHT_LEG_ALIASES = {
  rightUpperLeg: ["rightUpperLeg", "rightUpLeg"],
  rightLowerLeg: ["rightLowerLeg", "rightLeg"],
  rightFoot: ["rightFoot"],
};

export class RightLegController {
  constructor(options = {}) {
    this.options = options;
    this.bones = {};
    this.currentRotations = {};
    for (const k of RIGHT_LEG_KEYS) {
      this.currentRotations[k] = [0, 0, 0];
    }
  }

  /**
   * Inisialisasi referensi bone dari peta humanoidBones.
   * Mendukung alias VRM (rightUpLeg / rightUpperLeg) secara otomatis.
   * @param {Record<string, THREE.Object3D>} humanoidBones
   */
  init(humanoidBones = {}) {
    for (const k of RIGHT_LEG_KEYS) {
      let bone = null;
      for (const alias of RIGHT_LEG_ALIASES[k] || [k]) {
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
   * Update loop per frame: lerp kaki kanan menuju target keyframe.
   * @param {number} delta
   * @param {number} elapsed
   * @param {{ targetBones: Record<string,number[]>, harmonics: object|null }} context
   */
  update(delta, elapsed, context = {}) {
    const targetBones = context.targetBones || {};
    const harmonics = context.harmonics || null;
    const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);

    for (const key of RIGHT_LEG_KEYS) {
      try {
        const bone = this.bones[key];
        if (!bone) continue;

        let base = targetBones[key];
        if (!base) {
          for (const alias of RIGHT_LEG_ALIASES[key] || []) {
            if (targetBones[alias]) {
              base = targetBones[alias];
              break;
            }
          }
        }
        base = base || [0, 0, 0];
        const current = this.currentRotations[key];
        const target = [base[0], base[1], base[2]];

        // Hop harmonic untuk Cheers / StarPose (lonjakan riang)
        if (key === "rightUpperLeg" && harmonics && harmonics.legHopY) {
          const hopPhase = context.tNorm * context.duration || 0;
          target[0] +=
            Math.sin(hopPhase * Math.PI * 2) * harmonics.legHopY * 0.5;
        }

        // Batas paha atas kanan: kaki bebas - fleksi sedikit lebih ekspresif
        if (key === "rightUpperLeg") {
          target[0] = THREE.MathUtils.clamp(target[0], -0.7, 0.9);
          target[1] = THREE.MathUtils.clamp(target[1], -0.35, 0.35);
          target[2] = THREE.MathUtils.clamp(target[2], -0.3, 0.3);
        }

        // Batas lutut kanan: kaki bebas boleh tekuk sedikit lebih untuk pose santai
        if (key === "rightLowerLeg") {
          target[0] = THREE.MathUtils.clamp(target[0], -0.05, 1.8);
          target[2] = THREE.MathUtils.clamp(target[2], -0.15, 0.15);
        }

        slerpBoneDirect(bone, target, lerpSpeed);

        current[0] += (target[0] - current[0]) * lerpSpeed;
        current[1] += (target[1] - current[1]) * lerpSpeed;
        current[2] += (target[2] - current[2]) * lerpSpeed;
      } catch (err) {
        console.warn(
          `[NauraAnimation:RightLeg] Error updating ${key}:`,
          err.message,
        );
      }
    }
  }

  reset() {
    for (const k of RIGHT_LEG_KEYS) {
      this.currentRotations[k] = [0, 0, 0];
      if (this.bones[k]) this.bones[k].rotation.set(0, 0, 0);
    }
  }

  destroy() {
    this.reset();
    this.bones = {};
  }
}
