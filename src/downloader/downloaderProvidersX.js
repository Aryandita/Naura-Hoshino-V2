"use strict";

// ==========================================
// PROVIDER X/TWITTER, AGATZ, DAN PUBLER
// ==========================================

const axios = require("axios");
const { logger } = require("../managers/logger");
const { UA } = require("./downloaderCore");
const { keepRealMedia } = require("./downloaderProvidersTikTok");

const isTweet = (url) => url.includes("twitter.com") || url.includes("x.com");

/** Ambil bagian /status/... dari tautan tweet. */
const tweetPathOf = (url) => {
  try {
    const pathname = new URL(url).pathname;
    return pathname && pathname.includes("/status/") ? pathname : null;
  } catch {
    return null;
  }
};

// ==========================================
// PROVIDER: FxTwitter
// ==========================================

const tryFxTwitter = async (url) => {
  if (!isTweet(url)) return null;
  const tweetPath = tweetPathOf(url);
  if (!tweetPath) return null;

  try {
    logger.info("[Downloader] Mencoba FxTwitter API...");
    const response = await axios.get("https://api.fxtwitter.com" + tweetPath, {
      headers: { "User-Agent": "NauraBot/2.0" },
      timeout: 10000,
    });

    const tweet =
      response.data && response.data.code === 200 ? response.data.tweet : null;
    const media = tweet && tweet.media;
    if (!media) return null;

    let items = Array.isArray(media.all) ? media.all : [];
    if (items.length === 0)
      items = [...(media.videos || []), ...(media.photos || [])];
    if (items.length === 0) return null;

    if (items.length === 1) return { status: "stream", url: items[0].url };
    return {
      status: "picker",
      picker: items.map((item) => ({
        url: item.url,
        type: item.type === "video" ? "video" : "photo",
      })),
    };
  } catch (e) {
    logger.error(`[Downloader] FxTwitter API gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: VxTwitter (cadangan)
// ==========================================

const tryVxTwitter = async (url) => {
  if (!isTweet(url)) return null;
  const tweetPath = tweetPathOf(url);
  if (!tweetPath) return null;

  try {
    logger.info("[Downloader] Mencoba VxTwitter API...");
    const response = await axios.get("https://api.vxtwitter.com" + tweetPath, {
      headers: { "User-Agent": "NauraBot/2.0" },
      timeout: 10000,
    });

    const items = response.data?.media_extended;
    if (!Array.isArray(items) || items.length === 0) return null;

    if (items.length === 1) return { status: "stream", url: items[0].url };
    return {
      status: "picker",
      picker: items.map((item) => ({
        url: item.url,
        type: item.type === "video" || item.type === "gif" ? "video" : "photo",
      })),
    };
  } catch (e) {
    logger.error(`[Downloader] VxTwitter API gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: Agatz (IG, FB, Twitter)
// ==========================================

const tryAgatz = async (url) => {
  let kind = null;
  if (url.includes("instagram.com")) kind = "instagram";
  else if (url.includes("facebook.com") || url.includes("fb.watch"))
    kind = "facebook";
  else if (isTweet(url)) kind = "twitter";
  if (!kind) return null;

  try {
    logger.info("[Downloader] Mencoba Agatz API...");
    const endpoint =
      "https://api.agatz.xyz/api/" + kind + "?url=" + encodeURIComponent(url);
    const res = await axios.get(endpoint, { timeout: 10000 });

    const r = res.data && res.data.status === 200 ? res.data.result : null;
    if (!r) return null;

    if (Array.isArray(r)) {
      const links = keepRealMedia(r, url);
      if (links.length === 0) return null;
      return links.length === 1
        ? { status: "stream", url: links[0] }
        : {
            status: "picker",
            picker: links.map((link) => ({ url: link, type: "photo" })),
          };
    }

    if (typeof r === "string") {
      return keepRealMedia([r], url).length > 0
        ? { status: "stream", url: r }
        : null;
    }

    if (typeof r === "object") {
      const candidate =
        r.hd ||
        r.sd ||
        r.url ||
        Object.values(r).find(
          (v) => typeof v === "string" && v.startsWith("http"),
        );
      if (candidate && keepRealMedia([candidate], url).length > 0) {
        return { status: "stream", url: candidate };
      }
    }
  } catch (e) {
    logger.error(`[Downloader] Agatz API gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: Publer (umum)
// ==========================================

const tryPubler = async (url) => {
  try {
    logger.info("[Downloader] Mencoba Publer API...");
    const response = await axios.post(
      "https://publer.io/api/v1/tools/media-downloader",
      { url },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": UA,
        },
        timeout: 15000,
      },
    );

    const payload =
      response.data && Array.isArray(response.data.payload)
        ? response.data.payload
        : [];
    const items = payload
      .filter((item) => item && typeof item.path === "string")
      .filter((item) => keepRealMedia([item.path], url).length > 0);

    if (items.length === 0) return null;
    if (items.length === 1) return { status: "stream", url: items[0].path };
    return {
      status: "picker",
      picker: items.map((item) => ({
        url: item.path,
        type: item.type === "video" ? "video" : "photo",
      })),
    };
  } catch (e) {
    logger.error(`[Downloader] Publer API gagal: ${e.message}`);
  }
  return null;
};

module.exports = { tryFxTwitter, tryVxTwitter, tryAgatz, tryPubler };
