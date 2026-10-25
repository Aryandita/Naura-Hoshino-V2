/**
 * sequences/dance.js - Animasi dance loop untuk music player.
 * 
 * 2 variasi dance:
 * - DanceLoop1: Upbeat energetic (untuk lagu cepat)
 * - DanceLoop2: Smooth groovy (untuk lagu slow/mid-tempo)
 */

export const danceLoop1Sequence = {
    name: "DanceLoop1",
    duration: 2.0,
    isLoop: true,
    
    root: {
        posY: [
            { t: 0.0, v: 0.0 },
            { t: 0.25, v: 0.04 },
            { t: 0.5, v: 0.0 },
            { t: 0.75, v: 0.04 },
            { t: 1.0, v: 0.0 }
        ],
        rotY: [
            { t: 0.0, v: 0.0 },
            { t: 0.25, v: 0.15 },
            { t: 0.5, v: 0.0 },
            { t: 0.75, v: -0.15 },
            { t: 1.0, v: 0.0 }
        ]
    },

    bones: {
        Hips: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.1, y: 0.15, z: 0.05 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0.15, z: -0.05 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        Spine: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.05, y: 0.1, z: 0.03 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.05, y: 0.1, z: -0.03 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        Chest: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.08, y: 0.12, z: 0.04 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.08, y: 0.12, z: -0.04 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        LeftArm: [
            { t: 0.0, x: -2.5, y: 0, z: 0.3 },
            { t: 0.25, x: -2.8, y: 0.2, z: 0.5 },
            { t: 0.5, x: -2.5, y: 0, z: 0.3 },
            { t: 0.75, x: -2.2, y: -0.2, z: 0.1 },
            { t: 1.0, x: -2.5, y: 0, z: 0.3 }
        ],
        
        LeftForeArm: [
            { t: 0.0, x: -0.3, y: 0, z: 0 },
            { t: 0.25, x: -0.5, y: 0, z: 0.2 },
            { t: 0.5, x: -0.3, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0, z: -0.2 },
            { t: 1.0, x: -0.3, y: 0, z: 0 }
        ],
        
        RightArm: [
            { t: 0.0, x: -2.5, y: 0, z: -0.3 },
            { t: 0.25, x: -2.2, y: -0.2, z: -0.1 },
            { t: 0.5, x: -2.5, y: 0, z: -0.3 },
            { t: 0.75, x: -2.8, y: 0.2, z: -0.5 },
            { t: 1.0, x: -2.5, y: 0, z: -0.3 }
        ],
        
        RightForeArm: [
            { t: 0.0, x: -0.3, y: 0, z: 0 },
            { t: 0.25, x: -0.1, y: 0, z: -0.2 },
            { t: 0.5, x: -0.3, y: 0, z: 0 },
            { t: 0.75, x: -0.5, y: 0, z: 0.2 },
            { t: 1.0, x: -0.3, y: 0, z: 0 }
        ],
        
        LeftUpLeg: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.3, y: 0, z: 0.1 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0, z: 0 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        RightUpLeg: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: -0.1, y: 0, z: 0 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: 0.3, y: 0, z: -0.1 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        Head: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.25, x: 0.1, y: 0.15, z: 0.05 },
            { t: 0.5, x: 0, y: 0, z: 0 },
            { t: 0.75, x: -0.1, y: 0.15, z: -0.05 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ]
    },

    morphs: {
        Happy: [
            { t: 0.0, v: 0.9 },
            { t: 0.5, v: 1.0 },
            { t: 1.0, v: 0.9 }
        ]
    },

    harmonics: {
        bounce: { freq: 4.0, amp: 0.03 },
        sway: { freq: 2.0, amp: 0.08 }
    }
};

export const danceLoop2Sequence = {
    name: "DanceLoop2",
    duration: 3.0,
    isLoop: true,
    
    root: {
        posY: [
            { t: 0.0, v: 0.0 },
            { t: 0.5, v: 0.02 },
            { t: 1.0, v: 0.0 }
        ],
        rotY: [
            { t: 0.0, v: 0.0 },
            { t: 0.5, v: 0.08 },
            { t: 1.0, v: 0.0 }
        ]
    },

    bones: {
        Hips: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.5, x: 0.05, y: 0.08, z: 0.03 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        Spine: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.5, x: 0.03, y: 0.06, z: 0.02 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ],
        
        LeftArm: [
            { t: 0.0, x: -0.5, y: 0, z: 0.4 },
            { t: 0.5, x: -0.8, y: 0.1, z: 0.6 },
            { t: 1.0, x: -0.5, y: 0, z: 0.4 }
        ],
        
        LeftForeArm: [
            { t: 0.0, x: -0.4, y: 0, z: 0 },
            { t: 0.5, x: -0.6, y: 0, z: 0.3 },
            { t: 1.0, x: -0.4, y: 0, z: 0 }
        ],
        
        RightArm: [
            { t: 0.0, x: -0.5, y: 0, z: -0.4 },
            { t: 0.5, x: -0.8, y: 0.1, z: -0.6 },
            { t: 1.0, x: -0.5, y: 0, z: -0.4 }
        ],
        
        RightForeArm: [
            { t: 0.0, x: -0.4, y: 0, z: 0 },
            { t: 0.5, x: -0.6, y: 0, z: -0.3 },
            { t: 1.0, x: -0.4, y: 0, z: 0 }
        ],
        
        Head: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.5, x: 0.05, y: 0.08, z: 0.03 },
            { t: 1.0, x: 0, y: 0, z: 0 }
        ]
    },

    morphs: {
        Happy: [
            { t: 0.0, v: 0.7 },
            { t: 0.5, v: 0.85 },
            { t: 1.0, v: 0.7 }
        ]
    },

    harmonics: {
        groove: { freq: 1.5, amp: 0.04 },
        headBob: { freq: 1.0, amp: 0.02 }
    }
};
