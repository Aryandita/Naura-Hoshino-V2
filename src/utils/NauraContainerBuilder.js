const { MessageFlags } = require('discord.js');
const ui = require('../config/ui');
const nauraExpression = require('./nauraExpression');
const nauraText = require('./nauraText');
const languageManager = require('../managers/languageManager');

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
 * Logger dimuat malas (lazy) supaya berkas ini tetap ringan dan tidak pernah
 * ikut menyeret dependensi manager saat hanya dipakai merakit payload.
 */
let loggerRef;
function warnMissingTitle(author) {
    try {
        if (!loggerRef) loggerRef = require('../managers/logger').logger;
        loggerRef.warn(`[ContainerV2] Judul kosong pada container "${author}". Header sudah dirapikan otomatis, tapi pemanggil ini sebaiknya diberi title.`);
    } catch (error) {
        // Logger tidak wajib ada. Perakitan payload tidak boleh gagal karenanya.
    }
}

/**
 * Terjemahkan satu kunci kamus bersama.
 * lang boleh undefined — languageManager akan jatuh ke bahasa bawaan.
 */
function t(lang, key, placeholders) {
    return languageManager.translateSync(lang, key, placeholders);
}

/** Ambil opsi dari argumen yang boleh berupa string maupun objek. */
function pick(opts, key) {
    return (typeof opts === 'object' && opts !== null) ? opts[key] : undefined;
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

    const cleanAuthor = authorName ? ui.stripCustomEmojis(authorName) : '';
    const cleanFooter = footerText ? ui.stripCustomEmojis(footerText) : ui.getFooter('core');

    const attachedFiles = Array.isArray(files) ? [...files] : [];
    let headerIconURL = iconURL;
    let expressionGalleryRef = null;
    let headerTitle = (typeof title === 'string' && title.trim().length > 0) ? title : null;

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
            const expressionIcon = nauraExpression.getEmoji(expression);
            if (expressionIcon && headerTitle && !headerTitle.includes(expressionIcon)) {
                headerTitle = `${expressionIcon} ${headerTitle}`;
            }
        }
    }

    if (!headerTitle && cleanAuthor) warnMissingTitle(cleanAuthor);

    const headerLines = [];
    if (cleanAuthor) headerLines.push(`-# ${cleanAuthor}`);
    if (headerTitle) headerLines.push(`## ${headerTitle}`);
    const headerText = headerLines.join('\n');

    if (headerText) {
        if (headerIconURL) {
            containerComponents.push({
                type: 9,
                components: [textDisplay(headerText)],
                accessory: { type: 11, media: { url: headerIconURL } },
            });
        } else {
            containerComponents.push(textDisplay(headerText));
        }

        containerComponents.push(separatorComp(true, 1));
    } else if (headerIconURL && description) {
        containerComponents.push({
            type: 9,
            components: [textDisplay(description)],
            accessory: { type: 11, media: { url: headerIconURL } },
        });
        containerComponents.push(separatorComp(true, 1));
    }

    const descriptionAlreadyShown = !headerText && Boolean(headerIconURL) && Boolean(description);
    if (description && !descriptionAlreadyShown) {
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
            type: 12,
            items: galleryRefs.map(ref => ({ media: { url: resolveMediaUrl(ref) } })),
        });
    }

    if (Array.isArray(fileAttachmentNames)) {
        fileAttachmentNames.filter(Boolean).forEach(name => {
            containerComponents.push({
                type: 13,
                file: { url: resolveMediaUrl(name) },
            });
        });
    }

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
            containerComponents.push(separatorComp(false, 1));
            validRows.forEach(rowJson => containerComponents.push(rowJson));
        }
    }

    containerComponents.push(separatorComp(true, 1));
    containerComponents.push(textDisplay(`-# ${cleanFooter}`));

    return {
        content: null,
        embeds: [],
        files: attachedFiles,
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17,
                accent_color: accentColor,
                components: containerComponents,
            },
        ],
    };
}

function buildErrorContainerV2(opts) {
    const lang = pick(opts, 'lang');
    const rawError = typeof opts === 'string'
        ? opts
        : pick(opts, 'errorMessage') || pick(opts, 'description') || t(lang, 'common.error.reason_fallback');
    const title = pick(opts, 'title') || t(lang, 'common.error.title');
    const footerText = pick(opts, 'footerText') || ui.getFooter('core');
    const errEmoji = nauraExpression.getEmoji('error') || ui.getEmoji('error') || '❌';
    const expression = pick(opts, 'expression') !== undefined ? pick(opts, 'expression') : 'error';
    const errorMessage = typeof opts === 'string'
        ? nauraText.error(rawError)
        : rawError;

    return buildContainerV2({
        accentColorHex: pick(opts, 'accentColorHex') || ui.getColor('primary') || '#FFC0CB',
        title: `${errEmoji} ${title}`,
        description: errorMessage,
        expression,
        footerText,
    });
}

function buildLoadingContainerV2(opts) {
    const lang = pick(opts, 'lang');
    const rawLoading = typeof opts === 'string'
        ? opts
        : pick(opts, 'loadingMessage') || pick(opts, 'description') || t(lang, 'common.loading.body');
    const title = pick(opts, 'title') || t(lang, 'common.loading.title');
    const footerText = pick(opts, 'footerText') || ui.getFooter('core');
    const loadEmoji = nauraExpression.getEmoji('loading') || ui.getEmoji('loading') || '⏳';
    const expression = pick(opts, 'expression') !== undefined ? pick(opts, 'expression') : 'loading';

    return buildContainerV2({
        accentColorHex: pick(opts, 'accentColorHex') || ui.getColor('primary') || '#FFC0CB',
        title: `${loadEmoji} ${title}`,
        description: typeof opts === 'string' ? nauraText.loading(rawLoading) : rawLoading,
        expression,
        footerText,
    });
}

function buildSuccessContainerV2(opts) {
    const lang = pick(opts, 'lang');
    const rawSuccess = typeof opts === 'string'
        ? opts
        : pick(opts, 'successMessage') || pick(opts, 'description') || t(lang, 'common.success.body');
    const title = pick(opts, 'title') || t(lang, 'common.success.title');
    const footerText = pick(opts, 'footerText') || ui.getFooter('core');
    const okEmoji = nauraExpression.getEmoji('success') || ui.getEmoji('success') || '✅';
    const expression = pick(opts, 'expression') !== undefined ? pick(opts, 'expression') : 'success';

    return buildContainerV2({
        accentColorHex: pick(opts, 'accentColorHex') || ui.getColor('primary') || '#FFC0CB',
        title: `${okEmoji} ${title}`,
        description: typeof opts === 'string' ? nauraText.success(rawSuccess) : rawSuccess,
        expression,
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
