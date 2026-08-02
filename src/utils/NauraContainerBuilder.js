const { MessageFlags } = require('discord.js');
const ui = require('../config/ui');

/**
 * Text display component (type 10)
 */
function textDisplay(content) {
    return { type: 10, content };
}

/**
 * Separator component (type 14)
 */
function separatorComp(divider = true, spacing = 1) {
    return { type: 14, divider, spacing };
}

/**
 * Mengubah referensi media jadi URL yang valid untuk Components V2.
 * Menerima nama file attachment (mis. 'video.mp4') maupun URL eksternal
 * penuh (mis. 'https://...') — keduanya didukung oleh Unfurled Media Item.
 */
function resolveMediaUrl(ref) {
    if (!ref) return null;
    if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('attachment://')) {
        return ref;
    }
    return `attachment://${ref}`;
}

/**
 * Membangun satu payload Components V2 berbentuk Container tunggal.
 * @param {object} opts
 * @param {string} [opts.accentColorHex] - Warna aksen container, mis. '#FFB6C1'
 * @param {string} [opts.authorName] - Teks kecil di atas judul
 * @param {string} opts.title - Judul utama
 * @param {string} [opts.iconURL] - URL ikon kecil (accessory Thumbnail di header)
 * @param {string} [opts.description] - Teks deskripsi/body utama
 * @param {Array<{name:string, value:string}>} [opts.fields] - Daftar field
 * @param {string} [opts.bannerAttachmentName] - Nama file attachment banner, mis. 'banner.png'
 * @param {Array<string>} [opts.mediaAttachmentNames] - Video/gambar yang ditampilkan di dalam
 *        container (Media Gallery), tepat di bawah judul/deskripsi. Boleh berupa nama file
 *        attachment (mis. 'naura_media.mp4') atau URL eksternal penuh.
 * @param {Array<string>} [opts.fileAttachmentNames] - File non-visual (mis. audio) yang
 *        ditampilkan sebagai File component agar tetap muncul di pesan Components V2.
 * @param {import('discord.js').ActionRowBuilder|object} [opts.buttonsRow] - Action Row tombol
 * @param {string} [opts.footerText] - Teks footer kecil
 */
function buildContainerV2({
    accentColorHex,
    authorName,
    title,
    iconURL,
    description,
    fields = [],
    bannerAttachmentName,
    mediaAttachmentNames = [],
    fileAttachmentNames = [],
    buttonsRow,
    footerText,
}) {
    const defaultColor = ui.getColor('primary') || '#FFB6C1';
    const accentColor = parseInt((accentColorHex || defaultColor).replace('#', ''), 16);
    const containerComponents = [];

    // Clean authorName and footerText from custom Discord emojis (<a:name:id> or <:name:id>)
    const cleanAuthor = authorName ? ui.stripCustomEmojis(authorName) : '';
    const cleanFooter = footerText ? ui.stripCustomEmojis(footerText) : ui.getFooter('core');

    // Header: judul + ikon kecil di kanan (mirip author + thumbnail pada embed)
    const headerText = `${cleanAuthor ? `-# ${cleanAuthor}\n` : ''}## ${title}`;
    if (iconURL) {
        containerComponents.push({
            type: 9, // SECTION
            components: [textDisplay(headerText)],
            accessory: { type: 11, media: { url: iconURL } }, // THUMBNAIL
        });
    } else {
        containerComponents.push(textDisplay(headerText));
    }

    containerComponents.push(separatorComp(true, 1));

    // Content
    if (description) {
        containerComponents.push(textDisplay(description));
    }

    if (Array.isArray(fields) && fields.length > 0) {
        fields.forEach(field => {
            containerComponents.push(textDisplay(`**${field.name}**\n${field.value}`));
        });
    }

    const galleryRefs = [
        bannerAttachmentName,
        ...(Array.isArray(mediaAttachmentNames) ? mediaAttachmentNames : []),
    ].filter(Boolean);

    if (galleryRefs.length > 0) {
        containerComponents.push({
            type: 12, // MEDIA_GALLERY
            items: galleryRefs.map(ref => ({ media: { url: resolveMediaUrl(ref) } })),
        });
    }

    if (Array.isArray(fileAttachmentNames)) {
        fileAttachmentNames.filter(Boolean).forEach(name => {
            containerComponents.push({
                type: 13, // FILE
                file: { url: resolveMediaUrl(name) },
            });
        });
    }

    // Buttons — separator tipis (divider:false) memisahkan konten dari tombol
    if (buttonsRow) {
        const rows = Array.isArray(buttonsRow) ? buttonsRow : [buttonsRow];
        const validRows = rows.reduce((acc, row) => {
            if (row) {
                const rowJson = typeof row.toJSON === 'function' ? row.toJSON() : row;
                if (rowJson && Array.isArray(rowJson.components) && rowJson.components.length > 0) {
                    acc.push(rowJson);
                }
            }
            return acc;
        }, []);

        if (validRows.length > 0) {
            // ·· Separator tipis: Pemisah Konten dari Tombol ·················
            containerComponents.push(separatorComp(false, 1));
            validRows.forEach(rowJson => containerComponents.push(rowJson));
        }
    }

    // Footer
    containerComponents.push(separatorComp(true, 1));
    containerComponents.push(textDisplay(`-# ${cleanFooter}`));

    return {
        content: null,
        embeds: [],
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17, // CONTAINER
                accent_color: accentColor,
                components: containerComponents,
            },
        ],
    };
}

/**
 * Membangun Container V2 khusus pesan Error.
 * @param {string|object} opts - Pesan error atau opsi objek
 * @param {string} [opts.errorMessage] - Pesan detail error
 * @param {string} [opts.title] - Judul error
 * @param {string} [opts.footerText] - Teks footer
 */
function buildErrorContainerV2(opts) {
    const rawError = typeof opts === 'string' ? opts : opts?.errorMessage || opts?.description || 'Terjadi kendala saat memproses permintaanmu...';
    const title = (typeof opts === 'object' && opts?.title) ? opts.title : 'Aww, Waduh! Ada Masalah Nih ✨';
    const footerText = (typeof opts === 'object' && opts?.footerText) ? opts.footerText : ui.getFooter('core');
    const errEmoji = ui.getEmoji('error') || '❌';

    // Cheerful girl touch if generic error string
    const errorMessage = typeof opts === 'string' && !opts.includes('💕')
        ? `Aww, maaf yaa! Naura nemuin kendala: **${rawError}** 💕`
        : rawError;

    return buildContainerV2({
        accentColorHex: opts?.accentColorHex || ui.getColor('primary') || '#FFC0CB',
        title: `${errEmoji} ${title}`,
        description: errorMessage,
        footerText,
    });
}

/**
 * Membangun Container V2 khusus pesan Loading.
 * @param {string|object} opts - Pesan loading atau opsi objek
 * @param {string} [opts.loadingMessage] - Pesan detail loading
 * @param {string} [opts.title] - Judul loading
 * @param {string} [opts.footerText] - Teks footer
 */
function buildLoadingContainerV2(opts) {
    const rawLoading = typeof opts === 'string' ? opts : opts?.loadingMessage || opts?.description || 'Tunggu sebentar yaa, Naura sedang memprosesnya dengan penuh semangat! ✨';
    const title = (typeof opts === 'object' && opts?.title) ? opts.title : 'Tunggu Sebentar Yaa~! 💖';
    const footerText = (typeof opts === 'object' && opts?.footerText) ? opts.footerText : ui.getFooter('core');
    const loadEmoji = ui.getEmoji('loading') || '⏳';

    return buildContainerV2({
        accentColorHex: opts?.accentColorHex || ui.getColor('primary') || '#FFC0CB',
        title: `${loadEmoji} ${title}`,
        description: rawLoading,
        footerText,
    });
}

module.exports = {
    buildContainerV2,
    buildErrorContainerV2,
    buildLoadingContainerV2,
    textDisplay,
    separatorComp
};

