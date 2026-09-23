/**
 * sequences/index.js - Aggregates all independent animation sequences.
 */

import { idleSequence } from "./idle.js";
import { waveSequence } from "./wave.js";
import { thinkingSequence } from "./thinking.js";
import { dizzySequence } from "./dizzy.js";
import { cheersSequence } from "./cheers.js";
import { shySequence } from "./shy.js";
import { sleepySequence } from "./sleepy.js";
import { blowKissSequence } from "./blowkiss.js";
import { astralCastSequence } from "./astralcast.js";
import { starPoseSequence } from "./starpose.js";

export const ANIMATION_DEFINITIONS = {
  Idle: idleSequence,
  Wave: waveSequence,
  Thinking: thinkingSequence,
  Dizzy: dizzySequence,
  Cheers: cheersSequence,
  Shy: shySequence,
  Sleepy: sleepySequence,
  BlowKiss: blowKissSequence,
  AstralCast: astralCastSequence,
  StarPose: starPoseSequence,
};

export default ANIMATION_DEFINITIONS;
