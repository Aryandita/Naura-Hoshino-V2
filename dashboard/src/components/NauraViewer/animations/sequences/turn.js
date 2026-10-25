/**
 * turn.js - Keyframe animation sequences for TurnLeft and TurnRight (90 degree rotation).
 * Nilai rotasi = Euler urutan YXZ (radian).
 */

export const turnLeftSequence = {
    duration: 1.2,
    isLoop: false,
    bones: {
        hips: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0, 0.45, 0.04] },
            { t: 0.7, val: [0, 1.15, 0.02] },
            { t: 1, val: [0, 1.57, 0] } // 90 deg = pi/2 = 1.57 rad
        ],
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0, 0.25, 0] },
            { t: 0.7, val: [0, 0.15, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0, 0.40, 0] }, // head turns first (anticipation)
            { t: 0.8, val: [0, 0.15, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftUpLeg: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0.15, 0.35, 0.15] },
            { t: 0.6, val: [0.05, 0.15, 0.05] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpLeg: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.5, val: [0.20, -0.25, -0.10] },
            { t: 0.8, val: [0.10, -0.10, -0.05] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};

export const turnRightSequence = {
    duration: 1.2,
    isLoop: false,
    bones: {
        hips: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0, -0.45, -0.04] },
            { t: 0.7, val: [0, -1.15, -0.02] },
            { t: 1, val: [0, -1.57, 0] } // -90 deg = -1.57 rad
        ],
        spine: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0, -0.25, 0] },
            { t: 0.7, val: [0, -0.15, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        head: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.25, val: [0, -0.40, 0] }, // head turns first
            { t: 0.8, val: [0, -0.15, 0] },
            { t: 1, val: [0, 0, 0] }
        ],
        rightUpLeg: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.3, val: [0.15, -0.35, -0.15] },
            { t: 0.6, val: [0.05, -0.15, -0.05] },
            { t: 1, val: [0, 0, 0] }
        ],
        leftUpLeg: [
            { t: 0, val: [0, 0, 0] },
            { t: 0.5, val: [0.20, 0.25, 0.10] },
            { t: 0.8, val: [0.10, 0.10, 0.05] },
            { t: 1, val: [0, 0, 0] }
        ]
    }
};
