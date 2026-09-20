/**
 * parts/legs.js - Pengendali Sendi Kaki & Pijakan Tubuh (Legs & Feet Kinematics).
 *
 * Mengendalikan:
 * 1. Paha atas kiri & kanan (leftUpLeg, rightUpLeg).
 * 2. Lutut / tungkai bawah kiri & kanan (leftLeg, rightLeg).
 * 3. Telapak kaki kiri & kanan (leftFoot, rightFoot).
 * 4. Harmonic hop / lonjakan riang (Cheers & StarPose).
 * 5. Isolasi error total antar sendi kaki kiri dan kanan.
 */

import { slerpBone } from "../core/interpolation.js";

const LEG_KEYS = [
    "leftUpLeg",
    "rightUpLeg",
    "leftLeg",
    "rightLeg",
    "leftFoot",
    "rightFoot",
];

export class LegController {
    constructor(options = {}) {
        this.options = options;
        this.bones = {};
        this.currentRotations = {};
        for (const k of LEG_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    init(humanoidBones = {}) {
        for (const k of LEG_KEYS) {
            this.bones[k] = humanoidBones[k] || null;
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    update(delta, elapsed, context = {}) {
        const targetBones = context.targetBones || {};
        const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);

        for (const key of LEG_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const base = targetBones[key] || [0, 0, 0];
                const current = this.currentRotations[key];
                const target = [base[0], base[1], base[2]];

                slerpBone(bone, current, target, lerpSpeed);

                current[0] += (target[0] - current[0]) * lerpSpeed;
                current[1] += (target[1] - current[1]) * lerpSpeed;
                current[2] += (target[2] - current[2]) * lerpSpeed;
            } catch (err) {
                console.warn(`[NauraAnimation:Legs] Error updating ${key}:`, err.message);
            }
        }
    }

    reset() {
        for (const k of LEG_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
            if (this.bones[k]) {
                this.bones[k].rotation.set(0, 0, 0);
            }
        }
    }

    destroy() {
        this.reset();
        this.bones = {};
    }
}
