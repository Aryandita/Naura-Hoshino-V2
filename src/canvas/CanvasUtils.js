"use strict";

/**
 * CanvasUtils, backward-compatible barrel re-exporting the split canvas
 * modules so existing require("../canvas/CanvasUtils") consumers keep working.
 */

const helpers = require("./helpers/canvasPrimitives");
const { generateSurvivalProfileImage } = require("./survivalProfileCanvas");
const { generateMusicProfileImage, generateMusicPanelImage } = require("./musicCardCanvas");
const { generateWelcomeImage } = require("./welcomeCanvas");
const { generateLevel } = require("./levelCanvas");
const { generatePremiumTierCard, generatePremiumInfoCard } = require("./premiumCanvas");
const { generateRankCard } = require("./rankCanvas");
const { generateInventoryBackpackImage } = require("./inventoryCanvas");

const CanvasUtils = {
  ...helpers,
  generateSurvivalProfileImage,
  generateInventoryBackpackImage,
  generateMusicProfileImage,
  generateMusicPanelImage,
  generateWelcomeImage,
  generateLevel,
  generatePremiumTierCard,
  generatePremiumInfoCard,
  generateRankCard,
};

module.exports = {
  ...helpers,
  generateSurvivalProfileImage,
  generateInventoryBackpackImage,
  generateMusicProfileImage,
  generateMusicPanelImage,
  generateWelcomeImage,
  generateLevel,
  generatePremiumTierCard,
  generatePremiumInfoCard,
  generateRankCard,
  CanvasUtils,
};

