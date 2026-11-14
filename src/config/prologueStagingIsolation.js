"use strict";

const env = require("./env");

const PRODUCTION_SUPABASE_PROJECT_ID = "ceqkjzvrxyifxzgxtkig";
const DEFAULT_STAGING_SUPABASE_PROJECT_ID = "pzwuextkmfqphxzckvfz";

const STAGING_REQUIRED_TABLES = Object.freeze([
  "cache_write_journal",
  "business_operations",
  "economy_transfer_taxes",
  "economy_event_outbox",
  "slice_of_life_progress_v1",
]);

const STAGING_MIGRATION_IDS = Object.freeze([
  "v51_create_cache_write_journal",
  "v52_create_business_operations",
  "v53_create_economy_transfer_taxes",
  "v54_create_economy_event_outbox",
  "v55_create_slice_of_life_progress_v1",
]);

const ALLOWED_STORY_COMPONENT_PREFIXES = Object.freeze([
  "sol_",
  "vn_choice_",
  "survival_story_",
]);

const SUPABASE_POOLER_USER_REGEX = /\bpostgres\.([a-z0-9]{15,30})\b/gi;
const SUPABASE_URL_HOST_REGEX = /\b(?:db\.)?([a-z0-9]{15,30})\.supabase\.co\b/gi;
const PROJECT_REF_ONLY_REGEX = /^[a-z0-9]{15,30}$/i;

function toBoolean(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function isPrologueStagingMode(runtimeEnv = env) {
  if (!runtimeEnv || typeof runtimeEnv !== "object") return false;
  return (
    toBoolean(runtimeEnv.PROLOGUE_STAGING_MODE) ||
    toBoolean(runtimeEnv.STORY_STAGING_MODE)
  );
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

function collectRegexMatches(value, regex, targetSet) {
  if (!value) return;
  const text = String(value);
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      targetSet.add(match[1].toLowerCase());
    }
  }
}

function decodeJwtProjectRef(token) {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3 || !parts[0].startsWith("eyJ")) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const ref = parsed?.ref ? String(parsed.ref).trim().toLowerCase() : "";
    return PROJECT_REF_ONLY_REGEX.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function extractSupabaseProjectHints(runtimeEnv = env) {
  const databaseRefs = new Set();
  const supabaseRefs = new Set();
  const allStrings = [];

  const dbUrlRaw = String(
    runtimeEnv.DATABASE_URL || runtimeEnv.SUPABASE_DATABASE_URL || "",
  ).trim();
  if (dbUrlRaw) {
    allStrings.push(dbUrlRaw);
    try {
      const parsed = new URL(dbUrlRaw);
      const user = safeDecodeURIComponent(parsed.username);
      const host = String(parsed.hostname || "").toLowerCase();
      collectRegexMatches(user, SUPABASE_POOLER_USER_REGEX, databaseRefs);
      collectRegexMatches(host, SUPABASE_URL_HOST_REGEX, databaseRefs);
    } catch {
      collectRegexMatches(dbUrlRaw, SUPABASE_POOLER_USER_REGEX, databaseRefs);
      collectRegexMatches(dbUrlRaw, SUPABASE_URL_HOST_REGEX, databaseRefs);
    }
  }

  const dbUser = String(runtimeEnv.DB_USER || "").trim();
  if (dbUser) {
    allStrings.push(dbUser);
    collectRegexMatches(dbUser, SUPABASE_POOLER_USER_REGEX, databaseRefs);
  }

  const dbHost = String(runtimeEnv.DB_HOST || "").trim();
  if (dbHost) {
    allStrings.push(dbHost);
    collectRegexMatches(dbHost, SUPABASE_URL_HOST_REGEX, databaseRefs);
  }

  const supabaseUrl = String(runtimeEnv.SUPABASE_URL || "").trim();
  if (supabaseUrl) {
    allStrings.push(supabaseUrl);
    collectRegexMatches(supabaseUrl, SUPABASE_URL_HOST_REGEX, supabaseRefs);
  }

  const supabaseProjectId = String(
    runtimeEnv.SUPABASE_PROJECT_ID || "",
  ).trim();
  if (supabaseProjectId) {
    allStrings.push(supabaseProjectId);
    if (PROJECT_REF_ONLY_REGEX.test(supabaseProjectId)) {
      supabaseRefs.add(supabaseProjectId.toLowerCase());
    }
  }

  const jwtRef = decodeJwtProjectRef(runtimeEnv.SUPABASE_KEY);
  if (jwtRef) {
    supabaseRefs.add(jwtRef);
  }

  const mentionsProduction =
    allStrings.some((item) =>
      item.toLowerCase().includes(PRODUCTION_SUPABASE_PROJECT_ID),
    ) ||
    databaseRefs.has(PRODUCTION_SUPABASE_PROJECT_ID) ||
    supabaseRefs.has(PRODUCTION_SUPABASE_PROJECT_ID);

  return {
    databaseRefs: Array.from(databaseRefs),
    supabaseRefs: Array.from(supabaseRefs),
    mentionsProduction,
  };
}

function resolvePostgresConnectionHost(runtimeEnv = env) {
  const dbUrlRaw = String(
    runtimeEnv.DATABASE_URL || runtimeEnv.SUPABASE_DATABASE_URL || "",
  ).trim();
  if (dbUrlRaw) {
    let parsed;
    try {
      parsed = new URL(dbUrlRaw);
    } catch {
      throw new Error(
        "PROLOGUE_STAGING_MODE gagal memvalidasi DATABASE_URL: format URL tidak valid.",
      );
    }
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (protocol !== "postgres:" && protocol !== "postgresql:") {
      throw new Error(
        `PROLOGUE_STAGING_MODE menolak dialek URL '${protocol}'. Wajib PostgreSQL.`,
      );
    }
    if (!parsed.hostname) {
      throw new Error(
        "PROLOGUE_STAGING_MODE mewajibkan hostname PostgreSQL yang eksplisit pada DATABASE_URL.",
      );
    }
    return parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  }

  const dialect = String(runtimeEnv.DB_DIALECT || "postgres")
    .trim()
    .toLowerCase();
  if (dialect !== "postgres" && dialect !== "postgresql") {
    throw new Error(
      `PROLOGUE_STAGING_MODE menolak DB_DIALECT='${dialect}'. Wajib PostgreSQL.`,
    );
  }
  const dbHost = String(runtimeEnv.DB_HOST || "").trim();
  if (!dbHost) {
    throw new Error(
      "PROLOGUE_STAGING_MODE wajib terhubung ke PostgreSQL staging dan menolak fallback SQLite.",
    );
  }
  return dbHost.toLowerCase();
}

function assertPrologueStagingSafety(runtimeEnv = env, options = {}) {
  const { requireGuildId = true } = options || {};
  if (!isPrologueStagingMode(runtimeEnv)) {
    return { staging: false };
  }

  const expectedProjectId = String(
    runtimeEnv.STORY_STAGING_PROJECT_ID || DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  )
    .trim()
    .toLowerCase();

  if (!PROJECT_REF_ONLY_REGEX.test(expectedProjectId)) {
    throw new Error(
      "STORY_STAGING_PROJECT_ID tidak valid untuk mode staging prolog.",
    );
  }

  if (expectedProjectId === PRODUCTION_SUPABASE_PROJECT_ID) {
    throw new Error(
      `PROLOGUE_STAGING_MODE menolak STORY_STAGING_PROJECT_ID yang menunjuk proyek produksi (${PRODUCTION_SUPABASE_PROJECT_ID}).`,
    );
  }

  const hints = extractSupabaseProjectHints(runtimeEnv);
  if (hints.mentionsProduction) {
    throw new Error(
      `PROLOGUE_STAGING_MODE diblokir: konfigurasi merujuk proyek produksi Supabase (${PRODUCTION_SUPABASE_PROJECT_ID}).`,
    );
  }

  const pgHost = resolvePostgresConnectionHost(runtimeEnv);
  const loopback = isLoopbackHost(pgHost);

  if (loopback) {
    if (!toBoolean(runtimeEnv.ALLOW_LOCAL_PROLOGUE_STAGING)) {
      throw new Error(
        "PROLOGUE_STAGING_MODE menolak PostgreSQL lokal kecuali ALLOW_LOCAL_PROLOGUE_STAGING=true diset secara eksplisit.",
      );
    }
  } else {
    if (hints.databaseRefs.length === 0) {
      throw new Error(
        `PROLOGUE_STAGING_MODE gagal memverifikasi project ref PostgreSQL staging (${expectedProjectId}). Pastikan pooler user atau host mencantumkan project ref staging.`,
      );
    }
    if (
      hints.databaseRefs.some((ref) => ref !== expectedProjectId) ||
      !hints.databaseRefs.includes(expectedProjectId)
    ) {
      throw new Error(
        `PROLOGUE_STAGING_MODE menolak target PostgreSQL di luar proyek staging (${expectedProjectId}). Ditemukan: ${hints.databaseRefs.join(", ")}`,
      );
    }
  }

  if (hints.supabaseRefs.some((ref) => ref !== expectedProjectId)) {
    throw new Error(
      `PROLOGUE_STAGING_MODE menolak konfigurasi Supabase di luar proyek staging (${expectedProjectId}). Ditemukan: ${hints.supabaseRefs.join(", ")}`,
    );
  }

  const guildId = String(runtimeEnv.GUILD_ID || "").trim();
  if (requireGuildId && !/^\d{17,20}$/.test(guildId)) {
    throw new Error(
      "PROLOGUE_STAGING_MODE mewajibkan GUILD_ID Discord valid (17-20 digit) agar deploy command terbatas pada guild staging.",
    );
  }

  return {
    staging: true,
    projectId: expectedProjectId,
    guildId: /^\d{17,20}$/.test(guildId) ? guildId : null,
    loopback,
    pgHost,
  };
}

async function verifyPrologueStagingDatabase(
  sequelize,
  runtimeEnv = env,
  options = {},
) {
  const safety = assertPrologueStagingSafety(runtimeEnv, options);
  if (!sequelize || !sequelize.options) {
    throw new Error(
      "verifyPrologueStagingDatabase membutuhkan instance Sequelize yang valid.",
    );
  }
  if (sequelize.options.dialect !== "postgres") {
    throw new Error(
      `PROLOGUE_STAGING_MODE mewajibkan dialek PostgreSQL, bukan '${sequelize.options.dialect}'.`,
    );
  }

  const [rows] = await sequelize.query(
    "SELECT " +
      "to_regclass('public.cache_write_journal') AS cache_write_journal, " +
      "to_regclass('public.business_operations') AS business_operations, " +
      "to_regclass('public.economy_transfer_taxes') AS economy_transfer_taxes, " +
      "to_regclass('public.economy_event_outbox') AS economy_event_outbox, " +
      "to_regclass('public.slice_of_life_progress_v1') AS slice_of_life_progress_v1",
  );
  const row = rows?.[0] || {};
  const missingTables = STAGING_REQUIRED_TABLES.filter((table) => !row[table]);
  if (missingTables.length > 0) {
    throw new Error(
      `Skema database staging belum lengkap. Tabel tidak ditemukan: ${missingTables.join(", ")}. Jalankan npm run db:migrate terlebih dahulu.`,
    );
  }

  const {
    verifyJournalSchema,
    verifyBusinessOperationSchema,
    verifyTransferTaxSchema,
    verifyEconomyOutboxSchema,
    verifySliceOfLifeSchema,
  } = require("../managers/dbMigrator");

  await verifyJournalSchema(sequelize);
  await verifyBusinessOperationSchema(sequelize);
  await verifyTransferTaxSchema(sequelize);
  await verifyEconomyOutboxSchema(sequelize);
  await verifySliceOfLifeSchema(sequelize);

  return {
    ok: true,
    safety,
    tables: STAGING_REQUIRED_TABLES,
  };
}

function getSyntheticUserProfile(userId) {
  const safeId = String(userId || "0");
  const starterInventory = Object.freeze([
    Object.freeze({
      id: "survival_started",
      name: "Starter Kit",
      quantity: 1,
    }),
  ]);
  const snapshot = {
    userId: safeId,
    balance: 0,
    bankBalance: 0,
    dailyStreak: 0,
    reputation: 0,
    xp: 0,
    level: 1,
    inventory: starterInventory,
    rpg_state: Object.freeze({ stagingSynthetic: true }),
    stagingSynthetic: true,
  };
  return Object.freeze({
    ...snapshot,
    toJSON() {
      return {
        ...snapshot,
        inventory: starterInventory.map((item) => ({ ...item })),
        rpg_state: { stagingSynthetic: true },
      };
    },
  });
}

function getSyntheticUserSurvival(userId) {
  const safeId = String(userId || "0");
  const snapshot = {
    userId: safeId,
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    hunger: 100,
    thirst: 100,
    sanity: 100,
    stamina: 100,
    maxStamina: 100,
    inGameHour: 8,
    day: 1,
    location: "sukamaju_staging",
    inventory: Object.freeze([]),
    statusEffects: Object.freeze([]),
    stagingSynthetic: true,
  };
  return Object.freeze({
    ...snapshot,
    toJSON() {
      return {
        ...snapshot,
        inventory: [],
        statusEffects: [],
      };
    },
  });
}

function isAllowedPrologueStagingInteraction(interaction) {
  if (!interaction) return false;

  const isSlash =
    typeof interaction.isChatInputCommand === "function"
      ? interaction.isChatInputCommand()
      : Boolean(interaction.commandName && !interaction.customId);
  const isAutocomplete =
    typeof interaction.isAutocomplete === "function"
      ? interaction.isAutocomplete()
      : false;

  if (isSlash || isAutocomplete) {
    if (interaction.commandName !== "survival") return false;
    const group =
      typeof interaction.options?.getSubcommandGroup === "function"
        ? interaction.options.getSubcommandGroup(false)
        : null;
    const sub =
      typeof interaction.options?.getSubcommand === "function"
        ? interaction.options.getSubcommand(false)
        : null;
    if (sub !== "story") return false;
    return !group || group === "profile";
  }

  const isComponent =
    typeof interaction.isMessageComponent === "function"
      ? interaction.isMessageComponent()
      : Boolean(interaction.customId);

  if (isComponent && typeof interaction.customId === "string") {
    return ALLOWED_STORY_COMPONENT_PREFIXES.some((prefix) =>
      interaction.customId.startsWith(prefix),
    );
  }

  return false;
}

module.exports = {
  PRODUCTION_SUPABASE_PROJECT_ID,
  DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  STAGING_REQUIRED_TABLES,
  STAGING_MIGRATION_IDS,
  ALLOWED_STORY_COMPONENT_PREFIXES,
  isPrologueStagingMode,
  isLoopbackHost,
  extractSupabaseProjectHints,
  resolvePostgresConnectionHost,
  assertPrologueStagingSafety,
  verifyPrologueStagingDatabase,
  getSyntheticUserProfile,
  getSyntheticUserSurvival,
  isAllowedPrologueStagingInteraction,
};
