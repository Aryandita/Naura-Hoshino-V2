const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require("discord.js");
const UserProfile = require("../../src/models/UserProfile");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notification")
    .setDescription("⚙️ Atur preferensi Notifikasi DM cerdas dari Naura."),
    
  async execute(interaction) {
    const userId = interaction.user.id;
    const [profile] = await UserProfile.findOrCreate({ where: { userId } });
    
    const prefs = profile.notification_prefs || {
      dm_authorized: false,
      stamina_full: true,
      quest_reset: true,
      event_news: true
    };

    const buildMenu = (currentPrefs) => {
      const select = new StringSelectMenuBuilder()
        .setCustomId("notif_settings")
        .setPlaceholder("Pilih notifikasi yang ingin kamu nyalakan/matikan")
        .setMinValues(0)
        .setMaxValues(3)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("⚡ Stamina RPG Penuh")
            .setDescription("Beritahu saat stamina 100/100")
            .setValue("stamina_full")
            .setDefault(!!currentPrefs.stamina_full),
          new StringSelectMenuOptionBuilder()
            .setLabel("📜 Reset Quest Harian")
            .setDescription("Beritahu saat jam 00:00 (Reset harian)")
            .setValue("quest_reset")
            .setDefault(!!currentPrefs.quest_reset),
          new StringSelectMenuOptionBuilder()
            .setLabel("📰 Info Event Baru")
            .setDescription("Beritahu jika ada event/pembaruan penting")
            .setValue("event_news")
            .setDefault(!!currentPrefs.event_news)
        );
      
      return new ActionRowBuilder().addComponents(select);
    };

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      title: "⚙️ Pengaturan Notifikasi DM",
      description: "Centang notifikasi yang ingin kamu terima melalui Direct Message. Custom Reminder selalu aktif dan akan dikirim secara otomatis ke DM kamu jika disetel menggunakan `/remind`.",
      expression: "Happy",
      footerText: ui.getFooter("utility")
    });

    const msg = await interaction.reply({
      ...payload,
      components: [...payload.components, buildMenu(prefs)],
      flags: MessageFlags.Ephemeral
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on("collect", async (i) => {
      if (i.customId === "notif_settings") {
        const selected = i.values;
        prefs.stamina_full = selected.includes("stamina_full");
        prefs.quest_reset = selected.includes("quest_reset");
        prefs.event_news = selected.includes("event_news");

        profile.notification_prefs = prefs;
        profile.changed("notification_prefs", true);
        await profile.save();

        await i.update({
           components: [...payload.components, buildMenu(prefs)]
        });

        await i.followUp({
          content: "✅ Pengaturan notifikasimu telah disimpan!",
          flags: MessageFlags.Ephemeral
        });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({
        components: []
      }).catch(() => {});
    });
  }
};
