const { MessageFlags } = require('discord.js');
const ui = require('../config/ui');
const nauraExpression = require('./nauraExpression');

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
 * @param {string} [opts.expression] - Ekspresi Naura yang dipakai. Boleh nama berkas
 *        ('Cheers') atau mood ('success', 'error', 'loading', 'afk'). Mood 'afk'
 *        memilih satu dari Eat / Sleepy / Chirping secara acak.
 *        Diabaikan bila iconURL sudah diisi manual. Set false untuk mematikan.
 * @param {'auto'|boolean} [opts.expressionImage] - Apakah GAMBAR ekspresi ikut dikirim.
 *        'auto' (bawaan) menyerahkan keputusan pada nauraExpression.shouldAttachImage(),
 *        sehingga hanya momen penting yang membawa lampiran. true memaksa mengirim,
 *        false memastikan tidak pernah mengirim.
 * @param {boolean} [opts.expressionEmoji] - Bila gambar dilewati, emoji ekspresi
 *        dipasang di depan judul. Default true. Emoji tidak digandakan bila judul
 *        sudah memuatnya.
 * @param {'icon'|'gallery'|'none'} [opts.expressionAs] - Penempatan gambar ekspresi.
 *        Default 'icon' (thumbnail kecil di header). 'gallery' menampilkannya besar.
 * @param {string} [opts.description] - Teks deskripsi/body utama
 * @param {Array<{name:string, value:string}>} [opts.fields] - Daftar field
 * @param {string} [opts.bannerAttachmentName] - Nama file attachment banner, mis. 'banner.png'
 * @param {Array<string>} [opts.mediaAttachmentNames] - Video/gambar yang ditampilkan di dalam
 *        container (Media Gallery), tepat di bawah judul/deskripsi. Boleh berupa nama file
 *        attachment (mis. 'naura_media.mp4') atau URL eksternal penuh.
 * @param {Array<string>} [opts.fileAttachmentNames] - File non-visual (mis. audio) yang
 *        ditampilkan sebagai File component agar tetap muncul di pesan Components V2.
 * @param {Array<object>} [opts.files] - Lampiran tambahan yang ikut dikirim bersama payload.
 * @param {import('discord.js').ActionRowBuilder|object} [opts.buttonsRow] - Action Row tombol
 * @param {string} [opts.footerText] - Teks footer kecil
 *
 * @returns Payload siap kirim, sudah termasuk `files`. Karena lampirannya menempel pada
 *          payload yang sama, pemanggil cukup menulis `interaction.editReply(payload)`
 *          dan gambar ekspresi ikut terkirim tanpa perubahan kode lain.
 */
function buildContainerV2({
    accentColorHex,
    authorName,
    title,
    iconURL,
    expression,
    expressionImage = 'auto',
    expressionEmoji = true,
    expressionAs = 'icon',
    description,
    fields = [],
    bannerAttachmentName,
    mediaAttachmentNames = [],
    fileAttachmentNames = [],
    files = [],
    buttonsRow,
    footerText,
}) {
    const defaultColor = ui.getColor('primary') || '#FFB6C1';
    const accentColor = parseInt((accentColorHex || defaultColor).replace('#', ''), 16);
    const containerComponents = [];

    // Clean authorName and footerText from custom Discord emojis (<a:name:id> or <:name:id>)
    const cleanAuthor = authorName ? ui.stripCustomEmojis(authorName) : '';
    const cleanFooter = footerText ? ui.stripCustomEmojis(footerText) : ui.getFooter('core');

    // ·· Ekspresi Naura ····················································
    // Gambar hanya menempel pada momen yang layak, karena satu berkas ekspresi
    // berukuran sekitar setengah megabita. Selebihnya emoji sudah cukup.
    // iconURL manual selalu menang, supaya pemanggil lama tidak berubah perilakunya.
    const attachedFiles = Array.isArray(files) ? [...files] : [];
    let headerIconURL = iconURL;
    let expressionGalleryRef = null;
    let headerTitle = title;

    if (expression && expressionAs !== 'none') {
        const useImage = expressionImage === 'auto'
            ? nauraExpression.shouldAttachImage(expression)
            : Boolean(expressionImage);

        const face = useImage ? nauraExpression.getAttachment(expression) : null;

        if (face) {
            attachedFiles.push(face.attachment);
            if (expressionAs === 'gallery') {
                expressionGalleryRef = face.url;
            } else if (!headerIconURL) {
                headerIconURL = face.url;
            }
        } else if (expressionEmoji) {
            // Tanpa gambar, perasaan Naura tetap tersampaikan lewat emoji wajahnya.
            const emoji = nauraExpression.getEmoji(expression);
            if (emoji && headerTitle && !headerTitle.includes(emoji)) {
                headerTitle = `${emoji} ${headerTitle}`;
            }
        }
    }

    // Header: judul + ikon kecil di kanan (mirip author + thumbnail pada embed)
    const headerText = `${cleanAuthor ? `-# ${cleanAuthor}\n` : ''}## ${headerTitle}`;
    if (headerIconURL) {
        containerComponents.push({
            type: 9, // SECTION
            components: [textDisplay(headerText)],
            accessory: { type: 11, media: { url: headerIconURL } }, // THUMBNAIL
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
        expressionGalleryRef,
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
        files: attachedFiles,
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
 * Ekspresi bawaan: Cry, lengkap dengan gambarnya karena error termasuk momen penting.
 * @param {string|object} opts - Pesan error atau opsi objek
 * @param {string} [opts.errorMessage] - Pesan detail error
 * @param {string} [opts.title] - Judul error
 * @param {string} [opts.expression] - Timpa ekspresi bawaan
 * @param {string} [opts.footerText] - Teks footer
 */
function buildErrorContainerV2(opts) {
    const rawError = typeof opts === 'string' ? opts : opts?.errorMessage || opts?.description || 'Naura belum berhasil menyelesaikan permintaanmu';
    const title = (typeof opts === 'object' && opts?.title) ? opts.title : 'Maaf ya, Naura Gagal Melakukannya 💧';
    const footerText = (typeof opts === 'object' && opts?.footerText) ? opts.footerText : ui.getFooter('core');
    const errEmoji = nauraExpression.getEmoji('error') || ui.getEmoji('error') || '❌';

    // Sentuhan personal bila yang dikirim hanya string error mentah
    const errorMessage = typeof opts === 'string' && !opts.includes('💕')
        ? `Maaf banget yaa, Naura nggak berhasil melakukannya. Katanya begini: **${rawError}**\nCoba sekali lagi ya, Naura temenin sampai berhasil kok 💕`
        : rawError;

    return buildContainerV2({
        accentColorHex: opts?.accentColorHex || ui.getColor('primary') || '#FFC0CB',
        title: `${errEmoji} ${title}`,
        description: errorMessage,
        expression: (typeof opts === 'object' && opts?.expression !== undefined) ? opts.expression : 'error',
        footerText,
    });
}

/**
 * Membangun Container V2 khusus pesan Loading.
 * Ekspresi bawaan: Thinking, emoji saja tanpa gambar — pesan ini terlalu sering
 * muncul untuk dibebani lampiran.
 * @param {string|object} opts - Pesan loading atau opsi objek
 * @param {string} [opts.loadingMessage] - Pesan detail loading
 * @param {string} [opts.title] - Judul loading
 * @param {string} [opts.expression] - Timpa ekspresi bawaan
 * @param {string} [opts.footerText] - Teks footer
 */
function buildLoadingContainerV2(opts) {
    const rawLoading = typeof opts === 'string' ? opts : opts?.loadingMessage || opts?.description || 'Tunggu sebentar yaa, Naura lagi siapin semuanya buat kamu~ ✨';
    const title = (typeof opts === 'object' && opts?.title) ? opts.title : 'Sebentar Yaa, Naura Lagi Mikir~ 💭';
    const footerText = (typeof opts === 'object' && opts?.footerText) ? opts.footerText : ui.getFooter('core');
    const loadEmoji = nauraExpression.getEmoji('loading') || ui.getEmoji('loading') || '⏳';

    return buildContainerV2({
        accentColorHex: opts?.accentColorHex || ui.getColor('primary') || '#FFC0CB',
        title: `${loadEmoji} ${title}`,
        description: rawLoading,
        expression: (typeof opts === 'object' && opts?.expression !== undefined) ? opts.expression : 'loading',
        footerText,
    });
}

/**
 * Membangun Container V2 khusus pesan Sukses.
 * Ekspresi bawaan: Cheers, lengkap dengan gambarnya.
 * @param {string|object} opts - Pesan sukses atau opsi objek
 */
function buildSuccessContainerV2(opts) {
    const rawSuccess = typeof opts === 'string' ? opts : opts?.successMessage || opts?.description || 'Berhasil! Semuanya sudah beres yaa~ ✨';
    const title = (typeof opts === 'object' && opts?.title) ? opts.title : 'Yeaay, Berhasil! 🎀';
    const footerText = (typeof opts === 'object' && opts?.footerText) ? opts.footerText : ui.getFooter('core');
    const okEmoji = nauraExpression.getEmoji('success') || ui.getEmoji('success') || '✅';

    return buildContainerV2({
        accentColorHex: opts?.accentColorHex || ui.getColor('primary') || '#FFC0CB',
        title: `${okEmoji} ${title}`,
        description: rawSuccess,
        expression: (typeof opts === 'object' && opts?.expression !== undefined) ? opts.expression : 'success',
        footerText,
    });
}

module.exports = {
    buildContainerV2,
    buildErrorContainerV2,
    buildLoadingContainerV2,
    buildSuccessContainerV2,
    textDisplay,
    separatorComp
};
