/**
 * blowkiss.js - Keyframe animation sequence for "BlowKiss".
 * Nilai rotasi = Euler urutan YXZ (radian, sesuai core/interpolation.js) pada sumbu LOKAL rig Naura_Hoshino_3D_NEW.glb:
 *   X = miring ke samping (roll), Y = putar/twist, Z = maju-mundur (pitch).
 * Kunci morph memakai nama morph target GLB: Happy, Thinking, Sad, Angry, Blink, Talk.
 * Waktu 't' ternormalisasi 0..1 terhadap 'duration'.
 */

export const blowKissSequence = {
    "duration": 2.6,
    "isLoop": false,
    "bones": {
        "rightUpperArm": [
            { "t": 0, "val": [0, 0, 0] },
            { "t": 0.06, "val": [0, 0, 0] },
            { "t": 0.15, "val": [-0.308, -0.455, 1.27] },
            { "t": 0.24, "val": [0.036, -0.882, 2.528] },
            { "t": 0.3, "val": [-0.016, -0.865, 2.417] },
            { "t": 0.347, "val": [0.002, -0.865, 2.399] },
            { "t": 0.393, "val": [-0.012, -0.883, 2.413] },
            { "t": 0.44, "val": [-0.016, -0.865, 2.417] },
            { "t": 0.46, "val": [-0.016, -0.865, 2.417] },
            { "t": 0.5, "val": [0.004, -0.885, 2.367] },
            { "t": 0.58, "val": [-0.298, -0.679, 2.139] },
            { "t": 0.66, "val": [-0.275, -0.7, 2.167] },
            { "t": 0.72, "val": [-0.246, -0.713, 2.138] },
            { "t": 0.78, "val": [-0.275, -0.7, 2.167] },
            { "t": 0.8, "val": [-0.275, -0.7, 2.167] },
            { "t": 0.9, "val": [-0.343, -0.258, 1.038] },
            { "t": 1, "val": [0, 0, 0] }
        ],
        "head": [
            { "t": 0, "val": [0, 0, 0] },
            { "t": 0.24, "val": [0.03, 0, -0.03] },
            { "t": 0.44, "val": [0.04, 0, -0.035] },
            { "t": 0.5, "val": [0.035, 0, -0.05] },
            { "t": 0.58, "val": [-0.05, 0.02, 0.05] },
            { "t": 0.78, "val": [-0.05, 0.02, 0.04] },
            { "t": 1, "val": [0, 0, 0] }
        ],
        "spine": [
            { "t": 0, "val": [0, 0, 0] },
            { "t": 0.44, "val": [0, 0, -0.02] },
            { "t": 0.52, "val": [0, 0, -0.06] },
            { "t": 0.6, "val": [0, 0, 0.01] },
            { "t": 0.8, "val": [0, 0, 0.01] },
            { "t": 1, "val": [0, 0, 0] }
        ]
    },
    "morphs": {
        "Talk": [
            { "t": 0, "val": 0 },
            { "t": 0.3, "val": 0.3 },
            { "t": 0.5, "val": 0.32 },
            { "t": 0.62, "val": 0 },
            { "t": 1, "val": 0 }
        ],
        "Blink": [
            { "t": 0, "val": 0 },
            { "t": 0.28, "val": 0.95 },
            { "t": 0.5, "val": 0.95 },
            { "t": 0.62, "val": 0 },
            { "t": 1, "val": 0 }
        ],
        "Happy": [
            { "t": 0, "val": 0.4 },
            { "t": 0.36, "val": 0.7 },
            { "t": 0.66, "val": 1 },
            { "t": 1, "val": 0.4 }
        ]
    },
    "root": {
        "posY": [
            { "t": 0, "val": 0 },
            { "t": 0.52, "val": -0.006 },
            { "t": 0.6, "val": 0.012 },
            { "t": 0.75, "val": 0.006 },
            { "t": 1, "val": 0 }
        ],
        "scale": [
            { "t": 0, "val": 1 },
            { "t": 0.36, "val": 1.015 },
            { "t": 0.58, "val": 1.025 },
            { "t": 1, "val": 1 }
        ]
    }
};

export default blowKissSequence;
