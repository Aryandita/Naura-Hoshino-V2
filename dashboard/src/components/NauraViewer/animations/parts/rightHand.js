/**
 * parts/rightHand.js - Pengendali Pergelangan Tangan Kanan (Right Hand & Wrist Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Pergelangan tangan kanan (rightHand) - pose lambaian, peace, telapak menghadap.
 * 2. Harmonic wave oscillation (osilasi telapak tangan saat animasi Wave aktif).
 * 3. Batas sudut anatomis pergelangan agar tidak over-rotate.
 *
 * Isolasi penuh: error di file ini TIDAK mempengaruhi tangan kiri.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";

export class RightHandController {
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
        this.bone = humanoidBones.rightHand || null;
        this.reset();
    }

    /**
     * Update loop per frame: lerp rotasi tangan kanan menuju target keyframe.
     * Jika harmonics.rightHandZ aktif, tambahkan osilasi lambaian sinusoidal.
     * @param {number} delta - Waktu antar frame (detik).
     * @param {number} elapsed - Waktu total berjalan (detik).
     * @param {{ targetBones: Record<string,number[]>, harmonics: object|null, tNorm: number, duration: number }} context
     */
    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            const harmonics = context.harmonics || null;
            const dur = context.duration || 3.0;
            const tNorm = context.tNorm || 0;
            // pergelangan dibuat lebih responsif (14/dtk) agar ayunan tangan terlihat jelas
            const lerpSpeed = 1.0 - Math.exp(-14.0 * delta);

            const base = targetBones.rightHand || [0, 0, 0];
            let wristOffsetZ = 0;

            // Osilasi telapak tangan saat lambaian (harmonic wave)
            // Frekuensi 2.8 Hz agar terlihat alami dan energik
            if (
                harmonics &&
                harmonics.rightHandZ &&
                tNorm >= (harmonics.activeStart ?? 0) &&
                tNorm <= (harmonics.activeEnd ?? 1)
            ) {
                const oscTime = (tNorm - (harmonics.activeStart ?? 0)) * dur;
                wristOffsetZ = Math.sin(oscTime * (harmonics.freq ?? 2.8) - 0.4) * harmonics.rightHandZ;
            }

            const target = [
                THREE.MathUtils.clamp(base[0], -0.60, 0.60),
                THREE.MathUtils.clamp(base[1], -0.50, 0.50),
                THREE.MathUtils.clamp(base[2] + wristOffsetZ, -1.20, 1.20),
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
        if (this.bone) this.bone.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.bone = null;
    }
}
