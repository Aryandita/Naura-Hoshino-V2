/**
 * animations.js - Sistem animasi NauraViewer.
 *
 * Menyediakan tiga lapisan animasi:
 *   1. Procedural: idle breathing, micro-sway, auto-rotate
 *   2. Clip-based: animasi bawaan model (bila ada)
 *   3. Morph: ekspresi wajah via morph target (VRM) atau shape key (GLB)
 *
 * Semua animasi berjalan via AnimationMixer Three.js agar bisa di-blend.
 */

import * as THREE from 'three';

/**
 * Semua state animasi yang dikelola AnimationController.
 * @typedef {Object} AnimState
 * @property {THREE.AnimationMixer} mixer
 * @property {THREE.AnimationClip[]} clips
 * @property {THREE.AnimationAction | null} currentAction
 * @property {string} currentMood
 * @property {boolean} isWaving
 * @property {number} elapsedTime
 * @property {Object} procedural
 * @property {import('@pixiv/three-vrm').VRM | null} vrm
 */

/**
 * Buat AnimationController untuk model yang sudah dimuat.
 *
 * @param {THREE.Group} modelScene
 * @param {THREE.AnimationClip[]} clips
 * @param {import('@pixiv/three-vrm').VRM | null} vrm
 * @returns {AnimationController}
 */
export function createAnimationController(modelScene, clips, vrm) {
    const mixer = new THREE.AnimationMixer(modelScene);

    /** @type {AnimState} */
    const state = {
        mixer,
        clips,
        currentAction: null,
        currentMood: 'idle',
        isWaving: false,
        elapsedTime: 0,
        vrm,
        procedural: {
            // Posisi awal model untuk referensi breathing
            baseY: modelScene.position.y,
            // Rotasi awal untuk sway
            baseRotX: modelScene.rotation.x,
            baseRotZ: modelScene.rotation.z,
        },
    };

    // Coba mainkan animasi idle dari clip bawaan model bila ada
    const idleClip = clips.find((c) =>
        /idle|stand|breath/i.test(c.name),
    );
    if (idleClip) {
        state.currentAction = mixer.clipAction(idleClip);
        state.currentAction.play();
    }

    /**
     * Update animasi setiap frame.
     * @param {number} delta - detik sejak frame sebelumnya
     * @param {number} elapsed - total detik sejak init
     */
    function update(delta, elapsed) {
        state.elapsedTime = elapsed;
        mixer.update(delta);

        // Update VRM internal (morph target interpolation, spring bones, dll)
        if (vrm) {
            vrm.update(delta);
        }

        // Animasi procedural hanya bila tidak ada clip idle bawaan
        if (!idleClip) {
            applyProceduralIdle(modelScene, state, elapsed);
        }

        // Auto-rotate halus - selalu aktif kecuali user sedang drag
        if (!state.isWaving) {
            modelScene.rotation.y += 0.003;
        }
    }

    /**
     * Picu animasi wave saat diklik.
     * Fallback procedural bila tidak ada clip wave bawaan.
     */
    function triggerWave() {
        if (state.isWaving) return;
        state.isWaving = true;

        const waveClip = clips.find((c) => /wave|greet|hello|hai/i.test(c.name));

        if (waveClip) {
            const action = mixer.clipAction(waveClip);
            action.setLoop(THREE.LoopOnce, 1);
            action.reset().play();
            action.clampWhenFinished = true;

            const onFinish = () => {
                state.isWaving = false;
                mixer.removeEventListener('finished', onFinish);
                // Kembali ke idle bila ada
                if (idleClip && state.currentAction) state.currentAction.play();
            };
            mixer.addEventListener('finished', onFinish);
        } else {
            // Procedural wave: putar sumbu Z kanan-kiri 3 kali
            proceduralWave(modelScene, () => {
                state.isWaving = false;
            });
        }
    }

    /**
     * Set ekspresi/mood Naura.
     * Mendukung VRM morph target dan fallback postur.
     *
     * @param {'idle'|'happy'|'sad'|'surprised'|'angry'|'thinking'} mood
     */
    function setMood(mood) {
        state.currentMood = mood;

        if (vrm && vrm.expressionManager) {
            // Reset semua ekspresi dulu
            const expressions = ['happy', 'sad', 'surprised', 'angry', 'relaxed'];
            expressions.forEach((expr) => {
                try { vrm.expressionManager.setValue(expr, 0); } catch (_) { /* skip */ }
            });

            // Map mood ke nama ekspresi VRM standar
            const moodMap = {
                happy:     'happy',
                sad:       'sad',
                surprised: 'surprised',
                angry:     'angry',
                thinking:  'relaxed',
                idle:      null,
            };

            const expr = moodMap[mood];
            if (expr) {
                try { vrm.expressionManager.setValue(expr, 1.0); } catch (_) { /* skip */ }
            }
        } else {
            // Fallback: ubah kecepatan gerak berdasarkan mood
            applyMoodPosture(modelScene, mood);
        }
    }

    function destroy() {
        mixer.stopAllAction();
        mixer.uncacheRoot(modelScene);
    }

    return { update, triggerWave, setMood, destroy, getMixer: () => mixer };
}

// ─────────────────────────────────────────────
// Animasi Procedural Helpers
// ─────────────────────────────────────────────

/**
 * Breathing + micro-sway halus saat idle.
 */
function applyProceduralIdle(model, state, elapsed) {
    // Breathing: naik-turun perlahan
    model.position.y = state.procedural.baseY + Math.sin(elapsed * 0.8) * 0.025;

    // Micro-sway: goyang kanan-kiri sangat halus
    model.rotation.z = state.procedural.baseRotZ + Math.sin(elapsed * 0.4) * 0.008;
    model.rotation.x = state.procedural.baseRotX + Math.sin(elapsed * 0.3) * 0.005;
}

/**
 * Wave procedural: model berayun di sumbu Y.
 */
function proceduralWave(model, onDone) {
    const duration = 1600; // ms
    const startTime = performance.now();
    const baseRotY = model.rotation.y;

    function step() {
        const t = (performance.now() - startTime) / duration;
        if (t >= 1) {
            model.rotation.y = baseRotY;
            onDone();
            return;
        }
        // Gelombang sinus × envelope untuk ease in-out
        const envelope = Math.sin(t * Math.PI);
        model.rotation.y = baseRotY + Math.sin(t * Math.PI * 4) * 0.3 * envelope;
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/**
 * Ubah postur/scale berdasarkan mood sebagai fallback ekspresi.
 */
function applyMoodPosture(model, mood) {
    const moodScale = {
        happy:     { scale: 1.03, rotX: -0.05 },
        sad:       { scale: 0.97, rotX: 0.08  },
        surprised: { scale: 1.05, rotX: -0.1  },
        angry:     { scale: 1.02, rotX: 0.03  },
        thinking:  { scale: 1.0,  rotX: 0.06  },
        idle:      { scale: 1.0,  rotX: 0     },
    };

    const target = moodScale[mood] || moodScale.idle;

    // Smooth transition via lerp
    model.scale.x = THREE.MathUtils.lerp(model.scale.x, target.scale, 0.05);
    model.scale.y = THREE.MathUtils.lerp(model.scale.y, target.scale, 0.05);
    model.scale.z = THREE.MathUtils.lerp(model.scale.z, target.scale, 0.05);
}
