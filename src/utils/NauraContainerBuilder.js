const { MessageFlags, AttachmentBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const ui = require("../config/ui");
const nauraExpression = require("./nauraExpression");
const nauraText = require("./nauraText");
const uxHelper = require("./uxHelper");
const languageManager = require("../managers/languageManager");
const {
  MAX_DESCRIPTION_LENGTH,
  MAX_FIELD_LENGTH,
  truncateText,
  enforceComponentBudget,
} = require("./componentBudget");

// Catatan pemotongan sengaja memakai teks tetap, bukan kunci bahasa.
// Pesan ini hanya muncul saat pemanggil salah ukuran, dan menambah kunci baru
// berarti menambah kewajiban penerjemahan untuk kondisi yang seharusnya tidak
// pernah dilihat pengguna.
const TRUNCATION_NOTICE =
  "-# Sebagian isi dipotong karena melewati batas tampilan Discord.";

function textDisplay(content) {
  return { type: 10, content };
}

function separatorComp(divider = true, spacing = 1) {
  return { type: 14, divider, spacing };
}

let loggerRef;
function getLogger() {
  if (loggerRef === undefined) {
    try {
      loggerRef = require("../managers/logger").logger;
    } catch (error) {
      loggerRef = null;
    }
  }
  return loggerRef;
}

function warnMissingTitle(author) {
  const log = getLogger();
  if (!log) return;
  log.warn(
    `[ContainerV2] Judul kosong pada container "${author}". Header sudah dirapikan otomatis, tapi pemanggil ini sebaiknya diberi title.`,
  );
}

function t(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

function pick(opts, key) {
  return typeof opts === "object" && opts !== null ? opts[key] : undefined;
}

function resolveMediaUrl(ref) {
  if (!ref) return null;
  if (
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("attachment://")
  ) {
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
  expressionImage = "auto",
  expressionEmoji = true,
  expressionAs = "icon",
  description,
  fields = [],
  bannerAttachmentName,
  topBannerAttachmentName,
  bannerPosition = "bottom",
  mediaAttachmentNames = [],
  fileAttachmentNames = [],
  files = [],
  buttonsRow,
  footerText,
}) {
  const defaultColor = ui.getColor("primary") || "#FFB6C1";
  const accentColor = parseInt(
    (accentColorHex || defaultColor).replace("#", ""),
    16,
  );
  const containerComponents = [];

  // Indeks komponen yang boleh dikorbankan bila payload melewati batas Discord.
  // Header, gambar, tombol, dan footer tidak pernah masuk daftar ini.
  const droppableIndices = [];

  const cleanAuthor = authorName ? ui.stripCustomEmojis(authorName) : "";
  const cleanFooter = footerText
    ? ui.stripCustomEmojis(footerText)
    : ui.getFooter("core");

  const attachedFiles = Array.isArray(files) ? [...files] : [];
  let headerIconURL = iconURL;
  let expressionGalleryRef = null;
  let headerTitle =
    typeof title === "string" && title.trim().length > 0 ? title : null;

  // Deskripsi dipangkas lebih dulu. Teks sepanjang ini sudah tidak nyaman dibaca,
  // dan menyisakan ruang untuk header, field, serta footer.
  const bodyDescription = truncateText(description, MAX_DESCRIPTION_LENGTH);

  if (expression && expressionAs !== "none") {
    const useImage =
      expressionImage === "auto"
        ? nauraExpression.shouldAttachImage(expression)
        : Boolean(expressionImage);

    const face = useImage ? nauraExpression.getAttachment(expression) : null;

    if (face) {
      attachedFiles.push(face.attachment);
      if (expressionAs === "gallery") {
        expressionGalleryRef = face.url;
      } else if (!headerIconURL) {
        headerIconURL = face.url;
      }
    } else if (expressionEmoji) {
      const expressionIcon = nauraExpression.getEmoji(expression);
      if (
        expressionIcon &&
        headerTitle &&
        !headerTitle.includes(expressionIcon)
      ) {
        headerTitle = `${expressionIcon} ${headerTitle}`;
      }
    }
  }

  if (!headerTitle && cleanAuthor) warnMissingTitle(cleanAuthor);

  const headerLines = [];
  if (cleanAuthor) headerLines.push(`-# ${cleanAuthor}`);
  if (headerTitle) headerLines.push(`## ${headerTitle}`);
  const headerText = headerLines.join("\n");

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
  } else if (headerIconURL && bodyDescription) {
    containerComponents.push({
      type: 9,
      components: [textDisplay(bodyDescription)],
      accessory: { type: 11, media: { url: headerIconURL } },
    });
    containerComponents.push(separatorComp(true, 1));
  }

  // ── Top Banner (jika bannerPosition === 'top' atau ada topBannerAttachmentName) ──
  const topRef =
    topBannerAttachmentName ||
    (bannerPosition === "top" ? bannerAttachmentName : null);
  if (topRef) {
    containerComponents.push({
      type: 12,
      items: [{ media: { url: resolveMediaUrl(topRef) } }],
    });
    containerComponents.push(separatorComp(true, 1));
  }

  const descriptionAlreadyShown =
    !headerText && Boolean(headerIconURL) && Boolean(bodyDescription);
  if (bodyDescription && !descriptionAlreadyShown) {
    containerComponents.push(textDisplay(bodyDescription));
  }

  if (Array.isArray(fields) && fields.length > 0) {
    fields.forEach((field) => {
      const value = truncateText(field.value, MAX_FIELD_LENGTH);
      droppableIndices.push(containerComponents.length);
      containerComponents.push(textDisplay(`**${field.name}**\n${value}`));
    });
  }

  // ── Bottom Banner / Media Gallery ──
  const bottomBannerRef =
    bannerPosition !== "top" ? bannerAttachmentName : null;
  const bottomGalleryRefs = [
    bottomBannerRef,
    ...(Array.isArray(mediaAttachmentNames) ? mediaAttachmentNames : []),
    expressionGalleryRef,
  ].filter(Boolean);

  if (bottomGalleryRefs.length > 0) {
    containerComponents.push(separatorComp(true, 1));
    containerComponents.push({
      type: 12,
      items: bottomGalleryRefs.map((ref) => ({
        media: { url: resolveMediaUrl(ref) },
      })),
    });
  }

  if (Array.isArray(fileAttachmentNames)) {
    fileAttachmentNames.filter(Boolean).forEach((name) => {
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
        const rowJson = typeof row.toJSON === "function" ? row.toJSON() : row;
        if (
          rowJson &&
          Array.isArray(rowJson.components) &&
          rowJson.components.length > 0
        ) {
          acc.push(rowJson);
        }
      }
      return acc;
    }, []);

    if (validRows.length > 0) {
      containerComponents.push(separatorComp(false, 1));
      validRows.forEach((rowJson) => containerComponents.push(rowJson));
    }
  }

  containerComponents.push(separatorComp(true, 1));
  containerComponents.push(textDisplay(`-# ${cleanFooter}`));

  // Penjagaan terakhir sebelum payload berangkat. Discord menolak seluruh pesan
  // bila komponen melebihi 40 atau teks melebihi 4000 karakter, dan pesan
  // errornya tidak menunjuk komponen mana yang bersalah.
  const budget = enforceComponentBudget(containerComponents, {
    droppableIndices,
    notice: TRUNCATION_NOTICE,
  });

  const log = getLogger();
  if (log) {
    const label = headerTitle || cleanAuthor || "tanpa judul";
    if (budget.dropped > 0) {
      log.warn(
        `[ContainerV2] ${budget.dropped} field dipotong pada container "${label}" agar tetap di dalam batas Discord.`,
      );
    }
    if (!budget.withinBudget) {
      log.error(
        `[ContainerV2] Container "${label}" masih melewati batas (${budget.componentCount} komponen, ${budget.textLength} karakter). Pemanggil ini perlu dipecah ke beberapa halaman.`,
      );
    }
  }

  return {
    embeds: [],
    files: attachedFiles,
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: 17,
        accent_color: accentColor,
        components: budget.components,
      },
    ],
  };
}

function resolveSmartBanner(type) {
  const bannerMap = {
    error:
      ui.banners.errorWebp || ui.banners.errorCompressed || ui.banners.error,
    loading:
      ui.banners.loadingWebp ||
      ui.banners.loadingCompressed ||
      ui.banners.loading,
    maintenance:
      ui.banners.maintenanceWebp ||
      ui.banners.maintenanceCompressed ||
      ui.banners.maintenance,
  };

  const rawPath = bannerMap[type];
  if (!rawPath) return null;

  const absolutePath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);

  if (fs.existsSync(absolutePath)) {
    const ext = path.extname(absolutePath) || ".webp";
    const attachmentName = `banner_${type}${ext}`;
    return {
      name: attachmentName,
      file: new AttachmentBuilder(absolutePath, { name: attachmentName }),
    };
  }
  return null;
}

function buildErrorContainerV2(opts) {
  const lang = pick(opts, "lang");
  const rawError =
    typeof opts === "string"
      ? opts
      : pick(opts, "errorMessage") ||
        pick(opts, "description") ||
        t(lang, "common.error.reason_fallback");
  const title = pick(opts, "title") || t(lang, "common.error.title");
  const authorName = pick(opts, "authorName") || "Naura System Guard";
  const footerText = pick(opts, "footerText") || ui.getFooter("core");
  const errEmoji =
    nauraExpression.getEmoji("error") || ui.getEmoji("error") || "❌";
  const expression =
    pick(opts, "expression") !== undefined ? pick(opts, "expression") : "error";
  const errorMessage =
    typeof opts === "string" ? nauraText.error(rawError, lang) : rawError;

  const withBanner = pick(opts, "withBanner");
  let bannerAttachmentName = pick(opts, "bannerAttachmentName");
  const files = [...(pick(opts, "files") || [])];

  if (withBanner && !bannerAttachmentName) {
    const bannerInfo = resolveSmartBanner("error");
    if (bannerInfo) {
      bannerAttachmentName = bannerInfo.name;
      files.push(bannerInfo.file);
    }
  }

  return buildContainerV2({
    accentColorHex:
      pick(opts, "accentColorHex") ||
      ui.getColor("danger") ||
      ui.getColor("error") ||
      "#EF4444",
    authorName,
    title: `${errEmoji} ${title}`,
    description: errorMessage,
    expression,
    expressionImage:
      pick(opts, "expressionImage") !== undefined
        ? pick(opts, "expressionImage")
        : "auto",
    expressionEmoji:
      pick(opts, "expressionEmoji") !== undefined
        ? pick(opts, "expressionEmoji")
        : true,
    expressionAs: pick(opts, "expressionAs") || "icon",
    fields: pick(opts, "fields") || [],
    buttonsRow: pick(opts, "buttonsRow"),
    bannerAttachmentName,
    files,
    footerText,
  });
}

function buildLoadingContainerV2(opts) {
  const lang = pick(opts, "lang");
  const rawLoading =
    typeof opts === "string"
      ? opts
      : pick(opts, "loadingMessage") ||
        pick(opts, "description") ||
        t(lang, "common.loading.body");
  const title = pick(opts, "title") || t(lang, "common.loading.title");
  const authorName = pick(opts, "authorName") || "Naura Task Runner";
  const footerText = pick(opts, "footerText") || ui.getFooter("core");
  const loadEmoji =
    nauraExpression.getEmoji("loading") || ui.getEmoji("loading") || "⏳";
  const expression =
    pick(opts, "expression") !== undefined
      ? pick(opts, "expression")
      : "loading";

  const withBanner = pick(opts, "withBanner");
  let bannerAttachmentName = pick(opts, "bannerAttachmentName");
  const files = [...(pick(opts, "files") || [])];

  if (withBanner && !bannerAttachmentName) {
    const bannerInfo = resolveSmartBanner("loading");
    if (bannerInfo) {
      bannerAttachmentName = bannerInfo.name;
      files.push(bannerInfo.file);
    }
  }

  return buildContainerV2({
    accentColorHex:
      pick(opts, "accentColorHex") ||
      ui.getColor("accent-blue") ||
      ui.getColor("primary") ||
      "#38BDF8",
    authorName,
    title: `${loadEmoji} ${title}`,
    description:
      typeof opts === "string"
        ? nauraText.loading(rawLoading, lang)
        : rawLoading,
    expression,
    expressionImage:
      pick(opts, "expressionImage") !== undefined
        ? pick(opts, "expressionImage")
        : "auto",
    expressionEmoji:
      pick(opts, "expressionEmoji") !== undefined
        ? pick(opts, "expressionEmoji")
        : true,
    expressionAs: pick(opts, "expressionAs") || "icon",
    fields: pick(opts, "fields") || [],
    buttonsRow: pick(opts, "buttonsRow"),
    bannerAttachmentName,
    files,
    footerText,
  });
}

function buildMaintenanceContainerV2(opts) {
  const lang = pick(opts, "lang");
  const rawMaintenance =
    typeof opts === "string"
      ? opts
      : pick(opts, "maintenanceMessage") ||
        pick(opts, "description") ||
        (lang ? t(lang, "common.maintenance.body") : null) ||
        "Sistem sedang dalam proses pemeliharaan atau peningkatan performa server. Mohon tunggu sebentar ya!";
  const title = pick(opts, "title") || "Pemeliharaan Sistem";
  const authorName = pick(opts, "authorName") || "Naura Maintenance Center";
  const footerText = pick(opts, "footerText") || ui.getFooter("core");
  const warnEmoji =
    nauraExpression.getEmoji("warning") || ui.getEmoji("warning") || "🛠️";
  const expression =
    pick(opts, "expression") !== undefined
      ? pick(opts, "expression")
      : "sleepy";

  const withBanner = pick(opts, "withBanner") !== false;
  let bannerAttachmentName = pick(opts, "bannerAttachmentName");
  const files = [...(pick(opts, "files") || [])];

  if (withBanner && !bannerAttachmentName) {
    const bannerInfo = resolveSmartBanner("maintenance");
    if (bannerInfo) {
      bannerAttachmentName = bannerInfo.name;
      files.push(bannerInfo.file);
    }
  }

  return buildContainerV2({
    accentColorHex:
      pick(opts, "accentColorHex") || ui.getColor("warning") || "#F59E0B",
    authorName,
    title: `${warnEmoji} ${title}`,
    description: rawMaintenance,
    expression,
    expressionImage:
      pick(opts, "expressionImage") !== undefined
        ? pick(opts, "expressionImage")
        : "auto",
    expressionEmoji:
      pick(opts, "expressionEmoji") !== undefined
        ? pick(opts, "expressionEmoji")
        : true,
    expressionAs: pick(opts, "expressionAs") || "icon",
    fields: pick(opts, "fields") || [],
    buttonsRow: pick(opts, "buttonsRow"),
    bannerAttachmentName,
    files,
    footerText,
  });
}

function buildSuccessContainerV2(opts) {
  const lang = pick(opts, "lang");
  const rawSuccess =
    typeof opts === "string"
      ? opts
      : pick(opts, "successMessage") ||
        pick(opts, "description") ||
        t(lang, "common.success.body");
  const title = pick(opts, "title") || t(lang, "common.success.title");
  const authorName = pick(opts, "authorName") || "Naura Assistant";
  const footerText = pick(opts, "footerText") || ui.getFooter("core");
  const okEmoji =
    nauraExpression.getEmoji("success") || ui.getEmoji("success") || "✅";
  const expression =
    pick(opts, "expression") !== undefined
      ? pick(opts, "expression")
      : "success";

  const withBanner = pick(opts, "withBanner");
  let bannerAttachmentName = pick(opts, "bannerAttachmentName");
  const files = [...(pick(opts, "files") || [])];

  return buildContainerV2({
    accentColorHex:
      pick(opts, "accentColorHex") || ui.getColor("success") || "#22C55E",
    authorName,
    title: `${okEmoji} ${title}`,
    description:
      typeof opts === "string"
        ? nauraText.success(rawSuccess, lang)
        : rawSuccess,
    expression,
    expressionImage:
      pick(opts, "expressionImage") !== undefined
        ? pick(opts, "expressionImage")
        : "auto",
    expressionEmoji:
      pick(opts, "expressionEmoji") !== undefined
        ? pick(opts, "expressionEmoji")
        : true,
    expressionAs: pick(opts, "expressionAs") || "icon",
    fields: pick(opts, "fields") || [],
    buttonsRow: pick(opts, "buttonsRow"),
    bannerAttachmentName,
    files,
    footerText,
  });
}

function buildPersonaContainerV2({
  type = "default",
  user = null,
  context = {},
  lang = "id",
  title = null,
  accentColorHex = null,
  fields = [],
  buttonsRow = null,
  footerText = null,
  expression = null,
}) {
  const message = uxHelper.getPersonalityResponse(type, {
    user,
    context,
    lang,
  });
  const defaultExpressionMap = {
    cooldown: "blush",
    error: "confused",
    levelUp: "cheer",
    ikeaAppreciation: "wink",
    peakEndClosure: "happy",
    starterWelcome: "wave",
  };

  const chosenExpression = expression || defaultExpressionMap[type] || "smile";

  const eNaura = ui.getEmoji("about") || "🌸";
  const eWarn = ui.getEmoji("warning") || "⚠️";
  const eParty = ui.getEmoji("celebrate") || "🎉";
  const eSparkle = ui.getEmoji("sparkles") || "✨";
  const eGift = ui.getEmoji("gift") || "🎁";

  const defaultTitleMap = {
    cooldown: `${eNaura} Istirahat Dulu Sebentar`,
    error: `${eWarn} Ups, Terjadi Kendala`,
    levelUp: `${eParty} Level Up Milestone!`,
    ikeaAppreciation: `${eSparkle} Kustomisasi Disimpan`,
    peakEndClosure: `${eNaura} Naura Siap Membantu`,
    starterWelcome: `${eGift} Sambutan Spesial Naura`,
  };

  const finalTitle =
    title || defaultTitleMap[type] || `${eNaura} Naura Hoshino`;

  return buildContainerV2({
    accentColorHex: accentColorHex || ui.getColor("primary") || "#FFB6C1",
    title: finalTitle,
    description: message,
    expression: chosenExpression,
    fields,
    buttonsRow,
    footerText: footerText || ui.getFooter("core"),
  });
}

module.exports = {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
  buildMaintenanceContainerV2,
  buildSuccessContainerV2,
  buildPersonaContainerV2,
  textDisplay,
  separatorComp,
  ux: uxHelper,
};
