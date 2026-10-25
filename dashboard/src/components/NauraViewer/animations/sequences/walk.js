/**
 * sequences/walk.js - Animasi berjalan maju/mundur prosedural.
 * 
 * Digunakan untuk navigasi virtual di dashboard atau transisi antar panel.
 * Menggunakan sistem keyframe granular per-bone untuk gerakan natural.
 */

export const walkForwardSequence = {
    name: "WalkForward",
    duration: 1.2,
    isLoop: true,
    
    root: {
        posY: [
            { t: 0.0, v: 0.0 },
            { t: 0.25, v: 0.015 },
            { t: 0.5, v: 0.0 },
            { t: 0.75, v: 0.015 },
            { t: 1.0, v: 0.0 }
        ],
        posZ: [
            { t: 0.0, v: 0.0 },
            { t: 1.0, v: 0.3 }
        ]
    },

    bones: {
        Hips: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.02, y: 0, z: 0.01 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.02, y: 0, z: -0.01 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        LeftUpLeg: [
            { t: 0.0, x: -0.4, y: 0, z: 0 },
            { t: 0.25, x: 0.3, y: 0, z: 0 },
            { t: 0.5, x: 0.4, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0, z: 0 },
            { t: 1.0, x: -0.4, y: 0, z: 0 }
        ],
        
        LeftLeg: [
            { t: 0.0, x: 0.1, y: 0, z: 0 },
            { t: 0.25, x: 0.6, y: 0, z: 0 },
            { t: 0.5, x: 0.0, y: 0, z: 0 },
            { t: 0.75, x: 0.2, y: 0, z: 0 },
            { t: 1.0, x: 0.1, y: 0, z: 0 }
        ],
        
        RightUpLeg: [
            { t: 0.0, x: 0.4, y: 0, z: 0 },
            { t: 0.25, x: -0.1, y: 0, z: 0 },
            { t: 0.5, x: -0.4, y: 0, z: 0 },
            { t: 0.75, x: 0.3, y: 0, z: 0 },
            { t: 1.0, x: 0.4, y: 0, z: 0 }
        ],
        
        RightLeg: [
            { t: 0.0, x: 0.0, y: 0, z: 0 },
            { t: 0.25, x: 0.2, y: 0, z: 0 },
            { t: 0.5, x: 0.1, y: 0, z: 0 },
            { t: 0.75, x: 0.6, y: 0, z: 0 },
            { t: 1.0, x: 0.0, y: 0, z: 0 }
        ],
        
        LeftArm: [
            { t: 0.0, x: 0.3, y: 0, z: 0.15 },
            { t: 0.5, x: -0.3, y: 0, z: 0.15 },
            { t: 1.0, x: 0.3, y: 0, z: 0.15 }
        ],
        
        RightArm: [
            { t: 0.0, x: -0.3, y: 0, z: -0.15 },
            { t: 0.5, x: 0.3, y: 0, z: -0.15 },
            { t: 1.0, x: -0.3, y: 0, z: -0.15 }
        ],
        
        Spine: [
            { t: 0.0, x: 0.05, y: 0, z: 0 },
            { t: 0.25, x: 0.08, y: 0.02, z: 0 },
            { t: 0.5, x: 0.05, y: 0, z: 0 },
            { t: 0.75, x: 0.08, y: -0.02, z: 0 },
            { t: 1.0, x: 0.05, y: 0, z: 0 }
        ]
    },

    harmonics: {
        bounce: { freq: 2.0, amp: 0.01 },
        sway: { freq: 1.0, amp: 0.015 }
    }
};

export const walkBackwardSequence = {
    name: "WalkBackward",
    duration: 1.4,
    isLoop: true,
    
    root: {
        posY: [
            { t: 0.0, v: 0.0 },
            { t: 0.25, v: 0.012 },
            { t: 0.5, v: 0.0 },
            { t: 0.75, v: 0.012 },
            { t: 1.0, v: 0.0 }
        ],
        posZ: [
            { t: 0.0, v: 0.0 },
            { t: 1.0, v: -0.25 }
        ]
    },

    bones: {
        Hips: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: -0.015, y: 0, z: -0.008 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: 0.015, y: 0, z: 0.008 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        LeftUpLeg: [
            { t: 0.0, x: 0.3, y: 0, z: 0 },
            { t: 0.25, x: -0.1, y: 0, z: 0 },
            { t: 0.5, x: -0.3, y: 0, z: 0 },
            { t: 0.75, x: 0.2, y: 0, z: 0 },
            { t: 1.0, x: 0.3, y: 0, z: 0 }
        ],
        
        RightUpLeg: [
            { t: 0.0, x: -0.3, y: 0, z: 0 },
            { t: 0.25, x: 0.2, y: 0, z: 0 },
            { t: 0.5, x: 0.3, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0, z: 0 },
            { t: 1.0, x: -0.3, y: 0, z: 0 }
        ],
        
        LeftArm: [
            { t: 0.0, x: -0.2, y: 0, z: 0.2 },
            { t: 0.5, x: 0.2, y: 0, z: 0.2 },
            { t: 1.0, x: -0.2, y: 0, z: 0.2 }
        ],
        
        RightArm: [
            { t: 0.0, x: 0.2, y: 0, z: -0.2 },
            { t: 0.5, x: -0.2, y: 0, z: -0.2 },
            { t: 1.0, x: 0.2, y: 0, z: -0.2 }
        ],
        
        Spine: [
            { t: 0.0, x: -0.05, y: 0, z: 0 },
            { t: 0.5, x: -0.08, y: 0, z: 0 },
            { t: 1.0, x: -0.05, y: 0, z: 0 }
        ]
    }
};
