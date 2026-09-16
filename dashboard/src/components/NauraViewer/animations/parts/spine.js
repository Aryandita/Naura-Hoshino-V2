/**
 * parts/spine.js - Pengendali Tulang Belakang, Dada, dan Pinggul (Spine, Chest & Hips).
 *
 * Mengendalikan:
 * 1. Rotasi sendi hips, spine, dan chest.
 * 2. Siklus pernapasan otonom alami (autonomous breathing ~0.3 Hz) pada dada dan tulang belakang.
 * 3. Postural sway / inersia tubuh saat berdiri atau berpindah animasi.
 * 4. Transformasi root model (posisi Y naik-turun saat bernapas atau meloncat).
 */

import { slerpBone } from "../core/interpolation.js";

export class SpineController {
    constructor(options = {}) {
        this.options = options;
        this.bones = {
            hips: null,
            spine: null,
            chest: null,
        };
        this.currentRotations = {
            hips: [0, 0, 0],
            spine: [0, 0, 0],
            chest: [0, 0, 0],
        };
        this.breathingRate = 0.35; // ~21 napas per menit (natural anime idle)
    }

    init(humanoidBones = {}) {
        this.bones.hips = humanoidBones.hips || null;
        this.bones.spine = humanoidBones.spine || null;
        this.bones.chest = humanoidBones.chest || null;
        this.reset();
    }

    update(delta, elapsed, context = {}) {
        try {
            const targetBones = context.targetBones || {};
            const isIdle = context.isIdle ?? true;
            const lerpSpeed = 1.0 - Math.exp(-12.0 * delta);

            // 1. Siklus pernapasan sinusoidal
            const breathCycle = Math.sin(elapsed * Math.PI * 2 * this.breathingRate);
            const breathChestRotX = isIdle ? breathCycle * 0.018 : 0;
            const breathSpineRotX = isIdle ? breathCycle * 0.009 : 0;

            // 2. Terapkan rotasi dada (Chest)
            if (this.bones.chest) {
                const base = targetBones.chest || [0, 0, 0];
                const targetX = base[0] + breathChestRotX;
                const targetY = base[1];
                const targetZ = base[2];

                this.currentRotations.chest[0] += (targetX - this.currentRotations.chest[0]) * lerpSpeed;
                this.currentRotations.chest[1] += (targetY - this.currentRotations.chest[1]) * lerpSpeed;
                this.currentRotations.chest[2] += (targetZ - this.currentRotations.chest[2]) * lerpSpeed;

                slerpBone(this.bones.chest, base, this.currentRotations.chest, 1.0);
            }

            // 3. Terapkan rotasi tulang belakang (Spine)
            if (this.bones.spine) {
                const base = targetBones.spine || [0, 0, 0];
                const targetX = base[0] + breathSpineRotX;
                const targetY = base[1];
                const targetZ = base[2];

                this.currentRotations.spine[0] += (targetX - this.currentRotations.spine[0]) * lerpSpeed;
                this.currentRotations.spine[1] += (targetY - this.currentRotations.spine[1]) * lerpSpeed;
                this.currentRotations.spine[2] += (targetZ - this.currentRotations.spine[2]) * lerpSpeed;

                slerpBone(this.bones.spine, base, this.currentRotations.spine, 1.0);
            }

            // 4. Terapkan rotasi pinggul (Hips)
            if (this.bones.hips) {
                const base = targetBones.hips || [0, 0, 0];
                this.currentRotations.hips[0] += (base[0] - this.currentRotations.hips[0]) * lerpSpeed;
                this.currentRotations.hips[1] += (base[1] - this.currentRotations.hips[1]) * lerpSpeed;
                this.currentRotations.hips[2] += (base[2] - this.currentRotations.hips[2]) * lerpSpeed;

                slerpBone(this.bones.hips, base, this.currentRotations.hips, 1.0);
            }
        } catch (err) {
            console.warn("[NauraAnimation:Spine] Error updating spine/chest kinematics:", err.message);
        }
    }

    reset() {
        this.currentRotations.hips = [0, 0, 0];
        this.currentRotations.spine = [0, 0, 0];
        this.currentRotations.chest = [0, 0, 0];
        if (this.bones.hips) this.bones.hips.rotation.set(0, 0, 0);
        if (this.bones.spine) this.bones.spine.rotation.set(0, 0, 0);
        if (this.bones.chest) this.bones.chest.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.bones.hips = null;
        this.bones.spine = null;
        this.bones.chest = null;
    }
}
