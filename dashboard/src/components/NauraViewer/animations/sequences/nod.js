/**
 * sequences/nod.js - Animasi nod yes dan shake no untuk respon interaktif.
 * 
 * Digunakan untuk konfirmasi sederhana tanpa perlu dialog box.
 * Sangat berguna untuk interaksi cepat di dashboard atau Discord.
 */

export const nodYesSequence = {
    name: "NodYes",
    duration: 1.2,
    isLoop: false,
    
    root: {
        posY: [
            { t: 0.0, v: 0.0 },
            { t: 0.3, v: 0.01 },
            { t: 0.6, v: 0.0 },
            { t: 0.9, v: 0.01 },
            { t: 1.2, v: 0.0 }
        ]
    },

    bones: {
        Neck: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.15, x: 0.25, y: 0, z: 0 },
            { t: 0.3, x: 0, y: 0, z: 0 },
            { t: 0.45, x: 0.25, y: 0, z: 0 },
            { t: 0.6, x: 0, y: 0, z: 0 },
            { t: 0.75, x: 0.2, y: 0, z: 0 },
            { t: 0.9, x: 0, y: 0, z: 0 },
            { t: 1.2, x: 0, y: 0, z: 0 }
        ],
        
        Head: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.15, x: 0.3, y: 0, z: 0 },
            { t: 0.3, x: 0, y: 0, z: 0 },
            { t: 0.45, x: 0.3, y: 0, z: 0 },
            { t: 0.6, x: 0, y: 0, z: 0 },
            { t: 0.75, x: 0.25, y: 0, z: 0 },
            { t: 0.9, x: 0, y: 0, z: 0 },
            { t: 1.2, x: 0, y: 0, z: 0 }
        ],
        
        Chest: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.15, x: 0.05, y: 0, z: 0 },
            { t: 0.3, x: 0, y: 0, z: 0 },
            { t: 0.45, x: 0.05, y: 0, z: 0 },
            { t: 0.6, x: 0, y: 0, z: 0 },
            { t: 1.2, x: 0, y: 0, z: 0 }
        ]
    },

    morphs: {
        Happy: [
            { t: 0.0, v: 0.6 },
            { t: 0.3, v: 0.8 },
            { t: 0.6, v: 0.6 },
            { t: 0.9, v: 0.7 },
            { t: 1.2, v: 0.5 }
        ]
    }
};

export const shakeNoSequence = {
    name: "ShakeNo",
    duration: 1.4,
    isLoop: false,
    
    root: {
        rotY: [
            { t: 0.0, v: 0.0 },
            { t: 0.2, v: 0.2 },
            { t: 0.4, v: -0.2 },
            { t: 0.6, v: 0.15 },
            { t: 0.8, v: -0.15 },
            { t: 1.0, v: 0.1 },
            { t: 1.2, v: -0.1 },
            { t: 1.4, v: 0.0 }
        ]
    },

    bones: {
        Neck: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.2, x: 0, y: 0.25, z: 0 },
            { t: 0.4, x: 0, y: -0.25, z: 0 },
            { t: 0.6, x: 0, y: 0.2, z: 0 },
            { t: 0.8, x: 0, y: -0.2, z: 0 },
            { t: 1.0, x: 0, y: 0.15, z: 0 },
            { t: 1.2, x: 0, y: -0.15, z: 0 },
            { t: 1.4, x: 0, y: 0, z: 0 }
        ],
        
        Head: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.2, x: 0, y: 0.3, z: 0 },
            { t: 0.4, x: 0, y: -0.3, z: 0 },
            { t: 0.6, x: 0, y: 0.25, z: 0 },
            { t: 0.8, x: 0, y: -0.25, z: 0 },
            { t: 1.0, x: 0, y: 0.2, z: 0 },
            { t: 1.2, x: 0, y: -0.2, z: 0 },
            { t: 1.4, x: 0, y: 0, z: 0 }
        ],
        
        Chest: [
            { t: 0.0, x: 0, y: 0, z: 0 },
            { t: 0.2, x: 0, y: 0.05, z: 0 },
            { t: 0.4, x: 0, y: -0.05, z: 0 },
            { t: 0.6, x: 0, y: 0.04, z: 0 },
            { t: 0.8, x: 0, y: -0.04, z: 0 },
            { t: 1.0, x: 0, y: 0.03, z: 0 },
            { t: 1.2, x: 0, y: -0.03, z: 0 },
            { t: 1.4, x: 0, y: 0, z: 0 }
        ]
    },

    morphs: {
        Thinking: [
            { t: 0.0, v: 0.4 },
            { t: 0.7, v: 0.6 },
            { t: 1.4, v: 0.3 }
        ]
    }
};
