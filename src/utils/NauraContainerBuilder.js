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

function resolveLanguage(langOrContext) {
  if (!langOrContext) return languageManager.default;
  if (typeof langOrContext === "string")
    return languageManager.normalize(langOrContext);
  if (typeof langOrContext === "object" && langOrContext !== null) {
    if (langOrContext.localeLang)
      return languageManager.normalize(langOrContext.localeLang);
    if (langOrContext.locale)
      return languageManager.normalize(langOrContext.locale);
    const userId = langOrContext.user?.id || langOrContext.author?.id;
    if (userId) {
      const cached = languageManager.userCache?.get(userId);
      if (cached && cached.expiresAt > Date.now()) return cached.lang;
    }
  }
  return languageManager.default;
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
  lang,
  interaction,
  footerCategory = "core",
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
  const hasExplicitLang = Boolean(lang || interaction);
  const activeLang = resolveLanguage(lang || interaction);
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
    : ui.getFooter(footerCategory, hasExplicitLang ? activeLang : null);

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
  const truncationNotice =
    t(activeLang, "container.truncation_notice") || TRUNCATION_NOTICE;
  const budget = enforceComponentBudget(containerComponents, {
    droppableIndices,
    notice: truncationNotice,
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
  const langContext =
    pick(opts, "lang") || pick(opts, "interaction") || pick(opts, "message");
  const activeLang = resolveLanguage(langContext);
  const footerCategory = pick(opts, "footerCategory") || "core";
  let rawError =
    typeof opts === "string"
      ? opts
      : pick(opts, "errorMessage") ||
        pick(opts, "description") ||
        t(activeLang, "common.error.reason_fallback");

  // Terjemahkan otomatis jika rawError berupa kunci kamus (misal err_sys_XX)
  if (typeof rawError === "string" && rawError.trim()) {
    const trimmed = rawError.trim();
    if (trimmed.startsWith("err_sys_") || /^[a-z0-9_.-]+$/i.test(trimmed)) {
      const translated = t(activeLang, trimmed);
      if (translated && translated !== trimmed) {
        rawError = translated;
      }
    }
  }

  const title = pick(opts, "title") || t(activeLang, "common.error.title");
  const authorName =
    pick(opts, "authorName") ||
    t(activeLang, "container.authors.system_guard") ||
    "Naura System Guard";
  const footerText =
    pick(opts, "footerText") || ui.getFooter(footerCategory, activeLang);
  const errEmoji =
    nauraExpression.getEmoji("error") || ui.getEmoji("error") || "❌";
  const expression =
    pick(opts, "expression") !== undefined ? pick(opts, "expression") : "error";
  const errorMessage =
    typeof opts === "string" ? nauraText.error(rawError, activeLang) : rawError;

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
    lang: activeLang,
    footerCategory,
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
  const langContext =
    pick(opts, "lang") || pick(opts, "interaction") || pick(opts, "message");
  const activeLang = resolveLanguage(langContext);
  const footerCategory = pick(opts, "footerCategory") || "core";
  const rawLoading =
    typeof opts === "string"
      ? opts
      : pick(opts, "loadingMessage") ||
        pick(opts, "description") ||
        t(activeLang, "common.loading.body");
  const title = pick(opts, "title") || t(activeLang, "common.loading.title");
  const authorName =
    pick(opts, "authorName") ||
    t(activeLang, "container.authors.task_runner") ||
    "Naura Task Runner";
  const footerText =
    pick(opts, "footerText") || ui.getFooter(footerCategory, activeLang);
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
    lang: activeLang,
    footerCategory,
    accentColorHex:
      pick(opts, "accentColorHex") ||
      ui.getColor("accent-blue") ||
      ui.getColor("primary") ||
      "#38BDF8",
    authorName,
    title: `${loadEmoji} ${title}`,
    description:
      typeof opts === "string"
        ? nauraText.loading(rawLoading, activeLang)
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
  const langContext =
    pick(opts, "lang") || pick(opts, "interaction") || pick(opts, "message");
  const activeLang = resolveLanguage(langContext);
  const footerCategory = pick(opts, "footerCategory") || "core";
  const rawMaintenance =
    typeof opts === "string"
      ? opts
      : pick(opts, "maintenanceMessage") ||
        pick(opts, "description") ||
        (activeLang ? t(activeLang, "common.maintenance.body") : null) ||
        "Sistem sedang dalam proses pemeliharaan atau peningkatan performa server. Mohon tunggu sebentar ya!";
  const title = pick(opts, "title") || "Pemeliharaan Sistem";
  const authorName = pick(opts, "authorName") || "Naura Maintenance Center";
  const footerText =
    pick(opts, "footerText") || ui.getFooter(footerCategory, activeLang);
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
    lang: activeLang,
    footerCategory,
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
  const langContext =
    pick(opts, "lang") || pick(opts, "interaction") || pick(opts, "message");
  const activeLang = resolveLanguage(langContext);
  const footerCategory = pick(opts, "footerCategory") || "core";
  const rawSuccess =
    typeof opts === "string"
      ? opts
      : pick(opts, "successMessage") ||
        pick(opts, "description") ||
        t(activeLang, "common.success.body");
  const title = pick(opts, "title") || t(activeLang, "common.success.title");
  const authorName =
    pick(opts, "authorName") ||
    t(activeLang, "container.authors.companion") ||
    "Naura Assistant";
  const footerText =
    pick(opts, "footerText") || ui.getFooter(footerCategory, activeLang);
  const okEmoji =
    nauraExpression.getEmoji("success") || ui.getEmoji("success") || "✅";
  const expression =
    pick(opts, "expression") !== undefined
      ? pick(opts, "expression")
      : "success";

  const bannerAttachmentName = pick(opts, "bannerAttachmentName");
  const files = [...(pick(opts, "files") || [])];

  return buildContainerV2({
    lang: activeLang,
    footerCategory,
    accentColorHex:
      pick(opts, "accentColorHex") || ui.getColor("success") || "#22C55E",
    authorName,
    title: `${okEmoji} ${title}`,
    description:
      typeof opts === "string"
        ? nauraText.success(rawSuccess, activeLang)
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
