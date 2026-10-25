/**
 * sequences/sit.js - Animasi duduk santai untuk status AFK atau lounge.
 * 
 * Postur duduk natural dengan sedikit gerakan idle agar tidak terlihat kaku.
 * Cocok untuk Discord status "AFK" atau dashboard lounge area.
 */

export const sitSequence = {
    name: "Sit",
    duration: 4.0,
    isLoop: true,
    
    root: {
        posY: [
            { t: 0.0, v: -0.35 },
            { t: 1.0, v: -0.35 }
        ]
    },

    bones: {
        Hips: [
            { t: 0.0, x: -0.8, y: 0, z: 0 },
            { t: 2.0, x: -0.82, y: 0, z: 0.01 },
            { t: 4.0, x: -0.8, y: 0, z: 0 }
        ],
        
        LeftUpLeg: [
            { t: 0.0, x: -1.4, y: 0.1, z: 0 },
            { t: 2.0, x: -1.42, y: 0.1, z: 0.01 },
            { t: 4.0, x: -1.4, y: 0.1, z: 0 }
        ],
        
        LeftLeg: [
            { t: 0.0, x: 1.5, y: 0, z: 0 },
            { t: 2.0, x: 1.52, y: 0, z: 0 },
            { t: 4.0, x: 1.5, y: 0, z: 0 }
        ],
        
        RightUpLeg: [
            { t: 0.0, x: -1.4, y: -0.1, z: 0 },
            { t: 2.0, x: -1.38, y: -0.1, z: -0.01 },
            { t: 4.0, x: -1.4, y: -0.1, z: 0 }
        ],
        
        RightLeg: [
            { t: 0.0, x: 1.5, y: 0, z: 0 },
            { t: 2.0, x: 1.48, y: 0, z: 0 },
            { t: 4.0, x: 1.5, y: 0, z: 0 }
        ],
        
        Spine: [
            { t: 0.0, x: 0.3, y: 0, z: 0 },
            { t: 2.0, x: 0.32, y: 0, z: 0.005 },
            { t: 4.0, x: 0.3, y: 0, z: 0 }
        ],
        
        Chest: [
            { t: 0.0, x: 0.1, y: 0, z: 0 },
            { t: 2.0, x: 0.12, y: 0, z: 0 },
            { t: 4.0, x: 0.1, y: 0, z: 0 }
        ],
        
        LeftArm: [
            { t: 0.0, x: 0.4, y: 0, z: 0.3 },
            { t: 2.0, x: 0.42, y: 0, z: 0.32 },
            { t: 4.0, x: 0.4, y: 0, z: 0.3 }
        ],
        
        LeftForeArm: [
            { t: 0.0, x: -0.6, y: 0, z: 0 },
            { t: 2.0, x: -0.62, y: 0, z: 0 },
            { t: 4.0, x: -0.6, y: 0, z: 0 }
        ],
        
        RightArm: [
            { t: 0.0, x: 0.4, y: 0, z: -0.3 },
            { t: 2.0, x: 0.38, y: 0, z: -0.32 },
            { t: 4.0, x: 0.4, y: 0, z: -0.3 }
        ],
        
        RightForeArm: [
            { t: 0.0, x: -0.6, y: 0, z: 0 },
            { t: 2.0, x: -0.58, y: 0, z: 0 },
            { t: 4.0, x: -0.6, y: 0, z: 0 }
        ],
        
        Neck: [
            { t: 0.0, x: 0.05, y: 0, z: 0 },
            { t: 2.0, x: 0.07, y: 0.02, z: 0 },
            { t: 4.0, x: 0.05, y: 0, z: 0 }
        ],
        
        Head: [
            { t: 0.0, x: 0.1, y: 0, z: 0 },
            { t: 1.0, x: 0.12, y: 0.03, z: 0.02 },
            { t: 2.0, x: 0.1, y: 0, z: 0 },
            { t: 3.0, x: 0.08, y: -0.02, z: -0.01 },
            { t: 4.0, x: 0.1, y: 0, z: 0 }
        ]
    },

    morphs: {
        Happy: [
            { t: 0.0, v: 0.3 },
            { t: 2.0, v: 0.4 },
            { t: 4.0, v: 0.3 }
        ],
        Blink: [
            { t: 0.0, v: 0.0 },
            { t: 1.5, v: 0.0 },
            { t: 1.6, v: 0.8 },
            { t: 1.7, v: 0.0 },
            { t: 3.2, v: 0.0 },
            { t: 3.3, v: 0.8 },
            { t: 3.4, v: 0.0 },
            { t: 4.0, v: 0.0 }
        ]
    },

    harmonics: {
        breath: { freq: 0.5, amp: 0.008 },
        headSway: { freq: 0.3, amp: 0.015 }
    }
};
