"use strict";

const { logger } = require("../../managers/logger");
const handleAutocomplete = require("../autocomplete");

function routeAutocomplete(interaction, client) {
  return handleAutocomplete(interaction, client).catch((error) => {
    logger.error("[INTERAKSI] Galat pada autocomplete:", error);
  });
}

module.exports = { routeAutocomplete };
