/**
 * animations.js - Sistem animasi NauraViewer & NauraHero3DViewer.
 *
 * Menyediakan tiga lapisan animasi terpadu:
 *   1. Procedural Kinematic Engine: Multi-harmonic breathing, organic sway, hops, tilts, & wobbles
 *      untuk semua 8 state interaksi ('Idle', 'Wave', 'Thinking', 'Dizzy', 'Cheers', 'Shy', 'Sleepy', 'BlowKiss')
 *      dengan transisi Hermite S-Curve / exponential lerp cross-fading tanpa sentakan (zero-snapping).
 *   2. Clip-based: Pemutaran klip animasi bawaan via AnimationMixer Three.js (bila model memilikinya).
 *   3. Humanoid & Blendshape Expressions: Pose tulang sekunder VRM (head, neck, chest, arms) & ekspresi wajah.
 */

import * as THREE from "three";

/**
 * Daftar nama animasi yang didukung secara resmi.
 */
export const SUPPORTED_ANIMATIONS = [
    "Idle",
    "Wave",
    "Thinking",
    "Dizzy",
    "Cheers",
    "Shy",
    "Sleepy",
    "BlowKiss",
];

/**
 * Durasi default untuk animasi sekali putar (non-looping) dalam detik.
 */
const ACTION_DURATIONS = {
    Wave: 2.2,
    BlowKiss: 2.4,
    Cheers: 2.0,
    Thinking: 3.0,
    Shy: 2.4,
};

/**
 * Buat AnimationController untuk model yang sudah dimuat.
 *
 * @param {THREE.Group} modelScene
 * @param {THREE.AnimationClip[]} [clips=[]]
 * @param {import('@pixiv/three-vrm').VRM | null} [vrm=null]
 * @param {Object} [options={}]
 * @param {boolean} [options.lookAtCursor=false]
 * @param {boolean} [options.autoRotate=false]
 * @returns {Object}
 */
export function createAnimationController(modelScene, clips = [], vrm = null, options = {}) {
    const { lookAtCursor = false, autoRotate = false } = options;
    const mixer = new THREE.AnimationMixer(modelScene);

    // Ambil referensi node tulang VRM jika tersedia
    const humanoidBones = {};
    if (vrm && vrm.humanoid) {
        const boneKeys = ["head", "neck", "chest", "rightUpperArm", "rightLowerArm", "leftUpperArm"];
        boneKeys.forEach((key) => {
            try {
                let node = null;
                if (typeof vrm.humanoid.getNormalizedBoneNode === "function") {
                    node = vrm.humanoid.getNormalizedBoneNode(key);
                }
                if (!node && typeof vrm.humanoid.getBoneNode === "function") {
                    node = vrm.humanoid.getBoneNode(key);
                }
                if (node) humanoidBones[key] = node;
            } catch (_) {}
        });
    }

    const state = {
        mixer,
        clips: clips || [],
        currentAction: null,
        currentMood: "idle",
        isWaving: false,
        elapsedTime: 0,
        vrm,
        // State mesin prosedural
        activeAnim: "Idle",
        animTime: 0,
        isActionLooping: true,
        actionTimer: 0,
        actionDuration: 0,
        onActionFinish: null,
        // Base referensi transform awal model
        base: {
            posX: modelScene.position.x,
            posY: modelScene.position.y,
            posZ: modelScene.position.z,
            rotX: modelScene.rotation.x,
            rotY: modelScene.rotation.y,
            rotZ: modelScene.rotation.z,
            scaleX: modelScene.scale.x,
            scaleY: modelScene.scale.y,
            scaleZ: modelScene.scale.z,
        },
        // Transform terkini hasil interpolasi lerp halus
        currentBlend: {
            posX: 0,
            posY: 0,
            posZ: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            scale: 1,
        },
    };

    // Mainkan animasi idle dari clip bawaan model bila ada
    const idleClip = state.clips.find((c) => /idle|stand|breath/i.test(c.name));
    if (idleClip) {
        state.currentAction = mixer.clipAction(idleClip);
        state.currentAction.play();
    }

    /**
     * Hitung nilai transformasi offset target untuk state animasi prosedural tertentu.
     * @param {string} animName
     * @param {number} t - waktu dalam animasi
     * @param {number} elapsed - total waktu berjalan
     * @returns {{ posX: number, posY: number, posZ: number, rotX: number, rotY: number, rotZ: number, scale: number }}
     */
    function computeTargetProcedural(animName, t, elapsed) {
        const norm = (animName || "Idle").toLowerCase();

        switch (norm) {
            case "wave": {
                // Ayunan ceria melambai dengan hop vertikal berirama
                const waveFreq = 9.5;
                const yaw = Math.sin(t * waveFreq) * 0.18;
                const roll = Math.sin(t * waveFreq * 0.5) * 0.08;
                const hop = Math.abs(Math.sin(t * waveFreq * 0.5)) * 0.035;
                return {
                    posX: 0,
                    posY: hop,
                    posZ: 0.01,
                    rotX: -0.04,
                    rotY: yaw,
                    rotZ: roll,
                    scale: 1.02,
                };
            }

            case "thinking": {
                // Postur miring kontemplatif dengan ritme lambat penasaran
                const slowDrift = Math.sin(elapsed * 1.2) * 0.015;
                const slowNod = Math.cos(elapsed * 0.9) * 0.012;
                return {
                    posX: 0,
                    posY: Math.sin(elapsed * 1.5) * 0.008,
                    posZ: 0,
                    rotX: 0.06 + slowNod,
                    rotY: -0.09 + slowDrift,
                    rotZ: 0.08,
                    scale: 1.0,
                };
            }

            case "dizzy": {
                // Gerakan spiral komikal melingkar dengan wobble eksentrik
                const spinSpeed = 3.6;
                const pitch = Math.sin(elapsed * spinSpeed) * 0.08;
                const roll = Math.cos(elapsed * spinSpeed) * 0.08;
                const yaw = Math.sin(elapsed * 2.2) * 0.12;
                const bob = Math.sin(elapsed * spinSpeed * 2) * 0.016;
                return {
                    posX: Math.sin(elapsed * spinSpeed) * 0.015,
                    posY: bob,
                    posZ: 0,
                    rotX: pitch,
                    rotY: yaw,
                    rotZ: roll,
                    scale: 1.0 + Math.sin(elapsed * 7.0) * 0.015,
                };
            }

            case "cheers": {
                // Lompatan gembira bersemangat dengan pantulan riang
                const jumpFreq = 5.2;
                const hopY = Math.abs(Math.sin(elapsed * jumpFreq)) * 0.045;
                const tilt = Math.sin(elapsed * jumpFreq) * 0.07;
                return {
                    posX: 0,
                    posY: hopY,
                    posZ: 0.015,
                    rotX: -0.05 + Math.sin(elapsed * jumpFreq * 2) * 0.02,
                    rotY: Math.sin(elapsed * 2.5) * 0.06,
                    rotZ: tilt,
                    scale: 1.0 + Math.sin(elapsed * jumpFreq * 2) * 0.025,
                };
            }

            case "shy": {
                // Menunduk malu-malu dengan gerakan gugup kecil
                const fidget = Math.sin(elapsed * 3.2) * 0.014;
                return {
                    posX: 0,
                    posY: -0.015 + Math.sin(elapsed * 1.5) * 0.006,
                    posZ: -0.01,
                    rotX: 0.08 + Math.sin(elapsed * 2.0) * 0.01,
                    rotY: 0.06 + fidget,
                    rotZ: -0.05,
                    scale: 0.985,
                };
            }

            case "sleepy": {
                // Nafas dalam mengantuk dengan anggukan pelan ke bawah
                const sleepCycle = Math.sin(elapsed * 0.85);
                return {
                    posX: 0,
                    posY: -0.018 + sleepCycle * 0.015,
                    posZ: 0,
                    rotX: 0.12 + sleepCycle * 0.07,
                    rotY: Math.sin(elapsed * 0.4) * 0.02,
                    rotZ: Math.sin(elapsed * 0.5) * 0.012,
                    scale: 0.99 + sleepCycle * 0.008,
                };
            }

            case "blowkiss": {
                // Condong anggun ke depan memberikan ciuman hangat
                const kissCycle = (t % 2.4) / 2.4;
                const envelope = Math.sin(kissCycle * Math.PI);
                return {
                    posX: 0,
                    posY: 0.015 * envelope,
                    posZ: 0.04 * envelope,
                    rotX: -0.09 * envelope,
                    rotY: Math.sin(t * 3.0) * 0.03 * envelope,
                    rotZ: Math.sin(t * 4.0) * 0.025 * envelope,
                    scale: 1.0 + 0.025 * envelope,
                };
            }

            case "idle":
            default: {
                // Pernapasan harmonik ganda kontinu dan micro-sway natural
                const breathY = Math.sin(elapsed * 1.6) * 0.014 + Math.sin(elapsed * 3.2) * 0.004;
                const swayZ = Math.sin(elapsed * 0.75) * 0.012;
                const nodX = Math.cos(elapsed * 0.55) * 0.008;
                return {
                    posX: 0,
                    posY: breathY,
                    posZ: 0,
                    rotX: nodX,
                    rotY: Math.sin(elapsed * 0.3) * 0.006,
                    rotZ: swayZ,
                    scale: 1.0 + Math.sin(elapsed * 1.6) * 0.006,
                };
            }
        }
    }

    /**
     * Terapkan pose tambahan pada tulang VRM bila tersedia.
     */
    function applyHumanoidPose(animName, t, elapsed) {
        if (Object.keys(humanoidBones).length === 0) return;

        const norm = (animName || "Idle").toLowerCase();

        // 1. Right Upper Arm
        if (humanoidBones.rightUpperArm) {
            if (norm === "wave") {
                const armWave = Math.sin(t * 9.5) * 0.35;
                humanoidBones.rightUpperArm.rotation.z = -1.2 + armWave;
                humanoidBones.rightUpperArm.rotation.x = -0.3;
            } else if (norm === "cheers") {
                humanoidBones.rightUpperArm.rotation.z = -1.35 + Math.sin(elapsed * 5.2) * 0.15;
                humanoidBones.rightUpperArm.rotation.x = -0.2;
            } else if (norm === "blowkiss") {
                humanoidBones.rightUpperArm.rotation.z = -0.85;
                humanoidBones.rightUpperArm.rotation.x = -0.7;
            } else if (norm === "shy") {
                humanoidBones.rightUpperArm.rotation.z = -0.25;
                humanoidBones.rightUpperArm.rotation.x = 0.35;
            } else {
                humanoidBones.rightUpperArm.rotation.z = 0;
                humanoidBones.rightUpperArm.rotation.x = 0;
            }
        }

        // 2. Left Upper Arm
        if (humanoidBones.leftUpperArm) {
            if (norm === "cheers") {
                humanoidBones.leftUpperArm.rotation.z = 1.35 - Math.sin(elapsed * 5.2) * 0.15;
                humanoidBones.leftUpperArm.rotation.x = -0.2;
            } else if (norm === "shy") {
                humanoidBones.leftUpperArm.rotation.z = 0.25;
                humanoidBones.leftUpperArm.rotation.x = 0.35;
            } else {
                humanoidBones.leftUpperArm.rotation.z = 0;
                humanoidBones.leftUpperArm.rotation.x = 0;
            }
        }

        // 3. Head
        if (humanoidBones.head) {
            if (norm === "thinking") {
                humanoidBones.head.rotation.z = 0.12;
                humanoidBones.head.rotation.y = -0.15;
            } else if (norm === "sleepy") {
                humanoidBones.head.rotation.x = 0.2 + Math.sin(elapsed * 0.85) * 0.1;
                humanoidBones.head.rotation.z = 0;
            } else if (norm === "dizzy") {
                humanoidBones.head.rotation.z = Math.sin(elapsed * 3.6) * 0.15;
                humanoidBones.head.rotation.x = Math.cos(elapsed * 3.6) * 0.12;
            } else if (norm === "shy") {
                humanoidBones.head.rotation.x = 0.15;
                humanoidBones.head.rotation.y = 0.1;
            } else {
                humanoidBones.head.rotation.x = 0;
                humanoidBones.head.rotation.y = 0;
                humanoidBones.head.rotation.z = 0;
            }
        }
    }

    /**
     * Update animasi setiap frame.
     * @param {number} delta - detik sejak frame sebelumnya
     * @param {number} elapsed - total detik sejak init
     */
    function update(delta, elapsed) {
        state.elapsedTime = elapsed;
        state.animTime += delta;

        // 1. Mixer update (untuk model yang memiliki klip bawaan)
        mixer.update(delta);

        // 2. VRM internal update (spring bones, morphs, lookAt)
        if (vrm) {
            try {
                vrm.update(delta);
            } catch (_) {}
        }

        // 3. Tangani durasi aksi non-looping (misal Wave atau BlowKiss)
        if (!state.isActionLooping && state.actionDuration > 0) {
            state.actionTimer += delta;
            if (state.actionTimer >= state.actionDuration) {
                if (typeof state.onActionFinish === "function") {
                    state.onActionFinish();
                    state.onActionFinish = null;
                }
                // Kembalikan ke state Idle secara otomatis dan halus
                state.activeAnim = "Idle";
                state.isActionLooping = true;
                state.actionTimer = 0;
                state.actionDuration = 0;
                state.isWaving = false;
            }
        }

        // 4. Hitung target offset prosedural berdasarkan state aktif
        const target = computeTargetProcedural(state.activeAnim, state.animTime, elapsed);

        // 5. Exponential lerp smoothing: hilangkan lonjakan atau patahan antar-frame
        const blendSpeed = 10.0;
        const lerpFactor = 1.0 - Math.exp(-blendSpeed * delta);

        state.currentBlend.posX += (target.posX - state.currentBlend.posX) * lerpFactor;
        state.currentBlend.posY += (target.posY - state.currentBlend.posY) * lerpFactor;
        state.currentBlend.posZ += (target.posZ - state.currentBlend.posZ) * lerpFactor;
        state.currentBlend.rotX += (target.rotX - state.currentBlend.rotX) * lerpFactor;
        state.currentBlend.rotY += (target.rotY - state.currentBlend.rotY) * lerpFactor;
        state.currentBlend.rotZ += (target.rotZ - state.currentBlend.rotZ) * lerpFactor;
        state.currentBlend.scale += (target.scale - state.currentBlend.scale) * lerpFactor;

        // 6. Terapkan transformasi gabungan ke modelScene
        modelScene.position.x = state.base.posX + state.currentBlend.posX;
        modelScene.position.y = state.base.posY + state.currentBlend.posY;
        modelScene.position.z = state.base.posZ + state.currentBlend.posZ;

        modelScene.rotation.x = state.base.rotX + state.currentBlend.rotX;
        modelScene.rotation.z = state.base.rotZ + state.currentBlend.rotZ;

        // Auto-rotate halus bila diizinkan dan kursor tidak sedang di-track
        if (!state.isWaving && !lookAtCursor && autoRotate) {
            state.base.rotY += 0.002;
        }
        modelScene.rotation.y = state.base.rotY + state.currentBlend.rotY;

        modelScene.scale.x = state.base.scaleX * state.currentBlend.scale;
        modelScene.scale.y = state.base.scaleY * state.currentBlend.scale;
        modelScene.scale.z = state.base.scaleZ * state.currentBlend.scale;

        // 7. Terapkan pose humanoid VRM bila relevan
        applyHumanoidPose(state.activeAnim, state.animTime, elapsed);
    }

    /**
     * Mainkan animation clip atau picu aksi prosedural secara terpadu.
     * @param {string} name - Nama animasi ('Idle', 'Wave', 'Thinking', 'Dizzy', 'Cheers', 'Shy', 'Sleepy', 'BlowKiss')
     * @param {Object} [options={}]
     * @param {boolean} [options.loop=false]
     * @param {number} [options.fadeDuration=0.4]
     * @param {Function} [options.onFinish]
     */
    function playClip(name, options = {}) {
        const { loop = false, fadeDuration = 0.4, onFinish } = options;
        const targetRegex = new RegExp(`^${name}$|${name}`, "i");
        const clip = state.clips.find((c) => targetRegex.test(c.name));

        // Jika model memiliki klip bawaan, jalankan via AnimationMixer
        if (clip) {
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

        // BILA MODEL TIDAK MEMILIKI KLIP BAWAAN (seperti naura.glb & naura.vrm):
        // Jalankan via Kinematic Procedural Engine secara mulus tanpa error atau jeda!
        state.activeAnim = name;
        state.animTime = 0;
        state.isActionLooping = loop;
        state.actionTimer = 0;
        state.actionDuration = loop ? 0 : (ACTION_DURATIONS[name] || 2.2);
        state.onActionFinish = onFinish || null;

        if (name.toLowerCase() === "wave") {
            state.isWaving = true;
        }

        return {
            name,
            isProcedural: true,
            stop: () => {
                state.activeAnim = "Idle";
                state.isActionLooping = true;
            },
        };
    }

    /**
     * Picu animasi wave saat diklik atau disapa.
     */
    function triggerWave() {
        if (state.isWaving) return;
        state.isWaving = true;

        playClip("Wave", {
            loop: false,
            fadeDuration: 0.35,
            onFinish: () => {
                state.isWaving = false;
            },
        });
    }

    /**
     * Set ekspresi/mood Naura dan jalankan animasi gerakan yang sesuai.
     * @param {string} mood
     */
    function setMood(mood) {
        state.currentMood = mood;
        const norm = (mood || "").toLowerCase();

        // 1. Sinkronisasi dengan animation clips / aksi gerakan tubuh
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
            malu: "Shy",
            sleepy: "Sleepy",
            afk: "Sleepy",
            cooldown: "Sleepy",
            ngantuk: "Sleepy",
            blowkiss: "BlowKiss",
            love: "BlowKiss",
            romance: "BlowKiss",
            kiss: "BlowKiss",
            idle: "Idle",
        };

        const targetAnim = animMap[norm] || "Idle";
        const isLooping = targetAnim === "Idle" || targetAnim === "Dizzy" || targetAnim === "Sleepy" || targetAnim === "Thinking";
        playClip(targetAnim, { loop: isLooping, fadeDuration: 0.4 });

        // 2. VRM support ekspresi wajah (bila avatar VRM aktif)
        if (vrm && vrm.expressionManager) {
            const expressions = ["happy", "sad", "surprised", "angry", "relaxed", "neutral", "blink"];
            expressions.forEach((expr) => {
                try {
                    vrm.expressionManager.setValue(expr, 0);
                } catch (_) {}
            });

            const moodMap = {
                happy: "happy",
                cheers: "happy",
                wave: "happy",
                sad: "sad",
                cry: "sad",
                surprised: "surprised",
                shocked: "surprised",
                angry: "angry",
                thinking: "relaxed",
                dizzy: "relaxed",
                sleepy: "blink",
                shy: "happy",
                blowkiss: "happy",
                idle: null,
            };

            const expr = moodMap[norm];
            if (expr) {
                try {
                    vrm.expressionManager.setValue(expr, 1.0);
                } catch (_) {}
            }
        }
    }

    function destroy() {
        mixer.stopAllAction();
        mixer.uncacheRoot(modelScene);
        state.clips = [];
    }

    return {
        update,
        triggerWave,
        playClip,
        setMood,
        destroy,
        getMixer: () => mixer,
        getActiveAnim: () => state.activeAnim,
    };
}
