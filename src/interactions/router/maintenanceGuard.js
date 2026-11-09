"use strict";

const env = require("../../config/env");
const {
  buildMaintenanceContainerV2,
} = require("../../utils/NauraContainerBuilder");
const { withEphemeralFlags } = require("./interactionGuards");

function checkMaintenance(interaction, client) {
  const isOwnerUser =
    env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id);
  if (client.isShuttingDown || (client.isMaintenance && !isOwnerUser)) {
    const msg = client.isShuttingDown
      ? "Naura sedang dalam proses shutdown / restart server. Mohon tunggu beberapa saat ya!"
      : client.maintenanceReason ||
        "Naura sedang dalam mode pemeliharaan sistem. Hanya Developer yang dapat berinteraksi saat ini.";
    return interaction
      .reply(
        withEphemeralFlags(
          buildMaintenanceContainerV2({
            authorName: "Naura System Status",
            title: client.isShuttingDown
              ? "Sedang Restart / Shutdown"
              : "Mode Pemeliharaan Sistem",
            maintenanceMessage: msg,
            lang: interaction.localeLang,
            withBanner: true,
          }),
        ),
      )
      .catch(() => {});
  }
  return undefined;
}

module.exports = { checkMaintenance };
