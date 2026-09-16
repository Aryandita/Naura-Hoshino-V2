/**
 * animations/index.js - Entry point utama sistem animasi modular Naura Hoshino.
 *
 * Mengelompokkan seluruh sub-sistem per bagian tubuh ke dalam modul mandiri:
 * - /core/         : Logika utama, interpolasi, konstanta
 * - /parts/        : Sub-modul per organ gerak (eyes, blink, hair, head, face, spine, arms, hands, legs)
 * - /sequences/    : Keyframe multi-fase per jenis animasi aksi
 */

export { AnimationController, createAnimationController } from "./core/controller.js";
export {
    SUPPORTED_ANIMATIONS,
    ACTION_DURATIONS,
    DEFAULT_REST_BONES,
    HUMANOID_BONE_KEYS,
} from "./core/constants.js";
export {
    smootherStep,
    lerpEuler,
    lerpScalar,
    slerpBone,
    evaluateTrack,
} from "./core/interpolation.js";

// Export part controllers agar bisa dites / diisolasi secara mandiri
export { EyeController } from "./parts/eyes.js";
export { BlinkController } from "./parts/blink.js";
export { HairController } from "./parts/hair.js";
export { HeadController } from "./parts/head.js";
export { FaceController } from "./parts/face.js";
export { SpineController } from "./parts/spine.js";
export { ArmController } from "./parts/arms.js";
export { HandController } from "./parts/hands.js";
export { LegController } from "./parts/legs.js";

// Export sequences
export { ANIMATION_DEFINITIONS } from "./sequences/index.js";

/**
 * Utilitas helper kompatibel untuk sinkronisasi viseme morphs
 */
export function syncVisemes(vrm, phoneme, intensity = 1.0) {
    if (!vrm) return;
    const v = String(phoneme || "").toUpperCase();
    const clamped = Math.max(0, Math.min(1, intensity));

    if (vrm.blendShapeProxy) {
        for (const k of ["A", "I", "U", "E", "O"]) {
            try {
                vrm.blendShapeProxy.setValue(k, k === v ? clamped : 0);
            } catch (_) {}
        }
    } else if (vrm.expressionManager) {
        const vrm1Map = { A: "aa", I: "ih", U: "ou", E: "ee", O: "oh" };
        for (const [k, expr] of Object.entries(vrm1Map)) {
            try {
                vrm.expressionManager.setValue(expr, k === v ? clamped : 0);
            } catch (_) {}
        }
    }
}
