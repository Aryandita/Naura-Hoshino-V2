const {
  lavalinkClusterManager,
} = require("../../managers/lavalinkClusterManager");

module.exports = {
  async execute(manager, node, reason) {
    const reasonText =
      reason?.code ||
      reason?.reason ||
      (typeof reason === "string" ? reason : "Unknown");
    console.warn(
      `\x1b[43m\x1b[30m ⚠️ NODE DISCONNECT \x1b[0m Node ${node?.name || "Unknown"} disconnected. Reason: ${reasonText}`,
    );

    lavalinkClusterManager.recordNodeError(node?.name, reasonText);

    // Migrasi otomatis seluruh player yang terikat ke node yang disconnect
    if (manager?.poru?.players) {
      const affectedPlayers = [...manager.poru.players.values()].filter(
        (p) => p.node === node || p.node?.name === node?.name,
      );

      for (const player of affectedPlayers) {
        lavalinkClusterManager
          .migratePlayer(manager.poru, player, node, reasonText)
          .catch((err) => {
            console.error(
              `[nodeDisconnect] Gagal memigrasikan player ${player.guildId}:`,
              err,
            );
          });
      }
    }
  },
};
