/**
 * parts/arms.js - Pengendali Sendi Lengan & Bahu (Shoulders & Arms Kinematics).
 *
 * Mengendalikan:
 * 1. Bahu kiri & kanan (leftShoulder, rightShoulder).
 * 2. Lengan atas kiri & kanan (leftUpperArm, rightUpperArm).
 * 3. Lengan bawah / siku kiri & kanan (leftLowerArm, rightLowerArm).
 * 4. Isolasi sendi independen: error pada satu sisi lengan tidak mempengaruhi sisi lainnya.
 */

import { slerpBone } from "../core/interpolation.js";

const ARM_KEYS = [
    "leftShoulder",
    "rightShoulder",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
];

export class ArmController {
    constructor(options = {}) {
        this.options = options;
        this.bones = {};
        this.currentRotations = {};
        for (const k of ARM_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    init(humanoidBones = {}) {
        for (const k of ARM_KEYS) {
            this.bones[k] = humanoidBones[k] || null;
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    update(delta, elapsed, context = {}) {
        const targetBones = context.targetBones || {};
        const lerpSpeed = 1.0 - Math.exp(-14.0 * delta);

        for (const key of ARM_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const base = targetBones[key] || [0, 0, 0];
                const current = this.currentRotations[key];

                current[0] += (base[0] - current[0]) * lerpSpeed;
                current[1] += (base[1] - current[1]) * lerpSpeed;
                current[2] += (base[2] - current[2]) * lerpSpeed;

                slerpBone(bone, base, current, 1.0);
            } catch (err) {
                console.warn(`[NauraAnimation:Arms] Error updating ${key}:`, err.message);
            }
        }
    }

    reset() {
        for (const k of ARM_KEYS) {
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
