/**
 * parts/leftHand.js - Pengendali Pergelangan Tangan Kiri (Left Hand & Wrist Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Pergelangan tangan kiri (leftHand) - pose alami dengan wrist follow-through organik.
 * 2. Kompensasi sudut manset agar pergelangan tangan tidak pernah keluar dari garis manset lengan.
 * 3. Ayunan mikro sekunder yang mengikuti gerak lengan bawah (leftLowerArm) secara luwes.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";

export class LeftHandController {
    constructor(options = {}) {
        this.options = options;
        this.bone = null;
        this.currentRotation = [0, 0, 0];
        this.prevForeArm = [0, 0, 0];
        this.wristVel = [0, 0, 0];
    }

    init(humanoidBones = {}) {
        this.bone = humanoidBones.leftHand || null;
        this.reset();
    }

    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            const lerpSpeed = 1.0 - Math.exp(-12.0 * delta);

            const base = targetBones.leftHand || [0, 0, 0];
            const lowerArm = targetBones.leftLowerArm || [-0.115, 0.015, 0.025];

            // Hitung percepatan/kecepatan sudut lengan bawah untuk efek follow-through pergelangan
            const dt = Math.max(0.008, delta);
            const dArmX = THREE.MathUtils.clamp((lowerArm[0] - this.prevForeArm[0]) / dt, -4.0, 4.0);
            const dArmZ = THREE.MathUtils.clamp((lowerArm[2] - this.prevForeArm[2]) / dt, -4.0, 4.0);
            this.prevForeArm[0] = lowerArm[0];
            this.prevForeArm[1] = lowerArm[1];
            this.prevForeArm[2] = lowerArm[2];

            const velDecay = 1.0 - Math.exp(-10.0 * delta);
            this.wristVel[0] += (-dArmX * 0.028 - this.wristVel[0]) * velDecay;
            this.wristVel[2] += (-dArmZ * 0.032 - this.wristVel[2]) * velDecay;

            // Gerak organik halus (napas & relaksasi pergelangan tangan) agar tangan tidak pernah kaku
            const organicRoll = -0.028 + Math.sin(elapsed * 1.75 - 0.9) * 0.018 + this.wristVel[0];
            const organicYaw = 0.020 + Math.cos(elapsed * 1.25) * 0.012;
            const organicPitch = 0.022 + Math.sin(elapsed * 1.45 - 0.4) * 0.016 + this.wristVel[2];

            // Batasi sudut secara presisi agar tangan selalu menyatu di dalam garis manset putih
            const target = [
                THREE.MathUtils.clamp(base[0] * 0.55 + organicRoll, -0.22, 0.22),
                THREE.MathUtils.clamp(base[1] * 0.60 + organicYaw, -0.28, 0.28),
                THREE.MathUtils.clamp(base[2] * 0.55 + organicPitch, -0.32, 0.32),
            ];

            slerpBoneDirect(this.bone, target, lerpSpeed);

            this.currentRotation[0] += (target[0] - this.currentRotation[0]) * lerpSpeed;
            this.currentRotation[1] += (target[1] - this.currentRotation[1]) * lerpSpeed;
            this.currentRotation[2] += (target[2] - this.currentRotation[2]) * lerpSpeed;
        } catch (err) {
            console.warn("[NauraAnimation:LeftHand] Error updating left hand:", err.message);
        }
    }

    reset() {
        this.currentRotation = [0, 0, 0];
        this.prevForeArm = [0, 0, 0];
        this.wristVel = [0, 0, 0];
        if (this.bone) this.bone.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.bone = null;
    }
}
