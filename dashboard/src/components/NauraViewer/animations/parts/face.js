/**
 * parts/face.js - Pengendali Ekspresi Wajah & Morfologi Bibir (Facial Expression & Visemes).
 *
 * Mengendalikan:
 * 1. Blendshapes ekspresi emosional (Joy, Fun, Sorrow, Angry, Surprised).
 * 2. Transisi mulus antar ekspresi emosi (mood blending).
 * 3. Sinkronisasi bukaan bibir fonem vokal (A, I, U, E, O) untuk lip-sync suara.
 * 4. Kompatibilitas ganda VRM 0.x (blendShapeProxy) dan VRM 1.0 (expressionManager).
 */

const VRM1_EXPR_MAP = {
    Joy: "happy",
    Fun: "relaxed",
    Sorrow: "sad",
    Angry: "angry",
    Surprised: "surprised",
    A: "aa",
    I: "ih",
    U: "ou",
    E: "ee",
    O: "oh",
};

export class FaceController {
    constructor(options = {}) {
        this.vrm = null;
        this.options = options;
        this.activeMorphs = {};
        this.currentWeights = {};
        this.activeViseme = null;
        this.visemeIntensity = 0;
    }

    init(vrm) {
        this.vrm = vrm;
        this.reset();
    }

    /**
     * Set target blendshapes dari keyframe animasi atau mood.
     * @param {Record<string, number>} morphTargets
     */
    setMorphTargets(morphTargets = {}) {
        this.activeMorphs = { ...morphTargets };
    }

    /**
     * Sinkronisasi bukaan bibir (viseme) secara langsung.
     * @param {'A'|'I'|'U'|'E'|'O'|''} phoneme
     * @param {number} [intensity=1.0]
     */
    syncViseme(phoneme, intensity = 1.0) {
        this.activeViseme = phoneme ? String(phoneme).toUpperCase() : null;
        this.visemeIntensity = Math.max(0, Math.min(1, intensity));
    }

    update(delta, elapsed, context = {}) {
        try {
            if (!this.vrm) return;

            const lerpSpeed = 1.0 - Math.exp(-12.0 * delta);
            const targets = { ...this.activeMorphs };

            // Gabungkan bukaan viseme jika sedang aktif
            if (this.activeViseme) {
                targets[this.activeViseme] = Math.max(targets[this.activeViseme] || 0, this.visemeIntensity);
            }

            // Terapkan ke VRM
            for (const [name, targetVal] of Object.entries(targets)) {
                const current = this.currentWeights[name] || 0;
                const next = current + (targetVal - current) * lerpSpeed;
                this.currentWeights[name] = next;

                this._applyMorphValue(name, next);
            }
        } catch (err) {
            console.warn("[NauraAnimation:Face] Error updating facial morphs:", err.message);
        }
    }

    _applyMorphValue(name, val) {
        const clamped = Math.max(0, Math.min(1, val));
        if (this.vrm.blendShapeProxy) {
            try {
                this.vrm.blendShapeProxy.setValue(name, clamped);
            } catch (_) {}
        } else if (this.vrm.expressionManager) {
            const expr = VRM1_EXPR_MAP[name] || name.toLowerCase();
            try {
                this.vrm.expressionManager.setValue(expr, clamped);
            } catch (_) {}
        }
    }

    reset() {
        this.activeMorphs = {};
        this.activeViseme = null;
        this.visemeIntensity = 0;
        if (this.vrm) {
            for (const key of Object.keys(this.currentWeights)) {
                this._applyMorphValue(key, 0);
            }
        }
        this.currentWeights = {};
    }

    destroy() {
        this.reset();
        this.vrm = null;
    }
}
