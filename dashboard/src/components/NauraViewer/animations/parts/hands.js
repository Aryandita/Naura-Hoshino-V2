/**
 * parts/hands.js - Pengendali Sendi Pergelangan Tangan & Gestur (Hands & Wrists).
 *
 * Mengendalikan:
 * 1. Pergelangan tangan kiri & kanan (leftHand, rightHand).
 * 2. Harmonic wave oscillation (lambaian tangan gelombang sinus pada animasi Wave & Cheers).
 * 3. Gestur meniup ciuman (BlowKiss) dan mantra (AstralCast).
 * 4. Isolasi error per tangan secara independen.
 */

import { slerpBone } from "../core/interpolation.js";

export class HandController {
  constructor(options = {}) {
    this.options = options;
    this.bones = {
      leftHand: null,
      rightHand: null,
    };
    this.currentRotations = {
      leftHand: [0, 0, 0],
      rightHand: [0, 0, 0],
    };
  }

  init(humanoidBones = {}) {
    this.bones.leftHand = humanoidBones.leftHand || null;
    this.bones.rightHand = humanoidBones.rightHand || null;
    this.reset();
  }

  update(delta, elapsed, context = {}) {
    const targetBones = context.targetBones || {};
    const harmonics = context.harmonics || null;
    const dur = context.duration || 3.0;
    const tNorm = context.tNorm || 0;
    const lerpSpeed = 1.0 - Math.exp(-14.0 * delta);

    // 1. Tangan Kanan
    try {
      if (this.bones.rightHand) {
        const base = targetBones.rightHand || [0, 0, 0];
        let wristOffsetZ = 0;

        // Terapkan osilasi lambaian jika dalam fase aktif harmonik
        if (
          harmonics &&
          harmonics.rightHandZ &&
          tNorm >= harmonics.activeStart &&
          tNorm <= harmonics.activeEnd
        ) {
          const oscTime = (tNorm - harmonics.activeStart) * dur;
          wristOffsetZ =
            Math.sin(oscTime * harmonics.freq - 0.4) * harmonics.rightHandZ;
        }

        const target = [base[0], base[1], base[2] + wristOffsetZ];

        slerpBone(
          this.bones.rightHand,
          this.currentRotations.rightHand,
          target,
          lerpSpeed,
        );

        this.currentRotations.rightHand[0] +=
          (target[0] - this.currentRotations.rightHand[0]) * lerpSpeed;
        this.currentRotations.rightHand[1] +=
          (target[1] - this.currentRotations.rightHand[1]) * lerpSpeed;
        this.currentRotations.rightHand[2] +=
          (target[2] - this.currentRotations.rightHand[2]) * lerpSpeed;
      }
    } catch (err) {
      console.warn(
        "[NauraAnimation:Hands] Error updating right hand:",
        err.message,
      );
    }

    // 2. Tangan Kiri
    try {
      if (this.bones.leftHand) {
        const base = targetBones.leftHand || [0, 0, 0];
        const target = [base[0], base[1], base[2]];

        slerpBone(
          this.bones.leftHand,
          this.currentRotations.leftHand,
          target,
          lerpSpeed,
        );

        this.currentRotations.leftHand[0] +=
          (target[0] - this.currentRotations.leftHand[0]) * lerpSpeed;
        this.currentRotations.leftHand[1] +=
          (target[1] - this.currentRotations.leftHand[1]) * lerpSpeed;
        this.currentRotations.leftHand[2] +=
          (target[2] - this.currentRotations.leftHand[2]) * lerpSpeed;
      }
    } catch (err) {
      console.warn(
        "[NauraAnimation:Hands] Error updating left hand:",
        err.message,
      );
    }
  }

  reset() {
    this.currentRotations.leftHand = [0, 0, 0];
    this.currentRotations.rightHand = [0, 0, 0];
    if (this.bones.leftHand) this.bones.leftHand.rotation.set(0, 0, 0);
    if (this.bones.rightHand) this.bones.rightHand.rotation.set(0, 0, 0);
  }

  destroy() {
    this.reset();
    this.bones.leftHand = null;
    this.bones.rightHand = null;
  }
}
