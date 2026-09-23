/**
 * thinking.js - Keyframe animation sequence for "Thinking".
 * Nilai rotasi = Euler urutan YXZ (radian, sesuai core/interpolation.js) pada sumbu LOKAL rig Naura_Hoshino_3D_NEW.glb:
 *   X = miring ke samping (roll), Y = putar/twist, Z = maju-mundur (pitch).
 * Kunci morph memakai nama morph target GLB: Happy, Thinking, Sad, Angry, Blink, Talk.
 * Waktu 't' ternormalisasi 0..1 terhadap 'duration'.
 */

export const thinkingSequence = {
  duration: 3.2,
  isLoop: true,
  bones: {
    head: [
      { t: 0, val: [0, 0, 0] },
      { t: 0.06, val: [0.03, 0.05, 0.03] },
      { t: 0.25, val: [0.05, 0.09, 0.06] },
      { t: 0.3, val: [0.055, 0.104, 0.056] },
      { t: 0.35, val: [0.064, 0.099, 0.049] },
      { t: 0.4, val: [0.07, 0.079, 0.044] },
      { t: 0.45, val: [0.068, 0.055, 0.045] },
      { t: 0.5, val: [0.057, 0.041, 0.054] },
      { t: 0.55, val: [0.043, 0.045, 0.065] },
      { t: 0.6, val: [0.032, 0.064, 0.073] },
      { t: 0.65, val: [0.03, 0.089, 0.076] },
      { t: 0.7, val: [0.036, 0.106, 0.071] },
      { t: 0.75, val: [0.045, 0.106, 0.064] },
      { t: 0.8, val: [0.05, 0.09, 0.06] },
      { t: 0.9, val: [0.02, 0.03, 0.02] },
      { t: 1, val: [0, 0, 0] },
    ],
    spine: [
      { t: 0, val: [0, 0, 0] },
      { t: 0.25, val: [0.02, 0.02, -0.02] },
      { t: 0.8, val: [0.02, 0.02, -0.02] },
      { t: 1, val: [0, 0, 0] },
    ],
    rightUpperArm: [
      { t: 0, val: [0.11, 0, 0.01] },
      { t: 0.12, val: [0.08, -0.15, 0.8] },
      { t: 0.28, val: [0.23, -0.43, 2.48] },
      { t: 0.38, val: [0.24, -0.41, 2.46] },
      { t: 0.5, val: [0.23, -0.43, 2.48] },
      { t: 0.65, val: [0.24, -0.41, 2.46] },
      { t: 0.78, val: [0.23, -0.43, 2.48] },
      { t: 0.88, val: [0.1, -0.18, 1.0] },
      { t: 1, val: [0.11, 0, 0.01] },
    ],
    rightLowerArm: [
      { t: 0, val: [0.03, 0, 0.04] },
      { t: 0.12, val: [-0.1, -0.3, 0.6] },
      { t: 0.28, val: [-0.28, -0.82, 1.62] },
      { t: 0.38, val: [-0.26, -0.8, 1.6] },
      { t: 0.5, val: [-0.28, -0.82, 1.62] },
      { t: 0.65, val: [-0.26, -0.8, 1.6] },
      { t: 0.78, val: [-0.28, -0.82, 1.62] },
      { t: 0.88, val: [-0.12, -0.35, 0.7] },
      { t: 1, val: [0.03, 0, 0.04] },
    ],
    rightHand: [
      { t: 0, val: [0.02, 0, 0.01] },
      { t: 0.12, val: [0.05, 0, 0] },
      { t: 0.28, val: [0.2, 0.05, 0.02] },
      { t: 0.5, val: [0.22, 0.06, 0.02] },
      { t: 0.78, val: [0.2, 0.05, 0.02] },
      { t: 0.88, val: [0.05, 0, 0] },
      { t: 1, val: [0.02, 0, 0.01] },
    ],
    leftUpperArm: [
      { t: 0, val: [-0.11, 0, 0.01] },
      { t: 0.25, val: [-0.13, 0.01, 0.02] },
      { t: 0.5, val: [-0.13, 0.01, 0.02] },
      { t: 0.78, val: [-0.13, 0.01, 0.02] },
      { t: 1, val: [-0.11, 0, 0.01] },
    ],
    leftLowerArm: [
      { t: 0, val: [-0.03, 0, 0.04] },
      { t: 0.25, val: [-0.03, 0, 0.04] },
      { t: 0.5, val: [-0.03, 0, 0.04] },
      { t: 0.78, val: [-0.03, 0, 0.04] },
      { t: 1, val: [-0.03, 0, 0.04] },
    ],
    leftHand: [
      { t: 0, val: [-0.02, 0, 0.01] },
      { t: 0.25, val: [-0.02, 0, 0.01] },
      { t: 0.5, val: [-0.02, 0, 0.01] },
      { t: 0.78, val: [-0.02, 0, 0.01] },
      { t: 1, val: [-0.02, 0, 0.01] },
    ],
  },
  morphs: {
    Thinking: [
      { t: 0, val: 0.2 },
      { t: 0.25, val: 0.75 },
      { t: 0.5, val: 0.9 },
      { t: 0.8, val: 0.75 },
      { t: 1, val: 0.2 },
    ],
    Happy: [
      { t: 0, val: 0.1 },
      { t: 0.5, val: 0.2 },
      { t: 1, val: 0.1 },
    ],
  },
  root: {
    posY: [
      { t: 0, val: 0.005 },
      { t: 0.5, val: 0.01 },
      { t: 1, val: 0.005 },
    ],
    scale: [
      { t: 0, val: 1 },
      { t: 1, val: 1 },
    ],
  },
};

export default thinkingSequence;
