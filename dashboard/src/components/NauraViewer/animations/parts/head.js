/**
 * parts/head.js - Pengendali Sendi Kepala & Leher (Head & Neck Kinematics).
 *
 * Mengendalikan:
 * 1. Rotasi tulang leher (neck) dan kepala (head).
 * 2. Respons halus terhadap pergerakan kursor mouse (look yaw/pitch/tilt).
 * 3. Batas sudut fisiologis anatomis (mencegah patah leher tidak wajar).
 * 4. Harmonic micro-tilt saat idle dan aksi geleng/angguk kepala.
 */

import * as THREE from "three";
import { slerpBone } from "../core/interpolation.js";

export class HeadController {
    constructor(options = {}) {
        this.options = options;
        this.neckBone = null;
        this.headBone = null;
        this.restRotations = {
            neck: [0, 0, 0],
            head: [0, 0, 0],
        };
        this.currentRotations = {
            neck: [0, 0, 0],
            head: [0, 0, 0],
        };
    }

    init(humanoidBones = {}) {
        this.neckBone = humanoidBones.neck || null;
        this.headBone = humanoidBones.head || null;
        this.reset();
    }

    update(delta, elapsed, context = {}) {
        try {
            const targetBones = context.targetBones || {};
            const lookYaw = context.lookYaw || 0;
            const lookPitch = context.lookPitch || 0;
            const headTilt = context.headTilt || 0;
            const enableTracking = context.enableTracking ?? true;

            const lerpSpeed = 1.0 - Math.exp(-14.0 * delta);

            // 1. Hitung rotasi kepala dari keyframe + cursor tracking offset
            if (this.headBone) {
                const baseRot = targetBones.head || this.restRotations.head;
                const trackingX = enableTracking ? THREE.MathUtils.clamp(lookPitch * 0.40, -0.4, 0.4) : 0;
                const trackingY = enableTracking ? THREE.MathUtils.clamp(lookYaw * 0.45, -0.6, 0.6) : 0;
                const trackingZ = enableTracking ? THREE.MathUtils.clamp(headTilt * 0.35, -0.3, 0.3) : 0;

                const targetX = baseRot[0] + trackingX;
                const targetY = baseRot[1] + trackingY;
                const targetZ = baseRot[2] + trackingZ;

                this.currentRotations.head[0] += (targetX - this.currentRotations.head[0]) * lerpSpeed;
                this.currentRotations.head[1] += (targetY - this.currentRotations.head[1]) * lerpSpeed;
                this.currentRotations.head[2] += (targetZ - this.currentRotations.head[2]) * lerpSpeed;

                slerpBone(this.headBone, baseRot, this.currentRotations.head, 1.0);
            }

            // 2. Hitung rotasi leher
            if (this.neckBone) {
                const baseRot = targetBones.neck || this.restRotations.neck;
                const trackingX = enableTracking ? THREE.MathUtils.clamp(lookPitch * 0.20, -0.2, 0.2) : 0;
                const trackingY = enableTracking ? THREE.MathUtils.clamp(lookYaw * 0.25, -0.35, 0.35) : 0;
                const trackingZ = enableTracking ? THREE.MathUtils.clamp(headTilt * 0.15, -0.15, 0.15) : 0;

                const targetX = baseRot[0] + trackingX;
                const targetY = baseRot[1] + trackingY;
                const targetZ = baseRot[2] + trackingZ;

                this.currentRotations.neck[0] += (targetX - this.currentRotations.neck[0]) * lerpSpeed;
                this.currentRotations.neck[1] += (targetY - this.currentRotations.neck[1]) * lerpSpeed;
                this.currentRotations.neck[2] += (targetZ - this.currentRotations.neck[2]) * lerpSpeed;

                slerpBone(this.neckBone, baseRot, this.currentRotations.neck, 1.0);
            }
        } catch (err) {
            console.warn("[NauraAnimation:Head] Error updating head/neck kinematics:", err.message);
        }
    }

    reset() {
        this.currentRotations.neck = [0, 0, 0];
        this.currentRotations.head = [0, 0, 0];
        if (this.headBone) this.headBone.rotation.set(0, 0, 0);
        if (this.neckBone) this.neckBone.rotation.set(0, 0, 0);
    }

    destroy() {
        this.reset();
        this.neckBone = null;
        this.headBone = null;
    }
}
