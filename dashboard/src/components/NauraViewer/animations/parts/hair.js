/**
 * parts/hair.js - Pengendali Fisika Rambut & Kuncir (Hair & Ponytail Physics).
 *
 * Mengendalikan:
 * 1. Fisika Pegas-Peredam (Spring-Damper) untuk tulang kuncir kuda (Ponytail).
 * 2. Ayunan sekunder dinamis (secondary motion) mengikuti gerakan kepala dan inersia tubuh.
 * 3. Koordinasi dengan VRM SpringBoneManager agar tidak terjadi benturan simulasi fisika ganda.
 * 4. Isolasi error total: kegagalan simulasi rambut tidak menghentikan artikulasi sendi lainnya.
 */

import * as THREE from "three";

export class HairController {
    constructor(options = {}) {
        this.vrm = null;
        this.options = options;
        this.ponytailBone = null;
        this.restQuaternion = new THREE.Quaternion();

        // Parameter fisika pegas
        this.physics = {
            stiffness: 85.0,
            damping: 9.0,
            angleY: 0,
            velY: 0,
            angleZ: 0,
            velZ: 0,
        };

        this._euler = new THREE.Euler();
        this._quat = new THREE.Quaternion();
    }

    init(vrm, modelScene) {
        this.vrm = vrm;
        this.ponytailBone = null;

        try {
            if (modelScene) {
                // Cari tulang kuncir / ponytail pada hierarki
                modelScene.traverse((node) => {
                    if (node.isBone && /ponytail|hair_back|tail/i.test(node.name)) {
                        this.ponytailBone = node;
                        this.restQuaternion.copy(node.quaternion);
                    }
                });
            }
        } catch (err) {
            console.warn("[NauraAnimation:Hair] Failed searching ponytail bone:", err.message);
        }
    }

    update(delta, elapsed, context = {}) {
        try {
            if (!this.ponytailBone) return;

            // Jika VRM memiliki SpringBoneManager aktif, kurangi intensitas simulasi manual
            const hasSpringBones = Boolean(this.vrm?.springBoneManager);
            const intensity = hasSpringBones ? 0.35 : 1.0;

            const lookYaw = context.lookYaw || 0;
            const lookPitch = context.lookPitch || 0;

            const targetAngleY = (-lookYaw * 0.25 + Math.sin(elapsed * 1.8) * 0.03) * intensity;
            const targetAngleZ = (-lookPitch * 0.20 + Math.cos(elapsed * 1.2) * 0.02) * intensity;

            const forceY = (targetAngleY - this.physics.angleY) * this.physics.stiffness - this.physics.velY * this.physics.damping;
            this.physics.velY += forceY * delta;
            this.physics.angleY += this.physics.velY * delta;

            const forceZ = (targetAngleZ - this.physics.angleZ) * this.physics.stiffness - this.physics.velZ * this.physics.damping;
            this.physics.velZ += forceZ * delta;
            this.physics.angleZ += this.physics.velZ * delta;

            this._euler.set(
                Math.sin(elapsed * 1.5) * 0.03 * intensity,
                this.physics.angleY,
                this.physics.angleZ,
                "YXZ"
            );

            this._quat.setFromEuler(this._euler);
            this.ponytailBone.quaternion.copy(this.restQuaternion).multiply(this._quat);
        } catch (err) {
            console.warn("[NauraAnimation:Hair] Error updating hair physics:", err.message);
        }
    }

    reset() {
        this.physics.angleY = 0;
        this.physics.velY = 0;
        this.physics.angleZ = 0;
        this.physics.velZ = 0;
        if (this.ponytailBone) {
            this.ponytailBone.quaternion.copy(this.restQuaternion);
        }
    }

    destroy() {
        this.reset();
        this.vrm = null;
        this.ponytailBone = null;
    }
}
