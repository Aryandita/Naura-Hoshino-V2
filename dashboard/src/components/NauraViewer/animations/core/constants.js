/**
 * core/constants.js - Definisi konstanta kinematika dan tulang Naura Hoshino.
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

export const DEFAULT_REST_BONES = {
    hips: [0, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    upperChest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    leftShoulder: [0, 0, 0.02],
    rightShoulder: [0, 0, -0.02],
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

export const HUMANOID_BONE_KEYS = [
    "hips",
    "spine",
    "chest",
    "upperChest",
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
    // VRM 1.0 nama baru untuk kaki
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    // VRM 0.x / gaya lama (fallback)
    "rightUpLeg",
    "rightLeg",
    "leftUpLeg",
    "leftLeg",
];

export const GLB_BONE_PATTERNS = {
    hips: /^(hips?|pelvis|root)$/i,
    spine: /^(spine)$/i,
    chest: /^(chest|spine1)$/i,
    upperChest: /^(upper_?chest|chest2|spine2)$/i,
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
    // VRM 1.0
    rightUpperLeg: /^(right_?upper_?leg|r_?upper_?leg|right_?thigh|r_?thigh|rightUpperLeg)$/i,
    rightLowerLeg: /^(right_?lower_?leg|r_?lower_?leg|right_?calf|r_?calf|right_?shin|rightLowerLeg)$/i,
    rightFoot: /^(right_?foot|r_?foot|foot[._]r)$/i,
    leftUpperLeg: /^(left_?upper_?leg|l_?upper_?leg|left_?thigh|l_?thigh|leftUpperLeg)$/i,
    leftLowerLeg: /^(left_?lower_?leg|l_?lower_?leg|left_?calf|l_?calf|left_?shin|leftLowerLeg)$/i,
    leftFoot: /^(left_?foot|l_?foot|foot[._]l)$/i,
    // VRM 0.x fallback
    rightUpLeg: /^(right_?upleg|r_?upleg)$/i,
    rightLeg: /^(right_?leg|r_?leg)$/i,
    leftUpLeg: /^(left_?upleg|l_?upleg)$/i,
    leftLeg: /^(left_?leg|l_?leg)$/i,
};

