"use strict";

const {
  buildHelpPayload,
  handleCommandDetailHelp,
} = require("../../../src/core/helpView");
const { createManagedCollector } = require("../../../src/utils/interactionPipeline");

async function handleHelp(interaction, client, lang) {
  const query = interaction.options?.getString("command");

  if (query) {
    const detailPayload = handleCommandDetailHelp(query, lang);
    if (interaction.reply && !interaction.deferred) {
      return interaction.reply(detailPayload);
    }
    return interaction.editReply(detailPayload);
  }

  const payload = buildHelpPayload({
    language: lang,
    categoryIndex: -1,
    disabled: false,
    user: interaction.user,
  });

  let response;
  if (interaction.reply && !interaction.deferred) {
    response = await interaction.reply({ ...payload, fetchReply: true });
  } else {
    response = await interaction.editReply(payload);
  }

  if (response && typeof response.createMessageComponentCollector === "function") {
    createManagedCollector(response, interaction.user, {
      time: 120000,
      componentType: null,
      autoDisableOnEnd: false,
      onEnd: async (collected, reason) => {
        if (reason !== "navigated") {
          try {
            let catIndex = -1;
            let subPage = 0;
            const latestMsg =
              typeof response.fetch === "function"
                ? await response.fetch().catch(() => null)
                : response;
            if (latestMsg) {
              const { getCurrentState } = require("../../../src/interactions/buttons/coreHelp");
              const state = getCurrentState({ message: latestMsg });
              catIndex = state.currentIndex;
              subPage = state.currentSubPage;
            }
            const disabledData = buildHelpPayload({
              language: lang,
              categoryIndex: catIndex,
              disabled: true,
              user: interaction.user,
              subPage: subPage,
            });
            await (latestMsg || response).edit({
              flags: disabledData.flags,
              components: disabledData.components,
              files: disabledData.files || [],
            });
          } catch (_) {}
        }
      },
    });
  }

  return response;
}

async function autocomplete(interaction, client) {
  const { fuzzyFilter } = require("../../../src/utils/autocompleteHelper");
  const commandRegistry = require("../../../src/services/commandRegistry");
  const focusedValue = interaction.options.getFocused().toLowerCase();

  const allChoices = [];
  const allCommands = commandRegistry.getAllCommands();
  if (allCommands.length > 0) {
    for (const cmd of allCommands) {
      allChoices.push({ name: `/${cmd.name}`, value: cmd.name });
      if (Array.isArray(cmd.subcommands)) {
        for (const sub of cmd.subcommands) {
          allChoices.push({ name: `/${sub.fullName}`, value: sub.fullName });
        }
      }
    }
  } else if (client && client.commands) {
    for (const [cmdName, cmdData] of client.commands.entries()) {
      allChoices.push({ name: `/${cmdName}`, value: cmdName });
      if (Array.isArray(cmdData.data?.options)) {
        for (const opt of cmdData.data.options) {
          if (opt.type === 1) {
            allChoices.push({ name: `/${cmdName} ${opt.name}`, value: `${cmdName} ${opt.name}` });
          }
        }
      }
    }
  }

  const filtered = focusedValue
    ? fuzzyFilter(allChoices, focusedValue, 25)
    : allChoices.slice(0, 25);

  await interaction.respond(filtered).catch(() => {});
}

handleHelp.autocomplete = autocomplete;

module.exports = handleHelp;
