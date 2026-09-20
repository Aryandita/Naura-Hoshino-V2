/**
 * sleepy.js - Keyframe animation sequence for "Sleepy".
 * Nilai rotasi = Euler urutan YXZ (radian, sesuai core/interpolation.js) pada sumbu LOKAL rig Naura_Hoshino_3D_NEW.glb:
 *   X = miring ke samping (roll), Y = putar/twist, Z = maju-mundur (pitch).
 * Kunci morph memakai nama morph target GLB: Happy, Thinking, Sad, Angry, Blink, Talk.
 * Waktu 't' ternormalisasi 0..1 terhadap 'duration'.
 */

export const sleepySequence = {
    "duration": 3.2,
    "isLoop": true,
    "bones": {
        "rightUpperArm": [
            { "t": 0, "val": [0, 0, 0] },
            { "t": 0.12, "val": [0, 0, 0] },
            { "t": 0.22, "val": [-0.196, -0.502, 1.229] },
            { "t": 0.32, "val": [0.207, -0.858, 2.406] },
            { "t": 0.38, "val": [0.164, -0.85, 2.319] },
            { "t": 0.429, "val": [0.171, -0.844, 2.312] },
            { "t": 0.477, "val": [0.18, -0.851, 2.303] },
            { "t": 0.526, "val": [0.179, -0.865, 2.304] },
            { "t": 0.574, "val": [0.166, -0.87, 2.316] },
            { "t": 0.623, "val": [0.154, -0.861, 2.329] },
            { "t": 0.671, "val": [0.154, -0.85, 2.329] },
            { "t": 0.72, "val": [0.164, -0.85, 2.319] },
            { "t": 0.8, "val": [0.164, -0.85, 2.319] },
            { "t": 0.9, "val": [-0.2, -0.48, 1.181] },
            { "t": 1, "val": [0, 0, 0] }
        ],
        "head": [
            { "t": 0, "val": [0, 0, -0.03] },
            { "t": 0.28, "val": [0.04, 0, -0.08] },
            { "t": 0.46, "val": [0.07, 0.01, -0.17] },
            { "t": 0.6, "val": [0.09, 0, -0.27] },
            { "t": 0.66, "val": [0.09, 0, -0.29] },
            { "t": 0.73, "val": [0.03, 0, 0.01] },
            { "t": 0.8, "val": [0.04, 0, -0.04] },
            { "t": 0.9, "val": [0.02, 0, -0.045] },
            { "t": 1, "val": [0, 0, -0.03] }
        ],
        "spine": [
            { "t": 0, "val": [0, 0, 0] },
            { "t": 0.45, "val": [0, 0, -0.04] },
            { "t": 0.62, "val": [0, 0, -0.07] },
            { "t": 0.73, "val": [0, 0, 0.012] },
            { "t": 0.85, "val": [0, 0, -0.01] },
            { "t": 1, "val": [0, 0, 0] }
        ]
    },
    "morphs": {
        "Blink": [
            { "t": 0, "val": 0.7 },
            { "t": 0.3, "val": 0.8 },
            { "t": 0.6, "val": 0.95 },
            { "t": 0.73, "val": 0.1 },
            { "t": 0.8, "val": 0.4 },
            { "t": 0.9, "val": 0.65 },
            { "t": 1, "val": 0.7 }
        ],
        "Talk": [
            { "t": 0, "val": 0 },
            { "t": 0.38, "val": 0.3 },
            { "t": 0.52, "val": 0.42 },
            { "t": 0.66, "val": 0.3 },
            { "t": 0.74, "val": 0 },
            { "t": 1, "val": 0 }
        ]
    },
    "root": {
        "posY": [
            { "t": 0, "val": 0 },
            { "t": 0.6, "val": -0.008 },
            { "t": 0.66, "val": -0.01 },
            { "t": 0.73, "val": 0.008 },
            { "t": 0.86, "val": 0.001 },
            { "t": 1, "val": 0 }
        ],
        "scale": [
            { "t": 0, "val": 1 },
            { "t": 0.66, "val": 0.995 },
            { "t": 1, "val": 1 }
        ]
    }
};

export default sleepySequence;
