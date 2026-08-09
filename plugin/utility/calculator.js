const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculator')
        .setDescription('🧮 Buka kalkulator interaktif.'),

    async execute(interaction) {
        let expression = '';

        const createCalcPayload = (text) => {
            return buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: '🧮 Kalkulator Interaktif',
                description: `\`\`\`\n${text || '0'}\n\`\`\``,
                footerText: ui.getFooter('core')
            });
        };

        const rows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('calc_clear').setLabel('C').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('calc_(').setLabel('(').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('calc_)').setLabel(')').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('calc_/').setLabel('÷').setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('calc_7').setLabel('7').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_8').setLabel('8').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_9').setLabel('9').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_*').setLabel('×').setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('calc_4').setLabel('4').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_5').setLabel('5').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_6').setLabel('6').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_-').setLabel('-').setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('calc_1').setLabel('1').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_2').setLabel('2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_3').setLabel('3').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_+').setLabel('+').setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('calc_0').setLabel('0').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_.').setLabel('.').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('calc_del').setLabel('⌫').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('calc_=').setLabel('=').setStyle(ButtonStyle.Success)
            )
        ];

        const message = await interaction.reply({ ...createCalcPayload(expression), components: rows, fetchReply: true });

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Ini bukan kalkulatormu! Silakan gunakan perintah `/calculator` sendiri.', flags: MessageFlags.Ephemeral });
            }

            const val = i.customId.split('_')[1];

            if (val === 'clear') {
                expression = '';
            } else if (val === 'del') {
                expression = expression.slice(0, -1);
            } else if (val === '=') {
                try {
                    if (expression.length > 0) {
                        const result = new Function(`return ${expression}`)();
                        expression = String(result);
                    }
                } catch (e) {
                    expression = 'Error';
                }
            } else {
                if (expression === 'Error') expression = '';
                expression += val;
            }

            await i.update(createCalcPayload(expression));
        });

        collector.on('end', async () => {
            rows.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
            await interaction.editReply({ components: rows }).catch(() => {});
        });
    }
};
