/**
 * parts/upperChest.js - Pengendali Sendi Dada Atas & Kopling Toraks-Bahu (Upper Chest Kinematics).
 *
 * Mengendalikan:
 * 1. Rotasi sendi dada atas (upperChest).
 * 2. Kopling gerak toraks saat lengan diangkat (secondary thoracic expansion).
 * 3. Siklus pernapasan sinusoidal tingkat lanjut yang halus dan realistis.
 * 4. Isolasi error try-catch mandiri agar kegagalan sendi tidak menghentikan render loop 3D.
 *
 * Catatan: GLB Naura_Hoshino_3D_NEW tidak memiliki bone upperChest, sehingga controller ini
 * otomatis tidak aktif (this.bone = null). Tetap disesuaikan ke sumbu rig agar siap dipakai
 * jika model diganti.
 */

import { slerpBoneDirect, softClampAngle } from "../core/interpolation.js";
import { vrmToRig, armElevation } from "../core/rigProfile.js";

export class UpperChestController {
  constructor(options = {}) {
    this.options = options;
    this.bone = null;
    this.currentRotation = [0, 0, 0];
    this.breathingRate = 0.35;
  }

  init(humanoidBones = {}) {
    this.bone = humanoidBones.upperChest || null;
    this.reset();
  }

  update(delta, elapsed, context = {}) {
    if (!this.bone) return;

    try {
      const targetBones = context.targetBones || {};
      const isIdle = context.isIdle ?? true;
      const lerpSpeed = 1.0 - Math.exp(-7.5 * delta);

      // 1. Ambil target keyframe eksplisit jika didefinisikan
      const base = targetBones.upperChest || [0, 0, 0];

      // 2. Pernapasan realistis (tetap bernapas halus bahkan saat aksi berlangsung)
      const breathCycle = Math.sin(elapsed * Math.PI * 2 * this.breathingRate);
      const breathWeight = isIdle ? 1.0 : 0.45;
      const breathPitch = breathCycle * 0.012 * breathWeight;

      // 3. Kopling toraks sekunder terhadap elevasi lengan (secondary motion)
      const rightLift = armElevation(targetBones.rightUpperArm);
      const leftLift = armElevation(targetBones.leftUpperArm);
      const armElevationDelta = (rightLift - leftLift) * 0.025;
      const armForwardDelta = (rightLift + leftLift) * 0.015;

      // [pitch, yaw, roll] (VRM) -> [roll, yaw, pitch] (rig)
      const extra = vrmToRig([
        breathPitch - armForwardDelta,
        armElevationDelta * 0.4,
        armElevationDelta * 0.3,
      ]);

      const targetX = softClampAngle(
        base[0] + extra[0],
        -0.12,
        0.12,
        -0.2,
        0.2,
      );
      const targetY = softClampAngle(
        base[1] + extra[1],
        -0.15,
        0.15,
        -0.25,
        0.25,
      );
      const targetZ = softClampAngle(
        base[2] + extra[2],
        -0.25,
        0.2,
        -0.35,
        0.3,
      );

      const target = [targetX, targetY, targetZ];

      // 4. SLERP bertahap dari rotasi saat ini ke target pose (via quaternion bone langsung)
      slerpBoneDirect(this.bone, target, lerpSpeed);

      // Simpan rotasi saat ini untuk kesinambungan frame berikutnya
      this.currentRotation[0] +=
        (targetX - this.currentRotation[0]) * lerpSpeed;
      this.currentRotation[1] +=
        (targetY - this.currentRotation[1]) * lerpSpeed;
      this.currentRotation[2] +=
        (targetZ - this.currentRotation[2]) * lerpSpeed;
    } catch (err) {
      console.warn(
        "[NauraAnimation:UpperChest] Error updating upper chest kinematics:",
        err.message,
      );
    }
  }

  reset() {
    this.currentRotation = [0, 0, 0];
    if (this.bone) {
      this.bone.rotation.set(0, 0, 0);
    }
  }

  destroy() {
    this.reset();
    this.bone = null;
  }
}
