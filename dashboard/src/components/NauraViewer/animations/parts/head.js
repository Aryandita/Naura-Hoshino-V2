/**
 * parts/head.js - Pengendali Tengkorak Kepala (Head Kinematics).
 *
 * Mengendalikan secara eksklusif sendi head (cranium):
 * 1. Rotasi kepala terhadap pergerakan kursor mouse (look yaw/pitch/tilt).
 * 2. Gestur anggukan dan kemiringan imut kepala saat animasi.
 * 3. Batas sudut fisiologis kepala (mencegah rotasi tidak wajar).
 *
 * Catatan arsitektur modular:
 * - Sendi neck kini dikendalikan secara eksklusif oleh parts/neck.js (NeckController).
 * - Tracking kursor dihitung dalam sumbu VRM (x = pitch, y = yaw, z = roll) lalu dikonversi
 *   ke sumbu rig GLB (x = roll, y = yaw, z = pitch) lewat vrmToRig().
 * Isolasi penuh: error di sini TIDAK mempengaruhi leher, spine, atau sendi lain.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";
import { vrmToRig, RIG_LIMITS, clampToLimits } from "../core/rigProfile.js";

export class HeadController {
    constructor(options = {}) {
        this.options = options;
        this.headBone = null;
        this.restRotation = [0, 0, 0];
        this.currentRotation = [0, 0, 0];
    }

    /**
     * Inisialisasi referensi bone dari peta humanoidBones.
     * @param {Record<string, THREE.Object3D>} humanoidBones
     */
    init(humanoidBones = {}) {
        this.headBone = humanoidBones.head || null;
        this.reset();
    }

    /**
     * Update loop per frame: lerp rotasi kepala menuju target + tracking kursor.
     * @param {number} delta
     * @param {number} elapsed
     * @param {{ targetBones: Record<string,number[]>, lookYaw: number, lookPitch: number, headTilt: number, enableTracking: boolean }} context
     */
    update(delta, elapsed, context = {}) {
        if (!this.headBone) return;

        try {
            const targetBones = context.targetBones || {};
            const lookYaw = context.lookYaw || 0;
            const lookPitch = context.lookPitch || 0;
            const headTilt = context.headTilt || 0;
            const enableTracking = context.enableTracking ?? true;

            // Kepala bergerak lebih ekspresif dari leher (40-45% dari tracking total)
            const lerpSpeed = 1.0 - Math.exp(-8.5 * delta);

            const baseRot = targetBones.head || this.restRotation;

            const trackingPitch = enableTracking ? THREE.MathUtils.clamp(lookPitch * 0.40, -0.40, 0.40) : 0;
            const trackingYaw = enableTracking ? THREE.MathUtils.clamp(lookYaw * 0.45, -0.60, 0.60) : 0;
            // Kemiringan imut kepala (anime cute head-tilt)
            const trackingRoll = enableTracking ? THREE.MathUtils.clamp(headTilt * 0.35, -0.30, 0.30) : 0;

            // Sumbu VRM [pitch, yaw, roll] -> sumbu rig [roll, yaw, pitch]
            const tracking = vrmToRig([trackingPitch, trackingYaw, trackingRoll]);

            // Batas fisiologis kepala: roll 0.40 rad, yaw & pitch 45 derajat (~0.78 rad)
            const target = clampToLimits([
                baseRot[0] + tracking[0],
                baseRot[1] + tracking[1],
                baseRot[2] + tracking[2],
            ], RIG_LIMITS.head);

            slerpBoneDirect(this.headBone, target, lerpSpeed);

            this.currentRotation[0] += (target[0] - this.currentRotation[0]) * lerpSpeed;
            this.currentRotation[1] += (target[1] - this.currentRotation[1]) * lerpSpeed;
            this.currentRotation[2] += (target[2] - this.currentRotation[2]) * lerpSpeed;
        } catch (err) {
            console.warn("[NauraAnimation:Head] Error updating head kinematics:", err.message);
        }
    }

    reset() {
        this.currentRotation = [0, 0, 0];
        if (this.headBone) this.headBone.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.headBone = null;
    }
}
