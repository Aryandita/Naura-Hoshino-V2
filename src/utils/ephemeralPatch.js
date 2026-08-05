// Penambal kompatibilitas: mengubah opsi ephemeral: true yang sudah usang
// menjadi flag Ephemeral. Perilakunya dipertahankan apa adanya dari index.js.
const djs = require('discord.js');

function patchOptions(options) {
    if (options && typeof options === 'object') {
        if (options.ephemeral) {
            options.flags = options.flags || [];
            if (Array.isArray(options.flags)) {
                if (!options.flags.includes('Ephemeral') && !options.flags.includes(64)) {
                    options.flags.push('Ephemeral');
                }
            } else {
                options.flags |= 64;
            }
            delete options.ephemeral;
        }
    }
    return options;
}

function patchMethod(proto, method) {
    if (!proto[method] || proto[method].__patched) return;
    const orig = proto[method];
    proto[method] = function (options) {
        return orig.call(this, patchOptions(options));
    };
    proto[method].__patched = true;
}

function patchProto(proto) {
    if (!proto) return;
    patchMethod(proto, 'reply');
    patchMethod(proto, 'deferReply');
    patchMethod(proto, 'followUp');
}

function applyEphemeralPatch() {
    [djs.CommandInteraction, djs.MessageComponentInteraction, djs.ModalSubmitInteraction].forEach(cls => {
        if (cls && cls.prototype) patchProto(cls.prototype);
    });
}

module.exports = { applyEphemeralPatch, patchOptions };
