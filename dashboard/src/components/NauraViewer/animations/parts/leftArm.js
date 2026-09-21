/**
 * parts/leftArm.js - Pengendali Lengan Kiri (Left Arm Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Bahu kiri (leftShoulder) - klavikula dan elevasi sekunder.
 * 2. Lengan atas kiri (leftUpperArm) - rotasi bahu utama.
 * 3. Lengan bawah / siku kiri (leftLowerArm) - fleksi siku.
 *
 * Isolasi penuh: kesalahan di file ini TIDAK mempengaruhi lengan kiri.
 * Batas sudut diambil dari RIG_LIMITS (sumbu rig GLB: X = samping, Y = twist, Z = maju).
 */

import { slerpBoneDirect } from "../core/interpolation.js";
import { RIG_LIMITS, clampToLimits } from "../core/rigProfile.js";
import { DEFAULT_REST_BONES } from "../core/constants.js";

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

    /**
     * Inisialisasi referensi bone dari peta humanoidBones.
     * @param {Record<string, THREE.Object3D>} humanoidBones
     */
    init(humanoidBones = {}) {
        for (const k of LEFT_ARM_KEYS) {
            this.bones[k] = humanoidBones[k] || null;
            this.currentRotations[k] = [0, 0, 0];
        }
    }

    /**
     * Update loop per frame: lerp rotasi lengan kiri menuju target keyframe.
     * @param {number} delta - Waktu antar frame (detik).
     * @param {number} elapsed - Waktu total berjalan (detik).
     * @param {{ targetBones: Record<string,number[]> }} context
     */
    update(delta, elapsed, context = {}) {
        const targetBones = context.targetBones || {};
        const baseLerp = 8.0;   // lengan atas & bahu: halus
        const elbowLerp = 13.0; // siku lebih responsif agar ayunan lambaian tidak teredam

        for (const key of LEFT_ARM_KEYS) {
            try {
                const bone = this.bones[key];
                if (!bone) continue;

                const lerpSpeed = 1.0 - Math.exp(-(key.endsWith("LowerArm") ? elbowLerp : baseLerp) * delta);

                const base = targetBones[key] || DEFAULT_REST_BONES[key] || [0, 0, 0];
                const current = this.currentRotations[key];
                const target = [base[0], base[1], base[2]];

                if (key === "leftUpperArm") clampToLimits(target, RIG_LIMITS.upperArm);
                if (key === "leftLowerArm") clampToLimits(target, RIG_LIMITS.lowerArm);

                // slerpBoneDirect: interpolasi langsung dari quaternion bone saat ini ke target
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
