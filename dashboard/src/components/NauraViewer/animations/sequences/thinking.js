/**
 * thinking.js - Keyframe animation sequence for "Thinking".
 * Generated from Naura Hoshino kinematic definitions.
 */

export const thinkingSequence = {
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
};

export default thinkingSequence;
