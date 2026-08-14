const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("password")
    .setDescription("🔑 Generate password acak yang kuat (Dikirim via DM).")
    .addIntegerOption((opt) =>
      opt
        .setName("panjang")
        .setDescription("Panjang password (8-32 karakter, default 16)")
        .setRequired(false)
        .setMinValue(8)
        .setMaxValue(32),
    ),

  async execute(interaction) {
    const length = interaction.options.getInteger("panjang") || 16;

    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";

    // Ensure at least one of each type
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    password += "0123456789"[Math.floor(Math.random() * 10)];
    password += "!@#$%^&*()_+~`|}{[]:;?><,./-="[Math.floor(Math.random() * 29)];

    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    password = password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#00FF00",
      title: "🔑 Password Generator",
      description: `Berikut adalah password acakmu (${length} karakter):\n\n\`\`\`\n${password}\n\`\`\`\n*Tolong simpan password ini dengan aman!*`,
      footerText: ui.getFooter("utility"),
    });

    try {
      await interaction.user.send(payload);
      await interaction.reply({
        content: `${ui.getEmoji("success")} Aku telah mengirimkan password yang aman ke DM (Direct Message) milikmu!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      await interaction.reply({
        content: `${ui.getEmoji("cross")} Aku tidak bisa mengirim DM kepadamu. Silakan buka DM-mu terlebih dahulu. Jika ini tidak rahasia, berikut passwordnya:\n||${password}||`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
