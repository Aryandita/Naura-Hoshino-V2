/**
 * parts/chest.js - Pengendali Rongga Dada Tengah (Chest Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Rotasi sendi chest (mid-thoracic cage).
 * 2. Ekspansi nafas ritme sinus pada rongga dada tengah.
 * 3. Kopling postural dengan elevasi kedua lengan (forward lean saat cheers).
 * 4. Counter-balance roll terhadap perbedaan ketinggian lengan kiri/kanan.
 *
 * Gerak tambahan dihitung dalam sumbu VRM lalu dikonversi ke sumbu rig GLB (vrmToRig).
 * Batas sudut: chest tidak boleh over-flex lebih dari ~0.30 rad ke segala arah.
 * Isolasi penuh: error di sini TIDAK mempengaruhi spine, hips, atau upperChest.
 */

import { slerpBoneDirect, softClampAngle } from "../core/interpolation.js";
import { vrmToRig, armElevation } from "../core/rigProfile.js";

export class ChestController {
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
    this.bone = humanoidBones.chest || null;
    this.reset();
  }

  /**
   * Update loop per frame: lerp rotasi dada tengah menuju target + napas + kopling lengan.
   * @param {number} delta
   * @param {number} elapsed
   * @param {{ targetBones: Record<string,number[]>, isIdle: boolean }} context
   */
  update(delta, elapsed, context = {}) {
    if (!this.bone) return;

    try {
      const targetBones = context.targetBones || {};
      const isIdle = context.isIdle ?? true;
      const lerpSpeed = 1.0 - Math.exp(-7.5 * delta);

      const base = targetBones.chest || [0, 0, 0];

      // Siklus napas sinusoidal pada dada tengah
      const breathCycle = Math.sin(elapsed * Math.PI * 2 * this.breathingRate);
      const breathWeight = isIdle ? 1.0 : 0.55;
      const breathPitch = breathCycle * 0.018 * breathWeight;

      // Kopling dengan elevasi lengan (diukur dari sudut angkat lengan, bukan sumbu X mentah)
      const rightLift = armElevation(targetBones.rightUpperArm);
      const leftLift = armElevation(targetBones.leftUpperArm);
      const posturalRoll = (rightLift - leftLift) * 0.016;
      // Forward lean saat kedua lengan terangkat (Cheers / AstralCast)
      const armForwardLean = (rightLift + leftLift) * 0.012;

      // [pitch, yaw, roll] (VRM) -> [roll, yaw, pitch] (rig)
      const extra = vrmToRig([
        breathPitch - armForwardLean,
        0,
        posturalRoll * 0.55,
      ]);

      // Batas dalam sumbu rig: roll (X), yaw (Y), pitch (Z; positif = condong ke belakang)
      const targetX = softClampAngle(
        base[0] + extra[0],
        -0.15,
        0.15,
        -0.22,
        0.22,
      );
      const targetY = softClampAngle(
        base[1] + extra[1],
        -0.18,
        0.18,
        -0.25,
        0.25,
      );
      const targetZ = softClampAngle(
        base[2] + extra[2],
        -0.28,
        0.22,
        -0.35,
        0.3,
      );

      const target = [targetX, targetY, targetZ];

      slerpBoneDirect(this.bone, target, lerpSpeed);

      this.currentRotation[0] +=
        (targetX - this.currentRotation[0]) * lerpSpeed;
      this.currentRotation[1] +=
        (targetY - this.currentRotation[1]) * lerpSpeed;
      this.currentRotation[2] +=
        (targetZ - this.currentRotation[2]) * lerpSpeed;
    } catch (err) {
      console.warn(
        "[NauraAnimation:Chest] Error updating chest kinematics:",
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
