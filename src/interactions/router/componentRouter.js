"use strict";

const { logger } = require("../../managers/logger");
const rateLimiter = require("../../utils/rateLimiter");
const registry = require("../registry");
const { safeExecute } = require("../safeExecute");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const {
  withEphemeralFlags,
  translateText,
  resolveComponentKind,
} = require("./interactionGuards");

const COMPONENT_LIMIT = Object.freeze({ max: 8, seconds: 5 });

async function handleComponent(interaction, client) {
  const componentKind = resolveComponentKind(interaction);
  if (!componentKind) return undefined;
  const registeredComponentHandler = registry.resolve(
    componentKind,
    interaction.customId,
  );
  if (!registeredComponentHandler) {
    setTimeout(async () => {
      if (!interaction.deferred && !interaction.replied) {
        logger.warn(
          `[INTERAKSI EXPIRED] Komponen tidak ditanggapi penangan aktif: ${componentKind}:${interaction.customId}`,
        );
        await interaction
          .reply(
            withEphemeralFlags(
              buildErrorContainerV2({
                lang: interaction.localeLang,
                title: translateText(
                  interaction.localeLang,
                  "interaction.stale_component.title",
                ),
                errorMessage: translateText(
                  interaction.localeLang,
                  "interaction.stale_component.body",
                ),
                expressionImage: false,
              }),
            ),
          )
          .catch(() => {});
      }
    }, 2650);
    return undefined;
  }
  const componentRateLimitPolicy =
    registeredComponentHandler.cooldown || COMPONENT_LIMIT;
  let isComponentRateLimited = false;
  try {
    isComponentRateLimited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `component_${registeredComponentHandler.label}`,
      componentRateLimitPolicy.max,
      componentRateLimitPolicy.seconds,
    );
  } catch (error) {
    logger.error("[INTERAKSI] Gagal mengecek rate limit komponen:", error);
  }
  if (isComponentRateLimited) {
    return interaction
      .reply(
        withEphemeralFlags(
          buildErrorContainerV2({
            authorName: "Naura Action Guard",
            title: "Pelan-Pelan Ya!",
            errorMessage:
              "Kamu menekan tombol terlalu cepat. Harap berikan jeda sebentar ya!",
            lang: interaction.localeLang,
            expression: "sleepy",
          }),
        ),
      )
      .catch(() => {});
  }
  return await safeExecute(interaction, registeredComponentHandler, client);
}

module.exports = { handleComponent, COMPONENT_LIMIT };
