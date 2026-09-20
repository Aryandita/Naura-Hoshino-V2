/**
 * parts/arms.js - Pengendali Sendi Lengan & Bahu (Shoulders & Arms Kinematics).
 *
 * Mengendalikan:
 * 1. Bahu kiri & kanan (leftShoulder, rightShoulder).
 * 2. Lengan atas kiri & kanan (leftUpperArm, rightUpperArm).
 * 3. Lengan bawah / siku kiri & kanan (leftLowerArm, rightLowerArm).
 * 4. Isolasi sendi independen: error pada satu sisi lengan tidak mempengaruhi sisi lainnya.
 *
 * Catatan rig GLB: nilai keyframe memakai sumbu lokal rig (X = samping, Y = twist, Z = maju),
 * sehingga batas sudut diambil dari RIG_LIMITS (rigProfile.js), bukan batas pitch VRM lama.
 */

import { slerpBone } from "../core/interpolation.js";
import { RIG_LIMITS, clampToLimits } from "../core/rigProfile.js";

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
        // Gaya gerak realistis berbasis fisika (smooth exponential decay)
        const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);

        for (const key of ARM_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const base = targetBones[key] || [0, 0, 0];
                const current = this.currentRotations[key];
                const target = [base[0], base[1], base[2]];

                // Batas keselamatan lebar: cukup untuk pose lengan terangkat (Cheers / AstralCast),
                // tetapi tetap mencegah nilai liar yang membalik tulang.
                if (key === "rightUpperArm" || key === "leftUpperArm") {
                    clampToLimits(target, RIG_LIMITS.upperArm);
                } else if (key === "rightLowerArm" || key === "leftLowerArm") {
                    clampToLimits(target, RIG_LIMITS.lowerArm);
                }

                // SLERP bertahap dari rotasi saat ini menuju target keyframe yang telah disanitasi
                slerpBone(bone, current, target, lerpSpeed);

                current[0] += (target[0] - current[0]) * lerpSpeed;
                current[1] += (target[1] - current[1]) * lerpSpeed;
                current[2] += (target[2] - current[2]) * lerpSpeed;
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
