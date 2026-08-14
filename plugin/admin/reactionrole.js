const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { logger } = require("../../src/managers/logger");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const MAX_SLOTS = 3;

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

// Role terkelola dan role di atas posisi bot tidak akan pernah bisa diberikan,
// jadi lebih baik ditolak sekarang daripada gagal saat tombolnya ditekan.
function rejectionReason(role, me) {
  if (role.managed) return "dikelola integrasi lain";
  if (role.id === role.guild.id) return "role bawaan @everyone";
  if (me && role.position >= me.roles.highest.position)
    return "posisinya di atas role Naura";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Buat panel tombol untuk role otomatis")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((opt) =>
      opt
        .setName("pesan")
        .setDescription("Pesan yang akan ditampilkan")
        .setRequired(true),
    )
    .addRoleOption((opt) =>
      opt.setName("role1").setDescription("Role pertama").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("label1")
        .setDescription("Label tombol pertama")
        .setRequired(false),
    )
    .addRoleOption((opt) =>
      opt.setName("role2").setDescription("Role kedua").setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("label2")
        .setDescription("Label tombol kedua")
        .setRequired(false),
    )
    .addRoleOption((opt) =>
      opt.setName("role3").setDescription("Role ketiga").setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("label3")
        .setDescription("Label tombol ketiga")
        .setRequired(false),
    ),

  async execute(interaction) {
    const message = interaction.options.getString("pesan");
    const me = interaction.guild.members.me;

    const slots = [];
    for (let i = 1; i <= MAX_SLOTS; i += 1) {
      const role = interaction.options.getRole(`role${i}`);
      if (role)
        slots.push({ role, label: interaction.options.getString(`label${i}`) });
    }

    const usable = [];
    const rejected = [];

    for (const slot of slots) {
      const reason = rejectionReason(slot.role, me);
      if (reason) rejected.push(`<@&${slot.role.id}> (${reason})`);
      else usable.push(slot);
    }

    if (usable.length === 0) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Belum bisa dibuat",
            description:
              "Naura tidak bisa memberikan satu pun role itu ke anggota.\n\n" +
              `Yang ditolak: ${rejected.join(", ")}\n\n` +
              "Coba naikkan posisi role Naura di pengaturan server ya!",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const row = new ActionRowBuilder();
    for (const slot of usable) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_assign_${slot.role.id}`)
          .setLabel((slot.label || slot.role.name).slice(0, 80))
          .setStyle(ButtonStyle.Primary),
      );
    }

    const panelPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      title: "Silakan Pilih Rolemu",
      expression: "help",
      description: message,
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    try {
      await interaction.channel.send(panelPayload);
    } catch (error) {
      logger.error("[ReactionRole] Gagal mengirim panel: " + error.message);
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Panelnya gagal terkirim",
            description:
              "Naura sepertinya belum punya izin mengirim pesan di channel ini. Boleh dicek dulu?",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const catatan =
      rejected.length > 0
        ? `\n\nTapi ada yang Naura lewati: ${rejected.join(", ")}`
        : "";

    return interaction.reply(
      ephemeral(
        buildContainerV2({
          accentColorHex: ui.getColor("success"),
          title: "Panel Berhasil Dibuat",
          expression: "success",
          description: `Panelnya sudah Naura pasang dengan ${usable.length} tombol role!${catatan}`,
          footerText: ui.getFooter("core"),
        }),
      ),
    );
  },
};
