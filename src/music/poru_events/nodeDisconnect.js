module.exports = {
  async execute(manager, node, reason) {
    const reasonText =
      reason?.code ||
      reason?.reason ||
      (typeof reason === "string" ? reason : "Unknown");
    console.warn(
      `\x1b[43m\x1b[30m ⚠️ NODE DISCONNECT \x1b[0m Node ${node?.name || "Unknown"} disconnected. Reason: ${reasonText}`,
    );
  },
};
