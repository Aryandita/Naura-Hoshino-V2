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

import { slerpBone, softClampAngle } from "../core/interpolation.js";

const LEG_KEYS = [
    "leftUpLeg",
    "rightUpLeg",
    "leftLeg",
    "rightLeg",
    "leftFoot",
    "rightFoot",
];

// Batas per sendi kaki pada sumbu rig [roll, yaw, pitch].
// Paha punya rentang gerak terbesar, telapak kaki paling kecil. Tanpa batas
// ini, sequence seperti AstralCast atau StarPose bisa memutar kaki menembus
// badan karena rotasi diteruskan mentah dari keyframe.
const LEG_LIMITS = {
    upLeg: { roll: [0.18, 0.26], yaw: [0.16, 0.24], pitch: [0.70, 1.00] },
    leg: { roll: [0.10, 0.16], yaw: [0.10, 0.16], pitch: [0.85, 1.20] },
    foot: { roll: [0.20, 0.30], yaw: [0.14, 0.22], pitch: [0.28, 0.42] },
};

/** Menentukan kelompok batas berdasarkan nama bone. */
function limitsFor(key) {
    if (key.endsWith("Foot")) return LEG_LIMITS.foot;
    if (key.endsWith("UpLeg")) return LEG_LIMITS.upLeg;
    return LEG_LIMITS.leg;
}

/**
 * Membatasi rotasi sendi kaki agar tidak menembus badan.
 * @param {string} key - Nama bone.
 * @param {number[]} rot - Rotasi [roll, yaw, pitch].
 * @returns {number[]} Rotasi setelah dijepit.
 */
function clampLeg(key, rot) {
    const lim = limitsFor(key);
    return [
        softClampAngle(rot[0], -lim.roll[0], lim.roll[0], -lim.roll[1], lim.roll[1]),
        softClampAngle(rot[1], -lim.yaw[0], lim.yaw[0], -lim.yaw[1], lim.yaw[1]),
        softClampAngle(rot[2], -lim.pitch[0], lim.pitch[0], -lim.pitch[1], lim.pitch[1]),
    ];
}

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
                const target = clampLeg(key, [base[0], base[1], base[2]]);

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
