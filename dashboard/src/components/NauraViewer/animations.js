/**
 * animations.js - Sistem Animasi Frame-by-Frame 3D & VRM Naura Hoshino.
 *
 * Menyediakan:
 *   1. Frame-by-Frame Keyframe Kinematic Engine:
 *      Koreografi multi-fase (Antisipasi -> Peak Action -> Inersia/Follow-through -> Settle)
 *      untuk semua 8 state interaksi ('Idle', 'Wave', 'Thinking', 'Dizzy', 'Cheers', 'Shy', 'Sleepy', 'BlowKiss').
 *   2. Full Humanoid Bone Articulation:
 *      Mengendalikan seluruh rantai sendi anatomis (hips, spine, chest, neck, head,
 *      shoulders, upper arms, lower arms/siku, wrists/tangan) dengan batas fisiologis presisi.
 *   3. Synchronous Facial Expressions:
 *      Sinkronisasi blendshapes/morph targets (Joy, Fun, A, U, Blink, LookUp/Down) pada setiap fase.
 *   4. Hermite Quintic SmootherStep Interpolation:
 *      Perpindahan mulus tanpa lonjakan atau percepatan diskontinu (zero-snapping).
 *   5. Seamless Cross-Fading:
 *      Transisi kontinu antar aksi dengan lerp adaptif saat pergantian animasi.
 *   6. Multi-Model Support (VRM Humanoid & GLB Fallback):
 *      VRM mengontrol tulang & morfologi wajah; GLB mewarisi 6-DOF dynamic squash, stretch, & sway.
 */

import * as THREE from "three";

/**
 * Daftar nama animasi resmi.
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
    "AstralCast",
    "StarPose",
];

/**
 * Durasi default untuk animasi non-looping (dalam detik).
 */
export const ACTION_DURATIONS = {
    Wave: 2.4,
    BlowKiss: 2.8,
    Cheers: 2.2,
    Thinking: 3.2,
    Shy: 2.6,
    Dizzy: 2.4,
    Sleepy: 3.4,
    Idle: 3.2,
    AstralCast: 3.2,
    StarPose: 2.6,
};

/**
 * Pose istirahat fisiologis standar model Naura (A-pose natural)
 */
export const DEFAULT_REST_BONES = {
    hips: [0, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    leftShoulder: [0, 0, 0],
    rightShoulder: [0, 0, 0],
    leftUpperArm: [0, 0, 0],
    rightUpperArm: [0, 0, 0],
    leftLowerArm: [0, 0, 0],
    rightLowerArm: [0, 0, 0],
    leftHand: [0, 0, 0],
    rightHand: [0, 0, 0],
    leftUpLeg: [0, 0, 0],
    leftLeg: [0, 0, 0],
    leftFoot: [0, 0, 0],
    rightUpLeg: [0, 0, 0],
    rightLeg: [0, 0, 0],
    rightFoot: [0, 0, 0],
};

/**
 * Fungsi Hermite Quintic SmootherStep: C2-continuous (turunan pertama dan kedua kontinu).
 * Menghasilkan kurva akselerasi dan deselerasi yang sangat mulus dan natural.
 * @param {number} t - Nilai ternormalisasi 0.0 s/d 1.0
 * @returns {number}
 */
function smootherStep(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Lerp antara dua array sudut Euler [x, y, z].
 */
function lerpEuler(a, b, factor) {
    return [
        a[0] + (b[0] - a[0]) * factor,
        a[1] + (b[1] - a[1]) * factor,
        a[2] + (b[2] - a[2]) * factor,
    ];
}

/**
 * Lerp antara dua nilai skalar.
 */
function lerpScalar(a, b, factor) {
    return a + (b - a) * factor;
}

/**
 * Interpolasi antara keyframe-keyframe dalam sebuah track timeline.
 * @param {Array<{ t: number, val: any }>} keyframes
 * @param {number} timeNorm - Waktu dalam 0.0 s/d 1.0
 * @param {'euler' | 'scalar'} type
 * @returns {any}
 */
function evaluateTrack(keyframes, timeNorm, type = "euler") {
    if (!keyframes || keyframes.length === 0) {
        return type === "euler" ? [0, 0, 0] : 0;
    }
    if (keyframes.length === 1 || timeNorm <= keyframes[0].t) {
        return keyframes[0].val;
    }
    if (timeNorm >= keyframes[keyframes.length - 1].t) {
        return keyframes[keyframes.length - 1].val;
    }

    // Cari dua keyframe yang mengapit timeNorm
    for (let i = 0; i < keyframes.length - 1; i++) {
        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        if (timeNorm >= k0.t && timeNorm <= k1.t) {
            const range = k1.t - k0.t;
            const u = range > 0.0001 ? (timeNorm - k0.t) / range : 0;
            const easedU = smootherStep(u);
            if (type === "euler") {
                return lerpEuler(k0.val, k1.val, easedU);
            }
            return lerpScalar(k0.val, k1.val, easedU);
        }
    }

    return keyframes[keyframes.length - 1].val;
}

/**
 * Definisi Sequence Frame-by-Frame untuk 8 Animasi.
 * Setiap animasi dirancang dengan keyframe bertahap dan kurva anatomis presisi.
 */
const ANIMATION_DEFINITIONS = {
    "Idle": {
        "duration": 3.6,
        "isLoop": true,
        "bones": {
            "spine": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.102,
                    "val": [
                        0,
                        0,
                        0.011
                    ]
                },
                {
                    "t": 0.204,
                    "val": [
                        0,
                        0,
                        0.027
                    ]
                },
                {
                    "t": 0.306,
                    "val": [
                        0,
                        0,
                        0.026
                    ]
                },
                {
                    "t": 0.407,
                    "val": [
                        0,
                        0,
                        0.009
                    ]
                },
                {
                    "t": 0.509,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.611,
                    "val": [
                        0,
                        0,
                        0.013
                    ]
                },
                {
                    "t": 0.713,
                    "val": [
                        0,
                        0,
                        0.028
                    ]
                },
                {
                    "t": 0.815,
                    "val": [
                        0,
                        0,
                        0.025
                    ]
                },
                {
                    "t": 0.917,
                    "val": [
                        0,
                        0,
                        0.008
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "chest": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.102,
                    "val": [
                        0,
                        0,
                        0.015
                    ]
                },
                {
                    "t": 0.204,
                    "val": [
                        0,
                        0,
                        0.036
                    ]
                },
                {
                    "t": 0.306,
                    "val": [
                        0,
                        0,
                        0.035
                    ]
                },
                {
                    "t": 0.407,
                    "val": [
                        0,
                        0,
                        0.012
                    ]
                },
                {
                    "t": 0.509,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.611,
                    "val": [
                        0,
                        0,
                        0.017
                    ]
                },
                {
                    "t": 0.713,
                    "val": [
                        0,
                        0,
                        0.038
                    ]
                },
                {
                    "t": 0.815,
                    "val": [
                        0,
                        0,
                        0.033
                    ]
                },
                {
                    "t": 0.917,
                    "val": [
                        0,
                        0,
                        0.01
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.102,
                    "val": [
                        0.005,
                        -0.004,
                        -0.007
                    ]
                },
                {
                    "t": 0.204,
                    "val": [
                        0.014,
                        -0.009,
                        -0.018
                    ]
                },
                {
                    "t": 0.306,
                    "val": [
                        0.013,
                        -0.009,
                        -0.017
                    ]
                },
                {
                    "t": 0.407,
                    "val": [
                        0.005,
                        -0.003,
                        -0.006
                    ]
                },
                {
                    "t": 0.509,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.611,
                    "val": [
                        -0.006,
                        0.004,
                        -0.008
                    ]
                },
                {
                    "t": 0.713,
                    "val": [
                        -0.014,
                        0.009,
                        -0.019
                    ]
                },
                {
                    "t": 0.815,
                    "val": [
                        -0.013,
                        0.008,
                        -0.017
                    ]
                },
                {
                    "t": 0.917,
                    "val": [
                        -0.004,
                        0.003,
                        -0.005
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0.05,
                        0,
                        0.02
                    ]
                },
                {
                    "t": 0.102,
                    "val": [
                        0.061,
                        0,
                        0.027
                    ]
                },
                {
                    "t": 0.204,
                    "val": [
                        0.077,
                        0,
                        0.038
                    ]
                },
                {
                    "t": 0.306,
                    "val": [
                        0.076,
                        0,
                        0.037
                    ]
                },
                {
                    "t": 0.407,
                    "val": [
                        0.059,
                        0,
                        0.026
                    ]
                },
                {
                    "t": 0.509,
                    "val": [
                        0.05,
                        0,
                        0.02
                    ]
                },
                {
                    "t": 0.611,
                    "val": [
                        0.063,
                        0,
                        0.028
                    ]
                },
                {
                    "t": 0.713,
                    "val": [
                        0.078,
                        0,
                        0.039
                    ]
                },
                {
                    "t": 0.815,
                    "val": [
                        0.075,
                        0,
                        0.037
                    ]
                },
                {
                    "t": 0.917,
                    "val": [
                        0.058,
                        0,
                        0.025
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0.05,
                        0,
                        0.02
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        -0.05,
                        0,
                        0.02
                    ]
                },
                {
                    "t": 0.102,
                    "val": [
                        -0.061,
                        0,
                        0.027
                    ]
                },
                {
                    "t": 0.204,
                    "val": [
                        -0.077,
                        0,
                        0.038
                    ]
                },
                {
                    "t": 0.306,
                    "val": [
                        -0.076,
                        0,
                        0.037
                    ]
                },
                {
                    "t": 0.407,
                    "val": [
                        -0.059,
                        0,
                        0.026
                    ]
                },
                {
                    "t": 0.509,
                    "val": [
                        -0.05,
                        0,
                        0.02
                    ]
                },
                {
                    "t": 0.611,
                    "val": [
                        -0.063,
                        0,
                        0.028
                    ]
                },
                {
                    "t": 0.713,
                    "val": [
                        -0.078,
                        0,
                        0.039
                    ]
                },
                {
                    "t": 0.815,
                    "val": [
                        -0.075,
                        0,
                        0.037
                    ]
                },
                {
                    "t": 0.917,
                    "val": [
                        -0.058,
                        0,
                        0.025
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        -0.05,
                        0,
                        0.02
                    ]
                }
            ]
        },
        "morphs": {
            "Joy": [
                {
                    "t": 0,
                    "val": 0.35
                },
                {
                    "t": 0.5,
                    "val": 0.45
                },
                {
                    "t": 1,
                    "val": 0.35
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.45,
                    "val": 0.008
                },
                {
                    "t": 0.85,
                    "val": -0.004
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "rotX": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.45,
                    "val": -0.008
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 0.45,
                    "val": 1.005
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "Wave": {
        "duration": 2.4,
        "isLoop": false,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.097,
                    "val": [
                        1.112,
                        -0.03,
                        0.152
                    ]
                },
                {
                    "t": 0.194,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.292,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.389,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.486,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.583,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.681,
                    "val": [
                        1.5,
                        0,
                        0.2
                    ]
                },
                {
                    "t": 0.778,
                    "val": [
                        1.373,
                        -0.012,
                        0.186
                    ]
                },
                {
                    "t": 0.875,
                    "val": [
                        0.663,
                        -0.039,
                        0.087
                    ]
                },
                {
                    "t": 0.972,
                    "val": [
                        0.044,
                        -0.004,
                        0.005
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.097,
                    "val": [
                        0.667,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.194,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.292,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.389,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.486,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.583,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.681,
                    "val": [
                        0.9,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.778,
                    "val": [
                        0.823,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.875,
                    "val": [
                        0.398,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.972,
                    "val": [
                        0.026,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightHand": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.097,
                    "val": [
                        0,
                        0,
                        0.259
                    ]
                },
                {
                    "t": 0.194,
                    "val": [
                        0,
                        0,
                        0.169
                    ]
                },
                {
                    "t": 0.292,
                    "val": [
                        0,
                        0,
                        -0.35
                    ]
                },
                {
                    "t": 0.389,
                    "val": [
                        0,
                        0,
                        0.169
                    ]
                },
                {
                    "t": 0.486,
                    "val": [
                        0,
                        0,
                        0.169
                    ]
                },
                {
                    "t": 0.583,
                    "val": [
                        0,
                        0,
                        -0.35
                    ]
                },
                {
                    "t": 0.681,
                    "val": [
                        0,
                        0,
                        0.057
                    ]
                },
                {
                    "t": 0.778,
                    "val": [
                        0,
                        0,
                        0.183
                    ]
                },
                {
                    "t": 0.875,
                    "val": [
                        0,
                        0,
                        0.088
                    ]
                },
                {
                    "t": 0.972,
                    "val": [
                        0,
                        0,
                        0.006
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.097,
                    "val": [
                        -0.074,
                        0.001,
                        0.059
                    ]
                },
                {
                    "t": 0.194,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.292,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.389,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.486,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.583,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.681,
                    "val": [
                        -0.1,
                        0,
                        0.08
                    ]
                },
                {
                    "t": 0.778,
                    "val": [
                        -0.091,
                        0,
                        0.073
                    ]
                },
                {
                    "t": 0.875,
                    "val": [
                        -0.044,
                        0.001,
                        0.035
                    ]
                },
                {
                    "t": 0.972,
                    "val": [
                        -0.003,
                        0,
                        0.002
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.097,
                    "val": [
                        0.045,
                        -0.029,
                        -0.022
                    ]
                },
                {
                    "t": 0.194,
                    "val": [
                        0.065,
                        -0.043,
                        -0.033
                    ]
                },
                {
                    "t": 0.292,
                    "val": [
                        0.08,
                        -0.05,
                        -0.04
                    ]
                },
                {
                    "t": 0.389,
                    "val": [
                        0.065,
                        -0.043,
                        -0.033
                    ]
                },
                {
                    "t": 0.486,
                    "val": [
                        0.065,
                        -0.043,
                        -0.033
                    ]
                },
                {
                    "t": 0.583,
                    "val": [
                        0.08,
                        -0.05,
                        -0.04
                    ]
                },
                {
                    "t": 0.681,
                    "val": [
                        0.058,
                        -0.035,
                        -0.025
                    ]
                },
                {
                    "t": 0.778,
                    "val": [
                        0.046,
                        -0.027,
                        -0.018
                    ]
                },
                {
                    "t": 0.875,
                    "val": [
                        0.022,
                        -0.013,
                        -0.009
                    ]
                },
                {
                    "t": 0.972,
                    "val": [
                        0.001,
                        -0.001,
                        -0.001
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Joy": [
                {
                    "t": 0,
                    "val": 0.4
                },
                {
                    "t": 0.2,
                    "val": 0.85
                },
                {
                    "t": 0.78,
                    "val": 0.85
                },
                {
                    "t": 1,
                    "val": 0.4
                }
            ],
            "Fun": [
                {
                    "t": 0,
                    "val": 0.2
                },
                {
                    "t": 0.2,
                    "val": 0.6
                },
                {
                    "t": 0.78,
                    "val": 0.6
                },
                {
                    "t": 1,
                    "val": 0.2
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.2,
                    "val": 0.015
                },
                {
                    "t": 0.78,
                    "val": 0.015
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 0.2,
                    "val": 1.015
                },
                {
                    "t": 0.78,
                    "val": 1.015
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "Thinking": {
        "duration": 3.2,
        "isLoop": true,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.2,
                    "val": [
                        0.65,
                        0,
                        1.35
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0.7,
                        0,
                        1.4
                    ]
                },
                {
                    "t": 0.8,
                    "val": [
                        0.65,
                        0,
                        1.35
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.2,
                    "val": [
                        0,
                        0,
                        1.65
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0,
                        0,
                        1.7
                    ]
                },
                {
                    "t": 0.8,
                    "val": [
                        0,
                        0,
                        1.65
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        -0.05,
                        0,
                        0.05
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        -0.08,
                        0.1,
                        -0.06
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Fun": [
                {
                    "t": 0,
                    "val": 0.5
                },
                {
                    "t": 0.5,
                    "val": 0.6
                },
                {
                    "t": 1,
                    "val": 0.5
                }
            ],
            "LookUp": [
                {
                    "t": 0,
                    "val": 0.75
                },
                {
                    "t": 0.5,
                    "val": 0.85
                },
                {
                    "t": 1,
                    "val": 0.75
                }
            ],
            "LookLeft": [
                {
                    "t": 0,
                    "val": 0.6
                },
                {
                    "t": 0.5,
                    "val": 0.7
                },
                {
                    "t": 1,
                    "val": 0.6
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": 0.005
                },
                {
                    "t": 0.5,
                    "val": 0.01
                },
                {
                    "t": 1,
                    "val": 0.005
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "Dizzy": {
        "duration": 2.2,
        "isLoop": true,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0.9,
                        -0.206,
                        0.479
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        1.7,
                        0,
                        0.9
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        1.274,
                        -0.155,
                        0.69
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0.166,
                        -0.073,
                        0.076
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0.897,
                        -0.023,
                        0.053
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        1.7,
                        0,
                        0.1
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        1.259,
                        -0.017,
                        0.076
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0.177,
                        -0.008,
                        0.009
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        -1.004,
                        0.181,
                        0.373
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        -1.9,
                        0,
                        0.7
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        -1.418,
                        0.136,
                        0.541
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        -0.19,
                        0.064,
                        0.055
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        -0.576,
                        -0.72,
                        0.535
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        -1.3,
                        -1.5,
                        0.5
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        -0.764,
                        -1.067,
                        0.674
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        -0.137,
                        -0.116,
                        0.132
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0.053,
                        -0.001,
                        0.032
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0.1,
                        0,
                        0.059
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0.04,
                        0.057,
                        -0.011
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        -0.002,
                        0.099,
                        -0.058
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        -0.065,
                        0.038,
                        0.018
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        -0.094,
                        -0.005,
                        0.053
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        -0.009,
                        -0.09,
                        -0.049
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0.001,
                        -0.074,
                        -0.044
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        -0.01,
                        -0.006
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Fun": [
                {
                    "t": 0,
                    "val": 0.7
                },
                {
                    "t": 0.5,
                    "val": 0.75
                },
                {
                    "t": 1,
                    "val": 0.7
                }
            ],
            "A": [
                {
                    "t": 0,
                    "val": 0.35
                },
                {
                    "t": 0.5,
                    "val": 0.4
                },
                {
                    "t": 1,
                    "val": 0.35
                }
            ]
        },
        "root": {
            "posX": [
                {
                    "t": 0,
                    "val": 0.015
                },
                {
                    "t": 0.25,
                    "val": 0
                },
                {
                    "t": 0.5,
                    "val": -0.015
                },
                {
                    "t": 0.75,
                    "val": 0
                },
                {
                    "t": 1,
                    "val": 0.015
                }
            ],
            "rotX": [
                {
                    "t": 0,
                    "val": 0.04
                },
                {
                    "t": 0.5,
                    "val": -0.04
                },
                {
                    "t": 1,
                    "val": 0.04
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1.01
                },
                {
                    "t": 0.5,
                    "val": 0.99
                },
                {
                    "t": 1,
                    "val": 1.01
                }
            ]
        }
    },
    "Cheers": {
        "duration": 2.2,
        "isLoop": false,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        1.705,
                        -0.048,
                        0.158
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        2.4,
                        0,
                        0.25
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        2.4,
                        0,
                        0.25
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        2.338,
                        -0.001,
                        0.219
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        2.13,
                        -0.016,
                        0.191
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0.358,
                        -0.032,
                        0.022
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        -1.705,
                        0.048,
                        0.158
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        -2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        -2.4,
                        0,
                        0.25
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        -2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        -2.326,
                        0,
                        0.213
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        -2.4,
                        0,
                        0.25
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        -2.338,
                        0.001,
                        0.219
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        -2.13,
                        0.016,
                        0.191
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        -0.358,
                        0.032,
                        0.022
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightHand": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftHand": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.106,
                    "val": [
                        0,
                        0,
                        0.059
                    ]
                },
                {
                    "t": 0.212,
                    "val": [
                        0,
                        0,
                        0.09
                    ]
                },
                {
                    "t": 0.318,
                    "val": [
                        0,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.424,
                    "val": [
                        0,
                        0,
                        0.09
                    ]
                },
                {
                    "t": 0.53,
                    "val": [
                        0,
                        0,
                        0.09
                    ]
                },
                {
                    "t": 0.636,
                    "val": [
                        0,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.742,
                    "val": [
                        0,
                        0,
                        0.083
                    ]
                },
                {
                    "t": 0.848,
                    "val": [
                        0,
                        0,
                        0.056
                    ]
                },
                {
                    "t": 0.955,
                    "val": [
                        0,
                        0,
                        0.009
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Joy": [
                {
                    "t": 0,
                    "val": 0.5
                },
                {
                    "t": 0.4,
                    "val": 0.95
                },
                {
                    "t": 0.8,
                    "val": 0.9
                },
                {
                    "t": 1,
                    "val": 0.5
                }
            ],
            "A": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.35,
                    "val": 0.65
                },
                {
                    "t": 0.65,
                    "val": 0.45
                },
                {
                    "t": 1,
                    "val": 0
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.15,
                    "val": -0.015
                },
                {
                    "t": 0.4,
                    "val": 0.025
                },
                {
                    "t": 0.65,
                    "val": 0.01
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 0.15,
                    "val": 0.98
                },
                {
                    "t": 0.4,
                    "val": 1.03
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "Shy": {
        "duration": 3,
        "isLoop": true,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0.15,
                        0,
                        0.45
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0,
                        0,
                        0.65
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        -0.15,
                        0,
                        0.45
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0,
                        0,
                        -0.65
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0.12,
                        0.08,
                        -0.05
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Joy": [
                {
                    "t": 0,
                    "val": 0.65
                },
                {
                    "t": 0.5,
                    "val": 0.75
                },
                {
                    "t": 1,
                    "val": 0.65
                }
            ],
            "LookDown": [
                {
                    "t": 0,
                    "val": 0.75
                },
                {
                    "t": 0.5,
                    "val": 0.85
                },
                {
                    "t": 1,
                    "val": 0.75
                }
            ],
            "LookRight": [
                {
                    "t": 0,
                    "val": 0.55
                },
                {
                    "t": 0.5,
                    "val": 0.65
                },
                {
                    "t": 1,
                    "val": 0.55
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": -0.01
                },
                {
                    "t": 0.5,
                    "val": -0.015
                },
                {
                    "t": 1,
                    "val": -0.01
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 0.99
                },
                {
                    "t": 1,
                    "val": 0.99
                }
            ]
        }
    },
    "Sleepy": {
        "duration": 3.2,
        "isLoop": true,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0.65,
                        0,
                        1.35
                    ]
                },
                {
                    "t": 0.7,
                    "val": [
                        0.7,
                        0,
                        1.4
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        0,
                        0,
                        1.6
                    ]
                },
                {
                    "t": 0.7,
                    "val": [
                        0,
                        0,
                        1.65
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.5,
                    "val": [
                        -0.04,
                        0,
                        0.02
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0.05,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.6,
                    "val": [
                        0.22,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.75,
                    "val": [
                        0.03,
                        0,
                        0
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0.05,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "Blink": [
                {
                    "t": 0,
                    "val": 0.7
                },
                {
                    "t": 0.6,
                    "val": 0.95
                },
                {
                    "t": 0.74,
                    "val": 0.1
                },
                {
                    "t": 0.88,
                    "val": 0.65
                },
                {
                    "t": 1,
                    "val": 0.7
                }
            ],
            "A": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.4,
                    "val": 0.35
                },
                {
                    "t": 0.65,
                    "val": 0.35
                },
                {
                    "t": 0.74,
                    "val": 0
                },
                {
                    "t": 1,
                    "val": 0
                }
            ]
        },
        "root": {
            "posY": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.65,
                    "val": -0.01
                },
                {
                    "t": 0.74,
                    "val": 0.008
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "rotX": [
                {
                    "t": 0,
                    "val": 0.03
                },
                {
                    "t": 0.65,
                    "val": 0.07
                },
                {
                    "t": 0.74,
                    "val": -0.02
                },
                {
                    "t": 1,
                    "val": 0.03
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 0.65,
                    "val": 0.995
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "BlowKiss": {
        "duration": 2.6,
        "isLoop": false,
        "bones": {
            "rightUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.103,
                    "val": [
                        0.521,
                        -0.146,
                        0.963
                    ]
                },
                {
                    "t": 0.205,
                    "val": [
                        0.8,
                        0,
                        1.5
                    ]
                },
                {
                    "t": 0.308,
                    "val": [
                        0.8,
                        0,
                        1.5
                    ]
                },
                {
                    "t": 0.41,
                    "val": [
                        0.852,
                        0.004,
                        1.448
                    ]
                },
                {
                    "t": 0.513,
                    "val": [
                        0.99,
                        0.001,
                        1.31
                    ]
                },
                {
                    "t": 0.615,
                    "val": [
                        1,
                        0,
                        1.3
                    ]
                },
                {
                    "t": 0.718,
                    "val": [
                        1,
                        0,
                        1.3
                    ]
                },
                {
                    "t": 0.821,
                    "val": [
                        0.756,
                        -0.13,
                        0.975
                    ]
                },
                {
                    "t": 0.923,
                    "val": [
                        0.183,
                        -0.107,
                        0.245
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "rightLowerArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.103,
                    "val": [
                        0,
                        0,
                        1.147
                    ]
                },
                {
                    "t": 0.205,
                    "val": [
                        0,
                        0,
                        1.8
                    ]
                },
                {
                    "t": 0.308,
                    "val": [
                        0,
                        0,
                        1.8
                    ]
                },
                {
                    "t": 0.41,
                    "val": [
                        0,
                        0,
                        1.67
                    ]
                },
                {
                    "t": 0.513,
                    "val": [
                        0,
                        0,
                        1.324
                    ]
                },
                {
                    "t": 0.615,
                    "val": [
                        0,
                        0,
                        1.3
                    ]
                },
                {
                    "t": 0.718,
                    "val": [
                        0,
                        0,
                        1.3
                    ]
                },
                {
                    "t": 0.821,
                    "val": [
                        0,
                        0,
                        0.963
                    ]
                },
                {
                    "t": 0.923,
                    "val": [
                        0,
                        0,
                        0.258
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "leftUpperArm": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.103,
                    "val": [
                        -0.096,
                        0.002,
                        0.076
                    ]
                },
                {
                    "t": 0.205,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.308,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.41,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.513,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.615,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.718,
                    "val": [
                        -0.15,
                        0,
                        0.12
                    ]
                },
                {
                    "t": 0.821,
                    "val": [
                        -0.111,
                        0.002,
                        0.089
                    ]
                },
                {
                    "t": 0.923,
                    "val": [
                        -0.03,
                        0.001,
                        0.024
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ],
            "head": [
                {
                    "t": 0,
                    "val": [
                        0,
                        0,
                        0
                    ]
                },
                {
                    "t": 0.103,
                    "val": [
                        0.025,
                        0,
                        0.013
                    ]
                },
                {
                    "t": 0.205,
                    "val": [
                        0.041,
                        0,
                        0.021
                    ]
                },
                {
                    "t": 0.308,
                    "val": [
                        0.049,
                        0,
                        0.029
                    ]
                },
                {
                    "t": 0.41,
                    "val": [
                        0.027,
                        0,
                        0.017
                    ]
                },
                {
                    "t": 0.513,
                    "val": [
                        -0.036,
                        0,
                        -0.018
                    ]
                },
                {
                    "t": 0.615,
                    "val": [
                        -0.04,
                        0,
                        -0.02
                    ]
                },
                {
                    "t": 0.718,
                    "val": [
                        -0.04,
                        0,
                        -0.02
                    ]
                },
                {
                    "t": 0.821,
                    "val": [
                        -0.03,
                        0,
                        -0.015
                    ]
                },
                {
                    "t": 0.923,
                    "val": [
                        -0.008,
                        0,
                        -0.004
                    ]
                },
                {
                    "t": 1,
                    "val": [
                        0,
                        0,
                        0
                    ]
                }
            ]
        },
        "morphs": {
            "U": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.3,
                    "val": 0.9
                },
                {
                    "t": 0.48,
                    "val": 0.9
                },
                {
                    "t": 0.62,
                    "val": 0
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "Blink_R": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.28,
                    "val": 0.95
                },
                {
                    "t": 0.48,
                    "val": 0.95
                },
                {
                    "t": 0.6,
                    "val": 0
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "Joy": [
                {
                    "t": 0,
                    "val": 0.4
                },
                {
                    "t": 0.36,
                    "val": 0.7
                },
                {
                    "t": 0.68,
                    "val": 1
                },
                {
                    "t": 1,
                    "val": 0.4
                }
            ]
        },
        "root": {
            "posZ": [
                {
                    "t": 0,
                    "val": 0
                },
                {
                    "t": 0.36,
                    "val": 0.025
                },
                {
                    "t": 0.68,
                    "val": -0.015
                },
                {
                    "t": 1,
                    "val": 0
                }
            ],
            "scale": [
                {
                    "t": 0,
                    "val": 1
                },
                {
                    "t": 0.36,
                    "val": 1.02
                },
                {
                    "t": 1,
                    "val": 1
                }
            ]
        }
    },
    "AstralCast": {
        "duration": 3.2,
        "isLoop": false,
        "bones": {
            "hips": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0, 0, -0.04] },
                { "t": 0.45, "val": [0, 0, 0.08] },
                { "t": 0.7, "val": [0, 0, 0.06] },
                { "t": 0.88, "val": [0, 0, 0.02] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "spine": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.08, 0, 0] },
                { "t": 0.45, "val": [-0.15, 0, 0] },
                { "t": 0.7, "val": [-0.12, 0, 0] },
                { "t": 0.88, "val": [0.05, 0, 0] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "chest": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.06, 0, 0] },
                { "t": 0.45, "val": [-0.18, 0, 0] },
                { "t": 0.7, "val": [-0.14, 0, 0] },
                { "t": 0.88, "val": [0.04, 0, 0] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "head": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.12, 0, 0] },
                { "t": 0.45, "val": [-0.22, 0, 0] },
                { "t": 0.7, "val": [-0.18, 0, 0] },
                { "t": 0.88, "val": [0.08, 0, 0] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightUpperArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.15, 0, 0.25] },
                { "t": 0.45, "val": [0.85, -0.3, 1.35] },
                { "t": 0.7, "val": [0.8, -0.25, 1.25] },
                { "t": 0.88, "val": [0.25, 0.1, 0.35] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftUpperArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.15, 0, -0.25] },
                { "t": 0.45, "val": [0.85, 0.3, -1.35] },
                { "t": 0.7, "val": [0.8, 0.25, -1.25] },
                { "t": 0.88, "val": [0.25, -0.1, -0.35] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightLowerArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0, 0, 0.3] },
                { "t": 0.45, "val": [0.1, 0, 0.65] },
                { "t": 0.7, "val": [0.1, 0, 0.6] },
                { "t": 0.88, "val": [0.2, 0.1, 0.8] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftLowerArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0, 0, -0.3] },
                { "t": 0.45, "val": [0.1, 0, -0.65] },
                { "t": 0.7, "val": [0.1, 0, -0.6] },
                { "t": 0.88, "val": [0.2, -0.1, -0.8] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightHand": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.1, 0, 0.2] },
                { "t": 0.45, "val": [-0.15, 0.1, 0.3] },
                { "t": 0.7, "val": [-0.1, 0.1, 0.25] },
                { "t": 0.88, "val": [0.2, 0.1, 0.4] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftHand": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.2, "val": [0.1, 0, -0.2] },
                { "t": 0.45, "val": [-0.15, -0.1, -0.3] },
                { "t": 0.7, "val": [-0.1, -0.1, -0.25] },
                { "t": 0.88, "val": [0.2, -0.1, -0.4] },
                { "t": 1, "val": [0, 0, 0] }
            ]
        },
        "morphs": {
            "joy": [
                { "t": 0, "val": 0 },
                { "t": 0.2, "val": 0.2 },
                { "t": 0.45, "val": 0.95 },
                { "t": 0.7, "val": 0.85 },
                { "t": 0.88, "val": 0.5 },
                { "t": 1, "val": 0 }
            ],
            "a": [
                { "t": 0, "val": 0 },
                { "t": 0.45, "val": 0.35 },
                { "t": 0.7, "val": 0.2 },
                { "t": 1, "val": 0 }
            ]
        },
        "root": {
            "posY": [
                { "t": 0, "val": 0 },
                { "t": 0.2, "val": -0.015 },
                { "t": 0.45, "val": 0.045 },
                { "t": 0.7, "val": 0.04 },
                { "t": 0.88, "val": 0.01 },
                { "t": 1, "val": 0 }
            ],
            "scale": [
                { "t": 0, "val": 1 },
                { "t": 0.45, "val": 1.025 },
                { "t": 1, "val": 1 }
            ]
        }
    },
    "StarPose": {
        "duration": 2.6,
        "isLoop": false,
        "bones": {
            "hips": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0, 0.08, -0.06] },
                { "t": 0.55, "val": [0, 0.12, -0.08] },
                { "t": 0.8, "val": [0, 0.1, -0.06] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "spine": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [-0.05, -0.06, 0.05] },
                { "t": 0.55, "val": [-0.08, -0.08, 0.07] },
                { "t": 0.8, "val": [-0.06, -0.06, 0.05] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "chest": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.04, -0.05, 0.06] },
                { "t": 0.55, "val": [0.06, -0.08, 0.08] },
                { "t": 0.8, "val": [0.04, -0.06, 0.06] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "head": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.06, 0.12, -0.14] },
                { "t": 0.55, "val": [0.08, 0.15, -0.18] },
                { "t": 0.8, "val": [0.06, 0.12, -0.15] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightUpperArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.85, -0.25, 1.25] },
                { "t": 0.55, "val": [1.1, -0.3, 1.45] },
                { "t": 0.8, "val": [1.05, -0.28, 1.4] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightLowerArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.2, 0, 1.3] },
                { "t": 0.55, "val": [0.25, 0.1, 1.7] },
                { "t": 0.8, "val": [0.22, 0.08, 1.65] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "rightHand": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.1, 0.2, 0.2] },
                { "t": 0.55, "val": [0.15, 0.35, 0.3] },
                { "t": 0.8, "val": [0.12, 0.3, 0.25] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftUpperArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [-0.3, 0.15, -0.45] },
                { "t": 0.55, "val": [-0.45, 0.2, -0.65] },
                { "t": 0.8, "val": [-0.4, 0.18, -0.6] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftLowerArm": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0, 0, -0.6] },
                { "t": 0.55, "val": [0.1, 0, -0.85] },
                { "t": 0.8, "val": [0.08, 0, -0.8] },
                { "t": 1, "val": [0, 0, 0] }
            ],
            "leftHand": [
                { "t": 0, "val": [0, 0, 0] },
                { "t": 0.22, "val": [0.1, -0.1, -0.2] },
                { "t": 0.55, "val": [0.2, -0.15, -0.3] },
                { "t": 0.8, "val": [0.15, -0.12, -0.25] },
                { "t": 1, "val": [0, 0, 0] }
            ]
        },
        "morphs": {
            "joy": [
                { "t": 0, "val": 0 },
                { "t": 0.22, "val": 0.7 },
                { "t": 0.55, "val": 1.0 },
                { "t": 0.8, "val": 0.9 },
                { "t": 1, "val": 0 }
            ],
            "blink": [
                { "t": 0, "val": 0 },
                { "t": 0.22, "val": 0.4 },
                { "t": 0.55, "val": 0.8 },
                { "t": 0.8, "val": 0.6 },
                { "t": 1, "val": 0 }
            ]
        },
        "root": {
            "rotZ": [
                { "t": 0, "val": 0 },
                { "t": 0.22, "val": 0.035 },
                { "t": 0.55, "val": 0.05 },
                { "t": 0.8, "val": 0.04 },
                { "t": 1, "val": 0 }
            ],
            "scale": [
                { "t": 0, "val": 1 },
                { "t": 0.55, "val": 1.02 },
                { "t": 1, "val": 1 }
            ]
        }
    }
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

    // Ambil seluruh node tulang humanoid yang relevan
    const humanoidBones = {};
    if (vrm && vrm.humanoid) {
        const boneKeys = [
            "hips",
            "spine",
            "chest",
            "neck",
            "head",
            "rightShoulder",
            "rightUpperArm",
            "rightLowerArm",
            "rightHand",
            "leftShoulder",
            "leftUpperArm",
            "leftLowerArm",
            "leftHand",
        ];
        boneKeys.forEach((key) => {
            try {
                let node = null;
                if (typeof vrm.humanoid.getNormalizedBoneNode === "function") {
                    node = vrm.humanoid.getNormalizedBoneNode(key);
                }
                if (!node && typeof vrm.humanoid.getBoneNode === "function") {
                    node = vrm.humanoid.getBoneNode(key);
                }
                if (node) {
                    humanoidBones[key] = node;
                }
            } catch (_) {}
        });
    } else if (modelScene) {
        // Fallback untuk model GLB non-VRM: petakan sendi skeletal dari hierarchy scene
        const bonePatterns = {
            hips: /^(hips?|pelvis|root)$/i,
            spine: /^(spine)$/i,
            chest: /^(chest|upper_?chest|spine1)$/i,
            neck: /^(neck)$/i,
            head: /^(head)$/i,
            rightShoulder: /^(right_?shoulder|r_?shoulder|shoulder[._]r)$/i,
            rightUpperArm: /^(right_?arm|r_?arm|right_?upper_?arm|upper_?arm[._]r)$/i,
            rightLowerArm: /^(right_?forearm|r_?forearm|right_?lower_?arm|forearm[._]r)$/i,
            rightHand: /^(right_?hand|r_?hand|hand[._]r)$/i,
            leftShoulder: /^(left_?shoulder|l_?shoulder|shoulder[._]l)$/i,
            leftUpperArm: /^(left_?arm|l_?arm|left_?upper_?arm|upper_?arm[._]l)$/i,
            leftLowerArm: /^(left_?forearm|l_?forearm|left_?lower_?arm|forearm[._]l)$/i,
            leftHand: /^(left_?hand|l_?hand|hand[._]l)$/i,
        };

        modelScene.traverse((node) => {
            if (node.isBone) {
                for (const [key, pattern] of Object.entries(bonePatterns)) {
                    if (!humanoidBones[key] && pattern.test(node.name)) {
                        humanoidBones[key] = node;
                    }
                }
            }
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
        humanoidBones,
        // State mesin prosedural keyframe
        activeAnim: "Idle",
        animTime: 0,
        isActionLooping: true,
        actionTimer: 0,
        actionDuration: 0,
        onActionFinish: null,
        // Base referensi transform awal modelScene
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
        // Buffer transformasi terkini hasil interpolasi lerp halus
        currentBlend: {
            posX: 0,
            posY: 0,
            posZ: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            scale: 1,
        },
        // Buffer rotasi sendi terkini untuk cross-fading antar pose
        currentBoneRotations: {},
    };

    // Inisialisasi buffer rotasi sendi dengan natural humanoid rest pose
    for (const key of Object.keys(humanoidBones)) {
        state.currentBoneRotations[key] = [...(DEFAULT_REST_BONES[key] || [0, 0, 0])];
    }

    // Mainkan animasi bawaan bila model memiliki klip skeletal bawaan (GLB mode)
    const idleClip = state.clips.find((c) => /idle|stand|breath/i.test(c.name));
    if (idleClip && !vrm) {
        state.currentAction = mixer.clipAction(idleClip);
        state.currentAction.play();
    }

    /**
     * Hitung nilai pose & transform frame-by-frame untuk state aktif.
     * @param {string} animName
     * @param {number} timeSec
     * @param {number} elapsedSec
     * @returns {{ root: Object, bones: Object, morphs: Object }}
     */
    function evaluateKeyframePose(animName, timeSec, elapsedSec) {
        const def = ANIMATION_DEFINITIONS[animName] || ANIMATION_DEFINITIONS.Idle;
        const dur = def.duration || 3.0;
        const tNorm = (timeSec % dur) / dur;

        // 1. Evaluasi Root Transform (GLB Fallback & Mesh Kinematics)
        const root = {
            posX: 0,
            posY: evaluateTrack(def.root?.posY, tNorm, "scalar"),
            posZ: evaluateTrack(def.root?.posZ, tNorm, "scalar"),
            rotX: evaluateTrack(def.root?.rotX, tNorm, "scalar"),
            rotY: evaluateTrack(def.root?.rotY, tNorm, "scalar"),
            rotZ: evaluateTrack(def.root?.rotZ, tNorm, "scalar"),
            scale: evaluateTrack(def.root?.scale, tNorm, "scalar") || 1.0,
        };

        // 2. Evaluasi Bone Tracks
        const bones = {};
        if (def.bones) {
            for (const [boneName, track] of Object.entries(def.bones)) {
                bones[boneName] = evaluateTrack(track, tNorm, "euler");
            }
        }

        // 3. Evaluasi Harmonic Layer (Osilasi pergelangan, kepala, dan gelombang lambai)
        if (def.harmonics) {
            const h = def.harmonics;
            if (tNorm >= h.activeStart && tNorm <= h.activeEnd) {
                const oscTime = (tNorm - h.activeStart) * dur;
                const waveSin = Math.sin(oscTime * h.freq);
                const wristSin = Math.sin(oscTime * h.freq - 0.4);

                if (bones.rightLowerArm && h.rightForearmY) {
                    bones.rightLowerArm[1] += waveSin * h.rightForearmY;
                }
                if (bones.rightHand && h.rightHandZ) {
                    bones.rightHand[2] += wristSin * h.rightHandZ;
                }
                if (bones.head && h.headRoll) {
                    bones.head[2] += waveSin * h.headRoll;
                }
                if (h.hopY) {
                    root.posY += Math.abs(waveSin) * h.hopY;
                }
            }
        }

        // 4. Evaluasi Morphs (Facial Expressions)
        const morphs = {};
        if (def.morphs) {
            for (const [morphName, track] of Object.entries(def.morphs)) {
                morphs[morphName] = evaluateTrack(track, tNorm, "scalar");
            }
        }

        return { root, bones, morphs };
    }

    /**
     * Terapkan rotasi tulang ke node humanoid VRM dengan lerp transisi.
     */
    function applyHumanoidPose(targetBones, delta) {
        if (Object.keys(humanoidBones).length === 0) return;

        // Kecepatan adaptif cross-fading antar pose (14 rad/s menjamin zero-snapping)
        const boneLerpFactor = 1.0 - Math.exp(-14.0 * delta);

        for (const [key, node] of Object.entries(humanoidBones)) {
            const defaultRot = DEFAULT_REST_BONES[key] || [0, 0, 0];
            const targetRot = targetBones[key] || defaultRot;
            const currentRot = state.currentBoneRotations[key] || [...defaultRot];

            currentRot[0] += (targetRot[0] - currentRot[0]) * boneLerpFactor;
            currentRot[1] += (targetRot[1] - currentRot[1]) * boneLerpFactor;
            currentRot[2] += (targetRot[2] - currentRot[2]) * boneLerpFactor;

            node.rotation.set(currentRot[0], currentRot[1], currentRot[2]);
        }
    }

    /**
     * Terapkan ekspresi wajah terkalibrasi ke blendShapeProxy / expressionManager VRM.
     */
    function applyFacialMorphs(morphTargets) {
        if (!vrm) return;

        if (vrm.blendShapeProxy) {
            for (const [name, val] of Object.entries(morphTargets)) {
                try {
                    vrm.blendShapeProxy.setValue(name, Math.max(0, Math.min(1, val)));
                } catch (_) {}
            }
        } else if (vrm.expressionManager) {
            const vrm1Map = {
                Joy: "happy",
                Fun: "relaxed",
                A: "aa",
                I: "ih",
                U: "ou",
                E: "ee",
                O: "oh",
                Blink: "blink",
                Blink_L: "blinkLeft",
                Blink_R: "blinkRight",
                LookUp: "lookUp",
                LookDown: "lookDown",
                LookLeft: "lookLeft",
                LookRight: "lookRight",
            };
            for (const [name, val] of Object.entries(morphTargets)) {
                const expr = vrm1Map[name] || name.toLowerCase();
                try {
                    vrm.expressionManager.setValue(expr, Math.max(0, Math.min(1, val)));
                } catch (_) {}
            }
        }
    }

    /**
     * Update loop utama yang dipanggil per frame.
     * @param {number} delta - Detik sejak frame terakhir
     * @param {number} elapsed - Total waktu berjalan
     */
    function update(delta, elapsed) {
        state.elapsedTime = elapsed;
        state.animTime += delta;

        // 1. Update Mixer animasi bawaan bila ada
        mixer.update(delta);

        // 2. VRM internal update (spring bones & standard physics)
        if (vrm) {
            try {
                vrm.update(delta);
            } catch (_) {}
        }

        // 3. Durasi timer aksi non-looping (Wave, BlowKiss, Cheers)
        if (!state.isActionLooping && state.actionDuration > 0) {
            state.actionTimer += delta;
            if (state.actionTimer >= state.actionDuration) {
                if (typeof state.onActionFinish === "function") {
                    state.onActionFinish();
                    state.onActionFinish = null;
                }
                // Kembalikan ke Idle secara otomatis dan luwes
                state.activeAnim = "Idle";
                state.isActionLooping = true;
                state.actionTimer = 0;
                state.isWaving = false;

                // Bila dalam GLB mode dan memiliki idle clip bawaan, hidupkan kembali
                if (!vrm && idleClip) {
                    const idleAction = mixer.clipAction(idleClip);
                    idleAction.reset();
                    idleAction.setLoop(THREE.LoopRepeat, Infinity);
                    idleAction.fadeIn(0.4);
                    idleAction.play();
                    state.currentAction = idleAction;
                }
            }
        }

        // 4. Evaluasi Frame-by-Frame Keyframe Sequence
        const { root, bones, morphs } = evaluateKeyframePose(
            state.activeAnim,
            state.animTime,
            elapsed
        );

        // 5. Exponential lerp smoothing untuk root transformasi model
        const blendSpeed = 12.0;
        const lerpFactor = 1.0 - Math.exp(-blendSpeed * delta);

        state.currentBlend.posX += (root.posX - state.currentBlend.posX) * lerpFactor;
        state.currentBlend.posY += (root.posY - state.currentBlend.posY) * lerpFactor;
        state.currentBlend.posZ += (root.posZ - state.currentBlend.posZ) * lerpFactor;
        state.currentBlend.rotX += (root.rotX - state.currentBlend.rotX) * lerpFactor;
        state.currentBlend.rotY += (root.rotY - state.currentBlend.rotY) * lerpFactor;
        state.currentBlend.rotZ += (root.rotZ - state.currentBlend.rotZ) * lerpFactor;
        state.currentBlend.scale += (root.scale - state.currentBlend.scale) * lerpFactor;

        // 6. Terapkan transformasi root ke modelScene
        modelScene.position.x = state.base.posX + state.currentBlend.posX;
        modelScene.position.y = state.base.posY + state.currentBlend.posY;
        modelScene.position.z = state.base.posZ + state.currentBlend.posZ;

        modelScene.rotation.x = state.base.rotX + state.currentBlend.rotX;
        modelScene.rotation.z = state.base.rotZ + state.currentBlend.rotZ;

        if (!state.isWaving && !lookAtCursor && autoRotate) {
            state.base.rotY += 0.002;
        }
        modelScene.rotation.y = state.base.rotY + state.currentBlend.rotY;

        modelScene.scale.x = state.base.scaleX * state.currentBlend.scale;
        modelScene.scale.y = state.base.scaleY * state.currentBlend.scale;
        modelScene.scale.z = state.base.scaleZ * state.currentBlend.scale;

        // 7. Terapkan artikulasi tulang anatomis VRM (prosedural frame-by-frame selalu aktif untuk VRM)
        if (vrm) {
            applyHumanoidPose(bones, delta);
        } else {
            const isClipRunning = Boolean(state.currentAction && state.currentAction.isRunning());
            if (!isClipRunning) {
                applyHumanoidPose(bones, delta);
            }
        }

        // 8. Terapkan blendshapes wajah yang tersinkronisasi
        applyFacialMorphs(morphs);
    }

    /**
     * Mainkan klip atau aktifkan aksi prosedural frame-by-frame.
     * @param {string} name
     * @param {Object} [options={}]
     */
    function playClip(name, options = {}) {
        const { loop = true, fadeDuration = 0.5, onFinish = null } = options;

        if (!vrm) {
            const targetRegex = new RegExp(`^${name}$|${name}`, "i");
            const clip = state.clips.find((c) => targetRegex.test(c.name));

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
                state.activeAnim = name;

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
                                state.activeAnim = "Idle";
                            }
                        }
                    };
                    mixer.addEventListener("finished", handleFinish);
                }
                return newAction;
            }
        }

        // Engine Frame-by-Frame Keyframe
        const matchedKey = Object.keys(ANIMATION_DEFINITIONS).find(
            k => k.toLowerCase() === (name || "").toLowerCase()
        ) || "Idle";
        const def = ANIMATION_DEFINITIONS[matchedKey];
        state.activeAnim = matchedKey;
        state.animTime = 0;
        state.isActionLooping = loop ?? def.isLoop;
        state.actionTimer = 0;
        state.actionDuration = state.isActionLooping ? 0 : (ACTION_DURATIONS[matchedKey] || def.duration || 2.4);
        state.onActionFinish = onFinish || null;

        if (name.toLowerCase() === "wave") {
            state.isWaving = true;
        }

        // Hentikan/fade out klip skeletal bawaan jika beralih ke aksi prosedural
        if (!vrm && state.currentAction && state.currentAction.isRunning()) {
            state.currentAction.fadeOut(fadeDuration);
            state.currentAction = null;
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

    function setMood(mood) {
        state.currentMood = mood;
        const norm = (mood || "").toLowerCase();

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
            astral: "AstralCast",
            astralcast: "AstralCast",
            magic: "AstralCast",
            hoshino: "AstralCast",
            starpose: "StarPose",
            idol: "StarPose",
            pose: "StarPose",
            idle: "Idle",
        };

        const targetAnim = animMap[norm] || "Idle";
        const isLooping = targetAnim === "Idle" || targetAnim === "Dizzy" || targetAnim === "Sleepy" || targetAnim === "Thinking" || targetAnim === "Shy";
        playClip(targetAnim, { loop: isLooping, fadeDuration: 0.4 });
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
        syncVisemes: (phoneme, intensity = 1.0) => syncVisemes(vrm, phoneme, intensity),
        destroy,
        getMixer: () => mixer,
        getActiveAnim: () => state.activeAnim,
        getHumanoidBones: () => humanoidBones,
    };
}

/**
 * Sinkronisasi viseme morph target (A, I, U, E, O) pada avatar VRM
 * @param {object} vrm - VRM instance
 * @param {'A'|'I'|'U'|'E'|'O'} phoneme - Vowel phoneme
 * @param {number} [intensity=1.0] - Bobot bukaan mulut (0.0 s/d 1.0)
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

