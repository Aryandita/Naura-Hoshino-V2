// Perakit definisi slash command /survival.
// Seluruh grup subcommand didaftarkan di sini agar survival.js hanya berisi logika.

const { SlashCommandBuilder } = require('discord.js');
const { addGatherGroup, addEconomyGroup } = require('./survivalGroups');
const { addRpgGroup } = require('./survivalGroupsRpg');
const { addLifeGroup, addProfileGroup } = require('./survivalGroupsLife');

const data = new SlashCommandBuilder()
    .setName('survival')
    .setDescription('Masuk ke dalam dunia Naura RPG - Survival Edition');

// Urutan pendaftaran menentukan urutan tampil di Discord, jadi dipertahankan
// sama seperti sebelum pemecahan berkas.
addGatherGroup(data);
addEconomyGroup(data);
addRpgGroup(data);
addLifeGroup(data);
addProfileGroup(data);

module.exports = data;
