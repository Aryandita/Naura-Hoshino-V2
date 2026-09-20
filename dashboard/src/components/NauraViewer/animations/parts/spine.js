/**
 * parts/spine.js - Pengendali Tulang Belakang Lumbal (Spine Kinematics).
 *
 * Mengendalikan secara eksklusif sendi spine (lumbal / lower thoracic):
 * 1. Rotasi sendi spine - kelenturan torso bawah.
 * 2. Siklus pernapasan sinusoidal ringan pada lumbal.
 * 3. Postural sway / counter-balance terhadap perbedaan elevasi lengan kiri & kanan.
 *
 * Catatan arsitektur modular:
 * - Sendi hips dikendalikan oleh parts/hips.js, chest oleh parts/chest.js,
 *   upperChest oleh parts/upperChest.js.
 * - Gerak tambahan dihitung dalam sumbu VRM lalu dikonversi ke sumbu rig GLB lewat vrmToRig().
 * Isolasi penuh: error di sini TIDAK mempengaruhi sendi lain.
 */

import { slerpBoneDirect } from "../core/interpolation.js";
import { vrmToRig, armElevation } from "../core/rigProfile.js";

export class SpineController {
    constructor(options = {}) {
        this.options = options;
        this.bone = null;
        this.currentRotation = [0, 0, 0];
        this.breathingRate = 0.35;
    }

    /**
     * Inisialisasi referensi bone dari peta humanoidBones.
     * @param {Record<string, THREE.Object3D>} humanoidBones
     */
    init(humanoidBones = {}) {
        this.bone = humanoidBones.spine || null;
        this.reset();
    }

    /**
     * Update loop per frame: lerp rotasi spine lumbal menuju target + napas ringan.
     * @param {number} delta
     * @param {number} elapsed
     * @param {{ targetBones: Record<string,number[]>, isIdle: boolean }} context
     */
    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            const isIdle = context.isIdle ?? true;
            const lerpSpeed = 1.0 - Math.exp(-7.5 * delta);

            const base = targetBones.spine || [0, 0, 0];

            // Napas ringan pada lumbal (lebih halus dari dada)
            const breathCycle = Math.sin(elapsed * Math.PI * 2 * this.breathingRate);
            const breathWeight = isIdle ? 1.0 : 0.55;
            const breathPitch = breathCycle * 0.009 * breathWeight;

            // Postural counter-balance: spine sedikit condong berlawanan dengan elevasi lengan
            const armDelta = armElevation(targetBones.rightUpperArm) - armElevation(targetBones.leftUpperArm);
            const posturalRoll = armDelta * 0.016;

            // [pitch, yaw, roll] (VRM) -> [roll, yaw, pitch] (rig)
            const extra = vrmToRig([breathPitch, 0, posturalRoll * 0.5]);

            const target = [
                base[0] + extra[0],
                base[1] + extra[1],
                base[2] + extra[2],
            ];

            slerpBoneDirect(this.bone, target, lerpSpeed);

            this.currentRotation[0] += (target[0] - this.currentRotation[0]) * lerpSpeed;
            this.currentRotation[1] += (target[1] - this.currentRotation[1]) * lerpSpeed;
            this.currentRotation[2] += (target[2] - this.currentRotation[2]) * lerpSpeed;
        } catch (err) {
            console.warn("[NauraAnimation:Spine] Error updating spine lumbal:", err.message);
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
