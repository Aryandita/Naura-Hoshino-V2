// Opsi konstruksi Client dipisahkan agar intent dan partial mudah diaudit.
const { GatewayIntentBits, Partials } = require('discord.js');

// GuildMessageReactions wajib ada, kalau tidak Discord tidak pernah mengirim
// messageReactionAdd maupun messageReactionRemove. Partials.Reaction diperlukan
// agar reaksi pada pesan lama yang tidak lagi ada di cache tetap sampai.
const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
];

const partials = [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction];

module.exports = { intents, partials };
