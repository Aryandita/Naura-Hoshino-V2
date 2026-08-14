module.exports = {
  async execute(manager, node, reason) {
    console.warn(
      `\x1b[43m\x1b[30m ⚠️ NODE DISCONNECT \x1b[0m Node ${node.name} disconnected. Reason: ${reason.code || "Unknown"}`,
    );
  },
};
