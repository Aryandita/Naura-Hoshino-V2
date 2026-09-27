/**
 * parts/leftHand.js - Pengendali Pergelangan Tangan Kiri (Left Hand & Wrist Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Pergelangan tangan kiri (leftHand) - pose alami: menopang, santai, gestur silang dada.
 * 2. Batas sudut anatomis: mencegah rotasi berlebih yang tidak realistis.
 *
 * Isolasi penuh: error di file ini TIDAK mempengaruhi tangan kanan.
 */

import { slerpBoneDirect } from "../core/interpolation.js";
import * as THREE from "three";

export class LeftHandController {
    constructor(options = {}) {
        this.options = options;
        this.bone = null;
        this.currentRotation = [0, 0, 0];
    }

    /**
     * Inisialisasi referensi bone dari peta humanoidBones.
     * @param {Record<string, THREE.Object3D>} humanoidBones
     */
    init(humanoidBones = {}) {
        this.bone = humanoidBones.leftHand || null;
        this.reset();
    }

    /**
     * Update loop per frame: lerp rotasi tangan kiri menuju target keyframe.
     * @param {number} delta - Waktu antar frame (detik).
     * @param {number} elapsed - Waktu total berjalan (detik).
     * @param {{ targetBones: Record<string,number[]> }} context
     */
    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            // pergelangan dibuat lebih responsif (14/dtk) agar ayunan tangan terlihat jelas
            const lerpSpeed = 1.0 - Math.exp(-14.0 * delta);

            const base = targetBones.leftHand || [0, 0, 0];
            const target = [
                THREE.MathUtils.clamp(base[0], -0.60, 0.60),
                THREE.MathUtils.clamp(base[1], -0.50, 0.50),
                THREE.MathUtils.clamp(base[2], -0.90, 0.90),
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
        if (this.bone) this.bone.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.bone = null;
    }
}
