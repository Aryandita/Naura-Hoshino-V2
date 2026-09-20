/**
 * parts/neck.js - Pengendali Leher Servikal (Neck Kinematics).
 *
 * Mengendalikan secara eksklusif:
 * 1. Rotasi sendi neck (cervical spine).
 * 2. Antisipasi sudut kepala: leher bergerak sedikit lebih awal sebelum kepala
 *    (lead-lag relationship untuk gerakan alami anime).
 * 3. Cursor tracking offset sebesar 25-40% dari total tracking kepala.
 * 4. Batas fisiologis ketat: mencegah "patah leher" (max +/-35 deg).
 *
 * Tracking dihitung dalam sumbu VRM (x = pitch, y = yaw, z = roll) lalu dikonversi
 * ke sumbu rig GLB (x = roll, y = yaw, z = pitch) lewat vrmToRig().
 * Isolasi penuh: error di sini TIDAK mempengaruhi head, spine, atau upperChest.
 */

import * as THREE from "three";
import { slerpBoneDirect } from "../core/interpolation.js";
import { vrmToRig, RIG_LIMITS, clampToLimits } from "../core/rigProfile.js";

export class NeckController {
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
        this.bone = humanoidBones.neck || null;
        this.reset();
    }

    /**
     * Update loop per frame: lerp rotasi leher menuju target + tracking parsial kursor.
     * @param {number} delta
     * @param {number} elapsed
     * @param {{ targetBones: Record<string,number[]>, lookYaw: number, lookPitch: number, headTilt: number, enableTracking: boolean }} context
     */
    update(delta, elapsed, context = {}) {
        if (!this.bone) return;

        try {
            const targetBones = context.targetBones || {};
            const lookYaw = context.lookYaw || 0;
            const lookPitch = context.lookPitch || 0;
            const headTilt = context.headTilt || 0;
            const enableTracking = context.enableTracking ?? true;

            // Leher bergerak lebih lambat dan kecil dari kepala (25-40% dari tracking total)
            const lerpSpeed = 1.0 - Math.exp(-7.0 * delta);

            const baseRot = targetBones.neck || [0, 0, 0];

            const trackingPitch = enableTracking ? THREE.MathUtils.clamp(lookPitch * 0.20, -0.20, 0.20) : 0;
            const trackingYaw = enableTracking ? THREE.MathUtils.clamp(lookYaw * 0.25, -0.35, 0.35) : 0;
            const trackingRoll = enableTracking ? THREE.MathUtils.clamp(headTilt * 0.15, -0.15, 0.15) : 0;

            // Sumbu VRM [pitch, yaw, roll] -> sumbu rig [roll, yaw, pitch]
            const tracking = vrmToRig([trackingPitch, trackingYaw, trackingRoll]);

            // Batas fisiologis leher: yaw & pitch 35 derajat (~0.61 rad), roll 0.35 rad
            const target = clampToLimits([
                baseRot[0] + tracking[0],
                baseRot[1] + tracking[1],
                baseRot[2] + tracking[2],
            ], RIG_LIMITS.neck);

            slerpBoneDirect(this.bone, target, lerpSpeed);

            this.currentRotation[0] += (target[0] - this.currentRotation[0]) * lerpSpeed;
            this.currentRotation[1] += (target[1] - this.currentRotation[1]) * lerpSpeed;
            this.currentRotation[2] += (target[2] - this.currentRotation[2]) * lerpSpeed;
        } catch (err) {
            console.warn("[NauraAnimation:Neck] Error updating neck kinematics:", err.message);
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
