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

import * as THREE from "three";

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
 * @param {Object} [options={}]
 * @param {boolean} [options.lookAtCursor=false] - Bila true, auto-rotate dimatikan agar tidak konflik dengan bone cursor tracking
 * @returns {AnimationController}
 */
export function createAnimationController(modelScene, clips, vrm, options = {}) {
    const { lookAtCursor = false, autoRotate = false } = options;
    const mixer = new THREE.AnimationMixer(modelScene);

    /** @type {AnimState} */
    const state = {
        mixer,
        clips,
        currentAction: null,
        currentMood: "idle",
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
    const idleClip = clips.find((c) => /idle|stand|breath/i.test(c.name));
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

        // Update VRM internal (spring bones, morphs, lookAt)
        if (vrm) {
            vrm.update(delta);
        }

        // Terapkan lapisan pernapasan dan micro-sway prosedural secara aditif dan kontinu
        applyProceduralBreathing(modelScene, state, elapsed, Boolean(idleClip));

        // Auto-rotate halus bila diizinkan dan kursor tidak sedang di-track
        if (!state.isWaving && !lookAtCursor && autoRotate) {
            modelScene.rotation.y += 0.002;
        }
    }

    /**
     * Mainkan animation clip berdasarkan nama dengan cross-fade halus.
     * @param {string} name - Nama animasi ('Idle', 'Wave', 'Thinking', 'Dizzy', 'Cheers', 'Shy', 'Sleepy', 'BlowKiss')
     * @param {Object} [options={}]
     * @param {boolean} [options.loop=false] - Apakah animasi mengulang terus
     * @param {number} [options.fadeDuration=0.35] - Durasi transisi cross-fade dalam detik
     * @param {Function} [options.onFinish] - Callback saat animasi selesai
     */
    function playClip(name, options = {}) {
        const { loop = false, fadeDuration = 0.45, onFinish } = options;
        const targetRegex = new RegExp(`^${name}$|${name}`, "i");
        const clip = clips.find((c) => targetRegex.test(c.name));

        if (!clip) {
            console.warn(`[Naura3D] Animasi clip '${name}' tidak ditemukan di model.`);
            return null;
        }

        const newAction = mixer.clipAction(clip);
        if (state.currentAction === newAction && state.currentAction.isRunning()) {
            return newAction;
        }

        newAction.reset();
        if (loop) {
            newAction.setLoop(THREE.LoopRepeat, Infinity);
            newAction.clampWhenFinished = false;
        } else {
            newAction.setLoop(THREE.LoopOnce, 1);
            newAction.clampWhenFinished = true;
        }

        if (state.currentAction && state.currentAction !== newAction) {
            newAction.crossFadeFrom(state.currentAction, fadeDuration, true);
        }
        newAction.play();

        state.currentAction = newAction;

        if (!loop) {
            const handleFinish = (e) => {
                if (e.action === newAction) {
                    mixer.removeEventListener("finished", handleFinish);
                    if (typeof onFinish === "function") onFinish();
                    // Kembalikan ke Idle secara halus otomatis
                    if (idleClip) {
                        const idleAction = mixer.clipAction(idleClip);
                        idleAction.reset();
                        idleAction.setLoop(THREE.LoopRepeat, Infinity);
                        idleAction.crossFadeFrom(newAction, fadeDuration, true);
                        idleAction.play();
                        state.currentAction = idleAction;
                    }
                }
            };
            mixer.addEventListener("finished", handleFinish);
        }

        return newAction;
    }

    /**
     * Picu animasi wave saat diklik atau disapa.
     */
    function triggerWave() {
        if (state.isWaving) return;
        state.isWaving = true;

        const action = playClip("Wave", {
            loop: false,
            fadeDuration: 0.3,
            onFinish: () => {
                state.isWaving = false;
            },
        });

        if (!action) {
            proceduralWave(modelScene, () => {
                state.isWaving = false;
            });
        }
    }

    /**
     * Set ekspresi/mood Naura dan jalankan animasi gerakan yang sesuai.
     * @param {string} mood
     */
    function setMood(mood) {
        state.currentMood = mood;
        const norm = (mood || "").toLowerCase();

        // 1. Sinkronisasi dengan animation clips gerakan tubuh
        const animMap = {
            wave: "Wave",
            welcome: "Wave",
            happy: "Wave",
            thinking: "Thinking",
            processing: "Thinking",
            loading: "Thinking",
            confused: "Dizzy",
            dizzy: "Dizzy",
            pusing: "Dizzy",
            cheers: "Cheers",
            celebrate: "Cheers",
            levelup: "Cheers",
            shy: "Shy",
            sleepy: "Sleepy",
            afk: "Sleepy",
            cooldown: "Sleepy",
            blowkiss: "BlowKiss",
            love: "BlowKiss",
            romance: "BlowKiss",
            idle: "Idle",
        };

        const targetAnim = animMap[norm];
        if (targetAnim) {
            const isLooping = targetAnim === "Idle" || targetAnim === "Dizzy" || targetAnim === "Sleepy";
            playClip(targetAnim, { loop: isLooping, fadeDuration: 0.4 });
        }

        // 2. VRM support (bila menggunakan avatar VRM)
        if (vrm && vrm.expressionManager) {
            const expressions = ["happy", "sad", "surprised", "angry", "relaxed", "neutral"];
            expressions.forEach((expr) => {
                try {
                    vrm.expressionManager.setValue(expr, 0);
                } catch (_) {}
            });

            const moodMap = {
                happy: "happy",
                cheers: "happy",
                read: "happy",
                sad: "sad",
                cry: "sad",
                surprised: "surprised",
                shocked: "surprised",
                angry: "angry",
                hmph: "angry",
                annoy: "angry",
                thinking: "relaxed",
                confused: "relaxed",
                dizzy: "relaxed",
                talk: "happy",
                idle: null,
            };

            const expr = moodMap[norm];
            if (expr) {
                try {
                    vrm.expressionManager.setValue(expr, 1.0);
                } catch (_) {}
            }
        } else {
            applyMoodPosture(modelScene, norm);
        }
    }

    function destroy() {
        mixer.stopAllAction();
        mixer.uncacheRoot(modelScene);
    }

    return { update, triggerWave, playClip, setMood, destroy, getMixer: () => mixer };
}

// ─────────────────────────────────────────────
// Animasi Procedural Helpers
// ─────────────────────────────────────────────

/**
 * Breathing harmonik ganda + micro-sway lembut saat idle maupun klip bergerak.
 */
function applyProceduralBreathing(model, state, elapsed, hasIdleClip) {
    if (hasIdleClip) {
        // Lapisan aditif halus saat klip animasi sedang berjalan
        const primaryBreath = Math.sin(elapsed * 1.5) * 0.008;
        const secondaryBreath = Math.sin(elapsed * 3.0) * 0.003;
        model.position.y = state.procedural.baseY + primaryBreath + secondaryBreath;

        // Micro-sway halus
        model.rotation.z = state.procedural.baseRotZ + Math.sin(elapsed * 0.6) * 0.004;
        model.rotation.x = state.procedural.baseRotX + Math.cos(elapsed * 0.4) * 0.003;
    } else {
        // Pernapasan penuh bila tidak ada klip idle
        model.position.y = state.procedural.baseY + Math.sin(elapsed * 1.2) * 0.022;
        model.rotation.z = state.procedural.baseRotZ + Math.sin(elapsed * 0.5) * 0.008;
        model.rotation.x = state.procedural.baseRotX + Math.sin(elapsed * 0.35) * 0.005;
    }
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
 * Ubah postur/scale berdasarkan mood sebagai fallback ekspresi dengan transisi lerp halus.
 */
function applyMoodPosture(model, mood) {
    const moodScale = {
        happy: { scale: 1.02, rotX: -0.04 },
        cheers: { scale: 1.03, rotX: -0.05 },
        sad: { scale: 0.98, rotX: 0.06 },
        cry: { scale: 0.97, rotX: 0.08 },
        surprised: { scale: 1.03, rotX: -0.08 },
        shocked: { scale: 1.03, rotX: -0.08 },
        angry: { scale: 1.02, rotX: 0.02 },
        thinking: { scale: 1.0, rotX: 0.05 },
        talk: { scale: 1.01, rotX: -0.02 },
        read: { scale: 1.0, rotX: 0.03 },
        idle: { scale: 1.0, rotX: 0 },
    };

    const target = moodScale[mood] || moodScale.idle;

    // Smooth transition via lerp
    model.scale.x = THREE.MathUtils.lerp(model.scale.x, target.scale, 0.08);
    model.scale.y = THREE.MathUtils.lerp(model.scale.y, target.scale, 0.08);
    model.scale.z = THREE.MathUtils.lerp(model.scale.z, target.scale, 0.08);
}
