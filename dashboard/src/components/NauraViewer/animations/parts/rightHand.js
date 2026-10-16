/**
 * parts/rightHand.js - Pengendali Pergelangan Tangan Kanan (Right Hand & Wrist Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Pergelangan tangan kanan (rightHand) - pose lambaian halus & wrist follow-through organik.
 * 2. Harmonic wave oscillation yang terkalibrasi agar pergelangan tangan tetap di dalam garis manset.
 * 3. Ayunan mikro sekunder mengikuti gerak siku (rightLowerArm) agar tangan luwes di semua animasi.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";

export class RightHandController {
    constructor(options = {}) {
        this.options = options;
        this.bone = null;
        this.currentRotation = [0, 0, 0];
        this.prevForeArm = [0, 0, 0];
        this.wristVel = [0, 0, 0];
    }

    init(humanoidBones = {}) {
        this.bone = humanoidBones.rightHand || null;
        this.reset();
    }

    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            const harmonics = context.harmonics || null;
            const dur = context.duration || 3.0;
            const tNorm = context.tNorm || 0;
            const lerpSpeed = 1.0 - Math.exp(-12.5 * delta);

            const base = targetBones.rightHand || [0, 0, 0];
            const lowerArm = targetBones.rightLowerArm || [0.115, -0.015, 0.025];

            // Efek follow-through natural saat lengan bawah bergerak atau melambai
            const dt = Math.max(0.008, delta);
            const dArmX = THREE.MathUtils.clamp((lowerArm[0] - this.prevForeArm[0]) / dt, -4.0, 4.0);
            const dArmZ = THREE.MathUtils.clamp((lowerArm[2] - this.prevForeArm[2]) / dt, -4.0, 4.0);
            this.prevForeArm[0] = lowerArm[0];
            this.prevForeArm[1] = lowerArm[1];
            this.prevForeArm[2] = lowerArm[2];

            const velDecay = 1.0 - Math.exp(-10.0 * delta);
            this.wristVel[0] += (-dArmX * 0.026 - this.wristVel[0]) * velDecay;
            this.wristVel[2] += (-dArmZ * 0.030 - this.wristVel[2]) * velDecay;

            let wristOffsetZ = 0;
            if (
                harmonics &&
                harmonics.rightHandZ &&
                tNorm >= (harmonics.activeStart ?? 0) &&
                tNorm <= (harmonics.activeEnd ?? 1)
            ) {
                const oscTime = (tNorm - (harmonics.activeStart ?? 0)) * dur;
                wristOffsetZ = Math.sin(oscTime * (harmonics.freq ?? 2.8) - 0.4) * (harmonics.rightHandZ * 0.45);
            }

            // Gerak mikro organik agar tangan kanan selalu hidup dan tidak kaku di seluruh animasi
            const organicRoll = 0.028 - Math.sin(elapsed * 1.75 - 0.9) * 0.018 + this.wristVel[0];
            const organicYaw = -0.020 - Math.cos(elapsed * 1.25) * 0.012;
            const organicPitch = 0.022 + Math.sin(elapsed * 1.45 - 0.4) * 0.016 + this.wristVel[2];

            // Batasi rotasi pergelangan tangan agar selalu sejajar dengan sumbu manset kemeja putih
            const target = [
                THREE.MathUtils.clamp(base[0] * 0.50 + organicRoll, -0.20, 0.20),
                THREE.MathUtils.clamp(base[1] * 0.55 + organicYaw, -0.26, 0.26),
                THREE.MathUtils.clamp(base[2] * 0.45 + wristOffsetZ + organicPitch, -0.25, 0.25),
            ];

            slerpBoneDirect(this.bone, target, lerpSpeed);

            this.currentRotation[0] += (target[0] - this.currentRotation[0]) * lerpSpeed;
            this.currentRotation[1] += (target[1] - this.currentRotation[1]) * lerpSpeed;
            this.currentRotation[2] += (target[2] - this.currentRotation[2]) * lerpSpeed;
        } catch (err) {
            console.warn("[NauraAnimation:RightHand] Error updating right hand:", err.message);
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
