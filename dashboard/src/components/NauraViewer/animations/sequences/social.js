/**
 * social.js - Keyframe animation sequences for Social & Etiquette: Salute, Bow, HoldItem, Read.
 * Nilai rotasi = Euler urutan YXZ (radian).
 */

export const saluteSequence = {
    duration: 2.2,
    isLoop: false,
    bones: {
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0, 0, -0.04] },
            { t: 0.75, val: [0, 0, -0.04] },
            { t: 1, val: [0, 0, 0] }
        ],
        chest: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0, 0, -0.03] },
            { t: 0.75, val: [0, 0, -0.03] },
            { t: 1, val: [0, 0, 0] }
        ],
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0, 0, 0.02] },
            { t: 0.75, val: [0, 0, 0.02] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [-0.45, -0.35, 1.65] },
            { t: 0.75, val: [-0.45, -0.35, 1.65] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [1.35, -2.45, 0.25] },
            { t: 0.75, val: [1.35, -2.45, 0.25] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightHand: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0.15, 0.10, -0.15] },
            { t: 0.75, val: [0.15, 0.10, -0.15] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const bowSequence = {
    duration: 2.6,
    isLoop: false,
    bones: {
        hips: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0, 0, 0.20] },
            { t: 0.65, val: [0, 0, 0.20] },
            { t: 1, val: [0, 0, 0] }
        ],
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0, 0, 0.35] },
            { t: 0.65, val: [0, 0, 0.35] },
            { t: 1, val: [0, 0, 0] }
        ],
        chest: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0, 0, 0.15] },
            { t: 0.65, val: [0, 0, 0.15] },
            { t: 1, val: [0, 0, 0] }
        ],
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0, 0, 0.10] },
            { t: 0.65, val: [0, 0, 0.10] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0.10, 0.05, 0.15] },
            { t: 0.65, val: [0.10, 0.05, 0.15] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [-0.10, -0.05, 0.15] },
            { t: 0.65, val: [-0.10, -0.05, 0.15] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const holdItemSequence = {
    duration: 3.2,
    isLoop: true,
    bones: {
        spine: [
            { t: 0, val: [0, 0.02, 0] },
            { t: 0.5, val: [0, -0.02, 0.02] },
            { t: 1, val: [0, 0.02, 0] }
        ],
        head: [
            { t: 0, val: [-0.05, -0.12, 0.08] },
            { t: 0.5, val: [-0.03, -0.10, 0.06] },
            { t: 1, val: [-0.05, -0.12, 0.08] }
        ],
        rightUpperArm: [
            { t: 0, val: [-0.25, -0.30, 0.85] },
            { t: 0.5, val: [-0.28, -0.32, 0.88] },
            { t: 1, val: [-0.25, -0.30, 0.85] }
        ],
        rightLowerArm: [
            { t: 0, val: [0.65, -1.55, 0.35] },
            { t: 0.5, val: [0.68, -1.60, 0.38] },
            { t: 1, val: [0.65, -1.55, 0.35] }
        ],
        rightHand: [
            { t: 0, val: [0, 0, 0.15] },
            { t: 0.5, val: [0, 0, 0.18] },
            { t: 1, val: [0, 0, 0.15] }
        ]
    }
};

export const readSequence = {
    duration: 3.8,
    isLoop: true,
    bones: {
        spine: [
            { t: 0, val: [0, 0, 0.08] },
            { t: 0.5, val: [0, 0, 0.10] },
            { t: 1, val: [0, 0, 0.08] }
        ],
        head: [
            { t: 0, val: [0, 0, 0.32] },
            { t: 0.3, val: [-0.05, 0, 0.30] },
            { t: 0.7, val: [0.05, 0, 0.34] },
            { t: 1, val: [0, 0, 0.32] }
        ],
        leftUpperArm: [
            { t: 0, val: [0.35, 0.40, 0.75] },
            { t: 0.5, val: [0.38, 0.42, 0.78] },
            { t: 1, val: [0.35, 0.40, 0.75] }
        ],
        leftLowerArm: [
            { t: 0, val: [0.75, -1.65, 0.40] },
            { t: 0.5, val: [0.78, -1.70, 0.42] },
            { t: 1, val: [0.75, -1.65, 0.40] }
        ],
        rightUpperArm: [
            { t: 0, val: [-0.35, -0.40, 0.75] },
            { t: 0.5, val: [-0.38, -0.42, 0.78] },
            { t: 1, val: [-0.35, -0.40, 0.75] }
        ],
        rightLowerArm: [
            { t: 0, val: [0.75, -1.65, 0.40] },
            { t: 0.5, val: [0.78, -1.70, 0.42] },
            { t: 1, val: [0.75, -1.65, 0.40] }
        ]
    }
};
