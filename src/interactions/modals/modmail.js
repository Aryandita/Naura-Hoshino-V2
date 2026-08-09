'use strict';

const { EmbedBuilder, MessageFlags } = require('discord.js');
const ModMail = require('../../models/ModMail');
const ui = require('../../config/ui');

async function submitReply(interaction, client) {
    const replyText = interaction.fields.getTextInputValue('mm_text_input');
    const isAnon = interaction.customId === 'mm_modal_anon';

    const ticket = await ModMail.findOne({
        where: { channelId: interaction.channelId, closed: false }
    });
    if (!ticket) {
        return ui.sendError(interaction, `${ui.getEmoji('error') || '\u274c'} Gagal: Tiket sudah ditutup.`, true);
    }

    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (!user) {
        return ui.sendError(
            interaction,
            `${ui.getEmoji('error') || '\u274c'} Gagal: User sudah meninggalkan Discord.`,
            true
        );
    }

    const replyEmbed = new EmbedBuilder()
        .setAuthor({
            name: isAnon ? `Staf ${interaction.guild.name}` : `Balasan dari ${interaction.member.displayName}`,
            iconURL: interaction.guild.iconURL()
        })
        .setDescription(replyText)
        .setColor('#FFB6C1')
        .setTimestamp();

    try {
        await user.send({ embeds: [replyEmbed] });
    } catch (error) {
        // DM tertutup. Ini kondisi normal, bukan galat sistem.
        return ui.sendError(interaction, 'err_sys_91', true);
    }

    await interaction.reply({
        content: `${ui.getEmoji('success') || '\u2705'} Pesan ${isAnon ? '(Anonim)' : ''} berhasil dikirim.`,
        flags: MessageFlags.Ephemeral
    });

    const logEmbed = new EmbedBuilder()
        .setColor(ui.getColor('success'))
        .setAuthor({
            name: isAnon ? `[ANONIM] ${interaction.user.tag}` : interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setDescription(`**Membalas:** ${replyText}`);

    await interaction.channel.send({ embeds: [logEmbed] });
    return undefined;
}

module.exports = [
    { id: 'mm_modal_reply', label: 'modmail-balas', handler: submitReply },
    { id: 'mm_modal_anon', label: 'modmail-balas-anonim', handler: submitReply }
];
