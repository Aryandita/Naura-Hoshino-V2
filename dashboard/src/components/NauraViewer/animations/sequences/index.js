/**
 * sequences/index.js - Aggregates all 31 independent animation sequences.
 * Selaras dengan Technical Specification v1.0.0 (A01 - A31).
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
import { walkForwardSequence, walkBackwardSequence } from "./walk.js";
import { sitSequence } from "./sit.js";
import { danceLoop1Sequence, danceLoop2Sequence } from "./dance.js";
import { typeSequence } from "./type.js";
import { nodYesSequence, shakeNoSequence } from "./nod.js";

// Sequences tambahan (A19 - A31)
import { combatStanceSequence, craftSequence, pointSequence } from "./rpg.js";
import { saluteSequence, bowSequence, holdItemSequence, readSequence } from "./social.js";
import { drinkSequence, eatSequence, yawnSequence, stretchSequence } from "./cafe.js";
import { turnLeftSequence, turnRightSequence } from "./turn.js";

export const ANIMATION_DEFINITIONS = {
    // 4.1 Priority HIGH (Core Interactions)
    "Idle": idleSequence,
    "Wave": waveSequence,
    "Thinking": thinkingSequence,
    "NodYes": nodYesSequence,
    "ShakeNo": shakeNoSequence,
    "WalkForward": walkForwardSequence,
    "WalkBackward": walkBackwardSequence,
    "Sit": sitSequence,

    // 4.2 Priority MEDIUM (Enhanced UX)
    "Type": typeSequence,
    "DanceLoop1": danceLoop1Sequence,
    "DanceLoop2": danceLoop2Sequence,
    "Cheers": cheersSequence,
    "Shy": shySequence,
    "Sleepy": sleepySequence,
    "BlowKiss": blowKissSequence,

    // 4.3 Priority LOW (RPG, Cafe, Social, Nav)
    "AstralCast": astralCastSequence,
    "StarPose": starPoseSequence,
    "Dizzy": dizzySequence,
    "Read": readSequence,
    "HoldItem": holdItemSequence,
    "Salute": saluteSequence,
    "Bow": bowSequence,
    "Yawn": yawnSequence,
    "Stretch": stretchSequence,
    "CombatStance": combatStanceSequence,
    "Craft": craftSequence,
    "Drink": drinkSequence,
    "Eat": eatSequence,
    "Point": pointSequence,
    "TurnLeft": turnLeftSequence,
    "TurnRight": turnRightSequence,
};

export default ANIMATION_DEFINITIONS;
