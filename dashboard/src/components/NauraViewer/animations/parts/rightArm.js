/**
 * parts/rightArm.js - Pengendali Lengan Kanan (Right Arm Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Bahu kanan (rightShoulder) - klavikula dan elevasi sekunder + napas organik.
 * 2. Lengan atas kanan (rightUpperArm) - rotasi bahu utama (pose Wave/Cheers).
 * 3. Lengan bawah / siku kanan (rightLowerArm) - fleksi siku aktif + ayunan mikro sekunder.
 */

import { slerpBoneDirect } from "../core/interpolation.js";
import { RIG_LIMITS, clampToLimits, armElevation } from "../core/rigProfile.js";

const RIGHT_ARM_KEYS = [
    "rightShoulder",
    "rightUpperArm",
    "rightLowerArm",
];

export class RightArmController {
    constructor(options = {}) {
        this.options = options;
        this.bones = {};
        this.currentRotations = {};
        for (const k of RIGHT_ARM_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    init(humanoidBones = {}) {
        for (const k of RIGHT_ARM_KEYS) {
            this.bones[k] = humanoidBones[k] || null;
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    update(delta, elapsed, context = {}) {
        const targetBones = context.targetBones || {};
        const baseLerp = 9.0;
        const elbowLerp = 13.5;

        const breathWave = Math.sin(elapsed * 1.75) * 0.012;
        const swayWave = Math.cos(elapsed * 1.15) * 0.010;

        const hasUpperTrack = Array.isArray(targetBones.rightUpperArm);
        const hasLowerTrack = Array.isArray(targetBones.rightLowerArm);

        const rawUpper = hasUpperTrack
            ? targetBones.rightUpperArm
            : [0.048 - breathWave * 0.5, 0.008, 0.015 - swayWave];
        const rawLower = hasLowerTrack
            ? targetBones.rightLowerArm
            : [0.115 - breathWave * 0.4, -0.015, 0.025 + Math.sin(elapsed * 1.75 - 0.6) * 0.014];

        const elev = armElevation(rawUpper);
        const rawShoulder = targetBones.rightShoulder || [
            Math.min(0.12, elev * 0.06) + Math.max(0, breathWave) * 0.4,
            0,
            0,
        ];

        const resolvedTargets = {
            rightShoulder: rawShoulder,
            rightUpperArm: [
                rawUpper[0] - (context.isIdle ? breathWave * 0.35 : 0),
                rawUpper[1],
                rawUpper[2] - (context.isIdle ? swayWave * 0.5 : 0),
            ],
            rightLowerArm: [
                rawLower[0] - (context.isIdle ? breathWave * 0.45 : 0),
                rawLower[1],
                rawLower[2] + (context.isIdle ? Math.sin(elapsed * 1.75 - 0.5) * 0.016 : 0),
            ],
        };

        for (const key of RIGHT_ARM_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const lerpSpeed = 1.0 - Math.exp(-(key.endsWith("LowerArm") ? elbowLerp : baseLerp) * delta);
                const base = resolvedTargets[key] || [0, 0, 0];
                const current = this.currentRotations[key];
                const target = [base[0], base[1], base[2]];

                if (key === "rightUpperArm") clampToLimits(target, RIG_LIMITS.upperArm);
                if (key === "rightLowerArm") clampToLimits(target, RIG_LIMITS.lowerArm);

                slerpBoneDirect(bone, target, lerpSpeed);

                current[0] += (target[0] - current[0]) * lerpSpeed;
                current[1] += (target[1] - current[1]) * lerpSpeed;
                current[2] += (target[2] - current[2]) * lerpSpeed;
            } catch (err) {
                console.warn(`[NauraAnimation:RightArm] Error updating ${key}:`, err.message);
            }
        }
    }

    reset() {
        for (const k of RIGHT_ARM_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
            if (this.bones[k]) this.bones[k].rotation.set(0, 0, 0);
        }
    }

    destroy() {
        this.reset();
        this.bones = {};
    }
}
