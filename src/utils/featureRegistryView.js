"use strict";

const ui = require("../config/ui");
const {
  listFeatures,
  listFeaturesByCategory,
  listHealthCheckFeatures,
  listSetupFeatures,
} = require("../config/features");

const CATEGORY_LABELS = Object.freeze({
  system: "System",
  admin: "Admin",
  moderation: "Moderation",
  support: "Support",
  utility: "Utility",
  entertainment: "Entertainment",
  intelligence: "Intelligence",
  game: "Game",
  community: "Community",
  monetization: "Monetization",
  web: "Web",
  integration: "Integration",
});

function formatList(values, emptyLabel = "Tidak ada") {
  if (!Array.isArray(values) || values.length === 0) return emptyLabel;
  return values.map((value) => `\`${value}\``).join(", ");
}

function formatBoolean(value) {
  return value ? "Aktif" : "Nonaktif";
}

function featureStatusIcon(feature) {
  if (feature.premium) return ui.getEmoji("premium_badge") || "💎";
  if (feature.enabledByDefault) return ui.getEmoji("success") || "✅";
  return ui.getEmoji("info") || "ℹ️";
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function groupFeaturesByCategory(features = listFeatures()) {
  return features.reduce((groups, feature) => {
    const category = feature.category || "other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(feature);
    return groups;
  }, {});
}

function featureToSummaryLine(feature) {
  return `${featureStatusIcon(feature)} **${feature.name}** · ${categoryLabel(feature.category)} · ${formatBoolean(feature.enabledByDefault)}`;
}

function featureToDetailLines(feature) {
  return [
    `${featureStatusIcon(feature)} **${feature.name}**`,
    feature.description,
    `Kategori: \`${categoryLabel(feature.category)}\``,
    `Setup key: ${feature.setupKey ? `\`${feature.setupKey}\`` : "`-`"}`,
    `Default: \`${formatBoolean(feature.enabledByDefault)}\``,
    `Premium: \`${feature.premium ? "Ya" : "Tidak"}\``,
    `Health check: \`${feature.healthCheck ? "Ya" : "Tidak"}\``,
    `Env: ${formatList(feature.requiresEnv)}`,
    `Permission: ${formatList(feature.requiresPermissions)}`,
  ];
}

function buildFeatureSummaryFields(features = listFeatures()) {
  const groups = groupFeaturesByCategory(features);
  return Object.entries(groups).map(([category, items]) => ({
    name: categoryLabel(category),
    value: items.map(featureToSummaryLine).join("\n"),
  }));
}

function buildFeatureDetailFields(features = listFeatures()) {
  return features.map((feature) => ({
    name: feature.name,
    value: featureToDetailLines(feature).join("\n"),
  }));
}

function buildSetupFeatureFields() {
  return buildFeatureSummaryFields(listSetupFeatures());
}

function buildHealthCheckFeatureFields() {
  return buildFeatureSummaryFields(listHealthCheckFeatures());
}

function buildFeatureOverviewText(features = listFeatures()) {
  const total = features.length;
  const setupCount = features.filter((feature) => feature.setupKey).length;
  const healthCount = features.filter((feature) => feature.healthCheck).length;
  const defaultCount = features.filter(
    (feature) => feature.enabledByDefault,
  ).length;

  return [
    `Naura memiliki **${total}** modul utama yang sudah tercatat di feature registry.`,
    `**${defaultCount}** aktif secara default, **${setupCount}** bisa diarahkan ke setup, dan **${healthCount}** siap dipakai untuk health check.`,
    "Registry ini menjadi pondasi untuk `/help`, `/setup`, dashboard, dan `/server health`.",
  ].join("\n");
}

module.exports = {
  CATEGORY_LABELS,
  categoryLabel,
  formatList,
  groupFeaturesByCategory,
  featureToSummaryLine,
  featureToDetailLines,
  buildFeatureSummaryFields,
  buildFeatureDetailFields,
  buildSetupFeatureFields,
  buildHealthCheckFeatureFields,
  buildFeatureOverviewText,
  listFeaturesByCategory,
};
