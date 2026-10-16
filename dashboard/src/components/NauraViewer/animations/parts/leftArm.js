/**
 * parts/leftArm.js - Pengendali Lengan Kiri (Left Arm Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Bahu kiri (leftShoulder) - klavikula dan elevasi sekunder + napas organik.
 * 2. Lengan atas kiri (leftUpperArm) - rotasi bahu utama + postur rileks alami bila track kosong.
 * 3. Lengan bawah / siku kiri (leftLowerArm) - fleksi siku + ayunan mikro sekunder agar tidak kaku.
 */

import { slerpBoneDirect } from "../core/interpolation.js";
import { RIG_LIMITS, clampToLimits, armElevation, enforceArmClearance } from "../core/rigProfile.js";

const LEFT_ARM_KEYS = [
    "leftShoulder",
    "leftUpperArm",
    "leftLowerArm",
];

export class LeftArmController {
    constructor(options = {}) {
        this.options = options;
        this.bones = {};
        this.currentRotations = {};
        for (const k of LEFT_ARM_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    init(humanoidBones = {}) {
        for (const k of LEFT_ARM_KEYS) {
            this.bones[k] = humanoidBones[k] || null;
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    update(delta, elapsed, context = {}) {
        const targetBones = context.targetBones || {};
        const baseLerp = 9.0;
        const elbowLerp = 13.5;

        // Napas mikro organik agar lengan kiri tidak pernah membeku seperti patung
        const breathWave = Math.sin(elapsed * 1.75) * 0.012;
        const swayWave = Math.cos(elapsed * 1.15) * 0.010;

        // Postur default rileks alami bila sequence tidak menyertakan track lengan kiri (mis. Wave/BlowKiss/Sleepy)
        const hasUpperTrack = Array.isArray(targetBones.leftUpperArm);
        const hasLowerTrack = Array.isArray(targetBones.leftLowerArm);

        const rawUpper = hasUpperTrack
            ? targetBones.leftUpperArm
            : [-0.048 + breathWave * 0.5, -0.008, 0.015 + swayWave];
        const rawLower = hasLowerTrack
            ? targetBones.leftLowerArm
            : [-0.115 + breathWave * 0.4, 0.015, 0.025 + Math.sin(elapsed * 1.75 - 0.6) * 0.014];

        // Kopling klavikula otomatis saat lengan terangkat + napas bahu halus
        const elev = armElevation(rawUpper);
        const rawShoulder = targetBones.leftShoulder || [
            -Math.min(0.12, elev * 0.06) - Math.max(0, breathWave) * 0.4,
            0,
            0,
        ];

        const resolvedTargets = {
            leftShoulder: rawShoulder,
            leftUpperArm: [
                rawUpper[0] + (context.isIdle ? breathWave * 0.35 : 0),
                rawUpper[1],
                rawUpper[2] + (context.isIdle ? swayWave * 0.5 : 0),
            ],
            leftLowerArm: [
                rawLower[0] + (context.isIdle ? breathWave * 0.45 : 0),
                rawLower[1],
                rawLower[2] + (context.isIdle ? Math.sin(elapsed * 1.75 - 0.5) * 0.016 : 0),
            ],
        };

        const cleared = enforceArmClearance("left", resolvedTargets.leftUpperArm, resolvedTargets.leftLowerArm);
        resolvedTargets.leftUpperArm = cleared.upper;
        resolvedTargets.leftLowerArm = cleared.lower;

        for (const key of LEFT_ARM_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const lerpSpeed = 1.0 - Math.exp(-(key.endsWith("LowerArm") ? elbowLerp : baseLerp) * delta);
                const base = resolvedTargets[key] || [0, 0, 0];
                const current = this.currentRotations[key];
                const target = [base[0], base[1], base[2]];

                if (key === "leftUpperArm") clampToLimits(target, RIG_LIMITS.upperArm);
                if (key === "leftLowerArm") clampToLimits(target, RIG_LIMITS.lowerArm);

                slerpBoneDirect(bone, target, lerpSpeed);

                current[0] += (target[0] - current[0]) * lerpSpeed;
                current[1] += (target[1] - current[1]) * lerpSpeed;
                current[2] += (target[2] - current[2]) * lerpSpeed;
            } catch (err) {
                console.warn(`[NauraAnimation:LeftArm] Error updating ${key}:`, err.message);
            }
        }
    }

    reset() {
        for (const k of LEFT_ARM_KEYS) {
            this.currentRotations[k] = [0, 0, 0];
            if (this.bones[k]) this.bones[k].rotation.set(0, 0, 0);
        }
    }

    destroy() {
        this.reset();
        this.bones = {};
    }
}
