/**
 * cafe.js - Keyframe animation sequences for Cafe & Comfort: Drink, Eat, Yawn, Stretch.
 * Nilai rotasi = Euler urutan YXZ (radian).
 */

export const drinkSequence = {
    duration: 2.8,
    isLoop: false,
    bones: {
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [0, 0, 0] },
            { t: 0.50, val: [0, 0, -0.22] },
            { t: 0.70, val: [0, 0, -0.22] },
            { t: 0.85, val: [0, 0, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [-0.25, -0.30, 1.35] },
            { t: 0.70, val: [-0.25, -0.30, 1.40] },
            { t: 0.90, val: [0, 0, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.35, val: [1.15, -2.15, 0.45] },
            { t: 0.70, val: [1.15, -2.15, 0.45] },
            { t: 0.90, val: [0, 0, 0] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const eatSequence = {
    duration: 2.6,
    isLoop: false,
    bones: {
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.30, val: [0, 0, 0.08] },
            { t: 0.45, val: [0, 0, 0.04] },
            { t: 0.60, val: [0, 0, 0.08] },
            { t: 0.75, val: [0, 0, 0.04] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.30, val: [-0.15, -0.25, 1.25] },
            { t: 0.50, val: [-0.15, -0.25, 1.25] },
            { t: 0.75, val: [0, 0, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.30, val: [1.05, -1.95, 0.35] },
            { t: 0.50, val: [1.05, -1.95, 0.35] },
            { t: 0.75, val: [0, 0, 0] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const yawnSequence = {
    duration: 3.2,
    isLoop: false,
    bones: {
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0, 0, -0.08] },
            { t: 0.7, val: [0, 0, -0.06] },
            { t: 1, val: [0, 0, 0] }
        ],
        chest: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0, 0, -0.12] },
            { t: 0.7, val: [0, 0, -0.08] },
            { t: 1, val: [0, 0, 0] }
        ],
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0, 0, -0.25] },
            { t: 0.7, val: [0, 0, -0.15] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0.35, 0.25, 0.95] },
            { t: 0.7, val: [0.35, 0.25, 0.95] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [-0.25, -0.15, 1.25] },
            { t: 0.7, val: [-0.25, -0.15, 1.25] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [1.15, -2.15, 0.45] },
            { t: 0.7, val: [1.15, -2.15, 0.45] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const stretchSequence = {
    duration: 3.4,
    isLoop: false,
    bones: {
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0, 0, -0.14] },
            { t: 0.7, val: [0, 0, -0.10] },
            { t: 1, val: [0, 0, 0] }
        ],
        chest: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0, 0, -0.18] },
            { t: 0.7, val: [0, 0, -0.12] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0.45, 0.20, 2.35] },
            { t: 0.7, val: [0.45, 0.20, 2.35] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0.25, -0.35, 0.15] },
            { t: 0.7, val: [0.25, -0.35, 0.15] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpperArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [-0.45, -0.20, 2.35] },
            { t: 0.7, val: [-0.45, -0.20, 2.35] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightLowerArm: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.4, val: [0.25, -0.35, 0.15] },
            { t: 0.7, val: [0.25, -0.35, 0.15] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};
