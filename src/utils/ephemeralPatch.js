// Penambal kompatibilitas: mengubah opsi ephemeral: true yang sudah usang
// menjadi flag Ephemeral.
//
// Rencana penghapusan (issue #10): penambal ini memodifikasi prototype
// discord.js, jadi setiap upgrade discord.js berpotensi mematahkannya secara
// senyap. Targetnya semua pemanggil memakai MessageFlags.Ephemeral langsung,
// lalu berkas ini dihapus.
//
// Supaya penghapusan tidak dilakukan sambil menebak, penambal sekarang mencatat
// lokasi pemanggil yang masih memakai `ephemeral: true`. Satu peringatan per
// lokasi, bukan per pemanggilan, agar log tidak banjir.
const djs = require('discord.js');

const reportedCallSites = new Set();
let loggerRef;

function callSiteOf() {
    // Baris 0 adalah "Error", 1 fungsi ini, 2 patchOptions, 3 pembungkus method.
    // Baris 4 adalah pemanggil yang sebenarnya.
    const stack = new Error().stack;
    if (typeof stack !== 'string') return 'tidak diketahui';
    const lines = stack.split('\n');
    const frame = lines[4] || lines[lines.length - 1] || '';
    return frame.trim().replace(/^at\s+/, '');
}

function reportDeprecation() {
    const site = callSiteOf();
    if (reportedCallSites.has(site)) return;
    reportedCallSites.add(site);

    try {
        if (!loggerRef) loggerRef = require('../managers/logger').logger;
        loggerRef.warn(`[DEPRECATED] \`ephemeral: true\` masih dipakai di ${site}. Ganti ke \`flags: MessageFlags.Ephemeral\` (issue #10).`);
    } catch (error) {
        // Logger tidak wajib ada. Penambal tidak boleh gagal karena pelaporan.
    }
}

/** Daftar lokasi pemanggil yang masih memakai opsi usang. Dipakai saat audit. */
function getDeprecatedCallSites() {
    return [...reportedCallSites];
}

function patchOptions(options, { report = false } = {}) {
    if (options && typeof options === 'object') {
        if (options.ephemeral) {
            if (report) reportDeprecation();
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
        return orig.call(this, patchOptions(options, { report: true }));
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

module.exports = { applyEphemeralPatch, patchOptions, getDeprecatedCallSites };
